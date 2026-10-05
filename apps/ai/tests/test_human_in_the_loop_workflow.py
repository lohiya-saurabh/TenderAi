from __future__ import annotations

import datetime

import pytest

from tenderpulse_ai.agent.schemas import (
    AmbiguityFlag,
    AmbiguityType,
    ProvenanceProps,
    RequirementCandidate,
    RequirementCriticality,
    RequirementKind,
)
from tenderpulse_ai.decision import (
    BidDecisionAgent,
    BidDecisionRequest,
    BidDecisionResponse,
    BidDecisionVerdict,
    CompanyProfileSnapshot,
    DecisionState,
    FinancialTurnover,
    RiskItem,
    RiskSeverity,
)
from tenderpulse_ai.review import (
    CrossTenantReviewException,
    HumanInTheLoopWorkflow,
    HumanReviewActionPayload,
    HumanReviewDecision,
    HumanReviewManager,
    HumanReviewTaskStatus,
    InvalidReviewActionException,
    ReviewConcurrencyConflictException,
    ReviewerRole,
    ReviewTaskExpiredException,
    UnauthorizedReviewerException,
)
from tenderpulse_ai.security.context import SecurityContext

FUTURE_DEADLINE = datetime.date(2026, 11, 20)


def make_security_context(tenant_id: str = "org_lnt_infra", user_id: str = "usr_bid_mgr_01") -> SecurityContext:
    return SecurityContext(
        tenant_id=tenant_id,
        user_id=user_id,
        workflow_run_id="run_hitl_test_999",
        allowed_document_ids=["doc_tender_package"],
        purpose="BID_DECISION",  # type: ignore[arg-type]
    )


def make_company_profile(
    *,
    turnover_inr_crores: float = 80.0,
    is_blacklisted: bool = False,
    duplicate_turnover_years: bool = False,
) -> CompanyProfileSnapshot:
    turnover_records = [
        FinancialTurnover(
            financial_year="FY24",
            turnover_inr_crores=turnover_inr_crores,
            ca_udin="24123456AAAA1234",
            evidence_document_id="doc_ca_cert_fy24",
        )
    ]
    if duplicate_turnover_years:
        # Conflicting duplicate financial year
        turnover_records.append(
            FinancialTurnover(
                financial_year="FY24",
                turnover_inr_crores=45.0,  # Conflict: 80 vs 45
                ca_udin="24123456AAAA9999",
                evidence_document_id="doc_ca_cert_fy24_revised",
            )
        )

    return CompanyProfileSnapshot(
        company_id="comp_lnt_constructions",
        company_name="L&T Construction Engineering Ltd",
        profile_version_id="prof_v2_active",
        is_active=True,
        is_blacklisted=is_blacklisted,
        registrations={"GSTIN": "27AAACL1234F1Z1", "PAN": "AAACL1234F"},
        turnover_records=turnover_records,
        operating_regions=["Maharashtra", "Gujarat"],
    )


def make_request(
    *,
    requirements: list[RequirementCandidate] | None = None,
    submission_deadline: datetime.date = FUTURE_DEADLINE,
    company_profile: CompanyProfileSnapshot | None = None,
    require_human_review: bool = False,
    tenant_id: str = "org_lnt_infra",
) -> BidDecisionRequest:
    return BidDecisionRequest(
        security_context=make_security_context(tenant_id=tenant_id),
        tender_id="tnd_metro_viaduct_01",
        tender_title="Elevated Metro Viaduct Package 01",
        estimated_value_inr_crores=150.0,
        submission_deadline=submission_deadline,
        project_location_state="Maharashtra",
        requirements=requirements or [],
        company_profile=company_profile or make_company_profile(),
        require_human_review=require_human_review,
    )


# ==============================================================================
# 1. AI Output: REVIEW_REQUIRED Trigger Triggers
# ==============================================================================


