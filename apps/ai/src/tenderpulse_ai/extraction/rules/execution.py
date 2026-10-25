from __future__ import annotations

import re

from tenderpulse_ai.domain.models import (
    CandidateComplianceItem,
    ExecutionRulesProps,
    ProvenanceProps,
)
from tenderpulse_ai.extraction.metrics import extract_temporal_durations
from tenderpulse_ai.extraction.rules.base import (
    disambiguate_stamp_paper,
    get_clause_and_quote,
)

JV_PROHIBITION_PATTERN = re.compile(
    r"\b(?:"
    r"bids\s+(?:from|by)\s+(?:joint\s+ventures?|jv)(?:[/\s]+(?:and|or)?\s*consortiums?)?\s+(?:are|is)\s+not\s+(?:allowed|permitted|eligible|acceptable)"
    r"|(?:joint\s+ventures?|jv)(?:\s*(?:/|\bor\b|\band\b)\s*consortiums?)?\s+(?:are|is)?\s*(?:not\s+(?:allowed|permitted|eligible|acceptable)(?:\s+to\s+bid)?|(?:strictly\s+)?(?:prohibited|barred)|ineligible)"
    r"|(?:consortiums?)(?:\s*(?:/|\bor\b|\band\b)\s*(?:joint\s+ventures?|jv))?\s+(?:are|is)?\s*(?:not\s+(?:allowed|permitted|eligible|acceptable)(?:\s+to\s+bid)?|(?:strictly\s+)?(?:prohibited|barred)|ineligible)"
    r"|neither\s+(?:joint\s+ventures?|jv)\s+nor\s+consortiums?(?:\s+(?:is|are)?\s*(?:allowed|permitted|eligible))?"
    r"|no\s+(?:joint\s+ventures?|jv)(?:\s*(?:/|\bor\b|\band\b)\s*consortiums?)?(?:\s+(?:is|are)?\s*(?:allowed|permitted))?"
    r")\b",
    re.IGNORECASE,
)


