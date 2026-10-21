from typing import Any

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from tenderpulse_ai.workflow.nodes import (
    WorkflowNodeContext,
    make_build_structure_node,
    make_candidate_detection_node,
    make_confidence_routing_node,
    make_context_assembly_node,
    make_docling_parse_node,
    make_escalate_human_review_node,
    make_human_review_node,
    make_llm_extraction_node,
    make_postgres_store_node,
    make_rescue_pass_node,
    make_targeted_refine_node,
    make_validation_node,
)
from tenderpulse_ai.workflow.state import ComplianceWorkflowState


def route_verification_outcome(state: ComplianceWorkflowState) -> str:
    """
    Conditional edge router for verification & confidence evaluation:
    - If zero unverified items and confidence >= 0.80: Proceed to Node 8 (PostgreSQL Store).
    - If unverified items exist and retry_count < 2: Route to targeted refinement (Node 5 retry).
    - If unverified items exist and retry_count >= 2 (or score < 0.80): Escalate to human review.
    """
    unverified = state.get("unverified_items", [])
    score = state.get("confidence_score", 1.0)
    retry_count = state.get("retry_count", 0)

    if len(unverified) == 0 and score >= 0.80:
        return "postgres_store"
    elif len(unverified) > 0 and retry_count < 2:
        return "targeted_refine"
    else:
        return "escalate_human_review"


def build_compliance_workflow_graph(
    ctx: WorkflowNodeContext,
    checkpointer: Any | None = None,
):
    """
    Constructs and compiles the 8-Node LangGraph Document Processing Graph.
    Node 1: Docling PDF Parse
    Node 2: Build Document Structure (AST)
    Node 3: Candidate Detection
    Node 4: Context Assembly
    Node 5: LLM Extraction
    Node 6: Deterministic Validation
    Node 7: Confidence Routing (Auto-accept / Reviewer / Human Review)
    Node 8: PostgreSQL Store
    """
    workflow = StateGraph(ComplianceWorkflowState)  # pyrefly: ignore[bad-specialization]

    # 1. Register Nodes
    workflow.add_node("docling_parse", make_docling_parse_node(ctx))
    workflow.add_node("build_structure", make_build_structure_node(ctx))
    workflow.add_node("candidate_detection", make_candidate_detection_node(ctx))
    workflow.add_node("context_assembly", make_context_assembly_node(ctx))
    workflow.add_node("llm_extraction", make_llm_extraction_node(ctx))
    workflow.add_node("rescue_pass", make_rescue_pass_node(ctx))
    workflow.add_node("validation", make_validation_node(ctx))
    workflow.add_node("confidence_routing", make_confidence_routing_node(ctx))
    workflow.add_node("targeted_refine", make_targeted_refine_node(ctx))
    workflow.add_node("escalate_human_review", make_escalate_human_review_node(ctx))
    workflow.add_node("human_review", make_human_review_node(ctx))
    workflow.add_node("postgres_store", make_postgres_store_node(ctx))

    # 2. Add Pipeline Edges
    workflow.add_edge(START, "docling_parse")
    workflow.add_edge("docling_parse", "build_structure")
    workflow.add_edge("build_structure", "candidate_detection")
    workflow.add_edge("candidate_detection", "context_assembly")
    workflow.add_edge("context_assembly", "llm_extraction")
    workflow.add_edge("llm_extraction", "rescue_pass")
    workflow.add_edge("rescue_pass", "validation")
    workflow.add_edge("validation", "confidence_routing")

    # 3. Add Conditional Routing Edge
    workflow.add_conditional_edges(
        "confidence_routing",
        route_verification_outcome,
        {
            "postgres_store": "postgres_store",
            "targeted_refine": "targeted_refine",
            "escalate_human_review": "escalate_human_review",
        },
    )

    # 4. Cycle & Convergence Edges
    workflow.add_edge("targeted_refine", "llm_extraction")
    workflow.add_edge("escalate_human_review", "postgres_store")
    workflow.add_edge("human_review", "postgres_store")
    workflow.add_edge("postgres_store", END)

    # 5. Compile with Checkpointer
    active_checkpointer = checkpointer if checkpointer is not None else MemorySaver()
    return workflow.compile(checkpointer=active_checkpointer)
