from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

from tenderpulse_ai.agent.schemas import RequirementCandidate
from tenderpulse_ai.security.context import SecurityContext

# ------------------------------------------------------------------ Decision Enums


class BidDecisionVerdict(str, Enum):
    GO = "GO"
    CONDITIONAL_GO = "CONDITIONAL_GO"
    NO_GO = "NO_GO"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"


class ReviewTriggerType(str, Enum):
    AMBIGUOUS_REQUIREMENT = "AMBIGUOUS_REQUIREMENT"
    CONFLICTING_EVIDENCE = "CONFLICTING_EVIDENCE"
    UNCLEAR_ELIGIBILITY = "UNCLEAR_ELIGIBILITY"
    INSUFFICIENT_CONFIDENCE = "INSUFFICIENT_CONFIDENCE"
    POSSIBLE_DISQUALIFICATION = "POSSIBLE_DISQUALIFICATION"
    CONTRADICTORY_DOCUMENTS = "CONTRADICTORY_DOCUMENTS"


class ReviewTriggerReason(BaseModel):
    trigger_type: ReviewTriggerType
    summary: str
    details: str
    clause_reference: str | None = None
    document_id: str | None = None
    confidence_score: float | None = None


class DecisionState(str, Enum):
    AI_PROPOSED = "AI_PROPOSED"
    UNDER_REVIEW = "UNDER_REVIEW"
    CONFIRMED = "CONFIRMED"
    OVERRIDDEN = "OVERRIDDEN"


class CriterionState(str, Enum):
    SATISFIED = "SATISFIED"
    SHORTFALL = "SHORTFALL"
    MISSING = "MISSING"
    EXPIRED = "EXPIRED"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class RiskSeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


# ------------------------------------------------------------------ Company Profile Snapshot


class ExperienceEntry(BaseModel):
    entry_id: str = Field(..., min_length=1)
    project_name: str = Field(..., min_length=1)
    client_name: str = Field(..., min_length=1)
    contract_value_inr_crores: float = Field(..., ge=0)
    completion_date: date
    work_type_tags: list[str] = Field(default_factory=list)
    location_state: str = Field(..., min_length=1)
    evidence_document_id: str = Field(..., min_length=1)


class CertificationEntry(BaseModel):
    entry_id: str = Field(..., min_length=1)
    standard_name: str = Field(..., min_length=1)  # e.g., "ISO 9001", "ISO 14001", "CMMI Level 3"
    issuing_body: str = Field(..., min_length=1)
    valid_from: date
    valid_to: date | None = None  # None indicates open-ended
    evidence_document_id: str = Field(..., min_length=1)


class OemAuthEntry(BaseModel):
    entry_id: str = Field(..., min_length=1)
    oem_name: str = Field(..., min_length=1)
    product_lines: list[str] = Field(default_factory=list)
    valid_from: date
    valid_to: date
    evidence_document_id: str = Field(..., min_length=1)


class StaffEntry(BaseModel):
    entry_id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    role: str = Field(..., min_length=1)  # e.g. "Project Manager", "Safety Officer", "Civil Engineer"
    qualification: str = Field(..., min_length=1)
    experience_years: int = Field(..., ge=0)
    evidence_document_id: str = Field(..., min_length=1)


class EquipmentEntry(BaseModel):
    entry_id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)  # e.g., "Transit Mixer", "Batching Plant", "Tower Crane"
    equipment_type: str = Field(..., min_length=1)
    quantity: int = Field(..., ge=1)
    owned: bool = True
    evidence_document_id: str = Field(..., min_length=1)


class FinancialTurnover(BaseModel):
    financial_year: str = Field(..., min_length=4)  # e.g., "FY24"
    turnover_inr_crores: float = Field(..., ge=0)
    ca_udin: str | None = None
    evidence_document_id: str = Field(..., min_length=1)


