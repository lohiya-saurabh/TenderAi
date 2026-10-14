import datetime
from typing import Any

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from tenderpulse_ai.dossier.models import (
    DossierWorkflowState,
    ExecutiveBidDossier,
    SpecialistVerdict,
)
from tenderpulse_ai.dossier.subagents import (
    evaluate_commercial_finance,
    evaluate_statutory_legal,
    evaluate_technical_appraisal,
)


def technical_node(state: DossierWorkflowState) -> dict[str, Any]:
    criteria = state.get("tender_criteria", {})
    profile = state.get("company_profile", {})
    appraisal = evaluate_technical_appraisal(criteria, profile)
    return {"appraisals": [appraisal]}


def statutory_node(state: DossierWorkflowState) -> dict[str, Any]:
    criteria = state.get("tender_criteria", {})
    profile = state.get("company_profile", {})
    appraisal = evaluate_statutory_legal(criteria, profile)
    return {"appraisals": [appraisal]}


def finance_node(state: DossierWorkflowState) -> dict[str, Any]:
    criteria = state.get("tender_criteria", {})
    profile = state.get("company_profile", {})
    appraisal = evaluate_commercial_finance(criteria, profile)
    return {"appraisals": [appraisal]}


def director_synthesis_node(state: DossierWorkflowState) -> dict[str, Any]:
    appraisals = state.get("appraisals", [])
    tender_id = state.get("tender_id", "tnd_unknown")
    tender_title = state.get("tender_title", "Untitled Tender")

    appraisal_map = {a.domain.value: a for a in appraisals}
    all_disqualifiers: list[str] = []
    all_actions: list[str] = []

    has_disqualification = False
    has_conditional = False

    for a in appraisals:
        all_disqualifiers.extend(a.hard_disqualifiers)
        all_actions.extend(a.action_items)
        if a.verdict == SpecialistVerdict.DISQUALIFIED:
            has_disqualification = True
        elif a.verdict == SpecialistVerdict.CONDITIONAL:
            has_conditional = True

    # Deterministic Rollup: Worst-State-Wins
    if has_disqualification:
        overall_verdict = "NO_GO"
        readiness_score = 0.35
    elif has_conditional or all_actions:
        overall_verdict = "CONDITIONAL_GO"
        readiness_score = 0.75
    else:
        overall_verdict = "GO"
        readiness_score = 1.0

    director_notes = (
        f"Executive appraisal synthesized across {len(appraisals)} specialist domains. "
        f"Computed overall verdict: {overall_verdict} (Readiness Score: {readiness_score})."
    )

    dossier = ExecutiveBidDossier(
        dossier_id=f"dos_{tender_id}_{int(datetime.datetime.now(datetime.UTC).timestamp())}",
        tender_id=tender_id,
        tender_title=tender_title,
        overall_verdict=overall_verdict,
        composite_readiness_score=readiness_score,
        specialist_appraisals=appraisal_map,
        hard_disqualifiers=all_disqualifiers,
        critical_action_items=all_actions,
        director_synthesis=director_notes,
    )

    audit_entry = {
        "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
        "action": "EXECUTIVE_DOSSIER_SYNTHESIZED",
        "tender_id": tender_id,
        "overall_verdict": overall_verdict,
        "disqualifiers_count": len(all_disqualifiers),
    }

    return {
        "dossier": dossier,
        "audit_events": [audit_entry],
    }


def build_bid_dossier_workflow_graph(checkpointer: Any | None = None):
    """
    Constructs and compiles the Multi-Agent Collaborative Dossier LangGraph.
    Pipeline: START -> technical -> statutory -> finance -> director_synthesis -> END
    """
    workflow = StateGraph(DossierWorkflowState)  # pyrefly: ignore[bad-specialization]

    workflow.add_node("technical_appraiser", technical_node)
    workflow.add_node("statutory_legal", statutory_node)
    workflow.add_node("commercial_finance", finance_node)
    workflow.add_node("director_synthesis", director_synthesis_node)

    workflow.add_edge(START, "technical_appraiser")
    workflow.add_edge("technical_appraiser", "statutory_legal")
    workflow.add_edge("statutory_legal", "commercial_finance")
    workflow.add_edge("commercial_finance", "director_synthesis")
    workflow.add_edge("director_synthesis", END)

    return workflow.compile(checkpointer=checkpointer)
