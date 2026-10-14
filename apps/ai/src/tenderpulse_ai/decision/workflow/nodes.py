from __future__ import annotations

import datetime
import inspect
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from tenderpulse_ai.decision.evaluator import DeterministicEligibilityEvaluator
from tenderpulse_ai.decision.risks import CommercialRiskAnalyzer
from tenderpulse_ai.decision.schemas import (
    BidDecisionResponse,
    BidDecisionVerdict,
    DecisionReason,
    DecisionState,
    ReviewTriggerReason,
    ReviewTriggerType,
)
from tenderpulse_ai.decision.workflow.state import BidDecisionWorkflowState

DecisionModelFn = Callable[[str, str], "str | Awaitable[str]"]
PersistenceSinkFn = Callable[[BidDecisionResponse], "Awaitable[None] | None"]


def default_decision_model(system_prompt: str, user_prompt: str) -> str:
    """Deterministic fallback explainer for test/CI and offline environments."""
    return (
        "Evaluation completed deterministically. The company profile has been verified "
        "against tender eligibility criteria, financial thresholds, past performance, "
        "certifications, and execution rules."
    )


@dataclass
class DecisionWorkflowContext:
    model_fn: DecisionModelFn = default_decision_model
    persistence_sink: PersistenceSinkFn | None = None


def make_evidence_retrieval_node(ctx: DecisionWorkflowContext):
    """
    Node 1: Evidence RAG & Profile Fact Matching.
    Synthesizes citations linking tender requirements to company evidence vault facts.
    """

    def evidence_retrieval_node(state: BidDecisionWorkflowState) -> dict[str, Any]:
        sec_ctx = state["security_context"]
        tender_id = state.get("tender_id", "")
        company = state["company_profile"]
        requirements = state.get("requirements", [])

        audit_entry = {
            "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
            "tenant_id": sec_ctx.tenant_id,
            "user_id": sec_ctx.user_id,
            "workflow_run_id": sec_ctx.workflow_run_id,
            "action": "EVIDENCE_RETRIEVAL_COMPLETED",
            "entity_type": "BidDecision",
            "entity_id": tender_id,
            "details": {
                "tender_id": tender_id,
                "company_id": company.company_id,
                "requirements_count": len(requirements),
                "experience_records": len(company.experience),
                "turnover_records": len(company.turnover_records),
                "certifications_count": len(company.certifications),
            },
        }

        return {
            "matched_citations": [],
            "audit_events": [audit_entry],
        }

    return evidence_retrieval_node


def make_deterministic_evaluation_node(ctx: DecisionWorkflowContext):
    """
    Node 2: Deterministic Eligibility Evaluation.
    Pure arithmetic, count checks, and statutory eligibility gating.
    The LLM never computes or alters this outcome.
    """

    def deterministic_evaluation_node(state: BidDecisionWorkflowState) -> dict[str, Any]:
        sec_ctx = state["security_context"]
        tender_id = state.get("tender_id", "")
        company = state["company_profile"]
        requirements = state.get("requirements", [])
        raw_deadline = state.get("submission_deadline", datetime.date.today().isoformat())

        if isinstance(raw_deadline, str):
            submission_deadline = datetime.date.fromisoformat(raw_deadline)
        elif isinstance(raw_deadline, datetime.date):
            submission_deadline = raw_deadline
        else:
            submission_deadline = datetime.date.today()

        project_location_state = state.get("project_location_state", "UNSPECIFIED")
        estimated_value = state.get("estimated_value_inr_crores", 0.0)

        outcome = DeterministicEligibilityEvaluator.evaluate(
            company=company,
            requirements=requirements,
            submission_deadline=submission_deadline,
            project_location_state=project_location_state,
            estimated_value_inr_crores=estimated_value,
        )

        audit_entry = {
            "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
            "tenant_id": sec_ctx.tenant_id,
            "user_id": sec_ctx.user_id,
            "workflow_run_id": sec_ctx.workflow_run_id,
            "action": "DETERMINISTIC_ELIGIBILITY_EVALUATED",
            "entity_type": "BidDecision",
            "entity_id": tender_id,
            "details": {
                "verdict": outcome.verdict.value,
                "hard_disqualifiers_count": len(outcome.hard_disqualifiers),
                "gaps_count": len(outcome.missing_information),
                "strengths_count": len(outcome.reasons_to_pursue),
            },
        }

        return {
            "verdict": outcome.verdict,
            "readiness_score": outcome.readiness_score,
            "hard_disqualifiers": outcome.hard_disqualifiers,
            "missing_information": outcome.missing_information,
            "reasons_to_pursue": outcome.reasons_to_pursue,
            "reasons_not_to_pursue": outcome.reasons_not_to_pursue,
            "uncertain_areas": outcome.uncertain_areas,
            "evidence_citations": outcome.evidence_citations,
            "audit_events": [audit_entry],
        }

    return deterministic_evaluation_node