class CompanyProfileSnapshot(BaseModel):
    """Pinned, immutable company capability snapshot used for evaluation."""

    company_id: str = Field(..., min_length=1)
    company_name: str = Field(..., min_length=1)
    profile_version_id: str = Field(..., min_length=1)
    is_active: bool = True

    # Factor 1: General Registrations
    registrations: dict[str, str] = Field(
        default_factory=dict, description="e.g. {'GSTIN': '...', 'PAN': '...', 'UDYAM': '...'}"
    )
    is_blacklisted: bool = False

    # Factor 2: Financial Turnover
    turnover_records: list[FinancialTurnover] = Field(default_factory=list)

    # Factor 3: Past Project Experience
    experience: list[ExperienceEntry] = Field(default_factory=list)

    # Factor 4: Geographic Capability
    operating_regions: list[str] = Field(
        default_factory=list, description="States/UTs where company has operational presence"
    )

    # Factor 5: Certifications
    certifications: list[CertificationEntry] = Field(default_factory=list)

    # Factor 6: OEM Authorizations
    oem_authorizations: list[OemAuthEntry] = Field(default_factory=list)

    # Factor 7: Key Personnel / Staffing
    staff: list[StaffEntry] = Field(default_factory=list)

    # Factor 8: Equipment & Machinery
    equipment: list[EquipmentEntry] = Field(default_factory=list)


# ------------------------------------------------------------------ Decision Components


class EvidenceCitation(BaseModel):
    """Dual-provenance link: connects tender clause to company capability evidence."""

    tender_requirement_title: str
    tender_clause_reference: str
    tender_page_number: int
    tender_verbatim_quote: str
    company_evidence_ref: str | None = None
    company_entry_id: str | None = None
    notes: str = ""


class DecisionReason(BaseModel):
    title: str = Field(..., min_length=1)
    detail: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1)
    evidence: EvidenceCitation | None = None


class Disqualifier(BaseModel):
    requirement_title: str
    reason: str
    clause_reference: str
    shortfall_detail: str
    evidence: EvidenceCitation


class GapItem(BaseModel):
    requirement_title: str
    missing_factor: str
    suggested_action: str
    severity: RiskSeverity
    deadline_date: date | None = None
    evidence: EvidenceCitation | None = None


class UncertaintyItem(BaseModel):
    clause_reference: str
    ambiguity_type: str
    quote: str
    recommended_clarification: str


class RiskItem(BaseModel):
    title: str
    severity: RiskSeverity
    category: str  # COMMERCIAL, LIQUIDATED_DAMAGES, TIMELINE, PAYMENT_TERMS
    detail: str
    mitigation_advice: str


# ------------------------------------------------------------------ Request & Response


class BidDecisionRequest(BaseModel):
    security_context: SecurityContext
    tender_id: str = Field(..., min_length=1)
    tender_title: str = Field(..., min_length=1)
    estimated_value_inr_crores: float = Field(..., ge=0)
    submission_deadline: date
    project_location_state: str = Field(..., min_length=1)
    requirements: list[RequirementCandidate] = Field(default_factory=list)
    company_profile: CompanyProfileSnapshot
    require_human_review: bool = False


class BidDecisionResponse(BaseModel):
    tender_id: str
    company_id: str
    profile_version_id: str
    verdict: BidDecisionVerdict
    state: DecisionState = DecisionState.AI_PROPOSED
    readiness_score: float = Field(..., ge=0.0, le=1.0)
    reasons_to_pursue: list[DecisionReason] = Field(default_factory=list)
    reasons_not_to_pursue: list[DecisionReason] = Field(default_factory=list)
    hard_disqualifiers: list[Disqualifier] = Field(default_factory=list)
    missing_information: list[GapItem] = Field(default_factory=list)
    uncertain_areas: list[UncertaintyItem] = Field(default_factory=list)
    commercial_risks: list[RiskItem] = Field(default_factory=list)
    evidence_citations: list[EvidenceCitation] = Field(default_factory=list)
    review_triggers: list[ReviewTriggerReason] = Field(default_factory=list)
    audit_events: list[dict[str, Any]] = Field(default_factory=list)
    error: str | None = None
