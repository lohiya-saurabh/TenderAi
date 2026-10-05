from __future__ import annotations

# Deterministic validation for agent output. These functions are the trust boundary:
# nothing leaves the agent unless it passes grounding verification here.

CANONICAL_CATEGORIES = {
    "FINANCIAL",
    "EXECUTION",
    "TECHNICAL",
    "LEGAL",
    "STATUTORY",
    "COMMERCIAL",
    "COMMERCIAL_RISK",
    "ANNEXURE_DECLARATION",
}

CATEGORY_ALIASES = {
    "FINANCE": "FINANCIAL",
    "FINANCIAL CAPACITY": "FINANCIAL",
    "ENGINEERING": "TECHNICAL",
    "TECHNICAL QUALIFICATION": "TECHNICAL",
    "EXPERIENCE": "TECHNICAL",
    "LEGAL/STATUTORY": "STATUTORY",
    "REGULATORY": "STATUTORY",
}


def normalize_category(raw: str) -> str:
    """Normalizes a model-returned category into the canonical taxonomy.

    Raises ValueError for unknown categories — the candidate is rejected, never guessed.
    """
    upper = " ".join(raw.strip().upper().split())
    if upper in CANONICAL_CATEGORIES:
        return upper
    if upper in CATEGORY_ALIASES:
        return CATEGORY_ALIASES[upper]
    raise ValueError(f"Unknown requirement category: '{raw}'")


def normalize_whitespace(text: str) -> str:
    return " ".join(text.lower().split())


def verify_grounding(verbatim_quote: str, page_text: str) -> bool:
    """Exact-substring grounding check (case/whitespace-insensitive).

    The same invariant the extraction pipeline enforces: a quote that is not an exact
    character sequence of the source page text is treated as hallucinated and rejected.
    """
    if not verbatim_quote or not page_text:
        return False
    return normalize_whitespace(verbatim_quote) in normalize_whitespace(page_text)
