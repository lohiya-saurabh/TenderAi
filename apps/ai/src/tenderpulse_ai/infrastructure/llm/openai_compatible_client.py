import asyncio
import json
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

from tenderpulse_ai.agent.validation import clean_whitespace, normalize_category
from tenderpulse_ai.domain.models import (
    CandidateComplianceItem,
    ExecutionRulesProps,
    ProvenanceProps,
)

logger = logging.getLogger("tenderpulse_ai.infrastructure.llm")


@dataclass
class LlmEndpoint:
    provider: str  # "gemini", "groq", "cerebras", "sambanova", "openrouter", "custom"
    base_url: str
    api_key: str
    model: str
    extra_headers: dict[str, str] = field(default_factory=dict)


# Curated rotation pool of reliable, active free models on OpenRouter
FALLBACK_FREE_MODELS: list[str] = [
    "liquid/lfm-2.5-2.6b:free",
    "nvidia/nemotron-3.5-lightning:free",
    "nvidia/nemotron-3.5-super-vl:free",
    "openrouter/free",
]

# Option C: High-speed, high-rate-limit free tier provider specs
PROVIDER_SPECS: dict[str, dict[str, Any]] = {
    "gemini": {
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "models": ["gemini-2.5-flash", "gemini-1.5-flash"],
        "extra_headers": {},
    },
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "models": ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
        "extra_headers": {},
    },
    "cerebras": {
        "base_url": "https://api.cerebras.ai/v1",
        "models": ["llama3.1-70b", "llama3.1-8b"],
        "extra_headers": {},
    },
    "sambanova": {
        "base_url": "https://api.sambanova.ai/v1",
        "models": ["Meta-Llama-3.3-70B-Instruct", "Meta-Llama-3.1-8B-Instruct"],
        "extra_headers": {},
    },
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "models": [
            "openrouter/free",
            "liquid/lfm-2.5-2.6b:free",
            "nvidia/nemotron-3.5-lightning:free",
            "nvidia/nemotron-3.5-super-vl:free",
        ],
        "extra_headers": {
            "HTTP-Referer": "https://tenderpulse.ai",
            "X-Title": "TenderPulse Intelligence Engine",
        },
    },
}

# In-memory cooldown registry to prevent hammer-retrying rate-limited endpoints (endpoint_key -> unban_timestamp)
_MODEL_COOLDOWNS: dict[str, float] = {}


def _recover_truncated_json(content: str) -> list[dict[str, Any]]:
    """
    Salvages completed candidate JSON objects from an output stream that was
    truncated mid-generation (e.g. at max token limit).
    """
    items: list[dict[str, Any]] = []
    for match in re.finditer(r"\{", content):
        start_idx = match.start()
        # Skip the root container object if it was truncated
        if start_idx == 0 and any(
            k in content[:40] for k in ("candidates", "items", "requirements")
        ):
            continue
        brace_count = 0
        end_idx = -1
        in_string = False
        escape = False
        for i in range(start_idx, len(content)):
            char = content[i]
            if escape:
                escape = False
                continue
            if char == "\\":
                escape = True
                continue
            if char == '"':
                in_string = not in_string
                continue
            if not in_string:
                if char == "{":
                    brace_count += 1
                elif char == "}":
                    brace_count -= 1
                    if brace_count == 0:
                        end_idx = i + 1
                        break
        if end_idx != -1:
            snippet = content[start_idx:end_idx]
            try:
                obj = json.loads(snippet)
                if isinstance(obj, dict) and any(
                    k in obj
                    for k in ("title", "category", "requirement", "description", "name", "quote")
                ):
                    items.append(obj)
            except Exception:
                pass

    unique: list[dict[str, Any]] = []
    seen: set[str] = set()
    for it in items:
        k = json.dumps(it, sort_keys=True)
        if k not in seen:
            seen.add(k)
            unique.append(it)
    return unique


