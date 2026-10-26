from __future__ import annotations

import re
from typing import Any

from tenderpulse_ai.agent.validation import clean_whitespace
from tenderpulse_ai.domain.models import VerifiedComplianceItem
from tenderpulse_ai.extraction.contracts import DocumentExtractionRequest


def _titles_are_related(t1: str, t2: str) -> bool:
    s1 = set(re.findall(r"\w+", t1.lower()))
    s2 = set(re.findall(r"\w+", t2.lower()))
    stopwords = {
        "and",
        "or",
        "the",
        "of",
        "in",
        "for",
        "to",
        "a",
        "an",
        "on",
        "as",
        "by",
        "is",
        "at",
    }
    s1 -= stopwords
    s2 -= stopwords
    if not s1 or not s2:
        return False
    return (
        len(s1 & s2) >= 2
        or (len(s1) == 1 and s1.issubset(s2))
        or (len(s2) == 1 and s2.issubset(s1))
    )


_FINGERPRINT_STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "shall",
    "should",
    "must",
    "will",
    "from",
    "that",
    "this",
    "have",
    "been",
    "such",
    "any",
    "all",
    "are",
    "was",
    "were",
    "which",
    "their",
    "its",
}


def _content_fingerprint(text: str) -> set[str]:
    """Normalized content fingerprint: content words (>=3 chars) plus extracted numbers."""
    tokens = re.findall(r"[a-z]{3,}|\d+(?:[.,]\d+)*", (text or "").lower())
    return {t.replace(",", "") for t in tokens if t not in _FINGERPRINT_STOPWORDS}


def quote_overlap_ratio(q1: str, q2: str) -> float:
    """|intersection| / min(|q1|, |q2|) over content fingerprints (1.0 = one contains the other)."""
    f1, f2 = _content_fingerprint(q1), _content_fingerprint(q2)
    if not f1 or not f2:
        return 0.0
    return len(f1 & f2) / min(len(f1), len(f2))


def _focus_sentence(item: dict[str, Any]) -> str | None:
    """The sentence of an item's quote that its own title is about (None if no title word
    appears in any sentence: the title cannot be located in the quote)."""
    quote = item["provenance"].get("verbatimQuote") or ""
    sentences = [s for s in re.split(r"(?<=[.;])\s+(?=[A-Z(])", quote) if s.strip()] or [quote]
    title_words = set(re.findall(r"[a-z]{4,}", item.get("title", "").lower()))
    scored = [(len(title_words & set(re.findall(r"[a-z]{4,}", s.lower()))), s) for s in sentences]
    best_score, best = max(scored, key=lambda pair: pair[0])
    return best if best_score > 0 else None


def _is_same_obligation(existing: dict[str, Any], payload: dict[str, Any]) -> bool:
    """Same/adjacent page, >=65% quote fingerprint overlap, and either related titles or
    titles pointing at the same sentence with related descriptions. One paragraph holding
    two different obligations (e.g. conflict-of-interest and QCBS weightage) stays two."""
    if abs(existing["provenance"]["pageNumber"] - payload["provenance"]["pageNumber"]) > 1:
        return False
    q1 = existing["provenance"].get("verbatimQuote") or ""
    q2 = payload["provenance"].get("verbatimQuote") or ""
    if quote_overlap_ratio(q1, q2) < 0.65:
        return False
    if _titles_are_related(existing["title"], payload["title"]):
        return True
    f1, f2 = _focus_sentence(existing), _focus_sentence(payload)
    return bool(
        f1
        and f2
        and quote_overlap_ratio(f1, f2) >= 0.9
        and _titles_are_related(existing.get("description", ""), payload.get("description", ""))
    )


# Most specific category wins when one obligation was emitted under two categories.
CATEGORY_SPECIFICITY = [
    "FINANCIAL",
    "STATUTORY",
    "LEGAL",
    "EXECUTION",
    "COMMERCIAL",
    "OPERATIONAL",
    "TECHNICAL",
]


def _extract_numeric_percentages(text: str) -> set[float]:
    raw_matches = re.findall(r"\b(\d+(?:\.\d+)?)\s*%", text)
    result = set()
    for m in raw_matches:
        try:
            result.add(float(m))
        except ValueError:
            continue
    return result


