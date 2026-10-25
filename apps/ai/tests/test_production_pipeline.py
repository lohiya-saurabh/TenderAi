import pytest
from fastapi.testclient import TestClient

from tenderpulse_ai.main import app
from tenderpulse_ai.models.llm_client import StructuredLLMClient
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
    pipeline = ProductionExtractionPipeline(
        llm_client=StructuredLLMClient(enable_live_client=False)
    )

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

    # Check Turnover extraction
    turnover_item = next(
        (
            i
            for i in response.items
            if "turnover" in i["title"].lower() or "turnover" in i["description"].lower()
        ),
        None,
    )
    assert turnover_item is not None
    assert turnover_item["executionRules"]["udinRequired"] is True


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

    response = await ProductionExtractionPipeline(
        llm_client=StructuredLLMClient(enable_live_client=False)
    ).execute(
        DocumentExtractionRequest(
            security_context=valid_sec_context,
            bid_id="bid_emd",
            document_id="doc_nit_555",
            document_type="NIT",
            file_name="NIT8.pdf",
            pages=[NormalizedPage(page_number=2, text=page_text)],
        ),
    )

    emd = next(
        item for item in response.items if item["title"] == "Tender & Bid Security (EMD) Guarantee"
    )
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
    response = await ProductionExtractionPipeline(
        llm_client=StructuredLLMClient(enable_live_client=False)
    ).execute(
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


def test_api_worker_process_message_fetches_document_from_storage_reference(tmp_path):
    client = TestClient(app)
    headers = {"X-Internal-Service-Key": "tenderpulse-internal-secret-2026"}

    doc_file = tmp_path / "NIT_Fetch_Package.txt"
    doc_file.write_text(
        "Clause 1.1: The Bidder shall submit an Earnest Money Deposit (EMD) of Rs. 10,00,000 on a 100 Rupee stamp paper.",
        encoding="utf-8",
    )

    payload = {
        "job_id": "job-worker-fetch-002",
        "organization_id": "org_worker_1",
        "company_id": "comp_worker_1",
        "bid_id": "bid_fetch_1",
        "document_id": "doc_fetch_1",
        "workflow_run_id": "run_worker_fetch_002",
        "correlation_id": "corr_worker_fetch_002",
        "storage_reference": str(doc_file),
        "file_name": "NIT_Fetch_Package.txt",
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


@pytest.mark.asyncio
async def test_toc_and_glossary_definitions_rejected_in_favor_of_operative_clauses(
    valid_sec_context,
):
    toc_text = (
        "TABLE OF CONTENTS\n"
        "8 Defect Liability and Maintenance Period . . . . . . . . . . . . 15\n"
        "13. Performance Security . . . . . . . . . . . . . . . . . . . . . 25\n"
        "14. Taxes and Duties . . . . . . . . . . . . . . . . . . . . . . . 32\n"
    )
    glossary_text = (
        "SECTION 1 - DEFINITIONS\n"
        "“Performance Security” means the security(ies) under GC Sub- Clause 13.\n"
        "“Project Manager” means the person appointed by the Employer in the manner provided in GC Sub-Clause 17.\n"
    )
    substantive_gcc_text = (
        "13. Performance Security\n"
        "13.3.1 The Contractor shall, within 28 days of the Letter of Acceptance, provide a Performance "
        "Security for the due performance of the Contract in the amount equivalent to 3% of the Accepted "
        "Contract Amount. The Performance Security shall be in the form of an unconditional Bank Guarantee.\n"
        "Failure of the successful Bidder to submit the Performance Security shall constitute sufficient grounds "
        "for annulment of the award and forfeiture of the Bid Security."
    )

    request = DocumentExtractionRequest(
        security_context=valid_sec_context,
        bid_id="bid_toc_filter_test",
        document_id="doc_nit_555",
        document_type="GCC",
        file_name="GCC_Contract.pdf",
        pages=[
            NormalizedPage(page_number=3, text=toc_text),
            NormalizedPage(page_number=9, text=glossary_text),
            NormalizedPage(page_number=25, text=substantive_gcc_text),
        ],
    )

    response = await ProductionExtractionPipeline(
        llm_client=StructuredLLMClient(enable_live_client=False)
    ).execute(request)
    assert response.status in ("REVIEW_READY", "HUMAN_REVIEW_REQUIRED")

    # Defect liability was only in TOC — should NOT be emitted
    defect_item = next(
        (
            i
            for i in response.items
            if i["title"] == "Defect Liability Period (DLP) & Maintenance Guarantee"
        ),
        None,
    )
    assert defect_item is None

    # Performance security was in TOC (p3), Glossary (p9), and Substantive (p25)
    pbg_item = next(
        i for i in response.items if i["title"] == "Performance Security (PBG) & Security Deposit"
    )
    assert pbg_item is not None
    quote = pbg_item["provenance"]["verbatimQuote"]
    assert "means the security(ies)" not in quote
    assert "TABLE OF CONTENTS" not in quote
    assert (
        "The Contractor shall, within 28 days of the Letter of Acceptance, provide a Performance Security"
        in quote
    )
    assert pbg_item["provenance"]["pageNumber"] == 25


@pytest.mark.asyncio
async def test_presigned_download_url_handover(valid_sec_context):
    from pathlib import Path

    repo_root = Path(__file__).resolve().parents[3]
    sample_pdf = repo_root / "samples" / "work_975754" / "NIT8.pdf"
    if not sample_pdf.is_file():
        sample_pdf = Path.cwd() / "samples" / "work_975754" / "NIT8.pdf"
    assert sample_pdf.is_file(), f"Sample NIT8.pdf should exist at {sample_pdf}"

    pipeline = ProductionExtractionPipeline(
        llm_client=StructuredLLMClient(enable_live_client=False)
    )
    request = DocumentExtractionRequest(
        security_context=valid_sec_context,
        bid_id="bid_presigned_test",
        document_id="doc_nit_555",
        document_type="NIT",
        file_name="NIT8.pdf",
        download_url=f"file://{sample_pdf.resolve()}",
        pages=[],  # Empty pages — resolved natively from presigned download_url
    )

    response = await pipeline.execute(request)
    assert response.status in ("REVIEW_READY", "HUMAN_REVIEW_REQUIRED")
    assert len(response.items) > 0

    emd_item = next((i for i in response.items if i["category"] == "FINANCIAL"), None)
    assert emd_item is not None
    assert "EMD" in emd_item["title"] or "Earnest" in emd_item["title"]
    assert emd_item["provenance"]["sourceDocumentId"] == "doc_nit_555"


def test_quote_whitespace_cleaning():
    from tenderpulse_ai.agent.validation import clean_whitespace

    raw = "10. The total time period for the assignment as Supervision Consultant will be for 60\nmonths."
    cleaned = clean_whitespace(raw)
    assert "\n" not in cleaned
    assert (
        cleaned
        == "10. The total time period for the assignment as Supervision Consultant will be for 60 months."
    )

    assert (
        clean_whitespace("   Multiple   spaces\t\tand\n\nnewlines  ")
        == "Multiple spaces and newlines"
    )
    assert clean_whitespace("") == ""
    assert clean_whitespace(None) == ""


def test_category_taxonomy_normalization():
    from tenderpulse_ai.agent.validation import CANONICAL_CATEGORIES, normalize_category

    assert "OPERATIONAL" in CANONICAL_CATEGORIES
    assert normalize_category("OPERATIONAL") == "OPERATIONAL"
    assert normalize_category("operational") == "OPERATIONAL"
    assert normalize_category("TECHNICAL_REQUIREMENT") == "TECHNICAL"
    assert normalize_category("technical requirement") == "TECHNICAL"
    assert normalize_category("SCOPE_OF_WORK") == "TECHNICAL"
    assert normalize_category("TECHNICAL_SCOPE_REQUIREMENT") == "TECHNICAL"
    assert normalize_category("MANDATORY_SUBMISSION") == "STATUTORY"
    assert normalize_category("MANDATORY TECHNICAL SUBMISSIONS") == "STATUTORY"
    assert normalize_category("PROCUREMENT_DEADLINE") == "COMMERCIAL"
    assert normalize_category("RESTRICTIVE_CONDITION") == "LEGAL"
    assert normalize_category("LEGAL_COVENANT") == "LEGAL"
    assert normalize_category("FINANCIAL_QUALIFICATION") == "FINANCIAL"
    assert normalize_category("ELIGIBILITY_CONDITION") == "TECHNICAL"

    with pytest.raises(ValueError, match="Unknown requirement category"):
        normalize_category("NON_EXISTENT_CATEGORY_XYZ")


@pytest.mark.asyncio
async def test_page_number_clamping_and_fragment_rejection(valid_sec_context):
    from tenderpulse_ai.domain.models import (
        CandidateComplianceItem,
        ExecutionRulesProps,
        ProvenanceProps,
    )
    from tenderpulse_ai.tools.page_text import PageTextTool
    from tenderpulse_ai.tools.retrieval import ScopedRetrievalTool
    from tenderpulse_ai.workflow.nodes import WorkflowNodeContext, make_validation_node

    node_ctx = WorkflowNodeContext(
        retrieval_tool=ScopedRetrievalTool(),
        page_text_tool=PageTextTool(),
        llm_client=StructuredLLMClient(enable_live_client=False),
    )
    val_node = make_validation_node(node_ctx)

    # 1. Page number clamping & category normalization
    state = {
        "security_context": valid_sec_context.model_dump(),
        "bid_id": "bid_clamp_1",
        "document_id": "doc_clamp_1",
        "page_number": 6,  # physical page 6
        "raw_page_text": "Clause 4.1. The bidder must maintain minimum net worth of INR 20 Crores.",
        "extracted_candidates": [
            CandidateComplianceItem(
                category="TECHNICAL_QUALIFICATION",  # Alias that should normalize to TECHNICAL
                title="Net Worth Requirement",
                description="The bidder must maintain \n minimum net worth",
                execution_rules=ExecutionRulesProps(),
                provenance=ProvenanceProps(
                    source_document_id="doc_clamp_1",
                    source_file_name="doc.pdf",
                    page_number=1,  # LLM erroneously gave 1
                    clause_reference="Page 1",
                    verbatim_quote="Clause 4.1. The bidder must \n maintain minimum net worth of INR 20 Crores.",
                    confidence_score=0.95,
                ),
            )
        ],
    }

    result = await val_node(state)
    assert len(result["verified_items"]) == 1
    verified = result["verified_items"][0]
    assert verified.provenance.page_number == 6
    assert verified.category == "TECHNICAL"
    assert "\n" not in verified.provenance.verbatim_quote
    assert "\n" not in verified.description
    assert verified.provenance.clause_reference == "Clause 4.1 (Page 6)"

    # 2. Dangling fragment rejection (long mid-sentence fragment)
    frag_state = {
        "security_context": valid_sec_context.model_dump(),
        "bid_id": "bid_clamp_1",
        "document_id": "doc_clamp_1",
        "page_number": 4,
        "raw_page_text": "should be equal to or more than Rs. 25.00 Crores (Rupees Twenty Five Crores only) in any of the last 3 years.",
        "extracted_candidates": [
            CandidateComplianceItem(
                category="FINANCIAL",
                title="Dangling Fragment Obligation",
                description="should be equal to or more than Rs. 25.00 Crores",
                execution_rules=ExecutionRulesProps(),
                provenance=ProvenanceProps(
                    source_document_id="doc_clamp_1",
                    source_file_name="doc.pdf",
                    page_number=4,
                    clause_reference="Page 4",
                    verbatim_quote="should be equal to or more than Rs. 25.00 Crores (Rupees Twenty Five Crores only) in any of the last 3 years.",
                    confidence_score=0.9,
                ),
            )
        ],
    }
    frag_result = await val_node(frag_state)
    assert len(frag_result["verified_items"]) == 0
    assert len(frag_result["unverified_items"]) == 1


@pytest.mark.asyncio
async def test_quote_overlap_consolidation(valid_sec_context):
    pipeline = ProductionExtractionPipeline(
        llm_client=StructuredLLMClient(enable_live_client=False)
    )

    request = DocumentExtractionRequest(
        security_context=valid_sec_context,
        bid_id="bid_overlap_test",
        document_id="doc_nit_555",
        document_type="NIT",
        file_name="NIT_Overlap.pdf",
        pages=[
            NormalizedPage(
                page_number=4,
                text="Clause 4.1.3 The bidder must furnish a Performance Security of INR 10,00,000 within 28 days of Letter of Acceptance on a 100 Rupee stamp paper with notarization.",
            ),
            NormalizedPage(
                page_number=6,
                text="Article 4.1.3 The bidder must furnish a Performance Security of INR 10,00,000 within 28 days of Letter of Acceptance on a 100 Rupee stamp paper with notarization.",
            ),
        ],
    )

    response = await pipeline.execute(request)
    assert response.status == "REVIEW_READY"
    pbg_items = [
        i
        for i in response.items
        if "Performance Security" in i["title"]
        or "Performance Security" in i["provenance"]["verbatimQuote"]
    ]
    # Deduplication across pages by quote overlap consolidates the identical requirement
    assert len(pbg_items) == 1
    assert "Pages" in pbg_items[0]["provenance"]["clauseReference"]
