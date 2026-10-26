"""LLM-only extraction: items come from the model, failures are explicit, nothing is synthesized."""

from __future__ import annotations

import json

import httpx
import pytest
from fakes import FakeLLM, fake_llm_client, quoting_llm

from tenderpulse_ai.config import settings
from tenderpulse_ai.extraction.contracts import DocumentExtractionRequest, NormalizedPage
from tenderpulse_ai.extraction.orchestrator import ProductionExtractionPipeline
from tenderpulse_ai.infrastructure.llm.openai_compatible_client import (
    LLMExtractionError,
    OpenAICompatibleLlmClient,
)
from tenderpulse_ai.models.llm_client import StructuredLLMClient
from tenderpulse_ai.security.context import SecurityContext


def _request(pages: list[str], doc_id: str = "doc_llm_1") -> DocumentExtractionRequest:
    return DocumentExtractionRequest(
        security_context=SecurityContext(
            tenant_id="org_llm",
            user_id="u",
            workflow_run_id="run_llm",
            allowed_document_ids=[doc_id],
            purpose="COMPLIANCE_EXTRACTION",
        ),
        bid_id="bid_llm",
        document_id=doc_id,
        file_name="NIT.pdf",
        pages=[NormalizedPage(page_number=i + 1, text=t) for i, t in enumerate(pages)],
    )


PAGE = (
    "Clause 3 Bid Security\n"
    "3.1 The Bidder shall furnish a Bid Security of Rs. 12,50,000 in the form of a Bank Guarantee.\n"
    "3.2 The Bid Security shall remain valid for 45 days beyond the bid validity period.\n"
)


@pytest.mark.asyncio
async def test_items_come_from_the_model_with_their_verbatim_quotes():
    fake = FakeLLM(quoting_llm)
    response = await ProductionExtractionPipeline(StructuredLLMClient(live_client=fake)).execute(
        _request([PAGE])
    )
    quotes = [i["provenance"]["verbatimQuote"] for i in response.items]
    assert any("Rs. 12,50,000" in q for q in quotes)
    assert all(q in " ".join(PAGE.split()) for q in quotes)  # page-exact, nothing synthesized
    assert response.failed_pages == []
    assert len(fake.calls) == 1


@pytest.mark.asyncio
async def test_a_page_without_obligations_is_a_valid_empty_answer():
    fake = FakeLLM(lambda s, u: [])
    response = await ProductionExtractionPipeline(StructuredLLMClient(live_client=fake)).execute(
        _request(["This page describes the project location and the scope in general terms."])
    )
    assert response.items == []
    assert response.status == "REVIEW_READY"
    assert len(fake.calls) == 1  # an empty answer is not retried or replaced


@pytest.mark.asyncio
async def test_all_windows_failing_raises_instead_of_returning_rule_output():
    def down(s, u):
        raise RuntimeError("HTTP 429 provider rate-limited")

    with pytest.raises(LLMExtractionError, match="all 1 page windows"):
        await ProductionExtractionPipeline(fake_llm_client(down)).execute(_request([PAGE]))


@pytest.mark.asyncio
async def test_partial_failure_returns_good_windows_and_lists_failed_pages(monkeypatch):
    monkeypatch.setattr(settings, "batch_page_window_size", 1)

    def flaky(s, u):
        if 'page="2"' in u:
            raise RuntimeError("HTTP 503")
        return quoting_llm(s, u)

    response = await ProductionExtractionPipeline(fake_llm_client(flaky)).execute(
        _request([PAGE, "2.1 The Contractor shall maintain insurance for the works."])
    )
    assert response.failed_pages == [2]
    assert response.human_review_required is True
    assert response.items  # page 1 still extracted


@pytest.mark.asyncio
async def test_every_non_index_page_reaches_the_model(monkeypatch):
    """No keyword page filter: obligations on 'unimportant-looking' pages are not dropped."""
    monkeypatch.setattr(settings, "batch_page_window_size", 3)
    pages = [
        f"{n}.1 The Contractor shall keep site record number {n} up to date." for n in range(1, 61)
    ]
    fake = FakeLLM(lambda s, u: [])
    await ProductionExtractionPipeline(StructuredLLMClient(live_client=fake)).execute(
        _request(pages)
    )
    seen = {n for prompt in fake.calls for n in range(1, 61) if f'page="{n}"' in prompt}
    assert seen == set(range(1, 61))


@pytest.mark.asyncio
async def test_ungrounded_quote_is_retried_with_feedback_then_escalated():
    fake = FakeLLM(lambda s, u: [_candidate("The Bidder shall deposit Rs. 99 crore.")])
    response = await ProductionExtractionPipeline(StructuredLLMClient(live_client=fake)).execute(
        _request([PAGE])
    )
    assert response.items == []
    assert response.human_review_required is True
    assert len(fake.calls) == 3  # first answer + 2 targeted refinements
    assert "PRIOR VERIFICATION FEEDBACK" in fake.calls[-1]


