from __future__ import annotations

import datetime
import re
from typing import Any

STOP_WORDS = {
    "what",
    "where",
    "when",
    "which",
    "who",
    "whom",
    "this",
    "that",
    "these",
    "those",
    "am",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "having",
    "do",
    "does",
    "did",
    "doing",
    "a",
    "an",
    "the",
    "and",
    "but",
    "if",
    "or",
    "because",
    "as",
    "until",
    "while",
    "of",
    "at",
    "by",
    "for",
    "with",
    "about",
    "against",
    "between",
    "into",
    "through",
    "during",
    "before",
    "after",
    "above",
    "below",
    "to",
    "from",
    "up",
    "down",
    "in",
    "out",
    "on",
    "off",
    "over",
    "under",
    "again",
    "further",
    "then",
    "once",
    "here",
    "there",
    "all",
    "any",
    "both",
    "each",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
    "no",
    "nor",
    "not",
    "only",
    "own",
    "same",
    "so",
    "than",
    "too",
    "very",
    "can",
    "will",
    "just",
    "should",
    "now",
    "you",
    "your",
    "how",
    "does",
    "have",
    "has",
    "had",
    "can",
    "could",
    "would",
    "tell",
    "say",
}


PROCUREMENT_WRAPPER_WORDS = {
    "tender",
    "tenders",
    "document",
    "documents",
    "bid",
    "bids",
    "bidding",
    "clause",
    "clauses",
    "section",
    "sections",
    "according",
    "provide",
    "give",
    "show",
    "tell",
    "what",
    "where",
    "volume",
    "rfp",
    "nit",
    "gcc",
    "scc",
    "rule",
    "rules",
    "our",
    "company",
    "contract",
    "contracts",
    "highway",
    "highways",
    "project",
    "projects",
}


OUT_OF_DOMAIN_PATTERNS = re.compile(
    r"\b("
    r"rocket|propulsion|spacecraft|satellite\s+launch|missile|"
    r"nuclear\s+submarine|submarine|torpedo|warship|"
    r"crypto|cryptocurrency|bitcoin|ethereum|arbitrage|hash\s+rate|"
    r"veterinary|knee\s+surgery|cattle|livestock|farm\s+animal|"
    r"pizza|toppings|cookie|cookies|recipe|bake|baking|chocolate\s+chip|"
    r"bollywood|box\s+office|sports\s+betting|cricket\s+match(?:es)?|national\s+anthem|lyrics"
    r")\b",
    re.IGNORECASE,
)

NON_ANIMAL_OUT_OF_DOMAIN_PATTERNS = re.compile(
    r"\b("
    r"rocket|propulsion|spacecraft|satellite\s+launch|missile|"
    r"nuclear\s+submarine|submarine|torpedo|warship|"
    r"crypto|cryptocurrency|bitcoin|ethereum|arbitrage|hash\s+rate|"
    r"knee\s+surgery|pizza|toppings|cookie|cookies|recipe|bake|baking|chocolate\s+chip|"
    r"bollywood|box\s+office|sports\s+betting|cricket\s+match(?:es)?|national\s+anthem|lyrics"
    r")\b",
    re.IGNORECASE,
)

INFRA_CIVIL_TERMS_PATTERN = re.compile(
    r"\b(underpass|culvert|crossing|overpass|bypass|bridge|subway|drainage|corridor)\b",
    re.IGNORECASE,
)


def is_out_of_domain(query: str) -> bool:
    """Detects adversarial, non-procurement, or ungrounded queries."""
    if not query or not isinstance(query, str):
        return False
    # If the query contains infrastructure engineering terms (e.g. 'cattle underpass'),
    # evaluate against non-animal adversarial patterns to avoid false rejections.
    if INFRA_CIVIL_TERMS_PATTERN.search(query):
        return bool(NON_ANIMAL_OUT_OF_DOMAIN_PATTERNS.search(query))
    return bool(OUT_OF_DOMAIN_PATTERNS.search(query))


def extract_keywords(query: str) -> list[str]:
    raw_tokens = [w.lower() for w in re.findall(r"\w+", query) if len(w) > 2]
    filtered = [w for w in raw_tokens if w not in STOP_WORDS]
    return filtered if filtered else raw_tokens


