from __future__ import annotations

import re

from tenderpulse_ai.domain.docling_parser import (
    DELETED_CLAUSE_PATTERN,
    INLINE_DELETED_PATTERN,
    is_clause_deleted,
)

RUNNING_FURNITURE_PATTERN = re.compile(
    r"(?m)^\s*(?:IHMCL|Indian Highways Management Company Limited|"
    r"RFP FOR SELECTION.*|Page \d+ of \d+|Notice Inviting Tender|"
    r"NATIONAL HIGHWAYS AUTHORITY OF INDIA)\s*$",
    re.IGNORECASE,
)


def strip_running_furniture(text: str) -> str:
    """Removes repetitive running headers, footers, and page-count watermarks."""
    return RUNNING_FURNITURE_PATTERN.sub("", text)


def coalesce_wrapped_lines(lines: list[str]) -> list[str]:
    """Merges consecutive wrapped lines into full grammatical paragraphs."""
    paragraphs: list[str] = []
    buffer: list[str] = []
    for line in lines:
        cleaned = line.strip()
        if not cleaned:
            if buffer:
                paragraphs.append(" ".join(buffer))
                buffer = []
        else:
            buffer.append(cleaned)
    if buffer:
        paragraphs.append(" ".join(buffer))
    return paragraphs


__all__ = [
    "DELETED_CLAUSE_PATTERN",
    "INLINE_DELETED_PATTERN",
    "is_clause_deleted",
    "strip_running_furniture",
    "coalesce_wrapped_lines",
]
