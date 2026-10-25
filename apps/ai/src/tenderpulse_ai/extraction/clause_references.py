from __future__ import annotations

import re

from tenderpulse_ai.domain.cross_reference_resolver import CrossReferenceResolver

ABBREVIATIONS = {
    "hrs",
    "rs",
    "e.g",
    "i.e",
    "viz",
    "co",
    "ltd",
    "pvt",
    "no",
    "sr",
    "sl",
    "dr",
    "mr",
    "mrs",
    "ms",
    "prof",
    "dept",
    "govt",
    "inc",
    "corp",
    "sq",
    "mt",
    "km",
    "ft",
    "in",
    "min",
    "sec",
    "approx",
    "ref",
    "cl",
}

DIVISION_KEYWORDS_PATTERN = (
    r"(?:(?:GC|CC|GCC|SCC|ITB|BDS)\s*)?"
    r"(?:Schedule|Annexure|Appendix|Article|Section|Part|Clause|Sub-Clause|ITB|BDS|GCC|SCC|Table)\b"
)

GUARDED_CLAUSE_PATTERN = re.compile(
    r"^(?:(?:Clause|Sub-Clause|Article|Section|Schedule|Annexure|Appendix|Table|PQ)\s+(?:[A-Z0-9IVX]+(?:\.[0-9]+)*)|[1-6]?\d(?:\.\d+){0,3}[.)]\s+[A-Za-z])",
    re.IGNORECASE,
)


def _is_calendar_date_or_measurement(token: str, full_context: str = "") -> bool:
    """Returns True if the token is a calendar date (DD.MM.YYYY), decimal fraction (0.5), or measurement (9.45 km)."""
    clean = token.strip()
    if re.match(r"^\d{1,2}\.\d{1,2}\.\d{2,4}$", clean):
        return True
    if re.match(r"^0\.\d+", clean):
        return True
    if re.search(
        r"\b\d+(?:\.\d+)?\s*(?:(?:km|kms|mtr|meters|hrs|hours|am|pm|crore|crores|cr|lakh|lakhs|percent)\b|%)",
        clean,
        re.IGNORECASE,
    ):
        return True
    if full_context:
        for m in re.finditer(r"(?<!\w)" + re.escape(clean), full_context):
            start = m.start()
            end = m.end()
            after = full_context[end : end + 30]
            if after and after[0].isdigit():
                continue
            if re.match(r"^\.\d+", after):
                return True
            if re.match(
                r"^\s*(?:(?:km|kms|mtr|meters|hrs|hours|am|pm|crore|crores|cr|lakh|lakhs|percent)\b|%)",
                after,
                re.IGNORECASE,
            ):
                return True
            before = full_context[max(0, start - 30) : start]
            if re.search(
                r"(?:\b(?:km|km\.|less than|more than|upto|at least|minimum)|(?:rs\.?|inr|₹))\s*$",
                before,
                re.IGNORECASE,
            ):
                return True
    return False


def _is_abbreviation_or_number_period(text: str, period_idx: int) -> bool:
    """Checks if a period at period_idx in text is part of an abbreviation, decimal number, or date."""
    if period_idx < 0 or period_idx >= len(text):
        return False
    # If not followed by whitespace or closing punctuation/bracket, it's part of a URL, domain, or identifier
    if (
        period_idx + 1 < len(text)
        and not text[period_idx + 1].isspace()
        and text[period_idx + 1] not in (")", "]", '"', "'", "}", "”", "’")
    ):
        return True
    if period_idx > 0 and text[period_idx - 1].isdigit():
        if period_idx + 1 < len(text) and text[period_idx + 1].isdigit():
            return True
    pre_match = re.search(r"([A-Za-z.]+)\Z", text[:period_idx])
    if pre_match:
        token = pre_match.group(1).lower().rstrip(".")
        if token in ABBREVIATIONS:
            if token in ("hrs", "km", "min", "sec", "approx", "ref", "cl") and period_idx + 1 < len(
                text
            ):
                if re.match(r"\s+[A-Z]", text[period_idx + 1 :]):
                    return False
            return True
        if len(token) == 1 and token.isalpha():
            return True
    return False


