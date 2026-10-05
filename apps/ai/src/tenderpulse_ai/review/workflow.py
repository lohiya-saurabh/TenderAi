from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from tenderpulse_ai.decision.schemas import (
    BidDecisionRequest,
    BidDecisionResponse,
    BidDecisionVerdict,
    DecisionState,
    ReviewTriggerType,
)
from tenderpulse_ai.review.manager import HumanReviewManager
from tenderpulse_ai.review.models import (
    HumanReviewActionPayload,
    HumanReviewDecision,
    HumanReviewTask,
    ReviewerRole,
    ReviewEvidenceItem,
    ReviewEvidencePackage,
    ReviewUrgency,
)


class HumanInTheLoopWorkflow:
    """
    Orchestrates the Human-in-the-Loop review lifecycle as a first-class business capability:
    1. AI Output (REVIEW_REQUIRED / ambiguous / low confidence / possible disqualification)
    2. Review Task Generation with structured Evidence Package & SLA Deadline
    3. Reviewer Role Assignment & Claiming (Optimistic Concurrency Control)
    4. Multi-comment Collaborative Threading & Escalation
    5. Human Decision (Strictly distinguishable Confirmation vs Override with mandatory justification)
    6. Audit Trail Recording
    7. Workflow Continuation & State Transition
    """

    def __init__(self, review_manager: HumanReviewManager | None = None) -> None:
        self.review_manager = review_manager or HumanReviewManager()

    def create_review_task_for_bid_decision(
        self,
        decision: BidDecisionResponse,
        request: BidDecisionRequest,
        urgency: ReviewUrgency | None = None,
    ) -> HumanReviewTask:
        """
        Creates an audit-ready HumanReviewTask from a BidDecisionResponse that triggered REVIEW_REQUIRED.
        Extracts evidence visibility package and determines suitable reviewer role and SLA deadline.
        """
        sec_ctx = request.security_context

        # 1. Compile Evidence Visibility Package
        evidence_items: list[ReviewEvidenceItem] = []
        for cit in decision.evidence_citations:
            evidence_items.append(
                ReviewEvidenceItem(
                    title=cit.tender_requirement_title,
                    source_doc_id="tender_package",
                    page_number=cit.tender_page_number,
                    clause_reference=cit.tender_clause_reference,
                    verbatim_quote=cit.tender_verbatim_quote,
                    conflict_note=cit.notes,
                )
            )

        for gap in decision.missing_information:
            evidence_items.append(
                ReviewEvidenceItem(
                    title=f"Gap: {gap.requirement_title}",
                    source_doc_id="tender_package",
                    clause_reference=gap.evidence.tender_clause_reference if gap.evidence else None,
                    verbatim_quote=gap.evidence.tender_verbatim_quote if gap.evidence else None,
                    conflict_note=f"{gap.missing_factor} — Suggested action: {gap.suggested_action}",
                )
            )

        for disq in decision.hard_disqualifiers:
            evidence_items.append(
                ReviewEvidenceItem(
                    title=f"Disqualifier: {disq.requirement_title}",
                    source_doc_id="tender_package",
                    clause_reference=disq.clause_reference,
                    verbatim_quote=disq.evidence.tender_verbatim_quote if disq.evidence else None,
                    conflict_note=disq.reason,
                )
            )

        evidence_package = ReviewEvidencePackage(
            items=evidence_items,
            summary=(
                f"Tender '{request.tender_id}' requires human evaluation. "
                f"Initial AI Verdict: {decision.verdict.value} (Score: {decision.readiness_score})."
            ),
            trigger_reasons=[t.summary for t in decision.review_triggers]
            if decision.review_triggers
            else [u.ambiguity_type for u in decision.uncertain_areas],
        )

        # 2. Determine Required Reviewer Role based on triggers
        required_role = self._determine_reviewer_role(decision)

        # 3. Calculate SLA Deadline & Urgency
        now = datetime.now(UTC)
        deadline_date = request.submission_deadline
        # Convert date to datetime at 17:00 IST (11:30 UTC)
        tender_deadline_dt = datetime(
            deadline_date.year, deadline_date.month, deadline_date.day, 11, 30, tzinfo=UTC
        )

        # Operational SLA: internal review must conclude at least 24 hours before tender submission
        calculated_sla = max(now + timedelta(hours=2), tender_deadline_dt - timedelta(hours=24))

        if urgency is None:
            time_left = tender_deadline_dt - now
            if time_left < timedelta(hours=24):
                urgency = ReviewUrgency.CRITICAL
            elif time_left < timedelta(hours=72):
                urgency = ReviewUrgency.HIGH
            elif time_left < timedelta(days=7):
                urgency = ReviewUrgency.MEDIUM
            else:
                urgency = ReviewUrgency.LOW

        # 4. Dispatch Task to Review Manager
        ai_recommendation: dict[str, Any] = {
            "verdict": decision.verdict.value,
            "readiness_score": decision.readiness_score,
            "reasons_to_pursue_count": len(decision.reasons_to_pursue),
            "reasons_not_to_pursue_count": len(decision.reasons_not_to_pursue),
            "hard_disqualifiers_count": len(decision.hard_disqualifiers),
            "commercial_risks_count": len(decision.commercial_risks),
        }

        task = self.review_manager.create_task(
            tenant_id=sec_ctx.tenant_id,
            workflow_run_id=sec_ctx.workflow_run_id or f"run_{decision.tender_id}",
            entity_type="BID_DECISION",
            entity_id=decision.tender_id,
            title=f"Bid Decision Review: Tender {request.tender_id}",
            description=(
                f"Tender value ₹{request.estimated_value_inr_crores} Cr. "
                f"AI Verdict: {decision.verdict.value}. Human sign-off required."
            ),
            urgency=urgency,
            required_role=required_role,
            sla_deadline=calculated_sla,
            expires_at=tender_deadline_dt,
            ai_recommendation=ai_recommendation,
            evidence_package=evidence_package,
            metadata={
                "tender_id": request.tender_id,
                "company_id": request.company_profile.company_id,
                "submission_deadline": request.submission_deadline.isoformat(),
            },
        )

        return task

    def resolve_bid_decision(
        self,
        task_id: str,
        payload: HumanReviewActionPayload,
        original_response: BidDecisionResponse,
    ) -> BidDecisionResponse:
        """
        Applies a completed human review decision to a BidDecisionResponse:
        - Strictly distinguishes Confirmation from Override
        - Mandates justification if overriding the AI verdict
        - Sets final state: CONFIRMED or OVERRIDDEN
        - Injects tamper-evident audit record
        """
        task = self.review_manager.get_task(task_id, payload.tenant_id)
        if not task:
            raise ValueError(f"Review task '{task_id}' not found.")

        # Execute review submission in manager (checks tenant, role, OCC, SLA, and override justification)
        # Note: submit_review is an async method in manager
        raise NotImplementedError("Use resolve_bid_decision_async for async execution.")

    async def resolve_bid_decision_async(
        self,
        task_id: str,
        payload: HumanReviewActionPayload,
        original_response: BidDecisionResponse,
    ) -> BidDecisionResponse:
        """
        Async implementation of human review resolution:
        1. Submits decision to manager with OCC and role validation.
        2. Strictly distinguishes AI recommendation from Human decision.
        3. Updates response verdict and state.
        4. Appends audit event.
        """
        completed_task, _ = await self.review_manager.submit_review(task_id, payload)

        original_verdict = original_response.verdict
        is_override = completed_task.is_override

        # Determine final verdict
        if is_override:
            if payload.override_verdict:
                final_verdict = BidDecisionVerdict(payload.override_verdict)
            elif payload.action == HumanReviewDecision.APPROVE:
                final_verdict = BidDecisionVerdict.GO
            elif payload.action == HumanReviewDecision.REJECT:
                final_verdict = BidDecisionVerdict.NO_GO
            else:
                final_verdict = original_verdict
            final_state = DecisionState.OVERRIDDEN
        else:
            # Human confirmed recommendation (or resolved REVIEW_REQUIRED to a binding verdict)
            if payload.override_verdict:
                final_verdict = BidDecisionVerdict(payload.override_verdict)
            elif original_verdict == BidDecisionVerdict.REVIEW_REQUIRED:
                # Review required resolved to GO or NO_GO
                final_verdict = (
                    BidDecisionVerdict.GO
                    if payload.action == HumanReviewDecision.CONFIRM
                    or payload.action == HumanReviewDecision.APPROVE
                    else BidDecisionVerdict.NO_GO
                )
            else:
                final_verdict = original_verdict
            final_state = DecisionState.CONFIRMED

        # Update response fields
        original_response.verdict = final_verdict
        original_response.state = final_state

        if payload.adjusted_readiness_score is not None:
            original_response.readiness_score = round(payload.adjusted_readiness_score, 2)

        # Append reference-only audit event
        original_response.audit_events.append(
            {
                "timestamp": datetime.now(UTC).isoformat(),
                "action": "HUMAN_DECISION_APPLIED",
                "task_id": task_id,
                "version": completed_task.version,
                "tenant_id": payload.tenant_id,
                "reviewer_id": payload.reviewer_id,
                "reviewer_roles": payload.reviewer_roles,
                "original_ai_verdict": original_verdict.value,
                "final_verdict": final_verdict.value,
                "final_state": final_state.value,
                "is_override": is_override,
                "override_justification": payload.override_justification,
                "notes": payload.notes,
            }
        )

        return original_response

    def _determine_reviewer_role(self, decision: BidDecisionResponse) -> ReviewerRole:
        """
        Determines the designated reviewer role based on review trigger reasons:
        - Debarment / statutory conflicts -> LEGAL_COUNSEL
        - Financial turnover / EMD -> FINANCIAL_CONTROLLER
        - Technical experience / OEM auth -> TECHNICAL_LEAD
        - High commercial risk or overriding hard disqualifiers -> BID_DIRECTOR
        - Default -> BID_MANAGER
        """
        trigger_types = [t.trigger_type for t in decision.review_triggers]

        if ReviewTriggerType.POSSIBLE_DISQUALIFICATION in trigger_types:
            return ReviewerRole.LEGAL_COUNSEL
        if ReviewTriggerType.CONFLICTING_EVIDENCE in trigger_types:
            return ReviewerRole.FINANCIAL_CONTROLLER
        if ReviewTriggerType.CONTRADICTORY_DOCUMENTS in trigger_types:
            return ReviewerRole.LEGAL_COUNSEL
        if (
            ReviewTriggerType.AMBIGUOUS_REQUIREMENT in trigger_types
            or ReviewTriggerType.INSUFFICIENT_CONFIDENCE in trigger_types
        ):
            return ReviewerRole.TECHNICAL_LEAD
        if any(r.severity in ("HIGH", "CRITICAL") for r in decision.commercial_risks):
            return ReviewerRole.BID_DIRECTOR

        return ReviewerRole.BID_MANAGER
