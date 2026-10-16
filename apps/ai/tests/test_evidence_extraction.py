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


@pytest.mark.asyncio
async def test_extract_financial_turnover_evidence(sample_security_context):
    extractor = CompanyEvidenceExtractor()
    page_text = (
        "TO WHOMSOEVER IT MAY CONCERN\n"
        "This is to certify that M/s V. K. Surana & Co., Chartered Accountants, have audited "
        "the financial statements of Test Infrastructure Private Limited.\n"
        "The annual turnover of the company for the last three consecutive financial years is as under:\n"
        "1. FY 2022-23: INR 240.20 Crores\n"
        "2. FY 2023-24: INR 285.00 Crores\n"
        "3. FY 2024-25: INR 320.50 Crores\n"
        "The average annual turnover for the 3 years stands at INR 281.90 Crores.\n"
        "The net worth as on 31st March 2025 is INR 95.40 Crores.\n"
        "UDIN: 25089745AAAAAA1234\n"
        "Membership No: 089745 | Firm Registration No: 114522W\n"
    )

    req = CompanyEvidenceExtractionRequest(
        security_context=sample_security_context,
        organization_id="org_test_1",
        company_id="comp_test_1",
        evidence_document_id="ev_doc_001",
        file_name="CA_Turnover_Certificate_FY25.pdf",
        evidence_type="AUDITED_BALANCE_SHEET",
        pages=[NormalizedPage(page_number=1, text=page_text)],
    )

    resp = await extractor.extract(req)
    assert resp.status == "COMPLETED"
    assert resp.evidence_document_id == "ev_doc_001"
    assert resp.extracted_attributes["udin"] == "25089745AAAAAA1234"
    assert resp.extracted_attributes["average_turnover_inr_cr"] == 281.9
    assert resp.extracted_attributes["latest_turnover_inr_cr"] == 320.5
    assert len(resp.chunks) == 1
    assert resp.chunks[0].chunk_type == "FINANCIAL_TURNOVER"
    assert "25089745AAAAAA1234" in resp.chunks[0].content
    assert resp.chunks[0].metadata["udin"] == "25089745AAAAAA1234"


@pytest.mark.asyncio
async def test_extract_project_completion_evidence(sample_security_context):
    extractor = CompanyEvidenceExtractor()
    page_text = (
        "NATIONAL HIGHWAYS AUTHORITY OF INDIA (NHAI)\n"
        "PROJECT COMPLETION CERTIFICATE\n"
        "Agreement No: NHAI/PIU-BLR/STRR/PKG-2/2022/104\n"
        "Name of Work: Construction of 6-Lane Bangalore Satellite Town Ring Road (STRR) from Km 42.0 to Km 80.0\n"
        "Contractor: Test Infrastructure Private Limited\n"
        "Completed Contract Value: INR 215.00 Crores\n"
        "Original Contract Value: INR 210.00 Crores\n"
        "Date of Commencement: 15/01/2022\n"
        "Date of Completion: 30/11/2024\n"
        "The work has been completed satisfactorily in accordance with the specifications."
    )

    req = CompanyEvidenceExtractionRequest(
        security_context=sample_security_context,
        organization_id="org_test_1",
        company_id="comp_test_1",
        evidence_document_id="ev_doc_002",
        file_name="NHAI_STRR_Completion_Certificate.pdf",
        evidence_type="COMPLETION_CERT",
        pages=[NormalizedPage(page_number=1, text=page_text)],
    )

    resp = await extractor.extract(req)
    assert resp.status == "COMPLETED"
    assert (
        "NHAI" in resp.extracted_attributes["client_name"].upper()
        or "NATIONAL HIGHWAYS" in resp.extracted_attributes["client_name"].upper()
    )
    assert resp.extracted_attributes["contract_value_inr_cr"] == 215.0
    assert len(resp.chunks) == 1
    assert resp.chunks[0].chunk_type == "PROJECT_EXPERIENCE"
    assert "215" in resp.chunks[0].content


@pytest.mark.asyncio
async def test_extract_iso_certification_evidence(sample_security_context):
    extractor = CompanyEvidenceExtractor()
    page_text = (
        "BUREAU VERITAS CERTIFICATION\n"
        "Certificate of Registration\n"
        "This is to certify that the Quality Management System of Test Infrastructure Private Limited\n"
        "has been audited and found to be in accordance with the requirements of ISO 9001:2015\n"
        "Certificate Number: IND.21.4589/QM/U\n"
        "Original Approval Date: 12/04/2018\n"
        "Expiry Date: 11/04/2027\n"
        "Scope: EPC Construction of Highways, Expressways, Bridges and Structural Works."
    )

    req = CompanyEvidenceExtractionRequest(
        security_context=sample_security_context,
        organization_id="org_test_1",
        company_id="comp_test_1",
        evidence_document_id="ev_doc_003",
        file_name="ISO_9001_Bureau_Veritas.pdf",
        evidence_type="ISO_CERT",
        pages=[NormalizedPage(page_number=1, text=page_text)],
    )

    resp = await extractor.extract(req)
    assert resp.status == "COMPLETED"
    assert resp.extracted_attributes["standard"] == "ISO 9001:2015"
    assert "BUREAU VERITAS" in resp.extracted_attributes["issuer"].upper()
    assert resp.extracted_attributes["reference_number"] == "IND.21.4589/QM/U"
    assert len(resp.chunks) == 1
    assert resp.chunks[0].chunk_type == "CERTIFICATION"


@pytest.mark.asyncio
async def test_api_evidence_extract_endpoint_authorized(sample_security_context):
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
                {
                    "page_number": 1,
                    "text": "Government of India - GST Registration Certificate\nGSTIN: 27AABCT1234F1Z5\nLegal Name: Test Infrastructure Private Limited",
                }
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
        assert len(data["chunks"]) == 1
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