def _extract_clause_from_clause_text(clause_text: str, page_no: int) -> str | None:
    """Extracts the most specific clause reference from a clause snippet."""
    # 1. Division heading at beginning of clause (e.g. "Clause 11", "Section 1", "ARTICLE 12")
    start_div = re.search(
        r"^\s*(" + DIVISION_KEYWORDS_PATTERN + r"\s*[-–—]?\s*(?:No\.?\s*)?"
        r"(?!(?:of|the|in|for|and|to|at|by|with|under|as|per|or|is|shall|must)\b)"
        r"(?:[A-Za-z]?\d+[A-Za-z\d]*(?:\.[A-Za-z\d]+)*|(?:[IVXLCDM]+(?:[-–—][A-Za-z\d]+|[A-Z])?)\b|[A-Z]\b))",
        clause_text,
        re.IGNORECASE,
    )
    if start_div:
        val = start_div.group(1).strip()
        if not _is_calendar_date_or_measurement(val, clause_text):
            return f"{val} (Page {page_no})"

    # 2. Numbered item at beginning of clause (e.g. "20. RFP submission...", "6. The Consultant...")
    start_num = re.search(
        r"^\s*(?!\d{1,2}\.\d{1,2}\.\d{2,4}\b)([1-9]\d*(?:\.\d+)*)[.)]?[ \t]+[A-Za-z\d]",
        clause_text,
    )
    if start_num:
        val = start_num.group(1).strip()
        if not _is_calendar_date_or_measurement(val, clause_text):
            return f"Clause {val} (Page {page_no})"

    # 3. Explicit named division anywhere in clause
    named_match = re.search(
        r"\b(" + DIVISION_KEYWORDS_PATTERN + r"\s*[-–—]?\s*(?:No\.?\s*)?"
        r"(?!(?:of|the|in|for|and|to|at|by|with|under|as|per|or|is|shall|must)\b)"
        r"(?:[A-Za-z]?\d+[A-Za-z\d]*(?:\.[A-Za-z\d]+)*|(?:[IVXLCDM]+(?:[-–—][A-Za-z\d]+|[A-Z])?)\b|[A-Z]\b))",
        clause_text,
        re.IGNORECASE,
    )
    if named_match:
        val = named_match.group(1).strip()
        if not _is_calendar_date_or_measurement(val, clause_text):
            return f"{val} (Page {page_no})"

    # 4. Decimal clause hierarchy anywhere in clause (excluding dates and measurements)
    for dm in re.finditer(r"\b([1-9]\d*(?:\.\d+)+)\b", clause_text):
        cand = dm.group(1).strip()
        if not _is_calendar_date_or_measurement(cand, clause_text):
            return f"Clause {cand} (Page {page_no})"

    return None


def _extract_clause_reference(text: str, page_no: int) -> str:
    """Dynamically discovers clause, section, article, schedule, annexure, and appendix references.

    Arbitrary document hierarchy support:
    - 1, 1.1, 1.1.1, 4.2.7, 7.3.2, 9.1.1, 12.4.1, 14.8
    - ARTICLE 12, Article 4, Section 1.1, Part I
    - Schedule IV, Schedule-G, Schedule K
    - Annexure A, Appendix IB
    """
    # 1. Structured clause or named division at start of line
    line_start_div = re.search(
        r"(?m)^\s*(" + DIVISION_KEYWORDS_PATTERN + r"\s*[-–—]?\s*(?:No\.?\s*)?"
        r"(?!(?:of|the|in|for|and|to|at|by|with|under|as|per|or|is|shall|must)\b)"
        r"(?:[A-Za-z]?\d+[A-Za-z\d]*(?:\.[A-Za-z\d]+)*|(?:[IVXLCDM]+(?:[-–—][A-Za-z\d]+|[A-Z])?)\b|[A-Z]\b))",
        text,
        re.IGNORECASE,
    )
    if line_start_div:
        val = line_start_div.group(1).strip()
        if not _is_calendar_date_or_measurement(val, text):
            return f"{val} (Page {page_no})"

    # 2. Decimal clause hierarchy at start of line: 1.1, 1.1.1, 4.2.7, 7.3.2, 9.1.1, 12.4.1, 14.8
    decimal_match = re.search(
        r"(?m)^\s*(?!\d{1,2}\.\d{1,2}\.\d{2,4}\b)([1-9]\d*(?:\.\d+)+)\b",
        text,
    )
    if decimal_match:
        val = decimal_match.group(1).strip()
        if not _is_calendar_date_or_measurement(val, text):
            return f"Clause {val} (Page {page_no})"

    # 3. Single-number clause or item heading at line start: 1, 2, 1., 2.
    single_match = re.search(
        r"(?m)^\s*(?!\d{1,2}\.\d{1,2}\.\d{2,4}\b)([1-9]\d*)(?:[.)][ \t]+|[ \t]+)[A-Za-z\d]",
        text,
    )
    if single_match:
        val = single_match.group(1).strip()
        if not _is_calendar_date_or_measurement(val, text):
            return f"Clause {val} (Page {page_no})"

    # 4. Explicit Named Divisions anywhere in text (requiring real identifier, excluding English prepositions/stopwords)
    named_match = re.search(
        r"\b(" + DIVISION_KEYWORDS_PATTERN + r"\s*[-–—]?\s*(?:No\.?\s*)?"
        r"(?!(?:of|the|in|for|and|to|at|by|with|under|as|per|or|is|shall|must)\b)"
        r"(?:[A-Za-z]?\d+[A-Za-z\d]*(?:\.[A-Za-z\d]+)*|(?:[IVXLCDM]+(?:[-–—][A-Za-z\d]+|[A-Z])?)\b|[A-Z]\b))",
        text,
        re.IGNORECASE,
    )
    if named_match:
        val = named_match.group(1).strip()
        if not _is_calendar_date_or_measurement(val, text):
            return f"{val} (Page {page_no})"

    return f"Clause on Page {page_no}"


