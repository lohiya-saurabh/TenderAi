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
            prov.clause_reference = path  # the page is a separate field
            updated += 1
    return updated


# A clause number written at the start of a line: "2.1", "A1.2", "SCC 7.1", "Clause 4",
# "ITB 15.2(a)", "(k)", "(iv)". Dates such as "28.11.2026" are not clause numbers.
_LINE_MARKER_RE = re.compile(
    r"^\s*(?P<m>"
    r"(?:clause|article|section|para(?:graph)?|itb|bds|gcc|scc|sbd|annex(?:ure)?|appendix|schedule)"
    r"\s+[A-Z0-9][\w.]*(?:\([a-z0-9ivx]+\))*"
    r"|[A-Z]{0,2}\d+(?:\.\d+)+[A-Za-z]?(?:\([a-z0-9ivx]+\))*"
    r"|\d{1,3}\.?(?=\s)"
    r"|\((?:[a-z]{1,2}|[ivx]{1,5})\)"
    r")(?=\s|$)",
    re.IGNORECASE,
)
_DATE_RE = re.compile(r"^\d{1,2}\.\d{1,2}\.\d{2,4}$")


def _line_marker(line: str) -> str | None:
    m = _LINE_MARKER_RE.match(line)
    if not m:
        return None
    marker = m.group("m").strip().rstrip(".")
    return None if _DATE_RE.match(marker) else marker


def clause_ref_from_page(page_text: str, quote: str) -> tuple[str | None, bool]:
    """(clause number, quote_located) for a quote, read from the page's own lines.

    The number written at the start of the quote's own line wins; otherwise the nearest
    numbered line above it on the same page. Never crosses a page boundary and never invents
    a reference: an unnumbered clause gets None.
    """
    lines = (page_text or "").splitlines()
    probe = _norm_for_match(quote)[:40]
    if not probe:
        return None, False
    for idx in range(len(lines)):
        window = _norm_for_match(" ".join(lines[idx : idx + 4]))
        if probe in window and probe not in _norm_for_match(" ".join(lines[idx + 1 : idx + 4])):
            line = lines[idx]
            own = _line_marker(line)
            # the marker belongs to this quote when the quote starts after it on the line
            if own and _norm_for_match(line).find(probe[:20]) > 0:
                return own, True
            for above in reversed(lines[:idx]):
                marker = _line_marker(above)
                if marker:
                    return marker, True
            return None, True
    return None, False


def attribute_clause_refs_from_pages(items: list, pages: dict[int, str]) -> int:
    """Sets each item's clause reference from the page text around its quote (see
    ``clause_ref_from_page``). A reference that cannot be read from the page is kept only if
    it is specific (not 'Page N' / 'Clause'). Returns the number of references changed."""
    changed = 0
    for item in items:
        prov = item.provenance
        ref, located = clause_ref_from_page(pages.get(prov.page_number, ""), prov.verbatim_quote)
        if not located:
            if prov.clause_reference and _GENERIC_REF_RE.match(prov.clause_reference):
                prov.clause_reference = None
                changed += 1
            continue
        if ref != prov.clause_reference:
            prov.clause_reference = ref
            changed += 1
    return changed


__all__ = [
    "attribute_positional_clause_refs",
    "attribute_clause_refs_from_pages",
    "clause_ref_from_page",
]
