import pytest
from fastapi.testclient import TestClient

from tenderpulse_ai.main import app
from tenderpulse_ai.pipeline import (
    DocumentExtractionRequest,
    NormalizedPage,
    ProductionExtractionPipeline,
)
from tenderpulse_ai.security.context import SecurityContext


@pytest.fixture
def valid_sec_context():
    return SecurityContext(
        tenant_id="org_pipeline_test_1",
        user_id="usr_manager_1",
        workflow_run_id="run_pipeline_101",
        allowed_document_ids=["doc_nit_555"],
        allowed_source_ids=["src_portal_1"],
        purpose="COMPLIANCE_EXTRACTION",
    )


@pytest.mark.asyncio
async def test_production_pipeline_extraction_success(valid_sec_context):
    pipeline = ProductionExtractionPipeline()

    request = DocumentExtractionRequest(
        security_context=valid_sec_context,
        bid_id="bid_highway_99",
        document_id="doc_nit_555",
        document_type="NIT",
        file_name="NIT_Highway_Package.pdf",
        pages=[
            NormalizedPage(
                page_number=1,
                text="Notice Inviting Tender. The bidder must submit an Earnest Money Deposit (EMD) of INR 10,00,000 on a 100 Rupee stamp paper with notarization.",
            ),
            NormalizedPage(
                page_number=2,
                text="Eligibility Criteria. Bidder must have minimum annual turnover of INR 50 Crores with CA certificate bearing valid UDIN.",
            ),
        ],
    )

    response = await pipeline.execute(request)

    assert response.status == "REVIEW_READY"
    assert response.document_id == "doc_nit_555"
    assert response.bid_id == "bid_highway_99"
    assert len(response.items) >= 2

    # Check EMD extraction
    emd_item = next((i for i in response.items if i["category"] == "FINANCIAL"), None)
    assert emd_item is not None
    assert emd_item["executionRules"]["stampPaperRequired"] is True
    assert emd_item["executionRules"]["stampPaperDenominationInr"] == 100
    assert emd_item["provenance"]["sourceDocumentId"] == "doc_nit_555"
    assert emd_item["provenance"]["sourceFileName"] == "NIT_Highway_Package.pdf"

    # Check Technical / Turnover extraction
    tech_item = next((i for i in response.items if i["category"] == "TECHNICAL"), None)
    assert tech_item is not None
    assert tech_item["executionRules"]["udinRequired"] is True


def test_api_extract_endpoint_unauthorized():
    client = TestClient(app)
    response = client.post(
        "/api/v1/extract",
        json={"some": "payload"},
    )
    assert response.status_code == 401
    assert "Unauthorized" in response.json()["detail"]


def test_api_extract_endpoint_authorized(valid_sec_context):
    client = TestClient(app)
    headers = {"X-Internal-Service-Key": "tenderpulse-internal-secret-2026"}

    payload = {
        "security_context": valid_sec_context.model_dump(),
        "bid_id": "bid_railway_12",
        "document_id": "doc_nit_555",
        "document_type": "NIT",
        "file_name": "NIT_Railway_Package.pdf",
        "pages": [
            {
                "page_number": 1,
                "text": "The bidder must submit an Earnest Money Deposit (EMD) of INR 2,00,000 on stamp paper.",
            }
        ],
    }

    response = client.post("/api/v1/extract", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["bid_id"] == "bid_railway_12"
    assert data["document_id"] == "doc_nit_555"
    assert len(data["items"]) >= 1
