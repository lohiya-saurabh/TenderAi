import logging
from typing import Any, Protocol

from tenderpulse_ai.domain.models import CandidateComplianceItem
from tenderpulse_ai.infrastructure.llm.openai_compatible_client import LLMExtractionError
from tenderpulse_ai.security.sanitizer import SecretSanitizer

logger = logging.getLogger("tenderpulse_ai.llm")


class LiveExtractionClient(Protocol):
    async def extract_compliance(
        self,
        system_prompt: str,
        user_prompt: str,
        max_retries: int = 1,
        block_map: dict[str, Any] | None = None,
    ) -> list[CandidateComplianceItem]: ...


class StructuredLLMClient:
    """LLM-only structured extraction.

    1. Secrets are scrubbed from the prompt before dispatch.
    2. The live gateway (multi-provider failover, or LLM_REPLAY_MODE recordings) answers.
    3. Any failure raises ``LLMExtractionError``: there is no rule-based or synthetic fallback.
    """

    def __init__(self, live_client: LiveExtractionClient | None = None):
        if live_client is None:
            from tenderpulse_ai.config import settings
            from tenderpulse_ai.infrastructure.llm.openai_compatible_client import (
                OpenAICompatibleLlmClient,
            )

            live_client = OpenAICompatibleLlmClient.create_from_settings(settings)
        self.live_client = live_client
        self.last_sanitized_prompt: str | None = None
        self.secrets_detected: bool = False

    async def extract_compliance(
        self,
        system_prompt: str,
        user_prompt: str,
        max_retries: int = 2,
        block_map: dict[str, Any] | None = None,
    ) -> list[CandidateComplianceItem]:
        sanitized_prompt, secret_found = SecretSanitizer.scrub(user_prompt)
        self.last_sanitized_prompt = sanitized_prompt
        self.secrets_detected = secret_found
        if secret_found:
            logger.warning(
                "[AI Security] Sensitive secret or token detected in prompt! Redacting before model dispatch."
            )
        try:
            return await self.live_client.extract_compliance(
                system_prompt=system_prompt,
                user_prompt=sanitized_prompt,
                max_retries=max_retries,
                block_map=block_map,
            )
        except LLMExtractionError:
            raise
        except Exception as err:
            raise LLMExtractionError(f"LLM extraction failed: {err}") from err


__all__ = ["LLMExtractionError", "StructuredLLMClient"]
