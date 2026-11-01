import json

import pytest
from httpx import ASGITransport, AsyncClient

from tenderpulse_ai.config import settings
from tenderpulse_ai.domain.evidence_extractor import (
    CompanyEvidenceExtractionRequest,
    CompanyEvidenceExtractor,
)
from tenderpulse_ai.main import app
from tenderpulse_ai.pipeline import NormalizedPage
from tenderpulse_ai.security.context import SecurityContext


@pytest.fixture
def sample_security_context():
    return SecurityContext(
        tenant_id="org_test_1",
        company_id="comp_test_1",
        user_id="user_test_1",
        workflow_run_id="run_test_1",
        allowed_document_ids=["ev_doc_001", "ev_doc_002", "ev_doc_003", "ev_doc_api_01"],
        purpose="COMPLIANCE_EXTRACTION",
    )


class ScriptedJsonModel:
    """Stands in for OpenAICompatibleLlmClient.complete_structured with a fixed JSON answer."""

    def __init__(self, answer: dict | Exception):
        self.answer = answer
        self.prompts: list[str] = []

    async def complete_structured(self, system_prompt, user_prompt, parse, max_retries=1):
        self.prompts.append(user_prompt)
        if isinstance(self.answer, Exception):
            raise self.answer
        return parse({"choices": [{"message": {"content": json.dumps(self.answer)}}]})


def _attr(name, value, quote, page=1):
    return {"name": name, "value": value, "page_number": page, "verbatim_quote": quote}


def _request(ctx, doc_id, file_name, evidence_type, text):
    return CompanyEvidenceExtractionRequest(
        security_context=ctx,
        organization_id="org_test_1",
        company_id="comp_test_1",
        evidence_document_id=doc_id,
        file_name=file_name,
        evidence_type=evidence_type,
        pages=[NormalizedPage(page_number=1, text=text)],
    )


CA_CERT = (
    "TO WHOMSOEVER IT MAY CONCERN\n"
    "This is to certify that M/s V. K. Surana & Co., Chartered Accountants, have audited "
    "the financial statements of Test Infrastructure Private Limited.\n"
    "1. FY 2022-23: INR 240.20 Crores\n"
    "2. FY 2023-24: INR 285.00 Crores\n"
    "3. FY 2024-25: INR 320.50 Crores\n"
    "The net worth as on 31st March 2025 is INR 95.40 Crores.\n"
    "UDIN: 25089745AAAAAA1234\n"
)


@pytest.mark.asyncio
async def test_financial_evidence_keeps_only_grounded_model_answers(sample_security_context):
    model = ScriptedJsonModel(
        {
            "evidence_category": "FINANCIAL_TURNOVER",
            "attributes": [
                _attr("udin", "25089745AAAAAA1234", "UDIN: 25089745AAAAAA1234"),
                _attr(
                    "net_worth",
                    "INR 95.40 Crores",
                    "The net worth as on 31st March 2025 is INR 95.40 Crores.",
                ),
                # hallucinated: neither the quote nor the value is on the page
                _attr("gstin", "27AABCT1234F1Z5", "GSTIN: 27AABCT1234F1Z5"),
            ],
            "turnover_by_fy": [
                {
                    "financial_year": "2022-23",
                    "amount": "INR 240.20 Crores",
                    "page_number": 1,
                    "verbatim_quote": "1. FY 2022-23: INR 240.20 Crores",
                },
                {
                    "financial_year": "2023-24",
                    "amount": "INR 285.00 Crores",
                    "page_number": 1,
                    "verbatim_quote": "2. FY 2023-24: INR 285.00 Crores",
                },
                {
                    "financial_year": "2024-25",
                    "amount": "INR 320.50 Crores",
                    "page_number": 1,
                    "verbatim_quote": "3. FY 2024-25: INR 320.50 Crores",
                },
                # amount not in its quote -> dropped
                {
                    "financial_year": "2025-26",
                    "amount": "INR 999 Crores",
                    "page_number": 1,
                    "verbatim_quote": "3. FY 2024-25: INR 320.50 Crores",
                },
            ],
        }
    )
    resp = await CompanyEvidenceExtractor(llm_client=model).extract(
        _request(
            sample_security_context,
            "ev_doc_001",
            "CA_Turnover.pdf",
            "AUDITED_BALANCE_SHEET",
            CA_CERT,
        )
    )
    attrs = resp.extracted_attributes
    assert resp.status == "COMPLETED"
    assert attrs["udin"] == attrs["reference_number"] == "25089745AAAAAA1234"
    assert attrs["net_worth_inr_cr"] == 95.4
    assert "gstin" not in attrs
    assert attrs["turnover_by_fy"] == {"2022-23": 240.2, "2023-24": 285.0, "2024-25": 320.5}
    assert attrs["latest_turnover_inr_cr"] == 320.5
    assert attrs["average_turnover_inr_cr"] == 281.9  # arithmetic over the stated years only
    assert len(resp.chunks) == 1
    chunk = resp.chunks[0]
    assert chunk.chunk_type == "FINANCIAL_TURNOVER"
    assert chunk.content == CA_CERT.strip()  # page text verbatim, no synthesized header
    assert chunk.metadata["udin"] == "25089745AAAAAA1234"


