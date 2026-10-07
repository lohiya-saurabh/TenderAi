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
    download_url: str | None = None
    pages: list[NormalizedPage] = Field(default_factory=list)


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


def is_toc_or_definition(text: str) -> bool:
    clean = text.strip()
    if not clean:
        return True
    if re.search(r"(\.{2,}|\s{3,})\s*\d+\s*$", clean) or re.search(r"\s+\d+\s*$", clean):
        return True
    if re.match(r"^(?:(?:\d+(?:\.\d+)*\.?|[A-Z]\.?|\([a-z\d]+\))\s*)?[A-Za-z\s,/&\-–—]{3,60}\s*\.?$", clean):
        if not re.search(
            r"\b(shall|must|required|furnish|submit|pay|forfeit|deposit|within|days|percent|%|inr|rs|turnover|guarantee)\b",
            clean,
            re.I,
        ):
            return True
    if re.match(r"^[“\"\'\s]*[A-Za-z\s]+[”\"\'\s]*(?:means|shall\s+mean)\b", clean, re.I):
        if not re.search(
            r"\b(contractor shall|bidder shall|must furnish|within \d+ days|will be forfeited)\b",
            clean,
            re.I,
        ):
            return True
    return False


def _extract_operative_clause(
    keywords: list[str],
    text: str,
    page_no: int,
    max_chars: int = 550,
) -> tuple[str, str | None] | None:
    text_norm = re.sub(r"\r\n?", "\n", text)
    kw_regex = re.compile(r"(?:" + "|".join(re.escape(k) for k in keywords) + r")", re.IGNORECASE)
    matches = list(kw_regex.finditer(text_norm))
    if not matches:
        return None

    scored_candidates: list[tuple[int, str, str | None]] = []

    for m in matches:
        start_pos = m.start()
        end_pos = m.end()
        pre_text = text_norm[:start_pos]
        search_start = max(0, start_pos - 400)
        scoped_pre = pre_text[search_start:]

        header_matches = list(
            re.finditer(
                r"(?m)^\s*(?:(?:(?:GC|CC|GCC|SCC|ITB|BDS)\s*)?(?:Sub-Clause|Clause|Section)\s*[\d\.]+|[\d]+(?:\.[\d]+)*[.)]?\s+|[•\-\*]\s+)",
                scoped_pre,
            )
        )

        if header_matches:
            clause_start = search_start + header_matches[-1].start()
        else:
            last_para = scoped_pre.rfind("\n\n")
            if last_para != -1:
                clause_start = search_start + last_para + 2
            else:
                last_nl = scoped_pre.rfind("\n")
                if last_nl != -1 and (len(scoped_pre) - last_nl) < 180:
                    clause_start = search_start + last_nl + 1
                else:
                    last_period = max(scoped_pre.rfind(". "), scoped_pre.rfind(".\n"))
                    if last_period != -1:
                        clause_start = search_start + last_period + 2
                    else:
                        clause_start = search_start

        post_text = text_norm[end_pos:]
        max_search = min(len(post_text), max_chars)
        scoped_post = post_text[:max_search]

        next_item = re.search(
            r"(?m)^\s*(?:(?:(?:GC|CC|GCC|SCC|ITB|BDS)\s*)?(?:Sub-Clause|Clause|Section)\s*[\d\.]+|[\d]+(?:\.[\d]+)*[.)]?\s+|[•\-\*]\s+)",
            scoped_post,
        )
        next_para = scoped_post.find("\n\n")

        end_offsets: list[int] = []
        if next_item and next_item.start() > 20:
            end_offsets.append(next_item.start())
        if next_para != -1 and next_para > 20:
            end_offsets.append(next_para)

        for p_match in re.finditer(r"\.(?:\s+[A-Z]|\s*\n|$)", scoped_post):
            if p_match.start() > 30:
                end_offsets.append(p_match.start() + 1)
                break

        if end_offsets:
            clause_end = end_pos + min(end_offsets)
        else:
            clause_end = min(len(text_norm), clause_start + max_chars)

        raw_clause = text_norm[clause_start:clause_end].strip()
        normalized_clause = re.sub(r"\s+", " ", raw_clause)

        if len(normalized_clause) < 25:
            continue

        if is_toc_or_definition(normalized_clause):
            continue

        score = 0
        if re.search(
            r"\b(shall|must|required to|is required|are required|will be forfeited)\b",
            normalized_clause,
            re.I,
        ):
            score += 10
        if re.search(r"\b(within \d+ days|not later than|\d+\s*(?:percent|%))\b", normalized_clause, re.I):
            score += 5
        if re.search(
            r"\b(bank guarantee|fdr|earnest money|performance security|turnover|solvency)\b",
            normalized_clause,
            re.I,
        ):
            score += 5
        if len(normalized_clause) >= 100:
            score += 5

        ref_match = re.search(
            r"\b((?:(?:GC|CC|GCC|SCC|ITB|BDS)\s*)?(?:Sub-Clause|Clause|Section)\s*[\d\.]+|[\d]+(?:\.[\d]+)+)\b",
            normalized_clause,
            re.I,
        )
        if not ref_match:
            item_match = re.search(r"^\s*(\d+(?:\.\d+)*)[.)]?\s+", normalized_clause)
            clause_ref = f"Clause {item_match.group(1)} (Page {page_no})" if item_match else None
        else:
            clause_ref = f"{ref_match.group(0).strip()} (Page {page_no})"

        scored_candidates.append((score, normalized_clause, clause_ref))

    if not scored_candidates:
        return None

    scored_candidates.sort(key=lambda x: x[0], reverse=True)
    best_score, best_quote, best_ref = scored_candidates[0]
    return best_quote, best_ref


