from datetime import UTC, datetime, timedelta

import pytest

from tenderpulse_ai.domain.models import (
    CandidateComplianceItem,
    ExecutionRulesProps,
    ProvenanceProps,
    WorkflowStatus,
)
from tenderpulse_ai.models.llm_client import StructuredLLMClient
from tenderpulse_ai.review import (
    CrossTenantReviewException,
    DuplicateReviewException,
    HumanReviewActionPayload,
    HumanReviewDecision,
    HumanReviewManager,
    HumanReviewTaskStatus,
    ReviewTaskExpiredException,
    UnauthorizedReviewerException,
)
from tenderpulse_ai.security.context import SecurityContext
from tenderpulse_ai.tools.page_text import PageTextTool
from tenderpulse_ai.tools.retrieval import DocumentChunk, ScopedRetrievalTool
from tenderpulse_ai.workflow.graph import build_compliance_workflow_graph
from tenderpulse_ai.workflow.nodes import WorkflowNodeContext


@pytest.fixture
def review_setup():
    tenant_id = "tenant_tata_infra_01"
    doc_id = "doc_nit_railways_01"
    bid_id = "bid_railways_77"

    sec_context = SecurityContext(
        tenant_id=tenant_id,
        user_id="usr_bid_mgr_01",
        roles=["BID_MANAGER"],
        permissions=["bids:read", "bids:write", "compliance:review"],
        workflow_run_id="run_hitl_001",
        allowed_document_ids=[doc_id],
        purpose="COMPLIANCE_EXTRACTION",
    )

    page_text_tool = PageTextTool()
    page_text_tool.seed_page(
        tenant_id=tenant_id,
        document_id=doc_id,
        page_number=10,
        text="Clause 4.1: Bidder shall submit EMD on a 100 Rupee stamp paper.",
    )

    retrieval_tool = ScopedRetrievalTool()
    retrieval_tool.seed_chunks([
        DocumentChunk(
            chunk_id="chunk_01",
            tenant_id=tenant_id,
            document_id=doc_id,
            page_number=10,
            text="Clause 4.1: Bidder shall submit EMD on a 100 Rupee stamp paper.",
            clause_reference="Clause 4.1",
        )
    ])

    # Candidate item where quote verification initially fails (e.g. slight mismatch)
    ambiguous_item = CandidateComplianceItem(
        category="EMD",
        title="Earnest Money Deposit Stamp Paper",
        description="EMD agreement on stamp paper",
        execution_rules=ExecutionRulesProps(
            stamp_paper_required=True,
            stamp_paper_denomination_inr=100,
        ),
        provenance=ProvenanceProps(
            source_document_id=doc_id,
            source_file_name=f"{doc_id}.pdf",
            page_number=10,
            clause_reference="Clause 4.1",
            verbatim_quote="Bidder shall submit EMD on 100 Rs non-judicial stamp paper.",  # Paraphrased, fails substring
            confidence_score=0.75,
        ),
    )

    return {
        "tenant_id": tenant_id,
        "doc_id": doc_id,
        "bid_id": bid_id,
        "security_context": sec_context,
        "page_text_tool": page_text_tool,
        "retrieval_tool": retrieval_tool,
        "ambiguous_item": ambiguous_item,
    }