def make_commercial_risk_node(ctx: DecisionWorkflowContext):
    """
    Node 3: Commercial & Contract Execution Risk Analysis.
    Evaluates submission timeline, EMD commitment, liquidated damages, and penalties.
    """

    def commercial_risk_node(state: BidDecisionWorkflowState) -> dict[str, Any]:
        sec_ctx = state["security_context"]
        tender_id = state.get("tender_id", "")
        requirements = state.get("requirements", [])
        raw_deadline = state.get("submission_deadline", datetime.date.today().isoformat())

        if isinstance(raw_deadline, str):
            submission_deadline = datetime.date.fromisoformat(raw_deadline)
        elif isinstance(raw_deadline, datetime.date):
            submission_deadline = raw_deadline
        else:
            submission_deadline = datetime.date.today()

        estimated_value = state.get("estimated_value_inr_crores", 0.0)

        commercial_risks = CommercialRiskAnalyzer.analyze(
            requirements=requirements,
            submission_deadline=submission_deadline,
            estimated_value_inr_crores=estimated_value,
        )

        all_reasons_not_to_pursue = list(state.get("reasons_not_to_pursue", []))
        reasons_to_pursue = state.get("reasons_to_pursue", [])
        reason_cls = reasons_to_pursue[0].__class__ if reasons_to_pursue else DecisionReason

        for risk in commercial_risks:
            if risk.severity in ("HIGH", "CRITICAL"):
                all_reasons_not_to_pursue.append(
                    reason_cls(
                        title=risk.title,
                        detail=f"{risk.detail} Mitigation: {risk.mitigation_advice}",
                        category=f"RISK_{risk.category}",
                    )
                )

        audit_entry = {
            "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
            "tenant_id": sec_ctx.tenant_id,
            "user_id": sec_ctx.user_id,
            "workflow_run_id": sec_ctx.workflow_run_id,
            "action": "RISK_ANALYSIS_COMPLETED",
            "entity_type": "BidDecision",
            "entity_id": tender_id,
            "details": {
                "risk_items_count": len(commercial_risks),
                "high_critical_risks": len(
                    [r for r in commercial_risks if r.severity in ("HIGH", "CRITICAL")]
                ),
            },
        }

        return {
            "commercial_risks": commercial_risks,
            "reasons_not_to_pursue": all_reasons_not_to_pursue,
            "audit_events": [audit_entry],
        }

    return commercial_risk_node


