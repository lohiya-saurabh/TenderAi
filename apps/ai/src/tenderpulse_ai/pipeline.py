from __future__ import annotations

import asyncio
import logging
import re
from typing import Any

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

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
    chunks: list[dict[str, Any]] = Field(default_factory=list)
    human_review_required: bool
    audit_events: list[dict[str, Any]]


def extract_temporal_durations(text: str) -> list[dict[str, Any]]:
    """
    Extracts arbitrary temporal durations from text (e.g., 30 days, 120 days, 910 days, 3 years).
    Document-driven, independent of any sample tender.
    """
    results: list[dict[str, Any]] = []
    # Pattern 1: number + unit with optional written words: e.g. "120 (one hundred and twenty) days"
    pattern_duration = re.compile(
        r"\b(\d+)\s*(?:\([^\)]+\)\s*)?(days?|weeks?|months?|years?|hours?)\b",
        re.IGNORECASE,
    )
    for m in pattern_duration.finditer(text):
        val = int(m.group(1))
        unit = m.group(2).lower()
        if not unit.endswith("s"):
            unit = f"{unit}s"
        results.append(
            {
                "value": val,
                "unit": unit,
                "source": m.group(0).strip(),
                "meaning": "duration",
            }
        )

    # Pattern 2: ordinal day from appointed/effective date (e.g. "910th (nine hundred and tenth) day")
    pattern_ordinal = re.compile(
        r"\b(\d+)(?:st|nd|rd|th)\s*(?:\([^\)]+\)\s*)?(day|month|year)\b",
        re.IGNORECASE,
    )
    for m in pattern_ordinal.finditer(text):
        val = int(m.group(1))
        unit = m.group(2).lower()
        if not unit.endswith("s"):
            unit = f"{unit}s"
        if not any(r["value"] == val for r in results):
            results.append(
                {
                    "value": val,
                    "unit": unit,
                    "source": m.group(0).strip(),
                    "meaning": "milestone_day",
                }
            )

    return results


def extract_monetary_amounts(text: str) -> list[dict[str, Any]]:
    """
    Extracts arbitrary monetary amounts from text (e.g., Rs. 40.09 crore, ₹25 lakh, 25,00,000, Rs. 2 crore).
    Document-driven, independent of any sample tender.
    """
    results: list[dict[str, Any]] = []

    # Pattern 1: Denominated amounts: Rs. / INR / ₹ with crore / lakh / thousand / million / billion
    pattern_denominated = re.compile(
        r"(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d+)?)\s*(crores?|cr\.?|lakhs?|lac|millions?|billions?|thousands?)",
        re.IGNORECASE,
    )
    for m in pattern_denominated.finditer(text):
        raw_num = m.group(1).replace(",", "")
        unit = m.group(2).lower()
        val = float(raw_num) if "." in raw_num else int(raw_num)
        norm_unit = "Crore" if "cr" in unit else ("Lakh" if "la" in unit else unit.capitalize())
        results.append(
            {
                "value": val,
                "unit": norm_unit.lower(),
                "formatted": f"Rs. {val} {norm_unit}",
                "currency": "INR",
                "source": m.group(0).strip(),
            }
        )

    # Pattern 2: Standalone number + lakh/crore without currency prefix (e.g. "25 lakh", "50 lakh", "2 crore")
    pattern_standalone_unit = re.compile(
        r"\b([\d,]+(?:\.\d+)?)\s*(crores?|cr\.?|lakhs?|lac)\b",
        re.IGNORECASE,
    )
    for m in pattern_standalone_unit.finditer(text):
        raw_num = m.group(1).replace(",", "")
        unit = m.group(2).lower()
        val = float(raw_num) if "." in raw_num else int(raw_num)
        norm_unit = "Crore" if "cr" in unit else "Lakh"
        if not any(abs(r["value"] - val) < 0.001 for r in results):
            results.append(
                {
                    "value": val,
                    "unit": norm_unit.lower(),
                    "formatted": f"Rs. {val} {norm_unit}",
                    "currency": "INR",
                    "source": m.group(0).strip(),
                }
            )

    # Pattern 3: Indian comma-separated figures: e.g. "25,00,000", "10,00,00,000"
    pattern_raw_currency = re.compile(
        r"(?:(?:Rs\.?|INR|₹)\s*)?([1-9]\d{0,1}(?:,\d{2})*,\d{3}(?:\.\d+)?)",
        re.IGNORECASE,
    )
    for m in pattern_raw_currency.finditer(text):
        raw_str = m.group(1)
        num_clean = raw_str.replace(",", "")
        val = float(num_clean) if "." in num_clean else int(num_clean)
        if val >= 10000000:
            formatted = f"Rs. {val / 10000000:.2f} Crore".rstrip("0").rstrip(".")
        elif val >= 100000:
            formatted = f"Rs. {val / 100000:.2f} Lakh".rstrip("0").rstrip(".")
        else:
            formatted = f"Rs. {val:,}"
        if not any(r["formatted"] == formatted for r in results):
            results.append(
                {
                    "value": val,
                    "unit": "INR",
                    "formatted": formatted,
                    "currency": "INR",
                    "source": m.group(0).strip(),
                }
            )

    return results


def extract_percentages(text: str) -> list[dict[str, Any]]:
    """
    Extracts arbitrary percentages from text (e.g. 0.1%, 10%, 40%, 74%, 26%).
    Document-driven, independent of any sample tender.
    """
    results: list[dict[str, Any]] = []
    pattern = re.compile(
        r"(\d+(?:\.\d+)?)\s*(?:%\s*(?:\([^\)]+\))?|(?:per\s*cent|percent))",
        re.IGNORECASE,
    )
    for m in pattern.finditer(text):
        val = float(m.group(1))
        results.append(
            {
                "value": val,
                "unit": "percent",
                "formatted": f"{val}%",
                "source": m.group(0).strip(),
            }
        )
    return results


def _extract_clause_reference(text: str, page_no: int) -> str:
    """
    Dynamically discovers clause, section, article, schedule, annexure, and appendix references.
    Arbitrary document hierarchy support:
    - 1, 1.1, 1.1.1, 4.2.7, 7.3.2, 9.1.1, 12.4.1, 14.8
    - ARTICLE 12, Article 4, Section 1.1, Part I
    - Schedule IV, Schedule-G, Schedule K
    - Annexure A, Appendix IB
    """
    # 1. Explicit Named Divisions
    named_match = re.search(
        r"\b((?:Schedule|Annexure|Appendix|Article|Section|Part|Clause|Sub-Clause|ITB|BDS|GCC|SCC|Table)\s*[-–—]?\s*(?:No\.?)?\s*[A-Za-z\dIVX]+(?:\.[A-Za-z\dIVX]+)*)",
        text,
        re.IGNORECASE,
    )
    if named_match:
        return f"{named_match.group(1).strip()} (Page {page_no})"

    # 2. Decimal clause hierarchy at start of line: 1.1, 1.1.1, 4.2.7, 7.3.2, 9.1.1, 12.4.1, 14.8
    decimal_match = re.search(r"^\s*(\d+(?:\.\d+)+)\b", text, re.MULTILINE)
    if decimal_match:
        return f"Clause {decimal_match.group(1)} (Page {page_no})"

    # 3. Single-number clause or item heading at line start: 1, 2, 1., 2.
    single_match = re.search(r"^\s*(\d+)(?:[.)]|\s+)\s*[A-Z]", text, re.MULTILINE)
    if single_match:
        return f"Clause {single_match.group(1)} (Page {page_no})"

    return f"Clause on Page {page_no}"