# ==============================================================================
# TEST 1: Full Interrupt & Resume with APPROVE
# ==============================================================================
@pytest.mark.asyncio
async def test_human_review_interrupt_and_approve(review_setup):
    setup = review_setup
    manager = HumanReviewManager()

    llm_client = StructuredLLMClient(
        extractor_fn=lambda sys, user: [setup["ambiguous_item"]]
    )
    ctx = WorkflowNodeContext(setup["retrieval_tool"], setup["page_text_tool"], llm_client)
    graph = build_compliance_workflow_graph(ctx)

    thread_id = f"tenant_{setup['tenant_id']}:bid_{setup['bid_id']}:test_approve"
    config = {"configurable": {"thread_id": thread_id}}

    initial_state = {
        "workflow_run_id": setup["security_context"].workflow_run_id,
        "security_context": setup["security_context"].model_dump(),
        "bid_id": setup["bid_id"],
        "document_id": setup["doc_id"],
        "page_number": 10,
        "retrieved_chunks": [],
        "raw_page_text": "",
        "extracted_candidates": [],
        "verified_items": [],
        "unverified_items": [],
        "retry_count": 2,  # Retries exhausted -> triggers human review
        "error_feedback": None,
        "status": WorkflowStatus.INITIALIZED.value,
        "human_review_required": False,
        "audit_events": [],
    }

    # 1. Invoke graph -> triggers interrupt
    paused_state = await graph.ainvoke(initial_state, config=config)

    assert paused_state["status"] == WorkflowStatus.AWAITING_HUMAN_REVIEW.value
    assert paused_state["human_review_required"] is True
    assert len(paused_state["verified_items"]) == 0
    assert len(ctx.persisted_records) == 0
    assert bool(paused_state.get("__interrupt__")) is True

    # 2. Register review task in HumanReviewManager
    task = manager.create_task(
        thread_id=thread_id,
        workflow_run_id=setup["security_context"].workflow_run_id,
        tenant_id=setup["tenant_id"],
        bid_id=setup["bid_id"],
        document_id=setup["doc_id"],
        page_number=10,
        unverified_items=paused_state["unverified_items"],
        assigned_user_id="usr_bid_mgr_01",
        expires_at=datetime.now(UTC) + timedelta(hours=24),
    )

    # 3. Reviewer submits APPROVE decision
    action = HumanReviewActionPayload(
        action=HumanReviewDecision.APPROVE,
        reviewer_id="usr_bid_mgr_01",
        tenant_id=setup["tenant_id"],
        reviewer_roles=["BID_MANAGER"],
        reviewer_permissions=["bids:write", "compliance:review"],
        notes="Quote confirmed valid by bid manager despite OCR minor paraphrase.",
    )

    completed_task, final_state = await manager.submit_review(task.task_id, action, graph)

    # 4. Assert workflow resumed to completion
    assert completed_task.status == HumanReviewTaskStatus.COMPLETED
    assert completed_task.decision == HumanReviewDecision.APPROVE
    assert len(final_state["verified_items"]) == 1
    assert final_state["verified_items"][0].verification_method == "HUMAN_APPROVED"
    assert final_state["status"] == WorkflowStatus.COMPLETED.value
    assert len(ctx.persisted_records) == 1

    # 5. Assert reference-only audit event recorded
    audit_actions = [e["action"] for e in final_state["audit_events"]]
    assert "HUMAN_REVIEW_APPROVE" in audit_actions


# ==============================================================================
# TEST 2: Full Interrupt & Resume with REJECT
# ==============================================================================
@pytest.mark.asyncio
async def test_human_review_interrupt_and_reject(review_setup):
    setup = review_setup
    manager = HumanReviewManager()

    llm_client = StructuredLLMClient(
        extractor_fn=lambda sys, user: [setup["ambiguous_item"]]
    )
    ctx = WorkflowNodeContext(setup["retrieval_tool"], setup["page_text_tool"], llm_client)
    graph = build_compliance_workflow_graph(ctx)

    thread_id = f"tenant_{setup['tenant_id']}:bid_{setup['bid_id']}:test_reject"
    config = {"configurable": {"thread_id": thread_id}}

    initial_state = {
        "workflow_run_id": setup["security_context"].workflow_run_id,
        "security_context": setup["security_context"].model_dump(),
        "bid_id": setup["bid_id"],
        "document_id": setup["doc_id"],
        "page_number": 10,
        "retrieved_chunks": [],
        "raw_page_text": "",
        "extracted_candidates": [],
        "verified_items": [],
        "unverified_items": [],
        "retry_count": 2,
        "error_feedback": None,
        "status": WorkflowStatus.INITIALIZED.value,
        "human_review_required": False,
        "audit_events": [],
    }

    # 1. Trigger interrupt
    paused_state = await graph.ainvoke(initial_state, config=config)
    assert paused_state["status"] == WorkflowStatus.AWAITING_HUMAN_REVIEW.value

    # 2. Register review task
    task = manager.create_task(
        thread_id=thread_id,
        workflow_run_id=setup["security_context"].workflow_run_id,
        tenant_id=setup["tenant_id"],
        bid_id=setup["bid_id"],
        document_id=setup["doc_id"],
        page_number=10,
        unverified_items=paused_state["unverified_items"],
    )

    # 3. Submit REJECT decision
    action = HumanReviewActionPayload(
        action=HumanReviewDecision.REJECT,
        reviewer_id="usr_bid_mgr_01",
        tenant_id=setup["tenant_id"],
        notes="Spurious item discarded by bid manager.",
    )

    completed_task, final_state = await manager.submit_review(task.task_id, action, graph)

    # 4. Assert rejected item was NOT persisted
    assert completed_task.status == HumanReviewTaskStatus.COMPLETED
    assert completed_task.decision == HumanReviewDecision.REJECT
    assert len(final_state["verified_items"]) == 0
    assert len(ctx.persisted_records) == 0
    assert final_state["status"] == WorkflowStatus.COMPLETED.value


