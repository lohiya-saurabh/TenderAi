from __future__ import annotations

import re

# Deterministic validation for agent output. These functions are the trust boundary:
# nothing leaves the agent unless it passes grounding verification here.

CANONICAL_CATEGORIES = {
    "FINANCIAL",
    "EXECUTION",
    "TECHNICAL",
    "LEGAL",
    "STATUTORY",
    "COMMERCIAL",
    "OPERATIONAL",
    "COMMERCIAL_RISK",
    "ANNEXURE_DECLARATION",
    # Evaluation suite & domain categories
    "EMD",
    "PBG",
    "TURNOVER",
    "SIMILAR_WORK",
    "CERTIFICATION",
    "SIGNING_AUTHORITY",
    "SOLVENCY",
}

CATEGORY_ALIASES = {
    # Financial
    "FINANCE": "FINANCIAL",
    "FINANCIAL CAPACITY": "FINANCIAL",
    "FINANCIAL_QUALIFICATION": "FINANCIAL",
    "FINANCIAL QUALIFICATION": "FINANCIAL",
    "AUDIT_REQUIREMENT": "FINANCIAL",
    "AUDIT REQUIREMENT": "FINANCIAL",
    "PRICING_STANDARD": "FINANCIAL",
    "PRICING STANDARD": "FINANCIAL",
    # Technical
    "ENGINEERING": "TECHNICAL",
    "TECHNICAL QUALIFICATION": "TECHNICAL",
    "TECHNICAL_QUALIFICATION": "TECHNICAL",
    "TECHNICAL_REQUIREMENT": "TECHNICAL",
    "TECHNICAL REQUIREMENT": "TECHNICAL",
    "TECHNICAL_STANDARD": "TECHNICAL",
    "TECHNICAL STANDARD": "TECHNICAL",
    "TECHNICAL_SCOPE_REQUIREMENT": "TECHNICAL",
    "TECHNICAL SCOPE REQUIREMENT": "TECHNICAL",
    "TECHNICAL SERVICE OBLIGATION": "TECHNICAL",
    "TECHNICAL_SERVICE_OBLIGATION": "TECHNICAL",
    "TECHNICAL_REQUIREMENT_AND_MANDATORY_SUBMISSION": "TECHNICAL",
    "TECHNICAL REQUIREMENT AND MANDATORY SUBMISSION": "TECHNICAL",
    "TECHNICAL_CAPACITY_CRITERION": "TECHNICAL",
    "TECHNICAL CAPACITY CRITERION": "TECHNICAL",
    "SCOPE_OF_WORK": "TECHNICAL",
    "SCOPE OF WORK": "TECHNICAL",
    "EXPERIENCE": "TECHNICAL",
    "ELIGIBILITY_CONDITION": "TECHNICAL",
    "ELIGIBILITY CONDITION": "TECHNICAL",
    # Statutory
    "LEGAL/STATUTORY": "STATUTORY",
    "REGULATORY": "STATUTORY",
    "MANDATORY_SUBMISSION": "STATUTORY",
    "MANDATORY SUBMISSION": "STATUTORY",
    "MANDATORY TECHNICAL SUBMISSIONS": "STATUTORY",
    "MANDATORY_TECHNICAL_SUBMISSIONS": "STATUTORY",
    "MANDATORY FINANCIAL SUBMISSION": "STATUTORY",
    "MANDATORY_FINANCIAL_SUBMISSION": "STATUTORY",
    # Commercial
    "PROCUREMENT_DEADLINE": "COMMERCIAL",
    "PROCUREMENT DEADLINE": "COMMERCIAL",
    "PROCUREMENT_CONDITION": "COMMERCIAL",
    "PROCUREMENT CONDITION": "COMMERCIAL",
    "PROCUREMENT_ACCESS_CONDITION": "COMMERCIAL",
    "PROCUREMENT ACCESS CONDITION": "COMMERCIAL",
    # Legal
    "RESTRICTIVE_CONDITION": "LEGAL",
    "RESTRICTIVE CONDITION": "LEGAL",
    "LEGAL_COVENANT": "LEGAL",
    "LEGAL COVENANT": "LEGAL",
    "CONTRACT_TERM": "LEGAL",
    "CONTRACT TERM": "LEGAL",
    "CONTRACT_DURATION": "LEGAL",
    "CONTRACT DURATION": "LEGAL",
    "DISQUALIFICATION": "LEGAL",
    "BIDDER_RESPONSIBILITY": "LEGAL",
    "BIDDER RESPONSIBILITY": "LEGAL",
}


