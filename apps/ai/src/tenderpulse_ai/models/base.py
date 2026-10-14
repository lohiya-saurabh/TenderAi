from typing import Protocol

from tenderpulse_ai.domain.models import CandidateComplianceItem


class ILLMClient(Protocol):
    """Protocol for LLM structured extraction clients."""

    async def extract_compliance(
        self,
        system_prompt: str,
        user_prompt: str,
        max_retries: int = 2,
    ) -> list[CandidateComplianceItem]: ...
