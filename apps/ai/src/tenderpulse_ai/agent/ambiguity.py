from __future__ import annotations

import re

from tenderpulse_ai.agent.schemas import AmbiguityFlag, AmbiguityType

# Deterministic ambiguity heuristics. Every pattern is unit-testable and explainable —
# ambiguity detection must never depend on model judgment.

_VAGUE_QUANTIFIER_PATTERN = re.compile(
    r"\b(adequate|sufficient|reasonable|appropriate|suitable|enough|proper|as required|as applicable)\b",
    re.IGNORECASE,
)
_UNDEFINED_TERM_PATTERN = re.compile(r"\b(etc\.?|and so on|and other similar)\b", re.IGNORECASE)
_DATE_CONCEPT_PATTERN = re.compile(
    r"\b(valid|validity|expir|period|deadline|duration|timely)\b", re.IGNORECASE
)
_DATE_PATTERN = re.compile(r"\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b|\b(?:19|20)\d{2}\b")
_NUMBER_PATTERN = re.compile(r"\b\d[\d,\.]*\b")
_AMOUNT_PATTERN = re.compile(
    r"(?:₹|Rs\.?\s*|INR\s*)\s*\d[\d,]*(?:\.\d+)?\s*(?:crore|lakh|thousand)?",
    re.IGNORECASE,
)
_THRESHOLD_CONCEPTS = ("turnover", "net worth", "past experience", "similar work", "value of work")
_CERTIFICATE_PATTERN = re.compile(
    r"\b(certificate|declaration|undertaking|affidavit|proof of)\b", re.IGNORECASE
)
_AUTHORITY_PATTERN = re.compile(
    r"\b(chartered accountant|statutory auditor|authorized signatory|superintending engineer"
    r"|engineer|manager|director|bank|notary|udin|CA)\b",
    re.IGNORECASE,
)


def scan_ambiguities(title: str, verbatim_quote: str) -> list[AmbiguityFlag]:
    """Scans a requirement's title and verbatim quote for deterministic ambiguity signals."""
    flags: list[AmbiguityFlag] = []
    haystack = f"{title} {verbatim_quote}"
    haystack_lower = haystack.lower()

    vague = _VAGUE_QUANTIFIER_PATTERN.search(haystack)
    if vague:
        flags.append(
            AmbiguityFlag(
                type=AmbiguityType.VAGUE_QUANTIFIER,
                detail=(
                    f"Vague quantifier '{vague.group(0)}' — no measurable threshold; "
                    "the requirement cannot be deterministically validated."
                ),
                quote=vague.group(0),
            )
        )

    undefined = _UNDEFINED_TERM_PATTERN.search(haystack)
    if undefined:
        flags.append(
            AmbiguityFlag(
                type=AmbiguityType.UNDEFINED_TERM,
                detail=(
                    f"Undefined term '{undefined.group(0)}' — the requirement's scope boundary is open."
                ),
                quote=undefined.group(0),
            )
        )

    if (
        any(concept in haystack_lower for concept in _THRESHOLD_CONCEPTS)
        and not _NUMBER_PATTERN.search(verbatim_quote)
    ):
        flags.append(
            AmbiguityFlag(
                type=AmbiguityType.MISSING_THRESHOLD,
                detail=(
                    "Threshold concept (turnover/experience/value) present but no numeric "
                    "threshold in the cited clause — the requirement is not testable as written."
                ),
                quote=verbatim_quote[:140],
            )
        )

    if _DATE_CONCEPT_PATTERN.search(haystack) and not _DATE_PATTERN.search(verbatim_quote):
        flags.append(
            AmbiguityFlag(
                type=AmbiguityType.MISSING_DATE,
                detail=(
                    "Validity/period concept present but no date in the cited clause — "
                    "expiry cannot be evaluated (conservative: treat as unknown validity)."
                ),
                quote=verbatim_quote[:140],
            )
        )

    amounts = {" ".join(match.split()) for match in _AMOUNT_PATTERN.findall(verbatim_quote)}
    if len(amounts) > 1:
        flags.append(
            AmbiguityFlag(
                type=AmbiguityType.NUMERIC_CONFLICT,
                detail=(
                    f"Conflicting amounts in one clause ({', '.join(sorted(amounts))}) — "
                    "the requirement contradicts itself and must be clarified by the tendering authority."
                ),
                quote=verbatim_quote[:140],
            )
        )

    if _CERTIFICATE_PATTERN.search(haystack) and not _AUTHORITY_PATTERN.search(haystack):
        flags.append(
            AmbiguityFlag(
                type=AmbiguityType.MISSING_SIGNATORY,
                detail=(
                    "Certificate/declaration required but no issuing authority or signatory rank "
                    "specified — verification tier cannot be determined."
                ),
                quote=verbatim_quote[:140],
            )
        )

    return flags