_GST_INC_PATTERN = (
    r"\b(?:inclusive of|including)\b"
    r"(?:(?!exclusive|except|excluding)[^.\n]){0,50}"
    r"\b(?:all taxes|statutory (?:taxes|levies|duties)|taxes?|gst)\b"
)
_GST_EXC_PATTERN = (
    r"\b(?:exclusive of|except for|excluding)\b"
    r"(?:(?!inclusive|including)[^.\n]){0,50}"
    r"\b(?:all taxes|statutory (?:taxes|levies|duties)|taxes?|gst)\b"
)


def _are_items_contradictory(it1: dict[str, Any], it2: dict[str, Any]) -> bool:
    t1 = (
        it1.get("title", "")
        + " "
        + it1.get("description", "")
        + " "
        + (it1.get("provenance", {}).get("verbatimQuote") or "")
    ).lower()
    t2 = (
        it2.get("title", "")
        + " "
        + it2.get("description", "")
        + " "
        + (it2.get("provenance", {}).get("verbatimQuote") or "")
    ).lower()

    # 1. PBG percentage conflict (e.g. 3% vs 10%)
    if ("performance" in t1 or "pbg" in t1) and ("performance" in t2 or "pbg" in t2):
        p1 = _extract_numeric_percentages(t1)
        p2 = _extract_numeric_percentages(t2)
        if p1 and p2 and not (p1 & p2):
            return True

    # 2. EMD Monetary vs Bid Securing Declaration
    if ("earnest money" in t1 or "bid security" in t1) and (
        "earnest money" in t2 or "bid security" in t2
    ):
        is_monetary1 = bool(re.search(r"\b(rs\.?|inr|₹|crore|lakh|\d+,\d+)\b", t1))
        is_bsd1 = bool(re.search(r"\b(declaration|bsd)\b", t1))
        is_monetary2 = bool(re.search(r"\b(rs\.?|inr|₹|crore|lakh|\d+,\d+)\b", t2))
        is_bsd2 = bool(re.search(r"\b(declaration|bsd)\b", t2))
        if (is_monetary1 and is_bsd2) or (is_bsd1 and is_monetary2):
            return True

    # 3. GST Pricing Treatment Conflict
    is_inc1 = bool(re.search(_GST_INC_PATTERN, t1))
    is_exc1 = bool(re.search(_GST_EXC_PATTERN, t1))
    is_inc2 = bool(re.search(_GST_INC_PATTERN, t2))
    is_exc2 = bool(re.search(_GST_EXC_PATTERN, t2))
    if is_inc1 and is_exc1:
        is_inc1 = False
    if is_inc2 and is_exc2:
        is_inc2 = False
    if (is_inc1 and is_exc2) or (is_exc1 and is_inc2):
        return True

    return False


