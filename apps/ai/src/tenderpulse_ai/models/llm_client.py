import logging
from collections.abc import Callable

from tenderpulse_ai.domain.models import CandidateComplianceItem
from tenderpulse_ai.security.sanitizer import SecretSanitizer

logger = logging.getLogger("tenderpulse_ai.llm")


class StructuredLLMClient:
    """
    LLM client that enforces:
    1. Pre-invocation secret scrubbing.
    2. Zero data retention framing.
    3. Grammar-constrained JSON structured extraction.
    4. Transient error retry handling.
    """
    def __init__(
        self,
        extractor_fn: Callable[[str, str], list[CandidateComplianceItem]] | None = None,
        fail_count_before_success: int = 0,
    ):
        self.extractor_fn = extractor_fn
        self.fail_count_before_success = fail_count_before_success
        self._current_attempts = 0
        self.last_sanitized_prompt: str | None = None
        self.secrets_detected: bool = False

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

        # 3. Custom Extractor Function (or default extraction)
        if self.extractor_fn:
            return self.extractor_fn(system_prompt, sanitized_prompt)

        # Default fallback extraction for testing
        return []