def _extract_verbatim_window(keyword_match: str, text: str, max_chars: int = 140) -> str:
    idx = text.lower().find(keyword_match.lower())
    if idx == -1:
        return text[:max_chars].strip()
    start = max(0, idx - 15)
    end = min(len(text), idx + len(keyword_match) + 85)
    snippet = text[start:end].strip()
    return re.sub(r"\s+", " ", snippet)


def has_operative_obligation(text: str) -> bool:
    return bool(
        re.search(
            r"\b(shall|must|is required to|are required to|required to|will be forfeited|within \d+ days|in the amount of|submits?|furnish|forfeit|penalty|turnover|guarantee)\b",
            text,
            re.I,
        )
    )


def _resolve_quote(
    pattern_str: str,
    kw_fallback: str,
    text: str,
    text_lower: str,
    page_no: int = 1,
    keywords: list[str] | None = None,
) -> tuple[str, str | None] | None:
    all_kws = keywords or [kw_fallback]
    op_res = _extract_operative_clause(all_kws, text, page_no)
    sentence = _extract_sentence(pattern_str, text)

    # 1. If op_res found a rich operative clause with obligation modals, prefer it over a heading/abbreviated sentence
    if op_res and has_operative_obligation(op_res[0]):
        return op_res

    # 2. Try clean single sentence extraction
    if sentence and not is_toc_or_definition(sentence):
        ref_match = re.search(
            r"\b((?:(?:GC|CC|GCC|SCC|ITB|BDS)\s*)?(?:Sub-Clause|Clause|Section)\s*[\d\.]+|[\d]+(?:\.[\d]+)+)\b",
            sentence,
            re.I,
        )
        clause_ref = f"{ref_match.group(0).strip()} (Page {page_no})" if ref_match else None
        return sentence, clause_ref

    # 3. Fallback to op_res even if without explicit modal
    if op_res:
        return op_res

    # 4. If sentence was non-TOC/definition
    if sentence and not is_toc_or_definition(sentence):
        return sentence, None

    # 5. If purely TOC or definition, do NOT return a misleading snippet
    if sentence and is_toc_or_definition(sentence):
        return None

    window = _extract_verbatim_window(kw_fallback, text)
    if not is_toc_or_definition(window):
        return window, None

    return None


