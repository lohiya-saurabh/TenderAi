import pytest
from langgraph.checkpoint.memory import MemorySaver
from tenderpulse_ai.dossier.graph import build_bid_dossier_workflow_graph
from tenderpulse_ai.security.context import SecurityContext


@pytest.fixture
def mock_security_context():
    return SecurityContext(
        tenant_id="org_alpha",
        user_id="user_director",
        workflow_run_id="run_dossier_99",
        allowed_document_ids=["doc_tender_100"],
    )


def test_multi_agent_dossier_fully_qualified_case_ephemeral(mock_security_context):
    graph = build_bid_dossier_workflow_graph()

    criteria = {
        "min_completed_projects": 2,
        "mandatory_certifications": ["ISO 9001"],
        "min_avg_turnover_inr_crores": 30.0,
        "stamp_paper_denomination_inr": 100,
        "udin_required": True,
        "emd_amount_inr": 500000,
    }

    profile = {
        "completed_projects": ["Project Alpha (INR 25 Cr)", "Project Beta (INR 40 Cr)"],
        "certifications": ["ISO 9001", "ISO 14001"],
        "avg_annual_turnover_inr_crores": 45.0,
        "ca_udin_verified": True,
        "is_blacklisted": False,
    }

    initial_state = {
        "security_context": mock_security_context,
        "tender_id": "tnd_infra_101",
        "tender_title": "Elevated Expressway Corridor Construction",
        "tender_criteria": criteria,
        "company_profile": profile,
        "appraisals": [],
        "audit_events": [],
    }

    result = graph.invoke(initial_state)

    assert "dossier" in result
    dossier = result["dossier"]
    assert dossier.tender_id == "tnd_infra_101"
    assert dossier.overall_verdict == "CONDITIONAL_GO"  # Has required action items (stamp paper, EMD)
    assert len(dossier.specialist_appraisals) == 3
    assert len(dossier.hard_disqualifiers) == 0
    assert len(dossier.critical_action_items) >= 2


def test_multi_agent_dossier_stateful_checkpointing(mock_security_context):
    memory_checkpointer = MemorySaver()
    graph = build_bid_dossier_workflow_graph(checkpointer=memory_checkpointer)

    criteria = {
        "min_completed_projects": 1,
        "min_avg_turnover_inr_crores": 10.0,
    }

    profile = {
        "completed_projects": ["Project Gamma"],
        "avg_annual_turnover_inr_crores": 25.0,
        "ca_udin_verified": True,
        "is_blacklisted": True,  # Active statutory debarment!
    }

    initial_state = {
        "security_context": mock_security_context,
        "tender_id": "tnd_pwd_202",
        "tender_title": "State Highway Resurfacing",
        "tender_criteria": criteria,
        "company_profile": profile,
        "appraisals": [],
        "audit_events": [],
    }

    config = {
        "configurable": {
            "thread_id": f"tenant_{mock_security_context.tenant_id}:tnd_pwd_202",
        }
    }

    result = graph.invoke(initial_state, config=config)

    assert "dossier" in result
    dossier = result["dossier"]
    assert dossier.overall_verdict == "NO_GO"
    assert len(dossier.hard_disqualifiers) >= 1
    assert any("blacklisted" in d.lower() for d in dossier.hard_disqualifiers)
