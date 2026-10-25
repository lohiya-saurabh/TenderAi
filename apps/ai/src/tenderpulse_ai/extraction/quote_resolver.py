from __future__ import annotations

import re

from tenderpulse_ai.agent.validation import clean_whitespace
from tenderpulse_ai.extraction.clause_references import (
    _extract_clause_from_clause_text,
    _is_abbreviation_or_number_period,
    _is_calendar_date_or_measurement,
    is_toc_or_definition,
)

TABLE_LEAD_IN_PATTERN = re.compile(
    r"(?:(?:Sl\.?\s*No\.?|Particulars|Account\s*Name|Account\s*No\.?|IFSC|Beneficiary|Bank\s*Name|Branch)\b|Table\s*[-–—:]?\s*\d*|\b(?:as per details below|given below|following details|bank details)\b)",
    re.IGNORECASE,
)

TABLE_ROW_PATTERN = re.compile(
    r"^\s*(?:\d+[.)]\s+)?(?:Type\s*of\s*Account|Type|Name\s*of|Account|IFSC|Bank|Branch|Particulars|Details|Fee|Amount|Beneficiary|Tender Fee|EMD|Rate|Description|Item|Unit|Quantity|Mode|Payment|Canara|SBI|RTGS|NEFT|DD|FDR|BG|Table(?:\s*[-–—:]?\s*\d+)?|Canara Bank|State Bank|HDFC|ICICI|PNB|(?:Sl|Sr|S)\.?\s*No\.?)\b",
    re.IGNORECASE,
)


def _has_table_lead_in(text: str) -> bool:
    """Checks whether the text preceding or surrounding a match indicates a tabular context."""
    return bool(TABLE_LEAD_IN_PATTERN.search(text))


def _is_table_row(text: str) -> bool:
    """Checks whether text starts with or represents a table row item."""
    return bool(TABLE_ROW_PATTERN.search(text))