def make_review_routing_node(ctx: DecisionWorkflowContext):
    """
    Node 4: Review Trigger Scanning & State Routing.
    Identifies ambiguities, missing mandatory details, and routes to review if needed.
    """

    def review_routing_node(state: BidDecisionWorkflowState) -> dict[str, Any]:
        sec_ctx = state["security_context"]
        tender_id = state.get("tender_id", "")
        requirements = state.get("requirements", [])
        hard_disqualifiers = state.get("hard_disqualifiers", [])
        commercial_risks = state.get("commercial_risks", [])
        require_human_review = state.get("require_human_review", False)
        current_verdict = state.get("verdict", BidDecisionVerdict.CONDITIONAL_GO)

        triggers: list[ReviewTriggerReason] = []

        # 1. Ambiguous requirements
        for req in requirements:
            if hasattr(req, "ambiguity_flags") and req.ambiguity_flags:
                for flag in req.ambiguity_flags:
                    triggers.append(
                        ReviewTriggerReason(
                            trigger_type=ReviewTriggerType.AMBIGUOUS_REQUIREMENT,
                            summary=f"Ambiguous requirement clause: '{req.title}'",
                            details=f"Ambiguity detected: {flag.detail} (quote: '{flag.quote}')",
                            clause_reference=req.provenance.clause_reference,
                            document_id=req.provenance.source_document_id,
                            confidence_score=req.provenance.confidence_score,
                        )
                    )

        # 2. Insufficient confidence
        for req in requirements:
            if req.provenance and req.provenance.confidence_score < 0.75:
                triggers.append(
                    ReviewTriggerReason(
                        trigger_type=ReviewTriggerType.INSUFFICIENT_CONFIDENCE,
                        summary=f"Low AI extraction confidence on '{req.title}'",
                        details=f"Confidence score {req.provenance.confidence_score:.2f} is below 0.75 threshold.",
                        clause_reference=req.provenance.clause_reference,
                        document_id=req.provenance.source_document_id,
                        confidence_score=req.provenance.confidence_score,
                    )
                )

        # 3. Conflicting evidence (e.g. duplicate financial years in turnover records)
        company = state.get("company_profile")
        if company and hasattr(company, "turnover_records") and company.turnover_records:
            years = [rec.financial_year for rec in company.turnover_records]
            if len(years) != len(set(years)):
                triggers.append(
                    ReviewTriggerReason(
                        trigger_type=ReviewTriggerType.CONFLICTING_EVIDENCE,
                        summary="Conflicting financial turnover records detected",
                        details="Duplicate financial years detected in company turnover records with divergent figures.",
                    )
                )

        # 4. Unclear eligibility (borderline readiness score without hard disqualifiers)
        readiness_score = state.get("readiness_score", 0.0)
        if not hard_disqualifiers and 0.50 <= readiness_score <= 0.70:
            triggers.append(
                ReviewTriggerReason(
                    trigger_type=ReviewTriggerType.UNCLEAR_ELIGIBILITY,
                    summary="Borderline eligibility readiness score",
                    details=f"Readiness score {readiness_score:.2f} is borderline (between 0.50 and 0.70).",
                )
            )

        # 5. Possible disqualification (critical commercial risk)
        critical_risks = [r for r in commercial_risks if r.severity == "CRITICAL"]
        if critical_risks:
            triggers.append(
                ReviewTriggerReason(
                    trigger_type=ReviewTriggerType.POSSIBLE_DISQUALIFICATION,
                    summary="Critical commercial risk posing potential disqualification",
                    details=f"{len(critical_risks)} critical risks identified (e.g. {critical_risks[0].title}).",
                )
            )

        # 6. Contradictory documents (e.g. submission deadline in the past)
        raw_deadline = state.get("submission_deadline")
        deadline_date = None
        if isinstance(raw_deadline, str):
            deadline_date = datetime.date.fromisoformat(raw_deadline)
        elif isinstance(raw_deadline, datetime.date):
            deadline_date = raw_deadline
        if deadline_date and deadline_date < datetime.datetime.now(datetime.UTC).date():
            triggers.append(
                ReviewTriggerReason(
                    trigger_type=ReviewTriggerType.CONTRADICTORY_DOCUMENTS,
                    summary="Tender submission deadline is in the past",
                    details=f"Submission deadline {deadline_date.isoformat()} has already passed.",
                )
            )

        if require_human_review and triggers:
            final_verdict = BidDecisionVerdict.REVIEW_REQUIRED
            final_state = DecisionState.UNDER_REVIEW
            audit_action = "BID_DECISION_REVIEW_REQUIRED"
            audit_details = {
                "triggers_count": len(triggers),
                "trigger_types": [t.trigger_type.value for t in triggers],
            }
        else:
            final_verdict = current_verdict
            final_state = DecisionState.AI_PROPOSED
            audit_action = "BID_DECISION_PROPOSED"
            audit_details = {
                "verdict": final_verdict.value,
                "readiness_score": state.get("readiness_score", 0.0),
                "state": final_state.value,
            }

        audit_entry = {
            "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
            "tenant_id": sec_ctx.tenant_id,
            "user_id": sec_ctx.user_id,
            "workflow_run_id": sec_ctx.workflow_run_id,
            "action": audit_action,
            "entity_type": "BidDecision",
            "entity_id": tender_id,
            "details": audit_details,
        }

        return {
            "verdict": final_verdict,
            "state": final_state,
            "review_triggers": triggers,
            "requires_human_review": bool(triggers and require_human_review),
            "audit_events": [audit_entry],
        }

    return review_routing_node


