from __future__ import annotations

from tenderpulse_ai.domain.models import (
    CandidateComplianceItem,
    ExecutionRulesProps,
    ProvenanceProps,
)
from tenderpulse_ai.extraction.metrics import extract_monetary_amounts
from tenderpulse_ai.extraction.rules.base import (
    disambiguate_stamp_paper,
    get_clause_and_quote,
)


def extract_statutory_rules(
    doc_id: str,
    page_no: int,
    text: str,
    text_lower: str,
    clause_ref: str,
) -> list[CandidateComplianceItem]:
    candidates: list[CandidateComplianceItem] = []

    # 1. Statutory: Make in India (PPP-MII) Local Content
    if any(k in text_lower for k in ("make in india", "local content", "ppp-mii", "class-i local")):
        res = get_clause_and_quote(
            r"(?:make in india|local content|ppp-mii|class-i local)",
            "local content",
            ["make in india", "local content", "ppp-mii", "class-i local"],
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
                    category="STATUTORY",
                    title="Make in India (PPP-MII) Local Content Declaration",
                    description="Statutory declaration of local value addition percentage signed by Statutory Auditor.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=stamp_req if stamp_req else True,
                        stamp_paper_denomination_inr=stamp_denom if stamp_denom else 100,
                        notarization_required=True,
                        udin_required=True,
                        signing_authority_rank="Statutory Auditor / Authorized Director",
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

    # 2. Statutory: GSTIN & PAN Registration
    if any(
        k in text_lower
        for k in (
            "goods and services tax",
            "gstin",
            "gst registration",
            "pan card",
            "taxes and duties",
        )
    ):
        res = get_clause_and_quote(
            r"(?:goods and services tax|gstin|gst registration|taxes and duties)",
            "gst",
            [
                "goods and services tax",
                "gstin",
                "gst registration",
                "pan card",
                "taxes and duties",
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
                    category="STATUTORY",
                    title="GSTIN Registration & Taxes/Duties Compliance",
                    description="Valid Goods & Services Tax (GSTIN) registration certificate and Permanent Account Number (PAN).",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        udin_required=False,
                        signing_authority_rank="Authorized Signatory / Finance Head",
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

    # 3. Statutory: Statutory Permits (Schedule E)
    if any(k in text_lower for k in ("schedule-e", "schedule e")) and any(
        k in text_lower for k in ("applicable permits", "quarry", "explosives", "batching plant")
    ):
        res = get_clause_and_quote(
            r"applicable permits",
            "applicable permits",
            ["schedule-e", "applicable permits", "quarry"],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            candidates.append(
                CandidateComplianceItem(
                    category="STATUTORY",
                    title="Statutory Clearances & Applicable Permits (Schedule E)",
                    description="Procurement and maintenance of 10 mandatory statutory permits: quarrying boulders, PCB crushers consent, explosives license, water drawing permission, batching plant factory license, PCB asphalt plant, borrow earth permit, and tree cutting clearance.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=True,
                        stamp_paper_denomination_inr=100,
                        notarization_required=True,
                        signing_authority_rank="Statutory Regulatory Authorities / Concessionaire",
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

    # 4. Statutory: 24/7 Basic Life Support Paramedic Ambulance Service
    if "basic life support ambulance service" in text_lower or (
        "ambulance service" in text_lower
        and any(k in text_lower for k in ("paramedic", "medical", "emergency"))
    ):
        res = get_clause_and_quote(
            r"basic life support ambulance service|ambulance service.*?paramedic",
            "ambulance",
            ["basic life support ambulance service", "ambulance service", "paramedics"],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            candidates.append(
                CandidateComplianceItem(
                    category="STATUTORY",
                    title="24/7 Basic Life Support Paramedic Ambulance Service",
                    description="24/7 Basic Life Support ambulance staffed with certified paramedics at each toll plaza linked to the national emergency response network.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        signing_authority_rank="Medical Officer / Safety Head",
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

    # 5. Statutory: Form 26AS Income Tax Verification
    if any(k in text_lower for k in ("form-26 as", "form 26as", "form 26 as")) and any(
        k in text_lower
        for k in (
            "permanent key personnel",
            "certify their permanent",
            "consulting firms shall submit",
        )
    ):
        res = get_clause_and_quote(
            r"(?:form-?26\s*as.*?permanent key personnel|consulting firms shall submit form-?26\s*as)",
            "form 26as",
            ["form-26 as", "form 26as", "permanent key personnel"],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            candidates.append(
                CandidateComplianceItem(
                    category="STATUTORY",
                    title="Form-26AS Income Tax Certification for Permanent Key Personnel",
                    description="Submission of statutory Income Tax Form-26AS to certify employment history and retention of permanent key personnel.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        udin_required=False,
                        signing_authority_rank="Authorized Signatory / HR Head",
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

    # 6. Statutory: GFR Rule 144(xi) Land Border Restrictions & Source-Code Residency
    is_gfr_144 = (
        any(
            k in text_lower
            for k in (
                "144(xi)",
                "144 (xi)",
                "sub-rule 144",
                "rule 144(xi)",
                "rule 144 (xi)",
            )
        )
        or (
            "land border" in text_lower
            and any(
                k in text_lower
                for k in (
                    "competent authority",
                    "source code",
                    "rebranding",
                    "shares a land border",
                    "registration with the competent authority",
                )
            )
        )
        or (
            "source code" in text_lower
            and any(k in text_lower for k in ("land border", "firmware", "reside in any country"))
        )
    )
    if is_gfr_144:
        res = get_clause_and_quote(
            r"(?:sub-rule\s*144\s*\(xi\)|rule\s*144\s*\(xi\)|shares?\s+a\s+land\s+border|source\s+code.*?land\s+border|source\s+code\s+of\s+the\s+software|country\s+which\s+shares\s+a\s+land\s+border)",
            "land border",
            ["144 (xi)", "144(xi)", "land border", "source code", "competent authority"],
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
                    category="STATUTORY",
                    title="GFR Rule 144(xi) Land Border Restrictions & Source-Code Residency",
                    description="Mandatory compliance with GFR Rule 144(xi): registration with Competent Authority for entities sharing land border with India, ban on OEM rebranding/importing, and undertaking that software/firmware source code does not reside in any land border country.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=stamp_req,
                        stamp_paper_denomination_inr=stamp_denom if stamp_req else None,
                        notarization_required=stamp_req,
                        udin_required=False,
                        signing_authority_rank="Power of Attorney Holder / Authorized Signatory",
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

    # 7. Statutory: Legal Metrology Stamping Certification & Tampering Penalty Enforcement
    is_legal_metrology = any(
        k in text_lower for k in ("legal metrology", "weights & measures", "weigh and measure")
    ) or (
        any(
            k in text_lower
            for k in ("stamping", "tampered stamping", "validity of stamping", "re-stamping")
        )
        and any(
            k in text_lower
            for k in ("wim", "weigh-in-motion", "scale", "sealing", "5,00,000", "penalty")
        )
    )
    if is_legal_metrology:
        res = get_clause_and_quote(
            r"(?:validity of stamping.*?weigh and measure|tampered stamping/sealing|₹?5,00,000.*?stamping|legal metrology.*?stamping|stamping & calibration|re-stamping|validity of stamping)",
            "stamping",
            [
                "validity of stamping",
                "weigh and measure",
                "tampered stamping",
                "stamping",
                "sealing",
                "5,00,000",
            ],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            amounts = extract_monetary_amounts(quote) or extract_monetary_amounts(text)
            penalty_text = amounts[0]["formatted"] if amounts else "Rs. 5.00 Lakh"
            candidates.append(
                CandidateComplianceItem(
                    category="STATUTORY",
                    title="Legal Metrology Stamping Certification & Tampering Penalty Enforcement",
                    description=f"Mandatory annual verification and valid stamping from Legal Metrology / Weights & Measures Department for all WIM systems; strict penalty of {penalty_text} per instance and payment forfeiture for operating with expired, invalid, or tampered stamping/seals.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        udin_required=False,
                        signing_authority_rank="Weights & Measures Department / Inspector of Legal Metrology",
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
