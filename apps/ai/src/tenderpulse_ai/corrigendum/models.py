from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ChangeType(str, Enum):
    MODIFICATION = "MODIFICATION"
    ADDITION = "ADDITION"
    DELETION = "DELETION"
    DEADLINE_CHANGE = "DEADLINE_CHANGE"
    CLARIFICATION = "CLARIFICATION"


class DriftSeverity(str, Enum):
    CRITICAL = "CRITICAL"  # Affects hard eligibility (disqualification risk)
    HIGH = "HIGH"  # Changes dates/EMD/stamp paper
    MEDIUM = "MEDIUM"  # Moderate procedural adjustment
    LOW = "LOW"  # Non-binding clarification


class ClauseChange(BaseModel):
    change_id: str
    clause_reference: str
    change_type: ChangeType
    category: str = Field(default="GENERAL")
    original_text: str | None = None
    amended_text: str
    extracted_delta: dict[str, Any] = Field(default_factory=dict)
    severity: DriftSeverity = DriftSeverity.MEDIUM
    verbatim_quote: str


class CorrigendumImpactReport(BaseModel):
    tender_id: str
    corrigendum_id: str
    corrigendum_number: int = 1
    issue_date: str
    changes: list[ClauseChange] = Field(default_factory=list)
    overall_impact: str = "NEUTRAL"  # FAVORABLE | ADVERSE | NEUTRAL
    requires_decision_reevaluation: bool = False
    affected_categories: list[str] = Field(default_factory=list)
    action_items: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