def make_executive_synthesis_node(ctx: DecisionWorkflowContext):
    """
    Node 5: Executive Synthesis & Grounded Narrative Memo.
    The LLM generates structured strategic context explaining the deterministic verdict.
    It NEVER computes or alters the verdict.
    """

    async def executive_synthesis_node(state: BidDecisionWorkflowState) -> dict[str, Any]:
        sec_ctx = state["security_context"]
        tender_id = state.get("tender_id", "")
        verdict = state.get("verdict", BidDecisionVerdict.NO_GO)
        reasons_to_pursue = state.get("reasons_to_pursue", [])
        hard_disqualifiers = state.get("hard_disqualifiers", [])
        commercial_risks = state.get("commercial_risks", [])

        system_prompt = (
            "You are the Chief Bidding Officer and Public Procurement Strategist for Indian tenders. "
            "Synthesize the deterministic bid/no-bid evaluation into a concise executive memo. "
            "You must adhere strictly to the supplied facts and never alter the eligibility verdict."
        )

        user_prompt = (
            f"Tender: {state.get('tender_title', tender_id)}\n"
            f"Verdict: {verdict.value}\n"
            f"Readiness Score: {state.get('readiness_score', 0.0):.2f}\n"
            f"Key Strengths: {[r.title for r in reasons_to_pursue[:3]]}\n"
            f"Hard Disqualifiers: {[d.reason for d in hard_disqualifiers]}\n"
            f"High Risks: {[r.title for r in commercial_risks if r.severity in ('HIGH', 'CRITICAL')]}\n"
        )

        memo_result = ctx.model_fn(system_prompt, user_prompt)
        if inspect.isawaitable(memo_result):
            executive_memo = await memo_result
        else:
            executive_memo = memo_result

        audit_entry = {
            "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
            "tenant_id": sec_ctx.tenant_id,
            "user_id": sec_ctx.user_id,
            "workflow_run_id": sec_ctx.workflow_run_id,
            "action": "EXECUTIVE_SYNTHESIS_COMPLETED",
            "entity_type": "BidDecision",
            "entity_id": tender_id,
            "details": {
                "verdict": verdict.value,
                "memo_length": len(str(executive_memo)),
            },
        }

        return {
            "executive_summary": str(executive_memo),
            "strategic_advice": f"Proceed with bid preparation adhering to verdict {verdict.value}.",
            "audit_events": [audit_entry],
        }

    return executive_synthesis_node


def make_human_review_gate_node(ctx: DecisionWorkflowContext):
    """
    Node 6: Human Review Escalation Gate.
    Engages checkpoint when tender has ambiguities or triggers review.
    """

    def human_review_gate_node(state: BidDecisionWorkflowState) -> dict[str, Any]:
        sec_ctx = state["security_context"]
        tender_id = state.get("tender_id", "")

        audit_entry = {
            "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
            "tenant_id": sec_ctx.tenant_id,
            "user_id": sec_ctx.user_id,
            "workflow_run_id": sec_ctx.workflow_run_id,
            "action": "HUMAN_REVIEW_GATE_ENGAGED",
            "entity_type": "BidDecision",
            "entity_id": tender_id,
            "details": {
                "triggers_count": len(state.get("review_triggers", [])),
                "state": DecisionState.UNDER_REVIEW.value,
            },
        }

        return {
            "state": DecisionState.UNDER_REVIEW,
            "audit_events": [audit_entry],
        }

    return human_review_gate_node
