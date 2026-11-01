"""C1 (AI half): the clause contract the AI sends the API.

Runs the fixture tender through the real pipeline and the real model-response parser, then
checks the completion event against the shared JSON Schema
(packages/shared-types/schema/extraction-completed.schema.json) and the Phase 1 rules:
nothing defaulted, identity by location, conflicts linked to real clauses, coverage reported.

The resulting event is the golden fixture the API tests ingest
(packages/shared-types/fixtures/extraction-completed.phase1.json). Regenerate it with
UPDATE_FIXTURES=1 after an intended contract change.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

import jsonschema
import pytest
from fixtures import phase1_tender as fx

from tenderpulse_ai.extraction.contracts import DocumentExtractionRequest, NormalizedPage
from tenderpulse_ai.extraction.orchestrator import ProductionExtractionPipeline
from tenderpulse_ai.infrastructure.llm.openai_compatible_client import OpenAICompatibleLlmClient
from tenderpulse_ai.infrastructure.queue.publisher import DocumentExtractionCompletedEvent
from tenderpulse_ai.security.context import SecurityContext

REPO = Path(__file__).resolve().parents[3]
SCHEMA = REPO / "packages/shared-types/schema/extraction-completed.schema.json"
GOLDEN = REPO / "packages/shared-types/fixtures/extraction-completed.phase1.json"

_BLOCK = re.compile(r"\[(B\d+)\] \[Page (\d+)[^\]]*\]:\n(.*?)\s*</untrusted_document_data>", re.S)


class ScriptedModel:
    """Answers like the live model: raw JSON items keyed to prompt block ids, parsed by the
    production parser. Fails (no usable answer) on the image-only page."""

    def __init__(self) -> None:
        self.parser = OpenAICompatibleLlmClient.__new__(OpenAICompatibleLlmClient)

    async def extract_compliance(self, system_prompt, user_prompt, max_retries=1, block_map=None):
        if f'page="{fx.FAILED_PAGE}"' in user_prompt:
            raise RuntimeError("model returned no usable answer for the image-only page")
        raw_items = []
        for block_id, _page, text in _BLOCK.findall(user_prompt):
            flat = " ".join(text.split())
            for quote, answer in fx.ANSWERS.items():
                if quote in flat:
                    raw_items.append({"block_id": block_id, "quote": quote, **answer})
        return [
            c
            for c in (self.parser._build_candidate(r, block_map=block_map) for r in raw_items)
            if c is not None
        ]


def _request() -> DocumentExtractionRequest:
    return DocumentExtractionRequest(
        security_context=SecurityContext(
            tenant_id="org_fixture",
            user_id="u_fixture",
            workflow_run_id="run_fixture",
            allowed_document_ids=[fx.DOCUMENT_ID],
            purpose="COMPLIANCE_EXTRACTION",
        ),
        bid_id=fx.BID_ID,
        document_id=fx.DOCUMENT_ID,
        file_name=fx.FILE_NAME,
        pages=[NormalizedPage(page_number=i + 1, text=t) for i, t in enumerate(fx.PAGES)],
    )


async def _event() -> dict[str, Any]:
    from tenderpulse_ai.models.llm_client import StructuredLLMClient

    client = StructuredLLMClient(live_client=ScriptedModel())
    result = await ProductionExtractionPipeline(client).execute(_request())
    event = DocumentExtractionCompletedEvent(
        job_id="job_fixture",
        organization_id="org_fixture",
        bid_id=fx.BID_ID,
        document_id=fx.DOCUMENT_ID,
        status="COMPLETED",
        items=result.items,
        chunks=result.chunks,  # page text the API verifies quotes against
        conflicts=result.conflicts,
        coverage=result.coverage,
        timestamp="2026-10-26T00:00:00+00:00",
    )
    return json.loads(json.dumps(event.to_camel_case_dict()))


@pytest.fixture(scope="module")
def event() -> dict[str, Any]:
    import asyncio

    return asyncio.run(_event())


def _by_title(event: dict[str, Any], title: str) -> list[dict[str, Any]]:
    return [i for i in event["items"] if i["title"] == title]


def test_event_validates_against_shared_schema(event):
    schema = json.loads(SCHEMA.read_text())
    jsonschema.validate(event, schema)


def test_no_legacy_defaults_anywhere(event):
    text = json.dumps(event)
    for legacy in ("Authorized Signatory", "Clause Reference", "NIT_Document.pdf", "doc-general"):
        assert legacy not in text
    for item in event["items"]:
        prov = item["provenance"]
        assert prov["confidenceScore"] != 0.95
        assert not re.fullmatch(r"Page \d+", prov["clauseReference"] or "")
        assert "(Page" not in (prov["clauseReference"] or "")


def test_identity_is_location_and_same_titles_stay_separate(event):
    assert len(event["items"]) == fx.EXPECTED_ITEM_COUNT
    keys = [i["itemKey"] for i in event["items"]]
    assert len(set(keys)) == len(keys)
    security = _by_title(event, "Performance Security")
    assert sorted(i["provenance"]["pageNumber"] for i in security) == [2, 4]
    assert [i["docOrder"] for i in event["items"]] == list(range(len(event["items"])))
    pages = [i["provenance"]["pageNumber"] for i in event["items"]]
    assert pages == sorted(pages)


def test_quotes_are_tender_text(event):
    page_text = {i + 1: " ".join(t.split()) for i, t in enumerate(fx.PAGES)}
    for item in event["items"]:
        prov = item["provenance"]
        assert prov["verbatimQuote"] in page_text[prov["pageNumber"]]


def test_attributes_are_grounded(event):
    emd = _by_title(event, "Earnest Money Deposit")[0]["attributes"]
    assert emd["amount"] == {"inr": 7500.0, "percent": None, "basis": None}
    assert emd["disqualifying"] is True
    assert emd["stage"] == "WITH_BID_ONLINE"

    originals = _by_title(event, "Physical originals deadline")[0]["attributes"]
    assert originals["deadline"] == {
        "kind": "ABSOLUTE",
        "date": "28.11.2026 11:00",
        "anchor": None,
        "offsetDays": None,
    }

    ps5 = next(
        i for i in _by_title(event, "Performance Security") if i["provenance"]["pageNumber"] == 2
    )["attributes"]
    assert ps5["deadline"] == {"kind": "RELATIVE", "date": None, "anchor": "LOA", "offsetDays": 30}
    assert ps5["amount"] == {"inr": None, "percent": 5.0, "basis": "contract value"}

    ps3 = next(
        i for i in _by_title(event, "Performance Security") if i["provenance"]["pageNumber"] == 4
    )["attributes"]
    # the hallucinated Rs 99,999 is not in the quote: dropped, the stated 3% kept
    assert ps3["amount"] == {"inr": None, "percent": 3.0, "basis": "contract value"}

    affidavit = _by_title(event, "Non-blacklisting affidavit")[0]
    assert affidavit["executionRules"]["stampPaperRequired"] is True
    assert affidavit["executionRules"]["stampPaperDenominationInr"] == 10
    assert affidavit["executionRules"]["notarizationRequired"] is True
    assert affidavit["executionRules"]["udinRequired"] is None  # not stated, not "false"
    assert affidavit["attributes"]["parties"] == ["NOTARY"]

    udin = _by_title(event, "Turnover certificate with UDIN")[0]
    assert udin["executionRules"]["udinRequired"] is True
    assert udin["attributes"]["formRef"] == "Appendix XI"
    assert udin["attributes"]["parties"] == ["CA_AUDITOR"]

    defect = _by_title(event, "Defect liability period")[0]
    assert defect["executionRules"] == {
        "stampPaperRequired": None,
        "stampPaperDenominationInr": None,
        "notarizationRequired": None,
        "signingAuthorityRank": None,
        "udinRequired": None,
        "apostilleRequired": None,
        "clientCountersignRequired": None,
    }
    assert defect["attributes"]["amount"] is None
    assert defect["attributes"]["deadline"] is None


def test_clause_without_number_has_null_reference(event):
    validity = _by_title(event, "Bid validity")[0]
    assert validity["provenance"]["clauseReference"] is None


def test_conflicts_link_real_clauses(event):
    by_attr = {c["attribute"]: c for c in event["conflicts"]}
    assert set(by_attr) == {"Performance security %", "EMD amount"}
    keys = {i["itemKey"]: i for i in event["items"]}
    for conflict in event["conflicts"]:
        for value in conflict["values"]:
            clause = keys[value["itemKey"]]
            assert value["quote"] == clause["provenance"]["verbatimQuote"]
            assert value["page"] == clause["provenance"]["pageNumber"]
            assert "CONFLICT" in clause["flags"]
    assert [v["display"] for v in by_attr["Performance security %"]["values"]] == ["3%", "5%"]
    assert [v["display"] for v in by_attr["EMD amount"]["values"]] == ["Rs. 7,500", "Rs. 12,500"]
    # no conflict is smuggled into the clause list
    assert not any(
        i["title"].lower().startswith(("ai-detected", "contradiction")) for i in event["items"]
    )


def test_coverage_reports_the_unread_page(event):
    assert event["coverage"] == {
        "documentId": fx.DOCUMENT_ID,
        "pageCount": len(fx.PAGES),
        "failedPages": [{"page": fx.FAILED_PAGE, "reason": "LLM_EXTRACTION_FAILED"}],
        "status": "PARTIAL",
    }
    defect = _by_title(event, "Defect liability period")[0]
    assert defect["flags"] == ["NEAR_FAILED_PAGE"]


def test_golden_fixture_matches(event):
    """The API tests ingest this exact event; a contract change must regenerate it."""
    if os.environ.get("UPDATE_FIXTURES") == "1":
        GOLDEN.parent.mkdir(parents=True, exist_ok=True)
        GOLDEN.write_text(json.dumps(event, indent=2, ensure_ascii=False) + "\n")
    assert GOLDEN.exists(), "run with UPDATE_FIXTURES=1 to create the golden fixture"
    assert json.loads(GOLDEN.read_text()) == event


@pytest.mark.parametrize(
    ("page", "quote", "expected"),
    [
        ("2.1 The bidder shall pay EMD.", "The bidder shall pay EMD.", "2.1"),
        ("SCC 7.1 The Contractor shall furnish it.", "The Contractor shall furnish it.", "SCC 7.1"),
        ("Clause 5\n(k) a certificate shall be given.", "a certificate shall be given.", "(k)"),
        (
            "Clause 9 Defects\nThe Contractor shall rectify defects.",
            "The Contractor shall rectify defects.",
            "Clause 9",
        ),
        ("Bid validity\nThe bid shall remain valid.", "The bid shall remain valid.", None),
        ("28.11.2026 is the last date. The bidder shall submit.", "The bidder shall submit.", None),
    ],
)
def test_clause_reference_is_read_from_the_page(page, quote, expected):
    from tenderpulse_ai.extraction.clause_references import clause_ref_from_page

    assert clause_ref_from_page(page, quote) == (expected, True)


def test_attribute_values_need_the_quote():
    from tenderpulse_ai.domain.requirement_attributes import parse_attributes

    quote = "The bidder shall deposit Rs. 1,50,000 within 15 days of the LOA."
    a = parse_attributes(
        {
            "obligation": "financial commitment",
            "stage": "SOMETIME",
            "parties": ["bank", "astrologer"],
            "amount": {"inr": "150000", "percent": 2},
            "deadline": {"anchor": "LOA", "offset_days": 15},
            "form_ref": "Appendix IV",
            "disqualifying": "yes",
        },
        quote,
    )
    assert a.obligation_type == "FINANCIAL_COMMITMENT"
    assert a.stage is None  # not an allowed value
    assert a.parties == ["BANK"]
    assert a.amount is not None and a.amount.inr == 150000 and a.amount.percent is None
    assert a.deadline is not None and (a.deadline.anchor, a.deadline.offset_days) == ("LOA", 15)
    assert a.form_ref is None  # "Appendix IV" is not in the quote
    assert a.disqualifying is None  # only a literal true counts