def consolidate_verified_items(
    verified_items: list[VerifiedComplianceItem],
    request: DocumentExtractionRequest,
) -> list[dict[str, Any]]:
    """Consolidates cross-page verified items by category/title match and quote overlap,

    fuses execution rules (preferring most restrictive), and combines page citations.
    """
    consolidated_items: list[dict[str, Any]] = []
    for item in verified_items:
        payload = item.to_api_payload()
        norm_title = payload["title"].strip().lower()
        payload_cat = payload["category"]
        cur_quote_raw = payload["provenance"]["verbatimQuote"] or ""
        cur_quote_clean = clean_whitespace(cur_quote_raw).lower()
        cur_page = payload["provenance"]["pageNumber"]

        matched_existing: dict[str, Any] | None = None
        for existing in consolidated_items:
            # Do not merge items declaring contradictory terms (e.g. 3% vs 10% PBG, EMD vs BSD)
            if _are_items_contradictory(existing, payload):
                continue

            # 0. Cross-category fingerprint match: the same obligation emitted under two
            # categories (e.g. turnover as FINANCIAL and TECHNICAL) on the same/adjacent page.
            if existing["category"] != payload_cat and _is_same_obligation(existing, payload):
                matched_existing = existing
                break
            if existing["category"] != payload_cat:
                continue

            # 1. Exact title match within category
            if existing["title"].strip().lower() == norm_title:
                matched_existing = existing
                break

            # 2. Quote overlap match (Category matched, differing page OR related titles)
            ex_quote_raw = existing["provenance"]["verbatimQuote"] or ""
            ex_quote_clean = clean_whitespace(ex_quote_raw).lower()
            if cur_quote_clean and ex_quote_clean:
                quote_len_min = min(len(cur_quote_clean), len(ex_quote_clean))
                is_quote_match = (cur_quote_clean == ex_quote_clean) or (
                    quote_len_min >= 35
                    and (cur_quote_clean in ex_quote_clean or ex_quote_clean in cur_quote_clean)
                )
                if is_quote_match:
                    ex_page = existing["provenance"]["pageNumber"]
                    if ex_page != cur_page or _titles_are_related(
                        payload["title"], existing["title"]
                    ):
                        matched_existing = existing
                        break

        if matched_existing is None:
            payload["supporting_pages"] = [cur_page]
            consolidated_items.append(payload)
        else:
            existing = matched_existing
            if cur_page not in existing["supporting_pages"]:
                existing["supporting_pages"].append(cur_page)

            # Rule fusion (most restrictive requirements win)
            ex_rules = existing["executionRules"]
            new_rules = payload["executionRules"]

            if new_rules.get("stampPaperRequired"):
                ex_rules["stampPaperRequired"] = True

            new_denom = new_rules.get("stampPaperDenominationInr")
            ex_denom = ex_rules.get("stampPaperDenominationInr")
            if new_denom is not None:
                ex_rules["stampPaperDenominationInr"] = max(ex_denom or 0, new_denom)

            if new_rules.get("notarizationRequired"):
                ex_rules["notarizationRequired"] = True

            if new_rules.get("udinRequired"):
                ex_rules["udinRequired"] = True

            ex_quote = existing["provenance"]["verbatimQuote"] or ""
            currency_pattern = r"(?:₹|\b(?:rs\.?|inr|crore|lakh)\b|\b\d{1,3}(?:,\d{2,3})+\b)"
            cur_quote_has_currency = bool(re.search(currency_pattern, cur_quote_raw, re.IGNORECASE))
            ex_quote_has_currency = bool(re.search(currency_pattern, ex_quote, re.IGNORECASE))
            cur_desc_has_currency = bool(
                re.search(currency_pattern, payload.get("description", ""), re.IGNORECASE)
            )
            ex_desc_has_currency = bool(
                re.search(currency_pattern, existing.get("description", ""), re.IGNORECASE)
            )

            cur_has_currency = cur_quote_has_currency or cur_desc_has_currency
            ex_has_currency = ex_quote_has_currency or ex_desc_has_currency

            number_pattern = (
                r"(?:₹|\b(?:rs\.?|inr|crore|lakh)\b|\b\d{1,3}(?:,\d{2,3})+\b|\d+(?:\.\d+)?%)"
            )
            cur_has_numbers = bool(re.search(number_pattern, cur_quote_raw, re.IGNORECASE))
            ex_has_numbers = bool(re.search(number_pattern, ex_quote, re.IGNORECASE))
            if ex_quote_has_currency and not cur_quote_has_currency:
                prefer_new_quote = False
            elif cur_quote_has_currency and not ex_quote_has_currency:
                prefer_new_quote = True
            elif ex_has_currency and not cur_has_currency:
                prefer_new_quote = False
            else:
                prefer_new_quote = (
                    payload["provenance"]["confidenceScore"]
                    > existing["provenance"]["confidenceScore"]
                    or (cur_has_currency and not ex_has_currency)
                    or (cur_has_numbers and not ex_has_numbers)
                    or (not ex_has_numbers and len(ex_quote) < 60 and len(cur_quote_raw) >= 60)
                    or (
                        payload["provenance"]["confidenceScore"]
                        == existing["provenance"]["confidenceScore"]
                        and (cur_has_numbers == ex_has_numbers)
                        and len(cur_quote_raw) > len(ex_quote)
                    )
                )
            if existing["category"] != payload_cat:
                # Cross-category duplicate: the more specific category's item wins.
                rank = {c: i for i, c in enumerate(CATEGORY_SPECIFICITY)}
                prefer_new_quote = rank.get(payload_cat, 99) < rank.get(existing["category"], 99)

            if prefer_new_quote:
                # Title, category, description, quote and reference are adopted together from
                # the winning item, so a merge never pairs one rule's title with another
                # rule's description (e.g. a JV capacity title over a generic JV-MOU text).
                existing["title"] = payload["title"]
                existing["category"] = payload_cat
                existing["description"] = payload["description"]
                existing["provenance"]["confidenceScore"] = max(
                    existing["provenance"]["confidenceScore"],
                    payload["provenance"]["confidenceScore"],
                )
                existing["provenance"]["verbatimQuote"] = payload["provenance"]["verbatimQuote"]
                clause_ref = (
                    payload["provenance"].get("clauseReference")
                    or payload["provenance"].get("sectionOrClause")
                    or existing["provenance"].get("clauseReference")
                    or existing["provenance"].get("sectionOrClause")
                )
                existing["provenance"]["clauseReference"] = clause_ref
                existing["provenance"]["sectionOrClause"] = clause_ref
                existing["provenance"]["pageNumber"] = payload["provenance"]["pageNumber"]

    formatted_items = consolidated_items
    for item in formatted_items:
        pages = sorted(item.pop("supporting_pages", [item["provenance"]["pageNumber"]]))
        if len(pages) > 1:
            base_ref = (
                item["provenance"].get("clauseReference")
                or item["provenance"].get("sectionOrClause")
                or "Clause"
            )
            base_ref_clean = re.sub(r"\s*\(Pages?\s+[\d,\s]+\)\s*$", "", base_ref)
            base_ref_clean = re.sub(r"\s*\(Page\s+\d+\)\s*$", "", base_ref_clean)
            combined_clause = f"{base_ref_clean} (Pages {', '.join(str(p) for p in pages)})"
            item["provenance"]["clauseReference"] = combined_clause
            item["provenance"]["sectionOrClause"] = combined_clause
        item["provenance"]["sourceDocumentId"] = request.document_id
        item["provenance"]["sourceFileName"] = request.file_name

    # Document reading order (stable within a page), independent of retrieval ranking.
    formatted_items.sort(key=lambda it: it["provenance"]["pageNumber"])
    return formatted_items


