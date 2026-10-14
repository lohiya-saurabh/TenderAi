import operator
from typing import Annotated, Any, TypedDict

from tenderpulse_ai.domain.models import (
    CandidateComplianceItem,
    VerifiedComplianceItem,
)


class ComplianceWorkflowState(TypedDict, total=False):
    """
    Central, typed state for the LangGraph 8-Node Compliance Extraction Workflow.
    All transitions are immutable and scoped by security_context.
    """

    # Base security & identifiers
    security_context: dict[str, Any]
    bid_id: str
    document_id: str
    file_name: str
    page_number: int
    raw_page_text: str
    pages: list[dict[str, Any]]
    storage_reference: str | None
    pdf_path: str | None

    # Node 1: Docling Parsed Output
    docling_document: dict[str, Any]

    # Node 2: Document Structure Tree
    document_structure: dict[str, Any]

    # Node 3: Candidate Detection
    detected_candidates: list[dict[str, Any]]
    unselected_passages: list[dict[str, Any]]

    # Node 4: Context Assembly
    assembled_contexts: list[dict[str, Any]]

    # Node 5: LLM Extractions & Retrieval
    retrieved_chunks: list[dict[str, Any]]
    extracted_candidates: list[CandidateComplianceItem]

    # Node 6 & 7: Validation & Confidence Routing
    validation_reports: list[dict[str, Any]]
    confidence_tier: str  # AUTO_ACCEPT, REVIEWER_VERIFICATION, MANDATORY_HUMAN_REVIEW
    confidence_score: float

    # Node 8: Verified Items & Storage
    verified_items: Annotated[list[VerifiedComplianceItem], operator.add]
    unverified_items: list[CandidateComplianceItem]
    retry_count: int
    error_feedback: str | None
    status: str
    human_review_required: bool
    audit_events: Annotated[list[dict[str, Any]], operator.add]