# ==============================================================================
# TEST 3: Full Interrupt & Resume with EDIT
# ==============================================================================
@pytest.mark.asyncio
async def test_human_review_interrupt_and_edit(review_setup):
    setup = review_setup
    manager = HumanReviewManager()

    llm_client = StructuredLLMClient(
        extractor_fn=lambda sys, user: [setup["ambiguous_item"]]
    )
    ctx = WorkflowNodeContext(setup["retrieval_tool"], setup["page_text_tool"], llm_client)
    graph = build_compliance_workflow_graph(ctx)

    thread_id = f"tenant_{setup['tenant_id']}:bid_{setup['bid_id']}:test_edit"
    config = {"configurable": {"thread_id": thread_id}}

    initial_state = {
        "workflow_run_id": setup["security_context"].workflow_run_id,
        "security_context": setup["security_context"].model_dump(),
        "bid_id": setup["bid_id"],
        "document_id": setup["doc_id"],
        "page_number": 10,
        "retrieved_chunks": [],
        "raw_page_text": "",
        "extracted_candidates": [],
        "verified_items": [],
        "unverified_items": [],
        "retry_count": 2,
        "error_feedback": None,
        "status": WorkflowStatus.INITIALIZED.value,
        "human_review_required": False,
        "audit_events": [],
    }

    # 1. Trigger interrupt
    paused_state = await graph.ainvoke(initial_state, config=config)

    # 2. Register review task
    task = manager.create_task(
        thread_id=thread_id,
        workflow_run_id=setup["security_context"].workflow_run_id,
        tenant_id=setup["tenant_id"],
        bid_id=setup["bid_id"],
        document_id=setup["doc_id"],
        page_number=10,
        unverified_items=paused_state["unverified_items"],
    )

    # 3. Create corrected/edited candidate item (e.g. corrected stamp paper to INR 500)
    corrected_item = CandidateComplianceItem(
        category="EMD",
        title="Earnest Money Deposit (Corrected to 500 Rs Stamp)",
        description="EMD agreement on 500 Rs stamp paper",
        execution_rules=ExecutionRulesProps(
            stamp_paper_required=True,
            stamp_paper_denomination_inr=500,
        ),
        provenance=ProvenanceProps(
            source_document_id=setup["doc_id"],
            source_file_name=f"{setup['doc_id']}.pdf",
            page_number=10,
            clause_reference="Clause 4.1",
            verbatim_quote="Bidder shall submit EMD on a 100 Rupee stamp paper.",
            confidence_score=1.0,
        ),
    )

    action = HumanReviewActionPayload(
        action=HumanReviewDecision.EDIT,
        reviewer_id="usr_bid_mgr_01",
        tenant_id=setup["tenant_id"],
        edited_item=corrected_item,
        notes="Corrected stamp paper denomination and title.",
    )

    completed_task, final_state = await manager.submit_review(task.task_id, action, graph)

    # 4. Assert edited item was persisted with HUMAN_EDITED method
    assert completed_task.status == HumanReviewTaskStatus.COMPLETED
    assert len(final_state["verified_items"]) == 1
    assert final_state["verified_items"][0].verification_method == "HUMAN_EDITED"
    assert final_state["verified_items"][0].execution_rules.stamp_paper_denomination_inr == 500
    assert len(ctx.persisted_records) == 1


# ==============================================================================
# TEST 4: Tenant Isolation on Reviewer Access (Cross-Tenant Block)
# ==============================================================================
@pytest.mark.asyncio
async def test_cross_tenant_reviewer_is_blocked(review_setup):
    setup = review_setup
    manager = HumanReviewManager()

    task = manager.create_task(
        thread_id="t1",
        workflow_run_id="run_1",
        tenant_id=setup["tenant_id"],
        bid_id=setup["bid_id"],
        document_id=setup["doc_id"],
        page_number=10,
        unverified_items=[],
    )

    # 1. Attempting to get task from another tenant
    with pytest.raises(CrossTenantReviewException):
        manager.get_task(task.task_id, requesting_tenant_id="tenant_foreign_competitor")

    # 2. Attempting to submit review from another tenant
    foreign_action = HumanReviewActionPayload(
        action=HumanReviewDecision.APPROVE,
        reviewer_id="usr_attacker",
        tenant_id="tenant_foreign_competitor",  # Mismatched tenant
    )

    with pytest.raises(CrossTenantReviewException):
        await manager.submit_review(task.task_id, foreign_action, None)


# ==============================================================================
# TEST 5: Reviewer Authorization Check (Missing Permission Blocked)
# ==============================================================================
@pytest.mark.asyncio
async def test_unauthorized_reviewer_without_permission_is_blocked(review_setup):
    setup = review_setup
    manager = HumanReviewManager()

    task = manager.create_task(
        thread_id="t1",
        workflow_run_id="run_1",
        tenant_id=setup["tenant_id"],
        bid_id=setup["bid_id"],
        document_id=setup["doc_id"],
        page_number=10,
        unverified_items=[],
    )

    unauthorized_action = HumanReviewActionPayload(
        action=HumanReviewDecision.APPROVE,
        reviewer_id="usr_viewer_01",
        tenant_id=setup["tenant_id"],
        reviewer_roles=["VIEWER"],
        reviewer_permissions=["bids:read"],  # Missing 'compliance:review'
    )

    with pytest.raises(UnauthorizedReviewerException):
        await manager.submit_review(task.task_id, unauthorized_action, None)