@pytest.mark.asyncio
async def test_ai_emits_review_required_on_ambiguous_requirement():
    agent = BidDecisionAgent()
    ambiguous_req = RequirementCandidate(
        category="TECHNICAL",
        kind=RequirementKind.DOCUMENT_SUBMISSION,
        criticality=RequirementCriticality.HARD_ELIGIBILITY,
        title="Substantial Similar Experience",
        description="Bidder should have substantial experience in viaducts.",
        provenance=ProvenanceProps(
            source_document_id="doc_tender_package",
            source_file_name="nit.pdf",
            page_number=12,
            clause_reference="Clause 3.2",
            verbatim_quote="Bidder should have substantial experience in viaducts.",
            confidence_score=0.90,
        ),
        ambiguity_flags=[
            AmbiguityFlag(
                type=AmbiguityType.VAGUE_QUANTIFIER,
                detail="Vague quantifier 'substantial' without numerical threshold",
                quote="substantial experience",
            )
        ],
    )
    request = make_request(requirements=[ambiguous_req], require_human_review=True)
    response = await agent.evaluate(request)

    assert response.verdict == BidDecisionVerdict.REVIEW_REQUIRED
    assert response.state == DecisionState.UNDER_REVIEW
    assert len(response.review_triggers) >= 1
    assert any(t.trigger_type.value == "AMBIGUOUS_REQUIREMENT" for t in response.review_triggers)


@pytest.mark.asyncio
async def test_ai_emits_review_required_on_insufficient_confidence():
    agent = BidDecisionAgent()
    low_conf_req = RequirementCandidate(
        category="FINANCIAL",
        kind=RequirementKind.ELIGIBILITY_THRESHOLD,
        criticality=RequirementCriticality.HARD_ELIGIBILITY,
        title="Working Capital Requirement",
        description="Working capital of at least 20 Cr required.",
        provenance=ProvenanceProps(
            source_document_id="doc_tender_package",
            source_file_name="nit.pdf",
            page_number=18,
            clause_reference="Clause 5.1",
            verbatim_quote="Working capital requirement of 20 Cr.",
            confidence_score=0.62,  # Low confidence < 0.75
        ),
    )
    request = make_request(requirements=[low_conf_req], require_human_review=True)
    response = await agent.evaluate(request)

    assert response.verdict == BidDecisionVerdict.REVIEW_REQUIRED
    assert any(t.trigger_type.value == "INSUFFICIENT_CONFIDENCE" for t in response.review_triggers)


@pytest.mark.asyncio
async def test_ai_emits_review_required_on_conflicting_evidence():
    agent = BidDecisionAgent()
    # Company with conflicting duplicate turnover records for FY24
    profile = make_company_profile(duplicate_turnover_years=True)
    request = make_request(company_profile=profile, require_human_review=True)
    response = await agent.evaluate(request)

    assert response.verdict == BidDecisionVerdict.REVIEW_REQUIRED
    assert any(t.trigger_type.value == "CONFLICTING_EVIDENCE" for t in response.review_triggers)


@pytest.mark.asyncio
async def test_ai_emits_review_required_on_past_deadline():
    agent = BidDecisionAgent()
    past_deadline = datetime.date(2025, 1, 1)  # In past
    request = make_request(submission_deadline=past_deadline, require_human_review=True)
    response = await agent.evaluate(request)

    assert response.verdict == BidDecisionVerdict.REVIEW_REQUIRED
    assert any(t.trigger_type.value == "CONTRADICTORY_DOCUMENTS" for t in response.review_triggers)


# ==============================================================================
# 2. Review Task Generation & Evidence Visibility
# ==============================================================================


