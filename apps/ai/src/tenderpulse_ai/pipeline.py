"""Backward-compatible facade for tender compliance extraction.

All extraction logic is decomposed into dedicated submodules under tenderpulse_ai.extraction.
"""

from __future__ import annotations

from tenderpulse_ai.extraction.clause_references import (
    ABBREVIATIONS,
    DIVISION_KEYWORDS_PATTERN,
    _extract_clause_from_clause_text,
    _extract_clause_reference,
    _is_abbreviation_or_number_period,
    _is_calendar_date_or_measurement,
    extract_clause_reference,
    is_toc_or_definition,
)
from tenderpulse_ai.extraction.contracts import (
    DocumentExtractionRequest,
    DocumentExtractionResponse,
    NormalizedPage,
)
from tenderpulse_ai.extraction.deduplication import _titles_are_related
from tenderpulse_ai.extraction.metrics import (
    extract_monetary_amounts,
    extract_percentages,
    extract_temporal_durations,
)
from tenderpulse_ai.extraction.orchestrator import ProductionExtractionPipeline
from tenderpulse_ai.extraction.quote_resolver import (
    _extract_operative_clause,
    _extract_sentence,
    _extract_verbatim_window,
    _resolve_quote,
    clean_whitespace,
    extract_complete_clause_window,
    has_operative_obligation,
)
from tenderpulse_ai.extraction.rules import default_tender_extractor

__all__ = [
    "NormalizedPage",
    "DocumentExtractionRequest",
    "DocumentExtractionResponse",
    "ProductionExtractionPipeline",
    "default_tender_extractor",
    "extract_temporal_durations",
    "extract_monetary_amounts",
    "extract_percentages",
    "extract_clause_reference",
    "_extract_clause_reference",
    "_extract_clause_from_clause_text",
    "_is_calendar_date_or_measurement",
    "_is_abbreviation_or_number_period",
    "_extract_sentence",
    "is_toc_or_definition",
    "_extract_operative_clause",
    "_extract_verbatim_window",
    "extract_complete_clause_window",
    "has_operative_obligation",
    "_resolve_quote",
    "_titles_are_related",
    "ABBREVIATIONS",
    "DIVISION_KEYWORDS_PATTERN",
    "clean_whitespace",
]