def extract_execution_rules(
    doc_id: str,
    page_no: int,
    text: str,
    text_lower: str,
    clause_ref: str,
) -> list[CandidateComplianceItem]:
    candidates: list[CandidateComplianceItem] = []

    # 1. Execution: Concessionaire Equity Lock-in & Minimum Consortium Shareholding
    if any(k in text_lower for k in ("change in ownership", "shall directly hold equity")) and any(
        k in text_lower for k in ("consortium member", "paid up equity", "joint bidding agreement")
    ):
        res = get_clause_and_quote(
            r"(?:change in ownership|shall directly hold equity|minimum of 26%|74% \(seventy-four percent\))",
            "equity",
            [
                "change in ownership",
                "shall directly hold equity",
                "joint bidding agreement",
                "paid up equity",
                "74%",
            ],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            candidates.append(
                CandidateComplianceItem(
                    category="EXECUTION",
                    title="Concessionaire Equity Lock-in & Minimum Consortium Shareholding (Article 7)",
                    description="Direct holding of not less than 74% issued/paid-up equity by selected bidder/consortium members, and minimum 26% (and >=5% TPC) by evaluated consortium members until 1 year post Punch List completion.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        signing_authority_rank="Board of Directors Resolution & Statutory Auditor Shareholding Certificate",
                    ),
                    provenance=ProvenanceProps(
                        source_document_id=doc_id,
                        source_file_name="tender_document.pdf",
                        page_number=page_no,
                        clause_reference=ref,
                        verbatim_quote=quote,
                        confidence_score=conf,
                    ),
                )
            )

    # 2. Execution: Power of Attorney & Authorized Signatory Authority
    if any(
        k in text_lower
        for k in (
            "power of attorney",
            "poa for lead member",
            "written confirmation of authorization",
        )
    ):
        res = get_clause_and_quote(
            r"(?:power of attorney|written confirmation of authorization)",
            "power of attorney",
            [
                "power of attorney",
                "poa for lead member",
                "written confirmation of authorization",
            ],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            stamp_req, stamp_denom = disambiguate_stamp_paper(text)
            candidates.append(
                CandidateComplianceItem(
                    category="EXECUTION",
                    title="Power of Attorney & Consortium Execution Rules",
                    description="Power of Attorney for Lead Member / Authorized Signatory with Board Resolution.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=stamp_req if stamp_req else True,
                        stamp_paper_denomination_inr=stamp_denom if stamp_denom else 100,
                        notarization_required=True,
                        signing_authority_rank="Board of Directors Resolution / Authorized Signatory",
                    ),
                    provenance=ProvenanceProps(
                        source_document_id=doc_id,
                        source_file_name="tender_document.pdf",
                        page_number=page_no,
                        clause_reference=ref,
                        verbatim_quote=quote,
                        confidence_score=conf,
                    ),
                )
            )

    # 3. Execution: Joint Venture / Consortium Agreement
    is_jv_prohibited = bool(JV_PROHIBITION_PATTERN.search(text_lower))
    if not is_jv_prohibited and any(
        k in text_lower for k in ("joint venture", "jv agreement", "consortium", "jv must meet")
    ):
        res = get_clause_and_quote(
            r"(?:joint venture|jv agreement|consortium)",
            "joint venture",
            ["joint venture", "jv agreement", "consortium", "jv must meet"],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            if not JV_PROHIBITION_PATTERN.search(quote.lower()):
                stamp_req, stamp_denom = disambiguate_stamp_paper(text)
                candidates.append(
                    CandidateComplianceItem(
                        category="EXECUTION",
                        title="Joint Venture & Consortium Agreement Requirements",
                        description="Joint Venture agreement / Consortium MOU defining lead member equity and joint-and-several liability.",
                        execution_rules=ExecutionRulesProps(
                            stamp_paper_required=stamp_req if stamp_req else True,
                            stamp_paper_denomination_inr=stamp_denom if stamp_denom else 100,
                            notarization_required=True,
                            signing_authority_rank="All JV / Consortium Partner Authorized Signatories",
                        ),
                        provenance=ProvenanceProps(
                            source_document_id=doc_id,
                            source_file_name="tender_document.pdf",
                            page_number=page_no,
                            clause_reference=ref,
                            verbatim_quote=quote,
                            confidence_score=conf,
                        ),
                    )
                )

    # 4. Execution: Conditions Precedent Concessionaire Satisfaction (Article 4.1.3)
    if "conditions precedent" in text_lower and any(
        k in text_lower for k in ("4.1.3", "180 (one hundred and eighty) days", "180 days")
    ):
        res = get_clause_and_quote(
            r"conditions precedent required to be satisfied by the concessionaire",
            "conditions precedent",
            ["conditions precedent required to be satisfied", "conditions precedent", "4.1.3"],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            candidates.append(
                CandidateComplianceItem(
                    category="EXECUTION",
                    title="Conditions Precedent Satisfaction (Concessionaire 180-Day CPs)",
                    description="Concessionaire must fulfill 8 mandatory Conditions Precedent within 180 days: Performance Security, Escrow Agreement, Substitution Agreement, Schedule-E Permits, Financing Agreements, Financial Model in Excel, Consortium confirmation, and Legal Opinion.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=True,
                        stamp_paper_denomination_inr=100,
                        notarization_required=True,
                        signing_authority_rank="Authorized Signatory / Board Resolution",
                    ),
                    provenance=ProvenanceProps(
                        source_document_id=doc_id,
                        source_file_name="tender_document.pdf",
                        page_number=page_no,
                        clause_reference=ref,
                        verbatim_quote=quote,
                        confidence_score=conf,
                    ),
                )
            )

    # 5. Execution: Authority Conditions Precedent & Right of Way Handover
    if "conditions precedent" in text_lower and any(
        k in text_lower
        for k in (
            "require the authority",
            "obligation of the authority",
            "right of way",
            "environmental clearance",
            "forest clearance",
            "satisfy the following conditions",
        )
    ):
        res = get_clause_and_quote(
            r"conditions precedent set forth in this clause|conditions precedent.*?authority|right of way",
            "conditions precedent",
            [
                "conditions precedent",
                "require the authority",
                "right of way",
                "environmental clearance",
            ],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            durations = extract_temporal_durations(quote)
            timeline_desc = (
                f"within {durations[0]['value']} {durations[0]['unit']}"
                if durations
                else "within stipulated timeline"
            )
            candidates.append(
                CandidateComplianceItem(
                    category="EXECUTION",
                    title="Authority Conditions Precedent & Right of Way Handover",
                    description=f"Authority must satisfy Conditions Precedent {timeline_desc}: procure Right of Way, statutory approvals, environmental permits, forest clearance, and appoint the Independent Engineer.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        signing_authority_rank="Authority Representative",
                    ),
                    provenance=ProvenanceProps(
                        source_document_id=doc_id,
                        source_file_name="tender_document.pdf",
                        page_number=page_no,
                        clause_reference=ref,
                        verbatim_quote=quote,
                        confidence_score=conf,
                    ),
                )
            )

    # 6. Execution: Scheduled Project Completion Date / COD
    is_cod_clause = any(
        k in text_lower
        for k in (
            "scheduled date for completion",
            "scheduled completion date",
            "commercial operation date",
            "scheduled cod",
        )
    ) or (
        ("appointed date" in text_lower or "effective date" in text_lower)
        and any(
            k in text_lower
            for k in ("shall be the scheduled date", "scheduled date for completion")
        )
    )
    if is_cod_clause:
        res = get_clause_and_quote(
            r"(?:scheduled date for completion|commercial operation date|\bcod\b|scheduled.*?date.*?completion)",
            "scheduled date for completion",
            [
                "scheduled date for completion",
                "scheduled completion date",
                "commercial operation date",
                "cod",
                "scheduled date",
            ],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            durations = extract_temporal_durations(quote)
            duration_label = f"{durations[0]['value']}-Day COD" if durations else "COD"
            day_target = durations[0]["source"] if durations else "stipulated timeline"

            named_scheduled = re.search(
                r"[“\"\']\s*Scheduled\s+([A-Za-z0-9\-]+)\s+Date\s*[”\"\']", quote, re.IGNORECASE
            )
            if named_scheduled:
                clean_scope = named_scheduled.group(1).strip()
            else:
                scope_m = re.search(
                    r"completion of\s+(?:the\s+|this\s+)?([A-Za-z0-9\-]+(?:-[A-Za-z0-9]+)?)",
                    quote,
                    re.IGNORECASE,
                )
                clean_scope = scope_m.group(1).strip() if scope_m else "Project"

            candidates.append(
                CandidateComplianceItem(
                    category="EXECUTION",
                    title="Scheduled Project Completion Date (COD)",
                    description=f"Mandatory completion of {clean_scope} on or before the {day_target} ({duration_label}) from the Appointed Date.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        signing_authority_rank="Authorized Signatory / Project Director",
                    ),
                    provenance=ProvenanceProps(
                        source_document_id=doc_id,
                        source_file_name="tender_document.pdf",
                        page_number=page_no,
                        clause_reference=ref,
                        verbatim_quote=quote,
                        confidence_score=conf,
                    ),
                )
            )

    # 7. Execution: Round-the-Clock Emergency Rescue Post & Mobile Heavy Cranes
    if (
        "vehicle rescue post" in text_lower
        or ("rescue post" in text_lower and "mobile crane" in text_lower)
        or (
            "mobile crane" in text_lower
            and any(k in text_lower for k in ("capacity", "gross vehicle weight", "debris"))
        )
    ):
        res = get_clause_and_quote(
            r"round-the-clock vehicle rescue post.*?mobile crane|rescue post.*?mobile crane",
            "mobile crane",
            ["round-the-clock vehicle rescue post", "rescue post", "mobile crane"],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            candidates.append(
                CandidateComplianceItem(
                    category="EXECUTION",
                    title="Round-the-Clock Emergency Rescue Post & Mobile Heavy Cranes",
                    description="Round-the-clock vehicle rescue post with dedicated mobile cranes for immediate vehicle and debris clearance.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        signing_authority_rank="O&M Contractor / Safety Officer",
                    ),
                    provenance=ProvenanceProps(
                        source_document_id=doc_id,
                        source_file_name="tender_document.pdf",
                        page_number=page_no,
                        clause_reference=ref,
                        verbatim_quote=quote,
                        confidence_score=conf,
                    ),
                )
            )

    # 8. Execution: Mandatory Electronic Proposal Submission via E-Portal
    if any(
        k in text_lower
        for k in (
            "submitted only in electronic form",
            "uploaded on the e-portal",
            "electronic form (to be uploaded",
            "no physical document shall be accepted",
        )
    ):
        res = get_clause_and_quote(
            r"(?:submitted only in electronic form|no physical document shall be accepted)",
            "electronic submission",
            [
                "submitted only in electronic form",
                "uploaded on the e-portal",
                "no physical document",
            ],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            candidates.append(
                CandidateComplianceItem(
                    category="EXECUTION",
                    title="Mandatory Electronic Proposal Submission on E-Portal",
                    description="Proposals must be submitted strictly in electronic format via the designated e-portal; physical submissions are rejected.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        signing_authority_rank="Authorized Signatory",
                    ),
                    provenance=ProvenanceProps(
                        source_document_id=doc_id,
                        source_file_name="tender_document.pdf",
                        page_number=page_no,
                        clause_reference=ref,
                        verbatim_quote=quote,
                        confidence_score=conf,
                    ),
                )
            )

    # 10. Execution: Joint Venture Ceiling (Maximum 2 Partners) & Multi-JV Participation Bar (B8)
    if not is_jv_prohibited and (
        "maximum number of joint venture partners is limited to 2" in text_lower
        or ("joint venture partners is limited" in text_lower and "2" in text_lower)
    ):
        res = get_clause_and_quote(
            r"(?:maximum number of joint venture partners is limited to 2|formulation of more than one jv with different partners)",
            "jv ceiling",
            ["maximum number of joint venture partners", "limited to 2", "more than one jv"],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            candidates.append(
                CandidateComplianceItem(
                    category="EXECUTION",
                    title="Joint Venture Ceiling (Maximum 2 Partners) & Multi-JV Participation Bar",
                    description="Joint Venture formation is restricted to a maximum of 2 partners (1 lead member + 1 JV partner). Participating in more than one JV with different partners for the same assignment is strictly prohibited on penalty of disqualification.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=True,
                        stamp_paper_denomination_inr=100,
                        notarization_required=True,
                        signing_authority_rank="All JV Partner Authorized Signatories",
                    ),
                    provenance=ProvenanceProps(
                        source_document_id=doc_id,
                        source_file_name="tender_document.pdf",
                        page_number=page_no,
                        clause_reference=ref,
                        verbatim_quote=quote,
                        confidence_score=conf,
                    ),
                )
            )

    # 11. Execution: Associate Key Personnel Ceiling (Maximum 2) & Legally Binding MOU (B10)
    if any(
        k in text_lower
        for k in (
            "associate for providing key personnel",
            "maximum number of key personnel from associate firm",
        )
    ):
        res = get_clause_and_quote(
            r"(?:associate for providing key personnel|maximum number of key personnel from associate firm.*?limited to two)",
            "associate personnel",
            [
                "associate for providing key personnel",
                "submit a mou with associate",
                "limited to two (2)",
            ],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            candidates.append(
                CandidateComplianceItem(
                    category="EXECUTION",
                    title="Associate Key Personnel Ceiling (Maximum 2) & Legally Binding MOU",
                    description="Inclusion of Associate for key personnel requires submission of a legally binding MOU detailing roles and responsibilities, with a strict ceiling of maximum two (2) Key Personnel from the Associate firm.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=True,
                        stamp_paper_denomination_inr=100,
                        notarization_required=True,
                        signing_authority_rank="Lead Consultant & Associate Authorized Signatories",
                    ),
                    provenance=ProvenanceProps(
                        source_document_id=doc_id,
                        source_file_name="tender_document.pdf",
                        page_number=page_no,
                        clause_reference=ref,
                        verbatim_quote=quote,
                        confidence_score=conf,
                    ),
                )
            )

    # 12. Execution: Joint Venture Turnover & Experience Split (Lead >= 75%, Partner >= 40%) (B15)
    if not is_jv_prohibited and (
        any(
            k in text_lower
            for k in (
                "lead partner must fulfill at least 75%",
                "lead partner should meet at least 75%",
            )
        )
        and any(
            k in text_lower
            for k in (
                "jv partner must fulfill at least 40%",
                "jv partner should meet at least 40%",
            )
        )
    ):
        res = get_clause_and_quote(
            r"(?:lead partner should meet at least 75%.*?jv partner should meet at least 40%|lead partner must fulfill at least 75%)",
            "jv turnover split",
            [
                "lead partner should meet at least 75%",
                "jv partner should meet at least 40%",
                "annual turnover",
            ],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            candidates.append(
                CandidateComplianceItem(
                    category="EXECUTION",
                    title="Joint Venture Turnover & Experience Split (Lead >= 75%, Partner >= 40%)",
                    description="In case of Joint Venture, the Lead Partner must satisfy at least 75% and the JV Partner at least 40% of the Annual Turnover requirement, and both partners must possess eligible project experience.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        udin_required=True,
                        signing_authority_rank="Chartered Accountant / Statutory Auditor",
                    ),
                    provenance=ProvenanceProps(
                        source_document_id=doc_id,
                        source_file_name="tender_document.pdf",
                        page_number=page_no,
                        clause_reference=ref,
                        verbatim_quote=quote,
                        confidence_score=conf,
                    ),
                )
            )

    # 13. Execution: Joint Venture Ineligible Partner Bid Capacity Threshold (< 0.5 Bar) (B18)
    if not is_jv_prohibited and "remaining bid capacity less than 0.5" in text_lower:
        res = get_clause_and_quote(
            r"(?:remaining bid capacity less than 0\.5.*?declared as non-responsive|individual remaining bid capacity less than 0\.5)",
            "jv capacity threshold",
            [
                "remaining bid capacity less than 0.5",
                "declared as non-responsive",
                "joint venture",
            ],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            candidates.append(
                CandidateComplianceItem(
                    category="EXECUTION",
                    title="Joint Venture Ineligible Partner Bid Capacity Threshold (< 0.5 Bar)",
                    description="If any partner of a Joint Venture has individual remaining bid capacity less than 0.5, the JV bid shall be declared non-responsive during technical evaluation, even if total combined JV bid capacity exceeds 0.5.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        signing_authority_rank="Authorized Signatory",
                    ),
                    provenance=ProvenanceProps(
                        source_document_id=doc_id,
                        source_file_name="tender_document.pdf",
                        page_number=page_no,
                        clause_reference=ref,
                        verbatim_quote=quote,
                        confidence_score=conf,
                    ),
                )
            )

    return candidates
