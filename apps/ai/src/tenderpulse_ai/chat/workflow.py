from __future__ import annotations

import datetime
import json
import logging
import re
from typing import Any, TypedDict

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from tenderpulse_ai.chat.schemas import (
    CitationDto,
    CitationSourceType,
    FinancialSummaryCardDto,
    ToolCallDto,
)
from tenderpulse_ai.chat.tools import (
    STOP_WORDS,
    ChatToolRegistry,
    extract_keywords,
    get_synonyms_for_tokens,
    is_out_of_domain,
)
from tenderpulse_ai.security.context import SecurityContext
from tenderpulse_ai.security.sanitizer import UNTRUSTED_DATA_DIRECTIVE, SecretSanitizer

logger = logging.getLogger("tenderpulse_ai.chat.workflow")

_llm_client_instance: Any | None = None


def get_llm_client() -> Any | None:
    """Provides a reusable singleton OpenAICompatibleLlmClient instance."""
    global _llm_client_instance
    from tenderpulse_ai.config import settings

    if not settings.llm_api_key:
        return None
    if _llm_client_instance is None:
        from tenderpulse_ai.infrastructure.llm.openai_compatible_client import (
            OpenAICompatibleLlmClient,
        )

        _llm_client_instance = OpenAICompatibleLlmClient(
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
            model=settings.llm_model,
            timeout=12.0,
        )
    return _llm_client_instance


class ChatWorkflowState(TypedDict, total=False):
    query: str
    bid_id: str | None
    company_id: str | None
    conversation_id: str
    history: list[dict[str, Any]]
    security_context: SecurityContext
    context: dict[str, Any]
    routed_intent: str
    tools_to_call: list[str]
    tool_args: dict[str, dict[str, Any]]
    tool_calls: list[ToolCallDto]
    retrieved_evidence: list[dict[str, Any]]
    citations: list[CitationDto]
    uncertainties: list[dict[str, Any]]
    financial_summary: FinancialSummaryCardDto | None
    response_content: str
    suggested_followups: list[str]
    audit_events: list[dict[str, Any]]
    query_rewritten: bool


VALID_INTENTS = {
    "TENDER_SPEC",
    "FINANCIAL_AUDIT",
    "STATUTORY_CREDENTIALS",
    "COMPANY_EXPERIENCE",
    "COMPLIANCE_CHECK",
    "BID_DECISION",
    "GREETING",
    "GENERAL",
}

VALID_TOOLS = {
    "search_tender_documents",
    "search_company_evidence",
    "get_company_profile",
    "get_company_financials",
    "calculate_financial_capacity",
    "get_company_experience",
    "get_compliance_matrix",
    "get_bid_decision_summary",
}