def parse_date_safe(date_str: str | None) -> datetime.date | None:
    """Parses ISO and common Indian date formats (DD/MM/YYYY, DD-MM-YYYY, DD-Mon-YYYY, etc.)."""
    if not date_str or not isinstance(date_str, str):
        return None
    date_str = date_str.strip()
    if "T" in date_str:
        date_str = date_str.split("T")[0]
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d", "%d.%m.%Y", "%d %m %Y"):
        try:
            return datetime.datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    for fmt in ("%d-%b-%Y", "%d %b %Y", "%d-%B-%Y", "%d %B %Y", "%b %d, %Y", "%B %d, %Y"):
        try:
            return datetime.datetime.strptime(date_str, fmt).date()
        except ValueError:
            pass
    return None


def parse_financial_amount_crores(val: Any, default: float | None = None) -> float | None:
    """Parses numeric or textual currency representations into INR Crores.
    Handles '100 Lakhs' (1.0 Cr), '10 Million' (1.0 Cr), '25 Cr', '₹ 25 Crores', etc.
    """
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        v = val.strip().lower()
        if not v:
            return default
        # Clean currency symbols and commas
        v = (
            v.replace("inr", "")
            .replace("rs.", "")
            .replace("rs", "")
            .replace("₹", "")
            .replace(",", "")
            .strip()
        )
        m_lakh = re.match(r"^([0-9.]+)\s*(?:lakh|lakhs|lac|lacs)$", v)
        if m_lakh:
            return round(float(m_lakh.group(1)) / 100.0, 4)
        m_mil = re.match(r"^([0-9.]+)\s*(?:million|mn)$", v)
        if m_mil:
            return round(float(m_mil.group(1)) / 10.0, 4)
        m_cr = re.match(r"^([0-9.]+)\s*(?:cr|crore|crores)$", v)
        if m_cr:
            return round(float(m_cr.group(1)), 4)
        try:
            num = float(v)
            if num >= 10_000_000:
                return round(num / 10_000_000.0, 4)
            return num
        except ValueError:
            return default
    return default


def keyword_matches_text(kw: str, text: str) -> bool:
    """Matches a keyword against text with whole-word and common English inflection handling."""
    kw_lower = kw.lower()
    # Normalize underscores, hyphens, and slashes to spaces to handle tokens like gst_reg, GST_Certificate
    normalized_text = re.sub(r"[_/\\.-]", " ", text).lower()
    if re.search(rf"\b{re.escape(kw_lower)}\b", normalized_text):
        return True
    # Plural / singular inflections
    if kw_lower.endswith("ies") and len(kw_lower) > 4:
        singular = kw_lower[:-3] + "y"
        if re.search(rf"\b{re.escape(singular)}\b", normalized_text):
            return True
    elif kw_lower.endswith("y") and len(kw_lower) > 3:
        plural = kw_lower[:-1] + "ies"
        if re.search(rf"\b{re.escape(plural)}\b", normalized_text):
            return True
    elif kw_lower.endswith("es") and len(kw_lower) > 4:
        singular = kw_lower[:-2]
        if re.search(rf"\b{re.escape(singular)}\b", normalized_text):
            return True
    elif kw_lower.endswith("s") and len(kw_lower) > 3 and not kw_lower.endswith("ss"):
        singular = kw_lower[:-1]
        if re.search(rf"\b{re.escape(singular)}\b", normalized_text):
            return True
    else:
        plural = kw_lower + "s"
        if re.search(rf"\b{re.escape(plural)}\b", normalized_text):
            return True
    return False


def count_keyword_matches(keywords: list[str], text: str) -> int:
    """Counts whole-word keyword occurrences within target text with inflection tolerance."""
    hits = 0
    for kw in keywords:
        if keyword_matches_text(kw, text):
            hits += 1
    return hits