@pytest.mark.asyncio
async def test_review_task_creation_with_evidence_package_and_sla():
    agent = BidDecisionAgent()
    req = RequirementCandidate(
        category="TECHNICAL",
        kind=RequirementKind.DOCUMENT_SUBMISSION,
        criticality=RequirementCriticality.HARD_ELIGIBILITY,
        title="Similar Work Certificate",
        description="Completion certificate required.",
        provenance=ProvenanceProps(
            source_document_id="doc_tender_package",
            source_file_name="nit.pdf",
            page_number=14,
            clause_reference="Clause 4.1",
            verbatim_quote="Completion certificate for 50 Cr work.",
            confidence_score=0.70,
        ),
    )
    request = make_request(requirements=[req], require_human_review=True)
    decision = await agent.evaluate(request)

    workflow = HumanInTheLoopWorkflow()
    task = workflow.create_review_task_for_bid_decision(decision, request)

    assert task.status == HumanReviewTaskStatus.PENDING
    assert task.version == 1
    assert task.entity_type == "BID_DECISION"
    assert task.entity_id == "tnd_metro_viaduct_01"
    assert task.tenant_id == "org_lnt_infra"
    assert task.sla_deadline is not None
    assert task.sla_deadline < datetime.datetime(2026, 11, 20, 11, 30, tzinfo=datetime.UTC)
    assert len(task.evidence_package.items) >= 1
    assert task.ai_recommendation["verdict"] == "REVIEW_REQUIRED"


def test_role_determination_maps_specialist_appropriately():
    workflow = HumanInTheLoopWorkflow()

    # Conflicting financial evidence -> FINANCIAL_CONTROLLER
    resp_financial = BidDecisionResponse(
        tender_id="tnd_01",
        company_id="comp_01",
        profile_version_id="v1",
        verdict=BidDecisionVerdict.REVIEW_REQUIRED,
        readiness_score=0.75,
        review_triggers=[
            {"trigger_type": "CONFLICTING_EVIDENCE", "summary": "Turnover clash", "details": "..."}
        ],  # type: ignore[arg-type]
    )
    role = workflow._determine_reviewer_role(resp_financial)
    assert role == ReviewerRole.FINANCIAL_CONTROLLER

    # High commercial risk -> BID_DIRECTOR
    resp_risk = BidDecisionResponse(
        tender_id="tnd_02",
        company_id="comp_01",
        profile_version_id="v1",
        verdict=BidDecisionVerdict.REVIEW_REQUIRED,
        readiness_score=0.70,
        commercial_risks=[
            RiskItem(
                category="LIQUIDATED_DAMAGES",
                title="Excessive LD",
                detail="Clause stipulates 15% LD cap",
                severity=RiskSeverity.CRITICAL,
                mitigation_advice="Negotiate standard 10% cap with tendering authority.",
            )
        ],
    )
    role_risk = workflow._determine_reviewer_role(resp_risk)
    assert role_risk == ReviewerRole.BID_DIRECTOR


# ==============================================================================
# 3. Optimistic Concurrency Control (OCC)
# ==============================================================================


@pytest.mark.asyncio
async def test_optimistic_concurrency_conflict_on_stale_claim():
    manager = HumanReviewManager()
    task = manager.create_task(
        tenant_id="org_lnt_infra",
        workflow_run_id="run_occ_01",
        entity_type="BID_DECISION",
        entity_id="tnd_01",
        required_role=ReviewerRole.BID_MANAGER,
    )
    assert task.version == 1

    # Reviewer 1 claims task at version 1 -> succeeds, version becomes 2
    manager.claim_task(
        task_id=task.task_id,
        requesting_tenant_id="org_lnt_infra",
        user_id="usr_reviewer_01",
        user_roles=["BID_MANAGER"],
        expected_version=1,
    )
    assert task.version == 2
    assert task.status == HumanReviewTaskStatus.IN_REVIEW

    # Reviewer 2 tries to claim same task with stale expected_version=1 -> raises OCC conflict
    with pytest.raises(ReviewConcurrencyConflictException) as exc_info:
        manager.claim_task(
            task_id=task.task_id,
            requesting_tenant_id="org_lnt_infra",
            user_id="usr_reviewer_02",
            user_roles=["BID_MANAGER"],
            expected_version=1,
        )
    assert "OCC Conflict" in str(exc_info.value)