def detect_clause_contradictions(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Detects conflicting parameters across sections of the same tender

    (e.g., 3% vs 10% PBG; monetary EMD vs Bid Securing Declaration; GST inclusive vs exclusive).
    """
    contradictions: list[dict[str, Any]] = []

    # 1. PBG percentage contradiction
    pbg_items = [
        it
        for it in items
        if "performance security" in it.get("title", "").lower()
        or "pbg" in it.get("title", "").lower()
    ]
    pct_to_items: dict[float, list[dict[str, Any]]] = {}
    for it in pbg_items:
        text = (
            it.get("description", "") + " " + (it.get("provenance", {}).get("verbatimQuote", ""))
        ).lower()
        pcts = _extract_numeric_percentages(text)
        for p in pcts:
            pct_to_items.setdefault(p, []).append(it)

    if len(pct_to_items) > 1:
        conflicting_strs = []
        governing_cand = None
        inferior_cand = None
        for p, it_list in sorted(pct_to_items.items()):
            page = it_list[0].get("provenance", {}).get("pageNumber", 1)
            ref = it_list[0].get("provenance", {}).get("clauseReference") or f"Page {page}"
            conflicting_strs.append(f"{p:g}% ({ref})")
            ref_l = ref.lower()
            if any(k in ref_l for k in ("itb", "nit", "bds", "scc")):
                governing_cand = (p, ref)
            elif any(k in ref_l for k in ("gcc", "general")):
                inferior_cand = (p, ref)

        if governing_cand and inferior_cand:
            gov_val, gov_ref = governing_cand
            inf_val, inf_ref = inferior_cand
            ruling = f"Per standard Order of Precedence, {gov_ref} ({gov_val:g}%) governs over {inf_ref} ({inf_val:g}%)."
        else:
            sorted_keys = sorted(pct_to_items.keys())
            first_ref = (
                pct_to_items[sorted_keys[0]][0].get("provenance", {}).get("clauseReference")
                or "Specific Clause"
            )
            second_ref = (
                pct_to_items[sorted_keys[1]][0].get("provenance", {}).get("clauseReference")
                or "General Clause"
            )
            ruling = f"Per Order of Precedence, specific tender conditions ({first_ref} - {sorted_keys[0]:g}%) govern over general conditions ({second_ref} - {sorted_keys[1]:g}%)."

        contradictions.append(
            {
                "type": "CLAUSE_CONTRADICTION",
                "topic": "Performance Security (PBG) Percentage Conflict",
                "detail": f"Conflicting PBG values extracted: {', '.join(conflicting_strs)}.",
                "order_of_precedence_ruling": ruling,
                "conflicting_values": conflicting_strs,
            }
        )

    # 2. EMD vs Bid Securing Declaration Detector
    emd_items = [
        it
        for it in items
        if "earnest money" in it.get("title", "").lower()
        or "bid security" in it.get("title", "").lower()
    ]
    monetary_emd = [
        it
        for it in emd_items
        if re.search(
            r"\b(rs\.?|inr|₹|crore|lakh|\d+,\d+)\b",
            (
                it.get("description", "")
                + " "
                + (it.get("provenance", {}).get("verbatimQuote") or "")
            ).lower(),
        )
    ]
    bsd_items = [
        it
        for it in emd_items
        if re.search(
            r"\b(declaration|bsd)\b",
            (
                it.get("description", "")
                + " "
                + (it.get("provenance", {}).get("verbatimQuote") or "")
            ).lower(),
        )
    ]
    if monetary_emd and bsd_items:
        m_ref = (
            monetary_emd[0].get("provenance", {}).get("clauseReference")
            or f"Page {monetary_emd[0].get('provenance', {}).get('pageNumber', 1)}"
        )
        b_ref = (
            bsd_items[0].get("provenance", {}).get("clauseReference")
            or f"Page {bsd_items[0].get('provenance', {}).get('pageNumber', 1)}"
        )
        contradictions.append(
            {
                "type": "CLAUSE_CONTRADICTION",
                "topic": "EMD Monetary Deposit vs. Bid Securing Declaration",
                "detail": f"Tender cites monetary EMD requirement ({m_ref}) and Bid Securing Declaration ({b_ref}).",
                "order_of_precedence_ruling": f"Specific Notice Inviting Tender / EMD provision ({m_ref}) governs over generic BSD format ({b_ref}).",
                "conflicting_values": [m_ref, b_ref],
            }
        )

    # 3. GST Pricing Treatment Conflict
    gst_inc = [
        it
        for it in items
        if re.search(
            _GST_INC_PATTERN,
            (
                it.get("description", "")
                + " "
                + (it.get("provenance", {}).get("verbatimQuote") or "")
            ).lower(),
        )
    ]
    gst_exc = [
        it
        for it in items
        if re.search(
            _GST_EXC_PATTERN,
            (
                it.get("description", "")
                + " "
                + (it.get("provenance", {}).get("verbatimQuote") or "")
            ).lower(),
        )
    ]
    gst_inc = [it for it in gst_inc if it not in gst_exc]
    if gst_inc and gst_exc:
        inc_ref = (
            gst_inc[0].get("provenance", {}).get("clauseReference")
            or f"Page {gst_inc[0].get('provenance', {}).get('pageNumber', 1)}"
        )
        exc_ref = (
            gst_exc[0].get("provenance", {}).get("clauseReference")
            or f"Page {gst_exc[0].get('provenance', {}).get('pageNumber', 1)}"
        )
        contradictions.append(
            {
                "type": "CLAUSE_CONTRADICTION",
                "topic": "GST Pricing Treatment Conflict",
                "detail": f"Contradictory GST clauses found: Inclusive ({inc_ref}) vs Exclusive ({exc_ref}).",
                "order_of_precedence_ruling": f"Financial Proposal Instructions ({exc_ref}) govern price schedule comparison over general contract clauses ({inc_ref}).",
                "conflicting_values": [inc_ref, exc_ref],
            }
        )

    return contradictions


__all__ = [
    "quote_overlap_ratio",
    "_titles_are_related",
    "consolidate_verified_items",
    "detect_clause_contradictions",
]
