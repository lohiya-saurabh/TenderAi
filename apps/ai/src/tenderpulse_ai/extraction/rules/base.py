from __future__ import annotations

import re
from abc import ABC, abstractmethod

from tenderpulse_ai.domain.docling_parser import is_clause_deleted
from tenderpulse_ai.domain.models import CandidateComplianceItem
from tenderpulse_ai.extraction.quote_resolver import _resolve_quote


def disambiguate_stamp_paper(text: str) -> tuple[bool, int | None]:
    """Disambiguates explicit 'plain paper' directives from stamp paper requirements.

    Extracts denomination dynamically from text (e.g. 100, 500, 50).
    """
    text_lower = text.lower()
    is_plain_paper = bool(
        re.search(
            r"\b(?:plain paper|without stamp paper|on plain paper|no stamp required)\b",
            text_lower,
        )
    )
    if is_plain_paper:
        return False, None

    has_stamp = bool(re.search(r"\b(?:stamp paper|non-judicial stamp|stamp duty)\b", text_lower))
    if not has_stamp:
        return False, None

    denom_match = re.search(
        r"(?:Rs\.?|INR|₹)?\s*(\d+)\s*(?:Rupee|/-)?\s*stamp\b",
        text,
        re.IGNORECASE,
    )
    denom = int(denom_match.group(1)) if denom_match else 100
    return True, denom


def get_clause_and_quote(
    pattern_str: str,
    kw_fallback: str,
    keywords: list[str],
    text: str,
    text_lower: str,
    page_no: int,
    clause_ref: str,
) -> tuple[str, str, float] | None:
    if is_clause_deleted(text) or (clause_ref and is_clause_deleted(clause_ref)):
        return None
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
    if (
        is_clause_deleted(quote_text)
        or (specific_ref and is_clause_deleted(specific_ref))
        or (clause_ref and is_clause_deleted(clause_ref))
    ):
        return None
    final_ref = specific_ref or clause_ref
    conf = (
        0.98
        if any(m in quote_text.lower() for m in ("shall", "must", "required to", "will be"))
        else 0.95
    )
    return quote_text, final_ref, conf


class BaseExtractionRule(ABC):
    @abstractmethod
    def extract(
        self,
        doc_id: str,
        page_no: int,
        text: str,
        text_lower: str,
        clause_ref: str,
    ) -> list[CandidateComplianceItem]:
        pass