@pytest.mark.asyncio
async def test_optimistic_concurrency_conflict_on_submit():
    manager = HumanReviewManager()
    task = manager.create_task(
        tenant_id="org_lnt_infra",
        workflow_run_id="run_occ_02",
        entity_type="BID_DECISION",
        entity_id="tnd_01",
        required_role=ReviewerRole.BID_MANAGER,
    )
    # Background comment increments version to 2
    manager.add_comment(
        task_id=task.task_id,
        requesting_tenant_id="org_lnt_infra",
        author_id="usr_lead",
        author_role="BID_MANAGER",
        text="Check clause 4.2",
        expected_version=1,
    )
    assert task.version == 2

    # Reviewer submits decision with stale expected_version=1 -> raises OCC conflict
    payload = HumanReviewActionPayload(
        action=HumanReviewDecision.CONFIRM,
        reviewer_id="usr_reviewer_01",
        tenant_id="org_lnt_infra",
        reviewer_roles=["BID_MANAGER"],
        expected_version=1,  # Stale
    )
    with pytest.raises(ReviewConcurrencyConflictException):
        await manager.submit_review(task.task_id, payload)


# ==============================================================================
# 4. RBAC & Cross-Tenant Security
# ==============================================================================


def test_cross_tenant_access_strictly_prevented():
    manager = HumanReviewManager()
    task = manager.create_task(
        tenant_id="org_tenant_alpha",
        workflow_run_id="run_01",
        entity_id="tnd_01",
    )

    # Tenant Beta attempts access
    with pytest.raises(CrossTenantReviewException):
        manager.get_task(task.task_id, requesting_tenant_id="org_tenant_beta")


def test_unauthorized_role_claim_rejected():
    manager = HumanReviewManager()
    task = manager.create_task(
        tenant_id="org_lnt_infra",
        workflow_run_id="run_rbac_01",
        entity_id="tnd_01",
        required_role=ReviewerRole.LEGAL_COUNSEL,
    )

    # Technical Lead attempts to claim Legal Counsel task -> rejected
    with pytest.raises(UnauthorizedReviewerException):
        manager.claim_task(
            task_id=task.task_id,
            requesting_tenant_id="org_lnt_infra",
            user_id="usr_tech_lead",
            user_roles=["TECHNICAL_LEAD"],
            expected_version=1,
        )


def test_bid_director_executive_override_authority():
    manager = HumanReviewManager()
    task = manager.create_task(
        tenant_id="org_lnt_infra",
        workflow_run_id="run_rbac_02",
        entity_id="tnd_01",
        required_role=ReviewerRole.LEGAL_COUNSEL,
    )

    # BID_DIRECTOR has universal authority
    claimed = manager.claim_task(
        task_id=task.task_id,
        requesting_tenant_id="org_lnt_infra",
        user_id="usr_director",
        user_roles=["BID_DIRECTOR"],
        expected_version=1,
    )
    assert claimed.status == HumanReviewTaskStatus.IN_REVIEW
    assert claimed.claimed_by_user_id == "usr_director"


# ==============================================================================
# 5. Comments, Escalation & Reassignment
# ==============================================================================


def test_comment_thread_and_task_escalation():
    manager = HumanReviewManager()
    task = manager.create_task(
        tenant_id="org_lnt_infra",
        workflow_run_id="run_collab_01",
        entity_id="tnd_01",
        required_role=ReviewerRole.BID_MANAGER,
    )

    # 1. Add comment
    task = manager.add_comment(
        task_id=task.task_id,
        requesting_tenant_id="org_lnt_infra",
        author_id="usr_mgr_01",
        author_role="BID_MANAGER",
        text="EMD stamp paper amount seems ambiguous in Clause 3.1.",
        expected_version=1,
        tagged_clause="Clause 3.1",
    )
    assert len(task.comments) == 1
    assert task.version == 2
    assert task.comments[0].tagged_clause == "Clause 3.1"

    # 2. Escalate to Legal Counsel
    task = manager.escalate_task(
        task_id=task.task_id,
        requesting_tenant_id="org_lnt_infra",
        author_id="usr_mgr_01",
        author_role="BID_MANAGER",
        reason="Requires legal interpretation of non-judicial stamp validity.",
        target_role=ReviewerRole.LEGAL_COUNSEL,
        expected_version=2,
    )
    assert task.status == HumanReviewTaskStatus.ESCALATED
    assert task.required_role == ReviewerRole.LEGAL_COUNSEL
    assert task.version == 3
    assert len(task.comments) == 2  # Escalation comment added