@pytest.mark.asyncio
async def test_certification_evidence_attributes_and_category(sample_security_context):
    text = (
        "BUREAU VERITAS CERTIFICATION\nCertificate of Registration\n"
        "has been audited and found to be in accordance with the requirements of ISO 9001:2015\n"
        "Certificate Number: IND.21.4589/QM/U\nExpiry Date: 11/04/2027\n"
    )
    model = ScriptedJsonModel(
        {
            "evidence_category": "CERTIFICATION",
            "attributes": [
                _attr("issuer", "BUREAU VERITAS CERTIFICATION", "BUREAU VERITAS CERTIFICATION"),
                _attr(
                    "standard",
                    "ISO 9001:2015",
                    "found to be in accordance with the requirements of ISO 9001:2015",
                ),
                _attr(
                    "reference_number", "IND.21.4589/QM/U", "Certificate Number: IND.21.4589/QM/U"
                ),
                _attr("valid_to", "11/04/2027", "Expiry Date: 11/04/2027"),
            ],
        }
    )
    resp = await CompanyEvidenceExtractor(llm_client=model).extract(
        _request(sample_security_context, "ev_doc_003", "ISO.pdf", "ISO_CERT", text)
    )
    attrs = resp.extracted_attributes
    assert attrs["standard"] == "ISO 9001:2015"
    assert attrs["reference_number"] == "IND.21.4589/QM/U"
    assert attrs["valid_to"] == "11/04/2027"  # as written; the API parses dates
    assert resp.chunks[0].chunk_type == "CERTIFICATION"


@pytest.mark.asyncio
async def test_evidence_llm_failure_is_explicit_and_returns_nothing(sample_security_context):
    model = ScriptedJsonModel(RuntimeError("all providers rate-limited"))
    resp = await CompanyEvidenceExtractor(llm_client=model).extract(
        _request(sample_security_context, "ev_doc_001", "CA.pdf", "TURNOVER_CERTIFICATE", CA_CERT)
    )
    assert resp.status == "FAILED"
    assert "rate-limited" in resp.error
    assert resp.extracted_attributes == {} and resp.chunks == []


@pytest.mark.asyncio
async def test_evidence_without_provider_fails_instead_of_guessing(sample_security_context):
    resp = await CompanyEvidenceExtractor().extract(
        _request(sample_security_context, "ev_doc_001", "CA.pdf", "TURNOVER_CERTIFICATE", CA_CERT)
    )
    assert resp.status == "FAILED"
    assert "LLM" in resp.error


@pytest.mark.asyncio
async def test_raw_pdf_bytes_are_not_treated_as_page_text(sample_security_context):
    model = ScriptedJsonModel({"evidence_category": "GENERAL", "attributes": []})
    resp = await CompanyEvidenceExtractor(llm_client=model).extract(
        _request(
            sample_security_context,
            "ev_doc_001",
            "x.pdf",
            "OTHER",
            "%PDF-1.7\n%\xe2\xe3 obj stream",
        )
    )
    assert resp.status == "FAILED" and model.prompts == []


@pytest.mark.asyncio
async def test_api_evidence_extract_endpoint_authorized(sample_security_context, monkeypatch):
    model = ScriptedJsonModel(
        {
            "evidence_category": "REGISTRATION",
            "attributes": [_attr("gstin", "27AABCT1234F1Z5", "GSTIN: 27AABCT1234F1Z5")],
        }
    )
    monkeypatch.setattr(CompanyEvidenceExtractor, "_client", lambda self: model)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "security_context": sample_security_context.model_dump(),
            "organization_id": "org_test_1",
            "company_id": "comp_test_1",
            "evidence_document_id": "ev_doc_api_01",
            "file_name": "GST_Registration.pdf",
            "evidence_type": "GST_REG",
            "pages": [
                {"page_number": 1, "text": "GST Registration Certificate\nGSTIN: 27AABCT1234F1Z5"}
            ],
        }
        res = await client.post(
            "/api/v1/evidence/extract",
            json=payload,
            headers={"X-Internal-Service-Key": settings.internal_service_key},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "COMPLETED"
        assert data["extracted_attributes"]["gstin"] == "27AABCT1234F1Z5"
        assert data["chunks"][0]["chunk_type"] == "REGISTRATION"


@pytest.mark.asyncio
async def test_api_evidence_extract_endpoint_unauthorized():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/evidence/extract",
            json={"evidence_document_id": "test"},
            headers={"X-Internal-Service-Key": "wrong-key"},
        )
        assert res.status_code == 401