# ==============================================================================
# TEST 6: Duplicate Approval Prevention
# ==============================================================================
@pytest.mark.asyncio
async def test_duplicate_review_submission_is_blocked(review_setup):
    setup = review_setup
    manager = HumanReviewManager()

    llm_client = StructuredLLMClient(extractor_fn=lambda sys, user: [setup["ambiguous_item"]])
    ctx = WorkflowNodeContext(setup["retrieval_tool"], setup["page_text_tool"], llm_client)
    graph = build_compliance_workflow_graph(ctx)

    thread_id = f"tenant_{setup['tenant_id']}:bid_{setup['bid_id']}:test_dup"
    config = {"configurable": {"thread_id": thread_id}}

    initial_state = {
        "workflow_run_id": setup["security_context"].workflow_run_id,
        "security_context": setup["security_context"].model_dump(),
        "bid_id": setup["bid_id"],
        "document_id": setup["doc_id"],
        "page_number": 10,
        "retrieved_chunks": [],
        "raw_page_text": "",
        "extracted_candidates": [],
        "verified_items": [],
        "unverified_items": [],
        "retry_count": 2,
        "error_feedback": None,
        "status": WorkflowStatus.INITIALIZED.value,
        "human_review_required": False,
        "audit_events": [],
    }

    await graph.ainvoke(initial_state, config=config)

    task = manager.create_task(
        thread_id=thread_id,
        workflow_run_id=setup["security_context"].workflow_run_id,
        tenant_id=setup["tenant_id"],
        bid_id=setup["bid_id"],
        document_id=setup["doc_id"],
        page_number=10,
        unverified_items=[],
    )

    action = HumanReviewActionPayload(
        action=HumanReviewDecision.APPROVE,
        reviewer_id="usr_bid_mgr_01",
        tenant_id=setup["tenant_id"],
    )

    # First review passes
    await manager.submit_review(task.task_id, action, graph)

    # Duplicate review attempt must raise DuplicateReviewException
    with pytest.raises(DuplicateReviewException):
        await manager.submit_review(task.task_id, action, graph)


# ==============================================================================
# TEST 7: Review Task Expiry / SLA Enforcement
# ==============================================================================
@pytest.mark.asyncio
async def test_expired_task_cannot_be_reviewed(review_setup):
    setup = review_setup
    manager = HumanReviewManager()

    expired_time = datetime.now(UTC) - timedelta(hours=2)
    task = manager.create_task(
        thread_id="t1",
        workflow_run_id="run_1",
        tenant_id=setup["tenant_id"],
        bid_id=setup["bid_id"],
        document_id=setup["doc_id"],
        page_number=10,
        unverified_items=[],
        expires_at=expired_time,  # Already expired
    )

    action = HumanReviewActionPayload(
        action=HumanReviewDecision.APPROVE,
        reviewer_id="usr_bid_mgr_01",
        tenant_id=setup["tenant_id"],
    )

    with pytest.raises(ReviewTaskExpiredException):
        await manager.submit_review(task.task_id, action, None)

    assert task.status == HumanReviewTaskStatus.EXPIRED


# ==============================================================================
# TEST 8: Task Reassignment with Audit History
# ==============================================================================
def test_task_reassignment_updates_assignee_and_audit(review_setup):
    setup = review_setup
    manager = HumanReviewManager()

    task = manager.create_task(
        thread_id="t1",
        workflow_run_id="run_1",
        tenant_id=setup["tenant_id"],
        bid_id=setup["bid_id"],
        document_id=setup["doc_id"],
        page_number=10,
        unverified_items=[],
        assigned_user_id="usr_analyst_01",
    )

    reassigned = manager.reassign_task(
        task_id=task.task_id,
        requesting_tenant_id=setup["tenant_id"],
        new_user_id="usr_lead_02",
        authorizing_user_id="usr_supervisor_03",
    )

    assert reassigned.assigned_user_id == "usr_lead_02"
    reassigned_events = [
        e for e in manager.review_audit_log if e["action"] == "HUMAN_REVIEW_TASK_REASSIGNED"
    ]
    assert len(reassigned_events) == 1
    assert reassigned_events[0]["previous_assignee"] == "usr_analyst_01"
    assert reassigned_events[0]["new_assignee"] == "usr_lead_02"
