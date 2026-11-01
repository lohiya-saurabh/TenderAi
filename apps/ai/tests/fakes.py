"""Test doubles for the live LLM gateway (extraction is LLM-only; tests never hit a network)."""

from __future__ import annotations

import inspect
import re
from collections.abc import Callable
from typing import Any

from tenderpulse_ai.domain.models import (
    CandidateComplianceItem,
    ExecutionRulesProps,
    ProvenanceProps,
)
from tenderpulse_ai.models.llm_client import StructuredLLMClient


class FakeLLM:
    """Stands in for OpenAICompatibleLlmClient: ``fn(system_prompt, user_prompt)`` returns the
    candidates (or raises, to simulate a provider failure)."""

    def __init__(self, fn: Callable[[str, str], Any]):
        self.fn = fn
        self.calls: list[str] = []

    async def extract_compliance(
        self,
        system_prompt: str,
        user_prompt: str,
        max_retries: int = 1,
        block_map: dict[str, Any] | None = None,
    ):
        self.calls.append(user_prompt)
        out = self.fn(system_prompt, user_prompt)
        return await out if inspect.isawaitable(out) else out


def fake_llm_client(fn: Callable[[str, str], Any]) -> StructuredLLMClient:
    return StructuredLLMClient(live_client=FakeLLM(fn))


_BLOCK_RE = re.compile(
    r'<untrusted_document_data document_id="(?P<doc>[^"]+)" page="(?P<page>\d+)">\s*'
    r"(?:\[B\d+\][^\n]*\n)?(?P<text>.*?)\s*</untrusted_document_data>",
    re.DOTALL,
)


def quoting_llm(system_prompt: str, user_prompt: str) -> list[CandidateComplianceItem]:
    """A well-behaved model: one candidate per sentence containing 'shall' / 'must', quoted
    verbatim from the prompt's page blocks."""
    out = []
    for m in _BLOCK_RE.finditer(user_prompt):
        for sentence in re.split(
            r"(?<=\.)\s+(?=\d+\.\d+\s|[A-Z][a-z])", " ".join(m.group("text").split())
        ):
            if re.search(r"\b(shall|must)\b", sentence, re.I):
                out.append(
                    CandidateComplianceItem(
                        category="FINANCIAL",
                        title=sentence[:60],
                        description=sentence,
                        execution_rules=ExecutionRulesProps(),
                        provenance=ProvenanceProps(
                            source_document_id=m.group("doc"),
                            source_file_name="doc.pdf",
                            page_number=int(m.group("page")),
                            clause_reference=f"Page {m.group('page')}",
                            verbatim_quote=sentence,
                            confidence_score=0.95,
                        ),
                    )
                )
    return out


def use_fake_llm(monkeypatch, fn: Callable[[str, str], Any] = quoting_llm) -> FakeLLM:
    """Makes every default StructuredLLMClient() (API endpoints, worker) use a FakeLLM."""
    import tenderpulse_ai.models.llm_client as llm_client_module

    fake = FakeLLM(fn)
    original = llm_client_module.StructuredLLMClient.__init__

    def init(self, live_client=None):
        original(self, live_client=live_client or fake)

    monkeypatch.setattr(llm_client_module.StructuredLLMClient, "__init__", init)
    return fake
