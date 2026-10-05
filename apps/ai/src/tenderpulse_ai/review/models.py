from __future__ import annotations

from datetime import UTC, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

from tenderpulse_ai.domain.models import CandidateComplianceItem


class HumanReviewDecision(str, Enum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    EDIT = "EDIT"
    CONFIRM = "CONFIRM"
    OVERRIDE = "OVERRIDE"


class HumanReviewTaskStatus(str, Enum):
    PENDING = "PENDING"
    IN_REVIEW = "IN_REVIEW"
    ESCALATED = "ESCALATED"
    COMPLETED = "COMPLETED"
    EXPIRED = "EXPIRED"
    REASSIGNED = "REASSIGNED"
    CANCELLED = "CANCELLED"


class ReviewerRole(str, Enum):
    BID_MANAGER = "BID_MANAGER"
    LEGAL_COUNSEL = "LEGAL_COUNSEL"
    FINANCIAL_CONTROLLER = "FINANCIAL_CONTROLLER"
    TECHNICAL_LEAD = "TECHNICAL_LEAD"
    BID_DIRECTOR = "BID_DIRECTOR"


class ReviewUrgency(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ReviewComment(BaseModel):
    comment_id: str
    author_id: str
    author_role: str
    text: str = Field(..., min_length=1)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    tagged_clause: str | None = None


class ReviewEvidenceItem(BaseModel):
    title: str
    source_doc_id: str
    page_number: int | None = None
    clause_reference: str | None = None
    verbatim_quote: str | None = None
    company_fact: str | None = None
    conflict_note: str | None = None
    confidence_score: float | None = None


class ReviewEvidencePackage(BaseModel):
    items: list[ReviewEvidenceItem] = Field(default_factory=list)
    summary: str = ""
    trigger_reasons: list[str] = Field(default_factory=list)


class HumanReviewActionPayload(BaseModel):
    """Payload submitted by an authorized human reviewer to decide a review task."""
    action: HumanReviewDecision
    reviewer_id: str = Field(..., min_length=1)
    tenant_id: str = Field(..., min_length=1)
    reviewer_roles: list[str] = Field(default_factory=lambda: ["BID_MANAGER"])
    reviewer_permissions: list[str] = Field(default_factory=lambda: ["compliance:review"])
    notes: str | None = None
    edited_item: CandidateComplianceItem | None = None
    review_timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())

    # Concurrency control & Overrides
    expected_version: int | None = None
    override_verdict: str | None = None  # e.g. "GO", "NO_GO", "CONDITIONAL_GO"
    override_justification: str | None = None
    adjusted_readiness_score: float | None = None


class HumanReviewTask(BaseModel):
    """Represents a review task awaiting human decision (supports LangGraph and standalone workflows)."""
    task_id: str
    version: int = 1  # Optimistic Concurrency Control (OCC)
    thread_id: str = ""
    workflow_run_id: str
    tenant_id: str
    entity_type: str = "COMPLIANCE_ITEM"  # "COMPLIANCE_ITEM" | "BID_DECISION" | "REQUIREMENT"
    entity_id: str = ""
    title: str = ""
    description: str = ""

    # Scope & Context (backward compatibility for LangGraph compliance)
    bid_id: str = ""
    document_id: str = ""
    page_number: int = 1
    unverified_items: list[CandidateComplianceItem] = Field(default_factory=list)
    failure_reasons: str | None = None

    # Lifecycle & Ownership
    status: HumanReviewTaskStatus = HumanReviewTaskStatus.PENDING
    urgency: ReviewUrgency = ReviewUrgency.MEDIUM
    required_role: ReviewerRole = ReviewerRole.BID_MANAGER
    assigned_user_id: str | None = None
    claimed_by_user_id: str | None = None
    claimed_at: datetime | None = None

    # Evidence & AI Rationale
    ai_recommendation: dict[str, Any] = Field(default_factory=dict)
    evidence_package: ReviewEvidencePackage = Field(default_factory=ReviewEvidencePackage)
    comments: list[ReviewComment] = Field(default_factory=list)

    # SLA & Expiry
    expires_at: datetime | None = None
    sla_deadline: datetime | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    completed_at: datetime | None = None
    completed_by_user_id: str | None = None
    completed_by_role: str | None = None

    # Outcome & Audit Distinction
    decision: HumanReviewDecision | None = None
    is_override: bool = False
    override_justification: str | None = None
    review_notes: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


# ==============================================================================
# Domain Exceptions for Human Review
# ==============================================================================
class HumanReviewException(Exception):
    """Base exception for human review errors."""


class UnauthorizedReviewerException(HumanReviewException):
    """Raised when a user lacks required permissions or roles to review a task."""


class CrossTenantReviewException(UnauthorizedReviewerException):
    """Raised when a user attempts to review a task belonging to a different tenant."""


class ReviewTaskExpiredException(HumanReviewException):
    """Raised when a review is attempted on an expired task."""


class DuplicateReviewException(HumanReviewException):
    """Raised when a review is attempted on an already reviewed/completed task."""


class ReviewConcurrencyConflictException(HumanReviewException):
    """Raised when expected_version does not match current task version (OCC conflict)."""


class InvalidReviewActionException(HumanReviewException):
    """Raised when review action is invalid or missing required justification."""