class OpenAICompatibleLlmClient:
    """
    High-performance asynchronous HTTP client for OpenAI-compatible LLM gateways (Groq, Gemini, Cerebras, SambaNova, OpenRouter).
    Enforces dynamic multi-provider rotation across free tiers on rate-limits (HTTP 429), structured JSON extraction,
    token-saving block-based provenance, exponential backoff for transient errors, and robust Pydantic parsing.
    """

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str = "https://openrouter.ai/api/v1",
        model: str = "openrouter/free",
        timeout: float = 45.0,
        max_tokens: int = 1200,
        client: httpx.AsyncClient | None = None,
        endpoints: list[LlmEndpoint] | None = None,
        provider: str = "rotation",
    ):
        self.api_key = api_key or ""
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout
        self.max_tokens = max_tokens
        self._custom_client = client
        self.provider = provider

        if endpoints:
            self.endpoints = list(endpoints)
        elif api_key:
            extra = {}
            if "openrouter.ai" in self.base_url:
                extra = {
                    "HTTP-Referer": "https://tenderpulse.ai",
                    "X-Title": "TenderPulse Intelligence Engine",
                }
            self.endpoints = [
                LlmEndpoint(
                    provider="custom",
                    base_url=self.base_url,
                    api_key=self.api_key,
                    model=self.model,
                    extra_headers=extra,
                )
            ]
            if "openrouter.ai" in self.base_url:
                for fb in FALLBACK_FREE_MODELS:
                    if fb != self.model:
                        self.endpoints.append(
                            LlmEndpoint(
                                provider="openrouter",
                                base_url=self.base_url,
                                api_key=self.api_key,
                                model=fb,
                                extra_headers=extra,
                            )
                        )
        else:
            self.endpoints = []

    @classmethod
    def create_from_settings(
        cls,
        settings: Any,
        timeout: float | None = None,
        max_tokens: int = 1200,
        client: httpx.AsyncClient | None = None,
    ) -> "OpenAICompatibleLlmClient":
        provider = getattr(settings, "llm_provider", "rotation").lower().strip()
        t = timeout if timeout is not None else getattr(settings, "llm_timeout_seconds", 45.0)
        endpoints: list[LlmEndpoint] = []

        def _add_provider_endpoints(p_name: str, key: str, custom_model: str | None = None):
            spec = PROVIDER_SPECS.get(p_name)
            if not spec:
                return
            models = [custom_model] if custom_model else spec["models"]
            for m in models:
                if m:
                    endpoints.append(
                        LlmEndpoint(
                            provider=p_name,
                            base_url=spec["base_url"],
                            api_key=key,
                            model=m,
                            extra_headers=dict(spec["extra_headers"]),
                        )
                    )

        # 1. Direct provider selection (e.g. LLM_PROVIDER=openrouter, gemini, groq)
        if provider == "openrouter":
            or_key = getattr(settings, "openrouter_api_key", None) or getattr(
                settings, "llm_api_key", None
            )
            if or_key:
                or_model = getattr(settings, "llm_model", "openrouter/free")
                _add_provider_endpoints("openrouter", or_key, or_model)
        elif provider == "gemini":
            g_key = getattr(settings, "gemini_api_key", None) or getattr(
                settings, "llm_api_key", None
            )
            if g_key:
                _add_provider_endpoints("gemini", g_key)
        elif provider == "groq":
            groq_key = getattr(settings, "groq_api_key", None) or getattr(
                settings, "llm_api_key", None
            )
            if groq_key:
                _add_provider_endpoints("groq", groq_key)
        elif provider == "cerebras":
            c_key = getattr(settings, "cerebras_api_key", None) or getattr(
                settings, "llm_api_key", None
            )
            if c_key:
                _add_provider_endpoints("cerebras", c_key)
        elif provider == "sambanova":
            s_key = getattr(settings, "sambanova_api_key", None) or getattr(
                settings, "llm_api_key", None
            )
            if s_key:
                _add_provider_endpoints("sambanova", s_key)
        else:
            # Option C: Multi-Provider Free Rotation (Groq + Gemini + Cerebras + SambaNova + OpenRouter)
            if getattr(settings, "gemini_api_key", None):
                _add_provider_endpoints("gemini", settings.gemini_api_key)
            if getattr(settings, "groq_api_key", None):
                _add_provider_endpoints("groq", settings.groq_api_key)
            if getattr(settings, "cerebras_api_key", None):
                _add_provider_endpoints("cerebras", settings.cerebras_api_key)
            if getattr(settings, "sambanova_api_key", None):
                _add_provider_endpoints("sambanova", settings.sambanova_api_key)
            if getattr(settings, "openrouter_api_key", None):
                _add_provider_endpoints("openrouter", settings.openrouter_api_key)

            # If no provider-specific keys were configured, check generic llm_api_key and llm_base_url
            if not endpoints and getattr(settings, "llm_api_key", None):
                base = getattr(settings, "llm_base_url", "https://openrouter.ai/api/v1").rstrip("/")
                key = settings.llm_api_key
                model = getattr(settings, "llm_model", "openrouter/free")
                if "googleapis.com" in base:
                    _add_provider_endpoints("gemini", key, model)
                elif "groq.com" in base:
                    _add_provider_endpoints("groq", key, model)
                elif "cerebras.ai" in base:
                    _add_provider_endpoints("cerebras", key, model)
                elif "sambanova.ai" in base:
                    _add_provider_endpoints("sambanova", key, model)
                elif "openrouter.ai" in base:
                    _add_provider_endpoints("openrouter", key, model)
                else:
                    endpoints.append(
                        LlmEndpoint(
                            provider="custom",
                            base_url=base,
                            api_key=key,
                            model=model,
                        )
                    )

        primary_ep = endpoints[0] if endpoints else None
        return cls(
            api_key=primary_ep.api_key
            if primary_ep
            else (getattr(settings, "llm_api_key", "") or ""),
            base_url=primary_ep.base_url
            if primary_ep
            else getattr(settings, "llm_base_url", "https://openrouter.ai/api/v1"),
            model=primary_ep.model
            if primary_ep
            else getattr(settings, "llm_model", "openrouter/free"),
            timeout=t,
            max_tokens=max_tokens,
            client=client,
            endpoints=endpoints,
            provider=provider,
        )

    def _get_candidate_endpoints(self) -> list[LlmEndpoint]:
        """
        Returns a prioritized list of candidate endpoints for rotation.
        Uncooled endpoints appear first; cooled endpoints appear last.
        Permanently unavailable (inf) endpoints are omitted.
        """
        now = time.time()
        expired = [
            k for k, expiry in _MODEL_COOLDOWNS.items() if expiry < float("inf") and now >= expiry
        ]
        for k in expired:
            _MODEL_COOLDOWNS.pop(k, None)

        endpoints = self.endpoints or [
            LlmEndpoint(
                provider="custom",
                base_url=self.base_url,
                api_key=self.api_key,
                model=self.model,
            )
        ]

        active: list[LlmEndpoint] = []
        cooling: list[LlmEndpoint] = []

        for ep in endpoints:
            expiry = _MODEL_COOLDOWNS.get(ep.model) or _MODEL_COOLDOWNS.get(
                f"{ep.base_url}::{ep.model}"
            )
            if expiry is None:
                active.append(ep)
            elif expiry < float("inf"):
                cooling.append(ep)

        return active + cooling

    def _get_candidate_models(self) -> list[str]:
        """
        Returns model identifiers for active endpoints (backward compatibility).
        """
        return [ep.model for ep in self._get_candidate_endpoints()]

    def _get_client(self) -> httpx.AsyncClient:
        if self._custom_client is not None:
            return self._custom_client
        return httpx.AsyncClient(timeout=self.timeout)

    async def generate_chat_completion(
        self,
        messages: list[dict[str, str]],
        system_prompt: str | None = None,
        max_retries: int = 2,
        temperature: float = 0.2,
    ) -> str:
        """
        Generates a fluid conversational chat completion with automated multi-provider failover.
        """
        full_messages = []
        if system_prompt:
            full_messages.append({"role": "system", "content": system_prompt})
        full_messages.extend(messages)

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": full_messages,
            "max_tokens": self.max_tokens,
            "temperature": temperature,
        }

        endpoints_to_try = self._get_candidate_endpoints()
        last_error: Exception | None = None

        for ep in endpoints_to_try:
            k = f"{ep.base_url}::{ep.model}"
            endpoint_url = f"{ep.base_url}/chat/completions"
            headers = {
                "Authorization": f"Bearer {ep.api_key}",
                "Content-Type": "application/json",
            }
            if ep.extra_headers:
                headers.update(ep.extra_headers)

            payload["model"] = ep.model

            for attempt in range(max_retries + 1):
                try:
                    client = self._get_client()
                    if self._custom_client is not None:
                        response = await client.post(endpoint_url, headers=headers, json=payload)
                    else:
                        async with client:
                            response = await client.post(
                                endpoint_url, headers=headers, json=payload
                            )

                    # HTTP 429: 60-second cooldown on this provider endpoint; rotate immediately
                    if response.status_code == 429:
                        _MODEL_COOLDOWNS[ep.model] = time.time() + 60.0
                        _MODEL_COOLDOWNS[k] = time.time() + 60.0
                        logger.warning(
                            "[OpenAICompatibleClient] Endpoint '%s' (%s) rate-limited (429). Setting 60s cooldown and rotating to next provider...",
                            ep.model,
                            ep.provider,
                        )
                        break

                    # HTTP 404: Permanent unavailability for this model
                    if response.status_code == 404:
                        _MODEL_COOLDOWNS[ep.model] = float("inf")
                        _MODEL_COOLDOWNS[k] = float("inf")
                        logger.warning(
                            "[OpenAICompatibleClient] Endpoint '%s' (%s) returned 404. Marking model permanently unavailable and rotating...",
                            ep.model,
                            ep.provider,
                        )
                        break

                    # HTTP 401 / 403: Re-raise immediately
                    if response.status_code in (401, 403):
                        response.raise_for_status()

                    # HTTP 400 / 402: Configuration or quota
                    if response.status_code in (400, 402):
                        if response.status_code == 402 and "in-flight" in response.text.lower():
                            logger.info(
                                "[OpenAICompatibleClient] Model '%s' hit in-flight reserve limit. Backing off 1.5s...",
                                ep.model,
                            )
                            if attempt < max_retries:
                                await asyncio.sleep(1.5 * (attempt + 1))
                                continue
                        _MODEL_COOLDOWNS[ep.model] = time.time() + 300.0
                        _MODEL_COOLDOWNS[k] = time.time() + 300.0
                        logger.warning(
                            "[OpenAICompatibleClient] Endpoint '%s' (%s) returned HTTP %d: %s. Rotating...",
                            ep.model,
                            ep.provider,
                            response.status_code,
                            response.text[:200],
                        )
                        break

                    if response.status_code in (500, 502, 503, 504):
                        if attempt < max_retries:
                            await asyncio.sleep(0.5 * (2**attempt))
                            continue
                        break

                    response.raise_for_status()
                    data = response.json()
                    choices = data.get("choices", [])
                    if choices:
                        res_content = str(choices[0].get("message", {}).get("content", "")).strip()
                        if res_content:
                            _MODEL_COOLDOWNS.pop(ep.model, None)
                            _MODEL_COOLDOWNS.pop(k, None)
                            return res_content
                    break
                except (httpx.RequestError, httpx.HTTPStatusError) as exc:
                    last_error = exc
                    if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code in (
                        400,
                        401,
                        402,
                        403,
                        404,
                        429,
                    ):
                        break
                    if attempt < max_retries:
                        await asyncio.sleep(0.5 * (2**attempt))
                        continue
                    break
                except Exception as exc:  # noqa: BLE001
                    last_error = exc
                    break

        if last_error:
            logger.warning(
                "[OpenAICompatibleClient] Chat completion failed across available endpoints: %s",
                last_error,
            )
        return ""

    async def extract_compliance(
        self,
        system_prompt: str,
        user_prompt: str,
        max_retries: int = 1,
        block_map: dict[str, Any] | None = None,
    ) -> list[CandidateComplianceItem]:
        """
        Extracts structured compliance items, rotating dynamically through the multi-provider pool
        upon rate limits (429) or upstream unavailability.
        Supports token-saving block resolution via block_map.
        """
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
            "max_tokens": self.max_tokens,
            "temperature": 0.0,
        }

        endpoints_to_try = self._get_candidate_endpoints()
        last_error: Exception | None = None

        for ep in endpoints_to_try:
            k = f"{ep.base_url}::{ep.model}"
            endpoint_url = f"{ep.base_url}/chat/completions"
            headers = {
                "Authorization": f"Bearer {ep.api_key}",
                "Content-Type": "application/json",
            }
            if ep.extra_headers:
                headers.update(ep.extra_headers)

            payload["model"] = ep.model

            for attempt in range(max_retries + 1):
                start_time = time.perf_counter()
                logger.info(
                    "Dispatching LLM inference request to %s (provider=%s, model=%s, attempt=%d)",
                    ep.base_url,
                    ep.provider,
                    ep.model,
                    attempt + 1,
                    extra={
                        "event": "llm.request.started",
                        "metadata": {
                            "provider": ep.provider,
                            "model": ep.model,
                            "attempt": attempt + 1,
                        },
                    },
                )
                try:
                    client = self._get_client()
                    if self._custom_client is not None:
                        response = await client.post(endpoint_url, headers=headers, json=payload)
                    else:
                        async with client:
                            response = await client.post(
                                endpoint_url, headers=headers, json=payload
                            )

                    duration_ms = round((time.perf_counter() - start_time) * 1000, 1)

                    # HTTP 429: 60-second cooldown on this endpoint, immediately rotate to next provider
                    if response.status_code == 429:
                        _MODEL_COOLDOWNS[ep.model] = time.time() + 60.0
                        _MODEL_COOLDOWNS[k] = time.time() + 60.0
                        logger.warning(
                            "[OpenAICompatibleClient] Endpoint '%s' (%s) rate-limited (429). Setting 60s cooldown and rotating to next provider...",
                            ep.model,
                            ep.provider,
                            extra={
                                "event": "llm.request.rate_limited",
                                "duration_ms": duration_ms,
                                "model": ep.model,
                            },
                        )
                        break

                    # HTTP 404: Permanent unavailability
                    if response.status_code == 404:
                        _MODEL_COOLDOWNS[ep.model] = float("inf")
                        _MODEL_COOLDOWNS[k] = float("inf")
                        logger.warning(
                            "[OpenAICompatibleClient] Endpoint '%s' (%s) returned 404. Marking permanently unavailable and rotating...",
                            ep.model,
                            ep.provider,
                            extra={
                                "event": "llm.request.model_unavailable",
                                "duration_ms": duration_ms,
                                "model": ep.model,
                            },
                        )
                        break

                    # HTTP 401 / 403: Re-raise immediately
                    if response.status_code in (401, 403):
                        _MODEL_COOLDOWNS[ep.model] = float("inf")
                        _MODEL_COOLDOWNS[k] = float("inf")
                        response.raise_for_status()

                    # HTTP 400 / 402:
                    if response.status_code in (400, 402):
                        if response.status_code == 402 and "in-flight" in response.text.lower():
                            logger.info(
                                "[OpenAICompatibleClient] Model '%s' hit in-flight concurrency reserve limit. Backing off 1.5s...",
                                ep.model,
                            )
                            if attempt < max_retries:
                                await asyncio.sleep(1.5 * (attempt + 1))
                                continue
                        _MODEL_COOLDOWNS[ep.model] = time.time() + 300.0
                        _MODEL_COOLDOWNS[k] = time.time() + 300.0
                        logger.warning(
                            "[OpenAICompatibleClient] Endpoint '%s' (%s) returned HTTP %d: %s. Rotating...",
                            ep.model,
                            ep.provider,
                            response.status_code,
                            response.text[:200],
                            extra={
                                "event": "llm.request.model_unavailable",
                                "duration_ms": duration_ms,
                                "model": ep.model,
                            },
                        )
                        break

                    if response.status_code in (500, 502, 503, 504):
                        response_text = response.text
                        last_error = httpx.HTTPStatusError(
                            f"HTTP {response.status_code}: {response_text[:200]}",
                            request=response.request,
                            response=response,
                        )
                        logger.warning(
                            "[OpenAICompatibleClient] Transient upstream error %d on %s (%s) attempt %d: %s",
                            response.status_code,
                            ep.model,
                            ep.provider,
                            attempt + 1,
                            response_text[:200],
                            extra={
                                "event": "llm.request.retry",
                                "duration_ms": duration_ms,
                                "error_code": f"HTTP_{response.status_code}",
                            },
                        )
                        if attempt < max_retries:
                            await asyncio.sleep(0.5 * (2**attempt))
                            continue
                        break

                    response.raise_for_status()
                    data = response.json()
                    usage = data.get("usage", {})
                    logger.info(
                        "LLM extraction completed in %.1fms with provider %s model %s (prompt_tokens=%s, completion_tokens=%s)",
                        duration_ms,
                        ep.provider,
                        ep.model,
                        usage.get("prompt_tokens"),
                        usage.get("completion_tokens"),
                        extra={
                            "event": "llm.request.completed",
                            "duration_ms": duration_ms,
                            "metadata": {
                                "provider": ep.provider,
                                "model": data.get("model", ep.model),
                                "prompt_tokens": usage.get("prompt_tokens"),
                                "completion_tokens": usage.get("completion_tokens"),
                                "total_tokens": usage.get("total_tokens"),
                                "attempt": attempt + 1,
                            },
                        },
                    )
                    candidates = self._parse_response(data, block_map=block_map)
                    if candidates:
                        _MODEL_COOLDOWNS.pop(ep.model, None)
                        _MODEL_COOLDOWNS.pop(k, None)
                        return candidates
                    break

                except (httpx.RequestError, httpx.HTTPStatusError) as exc:
                    duration_ms = round((time.perf_counter() - start_time) * 1000, 1)
                    last_error = exc
                    if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code in (
                        401,
                        403,
                    ):
                        other_providers = [e for e in endpoints_to_try if e.base_url != ep.base_url]
                        if not other_providers:
                            raise exc
                    logger.warning(
                        "[OpenAICompatibleClient] Network/HTTP error on %s (%s) attempt %d/%d: %s",
                        ep.model,
                        ep.provider,
                        attempt + 1,
                        max_retries + 1,
                        str(exc),
                        extra={
                            "event": "llm.request.failed",
                            "duration_ms": duration_ms,
                            "error_code": "ERR_LLM_NETWORK",
                        },
                    )
                    if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code in (
                        400,
                        401,
                        402,
                        403,
                        404,
                        429,
                    ):
                        break
                    if attempt < max_retries:
                        await asyncio.sleep(0.5 * (2**attempt))
                        continue
                    break
                except Exception as exc:  # noqa: BLE001
                    duration_ms = round((time.perf_counter() - start_time) * 1000, 1)
                    last_error = exc
                    logger.error(
                        "[OpenAICompatibleClient] Unhandled error during extraction on %s: %s",
                        ep.model,
                        str(exc),
                        extra={
                            "event": "llm.request.failed",
                            "duration_ms": duration_ms,
                            "error_code": "ERR_LLM_UNHANDLED",
                        },
                    )
                    break

        if last_error:
            raise last_error
        return []

    def _parse_response(
        self,
        data: dict[str, Any],
        block_map: dict[str, Any] | None = None,
    ) -> list[CandidateComplianceItem]:
        choices = data.get("choices", [])
        if not choices:
            raise RuntimeError("[OpenAICompatibleClient] Upstream response contained 0 choices.")

        message = choices[0].get("message", {})
        content = message.get("content", "")
        if not content or not str(content).strip():
            raise RuntimeError(
                "[OpenAICompatibleClient] Upstream response contained empty message content."
            )

        # If model returned markdown fenced json, strip fences
        cleaned_content = re.sub(r"^```(?:json)?\s*", "", content.strip(), flags=re.IGNORECASE)
        cleaned_content = re.sub(r"\s*```$", "", cleaned_content.strip())

        raw_items: list[dict[str, Any]] = []
        try:
            parsed = json.loads(cleaned_content)
            if isinstance(parsed, list):
                raw_items = parsed
            elif isinstance(parsed, dict):
                if "candidates" in parsed and isinstance(parsed["candidates"], list):
                    raw_items = parsed["candidates"]
                elif "items" in parsed and isinstance(parsed["items"], list):
                    raw_items = parsed["items"]
                elif "requirements" in parsed and isinstance(parsed["requirements"], list):
                    raw_items = parsed["requirements"]
        except json.JSONDecodeError as err:
            logger.warning(
                "[OpenAICompatibleClient] Primary JSON decode failed (%s). Attempting truncated JSON recovery. Snippet: %s",
                err,
                cleaned_content[:200],
            )
            raw_items = _recover_truncated_json(cleaned_content)
            if raw_items:
                logger.info(
                    "[OpenAICompatibleClient] Successfully recovered %d candidate items from truncated output stream.",
                    len(raw_items),
                )

        candidates: list[CandidateComplianceItem] = []
        for raw in raw_items:
            try:
                candidate = self._build_candidate(raw, block_map=block_map)
                if candidate:
                    candidates.append(candidate)
            except (KeyError, ValueError, TypeError, AttributeError) as build_err:
                logger.debug(
                    "[OpenAICompatibleClient] Skipping unparseable candidate item: %s", build_err
                )

        return candidates

    def _build_candidate(
        self,
        raw: dict[str, Any],
        block_map: dict[str, Any] | None = None,
    ) -> CandidateComplianceItem | None:
        raw_title = (
            raw.get("title")
            or raw.get("name")
            or raw.get("requirement")
            or raw.get("obligation_type")
            or ""
        )
        title = clean_whitespace(str(raw_title))
        if not title:
            return None
        raw_cat = str(
            raw.get("category") or raw.get("obligation_category") or raw.get("type") or "STATUTORY"
        )
        try:
            category = normalize_category(raw_cat)
        except Exception:
            category = "STATUTORY"

        description = clean_whitespace(
            raw.get("description")
            or raw.get("summary")
            or raw.get("requirement")
            or raw.get("details")
            or ""
        )

        # Execution Rules mapping
        raw_rules = raw.get("execution_rules") or raw.get("executionRules") or {}
        raw_denom = raw_rules.get("stamp_paper_denomination_inr") or raw_rules.get(
            "stampPaperDenominationInr"
        )
        denom: int | None = None
        if raw_denom is not None:
            try:
                denom = int(raw_denom)
            except (ValueError, TypeError):
                denom = None

        signing_rank = (
            raw_rules.get("signing_authority_rank")
            or raw_rules.get("signingAuthorityRank")
            or "Authorized Signatory"
        )

        execution_rules = ExecutionRulesProps(
            stamp_paper_required=bool(
                raw_rules.get("stamp_paper_required") or raw_rules.get("stampPaperRequired")
            ),
            stamp_paper_denomination_inr=denom,
            notarization_required=bool(
                raw_rules.get("notarization_required") or raw_rules.get("notarizationRequired")
            ),
            udin_required=bool(raw_rules.get("udin_required") or raw_rules.get("udinRequired")),
            signing_authority_rank=str(signing_rank),
        )

        # Provenance mapping & Token-Saving Block Resolution
        raw_prov = raw.get("provenance") or {}
        b_id = (
            raw_prov.get("source_block_id")
            or raw_prov.get("sourceBlockId")
            or raw_prov.get("block_id")
            or raw.get("source_block_id")
            or raw.get("sourceBlockId")
            or raw.get("block_id")
        )

        matched_block: dict[str, Any] | None = None
        if b_id and block_map:
            clean_b_id = re.sub(r"[\[\]\s]", "", str(b_id)).upper()
            matched_block = block_map.get(clean_b_id) or block_map.get(str(b_id).strip())

        doc_id = (
            raw_prov.get("source_document_id")
            or raw_prov.get("sourceDocumentId")
            or raw.get("source_document_id")
            or (matched_block.get("document_id") if matched_block else None)
            or "doc_source"
        )
        file_name = (
            raw_prov.get("source_file_name")
            or raw_prov.get("sourceFileName")
            or raw.get("source_file_name")
            or (matched_block.get("file_name") if matched_block else None)
            or "uploaded_document.pdf"
        )
        page_num = (
            raw_prov.get("page_number")
            or raw_prov.get("pageNumber")
            or raw_prov.get("page")
            or raw.get("page_number")
            or raw.get("page")
            or (matched_block.get("page_number") if matched_block else None)
            or 1
        )
        clause_ref = (
            raw_prov.get("clause_reference")
            or raw_prov.get("clauseReference")
            or raw_prov.get("clause")
            or raw.get("clause_reference")
            or raw.get("clause")
            or (matched_block.get("clause_reference") if matched_block else None)
            or f"Page {page_num}"
        )
        quote = (
            raw_prov.get("verbatim_quote")
            or raw_prov.get("verbatimQuote")
            or raw_prov.get("quote")
            or raw.get("verbatim_quote")
            or raw.get("quote")
            or raw.get("text")
            or ""
        )
        clean_quote = clean_whitespace(str(quote))

        # Token-Saving Feature: If LLM outputted source_block_id without full verbatim quote,
        # resolve the verbatim quote directly from the source block in block_map!
        if matched_block and (
            not clean_quote or clean_quote.strip() == "..." or len(clean_quote) < 10
        ):
            block_text = matched_block.get("text", "")
            snippet = raw_prov.get("quote_snippet") or raw.get("quote_snippet")
            if snippet and "..." in str(snippet):
                parts = [p.strip() for p in str(snippet).split("...") if p.strip()]
                if len(parts) >= 2:
                    start_p = parts[0].lower()
                    end_p = parts[-1].lower()
                    bt_lower = block_text.lower()
                    s_idx = bt_lower.find(start_p)
                    e_idx = bt_lower.rfind(end_p)
                    if s_idx != -1 and e_idx != -1 and e_idx > s_idx:
                        clean_quote = clean_whitespace(block_text[s_idx : e_idx + len(end_p)])
            if not clean_quote:
                clean_quote = clean_whitespace(block_text)

        if not clean_quote:
            return None
        conf = float(raw_prov.get("confidence_score") or raw_prov.get("confidenceScore") or 0.95)

        provenance = ProvenanceProps(
            source_document_id=str(doc_id),
            source_file_name=str(file_name),
            page_number=int(page_num),
            clause_reference=str(clause_ref),
            source_block_id=str(b_id) if b_id else None,
            verbatim_quote=clean_quote,
            confidence_score=conf,
        )

        return CandidateComplianceItem(
            category=category,
            title=title,
            description=description,
            execution_rules=execution_rules,
            provenance=provenance,
        )