def _turn_reset_state(
    intent: str,
    tools_to_call: list[str],
    tool_args: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """Resets turn-scoped state keys so MemorySaver checkpoints don't bleed across turns."""
    return {
        "routed_intent": intent,
        "tools_to_call": tools_to_call,
        "tool_args": tool_args,
        "tool_calls": [],
        "retrieved_evidence": [],
        "citations": [],
        "uncertainties": [],
        "financial_summary": None,
        "query_rewritten": False,
    }


async def intent_routing_node(state: ChatWorkflowState) -> dict[str, Any]:
    """Analyzes the user's prompt and conversation context via LLM Semantic Router
    with domain thesaurus fallback to classify intent and select tools with optimized arguments."""
    query = state.get("query", "").strip()
    q_lower = query.lower()

    if is_out_of_domain(query):
        return _turn_reset_state(
            intent="GENERAL",
            tools_to_call=["search_tender_documents", "search_company_evidence"],
            tool_args={},
        )

    history = state.get("history", [])

    financial_keywords = [
        "turnover",
        "financial",
        "revenue",
        "balance sheet",
        "net worth",
        "maat",
        "udin",
        "ca cert",
        "audit",
        "audited",
    ]
    capacity_keywords = [
        "capacity",
        "bid capacity",
        "solvency",
        "solvency certificate",
        "financial capacity",
        "commitments",
        "assessed capacity",
    ]
    experience_keywords = [
        "past project",
        "past projects",
        "similar work",
        "work order",
        "completion certificate",
        "credential",
        "highway project",
        "bridge project",
        "similar experience",
        "track record",
        "executed",
    ]
    compliance_keywords = [
        "stamp paper",
        "notariz",
        "notary",
        "execution rule",
        "compliance matrix",
        "integrity pact",
        "affidavit",
        "signing authority",
        "non-blacklisting",
        "debarment",
    ]
    decision_keywords = [
        "decision",
        "verdict",
        "disqualif",
        "qualify",
        "should we",
        "risk",
        "gap",
        "go",
        "no-go",
        "pursue",
    ]
    tender_keywords = [
        "emd",
        "earnest money",
        "deposit",
        "liquidated damages",
        "penalty",
        "penalties",
        "late",
        "delay",
        "delays",
        "liquidated",
        "damages",
        "ld",
        "compensation",
        "extension",
        "penalty cap",
        "submission deadline",
        "deadline",
        "technical specification",
        "specification",
        "nit",
        "rfp",
        "gcc",
        "scc",
        "tender clause",
        "tender spec",
        "clause",
    ]
    statutory_keywords = [
        "gst",
        "gstin",
        "pan",
        "cin",
        "tax",
        "registration",
        "incorporation",
        "udyam",
        "msme",
        "statutory",
        "credential",
        "credentials",
        "who are we",
        "our legal name",
        "legal name",
        "roc",
    ]
    greeting_keywords = [
        "hello",
        "hi",
        "hey",
        "yo",
        "sup",
        "what's up",
        "whats up",
        "hiya",
        "howdy",
        "namaste",
        "greetings",
        "help",
        "who are you",
        "how are you",
        "how do you do",
        "how're you",
        "doing well",
        "good morning",
        "good afternoon",
        "good evening",
        "good day",
        "thanks",
        "thank you",
    ]

    is_greeting_match = (
        any(re.search(rf"\b{re.escape(k)}\b", q_lower) for k in greeting_keywords)
        and not any(k in q_lower for k in capacity_keywords)
        and not any(k in q_lower for k in financial_keywords)
        and not any(re.search(rf"\b{re.escape(k)}\b", q_lower) for k in statutory_keywords)
        and not any(k in q_lower for k in experience_keywords)
        and not any(k in q_lower for k in compliance_keywords)
        and not any(k in q_lower for k in decision_keywords)
        and not any(k in q_lower for k in tender_keywords)
    )

    if is_greeting_match:
        return _turn_reset_state(
            intent="GREETING",
            tools_to_call=[],
            tool_args={},
        )

    # 1. Semantic Router via Live LLM when API key is configured
    llm_client = get_llm_client()
    if llm_client:
        try:
            system_prompt = (
                "You are the Query Router & Tool Orchestrator for TenderPulse AI, an intelligent procurement copilot for infrastructure bids.\n"
                "Analyze the user's message and multi-turn conversation history to determine their intent and select the appropriate retrieval tools with optimized search arguments.\n\n"
                "Supported Intents:\n"
                "- TENDER_SPEC: Questions about tender requirements, technical specifications, clauses (e.g. liquidated damages, EMD, completion periods, deadlines, penalty cap).\n"
                "- FINANCIAL_AUDIT: Questions regarding financial capacity, annual turnover (MAAT), CA certificates, UDIN, solvency, net worth, or follow-up questions asking if past turnover or financial numbers are sufficient or meet tender thresholds.\n"
                "- STATUTORY_CREDENTIALS: Questions regarding company registration, GSTIN, PAN, CIN, incorporation, or legal identity.\n"
                "- COMPANY_EXPERIENCE: Questions regarding past projects, similar work experience, completed contracts, or client completion certificates.\n"
                "- COMPLIANCE_CHECK: Questions regarding compliance matrix, mandatory execution rules, stamp paper denominations, notarization, or affidavits.\n"
                "- BID_DECISION: High-level pursuit questions on whether the organization should bid overall (Go / No-Go decision verdict, overall readiness score, pursuit risks, or general bid strategy).\n"
                "- GREETING: Casual conversational greetings, hellos, introductions, or pleasantries without specific procurement requests.\n"
                "- GENERAL: General inquiries or ungrounded questions.\n\n"
                "Available Tools:\n"
                '- search_tender_documents: args {"query": "<optimized search keywords with procurement synonyms>"}\n'
                '- search_company_evidence: args {"query": "<optimized search keywords with credentials/vault terms>"}\n'
                "- get_company_profile: args {}\n"
                "- get_company_financials: args {}\n"
                "- calculate_financial_capacity: args {}\n"
                '- get_company_experience: args {"query": "<search query for specific project types>"}\n'
                "- get_compliance_matrix: args {}\n"
                "- get_bid_decision_summary: args {}\n\n"
                "Respond ONLY with a valid JSON object matching this schema:\n"
                "{\n"
                '  "intent": "TENDER_SPEC | FINANCIAL_AUDIT | STATUTORY_CREDENTIALS | COMPANY_EXPERIENCE | COMPLIANCE_CHECK | BID_DECISION | GREETING | GENERAL",\n'
                '  "tools": [\n'
                '    {"name": "<tool_name>", "args": { ... }}\n'
                "  ],\n"
                '  "reasoning": "<brief justification>"\n'
                "}"
            )

            messages = [
                {"role": "system", "content": system_prompt},
                *[
                    {"role": m.get("role", "user"), "content": str(m.get("content", ""))}
                    for m in history[-3:]
                ],
                {"role": "user", "content": query},
            ]

            llm_reply = await llm_client.generate_chat_completion(
                messages=messages, temperature=0.1
            )
            if llm_reply:
                m_json = re.search(r"\{.*\}", llm_reply, re.DOTALL)
                if m_json:
                    parsed = json.loads(m_json.group(0))
                    intent_cand = str(parsed.get("intent", "")).strip().upper()
                    recent_text = " ".join(str(m.get("content", "")).lower() for m in history[-2:])
                    if any(
                        term in q_lower for term in ("sufficient", "enough", "satisfy", "meet")
                    ) and any(k in recent_text for k in financial_keywords + capacity_keywords):
                        intent_cand = "FINANCIAL_AUDIT"
                    if intent_cand in VALID_INTENTS:
                        routed_tools: list[str] = []
                        tool_args: dict[str, dict[str, Any]] = {}
                        for t in parsed.get("tools", []):
                            t_name = t.get("name")
                            if t_name in VALID_TOOLS:
                                routed_tools.append(t_name)
                                if isinstance(t.get("args"), dict):
                                    tool_args[t_name] = t["args"]

                        if intent_cand == "STATUTORY_CREDENTIALS":
                            if "get_company_profile" not in routed_tools:
                                routed_tools.append("get_company_profile")
                            if "search_company_evidence" not in routed_tools:
                                routed_tools.append("search_company_evidence")
                                tool_args.setdefault("search_company_evidence", {"query": query})
                        elif intent_cand == "FINANCIAL_AUDIT":
                            if "get_company_financials" not in routed_tools:
                                routed_tools.append("get_company_financials")
                            if "calculate_financial_capacity" not in routed_tools:
                                routed_tools.append("calculate_financial_capacity")
                        elif intent_cand == "COMPANY_EXPERIENCE":
                            if "get_company_experience" not in routed_tools:
                                routed_tools.append("get_company_experience")
                        elif intent_cand == "COMPLIANCE_CHECK":
                            if "get_compliance_matrix" not in routed_tools:
                                routed_tools.append("get_compliance_matrix")
                        elif intent_cand == "BID_DECISION":
                            if "get_bid_decision_summary" not in routed_tools:
                                routed_tools.append("get_bid_decision_summary")
                        elif intent_cand == "TENDER_SPEC":
                            if "search_tender_documents" not in routed_tools:
                                routed_tools.append("search_tender_documents")
                                tool_args.setdefault("search_tender_documents", {"query": query})

                        if routed_tools or intent_cand in ("GREETING", "GENERAL"):
                            return _turn_reset_state(
                                intent=intent_cand,
                                tools_to_call=list(dict.fromkeys(routed_tools)),
                                tool_args=tool_args,
                            )
        except Exception as err:
            logger.debug(
                "[ChatWorkflow] Semantic router LLM call failed or timed out, falling back to thesaurus router: %s",
                err,
            )

    # 2. Intelligent Domain Thesaurus Semantic Fallback Router (Offline / Test Execution)
    tools: list[str] = []
    intent = "GENERAL"

    if any(k in q_lower for k in capacity_keywords):
        intent = "FINANCIAL_AUDIT"
        tools.extend(
            [
                "calculate_financial_capacity",
                "get_company_financials",
                "search_tender_documents",
                "search_company_evidence",
            ]
        )
    elif any(k in q_lower for k in financial_keywords):
        intent = "FINANCIAL_AUDIT"
        tools.extend(
            [
                "get_company_financials",
                "calculate_financial_capacity",
                "search_tender_documents",
                "search_company_evidence",
            ]
        )
    elif any(re.search(rf"\b{re.escape(k)}\b", q_lower) for k in statutory_keywords):
        intent = "STATUTORY_CREDENTIALS"
        tools.extend(["get_company_profile", "search_company_evidence", "search_tender_documents"])
    elif any(k in q_lower for k in experience_keywords) or "experience" in q_lower:
        intent = "COMPANY_EXPERIENCE"
        tools.extend(
            ["get_company_experience", "search_tender_documents", "search_company_evidence"]
        )
    elif any(k in q_lower for k in compliance_keywords):
        intent = "COMPLIANCE_CHECK"
        tools.extend(["get_compliance_matrix", "search_tender_documents"])
    elif any(k in q_lower for k in decision_keywords):
        intent = "BID_DECISION"
        tools.extend(
            [
                "get_bid_decision_summary",
                "get_compliance_matrix",
                "calculate_financial_capacity",
                "search_tender_documents",
            ]
        )
    elif any(k in q_lower for k in tender_keywords):
        intent = "TENDER_SPEC"
        tools.append("search_tender_documents")
    elif history:
        # Contextual continuity from recent turns
        recent_text = " ".join(str(m.get("content", "")).lower() for m in history[-2:])
        if any(k in recent_text for k in capacity_keywords):
            intent = "FINANCIAL_AUDIT"
            tools.extend(
                [
                    "calculate_financial_capacity",
                    "get_company_financials",
                    "search_tender_documents",
                    "search_company_evidence",
                ]
            )
        elif any(k in recent_text for k in financial_keywords):
            intent = "FINANCIAL_AUDIT"
            tools.extend(
                [
                    "get_company_financials",
                    "calculate_financial_capacity",
                    "search_tender_documents",
                    "search_company_evidence",
                ]
            )
        elif any(re.search(rf"\b{re.escape(k)}\b", recent_text) for k in statutory_keywords):
            intent = "STATUTORY_CREDENTIALS"
            tools.extend(
                ["get_company_profile", "search_company_evidence", "search_tender_documents"]
            )
        elif any(k in recent_text for k in experience_keywords):
            intent = "COMPANY_EXPERIENCE"
            tools.extend(
                ["get_company_experience", "search_tender_documents", "search_company_evidence"]
            )
        elif any(k in recent_text for k in compliance_keywords):
            intent = "COMPLIANCE_CHECK"
            tools.extend(["get_compliance_matrix", "search_tender_documents"])
        elif any(k in recent_text for k in decision_keywords):
            intent = "BID_DECISION"
            tools.extend(
                ["get_bid_decision_summary", "get_compliance_matrix", "search_tender_documents"]
            )
        elif any(k in recent_text for k in tender_keywords):
            intent = "TENDER_SPEC"
            tools.append("search_tender_documents")
        else:
            intent = "GENERAL"
            tools.extend(["search_tender_documents", "search_company_evidence"])
    else:
        intent = "GENERAL"
        tools.extend(["search_tender_documents", "search_company_evidence"])

    # Build semantic domain-expanded search arguments for retrieval tools
    tokens = extract_keywords(query)
    substantive_tokens = [w for w in tokens if w not in STOP_WORDS]
    synonyms = get_synonyms_for_tokens(substantive_tokens or tokens)
    expanded_search_query = " ".join(
        list(dict.fromkeys((substantive_tokens or tokens) + list(synonyms)))
    )

    tool_args: dict[str, dict[str, Any]] = {}
    if "search_tender_documents" in tools:
        tool_args["search_tender_documents"] = {"query": expanded_search_query or query}
    if "search_company_evidence" in tools:
        tool_args["search_company_evidence"] = {"query": expanded_search_query or query}
    if "get_company_experience" in tools:
        tool_args["get_company_experience"] = {"query": query}

    deduped_tools = list(dict.fromkeys(tools))
    return _turn_reset_state(
        intent=intent,
        tools_to_call=deduped_tools,
        tool_args=tool_args,
    )


def tool_calling_node(state: ChatWorkflowState) -> dict[str, Any]:
    """Executes routed AI worker tools scoped strictly by security context synchronously on in-memory context."""
    registry = ChatToolRegistry(
        state.get("context"), security_context=state.get("security_context")
    )
    query = state.get("query", "")
    bid_id = state.get("bid_id")
    company_id = state.get("company_id")
    tool_args_map = state.get("tool_args") or {}

    def _execute_tool(tool_name: str) -> tuple[ToolCallDto, list[dict[str, Any]]]:
        args: dict[str, Any] = {}
        result: Any = None
        custom_args = tool_args_map.get(tool_name) or {}
        evidence_items: list[dict[str, Any]] = []

        if tool_name == "search_tender_documents":
            search_query = custom_args.get("query") or query
            args = {"query": search_query, "bid_id": bid_id, "limit": 4}
            result = registry.search_tender_documents(**args)
            for item in result:
                evidence_items.append({"type": "TENDER", "data": item})

        elif tool_name == "search_company_evidence":
            search_query = custom_args.get("query") or query
            args = {"query": search_query, "company_id": company_id, "limit": 3}
            result = registry.search_company_evidence(**args)
            for item in result:
                evidence_items.append({"type": "EVIDENCE", "data": item})

        elif tool_name == "get_company_financials":
            args = {"company_id": company_id}
            result = registry.get_company_financials(**args)
            evidence_items.append({"type": "FINANCIALS", "data": result})

        elif tool_name == "calculate_financial_capacity":
            ctx = state.get("context") or {}
            args = {
                "company_id": company_id,
                "required_turnover_inr_crores": ctx.get("required_turnover_inr_crores")
                or ctx.get("requiredTurnoverInrCrores"),
                "solvency_amount_inr_crores": ctx.get("solvency_amount_inr_crores")
                or ctx.get("solvencyAmountInrCrores"),
                "required_solvency_inr_crores": ctx.get("required_solvency_inr_crores")
                or ctx.get("requiredSolvencyInrCrores"),
                "net_worth_inr_crores": ctx.get("net_worth_inr_crores")
                or ctx.get("netWorthInrCrores"),
                "required_net_worth_inr_crores": ctx.get("required_net_worth_inr_crores")
                or ctx.get("requiredNetWorthInrCrores"),
                "existing_commitments_b_inr_crores": ctx.get("existing_commitments_b_inr_crores")
                or ctx.get("existingCommitmentsBInrCrores", 0.0),
                "completion_years_n": ctx.get("completion_years_n")
                or ctx.get("completionYearsN", 2.0),
                "capacity_multiplier": ctx.get("capacity_multiplier")
                or ctx.get("capacityMultiplier", 2.0),
                "completion_date": ctx.get("completion_date") or ctx.get("completionDate"),
                "max_completion_date": ctx.get("max_completion_date")
                or ctx.get("maxCompletionDate"),
            }
            result = registry.calculate_financial_capacity(**args)
            evidence_items.append({"type": "CAPACITY", "data": result})

        elif tool_name == "get_company_experience":
            exp_query = custom_args.get("query") or query
            args = {"company_id": company_id, "query": exp_query}
            result = registry.get_company_experience(**args)
            for item in result:
                evidence_items.append({"type": "EXPERIENCE", "data": item})

        elif tool_name == "get_compliance_matrix":
            args = {"bid_id": bid_id}
            result = registry.get_compliance_matrix(**args)
            for item in result:
                evidence_items.append({"type": "COMPLIANCE", "data": item})

        elif tool_name == "get_bid_decision_summary":
            args = {"bid_id": bid_id, "company_id": company_id}
            result = registry.get_bid_decision_summary(**args)
            evidence_items.append({"type": "DECISION", "data": result})

        elif tool_name == "get_company_profile":
            args = {"company_id": company_id}
            result = registry.get_company_profile(**args)
            evidence_items.append({"type": "PROFILE", "data": result})

        return ToolCallDto(tool_name=tool_name, arguments=args, result=result), evidence_items

    results = [_execute_tool(t) for t in state.get("tools_to_call", [])]

    tool_calls: list[ToolCallDto] = []
    retrieved_evidence: list[dict[str, Any]] = []

    # Check for compiled OKF tender concept graph before search
    if bid_id:
        from tenderpulse_ai.chat.okf_registry import get_tender_okf

        okf_bundle = get_tender_okf(bid_id)
        if okf_bundle and getattr(okf_bundle, "nodes", None):
            q_lower = query.lower()
            q_tokens = [w.lower() for w in re.findall(r"\w+", query) if len(w) > 2]
            scored_nodes: list[tuple[float, dict[str, Any]]] = []
            for node in okf_bundle.nodes.values():
                node_dict = (
                    node.model_dump()
                    if hasattr(node, "model_dump")
                    else (node if isinstance(node, dict) else vars(node))
                )
                searchable_text = (
                    f"{node_dict.get('title', '')} {node_dict.get('category', '')} "
                    f"{node_dict.get('description', '')} {node_dict.get('verbatim_quote', '')} "
                    f"{node_dict.get('canonical_ref_id', '')}"
                ).lower()

                score = sum(1.0 for token in q_tokens if token in searchable_text)
                if "pbg" in q_lower and (
                    "performance" in searchable_text
                    or "pbg" in searchable_text
                    or "guarantee" in searchable_text
                ):
                    score += 5.0
                if "emd" in q_lower and (
                    "earnest" in searchable_text
                    or "emd" in searchable_text
                    or "deposit" in searchable_text
                ):
                    score += 5.0

                if score > 0:
                    scored_nodes.append((score, node_dict))

            scored_nodes.sort(key=lambda x: x[0], reverse=True)
            for score, nd in scored_nodes[:3]:
                retrieved_evidence.append(
                    {
                        "type": "OKF_CONCEPT",
                        "score": score,
                        "data": nd,
                    }
                )

    for call, ev_list in results:
        tool_calls.append(call)
        retrieved_evidence.extend(ev_list)

    return {
        "tool_calls": tool_calls,
        "retrieved_evidence": retrieved_evidence,
    }


async def query_rewrite_node(state: ChatWorkflowState) -> dict[str, Any]:
    """Expands and rewrites search queries when initial tender document retrieval yielded empty evidence.
    Leverages domain thesaurus and LLM reformulation to retry chunk retrieval with broadened scope."""
    query = state.get("query", "")
    bid_id = state.get("bid_id")
    registry = ChatToolRegistry(
        state.get("context"), security_context=state.get("security_context")
    )

    tokens = extract_keywords(query)
    synonyms = get_synonyms_for_tokens(tokens)
    rewritten_query = " ".join(list(dict.fromkeys(tokens + list(synonyms))))

    llm_client = get_llm_client()
    if llm_client:
        try:
            rewrite_prompt = (
                "You are an expert procurement search query optimizer. Given this user question about a tender:\n"
                f'"{query}"\n'
                "Extract the core technical terms and standard Indian procurement keywords (e.g. EMD, MAAT, GCC, Liquidated Damages, Completion) "
                "as a space-separated search query without punctuation or explanations."
            )
            llm_result = await llm_client.generate_chat_completion(
                messages=[{"role": "user", "content": rewrite_prompt}]
            )
            if llm_result and len(llm_result.strip()) > 3:
                rewritten_query = llm_result.strip()
        except Exception as e:
            logger.debug("[ChatWorkflow] LLM query rewrite fallback to thesaurus: %s", e)

    results = registry.search_tender_documents(query=rewritten_query, bid_id=bid_id, limit=4)
    retrieved_evidence = list(state.get("retrieved_evidence", []))
    for item in results:
        retrieved_evidence.append({"type": "TENDER", "data": item})

    tool_calls = list(state.get("tool_calls", []))
    tool_calls.append(
        ToolCallDto(
            tool_name="search_tender_documents",
            arguments={"query": rewritten_query, "bid_id": bid_id, "limit": 4, "retry": True},
            result=results,
        )
    )

    return {
        "query_rewritten": True,
        "retrieved_evidence": retrieved_evidence,
        "tool_calls": tool_calls,
    }


def citation_generation_node(state: ChatWorkflowState) -> dict[str, Any]:
    """Generates deterministic, verified citations linking tender clauses and company vault proof."""
    query = state.get("query", "")
    if is_out_of_domain(query):
        return {"citations": []}

    citations: list[CitationDto] = []
    seen_quotes: set[str] = set()
    counter = 1

    for ev in state.get("retrieved_evidence", []):
        ev_type = ev.get("type")
        data = ev.get("data", {})

        if ev_type == "TENDER":
            quote = data.get("content", "").strip()
            if quote and quote not in seen_quotes:
                seen_quotes.add(quote)
                citations.append(
                    CitationDto(
                        citation_id=f"cit-tender-{counter}",
                        source_type=CitationSourceType.TENDER_DOCUMENT,
                        document_id=data.get("documentId", "doc-tender"),
                        document_name=data.get("documentName", "NIT_Document.pdf"),
                        page_number=int(data.get("pageNumber", 1)),
                        clause_reference=data.get("clauseReference"),
                        verbatim_quote=quote,
                        confidence_score=0.98,
                        bounding_box=data.get("boundingBox"),
                    )
                )
        elif ev_type == "OKF_CONCEPT":
            prov = data.get("provenance") or {}
            quote = (data.get("verbatim_quote") or data.get("description") or "").strip()
            if quote and quote not in seen_quotes:
                seen_quotes.add(quote)
                citations.append(
                    CitationDto(
                        citation_id=f"cit-okf-{counter}",
                        source_type=CitationSourceType.TENDER_DOCUMENT,
                        document_id=prov.get("sourceDocumentId", "doc-tender"),
                        document_name=prov.get("sourceFileName", "Tender_Document.pdf"),
                        page_number=int(prov.get("pageNumber", 1)),
                        clause_reference=prov.get("clauseReference"),
                        verbatim_quote=quote,
                        confidence_score=float(prov.get("confidenceScore", 0.99)),
                        bounding_box=prov.get("boundingBox"),
                    )
                )
                counter += 1

        elif ev_type == "EVIDENCE":
            quote = data.get("content", "").strip()
            if quote and quote not in seen_quotes:
                seen_quotes.add(quote)
                citations.append(
                    CitationDto(
                        citation_id=f"cit-evidence-{counter}",
                        source_type=CitationSourceType.COMPANY_EVIDENCE,
                        document_id=data.get("documentId", "doc-evidence"),
                        document_name=data.get("documentName", "Company_Evidence.pdf"),
                        page_number=int(data.get("pageNumber", 1)),
                        clause_reference=data.get("evidenceType") or "Vault Record",
                        verbatim_quote=quote,
                        confidence_score=0.96,
                        bounding_box=data.get("boundingBox"),
                    )
                )
                counter += 1

        elif ev_type == "PROFILE":
            legal_name = data.get("legalName", "Company")
            gstin = data.get("gstin", "")
            pan = data.get("pan", "")
            quote = f"Statutory Registration Profile for {legal_name}. GSTIN: {gstin}, PAN: {pan}."
            if quote not in seen_quotes:
                seen_quotes.add(quote)
                citations.append(
                    CitationDto(
                        citation_id=f"cit-evidence-{counter}",
                        source_type=CitationSourceType.COMPANY_EVIDENCE,
                        document_id=data.get("companyId", "doc-statutory-profile"),
                        document_name="Company_Statutory_Profile",
                        page_number=1,
                        clause_reference="Statutory Credentials",
                        verbatim_quote=quote,
                        confidence_score=0.99,
                    )
                )
                counter += 1

    return {"citations": citations}


def uncertainty_verification_node(state: ChatWorkflowState) -> dict[str, Any]:
    """Deterministically identifies missing evidence, shortfalls, or ambiguous clauses."""
    uncertainties: list[dict[str, Any]] = []
    query = state.get("query", "").lower()
    intent = state.get("routed_intent", "")

    if is_out_of_domain(query):
        uncertainties.append(
            {
                "type": "LACK_OF_EVIDENCE",
                "summary": f"No verifiable documentary evidence or clause found in the tender documents or company vault regarding '{query.strip()}'.",
            }
        )

    # Check for known execution rule hazards (e.g. stamp paper, notarization)
    compliance_items = [
        e["data"] for e in state.get("retrieved_evidence", []) if e.get("type") == "COMPLIANCE"
    ]
    for item in compliance_items:
        rules = item.get("executionRules") or {}
        if rules.get("notarizationRequired") and item.get("status") == "FLAGGED":
            uncertainties.append(
                {
                    "type": "MANDATORY_NOTARIZATION",
                    "summary": f"{item.get('title')} requires physical Notarized execution on Stamp Paper prior to bid submission.",
                    "item_id": item.get("id"),
                }
            )
        if rules.get("stampPaperRequired") and item.get("status") == "FLAGGED":
            denom = rules.get("stampPaperDenominationInr", 100)
            uncertainties.append(
                {
                    "type": "STAMP_PAPER_REQUIRED",
                    "summary": f"{item.get('title')} requires Non-Judicial Stamp Paper of INR {denom}.",
                    "item_id": item.get("id"),
                }
            )

    # Check financial gaps
    if intent == "FINANCIAL_AUDIT":
        fin_evidence = next(
            (
                e["data"]
                for e in state.get("retrieved_evidence", [])
                if e.get("type") == "FINANCIALS"
            ),
            None,
        )
        if fin_evidence and not fin_evidence.get("auditedUdin"):
            uncertainties.append(
                {
                    "type": "MISSING_UDIN",
                    "summary": "CA Certificate is missing a valid 18-digit UDIN required by Indian procurement statutory norms.",
                }
            )

    # Anti-hallucination verification: reserve LACK_OF_EVIDENCE strictly for out-of-domain queries.
    # For legitimate procurement queries where a clause is not in ingested documents,
    # do not flag LACK_OF_EVIDENCE so the Copilot can answer conversationally as an experienced bidding consultant.
    return {"uncertainties": uncertainties}


def _build_financial_summary(state: ChatWorkflowState) -> FinancialSummaryCardDto | None:
    """Builds a unified, deterministic FinancialSummaryCardDto for UI rendering."""
    if state.get("routed_intent") != "FINANCIAL_AUDIT":
        return None
    evidence_items = state.get("retrieved_evidence", [])
    fin = next((e["data"] for e in evidence_items if e.get("type") == "FINANCIALS"), {})
    avg_turnover = fin.get("averageTurnoverInrCrores")

    if avg_turnover is None:
        return FinancialSummaryCardDto(
            evaluated=False,
            metric_name="Minimum Average Annual Turnover (MAAT)",
            required_value="Pending Evaluation",
            actual_value="No Records",
            verdict="NOT_EVALUATED",
            details="No audited turnover records or CA certificates uploaded in company vault.",
        )

    cap_data = next((e["data"] for e in evidence_items if e.get("type") == "CAPACITY"), {})
    req_turnover = (
        cap_data.get("requiredTurnoverInrCrores")
        or state.get("context", {}).get("required_turnover_inr_crores")
        or state.get("context", {}).get("requiredTurnoverInrCrores")
    )
    if req_turnover is not None:
        req_num = float(req_turnover)
        required_val = f"INR {req_num:.2f} Cr"
        verdict = "PASS" if avg_turnover >= req_num else "FAIL"
    else:
        required_val = "INR 25.00 Cr"
        verdict = "PASS" if avg_turnover >= 25.0 else "FAIL"

    actual_val = f"INR {avg_turnover:.2f} Cr"
    udin_str = fin.get("auditedUdin") or "Pending UDIN Verification"

    return FinancialSummaryCardDto(
        evaluated=True,
        metric_name="Minimum Average Annual Turnover (MAAT)",
        required_value=required_val,
        actual_value=actual_val,
        verdict=verdict,
        udin=udin_str,
        details="Audited 3-year average turnover across preceding financial years based on CA Certificate.",
    )


def _synthesize_deterministic_template(
    state: ChatWorkflowState,
    citations: list[CitationDto] | None = None,
    uncertainties: list[dict[str, Any]] | None = None,
    intent: str | None = None,
    query: str | None = None,
    sec_ctx: SecurityContext | None = None,
) -> tuple[str, FinancialSummaryCardDto | None, list[str], list[CitationDto]]:
    if citations is None:
        citations = list(state.get("citations", []))
    if uncertainties is None:
        uncertainties = list(state.get("uncertainties", []))
    if intent is None:
        intent = state.get("routed_intent") or "GENERAL"
    if query is None:
        query = state.get("query", "")
    if sec_ctx is None:
        sec_ctx = state.get("security_context")

    raw_tokens = [w.lower() for w in re.findall(r"\w+", query) if len(w) > 2]
    substantive_kws = [
        k
        for k in raw_tokens
        if k not in STOP_WORDS
        and k
        not in (
            "tender",
            "document",
            "documents",
            "bid",
            "bids",
            "clause",
            "what",
            "where",
            "our",
            "company",
            "have",
            "possess",
        )
    ]

    lines: list[str] = []
    financial_summary: FinancialSummaryCardDto | None = None
    suggested_followups: list[str] = []
    matching_gst_doc: dict[str, Any] | None = None

    okf_evidence = [
        e["data"] for e in state.get("retrieved_evidence", []) if e.get("type") == "OKF_CONCEPT"
    ]
    if okf_evidence and intent not in ("GREETING", "STATUTORY_CREDENTIALS"):
        lines.append("### Verified Tender Knowledge Graph (OKF) & Grounded Response")
        lines.append("Based on the compiled Open Knowledge Format (OKF) tender concept graph:")
        for node in okf_evidence:
            cat = node.get("category", "TENDER")
            title = node.get("title", "Requirement")
            desc = node.get("description", "")
            quote = node.get("verbatim_quote", "")
            lines.append(f"\n- **{cat}: {title}**")
            if desc:
                lines.append(f"  {desc}")
            if quote:
                lines.append(f'  > "{quote}"')
        suggested_followups = [
            "Are there any conflicting clauses or addenda for these requirements?",
            "What company evidence is required to satisfy these criteria?",
        ]
        return "\n".join(lines), None, suggested_followups, citations

    # Greeting Synthesis
    if intent == "GREETING":
        lines.append("Hello! I am your **TenderPulse AI Copilot**.")
        lines.append("\nI can assist you with:")
        lines.append(
            "- **Tender Clause Analysis**: EMD, liquidated damages, submission deadlines, and technical specifications."
        )
        lines.append(
            "- **Company Vault & Statutory Credentials**: GSTIN, PAN, CIN, ISO certificates, and CA turnover verification."
        )
        lines.append(
            "- **Bid Qualification & Readiness**: Assessing financial capacity and similar work experience against tender eligibility."
        )
        lines.append(
            "- **Compliance & Execution Rules**: Non-blacklisting affidavits, stamp paper denominations, and notarization mandates."
        )
        lines.append("\nHow can I assist you with your bid pursuit today?")
        suggested_followups = [
            "What are our verified GST and statutory credentials?",
            "What is our 3-year average turnover according to our CA certificate?",
            "What are the stamp paper and notarization rules for this bid?",
        ]

    # Statutory Credentials & Registration Synthesis
    elif intent == "STATUTORY_CREDENTIALS":
        prof = next(
            (e["data"] for e in state.get("retrieved_evidence", []) if e.get("type") == "PROFILE"),
            {},
        )
        if not prof:
            registry = ChatToolRegistry(state.get("context"), security_context=sec_ctx)
            prof = registry.get_company_profile(state.get("company_id"))

        legal_name = prof.get("legalName") or prof.get("companyName") or ""
        gstin = prof.get("gstin") or ""
        pan = prof.get("pan") or ""
        cin = prof.get("cin") or ""
        constitution = prof.get("constitution") or ""
        gstin_verified_at = prof.get("gstinVerifiedAt")

        evidence_items = [
            e["data"] for e in state.get("retrieved_evidence", []) if e.get("type") == "EVIDENCE"
        ]

        # Prioritize matching GST / statutory registration document
        matching_gst_doc = next(
            (
                d
                for d in evidence_items
                if re.search(
                    r"gst|gstin|tax|vat|registration",
                    f"{d.get('documentName', '')} {d.get('evidenceType', '')} {d.get('content', '')}",
                    re.I,
                )
            ),
            None,
        )

        if not gstin and not pan and not cin and not matching_gst_doc:
            lines.append("### Statutory Credentials Status")
            lines.append(
                f"No verified GSTIN, PAN, or statutory credentials were found for **{legal_name or 'your company'}**."
            )
            lines.append("")
            lines.append(
                "> **Action Required:** Please add and verify your GSTIN and company credentials in your Company Profile."
            )
            citations = []
            suggested_followups = [
                "How do I add our GSTIN to the company profile?",
                "What documents are required for statutory verification?",
            ]
        else:
            verified_text = (
                f" (Verified: {gstin_verified_at})"
                if gstin_verified_at
                else " (Unverified · Pending Verification)"
            )
            lines.append(f"Statutory credentials on file for **{legal_name or 'your company'}**:")
            if gstin:
                lines.append(f"- **GSTIN**: `{gstin}`{verified_text} [^1]")
            if legal_name:
                lines.append(f"- **Legal Name**: {legal_name}")
            if pan:
                lines.append(f"- **Permanent Account Number (PAN)**: `{pan}`")
            if cin:
                lines.append(f"- **Corporate Identification Number (CIN)**: `{cin}`")
            if constitution:
                lines.append(f"- **Constitution**: {constitution}")
            if prof.get("udyamId"):
                lines.append(f"- **Udyam / MSME Registration**: `{prof.get('udyamId')}`")

            if matching_gst_doc:
                doc_name = (
                    matching_gst_doc.get("documentName")
                    or matching_gst_doc.get("fileName")
                    or "GST_Registration_Certificate.pdf"
                )
                doc_cit_idx = next(
                    (i + 1 for i, c in enumerate(citations) if c.document_name == doc_name),
                    2 if len(citations) >= 2 else 1,
                )
                lines.append(
                    f"- **Vault Document**: `{doc_name}` (Category: GST Registration) [^{doc_cit_idx}]"
                )
            elif evidence_items:
                doc_name = (
                    evidence_items[0].get("documentName")
                    or evidence_items[0].get("fileName")
                    or "Company_Evidence.pdf"
                )
                doc_cit_idx = next(
                    (i + 1 for i, c in enumerate(citations) if c.document_name == doc_name),
                    2 if len(citations) >= 2 else 1,
                )
                lines.append(
                    f"- **Vault Document**: `{doc_name}` (Category: Company Evidence) [^{doc_cit_idx}]"
                )
            else:
                lines.append(
                    "- **Vault Document**: *No GST certificate document currently uploaded in vault.*"
                )

            lines.append(
                "\nThese statutory credentials can be cross-referenced against tender eligibility or tax compliance requirements. Would you like me to check the tender documents for tax and registration clauses?"
            )

            suggested_followups = [
                "Does our GST registration satisfy the tender's state-specific registration clause?",
                "What is our turnover qualification according to the CA certificate?",
                "Review tender documents for tax and statutory compliance clauses.",
            ]

    # Financial Synthesis
    elif intent == "FINANCIAL_AUDIT":
        financial_summary = _build_financial_summary(state)
        fin = next(
            (
                e["data"]
                for e in state.get("retrieved_evidence", [])
                if e.get("type") == "FINANCIALS"
            ),
            {},
        )
        avg_turnover = fin.get("averageTurnoverInrCrores")

        if avg_turnover is None or not financial_summary or not financial_summary.evaluated:
            lines.append("### Financial Turnover & Qualification Analysis")
            lines.append(
                "No audited financial turnover records or CA certificates have been uploaded for your company yet."
            )
            lines.append("")
            lines.append(
                "> **Action Required:** Please upload your CA-audited balance sheet or turnover certificate with valid UDIN to your Company Vault to evaluate financial eligibility."
            )
            citations = []
            suggested_followups = [
                "How do I upload audited turnover certificates?",
                "What other requirements exist in this tender?",
            ]
        else:
            required_val = financial_summary.required_value
            actual_val = financial_summary.actual_value
            verdict = financial_summary.verdict
            udin_str = financial_summary.udin or "Pending UDIN Verification"

            turnover_records = fin.get("turnoverRecords", [])
            records_str = (
                ", ".join(
                    f"FY {r.get('financialYear')}: INR {r.get('turnoverInrCrores')} Cr"
                    for r in turnover_records
                    if r.get("turnoverInrCrores") is not None
                )
                if turnover_records
                else ""
            )

            lines.append("### Financial Turnover & Qualification Analysis")
            lines.append(
                "Based on the tender requirements and your uploaded financial records [^1]:"
            )
            lines.append(
                f"- **Tender Requirement**: {required_val} average turnover across the preceding 3 financial years."
            )
            lines.append(
                f"- **Company Track Record**: **{actual_val}**"
                + (f" ({records_str})" if records_str else "")
                + "."
            )
            lines.append(f"- **Statutory Grounding**: Certified under UDIN `{udin_str}`.")
            lines.append(
                f"- **Eligibility Verdict**: **{verdict}** — {'The company satisfies the financial threshold.' if verdict == 'PASS' else 'The company does not satisfy the financial threshold.'}"
            )

            suggested_followups = [
                "What is the required EMD and performance bank guarantee?",
                "Do we satisfy the similar project experience criteria?",
                "What are the stamp paper and notarization rules for this bid?",
            ]

    # Experience Synthesis
    elif intent == "COMPANY_EXPERIENCE":
        exp_items = [
            e["data"] for e in state.get("retrieved_evidence", []) if e.get("type") == "EXPERIENCE"
        ]
        domain_kws = [
            kw
            for kw in substantive_kws
            if kw not in ("experience", "project", "work", "past", "similar")
        ]
        matched_exp = []
        if domain_kws and exp_items:
            for exp in exp_items:
                text = (
                    exp.get("projectName", "")
                    + " "
                    + exp.get("scope", "")
                    + " "
                    + exp.get("client", "")
                ).lower()
                if any(kw in text for kw in domain_kws):
                    matched_exp.append(exp)

        if domain_kws and not matched_exp:
            lines.append("### Grounded Evidence Assessment")
            lines.append(
                f'No past project credentials, work orders, or completion certificates for **"{query}"** were found in the Company Evidence Vault.'
            )
            lines.append("")
            lines.append(
                "> **Anti-Hallucination Policy:** TenderPulse AI strictly verifies documentary credentials. Company records do not indicate qualification in this specific domain."
            )
            citations = []
            if not any(u.get("type") == "LACK_OF_EVIDENCE" for u in uncertainties):
                uncertainties.append(
                    {
                        "type": "LACK_OF_EVIDENCE",
                        "summary": f"No documentary evidence found regarding '{query.strip()}'.",
                    }
                )
        elif not exp_items:
            lines.append("### Past Project Experience & Credentials")
            lines.append(
                "No past project credentials, work orders, or completion certificates were found in your company profile."
            )
            lines.append("")
            lines.append(
                "> **Action Required:** Please upload your past work completion certificates or work orders to your Company Vault to evaluate technical eligibility."
            )
            citations = []
            suggested_followups = [
                "How do I upload project credentials to the vault?",
                "What are the technical qualification criteria for this tender?",
            ]
        else:
            lines.append("### Past Project Experience & Credentials")
            lines.append("Based on the company vault project track record [^1]:")
            for idx, exp in enumerate(exp_items[:3]):
                val = (
                    f" valued at INR {exp.get('completedValueInrCrores')} Cr"
                    if exp.get("completedValueInrCrores")
                    else ""
                )
                lines.append(
                    f"- **{exp.get('title', exp.get('projectName', 'Project'))}** ({exp.get('client', 'Client')}){val} — Completed: {exp.get('completionDate', 'N/A')}. Scope: {exp.get('scope', 'General Works')}."
                )

            suggested_followups = [
                "Are our ISO certifications valid for this submission?",
                "What is the overall Bid/No-Bid decision recommendation?",
                "Show me the compliance items that need manual review.",
            ]

    # Compliance & Execution Synthesis
    elif intent == "COMPLIANCE_CHECK":
        comp_items = [
            e["data"] for e in state.get("retrieved_evidence", []) if e.get("type") == "COMPLIANCE"
        ]
        domain_kws = [
            kw
            for kw in substantive_kws
            if kw not in ("rule", "rules", "compliance", "matrix", "execution", "statutory")
        ]
        matched_comp = []
        if domain_kws and comp_items:
            for item in comp_items:
                text = (item.get("title", "") + " " + item.get("description", "")).lower()
                if any(kw in text for kw in domain_kws):
                    matched_comp.append(item)

        if domain_kws and not matched_comp:
            lines.append("### Grounded Evidence Assessment")
            lines.append(
                f'No compliance obligations, statutory affidavits, or execution rules regarding **"{query}"** exist in the active tender documents.'
            )
            lines.append("")
            lines.append(
                "> **Anti-Hallucination Policy:** The tender documentation does not specify conditions for this topic."
            )
            citations = []
            if not any(u.get("type") == "LACK_OF_EVIDENCE" for u in uncertainties):
                uncertainties.append(
                    {
                        "type": "LACK_OF_EVIDENCE",
                        "summary": f"No documentary evidence found regarding '{query.strip()}'.",
                    }
                )
        elif not comp_items:
            lines.append("### Compliance & Execution Rules")
            lines.append(
                "No extracted compliance items or mandatory clauses have been generated for this tender yet."
            )
            lines.append("")
            lines.append(
                "> **Action Required:** Please upload tender documents (NIT, RFP) to extract compliance matrix items."
            )
            citations = []
            suggested_followups = [
                "How do I upload tender documents for extraction?",
                "What is the status of document processing for this bid?",
            ]
        else:
            lines.append("### Compliance Matrix & Execution Obligations")
            lines.append("Here is the status of key statutory and tender execution rules [^1]:")
            for idx, item in enumerate(comp_items[:4]):
                flag = " ⚠️ Flagged" if item.get("flagged") else " ✅ Clear"
                category = item.get("category", "Statutory")
                req_title = item.get("requirement", item.get("title", "Requirement"))
                status = item.get("status", "PENDING")
                lines.append(f"- **{category}**: {req_title} — *Status: {status}*{flag}")

                exec_rules = item.get("executionRules") or item.get("execution_rules") or {}
                rule_details: list[str] = []
                if exec_rules.get("stampPaperRequired"):
                    denom = exec_rules.get("stampPaperDenominationInr")
                    denom_str = f" (INR {denom})" if denom else ""
                    rule_details.append(f"Stamp Paper Required{denom_str}")
                if exec_rules.get("notarizationRequired"):
                    rule_details.append("Notarized Affidavit Required")
                if exec_rules.get("signingAuthorityRank"):
                    rule_details.append(f"Signatory: {exec_rules.get('signingAuthorityRank')}")

                if rule_details:
                    lines.append(f"  - **Execution Mandates:** {', '.join(rule_details)}")

            suggested_followups = [
                "What are the liquidated damages penalties in this contract?",
                "Show me the verified turnover certificate details.",
                "Can we generate the executive bid sign-off dossier?",
            ]

    # Bid Decision Synthesis
    elif intent == "BID_DECISION":
        dec = next(
            (e["data"] for e in state.get("retrieved_evidence", []) if e.get("type") == "DECISION"),
            {},
        )
        if not dec:
            registry = ChatToolRegistry(state.get("context"), security_context=sec_ctx)
            dec = registry.get_bid_decision_summary(state.get("bid_id"), state.get("company_id"))

        verdict = dec.get("verdict", "NOT_EVALUATED")
        readiness = dec.get("readinessScore", 0.0)
        reasons_pursue = dec.get("reasonsToPursue", [])
        reasons_not = dec.get("reasonsNotToPursue", [])
        hard_disq = dec.get("hardDisqualifiers", [])
        comm_risks = dec.get("commercialRisks", [])
        missing_info = dec.get("missingInformation", [])

        lines.append("### Bid Intelligence & Pursuit Recommendation")
        if verdict == "NOT_EVALUATED":
            lines.append("- **Evaluation Status**: **NOT EVALUATED**")
            lines.append("- **Readiness Score**: **Not Evaluated (0 / 100)**")
            lines.append(
                "\nNo deterministic bid decision evaluation has been executed for this tender yet."
            )
            lines.append(
                "\n> **Next Step:** Upload tender documents (NIT, RFP) and trigger the Bid Decision Evaluation on the Bid Detail page to calculate eligibility, readiness score, and risk matrix."
            )
            citations = []
            suggested_followups = [
                "What documents are required to run bid evaluation?",
                "What are the general technical requirements for this tender?",
            ]
        else:
            score_pct = int(round(readiness * 100)) if readiness <= 1.0 else int(round(readiness))
            lines.append(f"- **AI Verdict**: **{verdict.replace('_', ' ')}**")
            lines.append(f"- **Readiness Score**: **{score_pct} / 100**")
            if reasons_pursue:
                lines.append("- **Key Strengths / Reasons to Pursue**:")
                for r in reasons_pursue[:3]:
                    lines.append(f"  - {r}")
            if reasons_not:
                lines.append("- **Reasons Not to Pursue**:")
                for r in reasons_not[:3]:
                    lines.append(f"  - {r}")
            if hard_disq:
                lines.append("- **Hard Disqualifiers**:")
                for d in hard_disq[:3]:
                    lines.append(f"  - {d}")
            if comm_risks:
                lines.append("- **Commercial & Delivery Risks**:")
                for c in comm_risks[:2]:
                    title = c.get("title") if isinstance(c, dict) else str(c)
                    lines.append(f"  - {title}")
            if missing_info:
                lines.append("- **Action Required / Missing Information**:")
                for m in missing_info[:2]:
                    req = (
                        m.get("requirementTitle") or m.get("missingFactor")
                        if isinstance(m, dict)
                        else str(m)
                    )
                    lines.append(f"  - {req}")

            suggested_followups = [
                "What clauses carry commercial risks or delivery penalties?",
                "Verify all statutory certificates in the company vault.",
                "Review tender documents for liquidated damages.",
            ]

    # Default / Tender Specification Synthesis
    else:
        tender_items = [
            e["data"] for e in state.get("retrieved_evidence", []) if e.get("type") == "TENDER"
        ]
        evidence_items = [
            e["data"] for e in state.get("retrieved_evidence", []) if e.get("type") == "EVIDENCE"
        ]
        profile_items = [
            e["data"] for e in state.get("retrieved_evidence", []) if e.get("type") == "PROFILE"
        ]

        if evidence_items or profile_items:
            lines.append("### Company Credentials & Vault Records")
            lines.append(f'Here are the verified records from your company vault for *"{query}"*:')
            for idx, item in enumerate(evidence_items[:3]):
                doc_name = item.get("documentName") or item.get("fileName", "Vault Document")
                content_preview = str(item.get("content", "")).strip()
                if len(content_preview) > 120:
                    content_preview = content_preview[:117] + "..."
                lines.append(f"- **{doc_name}** [^{idx + 1}]: {content_preview}")
            for p in profile_items[:1]:
                lines.append(
                    f"- **Company Profile**: Legal Name: {p.get('legalName')}, GSTIN: `{p.get('gstin')}`, PAN: `{p.get('pan')}`."
                )
            lines.append(
                "\nThese records are verified and available for cross-referencing against bid requirements."
            )
            suggested_followups = [
                "What is our turnover qualification according to the CA certificate?",
                "What are the specific execution rules and stamp paper requirements?",
                "Summarize the overall Bid/No-Bid assessment.",
            ]
        elif tender_items:
            lines.append("### Tender Insights & Grounded Response")
            lines.append("Based on the parsed tender documents and company vault credentials:")
            for idx, item in enumerate(tender_items[:2]):
                clause = item.get("clauseReference") or "Tender Clause"
                sec = item.get("sectionTitle", "")
                sec_display = f" ({sec})" if sec else ""
                content = item.get("content", "")
                lines.append(f"- **{clause}{sec_display}** [^{idx + 1}]: {content}")
            suggested_followups = [
                "What is our turnover qualification according to the CA certificate?",
                "What are the specific execution rules and stamp paper requirements?",
                "Summarize the overall Bid/No-Bid assessment.",
            ]
        else:
            if is_out_of_domain(query):
                lines.append("### Grounded Evidence Assessment")
                lines.append(
                    f'No verifiable evidence or clause mentioning **"{query}"** was found in the ingested tender documents (NIT, RFP, GCC, SCC) or the company credentials vault.'
                )
                lines.append("")
                lines.append(
                    "> **Anti-Hallucination Policy:** TenderPulse AI strictly grounds all answers in verified procurement clauses. Because no evidentiary record exists for this inquiry, this information cannot be substantiated without official documentary addenda."
                )
                citations = []
                if not any(u.get("type") == "LACK_OF_EVIDENCE" for u in uncertainties):
                    uncertainties.append(
                        {
                            "type": "LACK_OF_EVIDENCE",
                            "summary": f"No documentary evidence found regarding '{query.strip()}'.",
                        }
                    )
            else:
                lines.append("### Procurement Consultation & Document Assessment")
                lines.append(
                    f'I reviewed the ingested tender documents and company vault credentials for **"{query}"**, but could not locate a matching clause or certificate in the current project files.'
                )
                lines.append("\n**Standard Procurement Practice & Context:**")
                lines.append(
                    "- In standard government and infrastructure tenders (e.g., NHAI, CPWD, MoRTH), this subject is typically governed by the General Conditions of Contract (GCC) or Special Conditions of Contract (SCC)."
                )
                lines.append(
                    "- If omitted from the Notice Inviting Tender (NIT) or RFP volume, model standard bidding document (SBD) guidelines usually apply."
                )
                lines.append("\n**Recommended Next Steps:**")
                lines.append(
                    "- Submit a formal Pre-Bid Query during the tender clarification window requesting official clarification from the tendering authority."
                )
                lines.append(
                    "- Verify whether a Corrigendum / Addendum has been issued modifying this provision."
                )
                citations = []

            suggested_followups = [
                "What is our turnover qualification according to the CA certificate?",
                "What are the specific execution rules and stamp paper requirements?",
                "Summarize the overall Bid/No-Bid assessment.",
            ]

        if uncertainties:
            lines.append("")
            lines.append("**Attention Required:**")
            for u in uncertainties:
                lines.append(f"- {u['summary']}")

    content = "\n".join(lines)
    return content, financial_summary, suggested_followups, citations


async def response_synthesis_node(state: ChatWorkflowState) -> dict[str, Any]:
    """Synthesizes structured Markdown response with citations, financial cards, and suggestions.
    Attempts live LLM synthesis first with explicit footnote mapping, falling back to deterministic template."""
    intent = state.get("routed_intent", "GENERAL")
    citations = list(state.get("citations", []))
    uncertainties = list(state.get("uncertainties", []))
    query = state.get("query", "")
    sec_ctx = state.get("security_context")

    if is_out_of_domain(query) and not uncertainties:
        uncertainties.append(
            {
                "type": "LACK_OF_EVIDENCE",
                "summary": "This query does not pertain to the ingested tender documents, Indian public procurement regulations, or bidder qualification records.",
            }
        )

    llm_client = get_llm_client()
    llm_succeeded = False
    content = ""
    financial_summary: FinancialSummaryCardDto | None = _build_financial_summary(state)
    suggested_followups: list[str] = []

    if llm_client and intent != "GREETING" and not is_out_of_domain(query):
        citations_context_lines = []
        for idx, cit in enumerate(citations, 1):
            doc = cit.document_name or "Document"
            clause = f", {cit.clause_reference}" if cit.clause_reference else ""
            page = f", Page {cit.page_number}" if cit.page_number else ""
            quote = cit.verbatim_quote.strip() if cit.verbatim_quote else ""
            citations_context_lines.append(f'[^{idx}]: {doc}{clause}{page} - "{quote}"')
        citations_context_str = (
            "\n".join(citations_context_lines) if citations_context_lines else "None"
        )

        system_prompt = (
            "You are TenderPulse AI Copilot, a conversational and intelligent procurement assistant for infrastructure bids. "
            "Respond conversationally, warmly, and professionally using clear Markdown formatting with bullet points. "
            "Ground all facts strictly in the provided retrieved evidence and citations without hallucinating.\n\n"
            "The citations and retrieved evidence arrive in a separate message, numbered [^1], [^2], ...\n\n"
            "Instructions:\n"
            "- When referencing documents, credentials, or clauses from the retrieved evidence, cite them using markdown footnotes like [^1], [^2], corresponding precisely to the citation numbers above.\n"
            "- When referencing documents or certificates from the retrieved evidence, cite their exact file names (e.g. Tata_Projects_GST_Registration.pdf, Audited_Balance_Sheet_and_CA_Certificate_FY25.pdf).\n"
            "- When discussing statutory execution rules, explicitly mention **Stamp Paper** and **Notarized** requirements where applicable.\n"
            "- If requested information (e.g. tender clauses, turnover, or credentials) is NOT present in the retrieved evidence, answer conversationally like an experienced bidding consultant: "
            "explain clearly that the specific clause or record was not identified in the uploaded tender documents, summarize standard Indian procurement practice for this item (e.g. CPWD / NHAI norms), "
            "and advise practical next steps such as submitting a formal pre-bid query or inspecting GCC / corrigenda.\n"
            "Be genuinely helpful, conversational, and direct.\n\n" + UNTRUSTED_DATA_DIRECTIVE
        )

        evidence_items = state.get("retrieved_evidence", [])
        evidence_summary = (
            "\n".join(f"[{e.get('type')}] {e.get('data')}" for e in evidence_items)
            if evidence_items
            else "None (No specific clauses or credentials found in current documents for this query)."
        )

        # Citations and evidence quote uploaded documents, so they never go in the system
        # message: they travel as bounded untrusted context beside the question.
        grounding = (
            "Available citations to ground your answer:\n"
            + SecretSanitizer.wrap_untrusted_context("citations", citations_context_str)
            + "\n\nRetrieved evidence:\n"
            + SecretSanitizer.wrap_untrusted_context("retrieved_evidence", evidence_summary)
        )
        messages = [
            {"role": "system", "content": system_prompt},
            *[
                {"role": m.get("role", "user"), "content": str(m.get("content", ""))}
                for m in state.get("history", [])[-4:]
            ],
            {"role": "user", "content": grounding},
            {"role": "user", "content": query},
        ]

        try:
            llm_reply = await llm_client.generate_chat_completion(messages=messages)
            if llm_reply and len(llm_reply.strip()) > 20:
                content = llm_reply.strip()
                llm_succeeded = True

                # Statutory credentials post-check
                if intent == "STATUTORY_CREDENTIALS":
                    prof = next(
                        (e["data"] for e in evidence_items if e.get("type") == "PROFILE"),
                        {},
                    )
                    statutory_legal_name = prof.get("legalName") or prof.get("companyName") or ""
                    statutory_gstin = prof.get("gstin") or ""
                    if statutory_legal_name and statutory_legal_name not in content:
                        content += f"\n- **Legal Name**: {statutory_legal_name}"
                    if statutory_gstin and statutory_gstin not in content:
                        content += f"\n- **GSTIN**: `{statutory_gstin}`"

                if uncertainties:
                    content += "\n\n**Attention Required:**\n" + "\n".join(
                        f"- {u['summary']}" for u in uncertainties
                    )
                suggested_followups = [
                    "What are the stamp paper and notarization rules for this bid?",
                    "What is our turnover qualification according to the CA certificate?",
                    "Summarize the overall Bid/No-Bid assessment.",
                ]
        except Exception as err:
            logger.warning(
                "[ChatWorkflow] Live LLM chat completion failed, using deterministic synthesis: %s",
                err,
            )

    if not llm_succeeded:
        content, financial_summary, suggested_followups, citations = (
            _synthesize_deterministic_template(
                state, citations, uncertainties, intent, query, sec_ctx
            )
        )

    # Build audit event
    audit_events: list[dict[str, Any]] = []
    if sec_ctx:
        audit_events.append(
            {
                "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
                "tenant_id": sec_ctx.tenant_id,
                "user_id": sec_ctx.user_id,
                "action": "CHAT_QUERY_EXECUTED",
                "entity_type": "ChatConversation",
                "entity_id": state.get("conversation_id", "conv_default"),
                "details": {
                    "intent": intent,
                    "citations_count": len(citations),
                    "tools_called": [t.tool_name for t in state.get("tool_calls", [])],
                },
            }
        )

    return {
        "response_content": content,
        "citations": citations,
        "uncertainties": uncertainties,
        "financial_summary": financial_summary,
        "suggested_followups": suggested_followups,
        "audit_events": audit_events,
    }


def route_after_intent(state: ChatWorkflowState) -> str:
    """Conditional routing: Short-circuits greetings and out-of-domain queries directly to synthesis."""
    intent = state.get("routed_intent", "")
    query = state.get("query", "")
    if intent in ("GREETING", "GENERAL") and (intent == "GREETING" or is_out_of_domain(query)):
        return "response_synthesis"
    return "tool_calling"


def route_after_tools(state: ChatWorkflowState) -> str:
    """Conditional routing: Triggers query rewrite retry loop when tender spec queries yield 0 evidence."""
    intent = state.get("routed_intent", "")
    evidence = state.get("retrieved_evidence", [])
    already_rewritten = state.get("query_rewritten", False)
    if intent == "TENDER_SPEC" and not evidence and not already_rewritten:
        return "query_rewrite"
    return "citation_generation"


def build_chat_workflow_graph(checkpointer: Any | None = None):
    """
    Constructs and compiles the stateful LangGraph Chat Workflow:
    START -> intent_routing -(conditional)-> [response_synthesis | tool_calling]
    tool_calling -(conditional)-> [query_rewrite | citation_generation]
    query_rewrite -> citation_generation -> uncertainty_verification -> response_synthesis -> END
    """
    graph = StateGraph(ChatWorkflowState)

    graph.add_node("intent_routing", intent_routing_node)
    graph.add_node("tool_calling", tool_calling_node)
    graph.add_node("query_rewrite", query_rewrite_node)
    graph.add_node("citation_generation", citation_generation_node)
    graph.add_node("uncertainty_verification", uncertainty_verification_node)
    graph.add_node("response_synthesis", response_synthesis_node)

    graph.add_edge(START, "intent_routing")
    graph.add_conditional_edges(
        "intent_routing",
        route_after_intent,
        {
            "response_synthesis": "response_synthesis",
            "tool_calling": "tool_calling",
        },
    )
    graph.add_conditional_edges(
        "tool_calling",
        route_after_tools,
        {
            "query_rewrite": "query_rewrite",
            "citation_generation": "citation_generation",
        },
    )
    graph.add_edge("query_rewrite", "citation_generation")
    graph.add_edge("citation_generation", "uncertainty_verification")
    graph.add_edge("uncertainty_verification", "response_synthesis")
    graph.add_edge("response_synthesis", END)

    saver = checkpointer or MemorySaver()
    return graph.compile(checkpointer=saver)
