"""Positional clause attribution: a missing or generic clause reference on an LLM item is
filled from the structure-tree path of the block that holds the item's verbatim quote."""

from __future__ import annotations

import re


def _norm_for_match(text: str) -> str:
    return " ".join(re.sub(r"-\s*\n\s*", "", text or "").lower().split())


_GENERIC_REF_RE = re.compile(
    r"^\s*(?:$|page\s*\d+|clause(?:\s+reference)?(?:\s+on\s+page\s*\d+)?|clause\s*\(page\s*\d+\))\s*$",
    re.IGNORECASE,
)


def _agrees(model_ref: str, path: str) -> bool:
    """'Clause 5(xix) (Page 4)' agrees with path 'Clause 5(xix)' (or a parent/child of it)."""
    if _GENERIC_REF_RE.match(model_ref):
        return False
    ref = _norm_for_match(re.sub(r"\(page\s*\d+\)", "", model_ref, flags=re.IGNORECASE))
    pth = _norm_for_match(path)
    return bool(ref) and (ref in pth or pth in ref)


def attribute_positional_clause_refs(items: list, doc, tree) -> int:
    """Attributes each item's clause reference from the block that physically holds its
    quote (positional AST path built from line-start markers only). The model's reference is
    kept when it agrees with that path; a generic one ('Page N') or a mid-sentence mention
    ('circular no. 42.17' -> 'Clause 42.17') is replaced. Returns the number re-attributed.
    """
    block_paths: dict[str, str] = getattr(tree, "block_paths", None) or {}
    if not block_paths:
        return 0
    indexed = [
        (b.page_number, _norm_for_match(b.text), block_paths[b.block_id])
        for b in doc.blocks
        if b.block_id in block_paths
    ]
    updated = 0
    for item in items:
        prov = item.provenance
        quote = _norm_for_match(prov.verbatim_quote)
        if len(quote) < 20:
            continue
        probes = [quote[:80], quote[-60:]]
        near = sorted(
            (row for row in indexed if abs(row[0] - prov.page_number) <= 1),
            key=lambda row: abs(row[0] - prov.page_number),
        )
        path = next(
            (p for probe in probes for _pg, txt, p in near if probe in txt),
            None,
        )
        if path and not _agrees(prov.clause_reference or "", path):
            prov.clause_reference = f"{path} (Page {prov.page_number})"
            updated += 1
    return updated


__all__ = ["attribute_positional_clause_refs"]
