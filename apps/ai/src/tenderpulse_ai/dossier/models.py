import operator
from enum import Enum
from typing import Annotated, Any, TypedDict
from pydantic import BaseModel, Field

from tenderpulse_ai.security.context import SecurityContext


class SpecialistDomain(str, Enum):
    TECHNICAL = "TECHNICAL"
    STATUTORY_LEGAL = "STATUTORY_LEGAL"
    COMMERCIAL_FINANCE = "COMMERCIAL_FINANCE"


class SpecialistVerdict(str, Enum):
    QUALIFIED = "QUALIFIED"
    CONDITIONAL = "CONDITIONAL"
    DISQUALIFIED = "DISQUALIFIED"


class SpecialistAppraisal(BaseModel):
    specialist_id: str
    domain: SpecialistDomain
    verdict: SpecialistVerdict
    confidence_score: float = Field(default=1.0, ge=0.0, le=1.0)
    hard_disqualifiers: list[str] = Field(default_factory=list)
    action_items: list[str] = Field(default_factory=list)
    citations: list[str] = Field(default_factory=list)
    narrative_summary: str = ""


class ExecutiveBidDossier(BaseModel):
    dossier_id: str
    tender_id: str
    tender_title: str
    overall_verdict: str  # GO, CONDITIONAL_GO, NO_GO
    composite_readiness_score: float
    specialist_appraisals: dict[str, SpecialistAppraisal]
    hard_disqualifiers: list[str] = Field(default_factory=list)
    critical_action_items: list[str] = Field(default_factory=list)
    director_synthesis: str = ""
    audit_trail: list[dict[str, Any]] = Field(default_factory=list)


class DossierWorkflowState(TypedDict, total=False):
    """
    Central typed state for the Multi-Agent Collaborative Dossier LangGraph.
    Appraisals and audit events accumulate across specialist agent nodes via operator.add.
    """
    security_context: SecurityContext
    tender_id: str
    tender_title: str
    tender_criteria: dict[str, Any]
    company_profile: dict[str, Any]

    # Specialist Agent Outputs (accumulated via operator.add)
    appraisals: Annotated[list[SpecialistAppraisal], operator.add]
    
    # Executive Director Synthesis Outcome
    dossier: ExecutiveBidDossier
    audit_events: Annotated[list[dict[str, Any]], operator.add]