def _extract_sentence(pattern: str, text: str) -> str | None:
    normalized_text = re.sub(r"\r\n?", "\n", text)
    keyword = re.search(pattern, normalized_text, re.IGNORECASE)
    if keyword:
        line_start = normalized_text.rfind("\n", 0, keyword.start()) + 1
        curr_pos = line_start
        while curr_pos > 0 and normalized_text[curr_pos : curr_pos + 1].islower():
            prev_line = normalized_text.rfind("\n", 0, curr_pos - 1)
            curr_pos = prev_line + 1 if prev_line != -1 else 0
        sentence_start = curr_pos
        is_table = _has_table_lead_in(
            normalized_text[
                max(0, keyword.start() - 350) : min(len(normalized_text), keyword.end() + 350)
            ]
        )

        if is_table:
            lead_in_m = TABLE_LEAD_IN_PATTERN.search(
                normalized_text[max(0, keyword.start() - 400) : keyword.start()]
            )
            if lead_in_m:
                table_lead_start = max(0, keyword.start() - 400) + lead_in_m.start()
                para_before = normalized_text.rfind("\n\n", 0, table_lead_start)
                sentence_start = para_before + 2 if para_before != -1 else table_lead_start
        else:
            list_items = list(
                re.finditer(
                    r"(?:(?<=\n)|(?<=[\.\?!]\s)|^\s*)\d+[.)]\s+",
                    normalized_text[: keyword.start()],
                )
            )
            if list_items:
                sentence_start = list_items[-1].start()
                punctuation_search_start = list_items[-1].end()
            else:
                punctuation_search_start = curr_pos

            preceding_punct_pos = -1
            sub_pre = normalized_text[punctuation_search_start : keyword.start()]
            for p_match in re.finditer(r"(?:[\.?!]|\))\s+(?=[A-Z])|[.?!](?:\s+|$)", sub_pre):
                abs_idx = punctuation_search_start + p_match.start()
                if normalized_text[abs_idx] == "." and _is_abbreviation_or_number_period(
                    normalized_text, abs_idx
                ):
                    continue
                preceding_punct_pos = punctuation_search_start + p_match.end()

            if preceding_punct_pos >= punctuation_search_start:
                sentence_start = preceding_punct_pos

        sentence_end = len(normalized_text)
        sub_post = normalized_text[keyword.end() :]
        for p_match in re.finditer(r"\.(?:\s+[A-Z]|\s*\n|$)", sub_post):
            abs_idx = keyword.end() + p_match.start()
            if _is_abbreviation_or_number_period(normalized_text, abs_idx):
                continue
            is_list_num = bool(re.search(r"(?:\s|^)\d+\Z", normalized_text[:abs_idx]))
            if is_list_num and is_table:
                continue
            if is_table:
                line_start = normalized_text.rfind("\n", 0, abs_idx)
                line_start = line_start + 1 if line_start != -1 else 0
                if _is_table_row(normalized_text[line_start:]) or _has_table_lead_in(
                    normalized_text[line_start : line_start + 200]
                ):
                    continue
                local_snip = normalized_text[
                    max(0, abs_idx - 10) : min(len(normalized_text), abs_idx + 250)
                ]
                if _is_table_row(local_snip.lstrip()) or _has_table_lead_in(local_snip):
                    continue
            sentence_end = abs_idx + 1
            break

        if is_table:
            pos = keyword.end()
            paragraph_position = -1
            while pos < len(normalized_text):
                np = normalized_text.find("\n\n", pos)
                if np == -1:
                    break
                after_np = normalized_text[np + 2 :].lstrip()
                if _has_table_lead_in(after_np[:200]) or _is_table_row(after_np):
                    pos = np + 2
                    continue
                paragraph_position = np
                break
        else:
            paragraph_position = normalized_text.find("\n\n", keyword.end())
        next_list_item = None
        for nli in re.finditer(
            r"(?:(?<=\n)|(?<=[\.\?!]\s)|^\s*)\d+[.)]\s+", normalized_text[keyword.end() :]
        ):
            if is_table and (
                _is_table_row(normalized_text[keyword.end() + nli.start() :])
                or _has_table_lead_in(
                    normalized_text[keyword.end() + nli.start() : keyword.end() + nli.start() + 200]
                )
            ):
                continue
            next_list_item = nli
            break

        end_candidates = [
            pos
            for pos in (
                sentence_end,
                paragraph_position if paragraph_position >= 0 else -1,
                keyword.end() + next_list_item.start() if next_list_item else -1,
            )
            if pos >= 0
        ]
        sentence_end = min(end_candidates) if end_candidates else len(normalized_text)

        sentence = normalized_text[sentence_start:sentence_end].strip()
        if len(sentence) > 15:
            return re.sub(r"\s+", " ", sentence)

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
        post_text = text_norm[end_pos:]
        max_search = min(len(post_text), max_chars)
        scoped_post = post_text[:max_search]

        is_table = _has_table_lead_in(scoped_pre) or _has_table_lead_in(scoped_post)

        header_matches = []
        for hm in re.finditer(
            r"(?m)^\s*(?:(?:(?:GC|CC|GCC|SCC|ITB|BDS)\s*)?(?:Sub-Clause|Clause|Section|Article|Part|Schedule|Annexure|Appendix|Table)\b[ \t]*[-–—]?[ \t]*(?:No\.?[ \t]*)?[\dA-Za-z\.]+|(?!\d{1,2}\.\d{1,2}\.\d{2,4}\b)[1-9]\d*(?:\.\d+)*[.)][ \t]+[A-Za-z\d]|(?!\d{1,2}\.\d{1,2}\.\d{2,4}\b)[1-9]\d*(?:\.\d+)+[ \t]+[A-Za-z\d]|[•\-\*][ \t]+)",
            scoped_pre,
        ):
            header_text = hm.group(0).strip()
            if _is_calendar_date_or_measurement(header_text, scoped_pre):
                continue
            header_matches.append(hm)

        if is_table:
            lead_in_m = TABLE_LEAD_IN_PATTERN.search(scoped_pre)
            if lead_in_m:
                table_lead_start = search_start + lead_in_m.start()
                para_before = text_norm.rfind("\n\n", 0, table_lead_start)
                clause_start = para_before + 2 if para_before != -1 else table_lead_start
            elif header_matches:
                clause_start = search_start + header_matches[-1].start()
            else:
                last_para = scoped_pre.rfind("\n\n")
                clause_start = search_start + last_para + 2 if last_para != -1 else search_start
        elif header_matches:
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
                    found_period = -1
                    for p_match in re.finditer(r"\.(?:\s+|\n)", scoped_pre):
                        p_idx = p_match.start()
                        if not _is_abbreviation_or_number_period(scoped_pre, p_idx):
                            found_period = p_idx
                    if found_period != -1:
                        clause_start = search_start + found_period + 2
                    else:
                        clause_start = search_start

        next_item = None
        for item_m in re.finditer(
            r"(?m)^\s*(?:(?:(?:GC|CC|GCC|SCC|ITB|BDS)\s*)?(?:Sub-Clause|Clause|Section|Article|Part|Schedule|Annexure|Appendix|Table)\b[ \t]*[-–—]?[ \t]*(?:No\.?[ \t]*)?[\dA-Za-z\.]+|(?!\d{1,2}\.\d{1,2}\.\d{2,4}\b)[1-9]\d*(?:\.\d+)*[.)][ \t]+[A-Za-z\d]|(?!\d{1,2}\.\d{1,2}\.\d{2,4}\b)[1-9]\d*(?:\.\d+)+[ \t]+[A-Za-z\d]|[•\-\*][ \t]+)",
            scoped_post,
        ):
            if is_table and (
                _is_table_row(scoped_post[item_m.start() :])
                or _has_table_lead_in(scoped_post[item_m.start() : item_m.start() + 200])
            ):
                continue
            if item_m.start() > 20:
                next_item = item_m
                break
        if is_table:
            pos = 0
            next_para = -1
            while pos < len(scoped_post):
                np = scoped_post.find("\n\n", pos)
                if np == -1:
                    break
                after_np = scoped_post[np + 2 :].lstrip()
                if _has_table_lead_in(after_np[:200]) or _is_table_row(after_np):
                    pos = np + 2
                    continue
                next_para = np
                break
        else:
            next_para = scoped_post.find("\n\n")

        end_offsets: list[int] = []
        if next_item and next_item.start() > 20:
            end_offsets.append(next_item.start())
        if next_para != -1 and next_para > 20:
            end_offsets.append(next_para)

        for p_match in re.finditer(r"\.(?:\s+[A-Z]|\s*\n|$)", scoped_post):
            p_idx = p_match.start()
            if _is_abbreviation_or_number_period(scoped_post, p_idx):
                continue
            if is_table:
                line_start = scoped_post.rfind("\n", 0, p_idx)
                line_start = line_start + 1 if line_start != -1 else 0
                if _is_table_row(scoped_post[line_start:]) or _has_table_lead_in(
                    scoped_post[line_start : line_start + 200]
                ):
                    continue
            if p_idx > 30:
                end_offsets.append(p_idx + 1)
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

        clause_ref = _extract_clause_from_clause_text(normalized_clause, page_no)

        scored_candidates.append((score, normalized_clause, clause_ref))

    if not scored_candidates:
        return None

    scored_candidates.sort(key=lambda x: x[0], reverse=True)
    _best_score, best_quote, best_ref = scored_candidates[0]
    return best_quote, best_ref