def test_reassignment_updates_assignee_and_version():
    manager = HumanReviewManager()
    task = manager.create_task(
        tenant_id="org_lnt_infra",
        workflow_run_id="run_reassign_01",
        entity_id="tnd_01",
        assigned_user_id="usr_initial",
    )

    reassigned = manager.reassign_task(
        task_id=task.task_id,
        requesting_tenant_id="org_lnt_infra",
        new_user_id="usr_new_specialist",
        authorizing_user_id="usr_bid_director",
        expected_version=1,
    )
    assert reassigned.assigned_user_id == "usr_new_specialist"
    assert reassigned.status == HumanReviewTaskStatus.REASSIGNED
    assert reassigned.version == 2


# ==============================================================================
# 6. Distinguishability: Confirmation vs. Override
# ==============================================================================


@pytest.mark.asyncio
async def test_human_override_strictly_requires_justification():
    manager = HumanReviewManager()
    task = manager.create_task(
        tenant_id="org_lnt_infra",
        workflow_run_id="run_override_01",
        entity_id="tnd_01",
        ai_recommendation={"verdict": "NO_GO", "readiness_score": 0.40},
    )

    # Attempting to override NO_GO to GO without justification -> fails
    payload_no_justification = HumanReviewActionPayload(
        action=HumanReviewDecision.OVERRIDE,
        override_verdict="GO",
        override_justification="",  # Empty
        reviewer_id="usr_director",
        tenant_id="org_lnt_infra",
        reviewer_roles=["BID_DIRECTOR"],
        expected_version=1,
    )

    with pytest.raises(InvalidReviewActionException) as exc_info:
        await manager.submit_review(task.task_id, payload_no_justification)
    assert "explicit, audit-grade justification" in str(exc_info.value)


@pytest.mark.asyncio
async def test_human_override_with_justification_succeeds():
    manager = HumanReviewManager()
    task = manager.create_task(
        tenant_id="org_lnt_infra",
        workflow_run_id="run_override_02",
        entity_id="tnd_01",
        ai_recommendation={"verdict": "NO_GO", "readiness_score": 0.40},
    )

    payload_valid = HumanReviewActionPayload(
        action=HumanReviewDecision.OVERRIDE,
        override_verdict="GO",
        override_justification="Executive override: Joint venture partner brings requisite ISO certification.",
        reviewer_id="usr_director",
        tenant_id="org_lnt_infra",
        reviewer_roles=["BID_DIRECTOR"],
        expected_version=1,
    )

    completed_task, _ = await manager.submit_review(task.task_id, payload_valid)
    assert completed_task.status == HumanReviewTaskStatus.COMPLETED
    assert completed_task.is_override is True
    assert completed_task.override_justification is not None
    assert completed_task.decision == HumanReviewDecision.OVERRIDE


# ==============================================================================
# 7. SLA Expiry Guard
# ==============================================================================


@pytest.mark.asyncio
async def test_sla_expired_task_rejects_review():
    manager = HumanReviewManager()
    # Task created with an expired deadline
    past_time = datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=2)
    task = manager.create_task(
        tenant_id="org_lnt_infra",
        workflow_run_id="run_sla_01",
        entity_id="tnd_01",
        sla_deadline=past_time,
    )

    payload = HumanReviewActionPayload(
        action=HumanReviewDecision.CONFIRM,
        reviewer_id="usr_reviewer_01",
        tenant_id="org_lnt_infra",
        reviewer_roles=["BID_MANAGER"],
        expected_version=1,
    )

    with pytest.raises(ReviewTaskExpiredException):
        await manager.submit_review(task.task_id, payload)


