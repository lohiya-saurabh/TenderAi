from __future__ import annotations

import datetime
import pytest
from langgraph.checkpoint.memory import MemorySaver

from tenderpulse_ai.agent.schemas import (
    CriterionProps,
    ProvenanceProps,
    RequirementCandidate,
    RequirementCriticality,
    RequirementKind,
    AmbiguityFlag,
    AmbiguityType,
)
from tenderpulse_ai.decision import (
    BidDecisionAgent,
    BidDecisionRequest,
    BidDecisionVerdict,
    CompanyProfileSnapshot,
    DecisionState,
    FinancialTurnover,
)
from tenderpulse_ai.decision.workflow import (
    BidDecisionWorkflowState,
    DecisionWorkflowContext,
    build_bid_decision_workflow_graph,
    route_decision_state,
)
from tenderpulse_ai.security.context import SecurityContext

SUBMISSION_DEADLINE = datetime.date(2026, 12, 1)


def make_sec_context() -> SecurityContext:
    return SecurityContext(
        tenant_id="org_test_infra_001",
        user_id="usr_bid_officer_01",
        workflow_run_id="run_graph_test_101",
        allowed_document_ids=["doc_tender_101"],
        purpose="BID_DECISION",
    )


def make_sample_profile(*, is_blacklisted: bool = False, turnover: float = 80.0) -> CompanyProfileSnapshot:
    return CompanyProfileSnapshot(
        company_id="comp_test_infra",
        company_name="Apex Infrastructure Corp",
        profile_version_id="prof_v1",
        is_active=True,
        is_blacklisted=is_blacklisted,
        turnover_records=[
            FinancialTurnover(
                financial_year="FY24",
                turnover_inr_crores=turnover,
                ca_udin="24987654AAAA5678",
                evidence_document_id="doc_fy24_ca_cert",
            )
        ],
        experience=[],
        operating_regions=["Maharashtra", "Gujarat"],
        certifications=[],
        oem_authorizations=[],
        staff=[],
        equipment=[],
    )


def make_sample_requirements() -> list[RequirementCandidate]:
    return [
        RequirementCandidate(
            category="FINANCIAL",
            kind=RequirementKind.ELIGIBILITY_THRESHOLD,
            criticality=RequirementCriticality.HARD_ELIGIBILITY,
            title="Minimum Annual Turnover",
            description="Minimum average turnover of 50 Cr required.",
            criterion=CriterionProps(type="TURNOVER", operator="GTE", threshold=50.0, unit="CRORES"),
            provenance=ProvenanceProps(
                source_document_id="doc_tender_101",
                source_file_name="NIT.pdf",
                page_number=5,
                clause_reference="Clause 5.1",
                verbatim_quote="Minimum average turnover of 50 Cr required.",
                confidence_score=0.98,
            ),
        )
    ]


@pytest.mark.asyncio
async def test_bid_decision_langgraph_execution_flow():
    """Verify that LangGraph executes all 6 nodes and accumulates audit events."""
    custom_memo = "STRATEGIC RECOMMENDATION: Bid with high confidence. Margin potential is strong."

    async def mock_llm_synthesizer(sys_prompt: str, user_prompt: str) -> str:
        return custom_memo

    checkpointer = MemorySaver()
    ctx = DecisionWorkflowContext(model_fn=mock_llm_synthesizer)
    graph = build_bid_decision_workflow_graph(ctx, checkpointer=checkpointer)

    sec_ctx = make_sec_context()
    profile = make_sample_profile()
    requirements = make_sample_requirements()

    initial_state: BidDecisionWorkflowState = {
        "security_context": sec_ctx,
        "tender_id": "tender_mumbai_metro_01",
        "tender_title": "Mumbai Metro Line 4 Depot",
        "estimated_value_inr_crores": 100.0,
        "submission_deadline": SUBMISSION_DEADLINE.isoformat(),
        "project_location_state": "Maharashtra",
        "requirements": requirements,
        "company_profile": profile,
        "require_human_review": False,
        "audit_events": [],
    }

    thread_id = "thread_test_001"
    config = {"configurable": {"thread_id": thread_id}}

    final_state = await graph.ainvoke(initial_state, config=config)

    # 1. State assertions
    assert final_state["verdict"] in (BidDecisionVerdict.GO, BidDecisionVerdict.CONDITIONAL_GO)
    assert final_state["state"] == DecisionState.AI_PROPOSED
    assert final_state["readiness_score"] >= 0.80

    # 2. Executive Synthesis Output
    assert final_state["executive_summary"] == custom_memo

    # 3. Accumulated Audit Trail through nodes
    actions = [evt["action"] for evt in final_state["audit_events"]]
    assert "EVIDENCE_RETRIEVAL_COMPLETED" in actions
    assert "DETERMINISTIC_ELIGIBILITY_EVALUATED" in actions
    assert "RISK_ANALYSIS_COMPLETED" in actions
    assert "BID_DECISION_PROPOSED" in actions
    assert "EXECUTIVE_SYNTHESIS_COMPLETED" in actions

    # 4. Checkpoint inspection
    checkpoint = checkpointer.get(config)
    assert checkpoint is not None
    assert checkpoint["channel_values"]["verdict"] == final_state["verdict"]