def _extract_verbatim_window(keyword_match: str, text: str, max_chars: int = 140) -> str:
    """Legacy verbatim window extractor with fixed offsets (preserved for backward compatibility)."""
    idx = text.lower().find(keyword_match.lower())
    if idx == -1:
        return ""
    start = max(0, idx - 15)
    end = min(len(text), idx + len(keyword_match) + 85)
    snippet = text[start:end].strip()
    return re.sub(r"\s+", " ", snippet)


def extract_complete_clause_window(
    keyword_match: str,
    text: str,
    max_chars: int = 650,
) -> str:
    """Expands outward from a matched keyword to full grammatical sentence, sub-clause,

    and bound-table boundaries (up to max_chars), completely eliminating arbitrary offset slicing.
    Normalizes whitespace using clean_whitespace and guarantees no mid-word or mid-number truncations.
    """
    if not text or not keyword_match:
        return ""

    match_idx = text.lower().find(keyword_match.lower())
    if match_idx == -1:
        return ""

    # 1. Leftward Expansion: Find clause or sentence start
    pre_text = text[:match_idx]
    search_start = max(0, match_idx - 350)
    scoped_pre = pre_text[search_start:]
    post_text_raw = text[match_idx + len(keyword_match) :]
    scoped_post_initial = post_text_raw[: min(len(post_text_raw), max_chars)]
    is_table = _has_table_lead_in(scoped_pre) or _has_table_lead_in(scoped_post_initial)

    header_matches = list(
        re.finditer(
            r"(?m)^\s*(?:(?:(?:GC|CC|GCC|SCC|ITB|BDS)\s*)?(?:Sub-Clause|Clause|Section|Article|Part|Schedule|Annexure|Appendix|Table)\b[ \t]*[-–—]?[ \t]*(?:No\.?[ \t]*)?[\dA-Za-z\.]+|(?!\d{1,2}\.\d{1,2}\.\d{2,4}\b)[1-9]\d*(?:\.\d+)*[.)][ \t]+[A-Za-z\d]|(?!\d{1,2}\.\d{1,2}\.\d{2,4}\b)[1-9]\d*(?:\.\d+)+[ \t]+[A-Za-z\d]|[•\-\*][ \t]+)",
            scoped_pre,
        )
    )
    valid_headers = [
        hm
        for hm in header_matches
        if not _is_calendar_date_or_measurement(hm.group(0).strip(), scoped_pre)
    ]

    if is_table:
        lead_in_m = TABLE_LEAD_IN_PATTERN.search(scoped_pre)
        if lead_in_m:
            table_lead_start = search_start + lead_in_m.start()
            para_before = text.rfind("\n\n", 0, table_lead_start)
            clause_start = para_before + 2 if para_before != -1 else table_lead_start
        elif valid_headers:
            clause_start = search_start + valid_headers[-1].start()
        else:
            last_para = scoped_pre.rfind("\n\n")
            clause_start = search_start + last_para + 2 if last_para != -1 else search_start
    elif valid_headers:
        clause_start = search_start + valid_headers[-1].start()
    else:
        last_para = scoped_pre.rfind("\n\n")
        if last_para != -1:
            clause_start = search_start + last_para + 2
        else:
            found_period = -1
            for p_match in re.finditer(r"\.(?:\s+[A-Z]|\s*\n)", scoped_pre):
                p_idx = p_match.start()
                if not _is_abbreviation_or_number_period(scoped_pre, p_idx):
                    found_period = p_idx
            if found_period != -1:
                clause_start = search_start + found_period + 2
            else:
                clause_start = search_start
                while clause_start > 0 and not text[clause_start].isspace():
                    clause_start -= 1
                if text[clause_start].isspace():
                    clause_start += 1

    # 2. Rightward Expansion: Find closing sentence or clause boundary
    match_end = match_idx + len(keyword_match)
    post_text = text[match_end:]
    max_search = min(len(post_text), max_chars - (match_end - clause_start))
    if max_search <= 0:
        max_search = min(len(post_text), 300)
    scoped_post = post_text[:max_search]

    end_offsets: list[int] = []
    next_header = None
    for hm in re.finditer(
        r"(?m)^\s*(?:(?:(?:GC|CC|GCC|SCC|ITB|BDS)\s*)?(?:Sub-Clause|Clause|Section|Article|Part|Schedule|Annexure|Appendix|Table)\b[ \t]*[-–—]?[ \t]*(?:No\.?[ \t]*)?[\dA-Za-z\.]+|(?!\d{1,2}\.\d{1,2}\.\d{2,4}\b)[1-9]\d*(?:\.\d+)*[.)][ \t]+[A-Za-z\d]|(?!\d{1,2}\.\d{1,2}\.\d{2,4}\b)[1-9]\d*(?:\.\d+)+[ \t]+[A-Za-z\d]|[•\-\*][ \t]+)",
        scoped_post,
    ):
        if is_table and (
            _is_table_row(scoped_post[hm.start() :])
            or _has_table_lead_in(scoped_post[hm.start() : hm.start() + 200])
        ):
            continue
        if hm.start() > 10:
            next_header = hm
            break
    if next_header and next_header.start() > 10:
        end_offsets.append(next_header.start())

    if is_table:
        pos = 0
        while pos < len(scoped_post):
            np = scoped_post.find("\n\n", pos)
            if np == -1:
                break
            after_np = scoped_post[np + 2 :].lstrip()
            if _has_table_lead_in(after_np[:200]) or _is_table_row(after_np):
                pos = np + 2
                continue
            if np > 10:
                end_offsets.append(np)
            break
    else:
        next_para = scoped_post.find("\n\n")
        if next_para != -1 and next_para > 10:
            end_offsets.append(next_para)

    for p_match in re.finditer(r"\.(?:\s+[A-Z]|\s*\n|$)", scoped_post):
        p_idx = p_match.start()
        if not _is_abbreviation_or_number_period(scoped_post, p_idx) and p_idx > 10:
            if is_table:
                line_start = scoped_post.rfind("\n", 0, p_idx)
                line_start = line_start + 1 if line_start != -1 else 0
                if _is_table_row(scoped_post[line_start:]) or _has_table_lead_in(
                    scoped_post[line_start : line_start + 200]
                ):
                    continue
            end_offsets.append(p_idx + 1)
            break

    if end_offsets:
        clause_end = match_end + min(end_offsets)
    else:
        clause_end = min(len(text), clause_start + max_chars)
        while (
            clause_end < len(text)
            and not text[clause_end].isspace()
            and text[clause_end] not in ".,;:!?"
        ):
            clause_end += 1

    raw_window = text[clause_start:clause_end]
    return clean_whitespace(raw_window)


