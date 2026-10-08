import json

import httpx
import pytest

from tenderpulse_ai.domain.models import (
    AssembledClauseContext,
    CandidateComplianceItem,
    DocumentStructureTree,
    ExecutionRulesProps,
    ProvenanceProps,
)
from tenderpulse_ai.domain.validator import DeterministicValidator
from tenderpulse_ai.infrastructure.llm.openai_compatible_client import (
    OpenAICompatibleLlmClient,
)
from tenderpulse_ai.models.llm_client import StructuredLLMClient


@pytest.mark.asyncio
async def test_openai_compatible_client_parses_valid_json_response():
    sample_response_payload = {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": json.dumps({
                        "candidates": [
                            {
                                "category": "FINANCIAL",
                                "title": "Earnest Money Deposit (EMD)",
                                "description": "INR 10,00,000 required on non-judicial stamp paper.",
                                "execution_rules": {
                                    "stamp_paper_required": True,
                                    "stamp_paper_denomination_inr": 100,
                                    "notarization_required": False,
                                    "udin_required": False,
                                    "signing_authority_rank": "Authorized Signatory",
                                },
                                "provenance": {
                                    "page_number": 1,
                                    "clause_reference": "Section 1.1",
                                    "verbatim_quote": "The bidder must submit Bid Security / Earnest Money Deposit (EMD) of INR 10,00,000 on a non-judicial stamp paper.",
                                    "confidence_score": 0.98,
                                },
                            },
                            {
                                "category": "LEGAL",
                                "title": "Power of Attorney",
                                "description": "PoA in favor of lead member.",
                                "execution_rules": {
                                    "stamp_paper_required": True,
                                    "stamp_paper_denomination_inr": 500,
                                    "notarization_required": True,
                                    "udin_required": False,
                                },
                                "provenance": {
                                    "page_number": 1,
                                    "clause_reference": "Section 1.2",
                                    "verbatim_quote": "Power of Attorney executed on non-judicial stamp paper in favor of lead member of consortium.",
                                    "confidence_score": 0.95,
                                },
                            },
                        ]
                    }),
                }
            }
        ]
    }

    def handler(request: httpx.Request):
        assert request.headers.get("authorization") == "Bearer test-openrouter-key"
        assert request.headers.get("http-referer") == "https://tenderpulse.ai"
        body = json.loads(request.content)
        assert body["model"] == "google/gemini-2.0-flash-001"
        assert len(body["messages"]) == 2
        return httpx.Response(200, json=sample_response_payload)

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as mock_http:
        client = OpenAICompatibleLlmClient(
            api_key="test-openrouter-key",
            base_url="https://openrouter.ai/api/v1",
            model="google/gemini-2.0-flash-001",
            client=mock_http,
        )

        candidates = await client.extract_compliance(
            system_prompt="Test system prompt",
            user_prompt="Test user prompt",
        )

        assert len(candidates) == 2
        emd = candidates[0]
        assert emd.category == "FINANCIAL"
        assert emd.title == "Earnest Money Deposit (EMD)"
        assert emd.execution_rules.stamp_paper_required is True
        assert emd.execution_rules.stamp_paper_denomination_inr == 100
        assert emd.provenance.page_number == 1
        assert "INR 10,00,000" in emd.provenance.verbatim_quote

        poa = candidates[1]
        assert poa.category == "LEGAL"
        assert poa.execution_rules.notarization_required is True
        assert poa.execution_rules.stamp_paper_denomination_inr == 500


@pytest.mark.asyncio
async def test_openai_compatible_client_strips_markdown_fences():
    fenced_content = """```json
    {
      "items": [
        {
          "category": "TECHNICAL",
          "title": "Similar Work Experience",
          "description": "Completion of similar EPC work in last 7 years.",
          "execution_rules": {
            "stamp_paper_required": false,
            "notarization_required": false,
            "udin_required": true
          },
          "provenance": {
            "page_number": 2,
            "clause_reference": "Clause 2.1",
            "verbatim_quote": "The Bidder must demonstrate prior completion of similar work in EPC infrastructure works within last 7 years.",
            "confidence_score": 0.92
          }
        }
      ]
    }
    ```"""

    def handler(request: httpx.Request):
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": fenced_content}}]},
        )

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as mock_http:
        client = OpenAICompatibleLlmClient(
            api_key="test-key",
            client=mock_http,
        )
        items = await client.extract_compliance("sys", "user")
        assert len(items) == 1
        assert items[0].title == "Similar Work Experience"
        assert items[0].execution_rules.udin_required is True


