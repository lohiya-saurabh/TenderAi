from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel, Field

from tenderpulse_ai.domain.models import (
    CandidateComplianceItem,
    ExecutionRulesProps,
    ProvenanceProps,
    VerifiedComplianceItem,
)
from tenderpulse_ai.models.llm_client import StructuredLLMClient
from tenderpulse_ai.security.context import SecurityContext
from tenderpulse_ai.tools.page_text import PageTextTool
from tenderpulse_ai.tools.retrieval import DocumentChunk, ScopedRetrievalTool
from tenderpulse_ai.workflow.nodes import WorkflowNodeContext
from tenderpulse_ai.workflow.state import ComplianceWorkflowState


class NormalizedPage(BaseModel):
    page_number: int = Field(..., ge=1)
    text: str = Field(..., min_length=1)


class DocumentExtractionRequest(BaseModel):
    security_context: SecurityContext
    bid_id: str
    document_id: str
    document_type: str = "NIT"
    file_name: str
    pages: list[NormalizedPage]


class DocumentExtractionResponse(BaseModel):
    bid_id: str
    document_id: str
    status: str
    items: list[dict[str, Any]]
    human_review_required: bool
    audit_events: list[dict[str, Any]]


def _extract_clause_reference(text: str, page_no: int) -> str:
    m = re.search(r"\b((?:ITB|BDS|GCC|SCC|Section\s*III|Clause)\s*(?:No\.?)?\s*\d+(?:\.\d+)*)", text, re.IGNORECASE)
    if m:
        return f"{m.group(1).strip()} (Page {page_no})"
    return f"Clause on Page {page_no}"


def _extract_sentence(pattern: str, text: str) -> str | None:
    normalized_text = re.sub(r"\r\n?", "\n", text)
    keyword = re.search(pattern, normalized_text, re.IGNORECASE)
    if keyword:
        line_start = normalized_text.rfind("\n", 0, keyword.start()) + 1
        sentence_start = line_start
        list_items = list(
            re.finditer(r"(?m)^\s*\d+[.)]\s+", normalized_text[: keyword.start()])
        )
        if list_items:
            sentence_start = list_items[-1].start()
            punctuation_search_start = list_items[-1].end()
        else:
            punctuation_search_start = line_start
        preceding_punctuation = max(
            normalized_text.rfind(".", punctuation_search_start, keyword.start()),
            normalized_text.rfind("?", punctuation_search_start, keyword.start()),
            normalized_text.rfind("!", punctuation_search_start, keyword.start()),
        )
        if preceding_punctuation >= punctuation_search_start:
            sentence_start = preceding_punctuation + 1

        period_position = normalized_text.find(".", keyword.end())
        paragraph_position = normalized_text.find("\n\n", keyword.end())
        next_list_item = re.search(
            r"(?m)^\s*\d+[.)]\s+", normalized_text[keyword.end() :]
        )
        end_candidates = [
            position
            for position in (
                period_position + 1 if period_position >= 0 else -1,
                paragraph_position,
                keyword.end() + next_list_item.start() if next_list_item else -1,
            )
            if position >= 0
        ]
        sentence_end = min(end_candidates) if end_candidates else len(normalized_text)

        sentence = normalized_text[sentence_start:sentence_end].strip()
        if len(sentence) > 15:
            # Joining only the selected clause prevents earlier line-wrapped page
            # content from leaking into the provenance quote.
            return re.sub(r"\s+", " ", sentence)

    # If the keyword itself wraps across extracted lines, fall back to normalized
    # text while retaining blank lines as paragraph boundaries.
    normalized_text = re.sub(r"(?<!\n)\n(?!\n)", " ", normalized_text)
    match = re.search(
        r"([^.\n]*?" + pattern + r"[^.\n]*?(?:\.|\n|$))",
        normalized_text,
        re.IGNORECASE,
    )
    if match:
        sentence = match.group(1).strip()
        if len(sentence) > 15:
            return re.sub(r"\s+", " ", sentence)
    return None


def _extract_verbatim_window(keyword_match: str, text: str, max_chars: int = 140) -> str:
    idx = text.lower().find(keyword_match.lower())
    if idx == -1:
        return text[:max_chars].strip()
    start = max(0, idx - 15)
    end = min(len(text), idx + len(keyword_match) + 85)
    snippet = text[start:end].strip()
    return re.sub(r"\s+", " ", snippet)