# Bid and Procurement Domain Thesaurus mapping canonical concepts to synonym groups
PROCUREMENT_DOMAIN_SYNONYMS: list[list[str]] = [
    # 1. Penalties, delay, liquidated damages
    [
        "penalty",
        "penalties",
        "fine",
        "fines",
        "deduction",
        "deductions",
        "late",
        "delay",
        "delays",
        "liquidated",
        "damages",
        "ld",
        "compensation",
        "extension",
        "delaying",
        "overdue",
        "overrun",
    ],
    # 2. Turnover, financial audit, balance sheet
    [
        "turnover",
        "turnovers",
        "revenue",
        "revenues",
        "income",
        "sales",
        "balance",
        "sheet",
        "sheets",
        "maat",
        "udin",
        "ca",
        "audited",
        "audit",
        "certificate",
        "certified",
        "chartered",
    ],
    # 3. Solvency, credit, working capital, net worth
    [
        "solvency",
        "credit",
        "networth",
        "worth",
        "capital",
        "soundness",
        "facility",
        "banker",
        "borrowing",
    ],
    # 4. Experience, past projects, track record, credentials
    [
        "experience",
        "past",
        "project",
        "projects",
        "work",
        "works",
        "order",
        "orders",
        "completion",
        "track",
        "record",
        "similar",
        "executed",
        "completed",
        "client",
        "credential",
        "credentials",
    ],
    # 5. Tax, statutory, GST, registration, corporate
    [
        "gst",
        "gstin",
        "tax",
        "taxes",
        "pan",
        "cin",
        "roc",
        "udyam",
        "msme",
        "statutory",
        "registration",
        "incorporation",
        "identity",
        "incorporate",
    ],
    # 6. Stamp paper, notarization, affidavits, integrity pact
    [
        "stamp",
        "notary",
        "notariz",
        "notarized",
        "notarization",
        "affidavit",
        "affidavits",
        "integrity",
        "pact",
        "blacklisting",
        "debarment",
        "attestation",
        "undertaking",
    ],
    # 7. EMD, guarantees, deposits, bid security
    [
        "emd",
        "earnest",
        "money",
        "deposit",
        "deposits",
        "security",
        "guarantee",
        "guarantees",
        "pbg",
        "bidsecurity",
    ],
]


def get_synonyms_for_tokens(tokens: list[str]) -> set[str]:
    """Expands query tokens against procurement thesaurus synonym clusters."""
    synonyms: set[str] = set()
    for token in tokens:
        t_clean = token.lower()
        for group in PROCUREMENT_DOMAIN_SYNONYMS:
            matched = False
            for term in group:
                if len(term) <= 3 or len(t_clean) <= 3:
                    if t_clean == term:
                        matched = True
                        break
                else:
                    if t_clean == term or t_clean.startswith(term) or term.startswith(t_clean):
                        matched = True
                        break
            if matched:
                synonyms.update(group)
    return synonyms