@pytest.mark.asyncio
async def test_bid_decision_langgraph_conditional_review_routing():
    """Verify that ambiguous clauses cause conditional edge to route through human review gate."""
    checkpointer = MemorySaver()
    ctx = DecisionWorkflowContext()
    graph = build_bid_decision_workflow_graph(ctx, checkpointer=checkpointer)

    ambiguous_req = RequirementCandidate(
        category="TECHNICAL",
        kind=RequirementKind.ELIGIBILITY_THRESHOLD,
        criticality=RequirementCriticality.HARD_ELIGIBILITY,
        title="Unclear Sub-base Compaction Standard",
        description="Sub-base compaction must adhere to unspecified state IRC guidelines.",
        provenance=ProvenanceProps(
            source_document_id="doc_tender_101",
            source_file_name="NIT.pdf",
            page_number=18,
            clause_reference="Clause 18.2",
            verbatim_quote="adhere to state IRC guidelines or equivalent as decided by EE",
            confidence_score=0.90,
        ),
        ambiguity_flags=[
            AmbiguityFlag(
                type=AmbiguityType.NUMERIC_CONFLICT,
                detail="Discretionary standard 'or equivalent as decided by EE'",
                quote="or equivalent as decided by EE",
            )
        ],
    )

    initial_state: BidDecisionWorkflowState = {
        "security_context": make_sec_context(),
        "tender_id": "tender_highway_02",
        "tender_title": "NH-48 Widening",
        "estimated_value_inr_crores": 80.0,
        "submission_deadline": SUBMISSION_DEADLINE.isoformat(),
        "project_location_state": "Maharashtra",
        "requirements": [ambiguous_req],
        "company_profile": make_sample_profile(),
        "require_human_review": True,
        "audit_events": [],
    }

    config = {"configurable": {"thread_id": "thread_review_002"}}
    final_state = await graph.ainvoke(initial_state, config=config)

    assert final_state["verdict"] == BidDecisionVerdict.REVIEW_REQUIRED
    assert final_state["state"] == DecisionState.UNDER_REVIEW
    assert final_state["requires_human_review"] is True
    assert len(final_state["review_triggers"]) >= 1

    actions = [evt["action"] for evt in final_state["audit_events"]]
    assert "HUMAN_REVIEW_GATE_ENGAGED" in actions
    assert "BID_DECISION_REVIEW_REQUIRED" in actions


@pytest.mark.asyncio
async def test_bid_decision_langgraph_architectural_invariant_verdict_untouched():
    """Verify invariant: LLM synthesis cannot alter a NO_GO verdict to GO."""
    # A malicious or hallucinating model output
    hallucinating_model = lambda sys, user: "You should 100% bid on this tender! Highly eligible GO!"

    agent = BidDecisionAgent(model_fn=hallucinating_model)
    # Profile with debarment (hard statutory failure)
    blacklisted_profile = make_sample_profile(is_blacklisted=True)

    request = BidDecisionRequest(
        security_context=make_sec_context(),
        tender_id="tender_disqualified_01",
        tender_title="Statutory Blocked Tender",
        estimated_value_inr_crores=50.0,
        submission_deadline=SUBMISSION_DEADLINE,
        project_location_state="Maharashtra",
        requirements=make_sample_requirements(),
        company_profile=blacklisted_profile,
    )

    response = await agent.evaluate(request)

    # Invariant: Verdict MUST remain NO_GO, despite the LLM claiming "GO"
    assert response.verdict == BidDecisionVerdict.NO_GO
    assert response.readiness_score <= 0.40
    assert len(response.hard_disqualifiers) >= 1
    assert any(d.reason for d in response.hard_disqualifiers if "debarred" in d.reason.lower())
    assert any("Debarment" in r.title for r in response.reasons_not_to_pursue)