@pytest.mark.asyncio
async def test_openai_compatible_client_retries_transient_error():
    attempts = 0

    def handler(request: httpx.Request):
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(503, text="Service Unavailable")
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": json.dumps({
                                "candidates": [
                                    {
                                        "category": "STATUTORY",
                                        "title": "Integrity Pact",
                                        "description": "Signed Integrity Pact required.",
                                        "execution_rules": {"stamp_paper_required": False, "notarization_required": False, "udin_required": False},
                                        "provenance": {"page_number": 3, "clause_reference": "Section 3", "verbatim_quote": "Integrity Pact duly signed", "confidence_score": 0.95},
                                    }
                                ]
                            })
                        }
                    }
                ]
            },
        )

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as mock_http:
        client = OpenAICompatibleLlmClient(api_key="test-key", client=mock_http)
        items = await client.extract_compliance("sys", "user", max_retries=1)
        assert attempts == 2
        assert len(items) == 1
        assert items[0].title == "Integrity Pact"


@pytest.mark.asyncio
async def test_structured_llm_client_falls_back_to_deterministic_extractor_on_live_error():
    def failing_handler(request: httpx.Request):
        return httpx.Response(500, text="Internal Gateway Error")

    transport = httpx.MockTransport(failing_handler)
    async with httpx.AsyncClient(transport=transport) as mock_http:
        failing_live_client = OpenAICompatibleLlmClient(api_key="test-key", client=mock_http)

        # Fallback deterministic extractor function
        def fallback_extractor(sys: str, user: str):
            return [
                CandidateComplianceItem(
                    category="FINANCIAL",
                    title="Fallback EMD",
                    description="Extracted via fallback deterministic rules",
                    execution_rules=ExecutionRulesProps(stamp_paper_required=True, stamp_paper_denomination_inr=100),
                    provenance=ProvenanceProps(
                        source_document_id="doc-test",
                        source_file_name="test.pdf",
                        page_number=1,
                        clause_reference="Sec 1",
                        verbatim_quote="Fallback quote",
                        confidence_score=0.9,
                    ),
                )
            ]

        structured_client = StructuredLLMClient(
            extractor_fn=fallback_extractor,
            live_client=failing_live_client,
        )

        items = await structured_client.extract_compliance("sys", "user", max_retries=0)
        assert len(items) == 1
        assert items[0].title == "Fallback EMD"


@pytest.mark.asyncio
async def test_deterministic_validator_rejects_hallucinated_llm_quote():
    raw_page_text = "The Bidder must submit an Earnest Money Deposit of INR 10,00,000 on a stamp paper."

    # Model hallucinates a quote not present in the document
    hallucinated_candidate = CandidateComplianceItem(
        category="FINANCIAL",
        title="Hallucinated Performance Guarantee",
        description="PBG of INR 50,00,000 required.",
        execution_rules=ExecutionRulesProps(stamp_paper_required=True, stamp_paper_denomination_inr=100),
        provenance=ProvenanceProps(
            source_document_id="doc-test",
            source_file_name="test.pdf",
            page_number=1,
            clause_reference="Clause 9.9",
            verbatim_quote="The Bidder shall furnish an unconditional Bank Guarantee of INR 50,00,000 within 15 days.",  # NOT IN PAGE TEXT
            confidence_score=0.99,
        ),
    )

    validator = DeterministicValidator()
    doc_structure = DocumentStructureTree(document_id="doc-test", nodes=[])
    context = AssembledClauseContext(
        candidate_id="cand_1",
        section_path="Document > Section 1",
        clause_reference="Clause 1.1",
        current_clause=raw_page_text,
        page_number=1,
    )

    check, _tier = validator.validate_item(
        item=hallucinated_candidate,
        context=context,
        tree=doc_structure,
    )

    assert check.numbers_preserved is False
    assert len(check.discrepancies) >= 2
    assert any("not found in clause text" in d.lower() for d in check.discrepancies)

    # In Node 6 exact substring grounding check
    clean_quote = " ".join(hallucinated_candidate.provenance.verbatim_quote.lower().split())
    quote_in_page = clean_quote in raw_page_text.lower()
    assert quote_in_page is False