def default_tender_extractor(system_prompt: str, user_prompt: str) -> list[CandidateComplianceItem]:
    """
    Default intelligent extractor for Indian government tenders.
    Extracts 16 comprehensive compliance criteria with exact substring quotes
    and structured execution rules from tender document page blocks.
    Filters out Table of Contents and bare definitions, ensuring only operative
    obligations are returned.
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

        def get_clause_and_quote(
            pattern_str: str,
            kw_fallback: str,
            keywords: list[str],
        ) -> tuple[str, str, float] | None:
            res = _resolve_quote(
                pattern_str,
                kw_fallback,
                text,
                text_lower,
                page_no=page_no,
                keywords=keywords,
            )
            if not res:
                return None
            quote_text, specific_ref = res
            final_ref = specific_ref or clause_ref
            conf = 0.98 if any(m in quote_text.lower() for m in ("shall", "must", "required to", "will be")) else 0.95
            return quote_text, final_ref, conf

        # 1. Financial: Bid Security / Earnest Money Deposit (EMD)
        if any(k in text_lower for k in ("earnest money", "emd", "bid security", "tender security")):
            res = get_clause_and_quote(
                r"(?:earnest money|emd|bid security|tender security)",
                "bid security",
                ["earnest money", "emd", "bid security", "tender security"],
            )
            if res:
                quote, ref, conf = res
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
                            clause_reference=ref,
                            verbatim_quote=quote,
                            confidence_score=conf,
                        ),
                    )
                )

        # 2. Financial: Performance Security (PBG) & Security Deposit
        if any(k in text_lower for k in ("performance security", "performance bank guarantee", "pbg", "contract performance security")):
            res = get_clause_and_quote(
                r"(?:performance security|performance bank guarantee|pbg)",
                "performance security",
                ["performance security", "performance bank guarantee", "pbg", "contract performance security"],
            )
            if res:
                quote, ref, conf = res
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
                            clause_reference=ref,
                            verbatim_quote=quote,
                            confidence_score=conf,
                        ),
                    )
                )

        # 3. Financial: Annual Turnover & Net Worth
        if any(k in text_lower for k in ("annual turnover", "net worth", "financial capacity", "financial situation and capabilities", "audited financial statements")):
            res = get_clause_and_quote(
                r"(?:annual turnover|net worth|financial capacity|financial situation)",
                "turnover",
                ["annual turnover", "net worth", "financial capacity", "financial situation and capabilities", "audited financial statements"],
            )
            if res:
                quote, ref, conf = res
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
                            clause_reference=ref,
                            verbatim_quote=quote,
                            confidence_score=conf,
                        ),
                    )
                )

        # 4. Financial: Bank Solvency & Working Capital
        if any(k in text_lower for k in ("solvency certificate", "bank solvency", "working capital", "cash flow requirement", "liquid assets")):
            res = get_clause_and_quote(
                r"(?:solvency certificate|bank solvency|working capital|cash flow requirement|liquid assets)",
                "solvency",
                ["solvency certificate", "bank solvency", "working capital", "cash flow requirement", "liquid assets"],
            )
            if res:
                quote, ref, conf = res
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
                            clause_reference=ref,
                            verbatim_quote=quote,
                            confidence_score=conf,
                        ),
                    )
                )

        # 5. Execution: Power of Attorney & Authorized Signatory Authority
        if any(k in text_lower for k in ("power of attorney", "poa for lead member", "written confirmation of authorization")):
            res = get_clause_and_quote(
                r"(?:power of attorney|written confirmation of authorization)",
                "power of attorney",
                ["power of attorney", "poa for lead member", "written confirmation of authorization"],
            )
            if res:
                quote, ref, conf = res
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
                            clause_reference=ref,
                            verbatim_quote=quote,
                            confidence_score=conf,
                        ),
                    )
                )

        # 6. Execution: Joint Venture / Consortium Agreement
        if any(k in text_lower for k in ("joint venture", "jv agreement", "consortium", "jv must meet")):
            res = get_clause_and_quote(
                r"(?:joint venture|jv agreement|consortium)",
                "joint venture",
                ["joint venture", "jv agreement", "consortium", "jv must meet"],
            )
            if res:
                quote, ref, conf = res
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
                            clause_reference=ref,
                            verbatim_quote=quote,
                            confidence_score=conf,
                        ),
                    )
                )

        # 7. Technical: Similar Work Experience
        if any(k in text_lower for k in ("similar work", "past experience", "contracts of similar size", "specific construction experience", "historical contract non-performance")):
            res = get_clause_and_quote(
                r"(?:similar work|past experience|contracts of similar size)",
                "similar work",
                ["similar work", "past experience", "contracts of similar size", "specific construction experience", "historical contract non-performance"],
            )
            if res:
                quote, ref, conf = res
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
                            clause_reference=ref,
                            verbatim_quote=quote,
                            confidence_score=conf,
                        ),
                    )
                )

        # 8. Technical: Key Technical Personnel
        if any(k in text_lower for k in ("key personnel", "project manager", "personnel capabilities", "minimum qualification of personnel")):
            res = get_clause_and_quote(
                r"(?:key personnel|project manager|personnel capabilities)",
                "key personnel",
                ["key personnel", "project manager", "personnel capabilities", "minimum qualification of personnel"],
            )
            if res:
                quote, ref, conf = res
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
                            clause_reference=ref,
                            verbatim_quote=quote,
                            confidence_score=conf,
                        ),
                    )
                )

        # 9. Technical: Essential Equipment & Machinery
        if any(k in text_lower for k in ("equipment capabilities", "plant and machinery", "minimum essential equipment", "availability of equipment")):
            res = get_clause_and_quote(
                r"(?:equipment capabilities|plant and machinery|minimum essential equipment)",
                "equipment",
                ["equipment capabilities", "plant and machinery", "minimum essential equipment", "availability of equipment"],
            )
            if res:
                quote, ref, conf = res
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
                            clause_reference=ref,
                            verbatim_quote=quote,
                            confidence_score=conf,
                        ),
                    )
                )

        # 10. Legal: Bid Validity Period
        if any(k in text_lower for k in ("period of validity of bids", "bid validity", "bids shall remain valid")):
            res = get_clause_and_quote(
                r"(?:period of validity of bids|bid validity|bids shall remain valid)",
                "validity",
                ["period of validity of bids", "bid validity", "bids shall remain valid"],
            )
            if res:
                quote, ref, conf = res
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
                            clause_reference=ref,
                            verbatim_quote=quote,
                            confidence_score=conf,
                        ),
                    )
                )

        # 11. Legal: Delay Damages & Liquidated Damages
        if any(k in text_lower for k in ("delay damages", "liquidated damages", "time for completion")):
            res = get_clause_and_quote(
                r"(?:delay damages|liquidated damages|time for completion)",
                "damages",
                ["delay damages", "liquidated damages", "time for completion"],
            )
            if res:
                quote, ref, conf = res
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
                            clause_reference=ref,
                            verbatim_quote=quote,
                            confidence_score=conf,
                        ),
                    )
                )

        # 12. Legal: Defect Liability Period (DLP)
        if any(k in text_lower for k in ("defect liability", "maintenance period", "guarantee period")):
            res = get_clause_and_quote(
                r"(?:defect liability|maintenance period|guarantee period)",
                "defect liability",
                ["defect liability", "maintenance period", "guarantee period"],
            )
            if res:
                quote, ref, conf = res
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
                            clause_reference=ref,
                            verbatim_quote=quote,
                            confidence_score=conf,
                        ),
                    )
                )

        # 13. Legal: Integrity Pact & Anti-Debarment
        if any(k in text_lower for k in ("integrity pact", "litigation history", "non-performance", "debarment", "blacklisting")):
            res = get_clause_and_quote(
                r"(?:integrity pact|litigation history|non-performance|debarment|blacklisting)",
                "debarment",
                ["integrity pact", "litigation history", "non-performance", "debarment", "blacklisting"],
            )
            if res:
                quote, ref, conf = res
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
                            clause_reference=ref,
                            verbatim_quote=quote,
                            confidence_score=conf,
                        ),
                    )
                )

        # 14. Legal: Conflict of Interest & Non-Collusion
        if any(k in text_lower for k in ("conflict of interest", "non-collusion", "non-engagement of any agent", "middleman or intermediary")):
            res = get_clause_and_quote(
                r"(?:conflict of interest|non-collusion|middleman or intermediary)",
                "conflict of interest",
                ["conflict of interest", "non-collusion", "non-engagement of any agent", "middleman or intermediary"],
            )
            if res:
                quote, ref, conf = res
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
                            clause_reference=ref,
                            verbatim_quote=quote,
                            confidence_score=conf,
                        ),
                    )
                )

        # 15. Statutory: Make in India (PPP-MII) Local Content
        if any(k in text_lower for k in ("make in india", "local content", "ppp-mii", "class-i local")):
            res = get_clause_and_quote(
                r"(?:make in india|local content|ppp-mii|class-i local)",
                "local content",
                ["make in india", "local content", "ppp-mii", "class-i local"],
            )
            if res:
                quote, ref, conf = res
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
                            clause_reference=ref,
                            verbatim_quote=quote,
                            confidence_score=conf,
                        ),
                    )
                )

        # 16. Statutory: GSTIN & PAN Registration
        if any(k in text_lower for k in ("goods and services tax", "gstin", "gst registration", "pan card", "taxes and duties")):
            res = get_clause_and_quote(
                r"(?:goods and services tax|gstin|gst registration|taxes and duties)",
                "gst",
                ["goods and services tax", "gstin", "gst registration", "pan card", "taxes and duties"],
            )
            if res:
                quote, ref, conf = res
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
                            clause_reference=ref,
                            verbatim_quote=quote,
                            confidence_score=conf,
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

        if not request.pages and request.download_url:
            from tenderpulse_ai.domain.pdf_resolver import resolve_pdf_to_pages
            request.pages = await resolve_pdf_to_pages(
                download_url=request.download_url,
                document_id=request.document_id,
                file_name=request.file_name,
            )

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

                cur_quote = payload["provenance"]["verbatimQuote"] or ""
                ex_quote = existing["provenance"]["verbatimQuote"] or ""
                prefer_new_quote = (
                    payload["provenance"]["confidenceScore"] > existing["provenance"]["confidenceScore"]
                    or (len(ex_quote) < 60 and len(cur_quote) >= 60)
                    or (
                        payload["provenance"]["confidenceScore"] == existing["provenance"]["confidenceScore"]
                        and len(cur_quote) > len(ex_quote)
                    )
                )
                if prefer_new_quote:
                    existing["provenance"]["confidenceScore"] = max(
                        existing["provenance"]["confidenceScore"],
                        payload["provenance"]["confidenceScore"],
                    )
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