# ==============================================================================
# 8. Full End-to-End Workflow Continuation
# ==============================================================================


@pytest.mark.asyncio
async def test_end_to_end_hitl_workflow_continuation():
    agent = BidDecisionAgent()
    workflow = HumanInTheLoopWorkflow()

    # 1. AI produces REVIEW_REQUIRED due to low confidence clause
    req = RequirementCandidate(
        category="TECHNICAL",
        kind=RequirementKind.DOCUMENT_SUBMISSION,
        criticality=RequirementCriticality.HARD_ELIGIBILITY,
        title="Rail Track Fastening Specs",
        description="Fastening mechanism must adhere to RDSO standard.",
        provenance=ProvenanceProps(
            source_document_id="doc_tender_package",
            source_file_name="nit.pdf",
            page_number=19,
            clause_reference="Clause 7.4",
            verbatim_quote="RDSO standard compliance mandatory.",
            confidence_score=0.65,  # triggers REVIEW_REQUIRED
        ),
    )
    request = make_request(requirements=[req], require_human_review=True)
    initial_decision = await agent.evaluate(request)
    assert initial_decision.verdict == BidDecisionVerdict.REVIEW_REQUIRED
    assert initial_decision.state == DecisionState.UNDER_REVIEW

    # 2. Workflow generates Review Task
    task = workflow.create_review_task_for_bid_decision(initial_decision, request)
    assert task.status == HumanReviewTaskStatus.PENDING
    assert task.version == 1

    # 3. Technical Lead claims task (OCC version 1 -> 2)
    task = workflow.review_manager.claim_task(
        task_id=task.task_id,
        requesting_tenant_id="org_lnt_infra",
        user_id="usr_tech_lead",
        user_roles=["TECHNICAL_LEAD"],
        expected_version=1,
    )
    assert task.version == 2
    assert task.status == HumanReviewTaskStatus.IN_REVIEW

    # 4. Technical Lead adds finding comment (OCC version 2 -> 3)
    task = workflow.review_manager.add_comment(
        task_id=task.task_id,
        requesting_tenant_id="org_lnt_infra",
        author_id="usr_tech_lead",
        author_role="TECHNICAL_LEAD",
        text="Verified with RDSO vendor directory; L&T pre-approved for fastening.",
        expected_version=2,
    )
    assert task.version == 3

    # 5. Technical Lead submits decision: confirms GO with adjusted score
    payload = HumanReviewActionPayload(
        action=HumanReviewDecision.CONFIRM,
        override_verdict="GO",
        reviewer_id="usr_tech_lead",
        tenant_id="org_lnt_infra",
        reviewer_roles=["TECHNICAL_LEAD"],
        expected_version=3,
        adjusted_readiness_score=0.92,
        notes="Technical verification passed.",
    )

    final_response = await workflow.resolve_bid_decision_async(task.task_id, payload, initial_decision)

    # 6. Verify final state and audit trail
    assert final_response.verdict == BidDecisionVerdict.GO
    assert final_response.state == DecisionState.CONFIRMED
    assert final_response.readiness_score == 0.92

    audit_actions = [e["action"] for e in final_response.audit_events]
    assert "HUMAN_DECISION_APPLIED" in audit_actions
    decision_event = next(e for e in final_response.audit_events if e["action"] == "HUMAN_DECISION_APPLIED")
    assert decision_event["reviewer_id"] == "usr_tech_lead"
    assert decision_event["original_ai_verdict"] == "REVIEW_REQUIRED"
    assert decision_event["final_verdict"] == "GO"
    assert decision_event["is_override"] is False