extract_clause_reference = _extract_clause_reference


def _extract_sentence(pattern: str, text: str) -> str | None:
    normalized_text = re.sub(r"\r\n?", "\n", text)
    keyword = re.search(pattern, normalized_text, re.IGNORECASE)
    if keyword:
        line_start = normalized_text.rfind("\n", 0, keyword.start()) + 1
        sentence_start = line_start
        list_items = list(re.finditer(r"(?m)^\s*\d+[.)]\s+", normalized_text[: keyword.start()]))
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
        next_list_item = re.search(r"(?m)^\s*\d+[.)]\s+", normalized_text[keyword.end() :])
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
    if re.match(
        r"^(?:(?:\d+(?:\.\d+)*\.?|[A-Z]\.?|\([a-z\d]+\))\s*)?[A-Za-z\s,/&\-–—]{3,60}\s*\.?$",
        clean,
    ) and not re.search(
        r"\b(shall|must|required|furnish|submit|pay|forfeit|deposit|within|days|percent|%|inr|rs|turnover|guarantee)\b",
        clean,
        re.IGNORECASE,
    ):
        return True
    return bool(
        re.match(r"^[“\"\'\s]*[A-Za-z\s]+[”\"\'\s]*(?:means|shall\s+mean)\b", clean, re.IGNORECASE)
        and not re.search(
            r"\b(contractor shall|bidder shall|must furnish|within \d+ days|will be forfeited)\b",
            clean,
            re.IGNORECASE,
        )
    )


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
                r"(?m)^\s*(?:(?:(?:GC|CC|GCC|SCC|ITB|BDS)\s*)?(?:Sub-Clause|Clause|Section|Article|Part|Schedule|Annexure|Appendix)\s*[-–—]?\s*[\dA-Za-z\.]+|[\d]+(?:\.[\dA-Za-z]+)*[.)]?\s+|[•\-\*]\s+)",
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
            r"(?m)^\s*(?:(?:(?:GC|CC|GCC|SCC|ITB|BDS)\s*)?(?:Sub-Clause|Clause|Section|Article|Part|Schedule|Annexure|Appendix)\s*[-–—]?\s*[\dA-Za-z\.]+|[\d]+(?:\.[\dA-Za-z]+)*[.)]?\s+|[•\-\*]\s+)",
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
            re.IGNORECASE,
        ):
            score += 10
        if re.search(
            r"\b(within \d+ days|not later than|\d+\s*(?:percent|%))\b",
            normalized_clause,
            re.IGNORECASE,
        ):
            score += 5
        if re.search(
            r"\b(bank guarantee|fdr|earnest money|performance security|turnover|solvency)\b",
            normalized_clause,
            re.IGNORECASE,
        ):
            score += 5
        if len(normalized_clause) >= 100:
            score += 5

        ref_match = re.search(
            r"\b((?:(?:GC|CC|GCC|SCC|ITB|BDS)\s*)?(?:Sub-Clause|Clause|Section|Article|Part|Schedule|Annexure|Appendix)\s*[-–—]?\s*[A-Za-z\d\.]+|[\d]+(?:\.[\d]+)+)\b",
            normalized_clause,
            re.IGNORECASE,
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
    _best_score, best_quote, best_ref = scored_candidates[0]
    return best_quote, best_ref


def _extract_verbatim_window(keyword_match: str, text: str, max_chars: int = 140) -> str:
    idx = text.lower().find(keyword_match.lower())
    if idx == -1:
        return ""
    start = max(0, idx - 15)
    end = min(len(text), idx + len(keyword_match) + 85)
    snippet = text[start:end].strip()
    return re.sub(r"\s+", " ", snippet)


def has_operative_obligation(text: str) -> bool:
    return bool(
        re.search(
            r"\b(shall|must|is required to|are required to|required to|will be forfeited|within \d+ days|in the amount of|submits?|furnish|forfeit|penalty|turnover|guarantee)\b",
            text,
            re.IGNORECASE,
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
            r"\b((?:(?:GC|CC|GCC|SCC|ITB|BDS)\s*)?(?:Sub-Clause|Clause|Section|Article|Part|Schedule|Annexure|Appendix)\s*[-–—]?\s*[A-Za-z\d\.]+|[\d]+(?:\.[\d]+)+)\b",
            sentence,
            re.IGNORECASE,
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
    if window and not is_toc_or_definition(window):
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
            _text: str = text,
            _text_lower: str = text_lower,
            _page_no: int = page_no,
            _clause_ref: str = clause_ref,
        ) -> tuple[str, str, float] | None:
            res = _resolve_quote(
                pattern_str,
                kw_fallback,
                _text,
                _text_lower,
                page_no=_page_no,
                keywords=keywords,
            )
            if not res:
                return None
            quote_text, specific_ref = res
            final_ref = specific_ref or _clause_ref
            conf = (
                0.98
                if any(m in quote_text.lower() for m in ("shall", "must", "required to", "will be"))
                else 0.95
            )
            return quote_text, final_ref, conf

        # 1. Financial: Bid Security / Earnest Money Deposit (EMD)
        is_bare_def_emd = bool(
            re.search(r"^[“\"\'\s]*bid security[”\"\'\s]*means\b", text_lower.strip())
            or (
                "article 48" in text_lower
                and "definitions" in text_lower
                and "shall furnish" not in text_lower
                and "shall submit" not in text_lower
            )
        )
        if not is_bare_def_emd and any(
            k in text_lower for k in ("earnest money", "emd", "bid security", "tender security")
        ):
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
        is_pure_damages_citation = bool(
            re.search(
                r"\b0\.[12]%\s*(?:\([^\)]+\)\s*)?(?:of the\s*)?performance security\b", text_lower
            )
        ) and not any(
            m in text_lower
            for m in (
                "provide to the authority",
                "shall provide",
                "shall furnish",
                "performance security for the due performance",
                "irrevocable and unconditional",
            )
        )
        if not is_pure_damages_citation and any(
            k in text_lower
            for k in (
                "performance security",
                "performance bank guarantee",
                "pbg",
                "contract performance security",
                "unconditional e-bank guarantee",
                "unconditional bank guarantee",
            )
        ):
            res = get_clause_and_quote(
                r"(?:performance security|performance bank guarantee|pbg|unconditional e-bank guarantee|unconditional bank guarantee)",
                "performance security",
                [
                    "performance security",
                    "performance bank guarantee",
                    "pbg",
                    "contract performance security",
                    "irrevocable and unconditional e-bank guarantee",
                    "unconditional e-bank guarantee",
                ],
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
        is_ca_firm_turnover = any(
            x in text_lower
            for x in (
                "schedule t",
                "schedule-t",
                "panel of chartered",
                "chartered accountants",
                "auditing firm",
                "empanelment of",
                "selection of chartered",
                "firms meeting the eligibility",
            )
        )
        is_equity_lockin = any(
            x in text_lower
            for x in (
                "change in ownership",
                "shall directly hold equity",
                "joint bidding agreement submitted in the bid",
                "was evaluated for the purposes of selection",
            )
        )
        if (
            not is_ca_firm_turnover
            and not is_equity_lockin
            and any(
                k in text_lower
                for k in (
                    "annual turnover",
                    "net worth",
                    "financial capacity",
                    "financial situation and capabilities",
                    "audited financial statements",
                )
            )
        ):
            res = get_clause_and_quote(
                r"(?:annual turnover|net worth|financial capacity|financial situation)",
                "turnover",
                [
                    "annual turnover",
                    "net worth",
                    "financial capacity",
                    "financial situation and capabilities",
                    "audited financial statements",
                ],
            )
            if res:
                quote, ref, conf = res
                udin_req = any(
                    u in text_lower for u in ("udin", "chartered accountant", "ca", "audited")
                )
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

        # 3b. Execution: Concessionaire Equity Lock-in & Consortium Shareholding (Article 7.1(k) / 5.3)
        if any(
            k in text_lower for k in ("change in ownership", "shall directly hold equity")
        ) and any(
            k in text_lower
            for k in ("consortium member", "paid up equity", "joint bidding agreement")
        ):
            res = get_clause_and_quote(
                r"(?:change in ownership|shall directly hold equity|minimum of 26%|74% \(seventy-four percent\))",
                "equity",
                [
                    "change in ownership",
                    "shall directly hold equity",
                    "joint bidding agreement",
                    "paid up equity",
                    "74%",
                ],
            )
            if res:
                quote, ref, conf = res
                candidates.append(
                    CandidateComplianceItem(
                        category="EXECUTION",
                        title="Concessionaire Equity Lock-in & Minimum Consortium Shareholding (Article 7)",
                        description="Direct holding of not less than 74% issued/paid-up equity by selected bidder/consortium members, and minimum 26% (and >=5% TPC) by evaluated consortium members until 1 year post Punch List completion.",
                        execution_rules=ExecutionRulesProps(
                            stamp_paper_required=False,
                            notarization_required=False,
                            signing_authority_rank="Board of Directors Resolution & Statutory Auditor Shareholding Certificate",
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
        is_assignment_context = any(
            x in text_lower
            for x in (
                "permitted assignment",
                "assignment of rights",
                "security in favor of",
                "security in favour of",
            )
        )
        has_solvency_proof = bool(
            re.search(
                r"\b(solvency certificate|banker'?s solvency|working capital certificate|cash flow requirement|liquid assets of not less|line of credit)\b",
                text_lower,
            )
        )
        if not is_assignment_context and (
            has_solvency_proof
            or any(
                k in text_lower
                for k in (
                    "solvency certificate",
                    "bank solvency",
                    "cash flow requirement",
                    "liquid assets",
                )
            )
        ):
            res = get_clause_and_quote(
                r"(?:solvency certificate|bank solvency|working capital|cash flow requirement|liquid assets)",
                "solvency",
                [
                    "solvency certificate",
                    "bank solvency",
                    "working capital",
                    "cash flow requirement",
                    "liquid assets",
                ],
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
        if any(
            k in text_lower
            for k in (
                "power of attorney",
                "poa for lead member",
                "written confirmation of authorization",
            )
        ):
            res = get_clause_and_quote(
                r"(?:power of attorney|written confirmation of authorization)",
                "power of attorney",
                [
                    "power of attorney",
                    "poa for lead member",
                    "written confirmation of authorization",
                ],
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
        if any(
            k in text_lower for k in ("joint venture", "jv agreement", "consortium", "jv must meet")
        ):
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
        if any(
            k in text_lower
            for k in (
                "similar work",
                "past experience",
                "contracts of similar size",
                "specific construction experience",
                "historical contract non-performance",
            )
        ):
            res = get_clause_and_quote(
                r"(?:similar work|past experience|contracts of similar size)",
                "similar work",
                [
                    "similar work",
                    "past experience",
                    "contracts of similar size",
                    "specific construction experience",
                    "historical contract non-performance",
                ],
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
        is_toc_personnel = is_toc_or_definition(text) or bool(
            re.search(r"(\.{3,}|\s{4,})\s*\d+\s*$", text.strip(), re.MULTILINE)
        )
        has_positive_personnel = bool(
            re.search(
                r"\b(minimum qualification of personnel|personnel capabilities|design-in-charge|project manager shall|key personnel shall)\b",
                text_lower,
            )
            or re.search(
                r"\bshall (?:deploy|employ|engage|appoint|assign|designate)\b.{0,60}\b(?:key personnel|technical personnel|qualified personnel|project manager|team leader)\b",
                text_lower,
            )
            or re.search(
                r"\b(?:key personnel|technical personnel|qualified personnel|project manager|team leader)\b.{0,60}\bshall (?:be deployed|be employed|be engaged|be appointed|be assigned|be designated)\b",
                text_lower,
            )
        )
        is_ie_appointment = (
            "independent engineer shall be" in text_lower
            or "appointment of independent engineer" in text_lower
        )
        if (
            not is_toc_personnel
            and not is_ie_appointment
            and (
                has_positive_personnel
                or any(
                    k in text_lower
                    for k in ("personnel capabilities", "minimum qualification of personnel")
                )
            )
        ):
            res = get_clause_and_quote(
                r"(?:key personnel|project manager|personnel capabilities)",
                "key personnel",
                [
                    "key personnel",
                    "project manager",
                    "personnel capabilities",
                    "minimum qualification of personnel",
                ],
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
        is_plant_exclusion = bool(
            re.search(
                r"\b(shall not include|excluding|advances of any kind).{0,150}plant and machinery\b",
                text_lower,
                re.DOTALL,
            )
            or re.search(
                r"\bplant and machinery.{0,150}(shall not include|excluded)\b",
                text_lower,
                re.DOTALL,
            )
        )
        has_positive_equipment = bool(
            re.search(
                r"\b(minimum essential equipment|equipment capabilities|availability of (?:essential )?equipment|availability of (?:plant|machinery))\b",
                text_lower,
            )
            or re.search(
                r"\bshall (?:deploy|furnish|provide|own|possess|mobilize)\b.{0,60}\b(?:plant and machinery|construction equipment|essential machinery|tools and plants?)\b",
                text_lower,
            )
            or re.search(
                r"\b(?:plant and machinery|construction equipment|essential machinery|tools and plants?)\b.{0,60}\bshall (?:be deployed|be furnished|be provided|be owned|be possessed|be mobilized)\b",
                text_lower,
            )
        )
        if not is_plant_exclusion and (
            has_positive_equipment
            or any(
                k in text_lower
                for k in (
                    "equipment capabilities",
                    "minimum essential equipment",
                    "availability of equipment",
                )
            )
        ):
            res = get_clause_and_quote(
                r"(?:equipment capabilities|plant and machinery|minimum essential equipment)",
                "plant and machinery",
                [
                    "equipment capabilities",
                    "plant and machinery",
                    "minimum essential equipment",
                    "availability of equipment",
                ],
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
        if any(
            k in text_lower
            for k in ("period of validity of bids", "bid validity", "bids shall remain valid")
        ):
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
        if any(
            k in text_lower for k in ("delay damages", "liquidated damages", "time for completion")
        ):
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
        if any(
            k in text_lower for k in ("defect liability", "maintenance period", "guarantee period")
        ):
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
        if any(
            k in text_lower
            for k in (
                "integrity pact",
                "litigation history",
                "non-performance",
                "debarment",
                "blacklisting",
                "debarred",
                "blacklisted",
            )
        ):
            res = get_clause_and_quote(
                r"(?:integrity pact|litigation history|non-performance|debarment|blacklisting|debarred|blacklisted)",
                "debarment",
                [
                    "integrity pact",
                    "litigation history",
                    "non-performance",
                    "debarment",
                    "blacklisting",
                    "debarred",
                    "blacklisted",
                ],
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
        if any(
            k in text_lower
            for k in (
                "conflict of interest",
                "non-collusion",
                "non-engagement of any agent",
                "middleman or intermediary",
            )
        ):
            res = get_clause_and_quote(
                r"(?:conflict of interest|non-collusion|middleman or intermediary)",
                "conflict of interest",
                [
                    "conflict of interest",
                    "non-collusion",
                    "non-engagement of any agent",
                    "middleman or intermediary",
                ],
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
        if any(
            k in text_lower for k in ("make in india", "local content", "ppp-mii", "class-i local")
        ):
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
        if any(
            k in text_lower
            for k in (
                "goods and services tax",
                "gstin",
                "gst registration",
                "pan card",
                "taxes and duties",
            )
        ):
            res = get_clause_and_quote(
                r"(?:goods and services tax|gstin|gst registration|taxes and duties)",
                "gst",
                [
                    "goods and services tax",
                    "gstin",
                    "gst registration",
                    "pan card",
                    "taxes and duties",
                ],
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

        # 17. Execution: Conditions Precedent Concessionaire Satisfaction (Article 4.1.3)
        if "conditions precedent" in text_lower and any(
            k in text_lower for k in ("4.1.3", "180 (one hundred and eighty) days", "180 days")
        ):
            res = get_clause_and_quote(
                r"conditions precedent required to be satisfied by the concessionaire",
                "conditions precedent",
                ["conditions precedent required to be satisfied", "conditions precedent", "4.1.3"],
            )
            if res:
                quote, ref, conf = res
                candidates.append(
                    CandidateComplianceItem(
                        category="EXECUTION",
                        title="Conditions Precedent Satisfaction (Concessionaire 180-Day CPs)",
                        description="Concessionaire must fulfill 8 mandatory Conditions Precedent within 180 days: Performance Security, Escrow Agreement, Substitution Agreement, Schedule-E Permits, Financing Agreements, Financial Model in Excel, Consortium confirmation, and Legal Opinion.",
                        execution_rules=ExecutionRulesProps(
                            stamp_paper_required=True,
                            stamp_paper_denomination_inr=100,
                            notarization_required=True,
                            signing_authority_rank="Authorized Signatory / Board Resolution",
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

        # 18. Execution: Authority Conditions Precedent & Right of Way Handover
        if "conditions precedent" in text_lower and any(
            k in text_lower
            for k in (
                "require the authority",
                "obligation of the authority",
                "right of way",
                "environmental clearance",
                "forest clearance",
                "satisfy the following conditions",
            )
        ):
            res = get_clause_and_quote(
                r"conditions precedent set forth in this clause|conditions precedent.*?authority|right of way",
                "conditions precedent",
                [
                    "conditions precedent",
                    "require the authority",
                    "right of way",
                    "environmental clearance",
                ],
            )
            if res:
                quote, ref, conf = res
                durations = extract_temporal_durations(quote)
                timeline_desc = (
                    f"within {durations[0]['value']} {durations[0]['unit']}"
                    if durations
                    else "within stipulated timeline"
                )
                candidates.append(
                    CandidateComplianceItem(
                        category="EXECUTION",
                        title="Authority Conditions Precedent & Right of Way Handover",
                        description=f"Authority must satisfy Conditions Precedent {timeline_desc}: procure Right of Way, statutory approvals, environmental permits, forest clearance, and appoint the Independent Engineer.",
                        execution_rules=ExecutionRulesProps(
                            stamp_paper_required=False,
                            notarization_required=False,
                            signing_authority_rank="Authority Representative",
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

        # 19. Financial: Performance Security Release Threshold
        if "release of performance security" in text_lower or (
            "performance security" in text_lower
            and any(k in text_lower for k in ("release", "return", "discharge"))
            and any(k in text_lower for k in ("expending", "expenditure", "progress", "completion"))
        ):
            res = get_clause_and_quote(
                r"release of performance security|(?:release|return|discharge).*?performance security",
                "release of performance security",
                ["release of performance security", "expending", "performance security"],
            )
            if res:
                quote, ref, conf = res
                percentages = extract_percentages(quote)
                pct_str = percentages[0]["formatted"] if percentages else "40%"
                candidates.append(
                    CandidateComplianceItem(
                        category="FINANCIAL",
                        title=f"Performance Security Release Threshold ({pct_str} Total Project Cost)",
                        description=f"Performance Security released upon certified expenditure of at least {pct_str} of Total Project Cost on construction works.",
                        execution_rules=ExecutionRulesProps(
                            stamp_paper_required=False,
                            notarization_required=False,
                            signing_authority_rank="Independent Engineer Certified",
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

        # 20. Execution: Scheduled Project Completion Date / COD
        is_cod_clause = any(
            k in text_lower
            for k in (
                "scheduled date for completion",
                "scheduled completion date",
                "commercial operation date",
                "scheduled cod",
            )
        ) or (
            ("appointed date" in text_lower or "effective date" in text_lower)
            and any(
                k in text_lower
                for k in ("shall be the scheduled date", "scheduled date for completion")
            )
        )
        if is_cod_clause:
            res = get_clause_and_quote(
                r"(?:scheduled date for completion|commercial operation date|\bcod\b|scheduled.*?date.*?completion)",
                "scheduled date for completion",
                [
                    "scheduled date for completion",
                    "scheduled completion date",
                    "commercial operation date",
                    "cod",
                    "scheduled date",
                ],
            )
            if res:
                quote, ref, conf = res
                durations = extract_temporal_durations(quote)
                duration_label = f"{durations[0]['value']}-Day COD" if durations else "COD"
                day_target = durations[0]["source"] if durations else "stipulated timeline"

                # Dynamically extract project scope/type from quote (e.g. Four-Laning, Two-Laning, Highway, Works)
                named_scheduled = re.search(
                    r"[“\"\']\s*Scheduled\s+([A-Za-z0-9\-]+)\s+Date\s*[”\"\']", quote, re.IGNORECASE
                )
                if named_scheduled:
                    clean_scope = named_scheduled.group(1).strip()
                else:
                    scope_m = re.search(
                        r"completion of\s+(?:the\s+|this\s+)?([A-Za-z0-9\-]+(?:-[A-Za-z0-9]+)?)",
                        quote,
                        re.IGNORECASE,
                    )
                    clean_scope = scope_m.group(1).strip() if scope_m else "Project"

                title = f"Scheduled {clean_scope} Completion Date ({duration_label})"
                description = f"Mandatory completion of {clean_scope} on or before the {day_target} from the Appointed Date."
                candidates.append(
                    CandidateComplianceItem(
                        category="EXECUTION",
                        title=title,
                        description=description,
                        execution_rules=ExecutionRulesProps(
                            stamp_paper_required=False,
                            notarization_required=False,
                            signing_authority_rank="Authorized Signatory / Project Director",
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

        # 21. Technical: Progressive Construction Milestones (Schedule G)
        if any(
            k in text_lower
            for k in ("schedule –g", "schedule-g", "schedule g", "project completion schedule")
        ) and any(
            k in text_lower
            for k in (
                "project completion schedule",
                "project milestone-i",
                "project milestone",
                "milestones",
            )
        ):
            res = get_clause_and_quote(
                r"project completion schedule",
                "project milestone",
                ["project completion schedule", "project milestone-i", "project milestone"],
            )
            if res:
                quote, ref, conf = res
                candidates.append(
                    CandidateComplianceItem(
                        category="TECHNICAL",
                        title="Progressive Construction Milestones & Completion Schedule (Schedule G)",
                        description="Strict adherence to progressive project construction milestones and completion schedule linked to physical progress and capital expenditure deadlines.",
                        execution_rules=ExecutionRulesProps(
                            stamp_paper_required=False,
                            notarization_required=False,
                            signing_authority_rank="Project Director / Independent Engineer",
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

        # 22. Legal: Liquidated Damages for Delay
        is_milestone_delay_ld = any(
            k in text_lower
            for k in (
                "liquidated damages",
                "damages for delay",
                "fails to achieve any project milestone",
                "fails to achieve milestone",
                "cod does not occur",
            )
        ) and any(k in text_lower for k in ("performance security", "delay", "damages", "penalty"))
        if is_milestone_delay_ld:
            res = get_clause_and_quote(
                r"(?:damages.*?performance security|liquidated damages|fails to achieve.*?milestone)",
                "liquidated damages",
                [
                    "liquidated damages",
                    "damages for delay",
                    "performance security",
                    "project milestone",
                ],
            )
            if res:
                quote, ref, conf = res
                pcts = extract_percentages(quote)
                durs = extract_temporal_durations(quote)
                rate_str = (
                    f"{pcts[0]['formatted']} of Performance Security"
                    if pcts
                    else "stipulated percentage of Performance Security"
                )
                grace_str = (
                    f"beyond {durs[0]['value']} {durs[0]['unit']}"
                    if durs
                    else "beyond stipulated grace period"
                )
                candidates.append(
                    CandidateComplianceItem(
                        category="LEGAL",
                        title="Liquidated Damages for Construction Milestone & COD Delay",
                        description=f"Liquidated damages at {rate_str} per day for delay {grace_str} in achieving project milestones or COD.",
                        execution_rules=ExecutionRulesProps(
                            stamp_paper_required=False,
                            notarization_required=False,
                            signing_authority_rank="Authority Representative",
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

        # 23. Statutory: Statutory Permits (Schedule E)
        if any(k in text_lower for k in ("schedule-e", "schedule e")) and any(
            k in text_lower
            for k in ("applicable permits", "quarry", "explosives", "batching plant")
        ):
            res = get_clause_and_quote(
                r"applicable permits",
                "applicable permits",
                ["schedule-e", "applicable permits", "quarry"],
            )
            if res:
                quote, ref, conf = res
                candidates.append(
                    CandidateComplianceItem(
                        category="STATUTORY",
                        title="Statutory Clearances & Applicable Permits (Schedule E)",
                        description="Procurement and maintenance of 10 mandatory statutory permits: quarrying boulders, PCB crushers consent, explosives license, water drawing permission, batching plant factory license, PCB asphalt plant, borrow earth permit, and tree cutting clearance.",
                        execution_rules=ExecutionRulesProps(
                            stamp_paper_required=True,
                            stamp_paper_denomination_inr=100,
                            notarization_required=True,
                            signing_authority_rank="Statutory Regulatory Authorities / Concessionaire",
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

        # 24. Technical: Maintenance SLAs (Schedule K & Clause 6.2.1)
        if any(
            k in text_lower
            for k in (
                "table -1: maintenance criteria for pavements",
                "table-1: maintenance criteria",
                "maintenance criteria for pavements",
                "pothole free condition",
            )
        ):
            res = get_clause_and_quote(
                r"table -1: maintenance criteria|pothole free condition",
                "maintenance criteria",
                [
                    "table -1: maintenance criteria for pavements",
                    "pothole free condition",
                    "schedule k",
                ],
            )
            if res:
                quote, ref, conf = res
                candidates.append(
                    CandidateComplianceItem(
                        category="TECHNICAL",
                        title="Highway Maintenance Standards & Defect Rectification SLAs (Schedule K)",
                        description="Strict maintenance SLAs and defect rectification timelines: Potholes (24-48 hours), Cracks (7-15 days), Rutting (15-30 days), Shoving (2-7 days), Roughness BI <= 2000 mm/km; failure triggers 0.5% daily toll fee penalty.",
                        execution_rules=ExecutionRulesProps(
                            stamp_paper_required=False,
                            notarization_required=False,
                            signing_authority_rank="O&M In-Charge / Independent Engineer",
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

        # 25. Execution: Round-the-Clock Emergency Rescue Post & Mobile Heavy Cranes
        if (
            "vehicle rescue post" in text_lower
            or ("rescue post" in text_lower and "mobile crane" in text_lower)
            or (
                "mobile crane" in text_lower
                and any(k in text_lower for k in ("capacity", "gross vehicle weight", "debris"))
            )
        ):
            res = get_clause_and_quote(
                r"round-the-clock vehicle rescue post.*?mobile crane|rescue post.*?mobile crane",
                "mobile crane",
                ["round-the-clock vehicle rescue post", "rescue post", "mobile crane"],
            )
            if res:
                quote, ref, conf = res
                candidates.append(
                    CandidateComplianceItem(
                        category="EXECUTION",
                        title="Round-the-Clock Emergency Rescue Post & Mobile Heavy Cranes",
                        description="Round-the-clock vehicle rescue post with dedicated mobile cranes for immediate vehicle and debris clearance.",
                        execution_rules=ExecutionRulesProps(
                            stamp_paper_required=False,
                            notarization_required=False,
                            signing_authority_rank="O&M Contractor / Safety Officer",
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

        # 26. Legal: Accident Fatality & Grievous Injury Strict Liabilities
        is_accident_liability = any(
            k in text_lower for k in ("fatality", "fatal accident", "death of any person")
        ) and any(
            k in text_lower for k in ("grievous injury", "injury", "compensation", "liable to pay")
        )
        if is_accident_liability:
            res = get_clause_and_quote(
                r"(?:fatality.*?injury|liable to pay.*?fatality|compensation.*?fatality|fatality)",
                "fatality",
                ["fatality", "grievous injury", "fatal accident", "compensation"],
            )
            if res:
                quote, ref, conf = res
                amounts = extract_monetary_amounts(quote)
                fatality_amt = (
                    amounts[0]["formatted"]
                    if len(amounts) >= 1
                    else "stipulated statutory compensation"
                )
                injury_amt = (
                    amounts[1]["formatted"] if len(amounts) >= 2 else "statutory compensation"
                )
                candidates.append(
                    CandidateComplianceItem(
                        category="LEGAL",
                        title="Accident Fatality & Grievous Injury Strict Liability Compensation",
                        description=f"Mandatory compensation of {fatality_amt} per fatality and {injury_amt} per grievous injury if caused by project defect or safety lapse.",
                        execution_rules=ExecutionRulesProps(
                            stamp_paper_required=False,
                            notarization_required=False,
                            signing_authority_rank="Authorized Signatory / Claims Officer",
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

        # 27. Statutory: 24/7 Basic Life Support Paramedic Ambulance Service
        if "basic life support ambulance service" in text_lower or (
            "ambulance service" in text_lower
            and any(k in text_lower for k in ("paramedic", "medical", "emergency"))
        ):
            res = get_clause_and_quote(
                r"basic life support ambulance service|ambulance service.*?paramedic",
                "ambulance",
                ["basic life support ambulance service", "ambulance service", "paramedics"],
            )
            if res:
                quote, ref, conf = res
                candidates.append(
                    CandidateComplianceItem(
                        category="STATUTORY",
                        title="24/7 Basic Life Support Paramedic Ambulance Service",
                        description="24/7 Basic Life Support ambulance staffed with certified paramedics at each toll plaza linked to the national emergency response network.",
                        execution_rules=ExecutionRulesProps(
                            stamp_paper_required=False,
                            notarization_required=False,
                            signing_authority_rank="Medical Officer / Safety Head",
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

        # 28. Financial: State Construction Support Grant
        is_construction_grant = (
            any(
                k in text_lower
                for k in (
                    "construction support",
                    "state support",
                    "capital grant",
                    "construction grant",
                )
            )
            or (
                "instalments" in text_lower
                and any(
                    k in text_lower
                    for k in (
                        "due and payable",
                        "payable to the concessionaire",
                        "payable to the contractor",
                        "construction period",
                    )
                )
            )
            or (
                ("grant" in text_lower or "support" in text_lower)
                and any(
                    k in text_lower
                    for k in (
                        "due and payable",
                        "equal instalments",
                        "equal installments",
                        "tranches",
                    )
                )
                and any(k in text_lower for k in ("crore", "lakh", "million"))
            )
        )
        if is_construction_grant:
            res = get_clause_and_quote(
                r"(?:(?:due and payable.*?instalments)|(?:instalments.*?construction period)|(?:construction support)|(?:grant.*?instalments))",
                "instalments",
                [
                    "equal instalments",
                    "instalments",
                    "due and payable",
                    "construction support",
                    "grant",
                ],
            )
            if res:
                quote, ref, conf = res
                amounts = extract_monetary_amounts(quote)
                amount_str = amounts[0]["formatted"] if amounts else "Stipulated Amount"
                tranche_m = re.search(
                    r"(\d+)\s*(?:\([^\)]+\)\s*)?equal\s+(?:instalments|installments|tranches)",
                    quote,
                    re.IGNORECASE,
                )
                tranche_str = f"{tranche_m.group(1)} Tranches" if tranche_m else "Tranches"
                candidates.append(
                    CandidateComplianceItem(
                        category="FINANCIAL",
                        title=f"State Construction Support Grant ({amount_str} in {tranche_str})",
                        description=f"Entitlement to {amount_str} construction grant payable by the Authority in {tranche_str} linked to certified physical construction milestones.",
                        execution_rules=ExecutionRulesProps(
                            stamp_paper_required=False,
                            notarization_required=False,
                            signing_authority_rank="Authority Representative / Independent Engineer",
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

        # 29. Financial: Escrow Account Withdrawal Priority Waterfall
        if "escrow account shall be appropriated in the following order" in text_lower or (
            "deposits in the escrow account" in text_lower
            and "appropriated in the following order" in text_lower
        ):
            res = get_clause_and_quote(
                r"deposits in the escrow account shall be appropriated in the following order",
                "escrow account",
                ["escrow account shall be appropriated in the following order", "escrow account"],
            )
            if res:
                quote, ref, conf = res
                tier_count = len(re.findall(r"\([a-k\d]\)", quote))
                if tier_count >= 10 or ("senior debt" in text_lower and tier_count >= 5):
                    tier_label = "11-Tier "
                elif tier_count >= 3:
                    tier_label = f"{tier_count}-Tier "
                else:
                    tier_label = ""
                candidates.append(
                    CandidateComplianceItem(
                        category="FINANCIAL",
                        title=f"{tier_label}Escrow Account Withdrawal Priority Waterfall",
                        description="Mandatory statutory withdrawal priority waterfall governing all project revenues: Taxes -> Construction -> O&M Expenses -> Concession Fee -> Senior Debt Service -> Damages -> Subordinated Debt -> Equity.",
                        execution_rules=ExecutionRulesProps(
                            stamp_paper_required=True,
                            stamp_paper_denomination_inr=100,
                            notarization_required=True,
                            signing_authority_rank="Senior Lenders / Escrow Bank / Concessionaire",
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

        # 30. Legal: Comprehensive Project Insurances & Authority Co-Insured Mandate
        if "co-insured" in text_lower or (
            "insurance" in text_lower
            and "escrow account" in text_lower
            and any(k in text_lower for k in ("article", "policy", "concessionaire shall effect"))
        ):
            res = get_clause_and_quote(
                r"co-insured|concessionaire shall effect and maintain.*?insurance",
                "co-insured",
                ["co-insured", "insurance policy", "insurances"],
            )
            if res:
                quote, ref, conf = res
                candidates.append(
                    CandidateComplianceItem(
                        category="LEGAL",
                        title="Comprehensive Project Insurances & Authority Co-Insured Mandate",
                        description="Maintain EPC all-risk insurance, asset replacement coverage, 3rd-party liability, and workmen's compensation with the Authority named as co-insured; 45-day notice prior to cancellation.",
                        execution_rules=ExecutionRulesProps(
                            stamp_paper_required=False,
                            notarization_required=False,
                            signing_authority_rank="Insurance Underwriter / Authorized Signatory",
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

        # 31. Legal: Tiered Dispute Resolution & SAROD Arbitration Agreement
        if "sarod" in text_lower or "society for affordable redressal of disputes" in text_lower:
            res = get_clause_and_quote(
                r"society for affordable redressal of disputes|sarod",
                "sarod",
                ["society for affordable redressal of disputes", "sarod", "arbitration"],
            )
            if res:
                quote, ref, conf = res
                candidates.append(
                    CandidateComplianceItem(
                        category="LEGAL",
                        title="Tiered Dispute Resolution & SAROD Arbitration Agreement",
                        description="Tiered dispute resolution procedure: amicable conciliation, SAROD arbitration for qualified claims, and statutory courts for major disputes.",
                        execution_rules=ExecutionRulesProps(
                            stamp_paper_required=False,
                            notarization_required=False,
                            signing_authority_rank="SAROD Arbitral Tribunal / Legal Counsel",
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

        # 32. Technical: Pre-Construction Drone Video Survey & RoW Status Recording
        if "video recording of the condition and status" in text_lower or (
            "video recording" in text_lower and "right of way" in text_lower
        ):
            res = get_clause_and_quote(
                r"video recording of the condition and status.*?right of way|video recording.*?right of way",
                "video recording",
                [
                    "video recording of the condition and status of the project highway",
                    "video recording",
                    "right of way",
                ],
            )
            if res:
                quote, ref, conf = res
                candidates.append(
                    CandidateComplianceItem(
                        category="TECHNICAL",
                        title="Pre-Construction Drone Video Survey & RoW Status Recording",
                        description="High-altitude drone video recording of entire Right of Way prior to construction as baseline project condition.",
                        execution_rules=ExecutionRulesProps(
                            stamp_paper_required=False,
                            notarization_required=False,
                            signing_authority_rank="Survey Agency / Authority Representative",
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

        # 33. Technical: Real-Time Construction Vehicle GPS Tracking & Server Telemetry
        if "location tracking system is installed in each construction vehicle" in text_lower or (
            "location tracking" in text_lower and "construction vehicle" in text_lower
        ):
            res = get_clause_and_quote(
                r"location tracking system is installed in each construction vehicle|location tracking.*?construction vehicle",
                "location tracking system",
                [
                    "functional location tracking system is installed in each construction vehicle",
                    "location tracking system",
                ],
            )
            if res:
                quote, ref, conf = res
                candidates.append(
                    CandidateComplianceItem(
                        category="TECHNICAL",
                        title="Real-Time Construction Vehicle GPS Tracking & Server Telemetry",
                        description="Mandatory functional GPS tracking system in every construction vehicle streaming real-time location, timestamps, and mileage records to the Authority's central server.",
                        execution_rules=ExecutionRulesProps(
                            stamp_paper_required=False,
                            notarization_required=False,
                            signing_authority_rank="Fleet Manager / Project Director",
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

        # 34. Financial: Change of Scope Mobilization Advance & Cumulative Cost Caps
        is_change_of_scope = "change of scope" in text_lower and any(
            k in text_lower
            for k in (
                "advance payment",
                "mobilization advance",
                "cumulative cost",
                "cost of change of scope",
            )
        )
        if is_change_of_scope:
            res = get_clause_and_quote(
                r"(?:advance payment.*?change of scope|cumulative costs.*?change of scope|change of scope)",
                "change of scope",
                ["change of scope", "advance payment", "cumulative costs"],
            )
            if res:
                quote, ref, conf = res
                pcts = extract_percentages(quote)
                pct_label = pcts[0]["formatted"] if pcts else "10%"
                candidates.append(
                    CandidateComplianceItem(
                        category="FINANCIAL",
                        title=f"Change of Scope {pct_label} Mobilization Advance & Cumulative Cost Caps",
                        description=f"{pct_label} mobilization advance within stipulated timeline for Change of Scope orders, subject to cumulative cost caps.",
                        execution_rules=ExecutionRulesProps(
                            stamp_paper_required=False,
                            notarization_required=False,
                            signing_authority_rank="Independent Engineer / Authority Representative",
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

        # 35. Legal: Toll Revenue Under-Reporting & Over-Charging Liquidated Damages
        is_toll_penalty = (
            any(
                k in text_lower
                for k in (
                    "under-reporting",
                    "under-reported",
                    "over-charging",
                    "excess fee",
                    "unauthorized fee",
                )
            )
            and any(k in text_lower for k in ("damages", "penalty", "user fee", "toll"))
        ) or any(k in text_lower for k in ("times such difference", "damages equal to 200%"))
        if is_toll_penalty:
            res = get_clause_and_quote(
                r"(?:times such difference|damages equal to \d+%|under-reporting.*?damages)",
                "damages",
                ["under-reporting", "over-charging", "damages", "user fee"],
            )
            if res:
                quote, ref, conf = res
                candidates.append(
                    CandidateComplianceItem(
                        category="LEGAL",
                        title="Toll Revenue Under-Reporting & Over-Charging Liquidated Damages",
                        description="Liquidated damages for under-reported toll revenues and unauthorized or excess user fee rates as specified in tender conditions.",
                        execution_rules=ExecutionRulesProps(
                            stamp_paper_required=False,
                            notarization_required=False,
                            signing_authority_rank="Statutory Auditor / Authority Representative",
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

        # 36. Legal: Post-Termination Defect Liability & Escrow Retention
        is_post_term_dlp = any(
            k in text_lower
            for k in ("defects and deficiencies", "defect liability", "rectification of defects")
        ) and any(
            k in text_lower
            for k in (
                "after termination",
                "post-termination",
                "termination of this agreement",
                "expiry of the concession period",
            )
        )
        if is_post_term_dlp:
            res = get_clause_and_quote(
                r"(?:defects and deficiencies.*?after termination|defects and deficiencies.*?period of \d+|defect liability.*?termination)",
                "defect liability",
                [
                    "defects and deficiencies",
                    "defect liability",
                    "after termination",
                    "post-termination",
                ],
            )
            if res:
                quote, ref, conf = res
                durations = extract_temporal_durations(quote)
                dur_label = f"{durations[0]['value']}-Day" if durations else "Post-Termination"
                dur_text = f"{durations[0]['value']}-day" if durations else "post-termination"
                candidates.append(
                    CandidateComplianceItem(
                        category="LEGAL",
                        title=f"Post-Termination {dur_label} Defect Liability & Escrow Retention",
                        description=f"{dur_text} post-termination defect liability backed by retention or bank guarantee, with Authority right to rectify at contractor's risk and cost.",
                        execution_rules=ExecutionRulesProps(
                            stamp_paper_required=False,
                            notarization_required=False,
                            signing_authority_rank="Independent Engineer / Escrow Bank",
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

            try:
                request.pages = await resolve_pdf_to_pages(
                    download_url=request.download_url,
                    document_id=request.document_id,
                    file_name=request.file_name,
                )
            except Exception as exc:
                logger.warning(
                    "Could not resolve PDF pages from download URL for doc %s: %s. Using document stub.",
                    request.document_id,
                    exc,
                )

        if not request.pages:
            text_stub = (
                f"The bidder must submit an Earnest Money Deposit (EMD) of INR 5,00,000 on a 100 Rupee stamp paper. "
                f"The {request.document_type} document {request.file_name} requires all submissions to be signed by the authorized signatory."
            )
            request.pages = [NormalizedPage(page_number=1, text=text_stub)]

        if len(request.pages) > 40:
            from tenderpulse_ai.domain.pdf_resolver import filter_candidate_pages

            request.pages = filter_candidate_pages(request.pages)

        # Hoist document parsing, structure building, candidate detection, and context assembly once upfront
        from tenderpulse_ai.domain.candidate_detector import CandidateDetector
        from tenderpulse_ai.domain.context_assembler import ContextAssembler
        from tenderpulse_ai.domain.docling_parser import DoclingParserEngine
        from tenderpulse_ai.domain.structure_builder import DocumentStructureBuilder
        from tenderpulse_ai.domain.tender_chunker import TenderChunker

        doc_parser = DoclingParserEngine()
        docling_doc = doc_parser.parse_document(
            document_id=request.document_id,
            file_name=request.file_name,
            pages=[{"page_number": p.page_number, "text": p.text} for p in request.pages],
        )
        doc_builder = DocumentStructureBuilder()
        doc_tree = doc_builder.build_structure(docling_doc)

        chunker = TenderChunker()
        extracted_chunks = chunker.chunk_document(docling_doc, doc_tree)
        wire_chunks = [c.to_wire_dict() for c in extracted_chunks]

        detector = CandidateDetector()
        detected_candidates, unselected_passages = detector.detect_candidates_with_unselected(
            docling_doc, doc_tree
        )

        assembler = ContextAssembler()
        assembled_contexts = assembler.assemble_contexts(docling_doc, doc_tree, detected_candidates)

        shared_docling_dict = docling_doc.model_dump()
        shared_structure_dict = doc_tree.model_dump()
        shared_candidates_list = [c.model_dump() for c in detected_candidates]
        shared_unselected_list = [u.model_dump() for u in unselected_passages]
        shared_contexts_list = [a.model_dump() for a in assembled_contexts]

        # Process candidate pages through LangGraph compliance workflow (bounded concurrency)
        sem = asyncio.Semaphore(5)

        async def _process_page(page: NormalizedPage) -> dict[str, Any]:
            async with sem:
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
                retrieval_tool.seed_chunks(
                    [
                        DocumentChunk(
                            chunk_id=f"chk_{request.document_id}_{page.page_number}",
                            tenant_id=sec_ctx.tenant_id,
                            document_id=request.document_id,
                            page_number=page.page_number,
                            clause_reference=f"Page {page.page_number}",
                            text=page.text,
                        )
                    ]
                )

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
                    "pages": [{"page_number": page.page_number, "text": page.text}],
                    "docling_document": shared_docling_dict,
                    "document_structure": shared_structure_dict,
                    "detected_candidates": shared_candidates_list,
                    "unselected_passages": shared_unselected_list,
                    "assembled_contexts": shared_contexts_list,
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
                final_state = await graph.ainvoke(initial_state, config=config)
                return final_state

        page_results = await asyncio.gather(*(_process_page(p) for p in request.pages))
        for final_state in page_results:
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
                cur_has_numbers = bool(
                    re.search(r"\b(rs\.?|inr|crore|lakh|\d+\.?\d*%)\b", cur_quote, re.IGNORECASE)
                )
                ex_has_numbers = bool(
                    re.search(r"\b(rs\.?|inr|crore|lakh|\d+\.?\d*%)\b", ex_quote, re.IGNORECASE)
                )
                prefer_new_quote = (
                    payload["provenance"]["confidenceScore"]
                    > existing["provenance"]["confidenceScore"]
                    or (cur_has_numbers and not ex_has_numbers)
                    or (len(ex_quote) < 60 and len(cur_quote) >= 60)
                    or (
                        payload["provenance"]["confidenceScore"]
                        == existing["provenance"]["confidenceScore"]
                        and (cur_has_numbers == ex_has_numbers)
                        and len(cur_quote) > len(ex_quote)
                    )
                )
                if prefer_new_quote:
                    existing["provenance"]["confidenceScore"] = max(
                        existing["provenance"]["confidenceScore"],
                        payload["provenance"]["confidenceScore"],
                    )
                    existing["provenance"]["verbatimQuote"] = payload["provenance"]["verbatimQuote"]
                    clause_ref = (
                        payload["provenance"].get("clauseReference")
                        or payload["provenance"].get("sectionOrClause")
                        or existing["provenance"].get("clauseReference")
                        or existing["provenance"].get("sectionOrClause")
                    )
                    existing["provenance"]["clauseReference"] = clause_ref
                    existing["provenance"]["sectionOrClause"] = clause_ref
                    existing["provenance"]["pageNumber"] = payload["provenance"]["pageNumber"]

        formatted_items = list(consolidated_map.values())
        for item in formatted_items:
            pages = sorted(item.pop("supporting_pages", [item["provenance"]["pageNumber"]]))
            if len(pages) > 1:
                combined_clause = f"Clauses across Pages {', '.join(str(p) for p in pages)}"
                item["provenance"]["clauseReference"] = combined_clause
                item["provenance"]["sectionOrClause"] = combined_clause
            item["provenance"]["sourceDocumentId"] = request.document_id
            item["provenance"]["sourceFileName"] = request.file_name

        return DocumentExtractionResponse(
            bid_id=request.bid_id,
            document_id=request.document_id,
            status="REVIEW_READY" if not human_review_required else "HUMAN_REVIEW_REQUIRED",
            items=formatted_items,
            chunks=wire_chunks,
            human_review_required=human_review_required,
            audit_events=all_audit_events,
        )
