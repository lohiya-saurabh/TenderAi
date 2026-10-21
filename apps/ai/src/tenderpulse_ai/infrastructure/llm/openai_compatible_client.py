import asyncio
import json
import logging
import re
import time
from typing import Any

import httpx

from tenderpulse_ai.domain.models import (
    CandidateComplianceItem,
    ExecutionRulesProps,
    ProvenanceProps,
)

logger = logging.getLogger("tenderpulse_ai.infrastructure.llm")


class OpenAICompatibleLlmClient:
    """
    High-performance asynchronous HTTP client for OpenAI-compatible LLM gateways (OpenRouter, OpenAI, vLLM, Groq).
    Enforces structured JSON extraction, exponential backoff for transient errors, and robust Pydantic parsing.
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://openrouter.ai/api/v1",
        model: str = "google/gemini-2.5-flash",
        timeout: float = 45.0,
        max_tokens: int = 2048,
        client: httpx.AsyncClient | None = None,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout
        self.max_tokens = max_tokens
        self._custom_client = client

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
        Generates a fluid conversational chat completion using the OpenAI-compatible API.
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

        models_to_try = [self.model]
        FALLBACK_FREE_MODELS = [
            "nvidia/nemotron-3.5-lightning:free",
            "liquid/lfm-2.5-2.6b:free",
            "minimax/minimax-m3.1-flash:free",
        ]
        for fb in FALLBACK_FREE_MODELS:
            if fb != self.model:
                models_to_try.append(fb)

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

                    if response.status_code in (429, 500, 502, 503, 504):
                        if attempt < max_retries:
                            await asyncio.sleep(0.5 * (2**attempt))
                            continue
                        # If rate limited on this model, break attempt loop to try next fallback model
                        break

                    if response.status_code in (400, 402, 404):
                        # Payment required or model not found, try next model
                        break

                    response.raise_for_status()
                    data = response.json()
                    choices = data.get("choices", [])
                    if choices:
                        res_content = str(choices[0].get("message", {}).get("content", "")).strip()
                        if res_content:
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
            logger.warning("[OpenAICompatibleClient] Chat completion failed: %s", last_error)
        return ""

    async def extract_compliance(
        self,
        system_prompt: str,
        user_prompt: str,
        max_retries: int = 2,
    ) -> list[CandidateComplianceItem]:
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

        last_error: Exception | None = None
        for attempt in range(max_retries + 1):
            start_time = time.perf_counter()
            logger.info(
                "Dispatching LLM inference request to %s (model=%s, attempt=%d)",
                self.base_url,
                self.model,
                attempt + 1,
                extra={
                    "event": "llm.request.started",
                    "metadata": {"model": self.model, "attempt": attempt + 1},
                },
            )
            try:
                client = self._get_client()
                # If custom client passed in, don't close it as context manager
                if self._custom_client is not None:
                    response = await client.post(endpoint, headers=headers, json=payload)
                else:
                    async with client:
                        response = await client.post(endpoint, headers=headers, json=payload)

                duration_ms = round((time.perf_counter() - start_time) * 1000, 1)

                if response.status_code in (429, 500, 502, 503, 504):
                    response_text = response.text
                    logger.warning(
                        "[OpenAICompatibleClient] Transient upstream error %d on attempt %d: %s",
                        response.status_code,
                        attempt + 1,
                        response_text[:200],
                        extra={
                            "event": "llm.request.retry",
                            "duration_ms": duration_ms,
                            "error_code": f"HTTP_{response.status_code}",
                        },
                    )
                    if attempt < max_retries:
                        await asyncio.sleep(1.0 * (2**attempt))
                        continue
                    response.raise_for_status()

                response.raise_for_status()
                data = response.json()
                usage = data.get("usage", {})
                logger.info(
                    "LLM extraction completed in %.1fms (prompt_tokens=%s, completion_tokens=%s)",
                    duration_ms,
                    usage.get("prompt_tokens"),
                    usage.get("completion_tokens"),
                    extra={
                        "event": "llm.request.completed",
                        "duration_ms": duration_ms,
                        "metadata": {
                            "model": data.get("model", self.model),
                            "prompt_tokens": usage.get("prompt_tokens"),
                            "completion_tokens": usage.get("completion_tokens"),
                            "total_tokens": usage.get("total_tokens"),
                            "attempt": attempt + 1,
                        },
                    },
                )
                return self._parse_response(data)

            except (httpx.RequestError, httpx.HTTPStatusError) as exc:
                duration_ms = round((time.perf_counter() - start_time) * 1000, 1)
                last_error = exc
                logger.warning(
                    "[OpenAICompatibleClient] Network/HTTP error on attempt %d/%d: %s",
                    attempt + 1,
                    max_retries + 1,
                    str(exc),
                    extra={
                        "event": "llm.request.failed",
                        "duration_ms": duration_ms,
                        "error_code": "ERR_LLM_NETWORK",
                    },
                )
                # Never retry client/auth/payment errors (400, 401, 402, 403, 404)
                if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code in (
                    400,
                    401,
                    402,
                    403,
                    404,
                ):
                    break
                if attempt < max_retries:
                    await asyncio.sleep(1.0 * (2**attempt))
                    continue
                break
            except Exception as exc:  # noqa: BLE001
                duration_ms = round((time.perf_counter() - start_time) * 1000, 1)
                last_error = exc
                logger.error(
                    "[OpenAICompatibleClient] Unhandled error during extraction: %s",
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

        try:
            parsed = json.loads(cleaned_content)
        except json.JSONDecodeError as err:
            logger.error(
                "[OpenAICompatibleClient] Failed to decode JSON response from model: %s. Content: %s",
                err,
                cleaned_content[:300],
            )
            return []

        raw_items: list[dict[str, Any]] = []
        if isinstance(parsed, list):
            raw_items = parsed
        elif isinstance(parsed, dict):
            if "candidates" in parsed and isinstance(parsed["candidates"], list):
                raw_items = parsed["candidates"]
            elif "items" in parsed and isinstance(parsed["items"], list):
                raw_items = parsed["items"]
            elif "requirements" in parsed and isinstance(parsed["requirements"], list):
                raw_items = parsed["requirements"]

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
        title = raw.get("title") or raw.get("name") or "Extracted Requirement"
        category = raw.get("category", "STATUTORY").upper()
        description = raw.get("description", "")

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
        page_num = raw_prov.get("page_number") or raw_prov.get("pageNumber") or 1
        clause_ref = (
            raw_prov.get("clause_reference")
            or raw_prov.get("clauseReference")
            or f"Page {page_num}"
        )
        quote = raw_prov.get("verbatim_quote") or raw_prov.get("verbatimQuote") or ""
        conf = float(raw_prov.get("confidence_score") or raw_prov.get("confidenceScore") or 0.95)

        provenance = ProvenanceProps(
            source_document_id=str(doc_id),
            source_file_name=str(file_name),
            page_number=int(page_num),
            clause_reference=str(clause_ref),
            verbatim_quote=str(quote) if quote else "Operative Requirement",
            confidence_score=conf,
        )

        return CandidateComplianceItem(
            category=category,
            title=title,
            description=description,
            execution_rules=execution_rules,
            provenance=provenance,
        )
