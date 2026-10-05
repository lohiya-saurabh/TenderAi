from __future__ import annotations

import asyncio
import json

import pytest

from tenderpulse_ai.agent import (
    AgentInput,
    AgentOutput,
    AgentPageInput,
    AgentStatus,
    RequirementCandidate,
    TenderRequirementAgent,
    default_requirement_model,
)
from tenderpulse_ai.domain.models import ExecutionRulesProps, ProvenanceProps
from tenderpulse_ai.security.context import SecurityContext
from tenderpulse_ai.security.exceptions import (
    AISecurityException,
    ToolRateLimitExceededException,
    UnauthorizedDocumentAccessException,
)
from tenderpulse_ai.tools.page_text import PageTextTool
from tenderpulse_ai.tools.retrieval import DocumentChunk, ScopedRetrievalTool


def make_security_context(
    tenant_id: str = "org_tata_infra_01",
    document_ids: tuple[str, ...] = ("doc_nit_101",),
    purpose: str = "COMPLIANCE_EXTRACTION",
) -> SecurityContext:
    return SecurityContext(
        tenant_id=tenant_id,
        user_id="usr_bid_manager_42",
        workflow_run_id="run_agent_001",
        allowed_document_ids=list(document_ids),
        purpose=purpose,  # type: ignore[arg-type]
    )


EMD_PAGE_TEXT = (
    "Section 14: Financial Securities. Clause 14.1: The bidder must submit an Earnest Money "
    "Deposit (EMD) of INR 5,00,000 on a 100 Rupee stamp paper with notarization."
)

TURNOVER_PAGE_TEXT = (
    "The bidder shall demonstrate adequate annual turnover over the last five financial years."
)


def make_agent(
    model_fn=None,
    *,
    max_refinement_passes: int = 1,
    model_timeout_seconds: float = 30.0,
    retrieval_tool: ScopedRetrievalTool | None = None,
    persistence_sink=None,
) -> TenderRequirementAgent:
    return TenderRequirementAgent(
        retrieval_tool=retrieval_tool or ScopedRetrievalTool(),
        page_text_tool=PageTextTool(),
        model_fn=model_fn or default_requirement_model,
        max_refinement_passes=max_refinement_passes,
        model_timeout_seconds=model_timeout_seconds,
        persistence_sink=persistence_sink,
    )


def make_request(pages: list[AgentPageInput], **ctx_kwargs) -> AgentInput:
    return AgentInput(
        security_context=make_security_context(**ctx_kwargs),
        bid_id="bid_101",
        document_id="doc_nit_101",
        file_name="NIT_101.pdf",
        pages=pages,
    )


# --------------------------------------------------------------------- happy path


async def test_agent_extracts_and_grounds_requirement():
    agent = make_agent()
    request = make_request([AgentPageInput(page_number=14, text=EMD_PAGE_TEXT)])

    output = await agent.analyze(request)

    assert output.status == AgentStatus.COMPLETED
    assert len(output.requirements) == 1
    requirement = output.requirements[0]
    assert requirement.category == "FINANCIAL"
    assert "EMD" in requirement.title or "Earnest Money Deposit" in requirement.title
    assert requirement.provenance.page_number == 14
    # Grounding: the quote is an exact substring of the source page text.
    assert " ".join(requirement.provenance.verbatim_quote.lower().split()) in " ".join(
        EMD_PAGE_TEXT.lower().split()
    )
    assert output.stats.candidates_rejected == 0
    assert any(e["action"] == "AGENT_COMPLETED" for e in output.audit_events)


async def test_agent_returns_honest_empty_for_non_procurement_content():
    agent = make_agent()
    request = make_request(
        [AgentPageInput(page_number=1, text="This is a memo about office picnic arrangements.")]
    )

    output = await agent.analyze(request)

    assert output.status == AgentStatus.COMPLETED_EMPTY
    assert output.requirements == []
    assert output.stats.candidates_extracted == 0


# --------------------------------------------------------------------- ambiguity


async def test_agent_detects_vague_quantifier_and_missing_threshold():
    agent = make_agent()
    request = make_request([AgentPageInput(page_number=21, text=TURNOVER_PAGE_TEXT)])

    output = await agent.analyze(request)

    assert output.status == AgentStatus.COMPLETED_WITH_AMBIGUITY
    types = {flag.type.value for flag in output.ambiguities}
    assert "VAGUE_QUANTIFIER" in types  # "adequate"
    assert "MISSING_THRESHOLD" in types  # turnover concept, no number in the quote
    assert output.stats.ambiguities_detected == len(output.ambiguities)


async def test_agent_detects_numeric_conflict():
    agent = make_agent()
    page_text = (
        "The annual turnover requirement is Rs 10 crore for FY24 and Rs 5 crore for FY24."
    )
    request = make_request([AgentPageInput(page_number=30, text=page_text)])

    output = await agent.analyze(request)

    types = {flag.type.value for flag in output.ambiguities}
    assert "NUMERIC_CONFLICT" in types


# --------------------------------------------------------------------- validation


