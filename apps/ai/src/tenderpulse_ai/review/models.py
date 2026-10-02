from datetime import UTC, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

from tenderpulse_ai.domain.models import CandidateComplianceItem


class HumanReviewDecision(str, Enum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    EDIT = "EDIT"


class HumanReviewTaskStatus(str, Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    EXPIRED = "EXPIRED"
    REASSIGNED = "REASSIGNED"


class HumanReviewActionPayload(BaseModel):
    """Payload submitted by an authorized human reviewer to resume a paused LangGraph workflow."""
    action: HumanReviewDecision
    reviewer_id: str = Field(..., min_length=1)
    tenant_id: str = Field(..., min_length=1)
    reviewer_roles: list[str] = Field(default_factory=lambda: ["BID_MANAGER"])
    reviewer_permissions: list[str] = Field(default_factory=lambda: ["compliance:review"])
    notes: str | None = None
    edited_item: CandidateComplianceItem | None = None
    review_timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class HumanReviewTask(BaseModel):
    """Represents a paused workflow checkpoint awaiting human review."""
    task_id: str
    thread_id: str
    workflow_run_id: str
    tenant_id: str
    bid_id: str
    document_id: str
    page_number: int
    unverified_items: list[CandidateComplianceItem]
    failure_reasons: str | None = None
    status: HumanReviewTaskStatus = HumanReviewTaskStatus.PENDING
    assigned_user_id: str | None = None
    expires_at: datetime | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    completed_at: datetime | None = None
    completed_by_user_id: str | None = None
    decision: HumanReviewDecision | None = None
    review_notes: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


# ==============================================================================
# Domain Exceptions for Human Review
# ==============================================================================
class HumanReviewException(Exception):
    """Base exception for human review errors."""


class UnauthorizedReviewerException(HumanReviewException):
    """Raised when a user lacks required permissions to review a compliance item."""


class CrossTenantReviewException(UnauthorizedReviewerException):
    """Raised when a user attempts to review a task belonging to a different tenant."""


class ReviewTaskExpiredException(HumanReviewException):
    """Raised when a review is attempted on an expired task."""


class DuplicateReviewException(HumanReviewException):
    """Raised when a review is attempted on an already reviewed/completed task."""
