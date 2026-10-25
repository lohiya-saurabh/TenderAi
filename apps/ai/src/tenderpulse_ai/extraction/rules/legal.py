from __future__ import annotations

from tenderpulse_ai.domain.models import (
    CandidateComplianceItem,
    ExecutionRulesProps,
    ProvenanceProps,
)
from tenderpulse_ai.extraction.metrics import (
    extract_monetary_amounts,
    extract_percentages,
    extract_temporal_durations,
)
from tenderpulse_ai.extraction.rules.base import (
    disambiguate_stamp_paper,
    get_clause_and_quote,
)


def extract_legal_rules(
    doc_id: str,
    page_no: int,
    text: str,
    text_lower: str,
    clause_ref: str,
) -> list[CandidateComplianceItem]:
    candidates: list[CandidateComplianceItem] = []

    # 1. Legal: Bid Validity Period
    if any(
        k in text_lower
        for k in ("period of validity of bids", "bid validity", "bids shall remain valid")
    ):
        res = get_clause_and_quote(
            r"(?:period of validity of bids|bid validity|bids shall remain valid)",
            "validity",
            ["period of validity of bids", "bid validity", "bids shall remain valid"],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            candidates.append(
                CandidateComplianceItem(
                    category="LEGAL",
                    title="Bid Validity Period Commitment",
                    description="Bids must remain firm and valid for the stipulated duration post submission deadline.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        udin_required=False,
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

    # Check if this page's LD reference is specifically for project milestones / COD delay
    is_milestone_delay_ld = (
        any(
            k in text_lower
            for k in (
                "liquidated damages",
                "damages for delay",
                "fails to achieve any project milestone",
                "fails to achieve milestone",
                "cod does not occur",
            )
        )
        and any(k in text_lower for k in ("performance security", "delay", "damages", "penalty"))
        and any(
            k in text_lower
            for k in ("milestone", "cod", "scheduled completion date", "commercial operation")
        )
    )

    # 2. Legal: Delay Damages & Liquidated Damages
    if not is_milestone_delay_ld and any(
        k in text_lower for k in ("delay damages", "liquidated damages", "time for completion")
    ):
        res = get_clause_and_quote(
            r"(?:delay damages|liquidated damages|time for completion)",
            "damages",
            ["delay damages", "liquidated damages", "time for completion"],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            candidates.append(
                CandidateComplianceItem(
                    category="LEGAL",
                    title="Completion Schedule & Delay Damages (LD)",
                    description="Adherence to completion schedule and acceptance of Liquidated / Delay Damages for non-adherence.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        udin_required=False,
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

    # 3. Legal: Defect Liability Period (DLP)
    if any(k in text_lower for k in ("defect liability", "maintenance period", "guarantee period")):
        res = get_clause_and_quote(
            r"(?:defect liability|maintenance period|guarantee period)",
            "defect liability",
            ["defect liability", "maintenance period", "guarantee period"],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            candidates.append(
                CandidateComplianceItem(
                    category="LEGAL",
                    title="Defect Liability Period (DLP) & Maintenance Guarantee",
                    description="Mandatory Defect Liability Period maintenance and warranty obligations post work completion.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        udin_required=False,
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

    # 4. Legal: Integrity Pact & Anti-Debarment
    if any(
        k in text_lower
        for k in (
            "integrity pact",
            "litigation history",
            "non-performance",
            "debarment",
            "blacklisting",
            "debarred",
            "blacklisted",
        )
    ):
        res = get_clause_and_quote(
            r"(?:integrity pact|litigation history|non-performance|debarment|blacklisting|debarred|blacklisted)",
            "debarment",
            [
                "integrity pact",
                "litigation history",
                "non-performance",
                "debarment",
                "blacklisting",
                "debarred",
                "blacklisted",
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
                    category="LEGAL",
                    title="Integrity Pact & Non-Blacklisting Declaration",
                    description="Declaration of no contract non-performance, litigation history, or debarment by any government body.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=stamp_req,
                        stamp_paper_denomination_inr=stamp_denom if stamp_req else None,
                        notarization_required=stamp_req,
                        signing_authority_rank="Authorized Signatory with Board Resolution",
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

    # 5. Legal: Conflict of Interest & Non-Collusion
    if any(
        k in text_lower
        for k in (
            "conflict of interest",
            "non-collusion",
            "non-engagement of any agent",
            "middleman or intermediary",
        )
    ):
        res = get_clause_and_quote(
            r"(?:conflict of interest|non-collusion|middleman or intermediary)",
            "conflict of interest",
            [
                "conflict of interest",
                "non-collusion",
                "non-engagement of any agent",
                "middleman or intermediary",
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
                    category="LEGAL",
                    title="Conflict of Interest & Non-Collusion Undertaking",
                    description="Undertaking confirming absence of conflict of interest and non-engagement of intermediaries or agents.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        udin_required=False,
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

    # 6. Legal: Liquidated Damages for Construction Milestone Delay
    if is_milestone_delay_ld:
        res = get_clause_and_quote(
            r"(?:damages.*?performance security|liquidated damages|fails to achieve.*?milestone)",
            "liquidated damages",
            [
                "liquidated damages",
                "damages for delay",
                "performance security",
                "project milestone",
            ],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            pcts = extract_percentages(quote)
            durs = extract_temporal_durations(quote)
            rate_str = (
                f"{pcts[0]['formatted']} of Performance Security"
                if pcts
                else "stipulated percentage of Performance Security"
            )
            grace_str = (
                f"beyond {durs[0]['value']} {durs[0]['unit']}"
                if durs
                else "beyond stipulated grace period"
            )
            candidates.append(
                CandidateComplianceItem(
                    category="LEGAL",
                    title="Liquidated Damages for Construction Milestone & COD Delay",
                    description=f"Liquidated damages at {rate_str} per day for delay {grace_str} in achieving project milestones or COD.",
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

    # 7. Legal: Accident Fatality & Grievous Injury Strict Liabilities
    is_accident_liability = any(
        k in text_lower for k in ("fatality", "fatal accident", "death of any person")
    ) and any(
        k in text_lower for k in ("grievous injury", "injury", "compensation", "liable to pay")
    )
    if is_accident_liability:
        res = get_clause_and_quote(
            r"(?:fatality.*?injury|liable to pay.*?fatality|compensation.*?fatality|fatality)",
            "fatality",
            ["fatality", "grievous injury", "fatal accident", "compensation"],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            amounts = extract_monetary_amounts(quote)
            fatality_amt = (
                amounts[0]["formatted"]
                if len(amounts) >= 1
                else "stipulated statutory compensation"
            )
            injury_amt = amounts[1]["formatted"] if len(amounts) >= 2 else "statutory compensation"
            candidates.append(
                CandidateComplianceItem(
                    category="LEGAL",
                    title="Accident Fatality & Grievous Injury Strict Liability Compensation",
                    description=f"Mandatory compensation of {fatality_amt} per fatality and {injury_amt} per grievous injury if caused by project defect or safety lapse.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        signing_authority_rank="Authorized Signatory / Claims Officer",
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

    # 8. Legal: Comprehensive Project Insurances
    if "co-insured" in text_lower or (
        "insurance" in text_lower
        and "escrow account" in text_lower
        and any(k in text_lower for k in ("article", "policy", "concessionaire shall effect"))
    ):
        res = get_clause_and_quote(
            r"co-insured|concessionaire shall effect and maintain.*?insurance",
            "co-insured",
            ["co-insured", "insurance policy", "insurances"],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            candidates.append(
                CandidateComplianceItem(
                    category="LEGAL",
                    title="Comprehensive Project Insurances & Authority Co-Insured Mandate",
                    description="Maintain EPC all-risk insurance, asset replacement coverage, 3rd-party liability, and workmen's compensation with the Authority named as co-insured; 45-day notice prior to cancellation.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        signing_authority_rank="Insurance Underwriter / Authorized Signatory",
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

    # 9. Legal: SAROD Arbitration Agreement
    if "sarod" in text_lower or "society for affordable redressal of disputes" in text_lower:
        res = get_clause_and_quote(
            r"society for affordable redressal of disputes|sarod",
            "sarod",
            ["society for affordable redressal of disputes", "sarod", "arbitration"],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            candidates.append(
                CandidateComplianceItem(
                    category="LEGAL",
                    title="Tiered Dispute Resolution & SAROD Arbitration Agreement",
                    description="Tiered dispute resolution procedure: amicable conciliation, SAROD arbitration for qualified claims, and statutory courts for major disputes.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        signing_authority_rank="SAROD Arbitral Tribunal / Legal Counsel",
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

    # 10. Legal: Toll Revenue Under-Reporting Liquidated Damages
    is_toll_penalty = (
        any(
            k in text_lower
            for k in (
                "under-reporting",
                "under-reported",
                "over-charging",
                "excess fee",
                "unauthorized fee",
            )
        )
        and any(k in text_lower for k in ("damages", "penalty", "user fee", "toll"))
    ) or any(k in text_lower for k in ("times such difference", "damages equal to 200%"))
    if is_toll_penalty:
        res = get_clause_and_quote(
            r"(?:times such difference|damages equal to \d+%|under-reporting.*?damages)",
            "damages",
            ["under-reporting", "over-charging", "damages", "user fee"],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            candidates.append(
                CandidateComplianceItem(
                    category="LEGAL",
                    title="Toll Revenue Under-Reporting & Over-Charging Liquidated Damages",
                    description="Liquidated damages for under-reported toll revenues and unauthorized or excess user fee rates as specified in tender conditions.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        signing_authority_rank="Statutory Auditor / Authority Representative",
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

    # 11. Legal: Post-Termination Defect Liability & Escrow Retention
    is_post_term_dlp = any(
        k in text_lower
        for k in ("defects and deficiencies", "defect liability", "rectification of defects")
    ) and any(
        k in text_lower
        for k in (
            "after termination",
            "post-termination",
            "termination of this agreement",
            "expiry of the concession period",
        )
    )
    if is_post_term_dlp:
        res = get_clause_and_quote(
            r"(?:defects and deficiencies.*?after termination|defects and deficiencies.*?period of \d+|defect liability.*?termination)",
            "defect liability",
            [
                "defects and deficiencies",
                "defect liability",
                "after termination",
                "post-termination",
            ],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            durations = extract_temporal_durations(quote)
            dur_label = f"{durations[0]['value']}-Day" if durations else "Post-Termination"
            dur_text = f"{durations[0]['value']}-day" if durations else "post-termination"
            candidates.append(
                CandidateComplianceItem(
                    category="LEGAL",
                    title="Post-Termination Defect Liability & Escrow Retention",
                    description=f"{dur_text} ({dur_label}) post-termination defect liability backed by retention or bank guarantee, with Authority right to rectify at contractor's risk and cost.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        signing_authority_rank="Independent Engineer / Escrow Bank",
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

    # 12. Legal: Public Domain Hosting Consent
    if any(
        k in text_lower
        for k in ("in public domain", "hoisting of their credentials", "uploading/hoisting")
    ) and any(
        k in text_lower
        for k in (
            "credentials submitted",
            "consultants at bidding stage",
            "individual key personnel",
        )
    ):
        res = get_clause_and_quote(
            r"(?:keep the credentials.*?in public domain|uploading/hoisting of their credentials in public domain)",
            "public domain",
            ["in public domain", "credentials submitted", "uploading/hoisting"],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            candidates.append(
                CandidateComplianceItem(
                    category="LEGAL",
                    title="Public Domain Hosting Consent for Consultant & Personnel Credentials",
                    description="Undertaking consenting to the publication of firm and key personnel credentials on client public portals.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        signing_authority_rank="Authorized Signatory & All Key Personnel",
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

    # 13. Legal: 2-Year Non-Performance, Arbitral Penalty & Termination Covenant (B21)
    if any(
        k in text_lower
        for k in ("neither failed to perform", "last 2 years", "in the last 2 years")
    ) and any(
        k in text_lower
        for k in (
            "imposition of a penalty by an arbitral",
            "arbitration award",
            "expelled or terminated",
        )
    ):
        res = get_clause_and_quote(
            r"(?:in the last 2 years, have neither failed to perform.*?arbitration award|expelled or terminated by ministry of road transport|neither failed to perform for the works)",
            "non-performance covenant",
            [
                "in the last 2 years",
                "neither failed to perform",
                "imposition of a penalty",
                "expelled or terminated",
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
                    category="LEGAL",
                    title="2-Year Non-Performance, Arbitral Penalty & Termination Covenant",
                    description="Mandatory covenant certifying that in the last 2 years bidder/JV member has not suffered arbitral/judicial penalties for non-performance on Expressways/NH works, has not been expelled/terminated by MoRT&H, and is not currently debarred by NHAI.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=stamp_req if stamp_req else True,
                        stamp_paper_denomination_inr=stamp_denom if stamp_denom else 100,
                        notarization_required=True,
                        signing_authority_rank="Authorized Signatory / Managing Director",
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
