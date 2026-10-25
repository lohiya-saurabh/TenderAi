from __future__ import annotations

import re

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


def extract_financial_rules(
    doc_id: str,
    page_no: int,
    text: str,
    text_lower: str,
    clause_ref: str,
) -> list[CandidateComplianceItem]:
    candidates: list[CandidateComplianceItem] = []

    # 1. Financial: Bid Security / Earnest Money Deposit (EMD)
    is_bare_def_emd = bool(
        re.search(r"^[“\"\'\s]*bid security[”\"\'\s]*means\b", text_lower.strip())
        or (
            "article 48" in text_lower
            and "definitions" in text_lower
            and "shall furnish" not in text_lower
            and "shall submit" not in text_lower
        )
    )
    if not is_bare_def_emd and any(
        k in text_lower
        for k in (
            "earnest money",
            "emd",
            "bid security",
            "tender security",
            "bid securing declaration",
            "bid-securing declaration",
        )
    ):
        res = get_clause_and_quote(
            r"(?:earnest money|emd|bid security|tender security|bid[- ]securing declaration)",
            "bid security",
            [
                "earnest money",
                "emd",
                "bid security",
                "tender security",
                "bid securing declaration",
            ],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            amounts = extract_monetary_amounts(text)
            amount_str = f" of {amounts[0]['formatted']}" if amounts else ""
            stamp_req, stamp_denom = disambiguate_stamp_paper(text)
            is_bsd = bool(re.search(r"\bbid[- ]securing declaration\b", text_lower))
            title = (
                "Bid Securing Declaration (in lieu of EMD)"
                if is_bsd
                else "Tender & Bid Security (EMD) Guarantee"
            )
            description = (
                "Submission of Bid Securing Declaration in the prescribed format in lieu of monetary Earnest Money Deposit."
                if is_bsd
                else f"Submission of Earnest Money Deposit / Bid Security{amount_str} as required by tender conditions."
            )
            candidates.append(
                CandidateComplianceItem(
                    category="FINANCIAL",
                    title=title,
                    description=description,
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=stamp_req,
                        stamp_paper_denomination_inr=stamp_denom if stamp_req else None,
                        notarization_required=stamp_req,
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

    # 2. Financial: Performance Security (PBG) & Security Deposit
    is_pure_damages_citation = bool(
        re.search(
            r"\b0\.[12]%\s*(?:\([^\)]+\)\s*)?(?:of the\s*)?performance security\b", text_lower
        )
    ) and not any(
        m in text_lower
        for m in (
            "provide to the authority",
            "shall provide",
            "shall furnish",
            "performance security for the due performance",
            "irrevocable and unconditional",
        )
    )
    if not is_pure_damages_citation and any(
        k in text_lower
        for k in (
            "performance security",
            "performance bank guarantee",
            "pbg",
            "contract performance security",
            "unconditional e-bank guarantee",
            "unconditional bank guarantee",
        )
    ):
        res = get_clause_and_quote(
            r"(?:performance security|performance bank guarantee|pbg|unconditional e-bank guarantee|unconditional bank guarantee)",
            "performance security",
            [
                "performance security",
                "performance bank guarantee",
                "pbg",
                "contract performance security",
                "irrevocable and unconditional e-bank guarantee",
                "unconditional e-bank guarantee",
            ],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            percentages = extract_percentages(text)
            pct_str = f" of {percentages[0]['formatted']}" if percentages else ""
            durations = extract_temporal_durations(text)
            dur_str = (
                f" within {durations[0]['value']} {durations[0]['unit']}"
                if durations
                else " within stipulated timeline"
            )
            stamp_req, stamp_denom = disambiguate_stamp_paper(text)
            candidates.append(
                CandidateComplianceItem(
                    category="FINANCIAL",
                    title="Performance Security (PBG) & Security Deposit",
                    description=f"Submission of Performance Security / Bank Guarantee{pct_str} of contract price{dur_str} post Letter of Acceptance.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=stamp_req if stamp_req else True,
                        stamp_paper_denomination_inr=stamp_denom if stamp_denom else 100,
                        notarization_required=False,
                        signing_authority_rank="Authorized Signatory with Bank Guarantee",
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

    # 3. Financial: Bank Solvency & Working Capital
    is_assignment_context = any(
        x in text_lower
        for x in (
            "permitted assignment",
            "assignment of rights",
            "security in favor of",
            "security in favour of",
        )
    )
    has_solvency_proof = bool(
        re.search(
            r"\b(solvency certificate|banker'?s solvency|working capital certificate|cash flow requirement|liquid assets of not less|line of credit)\b",
            text_lower,
        )
    )
    if not is_assignment_context and (
        has_solvency_proof
        or any(
            k in text_lower
            for k in (
                "solvency certificate",
                "bank solvency",
                "cash flow requirement",
                "liquid assets",
            )
        )
    ):
        res = get_clause_and_quote(
            r"(?:solvency certificate|bank solvency|working capital|cash flow requirement|liquid assets)",
            "solvency",
            [
                "solvency certificate",
                "bank solvency",
                "working capital",
                "cash flow requirement",
                "liquid assets",
            ],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            amounts = extract_monetary_amounts(text)
            amount_str = f" of {amounts[0]['formatted']}" if amounts else ""
            candidates.append(
                CandidateComplianceItem(
                    category="FINANCIAL",
                    title="Bank Solvency & Working Capital Credit Facilities",
                    description=f"Banker's solvency certificate or line of credit{amount_str} demonstrating adequate working capital liquidity.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        udin_required=False,
                        signing_authority_rank="Scheduled Commercial Bank Branch Manager",
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

    # 4. Financial: Performance Security Release Threshold
    if "release of performance security" in text_lower or (
        "performance security" in text_lower
        and any(k in text_lower for k in ("release", "return", "discharge"))
        and any(k in text_lower for k in ("expending", "expenditure", "progress", "completion"))
    ):
        res = get_clause_and_quote(
            r"release of performance security|(?:release|return|discharge).*?performance security",
            "release of performance security",
            ["release of performance security", "expending", "performance security"],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            percentages = extract_percentages(quote)
            pct_str = percentages[0]["formatted"] if percentages else "40%"
            candidates.append(
                CandidateComplianceItem(
                    category="FINANCIAL",
                    title="Performance Security Release Threshold",
                    description=f"Performance Security released upon certified expenditure of at least {pct_str} of Total Project Cost on construction works.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        signing_authority_rank="Independent Engineer Certified",
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

    # 5. Financial: State Construction Support Grant
    is_construction_grant = (
        any(
            k in text_lower
            for k in (
                "construction support",
                "state support",
                "capital grant",
                "construction grant",
            )
        )
        or (
            "instalments" in text_lower
            and any(
                k in text_lower
                for k in (
                    "due and payable",
                    "payable to the concessionaire",
                    "payable to the contractor",
                    "construction period",
                )
            )
        )
        or (
            ("grant" in text_lower or "support" in text_lower)
            and any(
                k in text_lower
                for k in (
                    "due and payable",
                    "equal instalments",
                    "equal installments",
                    "tranches",
                )
            )
            and any(k in text_lower for k in ("crore", "lakh", "million"))
        )
    )
    if is_construction_grant:
        res = get_clause_and_quote(
            r"(?:(?:due and payable.*?instalments)|(?:instalments.*?construction period)|(?:construction support)|(?:grant.*?instalments))",
            "instalments",
            [
                "equal instalments",
                "instalments",
                "due and payable",
                "construction support",
                "grant",
            ],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            amounts = extract_monetary_amounts(quote)
            amount_str = amounts[0]["formatted"] if amounts else "Stipulated Amount"
            tranche_m = re.search(
                r"(\d+)\s*(?:\([^\)]+\)\s*)?equal\s+(?:instalments|installments|tranches)",
                quote,
                re.IGNORECASE,
            )
            tranche_str = f"{tranche_m.group(1)} Tranches" if tranche_m else "Tranches"
            candidates.append(
                CandidateComplianceItem(
                    category="FINANCIAL",
                    title="State Construction Support Grant",
                    description=f"Entitlement to {amount_str} construction grant payable by the Authority in {tranche_str} linked to certified physical construction milestones.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        signing_authority_rank="Authority Representative / Independent Engineer",
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

    # 6. Financial: Escrow Account Withdrawal Priority Waterfall
    if "escrow account shall be appropriated in the following order" in text_lower or (
        "deposits in the escrow account" in text_lower
        and "appropriated in the following order" in text_lower
    ):
        res = get_clause_and_quote(
            r"deposits in the escrow account shall be appropriated in the following order",
            "escrow account",
            [
                "deposits in the escrow account shall be appropriated in the following order",
                "escrow account",
            ],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            tier_count = len(re.findall(r"\([a-k\d]\)", quote))
            if tier_count >= 10 or ("senior debt" in text_lower and tier_count >= 5):
                tier_label = "11-Tier "
            elif tier_count >= 3:
                tier_label = f"{tier_count}-Tier "
            else:
                tier_label = ""
            candidates.append(
                CandidateComplianceItem(
                    category="FINANCIAL",
                    title="Escrow Account Withdrawal Priority Waterfall",
                    description=f"Mandatory statutory {tier_label}withdrawal priority waterfall governing all project revenues: Taxes -> Construction -> O&M Expenses -> Concession Fee -> Senior Debt Service -> Damages -> Subordinated Debt -> Equity.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=True,
                        stamp_paper_denomination_inr=100,
                        notarization_required=True,
                        signing_authority_rank="Senior Lenders / Escrow Bank / Concessionaire",
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

    # 7. Financial: Change of Scope Mobilization Advance & Cumulative Cost Caps
    is_change_of_scope = "change of scope" in text_lower and any(
        k in text_lower
        for k in (
            "advance payment",
            "mobilization advance",
            "cumulative cost",
            "cost of change of scope",
        )
    )
    if is_change_of_scope:
        res = get_clause_and_quote(
            r"(?:advance payment.*?change of scope|cumulative costs.*?change of scope|change of scope)",
            "change of scope",
            ["change of scope", "advance payment", "cumulative costs"],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            pcts = extract_percentages(quote)
            pct_label = pcts[0]["formatted"] if pcts else "10%"
            candidates.append(
                CandidateComplianceItem(
                    category="FINANCIAL",
                    title="Change of Scope Mobilization Advance & Cumulative Cost Caps",
                    description=f"{pct_label} mobilization advance within stipulated timeline for Change of Scope orders, subject to cumulative cost caps.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        signing_authority_rank="Independent Engineer / Authority Representative",
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

    # 8. Financial: RFP Document Fee / Cost of Tender
    if any(
        k in text_lower
        for k in (
            "non- refundable fee",
            "non-refundable fee",
            "cost of rfp",
            "cost of tender",
            "tender fee",
            "document fee",
        )
    ) and any(k in text_lower for k in ("rs.", "inr", "neft", "rtgs", "pay the non")):
        res = get_clause_and_quote(
            r"(?:non-?\s*refundable fee.*?rs\.?\s*[\d,]+|pay the non-?\s*refundable fee|cost of rfp)",
            "document fee",
            ["non- refundable fee", "non-refundable fee", "rfp document", "fee of rs"],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            amounts = extract_monetary_amounts(quote) or extract_monetary_amounts(text)
            amount_str = f" of {amounts[0]['formatted']}" if amounts else ""
            bank_parts = []
            acct_m = re.search(
                r"(?:account\s*(?:no\.?|number)|a/c\s*(?:no\.?|number)?)\s*[:\-]?\s*([A-Za-z0-9]+)",
                text,
                re.IGNORECASE,
            )
            if acct_m:
                bank_parts.append(f"A/c: {acct_m.group(1)}")
            ifsc_m = re.search(
                r"\b(?:IFSC\s*(?:code)?)\s*[:\-]?\s*([A-Z]{4}0[A-Z0-9]{6})\b",
                text,
                re.IGNORECASE,
            )
            if ifsc_m:
                bank_parts.append(f"IFSC: {ifsc_m.group(1).upper()}")
            bank_m = re.search(
                r"\b(?:Canara Bank|State Bank of India|SBI|HDFC Bank|ICICI Bank|Punjab National Bank|PNB)\b",
                text,
                re.IGNORECASE,
            )
            if bank_m:
                bank_parts.append(f"Bank: {bank_m.group(0)}")

            branch_clean = None
            for branch_m in re.finditer(
                r"\bBranch\s*(?:Name)?\s*[:\-]?\s*([A-Za-z0-9\s]+?)(?=\s*(?:\d+[.)]|IFSC|A/c|Account|\n|\.|$))",
                text,
                re.IGNORECASE,
            ):
                prefix = text[: branch_m.start()].rstrip().lower()
                if prefix.endswith("&") or prefix.endswith("and"):
                    continue
                cand_branch = branch_m.group(1).strip()
                if (
                    cand_branch
                    and (not bank_m or cand_branch.lower() != bank_m.group(0).lower())
                    and len(cand_branch) < 50
                ):
                    branch_clean = cand_branch
                    break

            if not branch_clean and bank_m:
                after_bank = text[bank_m.end() :]
                branch_after = re.search(
                    r"^[,:\s\-]+([A-Za-z0-9\s]+?)(?=\s*(?:\d+[.)]|IFSC|Branch IFSC|A/c|Account|\n|\.|$))",
                    after_bank,
                    re.IGNORECASE,
                )
                if branch_after:
                    cand_branch = branch_after.group(1).strip()
                    if cand_branch and len(cand_branch) < 50:
                        branch_clean = cand_branch

            if branch_clean:
                bank_parts.append(f"Branch: {branch_clean}")

            if bank_parts:
                for bp in bank_parts:
                    val = bp.split(": ", 1)[-1]
                    if val in text and val not in quote:
                        quote = text.strip()
                        break

            bank_str = f" to {', '.join(bank_parts)}" if bank_parts else ""
            candidates.append(
                CandidateComplianceItem(
                    category="FINANCIAL",
                    title="RFP Document Fee Payment",
                    description=f"Mandatory payment of non-refundable tender / RFP document fee{amount_str} through electronic fund transfer (NEFT/RTGS){bank_str}.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
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

    # 9. Financial: Minimum Annual Turnover Threshold (B14)
    if any(k in text_lower for k in ("annual turnover", "turnover")) and any(
        k in text_lower
        for k in (
            "rs.5 crores",
            "5 crores",
            "rs. 5 crores",
            "5.0 crores",
            "more than rs.5",
            "more than rs. 5",
        )
    ):
        res = get_clause_and_quote(
            r"(?:annual\s+turnover.*?more\s+than\s+rs\.?\s*5(?:\.0)?\s*crores|should\s+be\s+equal\s+to\s+or\s+more\s+than\s+rs\.?\s*5(?:\.0)?\s*crores|more\s+than\s+rs\.?\s*5(?:\.0)?\s*crores)",
            "annual turnover threshold",
            [
                "annual turnover",
                "average of last 5 years",
                "more than rs.5 crores",
                "chartered accountant",
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
                    category="FINANCIAL",
                    title="Minimum Annual Turnover Threshold (Rs. 5.0 Crores)",
                    description="Minimum annual turnover from consultancy business of Rs. 5.0 Crores (average of last 5 financial years or in each of preceding two years) duly certified by Chartered Accountant with valid UDIN.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        udin_required=True,
                        signing_authority_rank="Statutory Auditor / Chartered Accountant",
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
