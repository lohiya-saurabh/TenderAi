from __future__ import annotations

import operator
from typing import Annotated, Any, Literal, TypedDict

from tenderpulse_ai.agent.schemas import RequirementCandidate
from tenderpulse_ai.decision.schemas import (
    BidDecisionVerdict,
    CompanyProfileSnapshot,
    DecisionReason,
    DecisionState,
    Disqualifier,
    EvidenceCitation,
    GapItem,
    ReviewTriggerReason,
    RiskItem,
    UncertaintyItem,
)
from tenderpulse_ai.security.context import SecurityContext


class BidDecisionWorkflowState(TypedDict, total=False):
    """
    Central typed state for the LangGraph Bid/No-Bid Decision Intelligence Graph.
    
    Architectural Invariant:
    The verdict and eligibility criteria are computed strictly by deterministic
    evaluators; the LLM nodes only provide evidence synthesis, strategic rationale,
    and explanation grounded in structured facts.
    """
    # 1. Inputs & Security Context
    security_context: SecurityContext
    tender_id: str
    tender_title: str
    estimated_value_inr_crores: float
    submission_deadline: str
    project_location_state: str
    requirements: list[RequirementCandidate]
    company_profile: CompanyProfileSnapshot
    require_human_review: bool

    # 2. Node 1: Evidence RAG & Retrieval Citations
    matched_citations: list[EvidenceCitation]
    missing_evidence_requirements: list[RequirementCandidate]

    # 3. Node 2: Deterministic Evaluation Outcome
    verdict: BidDecisionVerdict
    state: DecisionState
    readiness_score: float
    hard_disqualifiers: list[Disqualifier]
    missing_information: list[GapItem]
    reasons_to_pursue: list[DecisionReason]
    reasons_not_to_pursue: list[DecisionReason]
    uncertain_areas: list[UncertaintyItem]
    evidence_citations: list[EvidenceCitation]

    # 4. Node 3: Commercial Risk Analysis
    commercial_risks: list[RiskItem]

    # 5. Node 4: Review Trigger Detection & Routing
    review_triggers: list[ReviewTriggerReason]
    requires_human_review: bool

    # 6. Node 5: Executive Synthesis & Narrative
    executive_summary: str
    strategic_advice: str

    # 7. Audit Ledger (Accumulated immutably across graph execution)
    audit_events: Annotated[list[dict[str, Any]], operator.add]
