from __future__ import annotations

from typing import Any

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from tenderpulse_ai.decision.workflow.nodes import (
    DecisionWorkflowContext,
    make_commercial_risk_node,
    make_deterministic_evaluation_node,
    make_evidence_retrieval_node,
    make_executive_synthesis_node,
    make_human_review_gate_node,
    make_review_routing_node,
)
from tenderpulse_ai.decision.workflow.state import BidDecisionWorkflowState


def route_decision_state(state: BidDecisionWorkflowState) -> str:
    """
    Conditional edge router for Bid/No-Bid Decisioning:
    - If requires_human_review is True: Route to human_review_gate before executive synthesis.
    - Else: Route directly to executive_synthesis.
    """
    if state.get("requires_human_review", False):
        return "human_review_gate"
    return "executive_synthesis"


def build_bid_decision_workflow_graph(
    ctx: DecisionWorkflowContext,
    checkpointer: Any | None = None,
):
    """
    Constructs and compiles the stateful LangGraph Bid/No-Bid Decision Workflow.

    Graph Architecture:
    START
      │
      ▼
    evidence_retrieval (Node 1: Evidence RAG & Company Vault fact matching)
      │
      ▼
    deterministic_evaluation (Node 2: Pure arithmetic, counts, and statutory gating)
      │
      ▼
    commercial_risk (Node 3: EMD liquidity, LD penalties, timeline risks)
      │
      ▼
    review_routing (Node 4: Ambiguity and uncertainty trigger analysis)
      │
      ├───────────────────────────────┐
      │ (requires_human_review)       │ (standard flow)
      ▼                               ▼
    human_review_gate (Node 5)   executive_synthesis (Node 6)
      │                               ▲
      └───────────────────────────────┘
                                      │
                                     END
    """
    workflow = StateGraph(BidDecisionWorkflowState)  # pyrefly: ignore[bad-specialization]

    # 1. Register Nodes
    workflow.add_node("evidence_retrieval", make_evidence_retrieval_node(ctx))
    workflow.add_node("deterministic_evaluation", make_deterministic_evaluation_node(ctx))
    workflow.add_node("commercial_risk", make_commercial_risk_node(ctx))
    workflow.add_node("review_routing", make_review_routing_node(ctx))
    workflow.add_node("human_review_gate", make_human_review_gate_node(ctx))
    workflow.add_node("executive_synthesis", make_executive_synthesis_node(ctx))

    # 2. Add Linear Pipeline Edges
    workflow.add_edge(START, "evidence_retrieval")
    workflow.add_edge("evidence_retrieval", "deterministic_evaluation")
    workflow.add_edge("deterministic_evaluation", "commercial_risk")
    workflow.add_edge("commercial_risk", "review_routing")

    # 3. Add Conditional Routing Edge
    workflow.add_conditional_edges(
        "review_routing",
        route_decision_state,
        {
            "human_review_gate": "human_review_gate",
            "executive_synthesis": "executive_synthesis",
        },
    )

    # 4. Convergence & Terminal Edges
    workflow.add_edge("human_review_gate", "executive_synthesis")
    workflow.add_edge("executive_synthesis", END)

    # 5. Compile with State Checkpointer
    active_checkpointer = checkpointer if checkpointer is not None else MemorySaver()
    return workflow.compile(checkpointer=active_checkpointer)
