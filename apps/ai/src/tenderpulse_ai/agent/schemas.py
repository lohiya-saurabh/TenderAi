from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

from tenderpulse_ai.domain.models import ExecutionRulesProps, ProvenanceProps
from tenderpulse_ai.security.context import SecurityContext


class RequirementKind(str, Enum):
    ELIGIBILITY_THRESHOLD = "ELIGIBILITY_THRESHOLD"
    DOCUMENT_SUBMISSION = "DOCUMENT_SUBMISSION"
    DECLARATION = "DECLARATION"
    FORMAT = "FORMAT"
    COMMERCIAL_TERM = "COMMERCIAL_TERM"
    STATUTORY = "STATUTORY"


class RequirementCriticality(str, Enum):
    HARD_ELIGIBILITY = "HARD_ELIGIBILITY"
    SUBMISSION_MANDATORY = "SUBMISSION_MANDATORY"
    INFORMATIONAL = "INFORMATIONAL"


class CriterionProps(BaseModel):
    """Normalized structured criterion. None when the clause is not expressible."""

    type: str = Field(..., min_length=1)  # TURNOVER | EXPERIENCE_COUNT | CERTIFICATION | ...
    operator: str = Field(..., min_length=1)  # GTE | LTE | EQ | MEMBERSHIP | PRESENCE
    threshold: float | None = None
    unit: str | None = None
    window: str | None = None  # lookback window, e.g. "FY22-25"


class AmbiguityType(str, Enum):
    VAGUE_QUANTIFIER = "VAGUE_QUANTIFIER"
    MISSING_THRESHOLD = "MISSING_THRESHOLD"
    MISSING_DATE = "MISSING_DATE"
    NUMERIC_CONFLICT = "NUMERIC_CONFLICT"
    UNDEFINED_TERM = "UNDEFINED_TERM"
    MISSING_SIGNATORY = "MISSING_SIGNATORY"


class AmbiguityFlag(BaseModel):
    """First-class ambiguity report. The agent reports ambiguity; it never resolves it."""

    type: AmbiguityType
    detail: str = Field(..., min_length=1)
    quote: str = Field(..., min_length=1)  # the ambiguous fragment (verbatim)


class RequirementCandidate(BaseModel):
    """One normalized tender requirement with full source citation."""

    category: str = Field(..., min_length=1)
    kind: RequirementKind
    criticality: RequirementCriticality
    title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    criterion: CriterionProps | None = None
    execution_rules: ExecutionRulesProps = Field(default_factory=ExecutionRulesProps)
    provenance: ProvenanceProps
    ambiguity_flags: list[AmbiguityFlag] = Field(default_factory=list)


class RejectedCandidate(BaseModel):
    """A candidate that failed deterministic validation, with the reason. Never persisted as truth."""

    title: str
    reason: str = Field(..., min_length=1)
    provenance: ProvenanceProps | None = None


class AgentStats(BaseModel):
    pages_analyzed: int = 0
    chunks_retrieved: int = 0
    model_calls: int = 0
    refinement_passes: int = 0
    candidates_extracted: int = 0
    candidates_verified: int = 0
    candidates_rejected: int = 0
    ambiguities_detected: int = 0


class AgentStatus(str, Enum):
    COMPLETED = "COMPLETED"
    COMPLETED_WITH_AMBIGUITY = "COMPLETED_WITH_AMBIGUITY"
    COMPLETED_EMPTY = "COMPLETED_EMPTY"
    FAILED = "FAILED"


class AgentOutput(BaseModel):
    bid_id: str
    document_id: str
    status: AgentStatus
    requirements: list[RequirementCandidate] = Field(default_factory=list)
    unverified: list[RejectedCandidate] = Field(default_factory=list)
    ambiguities: list[AmbiguityFlag] = Field(default_factory=list)
    stats: AgentStats
    audit_events: list[dict[str, Any]] = Field(default_factory=list)
    error: str | None = None


class AgentPageInput(BaseModel):
    page_number: int = Field(..., ge=1)
    text: str = Field(..., min_length=1)


class AgentInput(BaseModel):
    security_context: SecurityContext
    bid_id: str = Field(..., min_length=1)
    document_id: str = Field(..., min_length=1)
    file_name: str = Field(..., min_length=1)
    pages: list[AgentPageInput] = Field(..., min_length=1)