def has_operative_obligation(text: str) -> bool:
    return bool(
        re.search(
            r"\b(should|shall|must|is required to|are required to|required to|will be forfeited|within \d+ days|in the amount of|submits?|furnish|forfeit|penalty|turnover|guarantee|equal to or more than|limited to)\b",
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

    # 1. If clean single sentence contains operative obligation and is not TOC/definition, prefer it
    if sentence and not is_toc_or_definition(sentence) and has_operative_obligation(sentence):
        clause_ref = _extract_clause_from_clause_text(sentence, page_no)
        return sentence, clause_ref

    # 2. If op_res found a rich operative clause with obligation modals, prefer it over a heading/abbreviated sentence
    if op_res and has_operative_obligation(op_res[0]):
        return op_res

    # 3. Try clean single sentence extraction
    if sentence and not is_toc_or_definition(sentence):
        clause_ref = _extract_clause_from_clause_text(sentence, page_no)
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

    # 6. Fallback to complete sentence-bounded clause window (sentence/table boundaries, no slicing)
    window = extract_complete_clause_window(kw_fallback, text, max_chars=650)
    if window and not is_toc_or_definition(window):
        return window, None

    return None


__all__ = [
    "clean_whitespace",
    "_extract_sentence",
    "_extract_operative_clause",
    "_extract_verbatim_window",
    "extract_complete_clause_window",
    "has_operative_obligation",
    "_resolve_quote",
    "_has_table_lead_in",
    "_is_table_row",
]