extract_clause_reference = _extract_clause_reference


def is_toc_or_definition(text: str) -> bool:
    clean = text.strip()
    if not clean:
        return True

    # 1. Dot leaders followed by numbers (TOC entries like 'Performance Security ...... 34')
    if re.search(r"(?:\.{2,}|\u2026|[-–—]{3,})\s*\d+", clean) or re.search(
        r"(\.{2,}|\s{3,})\s*\d+\s*$", clean
    ):
        return True

    # 2. Operative obligations / modal verbs
    has_modal = bool(
        re.search(
            r"\b(shall|must|is required to|are required to|will be forfeited|undertakes to|payable|repair and rectify)\b",
            clean,
            re.IGNORECASE,
        )
    )

    if not has_modal:
        # Consecutive clause headings / multi-column TOC listings without dot leaders
        if re.search(
            r"(?:^|\s)(?:(?:(?:GC|CC|GCC|SCC|ITB|BDS)\s*)?(?:Sub-Clause|Clause|Section|Article|Part|Schedule|Annexure|Appendix)\s*[\dA-Za-z.]+|\d{1,3})\s+[A-Z][A-Za-z\s/&–-]{2,40}\s+\d{1,4}\s+(?:(?:(?:GC|CC|GCC|SCC|ITB|BDS)\s*)?(?:Sub-Clause|Clause|Section|Article|Part|Schedule|Annexure|Appendix)|\d{1,3})\b",
            clean,
        ) or re.search(r"\b\d{1,3}\s+[A-Z][A-Za-z\s/&–-]{2,35}\s+\d{1,3}\s+[A-Z]", clean):
            return True

        # Short TOC line ending with a page number
        if re.search(r"\s+\d{1,4}\s*$", clean) and len(clean) < 120:
            return True

        # Bare title or heading
        if re.match(
            r"^(?:(?:(?:Section|Clause|Article|Schedule|Part|Table)\s*[-–—]?\s*(?:No\.?\s*)?[\dA-Za-z.]+:?\s*)|(?:\d+(?:\.\d+)*\.?|[A-Z]\.?|\([a-z\d]+\))\s*)?[A-Za-z\s,/&\-–—:]{3,80}\s*\.?$",
            clean,
            re.IGNORECASE,
        ) and not re.search(
            r"\b(within\s+\d+\s+days|not\s+later\s+than|at\s+least|nil|limits:)\b",
            clean,
            re.IGNORECASE,
        ):
            return True

    # 3. Bare definitions
    return bool(
        re.match(
            r"^(?:(?:Article|Clause|Section)\s+[\dA-Za-z.]+[:\s]+)?[“\"\'\s]*[A-Za-z\s]+[”\"\'\s]*(?:means|shall\s+mean)\b",
            clean,
            re.IGNORECASE,
        )
        and not re.search(
            r"\b(contractor shall|bidder shall|must furnish|within \d+ days|will be forfeited)\b",
            clean,
            re.IGNORECASE,
        )
    )


__all__ = [
    "ABBREVIATIONS",
    "DIVISION_KEYWORDS_PATTERN",
    "GUARDED_CLAUSE_PATTERN",
    "CrossReferenceResolver",
    "_is_calendar_date_or_measurement",
    "_is_abbreviation_or_number_period",
    "_extract_clause_from_clause_text",
    "_extract_clause_reference",
    "extract_clause_reference",
    "is_toc_or_definition",
]