class ChatToolRegistry:
    """
    In-memory and context-backed tool execution registry for the AI Chat Worker.
    Provides tenant-scoped, isolated data access for:
    - search_tender_documents
    - search_company_evidence
    - get_company_financials
    - calculate_financial_capacity
    - get_company_experience
    - get_compliance_matrix
    - get_bid_decision_summary
    """

    def __init__(
        self,
        context_data: dict[str, Any] | None = None,
        security_context: Any | None = None,
    ):
        self.context = context_data or {}
        self.security_context = security_context

    def _is_accessible(self, item: dict[str, Any]) -> bool:
        """Enforces tenant-scoped anti-IDOR isolation across all tools."""
        if not self.security_context or not hasattr(self.security_context, "tenant_id"):
            return True
        tenant_id = self.security_context.tenant_id
        if not tenant_id:
            return True
        item_tenant = (
            item.get("tenant_id")
            or item.get("tenantId")
            or item.get("organization_id")
            or item.get("organizationId")
        )
        if item_tenant and item_tenant != tenant_id:
            return False
        return True

    def search_tender_documents(
        self,
        query: str,
        bid_id: str | None = None,
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        """Searches tender document chunks for the bid, returning relevant clauses."""
        if is_out_of_domain(query):
            return []

        chunks = self.context.get("tender_chunks") or self.context.get("tenderChunks") or []
        if not chunks:
            return []

        keywords = extract_keywords(query)
        substantive_kws = [k for k in keywords if k not in PROCUREMENT_WRAPPER_WORDS]
        synonyms = get_synonyms_for_tokens(substantive_kws or keywords)
        scored_chunks: list[tuple[float, dict[str, Any]]] = []

        for chk in chunks:
            if not self._is_accessible(chk):
                continue
            content_lower = chk.get("content", "").lower()
            section_lower = chk.get("sectionTitle", "").lower()
            clause_lower = chk.get("clauseReference", "").lower()
            text = f"{content_lower} {section_lower} {clause_lower}"

            if substantive_kws:
                has_substantive_hit = any(
                    keyword_matches_text(kw, text) for kw in substantive_kws
                ) or any(keyword_matches_text(syn, text) for syn in synonyms)
                if not has_substantive_hit:
                    continue

            score = 0.0
            # Direct keyword hits (3.0 pts, clause +2.5, section +1.5)
            for kw in keywords:
                if keyword_matches_text(kw, text):
                    score += 3.0
                    if kw in clause_lower:
                        score += 2.5
                    if kw in section_lower:
                        score += 1.5

            # Domain synonym hits (2.0 pts, clause +2.0, section +1.5)
            for syn in synonyms:
                if syn not in keywords and keyword_matches_text(syn, text):
                    score += 2.0
                    if syn in clause_lower:
                        score += 2.0
                    if syn in section_lower:
                        score += 1.5

            if score > 0:
                scored_chunks.append((score, chk))

        scored_chunks.sort(key=lambda x: x[0], reverse=True)
        results = [item[1] for item in scored_chunks[:limit]]
        if not results and not keywords and chunks:
            accessible_chunks = [c for c in chunks if self._is_accessible(c)]
            results = accessible_chunks[:limit]
        return results

    def search_company_evidence(
        self,
        query: str,
        company_id: str | None = None,
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        """Searches company evidence vault chunks (CA certs, ISO certs, work orders, GST/statutory records)."""
        if is_out_of_domain(query):
            return []

        raw_evidence = (
            self.context.get("company_evidence") or self.context.get("companyEvidence") or []
        )
        chunks = self.context.get("company_chunks") or self.context.get("companyChunks") or []
        combined: list[dict[str, Any]] = []

        # 1. Ingest parsed text chunks from company vault
        for chk in chunks:
            chunk_copy = dict(chk)
            chunk_copy.setdefault("chunkId", chk.get("id"))
            chunk_copy.setdefault("documentId", chk.get("evidenceDocumentId"))
            chunk_copy.setdefault("documentName", chk.get("fileName") or "Company_Evidence.pdf")
            chunk_copy.setdefault("evidenceType", "EVIDENCE_CHUNK")
            combined.append(chunk_copy)

        # 2. Ingest document metadata records from evidence vault
        for ev in raw_evidence:
            ev_copy = dict(ev)
            attrs = ev.get("extractedAttributes") or ev.get("extracted_attributes") or {}
            attr_text = (
                " ".join(f"{k}: {v}" for k, v in attrs.items() if isinstance(v, (str, int, float)))
                if isinstance(attrs, dict)
                else ""
            )
            content = ev.get("content") or ""
            if not content:
                content_parts = [
                    str(ev.get("documentName") or ev.get("fileName") or ""),
                    str(ev.get("evidenceType") or ""),
                    str(ev.get("referenceNumber") or ""),
                    str(ev.get("issuer") or ""),
                    attr_text,
                ]
                content = " | ".join(p for p in content_parts if p)

            ev_copy["content"] = content
            doc_id = ev.get("documentId") or ev.get("id") or "doc_evidence"
            doc_name = ev.get("documentName") or ev.get("fileName") or "Company_Evidence.pdf"
            ev_copy.setdefault("chunkId", ev.get("id") or f"doc_{doc_id}")
            ev_copy["documentId"] = doc_id
            ev_copy["documentName"] = doc_name
            ev_copy.setdefault("evidenceType", "DOCUMENT")
            combined.append(ev_copy)

        if not combined:
            return []

        keywords = extract_keywords(query)
        substantive_kws = [k for k in keywords if k not in PROCUREMENT_WRAPPER_WORDS]
        synonyms = get_synonyms_for_tokens(substantive_kws or keywords)
        scored_evidence: list[tuple[float, dict[str, Any]]] = []

        for ev in combined:
            if not self._is_accessible(ev):
                continue
            attrs = ev.get("extractedAttributes") or ev.get("extracted_attributes") or {}
            attr_text = (
                " ".join(f"{k} {v}" for k, v in attrs.items() if isinstance(v, (str, int, float)))
                if isinstance(attrs, dict)
                else ""
            )
            content_lower = str(ev.get("content", "")).lower()
            ev_type_lower = str(ev.get("evidenceType", "")).lower()
            doc_name_lower = str(ev.get("documentName", "")).lower()
            issuer_lower = str(ev.get("issuer", "")).lower()
            ref_lower = str(ev.get("referenceNumber", "")).lower()
            text = f"{content_lower} {ev_type_lower} {doc_name_lower} {issuer_lower} {ref_lower} {attr_text.lower()}"

            if substantive_kws:
                has_substantive_hit = any(
                    keyword_matches_text(kw, text) for kw in substantive_kws
                ) or any(keyword_matches_text(syn, text) for syn in synonyms)
                if not has_substantive_hit:
                    continue

            score = 0.0
            # Direct keyword hits (3.0 pts, category +2.0, docName +1.5)
            for kw in keywords:
                if keyword_matches_text(kw, text):
                    score += 3.0
                    if kw in ev_type_lower:
                        score += 2.0
                    if kw in doc_name_lower:
                        score += 1.5

            # Domain synonym hits (2.0 pts, category +1.5, docName +1.0)
            for syn in synonyms:
                if syn not in keywords and keyword_matches_text(syn, text):
                    score += 2.0
                    if syn in ev_type_lower:
                        score += 1.5
                    if syn in doc_name_lower:
                        score += 1.0

            if score > 0:
                scored_evidence.append((score, ev))

        scored_evidence.sort(key=lambda x: x[0], reverse=True)
        results = [item[1] for item in scored_evidence[:limit]]
        if not results and not keywords and combined:
            accessible = [e for e in combined if self._is_accessible(e)]
            results = accessible[:limit]
        return results

    def get_company_profile(self, company_id: str | None = None) -> dict[str, Any]:
        """Retrieves structured company statutory data, identifiers, and registrations."""
        profile = self.context.get("company_profile") or self.context.get("companyProfile") or {}
        if not self._is_accessible(profile):
            from tenderpulse_ai.security.exceptions import UnauthorizedDocumentAccessException

            raise UnauthorizedDocumentAccessException(
                "Access denied: Company profile belongs to another tenant."
            )

        legal_name = (
            profile.get("legalName")
            or profile.get("legal_name")
            or profile.get("companyName")
            or profile.get("name")
            or ""
        )
        gstin = profile.get("gstin") or ""
        pan = profile.get("pan") or ""
        cin = profile.get("cin") or ""
        udyam_id = profile.get("udyamId") or profile.get("udyam_id") or ""
        constitution = profile.get("constitution") or ""
        gstin_verified_at = profile.get("gstinVerifiedAt") or profile.get("gstin_verified_at")

        return {
            "companyId": company_id or profile.get("id") or profile.get("companyId", ""),
            "legalName": legal_name,
            "companyName": legal_name,
            "gstin": gstin,
            "pan": pan,
            "cin": cin,
            "udyamId": udyam_id,
            "constitution": constitution,
            "gstinVerifiedAt": gstin_verified_at,
        }

    def get_company_financials(self, company_id: str | None = None) -> dict[str, Any]:
        """Retrieves financial turnover records, average turnover, UDIN, and net worth."""
        profile = self.context.get("company_profile") or self.context.get("companyProfile") or {}
        if not self._is_accessible(profile):
            from tenderpulse_ai.security.exceptions import UnauthorizedDocumentAccessException

            raise UnauthorizedDocumentAccessException(
                "Access denied: Company profile belongs to another tenant."
            )

        turnover_records = profile.get("turnoverRecords") or profile.get("turnover_records") or []
        solvency = profile.get("solvencyInrCrores")
        net_worth = profile.get("netWorthInrCrores")
        audited_udin = profile.get("auditedUdin") or profile.get("caUdin") or profile.get("udin")
        statutory_pan = profile.get("pan")
        statutory_gstin = profile.get("gstin")
        company_name = profile.get("legalName") or profile.get("companyName", "")

        values = [
            float(r.get("turnoverInrCrores", 0))
            for r in turnover_records
            if r.get("turnoverInrCrores") is not None
        ]
        avg_turnover = round(sum(values) / len(values), 2) if values else None

        return {
            "companyId": company_id or profile.get("companyId", ""),
            "companyName": company_name,
            "turnoverRecords": turnover_records,
            "averageTurnoverInrCrores": avg_turnover,
            "netWorthInrCrores": net_worth,
            "solvencyInrCrores": solvency,
            "auditedUdin": audited_udin,
            "statutoryPan": statutory_pan,
            "gstin": statutory_gstin,
        }

    def calculate_financial_capacity(
        self,
        company_id: str | None = None,
        turnover_average_inr_crores: float | None = None,
        required_turnover_inr_crores: float | None = None,
        solvency_amount_inr_crores: float | None = None,
        required_solvency_inr_crores: float | None = None,
        net_worth_inr_crores: float | None = None,
        required_net_worth_inr_crores: float | None = None,
        existing_commitments_b_inr_crores: float = 0.0,
        completion_years_n: float = 2.0,
        capacity_multiplier: float = 2.0,
        completion_date: str | None = None,
        max_completion_date: str | None = None,
    ) -> dict[str, Any]:
        """
        Deterministic procurement arithmetic engine:
        - Evaluates MAAT against tender threshold
        - Evaluates Solvency Certificate against required solvency
        - Evaluates Net Worth against mandatory threshold
        - Computes Assessed Available Bid Capacity: (A * N * Multiplier) - B (NHAI/MoRTH Standard)
        - Evaluates project completion date against maximum permissible completion date
        """
        fin = self.get_company_financials(company_id)

        # 1. Turnover Average & Qualification
        if turnover_average_inr_crores is not None:
            avg_turnover = float(
                parse_financial_amount_crores(turnover_average_inr_crores, 0.0) or 0.0
            )
        else:
            fin_avg = fin.get("averageTurnoverInrCrores")
            avg_turnover = float(parse_financial_amount_crores(fin_avg, 0.0) or 0.0)

        if required_turnover_inr_crores is not None:
            parsed_req_turnover = parse_financial_amount_crores(required_turnover_inr_crores)
            req_turnover = float(parsed_req_turnover) if parsed_req_turnover is not None else None
            turnover_qualified = (
                (avg_turnover >= req_turnover) if req_turnover is not None else True
            )
            turnover_margin = (
                round(avg_turnover - req_turnover, 2) if req_turnover is not None else None
            )
            turnover_verdict = "PASS" if turnover_qualified else "FAIL"
        else:
            req_turnover = None
            turnover_qualified = True
            turnover_margin = None
            turnover_verdict = "NOT_EVALUATED"

        # 2. Solvency & Qualification
        if solvency_amount_inr_crores is not None:
            solvency = float(parse_financial_amount_crores(solvency_amount_inr_crores, 0.0) or 0.0)
        else:
            fin_solv = (
                self.context.get("solvency_amount_inr_crores")
                or self.context.get("solvencyAmountInrCrores")
                or fin.get("solvencyInrCrores")
            )
            solvency = float(parse_financial_amount_crores(fin_solv, 0.0) or 0.0)

        if required_solvency_inr_crores is not None:
            parsed_req_solvency = parse_financial_amount_crores(required_solvency_inr_crores)
            req_solvency = float(parsed_req_solvency) if parsed_req_solvency is not None else None
            solvency_qualified = (solvency >= req_solvency) if req_solvency is not None else True
            solvency_margin = (
                round(solvency - req_solvency, 2)
                if (solvency is not None and req_solvency is not None)
                else None
            )
            solvency_verdict = "PASS" if solvency_qualified else "FAIL"
        else:
            req_solvency = None
            solvency_qualified = True
            solvency_margin = None
            solvency_verdict = "NOT_EVALUATED"

        # 3. Net Worth & Qualification
        if net_worth_inr_crores is not None:
            net_worth = float(parse_financial_amount_crores(net_worth_inr_crores, 0.0) or 0.0)
        else:
            fin_nw = fin.get("netWorthInrCrores")
            net_worth = float(parse_financial_amount_crores(fin_nw, 0.0) or 0.0)

        if required_net_worth_inr_crores is not None:
            parsed_req_nw = parse_financial_amount_crores(required_net_worth_inr_crores)
            req_nw = float(parsed_req_nw) if parsed_req_nw is not None else None
            net_worth_qualified = (net_worth >= req_nw) if req_nw is not None else True
            net_worth_margin = (
                round(net_worth - req_nw, 2)
                if (net_worth is not None and req_nw is not None)
                else None
            )
            net_worth_verdict = "PASS" if net_worth_qualified else "FAIL"
        else:
            req_nw = None
            net_worth_qualified = True
            net_worth_margin = None
            net_worth_verdict = "NOT_EVALUATED"

        # 4. Assessed Available Bid Capacity: (A * N * Multiplier) - B
        commitments_b = float(
            parse_financial_amount_crores(existing_commitments_b_inr_crores, 0.0) or 0.0
        )
        years_n = float(completion_years_n)
        mult = float(capacity_multiplier)
        assessed_bid_capacity = round((avg_turnover * years_n * mult) - commitments_b, 2)
        bid_capacity_qualified = assessed_bid_capacity >= 0.0
        bid_capacity_verdict = "PASS" if bid_capacity_qualified else "FAIL"

        # 5. Completion Date Validation
        comp_date_obj = parse_date_safe(completion_date)
        max_date_obj = parse_date_safe(max_completion_date)

        if completion_date and max_completion_date:
            if comp_date_obj and max_date_obj:
                completion_date_qualified = comp_date_obj <= max_date_obj
                completion_date_verdict = "PASS" if completion_date_qualified else "FAIL"
            else:
                completion_date_qualified = False
                completion_date_verdict = "INVALID_DATE_FORMAT"
        else:
            completion_date_qualified = True
            completion_date_verdict = "NOT_EVALUATED"

        # 6. Overall Verdict
        is_overall_qualified = (
            turnover_qualified
            and solvency_qualified
            and net_worth_qualified
            and bid_capacity_qualified
            and completion_date_qualified
        )
        overall_verdict = "QUALIFIED" if is_overall_qualified else "DISQUALIFIED"

        return {
            "companyId": company_id or fin.get("companyId", ""),
            "turnoverAverageInrCrores": round(avg_turnover, 2),
            "requiredTurnoverInrCrores": req_turnover,
            "turnoverMarginInrCrores": turnover_margin,
            "turnoverVerdict": turnover_verdict,
            "solvencyAmountInrCrores": round(solvency, 2),
            "requiredSolvencyInrCrores": req_solvency,
            "solvencyMarginInrCrores": solvency_margin,
            "solvencyVerdict": solvency_verdict,
            "netWorthInrCrores": round(net_worth, 2),
            "requiredNetWorthInrCrores": req_nw,
            "netWorthMarginInrCrores": net_worth_margin,
            "netWorthVerdict": net_worth_verdict,
            "assessedBidCapacityInrCrores": assessed_bid_capacity,
            "bidCapacityFormula": f"({round(avg_turnover, 2)} * {years_n} * {mult}) - {commitments_b}",
            "bidCapacityVerdict": bid_capacity_verdict,
            "completionDate": completion_date,
            "maxCompletionDate": max_completion_date,
            "completionDateVerdict": completion_date_verdict,
            "overallQualified": is_overall_qualified,
            "overallVerdict": overall_verdict,
        }

    def get_company_experience(
        self,
        company_id: str | None = None,
        query: str | None = None,
    ) -> list[dict[str, Any]]:
        """Retrieves past project credentials, completed values, and scope details."""
        profile = self.context.get("company_profile") or self.context.get("companyProfile") or {}
        if not self._is_accessible(profile):
            from tenderpulse_ai.security.exceptions import UnauthorizedDocumentAccessException

            raise UnauthorizedDocumentAccessException(
                "Access denied: Company profile belongs to another tenant."
            )

        experience = profile.get("experience") or []
        return [e for e in experience if self._is_accessible(e)]

    def get_compliance_matrix(
        self,
        bid_id: str | None = None,
        category: str | None = None,
    ) -> list[dict[str, Any]]:
        """Retrieves compliance matrix items, execution rules, and statuses."""
        items = self.context.get("compliance_items") or self.context.get("complianceItems") or []

        accessible_items = [i for i in items if self._is_accessible(i)]
        if category:
            accessible_items = [
                i for i in accessible_items if i.get("category", "").upper() == category.upper()
            ]
        return accessible_items

    def get_bid_decision_summary(
        self,
        bid_id: str | None = None,
        company_id: str | None = None,
    ) -> dict[str, Any]:
        """Retrieves bid decision verdict, score, disqualifiers, risks, and gaps."""
        decision = self.context.get("bid_decision") or self.context.get("bidDecision") or {}
        if decision and not self._is_accessible(decision):
            from tenderpulse_ai.security.exceptions import UnauthorizedDocumentAccessException

            raise UnauthorizedDocumentAccessException(
                "Access denied: Decision belongs to another tenant."
            )
        return decision