def _resolve_quote(pattern_str: str, kw_fallback: str, text: str, text_lower: str) -> str:
    sentence = _extract_sentence(pattern_str, text)
    if sentence and " ".join(sentence.lower().split()) in " ".join(text_lower.split()):
        return sentence
    return _extract_verbatim_window(kw_fallback, text)


def default_tender_extractor(system_prompt: str, user_prompt: str) -> list[CandidateComplianceItem]:
    """
    Default intelligent extractor for Indian government tenders.
    Extracts 16 comprehensive compliance criteria with exact substring quotes
    and structured execution rules from tender document page blocks.
    """
    candidates: list[CandidateComplianceItem] = []

    block_pattern = re.compile(
        r'<untrusted_document_data document_id="(?P<doc_id>[^"]+)" page="(?P<page>\d+)">\s*(?P<content>.*?)\s*</untrusted_document_data>',
        re.DOTALL,
    )
    matches = list(block_pattern.finditer(user_prompt))

    blocks = []
    if matches:
        for m in matches:
            blocks.append((m.group("doc_id"), int(m.group("page")), m.group("content")))
    else:
        blocks.append(("doc_current", 1, user_prompt))

    for doc_id, page_no, text in blocks:
        text_lower = text.lower()
        clause_ref = _extract_clause_reference(text, page_no)

        def get_quote(pattern_str: str, kw_fallback: str, cur_text: str = text, cur_lower: str = text_lower) -> str:
            return _resolve_quote(pattern_str, kw_fallback, cur_text, cur_lower)

        # 1. Financial: Bid Security / Earnest Money Deposit (EMD)
        if any(k in text_lower for k in ("earnest money", "emd", "bid security", "tender security")):
            quote = get_quote(r"(?:earnest money|emd|bid security|tender security)", "bid security")
            stamp_req = "stamp" in text_lower
            candidates.append(
                CandidateComplianceItem(
                    category="FINANCIAL",
                    title="Tender & Bid Security (EMD) Guarantee",
                    description="Submission of Earnest Money Deposit / Bid Security as required by tender conditions.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=stamp_req,
                        stamp_paper_denomination_inr=100 if stamp_req else None,
                        notarization_required=stamp_req,
                        signing_authority_rank="Authorized Signatory",
                    ),
                    provenance=ProvenanceProps(
                        source_document_id=doc_id,
                        source_file_name="tender_document.pdf",
                        page_number=page_no,
                        clause_reference=clause_ref,
                        verbatim_quote=quote,
                        confidence_score=0.98,
                    ),
                )
            )

        # 2. Financial: Performance Security (PBG) & Security Deposit
        if any(k in text_lower for k in ("performance security", "performance bank guarantee", "pbg", "contract performance security")):
            quote = get_quote(r"(?:performance security|performance bank guarantee|pbg)", "performance security")
            candidates.append(
                CandidateComplianceItem(
                    category="FINANCIAL",
                    title="Performance Security (PBG) & Security Deposit",
                    description="Submission of Performance Security / Bank Guarantee within stipulated timeline post Letter of Acceptance.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=True,
                        stamp_paper_denomination_inr=100,
                        notarization_required=False,
                        signing_authority_rank="Authorized Signatory with Bank Guarantee",
                    ),
                    provenance=ProvenanceProps(
                        source_document_id=doc_id,
                        source_file_name="tender_document.pdf",
                        page_number=page_no,
                        clause_reference=clause_ref,
                        verbatim_quote=quote,
                        confidence_score=0.97,
                    ),
                )
            )

        # 3. Financial: Annual Turnover & Net Worth
        if any(k in text_lower for k in ("annual turnover", "net worth", "financial capacity", "financial situation and capabilities", "audited financial statements")):
            quote = get_quote(r"(?:annual turnover|net worth|financial capacity|financial situation)", "turnover")
            udin_req = any(u in text_lower for u in ("udin", "chartered accountant", "ca", "audited"))
            candidates.append(
                CandidateComplianceItem(
                    category="TECHNICAL",
                    title="Technical Qualification & Annual Turnover",
                    description="Audited turnover and net worth certificates demonstrating financial threshold capacity.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        udin_required=udin_req,
                        signing_authority_rank="Statutory Auditor / Chartered Accountant",
                    ),
                    provenance=ProvenanceProps(
                        source_document_id=doc_id,
                        source_file_name="tender_document.pdf",
                        page_number=page_no,
                        clause_reference=clause_ref,
                        verbatim_quote=quote,
                        confidence_score=0.96,
                    ),
                )
            )

        # 4. Financial: Bank Solvency & Working Capital
        if any(k in text_lower for k in ("solvency certificate", "bank solvency", "working capital", "cash flow requirement", "liquid assets")):
            quote = get_quote(r"(?:solvency certificate|bank solvency|working capital|cash flow requirement|liquid assets)", "solvency")
            candidates.append(
                CandidateComplianceItem(
                    category="FINANCIAL",
                    title="Bank Solvency & Working Capital Credit Facilities",
                    description="Banker's solvency certificate or line of credit demonstrating adequate working capital liquidity.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        udin_required=False,
                        signing_authority_rank="Scheduled Commercial Bank Branch Manager",
                    ),
                    provenance=ProvenanceProps(
                        source_document_id=doc_id,
                        source_file_name="tender_document.pdf",
                        page_number=page_no,
                        clause_reference=clause_ref,
                        verbatim_quote=quote,
                        confidence_score=0.95,
                    ),
                )
            )

        # 5. Execution: Power of Attorney & Authorized Signatory Authority
        if any(k in text_lower for k in ("power of attorney", "poa for lead member", "written confirmation of authorization")):
            quote = get_quote(r"(?:power of attorney|written confirmation of authorization)", "power of attorney")
            candidates.append(
                CandidateComplianceItem(
                    category="EXECUTION",
                    title="Power of Attorney & Consortium Execution Rules",
                    description="Power of Attorney for Lead Member / Authorized Signatory with Board Resolution.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=True,
                        stamp_paper_denomination_inr=100,
                        notarization_required=True,
                        signing_authority_rank="Board of Directors Resolution / Authorized Signatory",
                    ),
                    provenance=ProvenanceProps(
                        source_document_id=doc_id,
                        source_file_name="tender_document.pdf",
                        page_number=page_no,
                        clause_reference=clause_ref,
                        verbatim_quote=quote,
                        confidence_score=0.97,
                    ),
                )
            )

        # 6. Execution: Joint Venture / Consortium Agreement
        if any(k in text_lower for k in ("joint venture", "jv agreement", "consortium", "jv must meet")):
            quote = get_quote(r"(?:joint venture|jv agreement|consortium)", "joint venture")
            candidates.append(
                CandidateComplianceItem(
                    category="EXECUTION",
                    title="Joint Venture & Consortium Agreement Requirements",
                    description="Joint Venture agreement / Consortium MOU defining lead member equity and joint-and-several liability.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=True,
                        stamp_paper_denomination_inr=100,
                        notarization_required=True,
                        signing_authority_rank="All JV / Consortium Partner Authorized Signatories",
                    ),
                    provenance=ProvenanceProps(
                        source_document_id=doc_id,
                        source_file_name="tender_document.pdf",
                        page_number=page_no,
                        clause_reference=clause_ref,
                        verbatim_quote=quote,
                        confidence_score=0.96,
                    ),
                )
            )

        # 7. Technical: Similar Work Experience
        if any(k in text_lower for k in ("similar work", "past experience", "contracts of similar size", "specific construction experience", "historical contract non-performance")):
            quote = get_quote(r"(?:similar work|past experience|contracts of similar size)", "similar work")
            candidates.append(
                CandidateComplianceItem(
                    category="TECHNICAL",
                    title="Technical Qualification & Similar Work Experience",
                    description="Demonstrated technical threshold capacity through prior successful execution of similar projects.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        udin_required=False,
                        signing_authority_rank="Project Director / Client Superintending Engineer",
                    ),
                    provenance=ProvenanceProps(
                        source_document_id=doc_id,
                        source_file_name="tender_document.pdf",
                        page_number=page_no,
                        clause_reference=clause_ref,
                        verbatim_quote=quote,
                        confidence_score=0.95,
                    ),
                )
            )

        # 8. Technical: Key Technical Personnel
        if any(k in text_lower for k in ("key personnel", "project manager", "personnel capabilities", "minimum qualification of personnel")):
            quote = get_quote(r"(?:key personnel|project manager|personnel capabilities)", "key personnel")
            candidates.append(
                CandidateComplianceItem(
                    category="TECHNICAL",
                    title="Key Technical Personnel & Project Management Team",
                    description="Deployment of qualified key technical personnel including Project Manager and Quality Control Engineers.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        udin_required=False,
                        signing_authority_rank="Authorized Signatory with CV Undertaking",
                    ),
                    provenance=ProvenanceProps(
                        source_document_id=doc_id,
                        source_file_name="tender_document.pdf",
                        page_number=page_no,
                        clause_reference=clause_ref,
                        verbatim_quote=quote,
                        confidence_score=0.95,
                    ),
                )
            )

        # 9. Technical: Essential Equipment & Machinery
        if any(k in text_lower for k in ("equipment capabilities", "plant and machinery", "minimum essential equipment", "availability of equipment")):
            quote = get_quote(r"(?:equipment capabilities|plant and machinery|minimum essential equipment)", "equipment")
            candidates.append(
                CandidateComplianceItem(
                    category="TECHNICAL",
                    title="Essential Plant, Machinery & Equipment Undertaking",
                    description="Availability and ownership or valid lease deed of essential construction equipment and machinery.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        udin_required=False,
                        signing_authority_rank="Authorized Signatory with Ownership/Lease Proof",
                    ),
                    provenance=ProvenanceProps(
                        source_document_id=doc_id,
                        source_file_name="tender_document.pdf",
                        page_number=page_no,
                        clause_reference=clause_ref,
                        verbatim_quote=quote,
                        confidence_score=0.94,
                    ),
                )
            )

        # 10. Legal: Bid Validity Period
        if any(k in text_lower for k in ("period of validity of bids", "bid validity", "bids shall remain valid")):
            quote = get_quote(r"(?:period of validity of bids|bid validity|bids shall remain valid)", "validity")
            candidates.append(
                CandidateComplianceItem(
                    category="LEGAL",
                    title="Bid Validity Period Commitment",
                    description="Bids must remain firm and valid for the stipulated duration post submission deadline.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        udin_required=False,
                        signing_authority_rank="Authorized Signatory",
                    ),
                    provenance=ProvenanceProps(
                        source_document_id=doc_id,
                        source_file_name="tender_document.pdf",
                        page_number=page_no,
                        clause_reference=clause_ref,
                        verbatim_quote=quote,
                        confidence_score=0.98,
                    ),
                )
            )

        # 11. Legal: Delay Damages & Liquidated Damages
        if any(k in text_lower for k in ("delay damages", "liquidated damages", "time for completion")):
            quote = get_quote(r"(?:delay damages|liquidated damages|time for completion)", "damages")
            candidates.append(
                CandidateComplianceItem(
                    category="LEGAL",
                    title="Completion Schedule & Delay Damages (LD)",
                    description="Adherence to completion schedule and acceptance of Liquidated / Delay Damages for non-adherence.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        udin_required=False,
                        signing_authority_rank="Authorized Signatory",
                    ),
                    provenance=ProvenanceProps(
                        source_document_id=doc_id,
                        source_file_name="tender_document.pdf",
                        page_number=page_no,
                        clause_reference=clause_ref,
                        verbatim_quote=quote,
                        confidence_score=0.96,
                    ),
                )
            )

        # 12. Legal: Defect Liability Period (DLP)
        if any(k in text_lower for k in ("defect liability", "maintenance period", "guarantee period")):
            quote = get_quote(r"(?:defect liability|maintenance period|guarantee period)", "defect liability")
            candidates.append(
                CandidateComplianceItem(
                    category="LEGAL",
                    title="Defect Liability Period (DLP) & Maintenance Guarantee",
                    description="Mandatory Defect Liability Period maintenance and warranty obligations post work completion.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        udin_required=False,
                        signing_authority_rank="Authorized Signatory",
                    ),
                    provenance=ProvenanceProps(
                        source_document_id=doc_id,
                        source_file_name="tender_document.pdf",
                        page_number=page_no,
                        clause_reference=clause_ref,
                        verbatim_quote=quote,
                        confidence_score=0.96,
                    ),
                )
            )

        # 13. Legal: Integrity Pact & Anti-Debarment
        if any(k in text_lower for k in ("integrity pact", "litigation history", "non-performance", "debarment", "blacklisting")):
            quote = get_quote(r"(?:integrity pact|litigation history|non-performance|debarment|blacklisting)", "debarment")
            stamp_req = "stamp" in text_lower
            candidates.append(
                CandidateComplianceItem(
                    category="LEGAL",
                    title="Integrity Pact & Non-Blacklisting Declaration",
                    description="Declaration of no contract non-performance, litigation history, or debarment by any government body.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=stamp_req,
                        stamp_paper_denomination_inr=100 if stamp_req else None,
                        notarization_required=stamp_req,
                        signing_authority_rank="Authorized Signatory with Board Resolution",
                    ),
                    provenance=ProvenanceProps(
                        source_document_id=doc_id,
                        source_file_name="tender_document.pdf",
                        page_number=page_no,
                        clause_reference=clause_ref,
                        verbatim_quote=quote,
                        confidence_score=0.98,
                    ),
                )
            )

        # 14. Legal: Conflict of Interest & Non-Collusion
        if any(k in text_lower for k in ("conflict of interest", "non-collusion", "non-engagement of any agent", "middleman or intermediary")):
            quote = get_quote(r"(?:conflict of interest|non-collusion|middleman or intermediary)", "conflict of interest")
            candidates.append(
                CandidateComplianceItem(
                    category="LEGAL",
                    title="Conflict of Interest & Non-Collusion Undertaking",
                    description="Undertaking confirming absence of conflict of interest and non-engagement of intermediaries or agents.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        udin_required=False,
                        signing_authority_rank="Authorized Signatory",
                    ),
                    provenance=ProvenanceProps(
                        source_document_id=doc_id,
                        source_file_name="tender_document.pdf",
                        page_number=page_no,
                        clause_reference=clause_ref,
                        verbatim_quote=quote,
                        confidence_score=0.97,
                    ),
                )
            )

        # 15. Statutory: Make in India (PPP-MII) Local Content
        if any(k in text_lower for k in ("make in india", "local content", "ppp-mii", "class-i local")):
            quote = get_quote(r"(?:make in india|local content|ppp-mii|class-i local)", "local content")
            candidates.append(
                CandidateComplianceItem(
                    category="STATUTORY",
                    title="Make in India (PPP-MII) Local Content Declaration",
                    description="Statutory declaration of local value addition percentage signed by Statutory Auditor.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=True,
                        stamp_paper_denomination_inr=100,
                        notarization_required=True,
                        udin_required=True,
                        signing_authority_rank="Statutory Auditor / Authorized Director",
                    ),
                    provenance=ProvenanceProps(
                        source_document_id=doc_id,
                        source_file_name="tender_document.pdf",
                        page_number=page_no,
                        clause_reference=clause_ref,
                        verbatim_quote=quote,
                        confidence_score=0.99,
                    ),
                )
            )

        # 16. Statutory: GSTIN & PAN Registration
        if any(k in text_lower for k in ("goods and services tax", "gstin", "gst registration", "pan card", "taxes and duties")):
            quote = get_quote(r"(?:goods and services tax|gstin|gst registration|taxes and duties)", "gst")
            candidates.append(
                CandidateComplianceItem(
                    category="STATUTORY",
                    title="GSTIN Registration & Taxes/Duties Compliance",
                    description="Valid Goods & Services Tax (GSTIN) registration certificate and Permanent Account Number (PAN).",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        udin_required=False,
                        signing_authority_rank="Authorized Signatory / Finance Head",
                    ),
                    provenance=ProvenanceProps(
                        source_document_id=doc_id,
                        source_file_name="tender_document.pdf",
                        page_number=page_no,
                        clause_reference=clause_ref,
                        verbatim_quote=quote,
                        confidence_score=0.97,
                    ),
                )
            )

    return candidates