async def test_agent_rejects_ungrounded_quote_without_persisting():
    fabricated = RequirementCandidate(
        category="FINANCIAL",
        kind="DOCUMENT_SUBMISSION",
        criticality="SUBMISSION_MANDATORY",
        title="Fabricated Performance Security",
        description="Invented requirement with a hallucinated quote.",
        execution_rules=ExecutionRulesProps(),
        provenance=ProvenanceProps(
            source_document_id="doc_nit_101",
            source_file_name="NIT_101.pdf",
            page_number=14,
            clause_reference="Clause 14.2",
            verbatim_quote="The bidder must submit a Performance Security of INR 10,00,000.",
            confidence_score=0.99,
        ),
    )
    agent = make_agent(model_fn=lambda s, u: [fabricated], max_refinement_passes=0)
    request = make_request([AgentPageInput(page_number=14, text=EMD_PAGE_TEXT)])

    output = await agent.analyze(request)

    assert output.requirements == []
    assert len(output.unverified) == 1
    assert "grounding" in output.unverified[0].reason
    assert output.status == AgentStatus.COMPLETED_EMPTY


async def test_agent_refines_once_then_grounds():
    bad = RequirementCandidate(
        category="FINANCIAL",
        kind="DOCUMENT_SUBMISSION",
        criticality="SUBMISSION_MANDATORY",
        title="EMD Requirement",
        description="EMD with a wrong quote on first attempt.",
        execution_rules=ExecutionRulesProps(),
        provenance=ProvenanceProps(
            source_document_id="doc_nit_101",
            source_file_name="NIT_101.pdf",
            page_number=14,
            clause_reference="Clause 14.1",
            verbatim_quote="The bidder must submit an EMD of INR 99,99,999.",
            confidence_score=0.9,
        ),
    )
    captured_prompts: list[str] = []

    def model_fn(system_prompt: str, user_prompt: str) -> list[RequirementCandidate]:
        captured_prompts.append(user_prompt)
        return [bad] if len(captured_prompts) == 1 else [_emd_candidate()]

    agent = make_agent(model_fn=model_fn, max_refinement_passes=1)
    request = make_request([AgentPageInput(page_number=14, text=EMD_PAGE_TEXT)])

    output = await agent.analyze(request)

    assert len(output.requirements) == 1
    assert output.requirements[0].provenance.verbatim_quote != bad.provenance.verbatim_quote
    assert output.stats.refinement_passes == 1
    assert output.stats.model_calls == 2
    assert "PRIOR VERIFICATION FEEDBACK" in captured_prompts[1]


def _emd_candidate() -> RequirementCandidate:
    return RequirementCandidate(
        category="FINANCIAL",
        kind="DOCUMENT_SUBMISSION",
        criticality="SUBMISSION_MANDATORY",
        title="Tender & Bid Security (EMD) Guarantee",
        description="Submission of Earnest Money Deposit as required by tender conditions.",
        execution_rules=ExecutionRulesProps(),
        provenance=ProvenanceProps(
            source_document_id="doc_nit_101",
            source_file_name="NIT_101.pdf",
            page_number=14,
            clause_reference="Clause 14.1",
            verbatim_quote=(
                "The bidder must submit an Earnest Money Deposit (EMD) of INR 5,00,000 "
                "on a 100 Rupee stamp paper with notarization."
            ),
            confidence_score=0.98,
        ),
    )


async def test_agent_rejects_unknown_category():
    candidate = _emd_candidate()
    candidate.category = "ASTROLOGY"
    agent = make_agent(model_fn=lambda s, u: [candidate], max_refinement_passes=0)
    request = make_request([AgentPageInput(page_number=14, text=EMD_PAGE_TEXT)])

    output = await agent.analyze(request)

    assert output.requirements == []
    assert "category" in output.unverified[0].reason


# --------------------------------------------------------------------- security


async def test_agent_blocks_document_outside_whitelist():
    agent = make_agent()
    request = make_request(
        [AgentPageInput(page_number=14, text=EMD_PAGE_TEXT)],
        document_ids=("doc_other",),
    )

    with pytest.raises(UnauthorizedDocumentAccessException):
        await agent.analyze(request)


async def test_agent_rejects_unauthorized_purpose():
    agent = make_agent()
    request = make_request(
        [AgentPageInput(page_number=14, text=EMD_PAGE_TEXT)],
        purpose="PROPOSAL_DRAFTING",
    )

    with pytest.raises(AISecurityException):
        await agent.analyze(request)


async def test_agent_enforces_tenant_isolation_on_retrieval():
    retrieval_tool = ScopedRetrievalTool()
    # Decoy chunk belonging to another tenant on the SAME document id.
    retrieval_tool.seed_chunks(
        [
            DocumentChunk(
                chunk_id="chk_decoy",
                tenant_id="org_other_tenant",
                document_id="doc_nit_101",
                page_number=99,
                clause_reference="Page 99",
                text="The bidder must submit an Earnest Money Deposit (EMD) of INR 99,99,999.",
            )
        ]
    )
    agent = make_agent(retrieval_tool=retrieval_tool)
    request = make_request([AgentPageInput(page_number=14, text=EMD_PAGE_TEXT)])

    output = await agent.analyze(request)

    assert all(r.provenance.page_number == 14 for r in output.requirements)
    assert all("99,99,999" not in r.provenance.verbatim_quote for r in output.requirements)


