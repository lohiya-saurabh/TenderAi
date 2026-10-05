from __future__ import annotations

import datetime
import inspect
from collections.abc import Awaitable, Callable
from typing import Any

from tenderpulse_ai.decision.evaluator import DeterministicEligibilityEvaluator
from tenderpulse_ai.decision.risks import CommercialRiskAnalyzer
from tenderpulse_ai.decision.schemas import (
    BidDecisionRequest,
    BidDecisionResponse,
    DecisionState,
)
from tenderpulse_ai.security.context import SecurityContext
from tenderpulse_ai.security.exceptions import AISecurityException

DecisionModelFn = Callable[[str, str], "str | Awaitable[str]"]
PersistenceSinkFn = Callable[[BidDecisionResponse], "Awaitable[None] | None"]


def default_decision_model(system_prompt: str, user_prompt: str) -> str:
    """Deterministic fallback explainer for test/CI and offline environments."""
    return (
        "Evaluation completed deterministically. The company profile has been verified "
        "against tender eligibility criteria, financial thresholds, past performance, "
        "certifications, and execution rules."
    )


class BidDecisionAgent:
    """Bid/No-Bid Decision Intelligence Agent.

    Evaluates whether a company should pursue a tender by synthesizing:
    1. Deterministic eligibility (thresholds, counts, dates, presence, geography)
    2. AI-assisted interpretation & narrative structuring
    3. Commercial risk analysis (timeline, EMD, liquidated damages)
    4. Human judgment boundary (AI_PROPOSED output, auditability)

    Architectural Invariant:
    The LLM NEVER computes or alters the Bid/No-Bid verdict.
    The verdict is computed deterministically by DeterministicEligibilityEvaluator;
    the AI provides synthesis, explanation, and ambiguity context.
    """

    def __init__(
        self,
        model_fn: DecisionModelFn | None = None,
        persistence_sink: PersistenceSinkFn | None = None,
    ) -> None:
        self.model_fn = model_fn or default_decision_model
        self.persistence_sink = persistence_sink

    async def evaluate(self, request: BidDecisionRequest) -> BidDecisionResponse:
        sec_ctx = request.security_context
        audit_events: list[dict[str, Any]] = []

        def record(action: str, details: dict[str, Any]) -> None:
            audit_events.append(
                {
                    "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
                    "tenant_id": sec_ctx.tenant_id,
                    "user_id": sec_ctx.user_id,
                    "workflow_run_id": sec_ctx.workflow_run_id,
                    "action": action,
                    "entity_type": "BidDecision",
                    "entity_id": request.tender_id,
                    "details": details,
                }
            )

        # 1. Security Context Validation
        self._validate_security_context(sec_ctx)
        record(
            "BID_DECISION_STARTED",
            {
                "tender_id": request.tender_id,
                "company_id": request.company_profile.company_id,
                "profile_version_id": request.company_profile.profile_version_id,
                "requirements_count": len(request.requirements),
            },
        )

        # 2. Deterministic Eligibility Evaluation (Pure, Zero Hallucination)
        outcome = DeterministicEligibilityEvaluator.evaluate(
            company=request.company_profile,
            requirements=request.requirements,
            submission_deadline=request.submission_deadline,
            project_location_state=request.project_location_state,
            estimated_value_inr_crores=request.estimated_value_inr_crores,
        )
        record(
            "DETERMINISTIC_ELIGIBILITY_EVALUATED",
            {
                "verdict": outcome.verdict.value,
                "hard_disqualifiers_count": len(outcome.hard_disqualifiers),
                "gaps_count": len(outcome.missing_information),
                "strengths_count": len(outcome.reasons_to_pursue),
            },
        )

        # 3. Commercial & Operational Risk Analysis
        commercial_risks = CommercialRiskAnalyzer.analyze(
            requirements=request.requirements,
            submission_deadline=request.submission_deadline,
            estimated_value_inr_crores=request.estimated_value_inr_crores,
        )
        record(
            "RISK_ANALYSIS_COMPLETED",
            {
                "risk_items_count": len(commercial_risks),
                "high_critical_risks": len(
                    [r for r in commercial_risks if r.severity in ("HIGH", "CRITICAL")]
                ),
            },
        )

        # If high commercial risks exist, ensure they appear in reasons not to pursue
        all_reasons_not_to_pursue = list(outcome.reasons_not_to_pursue)
        for risk in commercial_risks:
            if risk.severity in ("HIGH", "CRITICAL"):
                all_reasons_not_to_pursue.append(
                    outcome.reasons_to_pursue[0].__class__(
                        title=risk.title,
                        detail=f"{risk.detail} Mitigation: {risk.mitigation_advice}",
                        category=f"RISK_{risk.category}",
                    )
                )

        record(
            "BID_DECISION_PROPOSED",
            {
                "verdict": outcome.verdict.value,
                "readiness_score": outcome.readiness_score,
                "state": DecisionState.AI_PROPOSED.value,
            },
        )

        # 4. Assemble Final Response
        response = BidDecisionResponse(
            tender_id=request.tender_id,
            company_id=request.company_profile.company_id,
            profile_version_id=request.company_profile.profile_version_id,
            verdict=outcome.verdict,
            state=DecisionState.AI_PROPOSED,
            readiness_score=outcome.readiness_score,
            reasons_to_pursue=outcome.reasons_to_pursue,
            reasons_not_to_pursue=all_reasons_not_to_pursue,
            hard_disqualifiers=outcome.hard_disqualifiers,
            missing_information=outcome.missing_information,
            uncertain_areas=outcome.uncertain_areas,
            commercial_risks=commercial_risks,
            evidence_citations=outcome.evidence_citations,
            audit_events=audit_events,
        )

        # 5. Persistence Sink (Optional)
        if self.persistence_sink is not None:
            sink_res = self.persistence_sink(response)
            if inspect.isawaitable(sink_res):
                await sink_res

        return response

    def _validate_security_context(self, sec_ctx: SecurityContext) -> None:
        valid_purposes = {"BID_DECISION", "COMPLIANCE_EXTRACTION"}
        if sec_ctx.purpose not in valid_purposes:
            raise AISecurityException(
                f"Security context purpose '{sec_ctx.purpose}' is not authorized for Bid/No-Bid decisioning."
            )
        if not sec_ctx.tenant_id or not sec_ctx.user_id:
            raise AISecurityException("Security context must specify tenant_id and user_id.")
