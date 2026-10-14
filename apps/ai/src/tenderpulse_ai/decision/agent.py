from __future__ import annotations

import datetime
import inspect
from collections.abc import Awaitable, Callable
from typing import Any

from tenderpulse_ai.decision.schemas import (
    BidDecisionRequest,
    BidDecisionResponse,
    BidDecisionVerdict,
    DecisionState,
    ReviewTriggerReason,
    ReviewTriggerType,
    RiskItem,
)
from tenderpulse_ai.decision.workflow import (
    BidDecisionWorkflowState,
    DecisionModelFn,
    DecisionWorkflowContext,
    PersistenceSinkFn,
    build_bid_decision_workflow_graph,
    default_decision_model,
)
from tenderpulse_ai.security.context import SecurityContext
from tenderpulse_ai.security.exceptions import AISecurityException


class BidDecisionAgent:
    """Bid/No-Bid Decision Intelligence Agent powered by LangGraph.

    Evaluates whether a company should pursue a tender by executing a stateful
    LangGraph workflow:
    1. Evidence Retrieval (RAG citations linking tender requirements to Company Evidence Vault)
    2. Deterministic Eligibility Evaluation (Pure arithmetic, counts, dates, presence)
    3. Commercial Risk Analysis (Timeline, EMD liquidity, liquidated damages)
    4. Review Trigger Routing (Ambiguities, confidence thresholds, conflict detection)
    5. Human Review Gate (Pause/Escalate when triggers exist)
    6. Executive Synthesis (Grounded strategic rationale without altering the verdict)

    Architectural Invariant:
    The LLM NEVER computes or alters the Bid/No-Bid verdict.
    The verdict is computed deterministically by the DeterministicEvaluationNode;
    the AI provides synthesis, explanation, and ambiguity context.
    """

    def __init__(
        self,
        model_fn: DecisionModelFn | None = None,
        persistence_sink: PersistenceSinkFn | None = None,
        checkpointer: Any | None = None,
    ) -> None:
        self.model_fn = model_fn or default_decision_model
        self.persistence_sink = persistence_sink
        self.ctx = DecisionWorkflowContext(
            model_fn=self.model_fn,
            persistence_sink=self.persistence_sink,
        )
        self.workflow_graph = build_bid_decision_workflow_graph(
            self.ctx,
            checkpointer=checkpointer,
        )

    async def evaluate(self, request: BidDecisionRequest) -> BidDecisionResponse:
        sec_ctx = request.security_context
        self._validate_security_context(sec_ctx)

        start_audit_event = {
            "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
            "tenant_id": sec_ctx.tenant_id,
            "user_id": sec_ctx.user_id,
            "workflow_run_id": sec_ctx.workflow_run_id,
            "action": "BID_DECISION_STARTED",
            "entity_type": "BidDecision",
            "entity_id": request.tender_id,
            "details": {
                "tender_id": request.tender_id,
                "company_id": request.company_profile.company_id,
                "profile_version_id": request.company_profile.profile_version_id,
                "requirements_count": len(request.requirements),
            },
        }

        initial_state: BidDecisionWorkflowState = {
            "security_context": sec_ctx,
            "tender_id": request.tender_id,
            "tender_title": request.tender_title,
            "estimated_value_inr_crores": request.estimated_value_inr_crores,
            "submission_deadline": request.submission_deadline.isoformat(),
            "project_location_state": request.project_location_state,
            "requirements": request.requirements,
            "company_profile": request.company_profile,
            "require_human_review": request.require_human_review,
            "audit_events": [start_audit_event],
        }

        thread_id = f"decision_{request.tender_id}_{sec_ctx.workflow_run_id}"
        run_config = {"configurable": {"thread_id": thread_id}}

        # Execute LangGraph stateful decision workflow
        final_state = await self.workflow_graph.ainvoke(initial_state, config=run_config)

        # Assemble Final Response
        response = BidDecisionResponse(
            tender_id=request.tender_id,
            company_id=request.company_profile.company_id,
            profile_version_id=request.company_profile.profile_version_id,
            verdict=final_state["verdict"],
            state=final_state["state"],
            readiness_score=final_state["readiness_score"],
            reasons_to_pursue=final_state["reasons_to_pursue"],
            reasons_not_to_pursue=final_state["reasons_not_to_pursue"],
            hard_disqualifiers=final_state["hard_disqualifiers"],
            missing_information=final_state["missing_information"],
            uncertain_areas=final_state["uncertain_areas"],
            commercial_risks=final_state["commercial_risks"],
            evidence_citations=final_state["evidence_citations"],
            review_triggers=final_state["review_triggers"],
            audit_events=final_state["audit_events"],
        )

        # Persistence Sink (Optional)
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
