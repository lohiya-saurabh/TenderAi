import operator
from typing import Annotated, Any, TypedDict

from tenderpulse_ai.domain.models import (
    CandidateComplianceItem,
    VerifiedComplianceItem,
)


class ComplianceWorkflowState(TypedDict):
    """
    Central, typed state for the LangGraph Compliance Extraction Workflow.
    All transitions are immutable and scoped by security_context.
    """
    security_context: dict[str, Any]
    bid_id: str
    document_id: str
    page_number: int
    raw_page_text: str
    retrieved_chunks: list[dict[str, Any]]
    extracted_candidates: list[CandidateComplianceItem]
    verified_items: Annotated[list[VerifiedComplianceItem], operator.add]
    unverified_items: list[CandidateComplianceItem]
    retry_count: int
    error_feedback: str | None
    status: str
    human_review_required: bool
    audit_events: Annotated[list[dict[str, Any]], operator.add]
