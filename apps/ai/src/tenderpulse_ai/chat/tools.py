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
}


PROCUREMENT_WRAPPER_WORDS = {
    "tender",
    "document",
    "documents",
    "bid",
    "bids",
    "bidding",
    "clause",
    "section",
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
}


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
        chunks = self.context.get("tender_chunks") or self.context.get("tenderChunks") or []
        if not chunks:
            # Baseline tender data if not passed in context
            chunks = [
                {
                    "chunkId": "chk_emd_01",
                    "documentId": "doc_nit_01",
                    "documentName": "NIT_Document.pdf",
                    "pageNumber": 3,
                    "clauseReference": "Clause 4.1",
                    "sectionTitle": "Earnest Money Deposit (EMD)",
                    "content": "The bidder must furnish an Earnest Money Deposit (EMD) of INR 5,00,000 on a 100 Rupee stamp paper prior to tender submission.",
                },
                {
                    "chunkId": "chk_tech_01",
                    "documentId": "doc_nit_01",
                    "documentName": "NIT_Document.pdf",
                    "pageNumber": 7,
                    "clauseReference": "Clause 8.2",
                    "sectionTitle": "Technical Capability & Minimum Average Annual Turnover",
                    "content": "The bidder must have achieved a Minimum Average Annual Turnover (MAAT) of at least INR 25.00 Crores across the last 3 financial years (FY 2021-22, 2022-23, 2023-24). Audited turnover certificate with valid UDIN is mandatory.",
                },
                {
                    "chunkId": "chk_exp_01",
                    "documentId": "doc_nit_01",
                    "documentName": "NIT_Document.pdf",
                    "pageNumber": 9,
                    "clauseReference": "Clause 10.4",
                    "sectionTitle": "Similar Work Experience",
                    "content": "The bidder must have successfully completed at least 1 similar infrastructure project valued at INR 20.00 Crores or 2 projects valued at INR 12.50 Crores each for central or state government undertakings within the last 5 years.",
                },
                {
                    "chunkId": "chk_legal_01",
                    "documentId": "doc_nit_01",
                    "documentName": "NIT_Document.pdf",
                    "pageNumber": 12,
                    "clauseReference": "Clause 14.1",
                    "sectionTitle": "Liquidated Damages & Execution Penalties",
                    "content": "Liquidated damages for project completion delay shall be levied at 0.5% per week of delay, capped at 10% of total contract value. Non-performance may lead to forfeiture of Performance Bank Guarantee.",
                },
            ]

        keywords = extract_keywords(query)
        substantive_kws = [k for k in keywords if k not in PROCUREMENT_WRAPPER_WORDS]
        scored_chunks: list[tuple[float, dict[str, Any]]] = []

        for chk in chunks:
            if not self._is_accessible(chk):
                continue
            text = (
                chk.get("content", "")
                + " "
                + chk.get("sectionTitle", "")
                + " "
                + chk.get("clauseReference", "")
            ).lower()

            # Anti-hallucination guard: If substantive keywords exist, verify substantive density
            if substantive_kws:
                substantive_hits = count_keyword_matches(substantive_kws, text)
                min_required = 2 if len(substantive_kws) >= 3 else 1
                if substantive_hits < min_required:
                    continue

            score = 0.0
            for kw in keywords:
                if keyword_matches_text(kw, text):
                    score += 1.0
                    # Boost exact clause or section matches
                    if kw in chk.get("clauseReference", "").lower():
                        score += 2.0
                    if kw in chk.get("sectionTitle", "").lower():
                        score += 1.5

            if score > 0 or not keywords:
                scored_chunks.append((score, chk))

        scored_chunks.sort(key=lambda x: x[0], reverse=True)
        results = [item[1] for item in scored_chunks[:limit]]
        # Anti-hallucination guard: If keywords were queried and NONE matched, do NOT fall back to returning arbitrary chunks!
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
            ev_copy.setdefault("chunkId", ev.get("id") or f"doc_{ev.get('documentId')}")
            ev_copy.setdefault("documentId", ev.get("id"))
            ev_copy.setdefault("documentName", ev.get("fileName") or "Company_Evidence.pdf")
            ev_copy.setdefault("evidenceType", "DOCUMENT")
            combined.append(ev_copy)

        if not combined:
            combined = [
                {
                    "chunkId": "ev_chk_gst_01",
                    "documentId": "doc_gst_cert_01",
                    "documentName": "GST_Registration_Certificate.pdf",
                    "pageNumber": 1,
                    "evidenceType": "GST_REGISTRATION",
                    "content": "Government of India - Goods and Services Tax Certificate of Registration. GSTIN: 27AAACA1234F1Z9. Legal Name: Ashoka Buildcon Limited. Constitution of Business: Public Limited Company. Date of liability: 01/07/2017. Period of Validity: Regular.",
                    "gstin": "27AAACA1234F1Z9",
                    "pan": "AAACA1234F",
                },
                {
                    "chunkId": "ev_chk_turnover_01",
                    "documentId": "doc_ca_cert_01",
                    "documentName": "CA_Turnover_Certificate_FY21_24.pdf",
                    "pageNumber": 1,
                    "evidenceType": "FINANCIAL_STATEMENT",
                    "content": "This is to certify that M/s ABC Infra achieved audited turnover of INR 32.5 Cr (FY 2021-22), INR 38.0 Cr (FY 2022-23), and INR 42.5 Cr (FY 2023-24). Average Annual Turnover: INR 37.67 Crores. UDIN: 24089123AAAAAA9999.",
                    "udin": "24089123AAAAAA9999",
                },
                {
                    "chunkId": "ev_chk_work_order_01",
                    "documentId": "doc_wo_nhai_01",
                    "documentName": "NHAI_Completion_Certificate_Pkg4.pdf",
                    "pageNumber": 2,
                    "evidenceType": "PROJECT_CREDENTIAL",
                    "content": "Project Completion Certificate: Successfully executed Highway Widening Project Package-4 for NHAI. Total completed value: INR 28.50 Crores. Completion Date: 15-Jan-2024. Performance rating: Satisfactory.",
                },
                {
                    "chunkId": "ev_chk_iso_01",
                    "documentId": "doc_iso_9001_01",
                    "documentName": "ISO_9001_2015_Certificate.pdf",
                    "pageNumber": 1,
                    "evidenceType": "CERTIFICATION",
                    "content": "ISO 9001:2015 Quality Management System Certification. Certificate No: QMS-IND-2023-8821. Valid until: 30-Nov-2026. Registrar: TUV India.",
                },
            ]

        keywords = extract_keywords(query)
        substantive_kws = [k for k in keywords if k not in PROCUREMENT_WRAPPER_WORDS]
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
            text = (
                f"{ev.get('content', '')} {ev.get('evidenceType', '')} {ev.get('documentName', '')} "
                f"{ev.get('issuer', '')} {ev.get('referenceNumber', '')} {attr_text}"
            ).lower()

            # Anti-hallucination guard: If substantive keywords exist, verify substantive density
            if substantive_kws:
                substantive_hits = count_keyword_matches(substantive_kws, text)
                min_required = 2 if len(substantive_kws) >= 3 else 1
                if substantive_hits < min_required:
                    continue

            score = 0.0
            for kw in keywords:
                if keyword_matches_text(kw, text):
                    score += 1.0
                    # Boost exact category or document name matches
                    if kw in ev.get("evidenceType", "").lower():
                        score += 2.0
                    if kw in ev.get("documentName", "").lower():
                        score += 1.5

            if score > 0 or not keywords:
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
            or "Ashoka Buildcon Limited"
        )
        gstin = profile.get("gstin") or "27AAACA1234F1Z9"
        pan = profile.get("pan") or "AAACA1234F"
        cin = profile.get("cin") or "L45200MH1993PLC071970"
        udyam_id = profile.get("udyamId") or profile.get("udyam_id") or "UDYAM-MH-12-0049281"
        constitution = profile.get("constitution") or "Public Limited Company"
        gstin_verified_at = profile.get("gstinVerifiedAt") or profile.get("gstin_verified_at")

        return {
            "companyId": company_id or profile.get("id") or profile.get("companyId", "comp-active"),
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

        turnover_records = (
            profile.get("turnoverRecords")
            or profile.get("turnover_records")
            or [
                {"financialYear": "2023-24", "turnoverInrCrores": 42.5},
                {"financialYear": "2022-23", "turnoverInrCrores": 38.0},
                {"financialYear": "2021-22", "turnoverInrCrores": 32.5},
            ]
        )
        values = [float(r.get("turnoverInrCrores", 0)) for r in turnover_records]
        avg_turnover = round(sum(values) / len(values), 2) if values else 37.67

        return {
            "companyId": company_id or profile.get("companyId", "comp-active"),
            "companyName": profile.get("companyName", "ABC Infra Projects Ltd"),
            "turnoverRecords": turnover_records,
            "averageTurnoverInrCrores": avg_turnover,
            "netWorthInrCrores": profile.get("netWorthInrCrores", 18.2),
            "solvencyInrCrores": profile.get("solvencyInrCrores", 15.0),
            "auditedUdin": "24089123AAAAAA9999",
            "statutoryPan": "AAACA1234F",
            "gstin": "27AAACA1234F1Z5",
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
            avg_turnover = float(
                parse_financial_amount_crores(fin.get("averageTurnoverInrCrores"), 37.67) or 37.67
            )

        if required_turnover_inr_crores is not None:
            parsed_req_turnover = parse_financial_amount_crores(required_turnover_inr_crores)
            req_turnover = float(parsed_req_turnover) if parsed_req_turnover is not None else None
            turnover_qualified = avg_turnover >= req_turnover if req_turnover is not None else True
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
            solvency = float(
                parse_financial_amount_crores(
                    self.context.get("solvency_amount_inr_crores")
                    or self.context.get("solvencyAmountInrCrores")
                    or fin.get("solvencyInrCrores"),
                    0.0,
                )
                or 0.0
            )

        if required_solvency_inr_crores is not None:
            parsed_req_solvency = parse_financial_amount_crores(required_solvency_inr_crores)
            req_solvency = float(parsed_req_solvency) if parsed_req_solvency is not None else None
            solvency_qualified = solvency >= req_solvency if req_solvency is not None else True
            solvency_margin = (
                round(solvency - req_solvency, 2) if req_solvency is not None else None
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
            net_worth = float(
                parse_financial_amount_crores(fin.get("netWorthInrCrores"), 18.2) or 18.2
            )

        if required_net_worth_inr_crores is not None:
            parsed_req_nw = parse_financial_amount_crores(required_net_worth_inr_crores)
            req_nw = float(parsed_req_nw) if parsed_req_nw is not None else None
            net_worth_qualified = net_worth >= req_nw if req_nw is not None else True
            net_worth_margin = round(net_worth - req_nw, 2) if req_nw is not None else None
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
            "companyId": company_id or fin.get("companyId", "comp-active"),
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

        experience = profile.get("experience") or [
            {
                "projectName": "NHAI Highway Widening Package-4",
                "client": "National Highways Authority of India (NHAI)",
                "completedValueInrCrores": 28.5,
                "completionDate": "2024-01-15",
                "scope": "Civil construction, bituminous overlay, and culvert structures",
            },
            {
                "projectName": "State PWD Flyover Bridge Construction",
                "client": "Maharashtra PWD",
                "completedValueInrCrores": 15.2,
                "completionDate": "2022-09-30",
                "scope": "Prestressed concrete girder flyover bridge",
            },
        ]
        return [e for e in experience if self._is_accessible(e)]

    def get_compliance_matrix(
        self,
        bid_id: str | None = None,
        category: str | None = None,
    ) -> list[dict[str, Any]]:
        """Retrieves compliance matrix items, execution rules, and statuses."""
        items = (
            self.context.get("compliance_items")
            or self.context.get("complianceItems")
            or [
                {
                    "id": "cmp_01",
                    "category": "TECHNICAL",
                    "title": "Minimum Average Annual Turnover (MAAT)",
                    "description": "Requires INR 25.00 Cr turnover across last 3 years.",
                    "status": "PASS",
                    "executionRules": {"udinRequired": True, "notarizationRequired": False},
                    "clauseReference": "Clause 8.2",
                },
                {
                    "id": "cmp_02",
                    "category": "COMMERCIAL",
                    "title": "Earnest Money Deposit (EMD)",
                    "description": "EMD of INR 5,00,000 on 100 Rupee stamp paper.",
                    "status": "FLAGGED",
                    "executionRules": {
                        "stampPaperRequired": True,
                        "stampPaperDenominationInr": 100,
                    },
                    "clauseReference": "Clause 4.1",
                },
                {
                    "id": "cmp_03",
                    "category": "EXECUTION",
                    "title": "Integrity Pact & Non-Blacklisting Affidavit",
                    "description": "Notarized affidavit on INR 500 stamp paper signed by Director.",
                    "status": "FLAGGED",
                    "executionRules": {
                        "stampPaperRequired": True,
                        "stampPaperDenominationInr": 500,
                        "notarizationRequired": True,
                    },
                    "clauseReference": "Clause 12.3",
                },
            ]
        )

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
        decision = (
            self.context.get("bid_decision")
            or self.context.get("bidDecision")
            or {
                "verdict": "GO",
                "readinessScore": 0.88,
                "reasonsToPursue": [
                    "Company average turnover (INR 37.67 Cr) exceeds tender requirement of INR 25.00 Cr.",
                    "Completed NHAI project (INR 28.50 Cr) qualifies similar work threshold.",
                ],
                "reasonsNotToPursue": [],
                "hardDisqualifiers": [],
                "commercialRisks": [
                    {
                        "title": "Liquidated Damages Cap",
                        "severity": "MEDIUM",
                        "detail": "10% LD cap with 0.5%/week delay penalties.",
                    }
                ],
                "missingInformation": [
                    {
                        "requirementTitle": "Integrity Pact Notarization",
                        "missingFactor": "Stamp paper affidavit pending signature",
                    }
                ],
            }
        )
        if not self._is_accessible(decision):
            from tenderpulse_ai.security.exceptions import UnauthorizedDocumentAccessException

            raise UnauthorizedDocumentAccessException(
                "Access denied: Decision belongs to another tenant."
            )
        return decision