async def test_agent_scrubs_secrets_before_model_dispatch():
    captured: dict[str, str] = {}

    def model_fn(system_prompt: str, user_prompt: str) -> list[RequirementCandidate]:
        captured["user_prompt"] = user_prompt
        return []

    agent = make_agent(model_fn=model_fn)
    page_text = EMD_PAGE_TEXT + " Deployment key: AKIAIOSFODNN7EXAMPLE for the CI runner."
    request = make_request([AgentPageInput(page_number=14, text=page_text)])

    output = await agent.analyze(request)

    assert "AKIAIOSFODNN7EXAMPLE" not in captured["user_prompt"]
    assert "[REDACTED_AWS_KEY]" in captured["user_prompt"]
    assert any(e["action"] == "SECRET_SCRUBBED" for e in output.audit_events)


async def test_agent_respects_retrieval_rate_limit():
    agent = make_agent(retrieval_tool=ScopedRetrievalTool(max_calls_per_run=2))
    request = make_request(
        [
            AgentPageInput(page_number=1, text=EMD_PAGE_TEXT),
            AgentPageInput(page_number=2, text=EMD_PAGE_TEXT),
            AgentPageInput(page_number=3, text=EMD_PAGE_TEXT),
        ]
    )

    with pytest.raises(ToolRateLimitExceededException):
        await agent.analyze(request)


# --------------------------------------------------------------------- failure modes


async def test_agent_returns_failed_status_on_model_timeout():
    async def slow_model(system_prompt: str, user_prompt: str) -> list[RequirementCandidate]:
        await asyncio.sleep(0.5)
        return []

    agent = make_agent(model_fn=slow_model, model_timeout_seconds=0.01)
    request = make_request([AgentPageInput(page_number=14, text=EMD_PAGE_TEXT)])

    output = await agent.analyze(request)

    assert output.status == AgentStatus.FAILED
    assert output.error is not None
    assert any(e["action"] == "AGENT_FAILED" for e in output.audit_events)


async def test_agent_retries_transient_model_failures():
    attempts: list[int] = []

    def flaky_model(system_prompt: str, user_prompt: str) -> list[RequirementCandidate]:
        attempts.append(1)
        if len(attempts) == 1:
            raise RuntimeError("Transient provider failure (Attempt 1)")
        return [_emd_candidate()]

    agent = make_agent(model_fn=flaky_model)
    request = make_request([AgentPageInput(page_number=14, text=EMD_PAGE_TEXT)])

    output = await agent.analyze(request)

    assert len(output.requirements) == 1
    assert output.stats.model_calls == 2


async def test_agent_returns_failed_status_when_model_exhausts_retries():
    def broken_model(system_prompt: str, user_prompt: str) -> list[RequirementCandidate]:
        raise RuntimeError("Provider down")

    agent = make_agent(model_fn=broken_model)
    request = make_request([AgentPageInput(page_number=14, text=EMD_PAGE_TEXT)])

    output = await agent.analyze(request)

    assert output.status == AgentStatus.FAILED
    assert output.stats.model_calls == 2  # attempted, then gave up honestly


# --------------------------------------------------------------------- audit & persistence


async def test_agent_audit_events_are_reference_only():
    agent = make_agent()
    request = make_request([AgentPageInput(page_number=14, text=EMD_PAGE_TEXT)])

    output = await agent.analyze(request)

    serialized = json.dumps(output.audit_events)
    assert EMD_PAGE_TEXT not in serialized
    assert "INR 5,00,000" not in serialized
    assert "notarization" not in serialized


async def test_agent_persists_output_through_optional_sink():
    persisted: list[AgentOutput] = []

    async def sink(output) -> None:
        persisted.append(output)

    agent = make_agent(persistence_sink=sink)
    request = make_request([AgentPageInput(page_number=14, text=EMD_PAGE_TEXT)])

    output = await agent.analyze(request)

    assert len(persisted) == 1
    assert persisted[0].status == output.status


# --------------------------------------------------------------------- API route


def test_agent_endpoint_unauthorized():
    from fastapi.testclient import TestClient

    from tenderpulse_ai.main import app

    client = TestClient(app)
    response = client.post(
        "/api/v1/agent/analyze-requirements",
        json={"some": "payload"},
    )
    assert response.status_code == 401


def test_agent_endpoint_authorized():
    from fastapi.testclient import TestClient

    from tenderpulse_ai.main import app

    client = TestClient(app)
    headers = {"X-Internal-Service-Key": "tenderpulse-internal-secret-2026"}
    request = make_request([AgentPageInput(page_number=14, text=EMD_PAGE_TEXT)])

    response = client.post(
        "/api/v1/agent/analyze-requirements",
        json=request.model_dump(),
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["bid_id"] == "bid_101"
    assert data["document_id"] == "doc_nit_101"
    assert data["status"] == "COMPLETED"
    assert len(data["requirements"]) >= 1