def normalize_category(raw: str) -> str:
    """Normalizes a model-returned category into the canonical taxonomy.

    Raises ValueError for unknown categories — the candidate is rejected, never guessed.
    """
    clean = " ".join(raw.strip().upper().split())
    if clean in CANONICAL_CATEGORIES:
        return clean
    if clean in CATEGORY_ALIASES:
        return CATEGORY_ALIASES[clean]

    # Try normalized underscore / space format
    space_form = " ".join(clean.replace("_", " ").split())
    if space_form in CANONICAL_CATEGORIES:
        return space_form
    if space_form in CATEGORY_ALIASES:
        return CATEGORY_ALIASES[space_form]

    under_form = "_".join(clean.split())
    if under_form in CANONICAL_CATEGORIES:
        return under_form
    if under_form in CATEGORY_ALIASES:
        return CATEGORY_ALIASES[under_form]

    raise ValueError(f"Unknown requirement category: '{raw}'")


def clean_whitespace(text: str) -> str:
    """Replaces internal line breaks and multiple consecutive spaces with a single space."""
    if not text:
        return ""
    return " ".join(text.split())


def normalize_whitespace(text: str) -> str:
    return clean_whitespace(text).lower()


def is_dangling_fragment(quote: str, description: str = "") -> bool:
    """Rejects incomplete sentence fragments, dangling predicates, or isolated table footnotes."""
    clean = quote.strip()
    if len(clean) < 25:
        return True
    # 1. Starts with a lowercase letter (unless it's an enumerated list item like "a.", "b.", "(a)", or roman numerals "(i)", "i.", or tabular modal with metric)
    if (
        re.match(r"^[a-z]", clean)
        and not re.match(r"^(?:[a-z]|[ivx]+)[.)]\s|^\([a-z0-9ivx]+\)\s", clean, re.IGNORECASE)
        and not (
            clean.lower().startswith("should be")
            and re.search(r"\b(?:rs\.?|inr|crore|lakh)\b", clean, re.IGNORECASE)
        )
    ):
        return True
    # 2. Starts with a mid-sentence conjunction or dangling predicate
    if re.match(r"^(?:and|or|nor|equal\s+to|less\s+than)\b", clean, re.IGNORECASE):
        return True
    if re.match(
        r"^(?:should\s+be|shall\s+be|must\s+be|will\s+be|more\s+than)\b",
        clean,
        re.IGNORECASE,
    ):
        desc_clean = description.strip().lower()
        if not desc_clean or re.match(
            r"^(?:should|shall|must|will|equal|and|or|nor|more\s+than|less\s+than)\b", desc_clean
        ):
            return True
        has_metric = bool(
            re.search(r"\b(?:rs\.?|inr|crore|crores|lakh|lakhs|\d+%)\b", clean, re.IGNORECASE)
        )
        if not (has_metric and len(description) >= 20):
            return True
    # 3. Contextless table footnote where description still leaves "Sr. No." unresolved
    if re.match(r"^Notes?\s*[:\-–]?\s*\(?\d*\)?", clean, re.IGNORECASE):
        if re.search(r"\b(?:Sr|Sl|S)\.?\s*No\.?\s*\d+", clean, re.IGNORECASE) and re.search(
            r"\b(?:Sr|Sl|S)\.?\s*No\.?\s*\d+", description, re.IGNORECASE
        ):
            return True
    return False


def verify_grounding(verbatim_quote: str, page_text: str) -> bool:
    """Exact-substring grounding check (case/whitespace-insensitive).

    The same invariant the extraction pipeline enforces: a quote that is not an exact
    character sequence of the source page text is treated as hallucinated and rejected.
    """
    if not verbatim_quote or not page_text:
        return False
    return normalize_whitespace(verbatim_quote) in normalize_whitespace(page_text)
