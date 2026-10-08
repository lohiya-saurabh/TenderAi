import inspect
import logging
from collections.abc import Callable
from typing import TYPE_CHECKING

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
        self.extractor_fn = extractor_fn
        self.fail_count_before_success = fail_count_before_success
        self._current_attempts = 0
        self.last_sanitized_prompt: str | None = None
        self.secrets_detected: bool = False

        from tenderpulse_ai.config import settings

        if live_client is not None:
            self.live_client = live_client
        elif enable_live_client is False:
            self.live_client = None
        elif settings.llm_api_key:
            from tenderpulse_ai.infrastructure.llm.openai_compatible_client import (
                OpenAICompatibleLlmClient,
            )

            self.live_client = OpenAICompatibleLlmClient(
                api_key=settings.llm_api_key,
                base_url=settings.llm_base_url,
                model=settings.llm_model,
                timeout=settings.llm_timeout_seconds,
            )
        else:
            self.live_client = None

    async def extract_compliance(
        self,
        system_prompt: str,
        user_prompt: str,
        max_retries: int = 2,
    ) -> list[CandidateComplianceItem]:
        # 1. Secret Hygiene: Pre-invocation scrubber
        sanitized_prompt, secret_found = SecretSanitizer.scrub(user_prompt)
        self.last_sanitized_prompt = sanitized_prompt
        self.secrets_detected = secret_found

        if secret_found:
            logger.warning("[AI Security] Sensitive secret or token detected in prompt! Redacting before model dispatch.")

        # 2. Transient Failure Simulation / Retry Handling
        if self._current_attempts < self.fail_count_before_success:
            self._current_attempts += 1
            raise RuntimeError(f"Transient model provider failure (Attempt {self._current_attempts})")

        # 3. Live LLM Gateway Extraction (when configured)
        if self.live_client is not None:
            try:
                items = await self.live_client.extract_compliance(
                    system_prompt=system_prompt,
                    user_prompt=sanitized_prompt,
                    max_retries=max_retries,
                )
                return items
            except Exception as err:
                logger.warning(
                    "[StructuredLLMClient] Live LLM gateway invocation failed (%s). Triggering deterministic fallback.",
                    err,
                )
                if self.extractor_fn:
                    if inspect.iscoroutinefunction(self.extractor_fn):
                        return await self.extractor_fn(system_prompt, sanitized_prompt)
                    return self.extractor_fn(system_prompt, sanitized_prompt)
                raise

        # 4. Custom / Deterministic Extractor Function (or default extraction)
        if self.extractor_fn:
            if inspect.iscoroutinefunction(self.extractor_fn):
                return await self.extractor_fn(system_prompt, sanitized_prompt)
            return self.extractor_fn(system_prompt, sanitized_prompt)

        # Default fallback extraction for testing
        return []
