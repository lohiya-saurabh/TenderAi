from __future__ import annotations

from tenderpulse_ai.domain.models import (
    CandidateComplianceItem,
    ExecutionRulesProps,
    ProvenanceProps,
)
from tenderpulse_ai.extraction.metrics import extract_temporal_durations
from tenderpulse_ai.extraction.rules.base import get_clause_and_quote


def extract_operational_rules(
    doc_id: str,
    page_no: int,
    text: str,
    text_lower: str,
    clause_ref: str,
) -> list[CandidateComplianceItem]:
    candidates: list[CandidateComplianceItem] = []

    # 1. Operational: Data Lake Portal & Digital Communications
    if any(k in text_lower for k in ("data lake portal", "data lake", "pmis portal")) and any(
        k in text_lower
        for k in ("contractual correspondence", "communicate with nhai", "portal available on")
    ):
        res = get_clause_and_quote(
            r"(?:data lake portal.*?contractual correspondence|use the link .*?data lake portal)",
            "data lake",
            ["data lake portal", "contractual correspondence", "nhai website"],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            candidates.append(
                CandidateComplianceItem(
                    category="OPERATIONAL",
                    title="Data Lake Portal Utilization for Contractual Correspondence",
                    description="Mandatory utilization of Client Data Lake Portal for all formal contractual correspondence, project deliverables, and monitoring.",
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

    # 2. Operational: Assignment Duration & Service Period
    if any(
        k in text_lower
        for k in (
            "total time period for the assignment",
            "period for the assignment as",
            "period of assignment will be",
        )
    ):
        res = get_clause_and_quote(
            r"(?:total time period for the assignment.*?will be for \d+\s*months|time period for the assignment)",
            "period of assignment",
            ["total time period for the assignment", "will be for", "months"],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            durations = extract_temporal_durations(quote)
            dur_text = (
                f"{durations[0]['value']}-{durations[0]['unit'].capitalize()}"
                if durations
                else "Stipulated Period"
            )
            candidates.append(
                CandidateComplianceItem(
                    category="OPERATIONAL",
                    title="Assignment Duration & Period of Service",
                    description=f"Commitment to mobilize and perform consultancy supervision services for the entire {dur_text} contract duration.",
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

    # 3. Operational: Monthly Progress Report (MPR) Submission SLA (B3)
    if "monthly progress report" in text_lower or (
        "mpr" in text_lower and any(k in text_lower for k in ("within a period of 7 days", "pmis"))
    ):
        res = get_clause_and_quote(
            r"(?:monthly progress report \(mpr\) within a period of 7 days|monthly progress report)",
            "mpr submission",
            ["monthly progress report", "period of 7 days", "pmis substantially in the format"],
            text,
            text_lower,
            page_no,
            clause_ref,
        )
        if res:
            quote, ref, conf = res
            candidates.append(
                CandidateComplianceItem(
                    category="OPERATIONAL",
                    title="Monthly Progress Report (MPR) Submission SLA",
                    description="Mandatory submission and upload of Monthly Progress Reports (MPR) and project monitoring data to NHAI PMIS portal within 7 days from the close of each calendar month in prescribed Annexure-III format.",
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

    # 4. Operational: Wayside Amenities, Toll Plaza ETC, ATMS & Incident Log-Book Inspection SLA (B27)
    if "wayside amenities" in text_lower and any(
        k in text_lower for k in ("fee plaza", "atms", "incident management")
    ):
        res = get_clause_and_quote(
            r"(?:inspect and monitor the wayside amenities.*?atms|wayside amenities)",
            "wayside amenities",
            [
                "inspect and monitor the wayside amenities",
                "electronic toll collection",
                "verification of log-books",
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
                    category="OPERATIONAL",
                    title="Wayside Amenities, Toll Plaza ETC, ATMS & Incident Log-Book Inspection SLA",
                    description="Mandatory operational monitoring and inspection of Wayside Amenities, Electronic Toll Collection (ETC), Fee Plazas, ATMS systems, and log-book verification of incident management vehicles.",
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

    return candidates
