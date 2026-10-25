from __future__ import annotations

import re

from tenderpulse_ai.domain.docling_parser import is_clause_deleted
from tenderpulse_ai.domain.models import CandidateComplianceItem
from tenderpulse_ai.extraction.clause_references import _extract_clause_reference
from tenderpulse_ai.extraction.rules.base import disambiguate_stamp_paper
from tenderpulse_ai.extraction.rules.commercial import extract_commercial_rules
from tenderpulse_ai.extraction.rules.execution import extract_execution_rules
from tenderpulse_ai.extraction.rules.financial import extract_financial_rules
from tenderpulse_ai.extraction.rules.legal import extract_legal_rules
from tenderpulse_ai.extraction.rules.operational import extract_operational_rules
from tenderpulse_ai.extraction.rules.statutory import extract_statutory_rules
from tenderpulse_ai.extraction.rules.technical import extract_technical_rules


def default_tender_extractor(system_prompt: str, user_prompt: str) -> list[CandidateComplianceItem]:
    """Default intelligent extractor for Indian government tenders.

    Extracts comprehensive compliance criteria across canonical categories with
    exact substring quotes and structured execution rules from tender document page blocks.
    Filters out Table of Contents and bare definitions, ensuring only operative obligations are returned.
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
        if is_clause_deleted(text):
            continue
        text_lower = text.lower()
        clause_ref = _extract_clause_reference(text, page_no)

        candidates.extend(extract_financial_rules(doc_id, page_no, text, text_lower, clause_ref))
        candidates.extend(extract_technical_rules(doc_id, page_no, text, text_lower, clause_ref))
        candidates.extend(extract_legal_rules(doc_id, page_no, text, text_lower, clause_ref))
        candidates.extend(extract_statutory_rules(doc_id, page_no, text, text_lower, clause_ref))
        candidates.extend(extract_execution_rules(doc_id, page_no, text, text_lower, clause_ref))
        candidates.extend(extract_operational_rules(doc_id, page_no, text, text_lower, clause_ref))
        candidates.extend(extract_commercial_rules(doc_id, page_no, text, text_lower, clause_ref))

    return candidates


__all__ = [
    "default_tender_extractor",
    "disambiguate_stamp_paper",
]