class ProductionExtractionPipeline:
    """
    Executes the end-to-end production AI extraction pipeline:
    Normalized content -> Scoped Retrieval -> LangGraph Compliance Workflow ->
    Deterministic Grounding -> Output formatting.
    """
    def __init__(self, llm_client: StructuredLLMClient | None = None):
        self.llm_client = llm_client or StructuredLLMClient(extractor_fn=default_tender_extractor)

    async def execute(self, request: DocumentExtractionRequest) -> DocumentExtractionResponse:
        sec_ctx = request.security_context
        all_verified_items: list[VerifiedComplianceItem] = []
        all_audit_events: list[dict[str, Any]] = []
        human_review_required = False

        # Process each page through LangGraph compliance workflow
        for page in request.pages:
            retrieval_tool = ScopedRetrievalTool()
            page_text_tool = PageTextTool()

            # Seed physical page text for deterministic verification
            page_text_tool.seed_page(
                tenant_id=sec_ctx.tenant_id,
                document_id=request.document_id,
                page_number=page.page_number,
                text=page.text,
            )

            # Seed chunks for scoped retrieval of this page
            retrieval_tool.seed_chunks([
                DocumentChunk(
                    chunk_id=f"chk_{request.document_id}_{page.page_number}",
                    tenant_id=sec_ctx.tenant_id,
                    document_id=request.document_id,
                    page_number=page.page_number,
                    clause_reference=f"Page {page.page_number}",
                    text=page.text,
                )
            ])

            node_ctx = WorkflowNodeContext(
                retrieval_tool=retrieval_tool,
                page_text_tool=page_text_tool,
                llm_client=self.llm_client,
            )
            from tenderpulse_ai.workflow.graph import build_compliance_workflow_graph
            graph = build_compliance_workflow_graph(node_ctx)

            initial_state: ComplianceWorkflowState = {
                "security_context": sec_ctx.model_dump(),
                "bid_id": request.bid_id,
                "document_id": request.document_id,
                "file_name": request.file_name,
                "page_number": page.page_number,
                "raw_page_text": page.text,
                "pages": [{"page_number": p.page_number, "text": p.text} for p in request.pages],
                "retrieved_chunks": [],
                "extracted_candidates": [],
                "verified_items": [],
                "unverified_items": [],
                "retry_count": 0,
                "error_feedback": None,
                "status": "INITIALIZED",
                "human_review_required": False,
                "audit_events": [],
            }

            thread_id = (
                f"tenant_{sec_ctx.tenant_id}:company_{sec_ctx.company_id or 'unassigned'}:"
                f"run_{sec_ctx.workflow_run_id}:bid_{request.bid_id}:"
                f"doc_{request.document_id}:page_{page.page_number}"
            )
            config: Any = {"configurable": {"thread_id": thread_id}}
            # pyright: ignore[reportCallIssue,reportArgumentType]
            final_state = await graph.ainvoke(initial_state, config=config)

            if final_state.get("human_review_required", False):
                human_review_required = True

            all_verified_items.extend(final_state.get("verified_items", []))
            all_audit_events.extend(final_state.get("audit_events", []))

        # Consolidate and deduplicate items across pages by (category, normalized_title)
        consolidated_map: dict[tuple[str, str], dict[str, Any]] = {}
        for item in all_verified_items:
            payload = item.to_api_payload()
            key = (payload["category"], payload["title"].strip().lower())

            if key not in consolidated_map:
                payload["supporting_pages"] = [payload["provenance"]["pageNumber"]]
                consolidated_map[key] = payload
            else:
                existing = consolidated_map[key]
                page_no = payload["provenance"]["pageNumber"]
                if page_no not in existing["supporting_pages"]:
                    existing["supporting_pages"].append(page_no)

                # Rule fusion (most restrictive requirements win)
                ex_rules = existing["executionRules"]
                new_rules = payload["executionRules"]

                if new_rules.get("stampPaperRequired"):
                    ex_rules["stampPaperRequired"] = True

                new_denom = new_rules.get("stampPaperDenominationInr")
                ex_denom = ex_rules.get("stampPaperDenominationInr")
                if new_denom is not None:
                    ex_rules["stampPaperDenominationInr"] = max(ex_denom or 0, new_denom)

                if new_rules.get("notarizationRequired"):
                    ex_rules["notarizationRequired"] = True

                if new_rules.get("udinRequired"):
                    ex_rules["udinRequired"] = True

                # Keep higher confidence or earlier primary quote
                if payload["provenance"]["confidenceScore"] > existing["provenance"]["confidenceScore"]:
                    existing["provenance"]["confidenceScore"] = payload["provenance"]["confidenceScore"]
                    existing["provenance"]["verbatimQuote"] = payload["provenance"]["verbatimQuote"]
                    existing["provenance"]["sectionOrClause"] = payload["provenance"]["sectionOrClause"]
                    existing["provenance"]["pageNumber"] = payload["provenance"]["pageNumber"]

        formatted_items = list(consolidated_map.values())
        for item in formatted_items:
            pages = sorted(item.pop("supporting_pages", [item["provenance"]["pageNumber"]]))
            if len(pages) > 1:
                item["provenance"]["sectionOrClause"] = f"Clauses across Pages {', '.join(str(p) for p in pages)}"
            item["provenance"]["sourceDocumentId"] = request.document_id
            item["provenance"]["sourceFileName"] = request.file_name

        return DocumentExtractionResponse(
            bid_id=request.bid_id,
            document_id=request.document_id,
            status="REVIEW_READY" if not human_review_required else "HUMAN_REVIEW_REQUIRED",
            items=formatted_items,
            human_review_required=human_review_required,
            audit_events=all_audit_events,
        )