def _candidate(quote: str):
    from tenderpulse_ai.domain.models import (
        CandidateComplianceItem,
        ExecutionRulesProps,
        ProvenanceProps,
    )

    return CandidateComplianceItem(
        category="FINANCIAL",
        title="Bid Security",
        description=quote,
        execution_rules=ExecutionRulesProps(),
        provenance=ProvenanceProps(page_number=1, clause_reference="Page 1", verbatim_quote=quote),
    )


# ------------------------------------------------------------------------------
# Gateway response parsing: the model's answer is used as given, never completed
# ------------------------------------------------------------------------------


def _response(payload) -> httpx.Response:
    return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(payload)}}]})


async def _extract(handler, **kw):
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        client = OpenAICompatibleLlmClient(api_key="k", model="m/primary", client=http, **kw)
        return await client.extract_compliance(
            "sys", "user", max_retries=0, block_map={"B1": {"text": "x" * 200, "page_number": 4}}
        )


@pytest.mark.asyncio
async def test_valid_empty_answer_is_accepted_without_rotation():
    models = []

    def handler(request):
        models.append(json.loads(request.content)["model"])
        return _response({"candidates": []})

    assert await _extract(handler) == []
    assert models == ["m/primary"]


@pytest.mark.asyncio
async def test_unparseable_answer_rotates_to_the_next_model():
    models = []

    def handler(request):
        model = json.loads(request.content)["model"]
        models.append(model)
        if model == "m/primary":
            return httpx.Response(200, json={"choices": [{"message": {"content": "Sure! Here"}}]})
        return _response({"candidates": []})

    assert await _extract(handler) == []
    assert models[0] == "m/primary" and len(models) == 2


@pytest.mark.asyncio
async def test_no_quote_or_unknown_category_is_dropped_not_invented():
    item = {"title": "EMD", "category": "FINANCIAL", "provenance": {"source_block_id": "B1"}}
    odd = {
        "title": "Odd",
        "category": "ASTROLOGY",
        "provenance": {"source_block_id": "B1", "verbatim_quote": "The bidder shall pay."},
    }
    assert await _extract(lambda r: _response({"candidates": [item, odd]})) == []


# ------------------------------------------------------------------------------
# Record / replay (LLM_REPLAY_MODE)
# ------------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_record_then_replay_offline(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "llm_replay_dir", str(tmp_path))
    answer = {
        "candidates": [
            {
                "title": "Bid Security",
                "category": "FINANCIAL",
                "description": "Furnish a bid security.",
                "provenance": {"page_number": 1, "verbatim_quote": "The Bidder shall furnish."},
            }
        ]
    }

    monkeypatch.setattr(settings, "llm_replay_mode", "record")
    recorded = await _extract(lambda r: _response(answer))
    assert len(list(tmp_path.glob("*.json"))) == 1

    monkeypatch.setattr(settings, "llm_replay_mode", "replay")

    def no_network(request):
        raise AssertionError("replay must not call the provider")

    replayed = await _extract(no_network)
    assert [c.title for c in replayed] == [c.title for c in recorded] == ["Bid Security"]


@pytest.mark.asyncio
async def test_replay_without_recording_is_an_explicit_error(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "llm_replay_dir", str(tmp_path))
    monkeypatch.setattr(settings, "llm_replay_mode", "replay")
    with pytest.raises(LLMExtractionError, match="no recording"):
        await _extract(lambda r: _response({"candidates": []}))


def test_emd_risk_reports_the_stated_amount_never_an_estimate():
    import datetime

    from tenderpulse_ai.agent.schemas import RequirementCandidate
    from tenderpulse_ai.decision.risks import CommercialRiskAnalyzer
    from tenderpulse_ai.domain.models import ProvenanceProps

    def emd(quote):
        return RequirementCandidate(
            category="FINANCIAL",
            kind="DOCUMENT_SUBMISSION",
            criticality="SUBMISSION_MANDATORY",
            title="EMD / Bid Security",
            description="Submit the bid security.",
            provenance=ProvenanceProps(verbatim_quote=quote),
        )

    def detail(quote):
        risks = CommercialRiskAnalyzer.analyze(
            [emd(quote)], datetime.date(2030, 1, 1), 500.0, current_date=datetime.date(2029, 1, 1)
        )
        return next(r.detail for r in risks if "EMD" in r.title)

    assert "Rs. 12.5 Lakh" in detail("The Bidder shall furnish an EMD of Rs. 12.5 lakh.")
    assert "Rs." not in detail("The Bidder shall furnish the EMD as specified.")  # no 2% guess
