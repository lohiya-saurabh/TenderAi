
from typing import Any

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from tenderpulse_ai.workflow.nodes import (
    WorkflowNodeContext,
    make_deterministic_verification_node,
    make_escalate_human_review_node,
    make_human_review_node,
    make_model_extraction_node,
    make_persistence_node,
    make_scoped_retrieval_node,
    make_targeted_refine_node,
)
from tenderpulse_ai.workflow.state import ComplianceWorkflowState


def route_verification_outcome(state: ComplianceWorkflowState) -> str:
    """
    Conditional edge router:
    - If zero unverified items: Proceed to persistence.
    - If unverified items exist and retries < 2: Route to targeted refinement.
    - If unverified items exist and retries >= 2: Escalate to human review.
    """
    unverified = state.get("unverified_items", [])
    if len(unverified) == 0:
        return "persistence"
    elif state.get("retry_count", 0) < 2:
        return "targeted_refine"
    else:
        return "escalate_human_review"


def build_compliance_workflow_graph(
    ctx: WorkflowNodeContext,
    checkpointer: Any | None = None,
):
    """
    Constructs and compiles the First AI Workflow (Tender Compliance Extraction & Verification Loop).
    """
    # pyright: ignore[reportArgumentType]
    workflow = StateGraph(ComplianceWorkflowState)  # type: ignore[arg-type]

    # 1. Add Nodes
    workflow.add_node("scoped_retrieval", make_scoped_retrieval_node(ctx))
    workflow.add_node("model_extraction", make_model_extraction_node(ctx))
    workflow.add_node("deterministic_verification", make_deterministic_verification_node(ctx))
    workflow.add_node("targeted_refine", make_targeted_refine_node(ctx))
    workflow.add_node("escalate_human_review", make_escalate_human_review_node(ctx))
    workflow.add_node("human_review", make_human_review_node(ctx))
    workflow.add_node("persistence", make_persistence_node(ctx))

    # 2. Add Fixed Edges
    workflow.add_edge(START, "scoped_retrieval")
    workflow.add_edge("scoped_retrieval", "model_extraction")
    workflow.add_edge("model_extraction", "deterministic_verification")

    # 3. Add Conditional Routing Edge
    workflow.add_conditional_edges(
        "deterministic_verification",
        route_verification_outcome,
        {
            "persistence": "persistence",
            "targeted_refine": "targeted_refine",
            "escalate_human_review": "escalate_human_review",
        },
    )

    # 4. Add Cycle & Convergence Edges
    workflow.add_edge("targeted_refine", "model_extraction")
    workflow.add_edge("escalate_human_review", "human_review")
    workflow.add_edge("human_review", "persistence")
    workflow.add_edge("persistence", END)

    # 5. Compile with Checkpointer
    active_checkpointer = checkpointer if checkpointer is not None else MemorySaver()
    return workflow.compile(checkpointer=active_checkpointer)
