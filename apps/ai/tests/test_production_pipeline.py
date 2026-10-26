import pytest
from fakes import fake_llm_client, use_fake_llm
from fastapi.testclient import TestClient

from tenderpulse_ai.main import app
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


def test_api_extract_endpoint_returns_503_when_no_llm_answers(valid_sec_context):
    """LLM-only: with no provider configured there is no result, never a regex fallback."""
    client = TestClient(app)
    headers = {"X-Internal-Service-Key": "tenderpulse-internal-secret-2026"}
    payload = {
        "security_context": valid_sec_context.model_dump(),
        "bid_id": "bid_railway_12",
        "document_id": "doc_nit_555",
        "file_name": "NIT.pdf",
        "pages": [{"page_number": 1, "text": "The bidder must submit an EMD of INR 2,00,000."}],
    }
    response = client.post("/api/v1/extract", json=payload, headers=headers)
    assert response.status_code == 503
    assert response.json()["error"] == "LLM_EXTRACTION_FAILED"


def test_api_extract_endpoint_unauthorized():
    client = TestClient(app)
    response = client.post(
        "/api/v1/extract",
        json={"some": "payload"},
    )
    assert response.status_code == 401
    assert "Unauthorized" in response.json()["detail"]


def test_api_extract_endpoint_authorized(valid_sec_context, monkeypatch):
    use_fake_llm(monkeypatch)
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


def test_api_worker_process_message_authorized(monkeypatch):
    use_fake_llm(monkeypatch)
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


def test_api_worker_process_message_fetches_document_from_storage_reference(tmp_path, monkeypatch):
    use_fake_llm(monkeypatch)
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
        llm_client=fake_llm_client(lambda s, u: []),
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
    # The model's generic reference is kept here; the orchestrator's positional AST
    # attribution fills it from the document structure after validation.
    assert verified.provenance.clause_reference == "Page 1"

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
