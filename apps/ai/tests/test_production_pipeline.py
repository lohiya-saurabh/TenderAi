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


@pytest.mark.asyncio
async def test_emd_provenance_quote_includes_sentence_across_pdf_line_wrap(valid_sec_context):
    page_text = (
        "https://eprocure.gov.in/eprocure/app CPP portal on or before 09-10-2026 (upto\n"
        "16:00 hrs IST). Bids received online will be opened on 12-10-2026 (at 16:00 hrs\n"
        "IST)\n"
        "Queries/Clarifications if any may be submitted on or before 05-10-2026\n"
        "upto 15:00 hrs IST)\n"
        "The EMD shall be paid in the form of Bank Guarantee/FDR drawn in\n"
        "favour of the Executive Engineer National Highway Division Hassan, obtained\n"
        "from any Nationalized/Scheduled Banks payable at Hassan. Scanned copy of "
        "BGs or FDRs shall be uploaded along with bid documents."
    )

    response = await ProductionExtractionPipeline().execute(
        DocumentExtractionRequest(
            security_context=valid_sec_context,
            bid_id="bid_emd",
            document_id="doc_nit_555",
            document_type="NIT",
            file_name="NIT8.pdf",
            pages=[NormalizedPage(page_number=2, text=page_text)],
        ),
    )

    emd = next(item for item in response.items if item["title"] == "Tender & Bid Security (EMD) Guarantee")
    assert emd["provenance"]["verbatimQuote"] == (
        "The EMD shall be paid in the form of Bank Guarantee/FDR drawn in "
        "favour of the Executive Engineer National Highway Division Hassan, obtained "
        "from any Nationalized/Scheduled Banks payable at Hassan."
    )
    assert emd["provenance"]["pageNumber"] == 2
    assert emd["provenance"]["sourceFileName"] == "NIT8.pdf"
    assert "Scanned copy of BGs" not in emd["provenance"]["verbatimQuote"]


@pytest.mark.asyncio
async def test_annual_turnover_quote_stays_with_numbered_item_and_page(valid_sec_context):
    page_text = (
        "6. Previous unrelated checklist item.\n"
        "7. 2023-24, 2024-25 and 2025-26 financial years, "
        "£ÀqÉ¹zÀ §UÉÎ ZÁlðqï CPËAmÉAmï¤AzÀ zÀÈrüÃPÀj¹zÀ Annual Turnover "
        "¥ÀæªÀiÁt ¥ÀvÀæ ºÁUÀÆ ªÁ¶ðPÀªÁgÀÄ ªÀ»ªÁlÄUÀ¼À Drmï ªÀgÀ¢\n"
        "8. Income tax payment certificate."
    )
    response = await ProductionExtractionPipeline().execute(
        DocumentExtractionRequest(
            security_context=valid_sec_context,
            bid_id="bid_turnover",
            document_id="doc_nit_555",
            document_type="NIT",
            file_name="Tdocument.pdf",
            pages=[NormalizedPage(page_number=10, text=page_text)],
        ),
    )

    item = next(
        item
        for item in response.items
        if item["title"] == "Technical Qualification & Annual Turnover"
    )
    quote = item["provenance"]["verbatimQuote"]
    assert quote.startswith("7.")
    assert "Annual Turnover" in quote
    assert "8. Income tax" not in quote
    assert item["provenance"]["pageNumber"] == 10


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


def test_api_worker_process_message_authorized():
    client = TestClient(app)
    headers = {"X-Internal-Service-Key": "tenderpulse-internal-secret-2026"}

    payload = {
        "job_id": "job-worker-001",
        "organization_id": "org_worker_1",
        "company_id": "comp_worker_1",
        "bid_id": "bid_worker_1",
        "document_id": "doc_worker_1",
        "workflow_run_id": "run_worker_001",
        "correlation_id": "corr_worker_001",
        "storage_reference": "tenants/org_worker_1/bids/bid_worker_1/doc_worker_1/NIT.pdf",
        "file_name": "NIT_Worker_Package.pdf",
        "document_type": "NIT",
        "pages": [
            {
                "page_number": 1,
                "text": "The bidder must submit an Earnest Money Deposit (EMD) of INR 5,00,000 on a 100 Rupee stamp paper.",
            }
        ],
    }

    response = client.post("/api/v1/worker/process-message", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "PROCESSED"
    assert data["processed"] is True
    assert data["bid_id"] == "bid_worker_1"
    assert data["document_id"] == "doc_worker_1"
    assert len(data["items"]) >= 1


def test_api_worker_process_message_fetches_document_from_storage_reference():
    client = TestClient(app)
    headers = {"X-Internal-Service-Key": "tenderpulse-internal-secret-2026"}

    payload = {
        "job_id": "job-worker-fetch-002",
        "organization_id": "org_worker_1",
        "company_id": "comp_worker_1",
        "bid_id": "bid_fetch_1",
        "document_id": "doc_fetch_1",
        "workflow_run_id": "run_worker_fetch_002",
        "correlation_id": "corr_worker_fetch_002",
        "storage_reference": "tenants/org_worker_1/bids/bid_fetch_1/doc_fetch_1/NIT.pdf",
        "file_name": "NIT_Fetch_Package.pdf",
        "document_type": "NIT",
        "pages": [],
    }

    response = client.post("/api/v1/worker/process-message", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["processed"] is True
    assert data["status"] == "PROCESSED"
    assert data["bid_id"] == "bid_fetch_1"
    assert data["document_id"] == "doc_fetch_1"
    assert len(data["items"]) >= 1
