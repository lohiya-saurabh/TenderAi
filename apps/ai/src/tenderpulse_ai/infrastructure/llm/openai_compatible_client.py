import asyncio
import json
import logging
import re
import time
from typing import Any

import httpx

from tenderpulse_ai.agent.validation import clean_whitespace, normalize_category
from tenderpulse_ai.domain.models import (
    CandidateComplianceItem,
    ExecutionRulesProps,
    ProvenanceProps,
)

logger = logging.getLogger("tenderpulse_ai.infrastructure.llm")

# Curated rotation pool of reliable, active free models on OpenRouter
FALLBACK_FREE_MODELS: list[str] = [
    "minimax/minimax-m3.1-flash:free",
    "xingchen-agi/xing4.0-29b-a4b:free",
    "nvidia/nemotron-3.5-lightning:free",
    "liquid/lfm-2.5-2.6b:free",
    "google/gemma-4-31b-it:free",
    "google/gemma-4-26b-a4b-it:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "poolside/laguna-s-2.1:free",
]

# In-memory cooldown registry to prevent hammer-retrying rate-limited models (model_id -> unban_timestamp)
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
    High-performance asynchronous HTTP client for OpenAI-compatible LLM gateways (OpenRouter, OpenAI, vLLM, Groq).
    Enforces dynamic multi-model rotation across free tiers on rate-limits (HTTP 429), structured JSON extraction,
    exponential backoff for transient errors, and robust Pydantic parsing.
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://openrouter.ai/api/v1",
        model: str = "minimax/minimax-m3.1-flash:free",
        timeout: float = 45.0,
        max_tokens: int = 4096,
        client: httpx.AsyncClient | None = None,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout
        self.max_tokens = max_tokens
        self._custom_client = client

    def _get_candidate_models(self) -> list[str]:
        """
        Returns a prioritized list of candidate models for rotation.
        Uncooled models appear first; cooled models appear last.
        """
        now = time.time()
        # Clean expired cooldowns
        expired = [m for m, expiry in _MODEL_COOLDOWNS.items() if now >= expiry]
        for m in expired:
            _MODEL_COOLDOWNS.pop(m, None)

        ordered: list[str] = [self.model]
        for fb in FALLBACK_FREE_MODELS:
            if fb not in ordered:
                ordered.append(fb)

        # Prioritize active models over models currently on cooldown
        active_models = [m for m in ordered if m not in _MODEL_COOLDOWNS]
        cooling_models = [m for m in ordered if m in _MODEL_COOLDOWNS]
        return active_models + cooling_models

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
        Generates a fluid conversational chat completion with automated free-tier model failover.
        """
        endpoint = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://tenderpulse.ai",
            "X-Title": "TenderPulse Intelligence Engine",
        }

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

        models_to_try = self._get_candidate_models()
        last_error: Exception | None = None

        for current_model in models_to_try:
            payload["model"] = current_model
            for attempt in range(max_retries + 1):
                try:
                    client = self._get_client()
                    if self._custom_client is not None:
                        response = await client.post(endpoint, headers=headers, json=payload)
                    else:
                        async with client:
                            response = await client.post(endpoint, headers=headers, json=payload)

                    if response.status_code == 429:
                        _MODEL_COOLDOWNS[current_model] = time.time() + 90.0
                        logger.warning(
                            "[OpenAICompatibleClient] Model '%s' rate-limited (429). Rotating to next free model in pool...",
                            current_model,
                        )
                        break

                    if response.status_code in (400, 402, 403, 404):
                        _MODEL_COOLDOWNS[current_model] = time.time() + 300.0
                        logger.warning(
                            "[OpenAICompatibleClient] Model '%s' returned HTTP %d. Switching to next free model in pool...",
                            current_model,
                            response.status_code,
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
                            _MODEL_COOLDOWNS.pop(current_model, None)
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
                "[OpenAICompatibleClient] Chat completion failed across all free models: %s",
                last_error,
            )
        return ""

    async def extract_compliance(
        self,
        system_prompt: str,
        user_prompt: str,
        max_retries: int = 1,
    ) -> list[CandidateComplianceItem]:
        """
        Extracts structured compliance items, rotating dynamically through the free model pool
        upon rate limits (429) or upstream unavailability.
        """
        endpoint = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://tenderpulse.ai",
            "X-Title": "TenderPulse Intelligence Engine",
        }

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

        models_to_try = self._get_candidate_models()
        last_error: Exception | None = None

        for current_model in models_to_try:
            payload["model"] = current_model
            for attempt in range(max_retries + 1):
                start_time = time.perf_counter()
                logger.info(
                    "Dispatching LLM inference request to %s (model=%s, attempt=%d)",
                    self.base_url,
                    current_model,
                    attempt + 1,
                    extra={
                        "event": "llm.request.started",
                        "metadata": {"model": current_model, "attempt": attempt + 1},
                    },
                )
                try:
                    client = self._get_client()
                    if self._custom_client is not None:
                        response = await client.post(endpoint, headers=headers, json=payload)
                    else:
                        async with client:
                            response = await client.post(endpoint, headers=headers, json=payload)

                    duration_ms = round((time.perf_counter() - start_time) * 1000, 1)

                    if response.status_code == 429:
                        _MODEL_COOLDOWNS[current_model] = time.time() + 90.0
                        logger.warning(
                            "[OpenAICompatibleClient] Model '%s' rate-limited (429). Rotating to next free model in pool...",
                            current_model,
                            extra={
                                "event": "llm.request.rate_limited",
                                "duration_ms": duration_ms,
                                "model": current_model,
                            },
                        )
                        break  # Rotate to next free model immediately

                    if response.status_code in (400, 402, 403, 404):
                        _MODEL_COOLDOWNS[current_model] = time.time() + 300.0
                        logger.warning(
                            "[OpenAICompatibleClient] Model '%s' returned HTTP %d. Switching to next free model...",
                            current_model,
                            response.status_code,
                            extra={
                                "event": "llm.request.model_unavailable",
                                "duration_ms": duration_ms,
                                "model": current_model,
                            },
                        )
                        break  # Rotate to next free model immediately

                    if response.status_code in (500, 502, 503, 504):
                        response_text = response.text
                        last_error = httpx.HTTPStatusError(
                            f"HTTP {response.status_code}: {response_text[:200]}",
                            request=response.request,
                            response=response,
                        )
                        logger.warning(
                            "[OpenAICompatibleClient] Transient upstream error %d on model %s attempt %d: %s",
                            response.status_code,
                            current_model,
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
                        break  # Try next model

                    response.raise_for_status()
                    data = response.json()
                    usage = data.get("usage", {})
                    logger.info(
                        "LLM extraction completed in %.1fms with model %s (prompt_tokens=%s, completion_tokens=%s)",
                        duration_ms,
                        current_model,
                        usage.get("prompt_tokens"),
                        usage.get("completion_tokens"),
                        extra={
                            "event": "llm.request.completed",
                            "duration_ms": duration_ms,
                            "metadata": {
                                "model": data.get("model", current_model),
                                "prompt_tokens": usage.get("prompt_tokens"),
                                "completion_tokens": usage.get("completion_tokens"),
                                "total_tokens": usage.get("total_tokens"),
                                "attempt": attempt + 1,
                            },
                        },
                    )
                    candidates = self._parse_response(data)
                    if candidates:
                        _MODEL_COOLDOWNS.pop(current_model, None)
                        return candidates
                    return candidates

                except (httpx.RequestError, httpx.HTTPStatusError) as exc:
                    duration_ms = round((time.perf_counter() - start_time) * 1000, 1)
                    last_error = exc
                    logger.warning(
                        "[OpenAICompatibleClient] Network/HTTP error on model %s attempt %d/%d: %s",
                        current_model,
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
                        "[OpenAICompatibleClient] Unhandled error during extraction on model %s: %s",
                        current_model,
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

    def _parse_response(self, data: dict[str, Any]) -> list[CandidateComplianceItem]:
        choices = data.get("choices", [])
        if not choices:
            logger.warning("[OpenAICompatibleClient] Upstream response contained 0 choices.")
            return []

        message = choices[0].get("message", {})
        content = message.get("content", "")
        if not content:
            return []

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
                candidate = self._build_candidate(raw)
                if candidate:
                    candidates.append(candidate)
            except (KeyError, ValueError, TypeError, AttributeError) as build_err:
                logger.debug(
                    "[OpenAICompatibleClient] Skipping unparseable candidate item: %s", build_err
                )

        return candidates

    def _build_candidate(self, raw: dict[str, Any]) -> CandidateComplianceItem | None:
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

        # Provenance mapping
        raw_prov = raw.get("provenance") or {}
        doc_id = (
            raw_prov.get("source_document_id")
            or raw_prov.get("sourceDocumentId")
            or raw.get("source_document_id")
            or "doc_source"
        )
        file_name = (
            raw_prov.get("source_file_name")
            or raw_prov.get("sourceFileName")
            or raw.get("source_file_name")
            or "uploaded_document.pdf"
        )
        page_num = (
            raw_prov.get("page_number")
            or raw_prov.get("pageNumber")
            or raw_prov.get("page")
            or raw.get("page_number")
            or raw.get("page")
            or 1
        )
        clause_ref = (
            raw_prov.get("clause_reference")
            or raw_prov.get("clauseReference")
            or raw_prov.get("clause")
            or raw.get("clause_reference")
            or raw.get("clause")
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
        if not clean_quote:
            return None
        conf = float(raw_prov.get("confidence_score") or raw_prov.get("confidenceScore") or 0.95)

        provenance = ProvenanceProps(
            source_document_id=str(doc_id),
            source_file_name=str(file_name),
            page_number=int(page_num),
            clause_reference=str(clause_ref),
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
