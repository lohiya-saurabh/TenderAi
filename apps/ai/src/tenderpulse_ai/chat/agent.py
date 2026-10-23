from __future__ import annotations

import datetime
import uuid
from typing import Any

from tenderpulse_ai.chat.schemas import (
    ChatMessageDto,
    ChatMessageRole,
    ChatQueryRequest,
    ChatQueryResponse,
)
from tenderpulse_ai.chat.workflow import ChatWorkflowState, build_chat_workflow_graph


class ChatCopilotAgent:
    """
    Tender Copilot Assistant Agent powered by LangGraph.
    Coordinates intent routing, multi-tool calling across tender documents & company vaults,
    substantive dual-provenance citation generation, and uncertainty verification.
    """

    def __init__(self, checkpointer: Any | None = None):
        self.workflow_graph = build_chat_workflow_graph(checkpointer=checkpointer)

    async def query(self, request: ChatQueryRequest) -> ChatQueryResponse:
        sec_ctx = request.security_context
        conv_id = request.conversation_id or f"conv_{uuid.uuid4().hex[:12]}"

        initial_state: ChatWorkflowState = {
            "query": request.query,
            "bid_id": request.bid_id,
            "company_id": request.company_id,
            "conversation_id": conv_id,
            "history": request.history,
            "security_context": sec_ctx,
            "context": request.context or {},
            "audit_events": [],
        }

        thread_id = f"chat_{conv_id}_{sec_ctx.tenant_id}"
        run_config = {"configurable": {"thread_id": thread_id}}

        final_state = await self.workflow_graph.ainvoke(initial_state, config=run_config)

        message_id = f"msg_{uuid.uuid4().hex[:16]}"
        message = ChatMessageDto(
            id=message_id,
            conversation_id=conv_id,
            organization_id=sec_ctx.tenant_id,
            role=ChatMessageRole.ASSISTANT,
            content=final_state.get("response_content", ""),
            tool_calls=final_state.get("tool_calls"),
            citations=final_state.get("citations"),
            financial_summary=final_state.get("financial_summary"),
            metadata={
                "intent": final_state.get("routed_intent"),
                "uncertainties": final_state.get("uncertainties", []),
                "bidId": request.bid_id,
                "companyId": request.company_id,
            },
            created_at=datetime.datetime.now(datetime.UTC).isoformat(),
        )

        return ChatQueryResponse(
            conversation_id=conv_id,
            message=message,
            suggested_followups=final_state.get("suggested_followups", []),
            audit_events=final_state.get("audit_events", []),
        )
