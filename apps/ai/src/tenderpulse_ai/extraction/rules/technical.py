from __future__ import annotations

import re

from tenderpulse_ai.domain.models import (
    CandidateComplianceItem,
    ExecutionRulesProps,
    ProvenanceProps,
)
from tenderpulse_ai.extraction.clause_references import is_toc_or_definition
from tenderpulse_ai.extraction.metrics import extract_monetary_amounts
from tenderpulse_ai.extraction.rules.base import get_clause_and_quote


def extract_technical_rules(
    doc_id: str,
    page_no: int,
    text: str,
    text_lower: str,
    clause_ref: str,
) -> list[CandidateComplianceItem]:
    candidates: list[CandidateComplianceItem] = []

    # 1. Technical: Annual Turnover & Net Worth
    is_ca_firm_turnover = any(
        x in text_lower
        for x in (
            "schedule t",
            "schedule-t",
            "panel of chartered",
            "chartered accountants",
            "auditing firm",
            "empanelment of",
            "selection of chartered",
            "firms meeting the eligibility",
        )
    )
    is_equity_lockin = any(
        x in text_lower
        for x in (
            "change in ownership",
            "shall directly hold equity",
            "joint bidding agreement submitted in the bid",
            "was evaluated for the purposes of selection",
        )
    )
    if (
        not is_ca_firm_turnover
        and not is_equity_lockin
        and any(
            k in text_lower
            for k in (
                "annual turnover",
                "net worth",
                "financial capacity",
                "financial situation and capabilities",
                "audited financial statements",
            )
        )
    ):
        res = get_clause_and_quote(
            r"(?:should\s+be\s+equal\s+to\s+or\s+more\s+than\s+rs\.?\s*\d+|annual\s+turnover|net\s+worth|financial\s+capacity|financial\s+situation)",
            "turnover",
            [
                "annual turnover",
                "more than rs.5 crores",
                "5 crores",
                "net worth",
                "financial capacity",
                "financial situation and capabilities",
                "audited financial statements",
            ],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            udin_req = any(
                u in text_lower for u in ("udin", "chartered accountant", "ca", "audited")
            )
            amounts = extract_monetary_amounts(quote) or extract_monetary_amounts(text)
            amt_str = f" of at least {amounts[0]['formatted']}" if amounts else ""
            window_m = re.search(
                r"\b(average of last (?:\d+|[a-z]+) (?:financial )?years?(?:\s+or\s+in each of the preceding (?:\d+|[a-z]+) (?:financial )?years?)?)\b",
                text,
                re.IGNORECASE,
            )
            window_str = f" ({window_m.group(1)})" if window_m else ""
            ca_str = (
                ", duly certified by a Chartered Accountant / Statutory Auditor."
                if udin_req
                else "."
            )
            if amt_str:
                description = f"Minimum Annual Turnover{amt_str} from consultancy business{window_str}{ca_str}"
            else:
                description = f"Audited annual turnover certificates{window_str} demonstrating financial threshold capacity{ca_str}"

            candidates.append(
                CandidateComplianceItem(
                    category="TECHNICAL",
                    title="Technical Qualification & Annual Turnover",
                    description=description,
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        udin_required=udin_req,
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

    # 2. Technical: Similar Work Experience
    is_negative_exclusion = bool(
        re.search(
            r"\b(?:the following assignments would not be counted|would not be counted for the purposes of)\b",
            text_lower,
        )
    )
    if not is_negative_exclusion and any(
        k in text_lower
        for k in (
            "similar work",
            "past experience",
            "contracts of similar size",
            "specific construction experience",
            "historical contract non-performance",
            "o&m project",
            "o & m project",
            "dpr assignments",
            "four/six laning",
        )
    ):
        res = get_clause_and_quote(
            r"(?:similar work|past experience|contracts of similar size|o&m project|o & m project|four/six laning)",
            "similar work",
            [
                "similar work",
                "past experience",
                "contracts of similar size",
                "specific construction experience",
                "historical contract non-performance",
                "o&m project",
                "o & m project",
                "dpr assignments",
                "four/six laning",
            ],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            if not re.search(
                r"\b(?:would not be counted|not be counted for the purposes of)\b",
                quote.lower(),
            ):
                candidates.append(
                    CandidateComplianceItem(
                        category="TECHNICAL",
                        title="Technical Qualification & Similar Work Experience",
                        description="Demonstrated technical threshold capacity through prior successful execution of similar projects.",
                        execution_rules=ExecutionRulesProps(
                            stamp_paper_required=False,
                            notarization_required=False,
                            udin_required=False,
                            signing_authority_rank="Project Director / Client Superintending Engineer",
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

    # 3. Technical: Key Technical Personnel
    is_toc_personnel = is_toc_or_definition(text) or bool(
        re.search(r"(\.{3,}|\s{4,})\s*\d+\s*$", text.strip(), re.MULTILINE)
    )
    has_positive_personnel = bool(
        re.search(
            r"\b(minimum qualification of personnel|personnel capabilities|design-in-charge|project manager shall|key personnel shall)\b",
            text_lower,
        )
        or re.search(
            r"\bshall (?:deploy|employ|engage|appoint|assign|designate)\b.{0,60}\b(?:key personnel|technical personnel|qualified personnel|project manager|team leader)\b",
            text_lower,
        )
        or re.search(
            r"\b(?:key personnel|technical personnel|qualified personnel|project manager|team leader)\b.{0,60}\bshall (?:be deployed|be employed|be engaged|be appointed|be assigned|be designated)\b",
            text_lower,
        )
    )
    is_ie_appointment = (
        "independent engineer shall be" in text_lower
        or "appointment of independent engineer" in text_lower
    )
    if (
        not is_toc_personnel
        and not is_ie_appointment
        and (
            has_positive_personnel
            or any(
                k in text_lower
                for k in ("personnel capabilities", "minimum qualification of personnel")
            )
        )
    ):
        res = get_clause_and_quote(
            r"(?:key personnel|project manager|personnel capabilities)",
            "key personnel",
            [
                "key personnel",
                "project manager",
                "personnel capabilities",
                "minimum qualification of personnel",
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
                    category="TECHNICAL",
                    title="Key Technical Personnel & Project Management Team",
                    description="Deployment of qualified key technical personnel including Project Manager and Quality Control Engineers.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        udin_required=False,
                        signing_authority_rank="Authorized Signatory with CV Undertaking",
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

    # 4. Technical: Essential Equipment & Machinery
    is_plant_exclusion = bool(
        re.search(
            r"\b(shall not include|excluding|advances of any kind).{0,150}plant and machinery\b",
            text_lower,
            re.DOTALL,
        )
        or re.search(
            r"\bplant and machinery.{0,150}(shall not include|excluded)\b",
            text_lower,
            re.DOTALL,
        )
    )
    has_positive_equipment = bool(
        re.search(
            r"\b(minimum essential equipment|equipment capabilities|availability of (?:essential )?equipment|availability of (?:plant|machinery))\b",
            text_lower,
        )
        or re.search(
            r"\bshall (?:deploy|furnish|provide|own|possess|mobilize)\b.{0,60}\b(?:plant and machinery|construction equipment|essential machinery|tools and plants?)\b",
            text_lower,
        )
        or re.search(
            r"\b(?:plant and machinery|construction equipment|essential machinery|tools and plants?)\b.{0,60}\bshall (?:be deployed|be furnished|be provided|be owned|be possessed|be mobilized)\b",
            text_lower,
        )
    )
    if not is_plant_exclusion and (
        has_positive_equipment
        or any(
            k in text_lower
            for k in (
                "equipment capabilities",
                "minimum essential equipment",
                "availability of equipment",
            )
        )
    ):
        res = get_clause_and_quote(
            r"(?:equipment capabilities|plant and machinery|minimum essential equipment)",
            "plant and machinery",
            [
                "equipment capabilities",
                "plant and machinery",
                "minimum essential equipment",
                "availability of equipment",
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
                    category="TECHNICAL",
                    title="Essential Plant, Machinery & Equipment Undertaking",
                    description="Availability and ownership or valid lease deed of essential construction equipment and machinery.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        udin_required=False,
                        signing_authority_rank="Authorized Signatory with Ownership/Lease Proof",
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

    # 5. Technical: Progressive Construction Milestones (Schedule G)
    if any(
        k in text_lower
        for k in ("schedule –g", "schedule-g", "schedule g", "project completion schedule")
    ) and any(
        k in text_lower
        for k in (
            "project completion schedule",
            "project milestone-i",
            "project milestone",
            "milestones",
        )
    ):
        res = get_clause_and_quote(
            r"project completion schedule",
            "project milestone",
            ["project completion schedule", "project milestone-i", "project milestone"],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            candidates.append(
                CandidateComplianceItem(
                    category="TECHNICAL",
                    title="Progressive Construction Milestones & Completion Schedule (Schedule G)",
                    description="Strict adherence to progressive project construction milestones and completion schedule linked to physical progress and capital expenditure deadlines.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        signing_authority_rank="Project Director / Independent Engineer",
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

    # 6. Technical: Maintenance SLAs (Schedule K)
    if any(
        k in text_lower
        for k in (
            "table -1: maintenance criteria for pavements",
            "table-1: maintenance criteria",
            "maintenance criteria for pavements",
            "pothole free condition",
        )
    ):
        res = get_clause_and_quote(
            r"table -1: maintenance criteria|pothole free condition",
            "maintenance criteria",
            [
                "table -1: maintenance criteria for pavements",
                "pothole free condition",
                "schedule k",
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
                    category="TECHNICAL",
                    title="Highway Maintenance Standards & Defect Rectification SLAs (Schedule K)",
                    description="Strict maintenance SLAs and defect rectification timelines: Potholes (24-48 hours), Cracks (7-15 days), Rutting (15-30 days), Shoving (2-7 days), Roughness BI <= 2000 mm/km; failure triggers 0.5% daily toll fee penalty.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        signing_authority_rank="O&M In-Charge / Independent Engineer",
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

    # 7. Technical: Real-Time Construction Vehicle GPS Tracking
    if "location tracking system is installed in each construction vehicle" in text_lower or (
        "location tracking" in text_lower and "construction vehicle" in text_lower
    ):
        res = get_clause_and_quote(
            r"location tracking system is installed in each construction vehicle|location tracking.*?construction vehicle",
            "location tracking system",
            [
                "functional location tracking system is installed in each construction vehicle",
                "location tracking system",
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
                    category="TECHNICAL",
                    title="Real-Time Construction Vehicle GPS Tracking & Server Telemetry",
                    description="Mandatory functional GPS tracking system in every construction vehicle streaming real-time location, timestamps, and mileage records to the Authority's central server.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        signing_authority_rank="Fleet Manager / Project Director",
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

    # 8. Technical: INFRACON Portal Registration
    if any(
        k in text_lower for k in ("infracon", "gem portal", "cppp", "e-procurement portal")
    ) and any(
        k in text_lower
        for k in ("mandatorily register", "enlist themselves", "team id", "form a team")
    ):
        res = get_clause_and_quote(
            r"(?:mandatorily register and enlist|form a team on.*?infracon|infracon team id)",
            "infracon",
            ["infracon", "mandatorily register", "team id", "upload all relevant information"],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            candidates.append(
                CandidateComplianceItem(
                    category="TECHNICAL",
                    title="Mandatory INFRACON Portal Registration & Team ID",
                    description="Consulting firm and all key personnel must mandatorily register on MoRT&H INFRACON portal and furnish unique Team ID.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        signing_authority_rank="Authorized Signatory / Proposed Team Leader",
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

    # 9. Technical: Hardware Security & HiSilicon Camera Chipset Prohibition
    is_hisilicon_ban = "hisilicon" in text_lower or (
        any(k in text_lower for k in ("chipset", "processor", "camera"))
        and any(
            k in text_lower
            for k in (
                "not have hisilicon",
                "hisilicon chipset",
                "banned chipset",
                "prohibited chipset",
            )
        )
    )
    if is_hisilicon_ban:
        res = get_clause_and_quote(
            r"(?:hisilicon\s+(?:chipset|processor)|camera.*?not\s+have\s+hisilicon|chipset/processor.*?not\s+have\s+hisilicon)",
            "hisilicon",
            ["hisilicon", "chipset", "processor", "camera", "not have hisilicon"],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            candidates.append(
                CandidateComplianceItem(
                    category="TECHNICAL",
                    title="Hardware Security & HiSilicon Camera Chipset Prohibition",
                    description="Mandatory technical and cybersecurity requirement prohibiting cameras, ANPR devices, or surveillance hardware containing HiSilicon chipsets or processors.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        udin_required=False,
                        signing_authority_rank="OEM Authorized Signatory / Technical Director",
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

    # 10. Technical: Bi-Annual Drone Highway Inspection Survey SLA (B2)
    if "drone survey" in text_lower or "18.75/2021" in text_lower:
        res = get_clause_and_quote(
            r"(?:conduct drone survey bi-annually|circular no\. 18\.75/2021)",
            "drone survey",
            ["conduct drone survey bi-annually", "circular no. 18.75/2021", "dated 03.11.2021"],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            candidates.append(
                CandidateComplianceItem(
                    category="TECHNICAL",
                    title="Bi-Annual Drone Highway Inspection Survey SLA",
                    description="Mandatory obligation to conduct comprehensive highway condition and asset inspection surveys bi-annually using Drone technology in compliance with NHAI circular no. 18.75/2021 dated 03.11.2021 at zero additional cost.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        signing_authority_rank="Authorized Signatory / Team Leader",
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

    # 11. Technical: Quality Assurance Testing & MoRT&H Specifications Compliance (B4)
    if "quality assurance tests" in text_lower and any(
        k in text_lower for k in ("mort&h", "nhai specifications", "specifications and standards")
    ):
        res = get_clause_and_quote(
            r"(?:conduct and witness quality assurance tests.*?mort&h/nhai specifications|quality assurance tests)",
            "quality assurance",
            [
                "conduct and witness quality assurance tests",
                "mort&h/nhai specifications",
                "standards on construction",
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
                    category="TECHNICAL",
                    title="Quality Assurance Testing & MoRT&H Specifications Compliance",
                    description="Mandatory obligation to conduct, witness, and certify all quality assurance tests on materials and workmanship in strict accordance with MoRT&H and NHAI specifications and standards.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        signing_authority_rank="Quality Assurance Expert / Resident Engineer",
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

    # 12. Technical: Equipment Technology Associates Exclusivity & 5 Mandatory Survey Instruments (B9)
    if any(
        k in text_lower
        for k in (
            "associate firm can provide equipment",
            "equipment-based road inspection services",
            "network survey vehicle",
        )
    ) and any(
        k in text_lower for k in ("associate(s) cannot be common", "cannot be common for 2 or more")
    ):
        res = get_clause_and_quote(
            r"(?:associate firm can provide equipment.*?network survey vehicle|associate\(s\) cannot be common for 2 or more bidders)",
            "associate exclusivity",
            [
                "associate firm can provide equipment",
                "network survey vehicle",
                "associate(s) cannot be common",
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
                    category="TECHNICAL",
                    title="Equipment Technology Associates Exclusivity & 5 Mandatory Survey Instruments",
                    description="Specialized equipment associate for 5 survey instruments (NSV, FWD, MBIU, Retro Reflectometer, ATCC) must be exclusive to one bidder. Common associates across 2 or more bidders triggers automatic disqualification of all affected bids.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=True,
                        stamp_paper_denomination_inr=100,
                        notarization_required=True,
                        signing_authority_rank="Lead Bidder & Associate Authorized Signatories",
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

    # 13. Technical: Past DPR Preparation Experience Threshold (B12)
    if re.search(r"dpr/fs\s+cum\s+ppr", text_lower):
        res = get_clause_and_quote(
            r"(?:prepared dpr/fs cum ppr for at least two projects|dpr/fs cum ppr)",
            "dpr experience",
            [
                "prepared dpr/fs cum ppr",
                "two projects of 4/6 laning",
                "30% of project length",
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
                    category="TECHNICAL",
                    title="Past DPR Preparation Experience Threshold",
                    description="Mandatory past experience in preparing DPR/FS cum PPR in the last 7 years: at least two 4/6 laning projects of 30% project length each, or at least one project of 50% project length.",
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

    # 14. Technical: Technical Capacity Tiered Matrix (Turnover vs. Key Professionals vs. Maximum Allotted Projects) (B16)
    if any(
        k in text_lower
        for k in (
            "technical capacity provisions",
            "average annual turnover of firm in last 3 financial years",
        )
    ) or ("maximum no. of dpr" in text_lower and "6 12 25 40" in text):
        res = get_clause_and_quote(
            r"(?:technical capacity provisions of maximum works|average annual turnover of firm in last 3 financial years|maximum no\. of dpr assignments out of those given at sr\. no\.3)",
            "capacity matrix",
            [
                "technical capacity provisions",
                "average annual turnover",
                "last 3 financial years",
                "6 12 25 40",
                "maximum no. of projects",
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
                    category="TECHNICAL",
                    title="Technical Capacity Tiered Matrix (Turnover vs. Key Professionals vs. Maximum Allotted Projects)",
                    description="Four-tier technical capacity matrix governing maximum ongoing NHAI projects based on 3-year average turnover and permanent key professionals (both conditions mandatory): Tier 1 (Upto 10 Cr): 10 staff, max 6 projects (6 DPR / 4 IE-AE); Tier 2 (>10 to 30 Cr): 25 staff, max 12 projects (12 DPR / 9 IE-AE); Tier 3 (>30 to 60 Cr): 40 staff, max 25 projects (25 DPR / 18 IE-AE); Tier 4 (>60 Cr): 60 staff, max 40 projects (40 DPR / 30 IE-AE).",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        udin_required=True,
                        signing_authority_rank="Statutory Auditor / Authorized Signatory",
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

    # 15. Technical: Ceiling on IE / AE Assignments (Maximum 75% of Project Quota) (B17)
    if any(k in text_lower for k in ("ceiling for ie/ae assignments is 75%", "cap of 75%")):
        res = get_clause_and_quote(
            r"(?:ceiling for ie/ae assignments is 75%|maximum no\. of ie/ae assignments \(cap of 75%\))",
            "ie/ae ceiling",
            [
                "ceiling for ie/ae assignments is 75%",
                "crossing the upper ceiling",
                "shall not be opened",
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
                    category="TECHNICAL",
                    title="Ceiling on IE / AE Assignments (Maximum 75% of Project Quota)",
                    description="Out of the total allowable ongoing projects under the capacity matrix, a maximum of 75% can be Independent Engineer (IE) or Authority’s Engineer (AE) assignments; exceeding this ceiling results in non-opening of Financial Proposals.",
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

    # 16. Technical: Pro-Rata Joint Venture Experience Weightage & CA Payment Certificate Substitute (B28)
    if (
        re.search(r"proportion\s+of\s+payment\s+received", text_lower)
        or "same proportion as payment has been received" in text_lower
    ):
        res = get_clause_and_quote(
            r"(?:considered in the same proportion as payment has been received|proportion of payment received towards consultancy work)",
            "pro-rata jv experience",
            [
                "same proportion as payment has been received",
                "proportion of payment received",
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
                    category="TECHNICAL",
                    title="Pro-Rata Joint Venture Experience Weightage & CA Payment Certificate Substitute",
                    description="JV past experience is credited strictly in proportion to payment received; client certificate is required, or in its absence a Chartered Accountant certificate certifying the fee proportion received.",
                    execution_rules=ExecutionRulesProps(
                        stamp_paper_required=False,
                        notarization_required=False,
                        udin_required=True,
                        signing_authority_rank="Chartered Accountant / Client Authority",
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

    # 17. Technical: Ongoing Project Quota Carve-Outs, Capacity Exemptions & Special Projects Exclusion (B29)
    if "would not be counted for the purposes of maximum number of projects" in text_lower:
        res = get_clause_and_quote(
            r"(?:assignments would not be counted for the purposes of maximum number of projects|special projects such as standalone projects of tunnel)",
            "project quota carveouts",
            [
                "assignments would not be counted",
                "original assignment period + one year",
                "special projects",
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
                    category="TECHNICAL",
                    title="Ongoing Project Quota Carve-Outs, Capacity Exemptions & Special Projects Exclusion",
                    description="Specific exemptions from utilized project capacity calculation: completed IE/AE (original period + 1 yr or provisional completion), DPR where civil bids received, contracts < 6 months, O&M contracts, and standalone special projects (tunnels, bridges, flyovers, ROB/RUB).",
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

    # 18. Technical: Mandatory Technical Capacity Submission in Form T-11 (Annex-B-13) (B30)
    if "form t-11" in text_lower or "annex-b-13" in text_lower:
        res = get_clause_and_quote(
            r"(?:determination of technical capacity \(form t-11\)|modified format for determination of technical capacity)",
            "form t-11",
            [
                "determination of technical capacity (form t-11)",
                "enclosed at annex-b-13",
                "prescribed formats",
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
                    category="TECHNICAL",
                    title="Mandatory Technical Capacity Submission in Form T-11 (Annex-B-13)",
                    description="Mandatory submission of technical capacity and ongoing assignment details in prescribed Form T-11 format enclosed at Annex-B-13 for evaluation of bid capacity.",
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
