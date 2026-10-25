from __future__ import annotations

import re

from tenderpulse_ai.domain.models import (
    CandidateComplianceItem,
    ExecutionRulesProps,
    ProvenanceProps,
)
from tenderpulse_ai.extraction.rules.base import get_clause_and_quote


def extract_commercial_rules(
    doc_id: str,
    page_no: int,
    text: str,
    text_lower: str,
    clause_ref: str,
) -> list[CandidateComplianceItem]:
    candidates: list[CandidateComplianceItem] = []

    # 1. Commercial: Bid Due Date & Technical Proposal Opening Schedule
    if any(
        k in text_lower
        for k in (
            "bid due date",
            "submission must be received not later than",
            "bids (technical) would be opened on",
            "technical bids would be opened",
        )
    ):
        res = get_clause_and_quote(
            r"(?:submission must be received not later than.*?bid due date|bids \(technical\) would be opened on)",
            "bid due date",
            [
                "bid due date",
                "submission must be received not later than",
                "bids (technical) would be opened",
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
                    category="COMMERCIAL",
                    title="Bid Due Date & Technical Proposal Opening Schedule",
                    description="Strict adherence to bid submission deadline and attendance at technical proposal electronic opening.",
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

    # 2. Commercial: Goods & Services Tax (GST) Pricing Treatment
    is_gst_pricing = any(
        k in text_lower
        for k in (
            "inclusive of gst",
            "exclusive of gst",
            "inclusive of all taxes",
            "exclusive of all taxes",
            "gst will be paid extra",
            "gst shall be paid extra",
            "gst shall be payable extra",
            "gst shall be reimbursed",
            "goods and services tax",
        )
    ) and any(k in text_lower for k in ("gst", "goods and services tax", "taxes"))
    if is_gst_pricing:
        res = get_clause_and_quote(
            r"(?:inclusive of (?:all taxes|gst)|exclusive of (?:all taxes|gst)|gst (?:shall|will) be (?:paid|payable|reimbursed)|rates quoted.*?taxes)",
            "gst",
            [
                "inclusive of gst",
                "exclusive of gst",
                "gst shall be paid extra",
                "gst will be paid extra",
                "goods and services tax",
                "inclusive of all taxes",
            ],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            is_inclusive = bool(
                re.search(r"\binclusive of\b", quote, re.IGNORECASE)
                or ("inclusive" in text_lower and "exclusive" not in text_lower)
            )
            is_exclusive = bool(
                re.search(r"\bexclusive of\b|\bpaid extra\b|\breimbursed\b", quote, re.IGNORECASE)
                or ("exclusive" in text_lower and "inclusive" not in text_lower)
            )
            if is_inclusive and not is_exclusive:
                treatment = "Inclusive of GST"
                desc = "Bid pricing / quoted rates are all-inclusive, covering all applicable taxes and duties including GST."
            elif is_exclusive and not is_inclusive:
                treatment = "Exclusive of GST (Payable Extra)"
                desc = "Bid pricing / quoted rates are exclusive of GST; Goods and Services Tax is payable/reimbursable extra by the Authority."
            else:
                treatment = "GST & Tax Treatment"
                desc = "Pricing conditions governing the treatment, inclusion, or reimbursement of Goods and Services Tax (GST)."

            candidates.append(
                CandidateComplianceItem(
                    category="COMMERCIAL",
                    title=f"GST Pricing Treatment ({treatment})",
                    description=desc,
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        signing_authority_rank="Finance Head / Commercial Lead",
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

    # 3. Commercial: QCBS Evaluation Criteria & Technical-Financial Score Weightage (80:20) (B6)
    if any(k in text_lower for k in ("80% & 20%", "80% and 20%", "qcbs")) or (
        "minimum qualifying marks" in text_lower and "75%" in text
    ):
        res = get_clause_and_quote(
            r"(?:weightage of technical and financial score shall be 80% & 20%|minimum qualifying marks \(minimum75%\))",
            "qcbs evaluation",
            ["minimum qualifying marks", "weightage of technical and financial score", "80% & 20%"],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            candidates.append(
                CandidateComplianceItem(
                    category="COMMERCIAL",
                    title="QCBS Evaluation Criteria & Technical-Financial Score Weightage (80:20)",
                    description="Quality and Cost Based Selection (QCBS) evaluation framework: minimum qualifying technical score of 75%, selection of top 5 non-conflicted firms, and 80:20 weightage for technical and financial scores.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        signing_authority_rank="Commercial Head / Authorized Signatory",
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

    # 4. Commercial: Historical Turnover Escalation Multipliers (1.00 to 1.61) & Foreign Currency Conversion (B20)
    if "enhancement factor" in text_lower and any(
        k in text_lower for k in ("1.00", "1.10", "1.61", "turnover")
    ):
        res = get_clause_and_quote(
            r"(?:enhancement factor will be used for the cost of services|sbi bc selling rate)",
            "enhancement factor",
            [
                "enhancement factor will be used",
                "turnover from consultancy business",
                "sbi bc selling rate",
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
                    category="COMMERCIAL",
                    title="Historical Turnover Escalation Multipliers (1.00 to 1.61) & Foreign Currency Conversion",
                    description="Past consultancy turnover and service costs normalized using statutory escalation factors (1.00 for current FY, 1.10 for 1 yr prior, 1.21 for 2 yrs, 1.33 for 3 yrs, 1.46 for 4 yrs, 1.61 for 5 yrs); foreign currency converted via SBI BC Selling Rate on bid due date without escalation.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        udin_required=True,
                        signing_authority_rank="Chartered Accountant / Finance Head",
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

    # 5. Commercial: Mandatory English Language Proposal & Correspondence Covenant (B25)
    if (
        "submitted in english language" in text_lower
        or "english language and all correspondence" in text_lower
    ):
        res = get_clause_and_quote(
            r"(?:submitted in english language and all correspondence|proposal shall be submitted in english language)",
            "english language",
            [
                "proposal shall be submitted in english language",
                "all correspondence would be the same language",
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
                    category="COMMERCIAL",
                    title="Mandatory English Language Proposal & Correspondence Covenant",
                    description="Mandatory requirement that the entire bid proposal, supporting technical documentation, and all official contractual correspondence must be in the English language.",
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

    # 6. Commercial: Uncompensated PIU / Authority Directed Duties Covenant (B26)
    if "without any additional cost" in text_lower and any(
        k in text_lower for k in ("piu/authority", "piu", "directed by")
    ):
        res = get_clause_and_quote(
            r"(?:directed by the piu/authority.*?without any additional cost|duties as directed by the piu)",
            "piu directed duties",
            ["directed by the piu/authority", "without any additional cost"],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            candidates.append(
                CandidateComplianceItem(
                    category="COMMERCIAL",
                    title="Uncompensated PIU / Authority Directed Duties Covenant",
                    description="Contractual obligation to execute functions, inspections, and duties directed by the PIU/Authority for the project stretch without claiming additional costs or compensation.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        signing_authority_rank="Team Leader / Project Director",
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
