import inspect
import logging
from collections.abc import Callable
from typing import TYPE_CHECKING, Any

from tenderpulse_ai.domain.models import CandidateComplianceItem
from tenderpulse_ai.security.sanitizer import SecretSanitizer

if TYPE_CHECKING:
    from tenderpulse_ai.infrastructure.llm.openai_compatible_client import (
        OpenAICompatibleLlmClient,
    )

logger = logging.getLogger("tenderpulse_ai.llm")


class StructuredLLMClient:
    """
    LLM client that enforces:
    1. Pre-invocation secret scrubbing.
    2. Zero data retention framing.
    3. Grammar-constrained JSON structured extraction via OpenRouter / OpenAI-compatible gateways.
    4. Deterministic fallback to offline AST/regex rules when offline or on provider failure.
    5. Transient error retry handling.
    """

    def __init__(
        self,
        extractor_fn: Callable[[str, str], list[CandidateComplianceItem]] | None = None,
        live_client: "OpenAICompatibleLlmClient | None" = None,
        fail_count_before_success: int = 0,
        enable_live_client: bool | None = None,
    ):
        if extractor_fn is not None:
            self.extractor_fn = extractor_fn
        else:
            from tenderpulse_ai.pipeline import default_tender_extractor

            self.extractor_fn = default_tender_extractor

        self.fail_count_before_success = fail_count_before_success
        self._current_attempts = 0
        self.last_sanitized_prompt: str | None = None
        self.secrets_detected: bool = False
        self._live_circuit_broken: bool = False

        from tenderpulse_ai.config import settings

        # A custom extractor_fn (not default_tender_extractor) passed without explicit enable_live_client=True
        # indicates a test mock or simulated evaluator extractor; disable live client to avoid external network calls.
        from tenderpulse_ai.pipeline import default_tender_extractor

        is_custom_extractor = (
            extractor_fn is not None
            and extractor_fn is not default_tender_extractor
            and getattr(extractor_fn, "__name__", "") != "default_tender_extractor"
        )

        if enable_live_client is False or (enable_live_client is None and is_custom_extractor):
            self.live_client = None
        elif live_client is not None:
            self.live_client = live_client
        elif (
            settings.llm_api_key
            or settings.gemini_api_key
            or settings.groq_api_key
            or settings.cerebras_api_key
            or settings.sambanova_api_key
            or settings.openrouter_api_key
        ):
            from tenderpulse_ai.infrastructure.llm.openai_compatible_client import (
                OpenAICompatibleLlmClient,
            )

            self.live_client = OpenAICompatibleLlmClient.create_from_settings(settings)
        else:
            self.live_client = None

    async def extract_compliance(
        self,
        system_prompt: str,
        user_prompt: str,
        max_retries: int = 2,
        block_map: dict[str, Any] | None = None,
    ) -> list[CandidateComplianceItem]:
        # 1. Secret Hygiene: Pre-invocation scrubber
        sanitized_prompt, secret_found = SecretSanitizer.scrub(user_prompt)
        self.last_sanitized_prompt = sanitized_prompt
        self.secrets_detected = secret_found

        if secret_found:
            logger.warning(
                "[AI Security] Sensitive secret or token detected in prompt! Redacting before model dispatch."
            )

        # 2. Transient Failure Simulation / Retry Handling
        if self._current_attempts < self.fail_count_before_success:
            self._current_attempts += 1
            raise RuntimeError(
                f"Transient model provider failure (Attempt {self._current_attempts})"
            )

        # 3. Live LLM Gateway Extraction (when configured and circuit is intact)
        if self.live_client is not None and not self._live_circuit_broken:
            try:
                items = await self.live_client.extract_compliance(
                    system_prompt=system_prompt,
                    user_prompt=sanitized_prompt,
                    max_retries=max_retries,
                    block_map=block_map,
                )
                if items:
                    return items
                logger.warning(
                    "[StructuredLLMClient] Live LLM gateway returned 0 items. Triggering deterministic fallback."
                )
            except Exception as err:
                status_code = getattr(getattr(err, "response", None), "status_code", None)
                if status_code in (401, 403):
                    self._live_circuit_broken = True
                    logger.warning(
                        "[StructuredLLMClient] Gateway returned authentication/permission failure %d (%s). "
                        "Circuit breaker tripped: disabling live LLM calls for this session and using offline deterministic fallback.",
                        status_code,
                        err,
                    )
                else:
                    logger.warning(
                        "[StructuredLLMClient] Live LLM gateway invocation failed (%s). Triggering deterministic fallback.",
                        err,
                    )
                if self.extractor_fn:
                    if inspect.iscoroutinefunction(self.extractor_fn):
                        return await self.extractor_fn(system_prompt, sanitized_prompt)
                    return self.extractor_fn(system_prompt, sanitized_prompt)
                return []

        # 4. Custom / Deterministic Extractor Function (or default extraction)
        if self.extractor_fn:
            if inspect.iscoroutinefunction(self.extractor_fn):
                return await self.extractor_fn(system_prompt, sanitized_prompt)
            return self.extractor_fn(system_prompt, sanitized_prompt)

        # Default fallback extraction for testing
        return []
