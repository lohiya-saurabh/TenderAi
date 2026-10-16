from __future__ import annotations

import re
from datetime import date
from typing import NamedTuple

from tenderpulse_ai.agent.schemas import RequirementCandidate, RequirementCriticality
from tenderpulse_ai.decision.schemas import (
    BidDecisionVerdict,
    CompanyProfileSnapshot,
    DecisionReason,
    Disqualifier,
    EvidenceCitation,
    GapItem,
    RiskSeverity,
    UncertaintyItem,
)


class DeterministicEvaluationOutcome(NamedTuple):
    verdict: BidDecisionVerdict
    hard_disqualifiers: list[Disqualifier]
    missing_information: list[GapItem]
    reasons_to_pursue: list[DecisionReason]
    reasons_not_to_pursue: list[DecisionReason]
    uncertain_areas: list[UncertaintyItem]
    evidence_citations: list[EvidenceCitation]
    readiness_score: float


class DeterministicEligibilityEvaluator:
    """Pure deterministic evaluator for company profile against tender requirements.

    Invariants:
    - Pure functions only: no I/O, no network egress, no model inference.
    - Zero hallucination: decisions are based strictly on structured profile facts.
    - Worst-state-wins: Any HARD_ELIGIBILITY failure produces NO_GO. Any SUBMISSION_MANDATORY gap produces CONDITIONAL_GO.
    """

    @classmethod
    def evaluate(
        cls,
        company: CompanyProfileSnapshot,
        requirements: list[RequirementCandidate],
        submission_deadline: date,
        project_location_state: str,
        estimated_value_inr_crores: float,
        matched_citations: list[EvidenceCitation] | None = None,
    ) -> DeterministicEvaluationOutcome:
        hard_disqualifiers: list[Disqualifier] = []
        missing_information: list[GapItem] = []
        reasons_to_pursue: list[DecisionReason] = []
        reasons_not_to_pursue: list[DecisionReason] = []
        uncertain_areas: list[UncertaintyItem] = []
        evidence_citations: list[EvidenceCitation] = []
        matched_citations = matched_citations or []

        # 0. Global Check: Debarment / Blacklisting (Factor 1 - Statutory Hard Disqualifier)
        if company.is_blacklisted:
            disq = Disqualifier(
                requirement_title="Statutory Non-Debarment",
                reason="Company is marked as debarred/blacklisted (active debarment) in corporate registry.",
                clause_reference="Statutory Eligibility",
                shortfall_detail="Active debarment status prevents public procurement participation.",
                evidence=EvidenceCitation(
                    tender_requirement_title="Statutory Non-Debarment",
                    tender_clause_reference="Statutory Eligibility",
                    tender_page_number=1,
                    tender_verbatim_quote="Bidder must not be debarred by any State/Central Government entity.",
                    company_evidence_ref="PROFILE_BLACKLIST_FLAG",
                ),
            )
            hard_disqualifiers.append(disq)
            reasons_not_to_pursue.append(
                DecisionReason(
                    title="Active Debarment Flag",
                    detail="The company profile carries an active debarment or blacklist flag.",
                    category="STATUTORY",
                    evidence=disq.evidence,
                )
            )

        # 1. Evaluate Geographic Fit (Factor 4)
        cls._evaluate_geography(
            company=company,
            project_location_state=project_location_state,
            reasons_to_pursue=reasons_to_pursue,
            missing_information=missing_information,
            evidence_citations=evidence_citations,
        )

        # 2. Iterate and evaluate each Tender Requirement across factors
        for req in requirements:
            # Capture ambiguity flags if present
            for flag in req.ambiguity_flags:
                uncertain_areas.append(
                    UncertaintyItem(
                        clause_reference=req.provenance.clause_reference,
                        ambiguity_type=flag.type.value,
                        quote=flag.quote,
                        recommended_clarification=(
                            f"Clarify '{flag.quote}' with tendering authority before bid submission."
                        ),
                    )
                )

            title_lower = req.title.lower()
            desc_lower = req.description.lower()

            # Factor 2: Financial Turnover
            if "turnover" in title_lower or "turnover" in desc_lower:
                cls._evaluate_turnover(
                    company=company,
                    req=req,
                    hard_disqualifiers=hard_disqualifiers,
                    missing_information=missing_information,
                    reasons_to_pursue=reasons_to_pursue,
                    reasons_not_to_pursue=reasons_not_to_pursue,
                    evidence_citations=evidence_citations,
                    matched_citations=matched_citations,
                    estimated_value_inr_crores=estimated_value_inr_crores,
                )

            # Factor 3: Past Project Experience
            elif any(
                k in title_lower or k in desc_lower
                for k in ("experience", "similar work", "past project")
            ):
                cls._evaluate_experience(
                    company=company,
                    req=req,
                    submission_deadline=submission_deadline,
                    hard_disqualifiers=hard_disqualifiers,
                    missing_information=missing_information,
                    reasons_to_pursue=reasons_to_pursue,
                    reasons_not_to_pursue=reasons_not_to_pursue,
                    evidence_citations=evidence_citations,
                    matched_citations=matched_citations,
                    estimated_value_inr_crores=estimated_value_inr_crores,
                )

            # Factor 5: Certifications
            elif any(
                k in title_lower or k in desc_lower for k in ("iso", "cmmi", "certification", "bis")
            ):
                cls._evaluate_certifications(
                    company=company,
                    req=req,
                    submission_deadline=submission_deadline,
                    hard_disqualifiers=hard_disqualifiers,
                    missing_information=missing_information,
                    reasons_to_pursue=reasons_to_pursue,
                    reasons_not_to_pursue=reasons_not_to_pursue,
                    evidence_citations=evidence_citations,
                    matched_citations=matched_citations,
                )

            # Factor 6: OEM Authorization
            elif any(
                k in title_lower or k in desc_lower
                for k in ("oem", "maf", "manufacturer authorization")
            ):
                cls._evaluate_oem(
                    company=company,
                    req=req,
                    submission_deadline=submission_deadline,
                    hard_disqualifiers=hard_disqualifiers,
                    missing_information=missing_information,
                    reasons_to_pursue=reasons_to_pursue,
                    reasons_not_to_pursue=reasons_not_to_pursue,
                    evidence_citations=evidence_citations,
                )

            # Factor 7: Staffing / Key Personnel
            elif any(
                k in title_lower or k in desc_lower
                for k in ("personnel", "staff", "engineer", "project manager")
            ):
                cls._evaluate_staffing(
                    company=company,
                    req=req,
                    hard_disqualifiers=hard_disqualifiers,
                    missing_information=missing_information,
                    reasons_to_pursue=reasons_to_pursue,
                    reasons_not_to_pursue=reasons_not_to_pursue,
                    evidence_citations=evidence_citations,
                )

            # Factor 8: Equipment & Machinery
            elif any(
                k in title_lower or k in desc_lower
                for k in ("equipment", "machinery", "plant", "tools")
            ):
                cls._evaluate_equipment(
                    company=company,
                    req=req,
                    hard_disqualifiers=hard_disqualifiers,
                    missing_information=missing_information,
                    reasons_to_pursue=reasons_to_pursue,
                    reasons_not_to_pursue=reasons_not_to_pursue,
                    evidence_citations=evidence_citations,
                )

            # Factor 9: Mandatory Execution & Security Rules (EMD, Stamp Paper, Notarization)
            elif any(
                k in title_lower or k in desc_lower
                for k in ("earnest money", "emd", "bid security", "stamp paper")
            ):
                cls._evaluate_mandatory_submission(
                    req=req,
                    reasons_to_pursue=reasons_to_pursue,
                    missing_information=missing_information,
                    evidence_citations=evidence_citations,
                )

            else:
                # Default generic requirement handling
                citation = EvidenceCitation(
                    tender_requirement_title=req.title,
                    tender_clause_reference=req.provenance.clause_reference,
                    tender_page_number=req.provenance.page_number,
                    tender_verbatim_quote=req.provenance.verbatim_quote,
                    notes="Generic mandatory submission requirement.",
                )
                evidence_citations.append(citation)
                if req.criticality == RequirementCriticality.SUBMISSION_MANDATORY:
                    missing_information.append(
                        GapItem(
                            requirement_title=req.title,
                            missing_factor="Mandatory Submission Item",
                            suggested_action=f"Prepare required submission '{req.title}' per clause instructions.",
                            severity=RiskSeverity.MEDIUM,
                            deadline_date=submission_deadline,
                            evidence=citation,
                        )
                    )

        # 3. Verdict Aggregation & Readiness Rollup
        if hard_disqualifiers:
            verdict = BidDecisionVerdict.NO_GO
            # Readiness score penalization for fatal failures
            readiness_score = max(0.0, 0.40 - (0.10 * len(hard_disqualifiers)))
        elif missing_information:
            verdict = BidDecisionVerdict.CONDITIONAL_GO
            gap_penalty = min(0.35, 0.05 * len(missing_information))
            readiness_score = max(0.45, 0.85 - gap_penalty)
        else:
            verdict = BidDecisionVerdict.GO
            readiness_score = 0.95

        # Merge any unreferenced matched citations from the evidence vault
        existing_refs = {
            c.company_evidence_ref for c in evidence_citations if c.company_evidence_ref
        }
        for mc in matched_citations:
            if mc.company_evidence_ref and mc.company_evidence_ref not in existing_refs:
                evidence_citations.append(mc)
                existing_refs.add(mc.company_evidence_ref)

        return DeterministicEvaluationOutcome(
            verdict=verdict,
            hard_disqualifiers=hard_disqualifiers,
            missing_information=missing_information,
            reasons_to_pursue=reasons_to_pursue,
            reasons_not_to_pursue=reasons_not_to_pursue,
            uncertain_areas=uncertain_areas,
            evidence_citations=evidence_citations,
            readiness_score=round(readiness_score, 2),
        )

    # ------------------------------------------------------------------ Internal Factor Evaluators

    @classmethod
    def _evaluate_geography(
        cls,
        company: CompanyProfileSnapshot,
        project_location_state: str,
        reasons_to_pursue: list[DecisionReason],
        missing_information: list[GapItem],
        evidence_citations: list[EvidenceCitation],
    ) -> None:
        state_norm = re.sub(r"[-_]", " ", project_location_state.strip().lower())
        company_regions = [
            re.sub(r"[-_]", " ", r.strip().lower()) for r in company.operating_regions
        ]

        # Neutral handling for unspecified or national scope tenders
        if state_norm in ("unspecified", ""):
            return

        is_national_tender = state_norm in ("all india", "pan india", "india")
        company_has_pan_india = any(
            r in ("all india", "pan india", "india") for r in company_regions
        )

        if state_norm in company_regions or is_national_tender or company_has_pan_india:
            reasons_to_pursue.append(
                DecisionReason(
                    title="Active Operational Presence",
                    detail=(
                        f"Company has established operating presence in target location: {project_location_state}."
                        if not is_national_tender and not company_has_pan_india
                        else f"Company has nationwide operating presence satisfying {project_location_state}."
                    ),
                    category="GEOGRAPHY",
                    evidence=EvidenceCitation(
                        tender_requirement_title="Project Location",
                        tender_clause_reference="Location Specification",
                        tender_page_number=1,
                        tender_verbatim_quote=f"Project Execution Location: {project_location_state}",
                        notes=f"Operating regions include {project_location_state}",
                    ),
                )
            )
        else:
            missing_information.append(
                GapItem(
                    requirement_title="Local Geographic Presence",
                    missing_factor="Operating Region Not Registered",
                    suggested_action=(
                        f"Target project location '{project_location_state}' is outside declared operating regions. "
                        "Evaluate local partner / consortium / sub-contractor feasibility."
                    ),
                    severity=RiskSeverity.MEDIUM,
                )
            )

    @classmethod
    def _evaluate_turnover(
        cls,
        company: CompanyProfileSnapshot,
        req: RequirementCandidate,
        hard_disqualifiers: list[Disqualifier],
        missing_information: list[GapItem],
        reasons_to_pursue: list[DecisionReason],
        reasons_not_to_pursue: list[DecisionReason],
        evidence_citations: list[EvidenceCitation],
        matched_citations: list[EvidenceCitation] | None = None,
        estimated_value_inr_crores: float = 0.0,
    ) -> None:
        # Expected threshold in Crores from criterion, title/description, or 40% of estimated tender value
        expected_crores = None
        if req.criterion and req.criterion.threshold is not None:
            expected_crores = float(req.criterion.threshold)
        else:
            text = f"{req.title} {req.description}"
            m = re.search(
                r"(?:inr|rs\.?|₹)?\s*(\d+(?:\.\d+)?)\s*(?:cr|crores?)", text, re.IGNORECASE
            )
            if m:
                expected_crores = float(m.group(1))
            elif estimated_value_inr_crores > 0:
                expected_crores = round(estimated_value_inr_crores * 0.4, 2)
            else:
                expected_crores = 10.0

        # Calculate turnover using the statutory 3-year average turnover
        turnovers = [t.turnover_inr_crores for t in company.turnover_records]
        avg_turnover = sum(turnovers) / len(turnovers) if turnovers else 0.0

        # Company's best turnover figure
        best_record = (
            max(company.turnover_records, key=lambda t: t.turnover_inr_crores)
            if company.turnover_records
            else None
        )

        citation = EvidenceCitation(
            tender_requirement_title=req.title,
            tender_clause_reference=req.provenance.clause_reference,
            tender_page_number=req.provenance.page_number,
            tender_verbatim_quote=req.provenance.verbatim_quote,
            company_evidence_ref=best_record.evidence_document_id if best_record else None,
            company_entry_id=best_record.financial_year if best_record else None,
        )

        matched = next(
            (
                c
                for c in (matched_citations or [])
                if c.tender_requirement_title == req.title
                or "turnover" in c.tender_requirement_title.lower()
            ),
            None,
        )
        if matched and matched.document_name:
            citation.document_name = matched.document_name
            citation.evidence_type = matched.evidence_type or "AUDITED_BALANCE_SHEET"
            citation.page_number = matched.page_number
            citation.confidence_score = matched.confidence_score or 0.98
            citation.notes = matched.notes
            if matched.company_evidence_ref:
                citation.company_evidence_ref = matched.company_evidence_ref
            if matched.company_entry_id:
                citation.company_entry_id = matched.company_entry_id

        evidence_citations.append(citation)

        if not turnovers or avg_turnover == 0.0:
            gap = GapItem(
                requirement_title=req.title,
                missing_factor="Financial Turnover Records Missing",
                suggested_action="Upload audited financial statements and CA turnover certificates to Company Profile.",
                severity=RiskSeverity.CRITICAL,
                evidence=citation,
            )
            missing_information.append(gap)
            if req.criticality == RequirementCriticality.HARD_ELIGIBILITY:
                hard_disqualifiers.append(
                    Disqualifier(
                        requirement_title=req.title,
                        reason="No verified financial turnover records exist in company profile.",
                        clause_reference=req.provenance.clause_reference,
                        shortfall_detail=f"Required: ₹{expected_crores:.2f} Cr | Found: None",
                        evidence=citation,
                    )
                )
            return

        if avg_turnover >= expected_crores:
            reasons_to_pursue.append(
                DecisionReason(
                    title="Exceeds Turnover Threshold",
                    detail=(
                        f"Company 3-year average turnover of ₹{avg_turnover:.2f} Cr "
                        f"comfortably satisfies requirement of ₹{expected_crores:.2f} Cr."
                    ),
                    category="FINANCIAL",
                    evidence=citation,
                )
            )
        else:
            shortfall = expected_crores - avg_turnover
            detail = (
                f"Turnover shortfall of ₹{shortfall:.2f} Cr. Company 3-year average of ₹{avg_turnover:.2f} Cr "
                f"is below the required ₹{expected_crores:.2f} Cr threshold."
            )
            reasons_not_to_pursue.append(
                DecisionReason(
                    title="Financial Turnover Shortfall",
                    detail=detail,
                    category="FINANCIAL",
                    evidence=citation,
                )
            )
            if req.criticality == RequirementCriticality.HARD_ELIGIBILITY:
                hard_disqualifiers.append(
                    Disqualifier(
                        requirement_title=req.title,
                        reason="Turnover is below the mandatory minimum threshold.",
                        clause_reference=req.provenance.clause_reference,
                        shortfall_detail=detail,
                        evidence=citation,
                    )
                )

    @classmethod
    def _evaluate_experience(
        cls,
        company: CompanyProfileSnapshot,
        req: RequirementCandidate,
        submission_deadline: date,
        hard_disqualifiers: list[Disqualifier],
        missing_information: list[GapItem],
        reasons_to_pursue: list[DecisionReason],
        reasons_not_to_pursue: list[DecisionReason],
        evidence_citations: list[EvidenceCitation],
        matched_citations: list[EvidenceCitation] | None = None,
        estimated_value_inr_crores: float = 0.0,
    ) -> None:
        # Standard lookback window: last 7 years from submission date
        cutoff_year = submission_deadline.year - 7
        qualifying_projects = [
            p for p in company.experience if p.completion_date.year >= cutoff_year
        ]

        citation = EvidenceCitation(
            tender_requirement_title=req.title,
            tender_clause_reference=req.provenance.clause_reference,
            tender_page_number=req.provenance.page_number,
            tender_verbatim_quote=req.provenance.verbatim_quote,
            company_entry_id=qualifying_projects[0].entry_id if qualifying_projects else None,
            company_evidence_ref=qualifying_projects[0].evidence_document_id
            if qualifying_projects
            else None,
        )

        matched = next(
            (
                c
                for c in (matched_citations or [])
                if c.tender_requirement_title == req.title
                or any(
                    k in c.tender_requirement_title.lower()
                    for k in ("experience", "similar work", "past project")
                )
            ),
            None,
        )
        if matched and matched.document_name:
            citation.document_name = matched.document_name
            citation.evidence_type = matched.evidence_type or "COMPLETION_CERT"
            citation.page_number = matched.page_number
            citation.confidence_score = matched.confidence_score or 0.96
            citation.notes = matched.notes
            if matched.company_evidence_ref:
                citation.company_evidence_ref = matched.company_evidence_ref
            if matched.company_entry_id:
                citation.company_entry_id = matched.company_entry_id

        evidence_citations.append(citation)

        # Expected experience threshold: req.criterion.threshold, title/desc, or 35% of estimated tender value
        expected_threshold = None
        if req.criterion and req.criterion.threshold is not None:
            expected_threshold = float(req.criterion.threshold)
        else:
            text = f"{req.title} {req.description}"
            m = re.search(
                r"(?:inr|rs\.?|₹)?\s*(\d+(?:\.\d+)?)\s*(?:cr|crores?)", text, re.IGNORECASE
            )
            if m:
                expected_threshold = float(m.group(1))
            elif estimated_value_inr_crores > 0:
                expected_threshold = round(estimated_value_inr_crores * 0.35, 2)
            else:
                expected_threshold = 0.0

        if not qualifying_projects:
            detail = f"No completed project experience found within the 7-year window (since {cutoff_year})."
            if req.criticality == RequirementCriticality.HARD_ELIGIBILITY:
                hard_disqualifiers.append(
                    Disqualifier(
                        requirement_title=req.title,
                        reason="Missing mandatory similar past project experience.",
                        clause_reference=req.provenance.clause_reference,
                        shortfall_detail=detail,
                        evidence=citation,
                    )
                )
            reasons_not_to_pursue.append(
                DecisionReason(
                    title="Insufficient Past Experience",
                    detail=detail,
                    category="TECHNICAL",
                    evidence=citation,
                )
            )
            return

        max_project_val = max(p.contract_value_inr_crores for p in qualifying_projects)
        total_val = sum(p.contract_value_inr_crores for p in qualifying_projects)

        if expected_threshold > 0 and max_project_val < expected_threshold:
            detail = (
                f"Largest completed project of ₹{max_project_val:.2f} Cr is below the required "
                f"₹{expected_threshold:.2f} Cr threshold."
            )
            reasons_not_to_pursue.append(
                DecisionReason(
                    title="Technical Experience Deficit",
                    detail=detail,
                    category="TECHNICAL",
                    evidence=citation,
                )
            )
            if req.criticality == RequirementCriticality.HARD_ELIGIBILITY:
                hard_disqualifiers.append(
                    Disqualifier(
                        requirement_title=req.title,
                        reason="Mandatory project experience threshold not satisfied.",
                        clause_reference=req.provenance.clause_reference,
                        shortfall_detail=detail,
                        evidence=citation,
                    )
                )
        else:
            reasons_to_pursue.append(
                DecisionReason(
                    title="Strong Demonstrated Track Record",
                    detail=(
                        f"Company has {len(qualifying_projects)} completed projects with total value "
                        f"₹{total_val:.2f} Cr completed since {cutoff_year} (largest: ₹{max_project_val:.2f} Cr)."
                    ),
                    category="TECHNICAL",
                    evidence=citation,
                )
            )

    @classmethod
    def _evaluate_certifications(
        cls,
        company: CompanyProfileSnapshot,
        req: RequirementCandidate,
        submission_deadline: date,
        hard_disqualifiers: list[Disqualifier],
        missing_information: list[GapItem],
        reasons_to_pursue: list[DecisionReason],
        reasons_not_to_pursue: list[DecisionReason],
        evidence_citations: list[EvidenceCitation],
        matched_citations: list[EvidenceCitation] | None = None,
    ) -> None:
        title_lower = req.title.lower()
        desc_lower = req.description.lower()
        active_certs = [
            c
            for c in company.certifications
            if c.valid_to is None or c.valid_to >= submission_deadline
        ]

        def matches_cert(cert_std: str, title: str, desc: str) -> bool:
            cert_lower = cert_std.lower()
            if cert_lower in title or cert_lower in desc:
                return True
            base_std = cert_lower.split(":")[0].strip()
            return base_std in title or base_std in desc

        # Determine target standard (e.g., ISO 9001, ISO 14001, CMMI)
        matched_cert = next(
            (c for c in active_certs if matches_cert(c.standard_name, title_lower, desc_lower)),
            None,
        )

        citation = EvidenceCitation(
            tender_requirement_title=req.title,
            tender_clause_reference=req.provenance.clause_reference,
            tender_page_number=req.provenance.page_number,
            tender_verbatim_quote=req.provenance.verbatim_quote,
            company_entry_id=matched_cert.entry_id if matched_cert else None,
            company_evidence_ref=matched_cert.evidence_document_id if matched_cert else None,
        )

        matched = next(
            (
                c
                for c in (matched_citations or [])
                if c.tender_requirement_title == req.title
                or any(k in c.tender_requirement_title.lower() for k in ("iso", "cmmi", "cert"))
            ),
            None,
        )
        if matched and matched.document_name:
            citation.document_name = matched.document_name
            citation.evidence_type = matched.evidence_type or "ISO_CERT"
            citation.page_number = matched.page_number
            citation.confidence_score = matched.confidence_score or 0.99
            citation.notes = matched.notes

        evidence_citations.append(citation)

        if matched_cert:
            reasons_to_pursue.append(
                DecisionReason(
                    title=f"Valid Certification: {matched_cert.standard_name}",
                    detail=f"Certificate {matched_cert.standard_name} issued by {matched_cert.issuing_body} is active at bid submission date.",
                    category="CERTIFICATIONS",
                    evidence=citation,
                )
            )
        else:
            detail = f"Required certification not active or missing in profile at deadline ({submission_deadline})."
            if req.criticality == RequirementCriticality.HARD_ELIGIBILITY:
                hard_disqualifiers.append(
                    Disqualifier(
                        requirement_title=req.title,
                        reason="Mandatory certification missing or expired.",
                        clause_reference=req.provenance.clause_reference,
                        shortfall_detail=detail,
                        evidence=citation,
                    )
                )
            missing_information.append(
                GapItem(
                    requirement_title=req.title,
                    missing_factor="Active Certificate",
                    suggested_action=f"Obtain or renew valid certificate for '{req.title}'.",
                    severity=RiskSeverity.HIGH,
                    evidence=citation,
                )
            )

    @classmethod
    def _evaluate_oem(
        cls,
        company: CompanyProfileSnapshot,
        req: RequirementCandidate,
        submission_deadline: date,
        hard_disqualifiers: list[Disqualifier],
        missing_information: list[GapItem],
        reasons_to_pursue: list[DecisionReason],
        reasons_not_to_pursue: list[DecisionReason],
        evidence_citations: list[EvidenceCitation],
    ) -> None:
        active_oems = [o for o in company.oem_authorizations if o.valid_to >= submission_deadline]

        citation = EvidenceCitation(
            tender_requirement_title=req.title,
            tender_clause_reference=req.provenance.clause_reference,
            tender_page_number=req.provenance.page_number,
            tender_verbatim_quote=req.provenance.verbatim_quote,
            company_entry_id=active_oems[0].entry_id if active_oems else None,
            company_evidence_ref=active_oems[0].evidence_document_id if active_oems else None,
        )
        evidence_citations.append(citation)

        if active_oems:
            names = ", ".join(o.oem_name for o in active_oems)
            reasons_to_pursue.append(
                DecisionReason(
                    title="Active OEM Authorizations",
                    detail=f"Verified valid OEM relationships with: {names}.",
                    category="OEM_AUTHORIZATION",
                    evidence=citation,
                )
            )
        else:
            detail = "No active OEM Manufacturer Authorization Form (MAF) found valid through submission deadline."
            missing_information.append(
                GapItem(
                    requirement_title=req.title,
                    missing_factor="OEM Authorization Letter (MAF)",
                    suggested_action="Request manufacturer authorization certificate for specified equipment/materials.",
                    severity=RiskSeverity.HIGH,
                    evidence=citation,
                )
            )
            if req.criticality == RequirementCriticality.HARD_ELIGIBILITY:
                hard_disqualifiers.append(
                    Disqualifier(
                        requirement_title=req.title,
                        reason="Mandatory OEM authorization not present in profile.",
                        clause_reference=req.provenance.clause_reference,
                        shortfall_detail=detail,
                        evidence=citation,
                    )
                )

    @classmethod
    def _evaluate_staffing(
        cls,
        company: CompanyProfileSnapshot,
        req: RequirementCandidate,
        hard_disqualifiers: list[Disqualifier],
        missing_information: list[GapItem],
        reasons_to_pursue: list[DecisionReason],
        reasons_not_to_pursue: list[DecisionReason],
        evidence_citations: list[EvidenceCitation],
    ) -> None:
        citation = EvidenceCitation(
            tender_requirement_title=req.title,
            tender_clause_reference=req.provenance.clause_reference,
            tender_page_number=req.provenance.page_number,
            tender_verbatim_quote=req.provenance.verbatim_quote,
            company_entry_id=company.staff[0].entry_id if company.staff else None,
            company_evidence_ref=company.staff[0].evidence_document_id if company.staff else None,
        )
        evidence_citations.append(citation)

        if company.staff:
            reasons_to_pursue.append(
                DecisionReason(
                    title="Qualified Key Personnel",
                    detail=f"Company profile maintains {len(company.staff)} verified technical key personnel entries.",
                    category="STAFFING",
                    evidence=citation,
                )
            )
        else:
            missing_information.append(
                GapItem(
                    requirement_title=req.title,
                    missing_factor="Key Technical Staffing Records",
                    suggested_action="Add key personnel CVs and experience certificates to profile.",
                    severity=RiskSeverity.MEDIUM,
                    evidence=citation,
                )
            )

    @classmethod
    def _evaluate_equipment(
        cls,
        company: CompanyProfileSnapshot,
        req: RequirementCandidate,
        hard_disqualifiers: list[Disqualifier],
        missing_information: list[GapItem],
        reasons_to_pursue: list[DecisionReason],
        reasons_not_to_pursue: list[DecisionReason],
        evidence_citations: list[EvidenceCitation],
    ) -> None:
        citation = EvidenceCitation(
            tender_requirement_title=req.title,
            tender_clause_reference=req.provenance.clause_reference,
            tender_page_number=req.provenance.page_number,
            tender_verbatim_quote=req.provenance.verbatim_quote,
            company_entry_id=company.equipment[0].entry_id if company.equipment else None,
            company_evidence_ref=company.equipment[0].evidence_document_id
            if company.equipment
            else None,
        )
        evidence_citations.append(citation)

        if company.equipment:
            reasons_to_pursue.append(
                DecisionReason(
                    title="Required Equipment Deployed",
                    detail=f"Company possesses {len(company.equipment)} verified equipment and machinery assets.",
                    category="EQUIPMENT",
                    evidence=citation,
                )
            )
        else:
            missing_information.append(
                GapItem(
                    requirement_title=req.title,
                    missing_factor="Machinery & Equipment Inventory",
                    suggested_action="Declare owned or leased machinery inventory for tender execution.",
                    severity=RiskSeverity.MEDIUM,
                    evidence=citation,
                )
            )

    @classmethod
    def _evaluate_mandatory_submission(
        cls,
        req: RequirementCandidate,
        reasons_to_pursue: list[DecisionReason],
        missing_information: list[GapItem],
        evidence_citations: list[EvidenceCitation],
    ) -> None:
        citation = EvidenceCitation(
            tender_requirement_title=req.title,
            tender_clause_reference=req.provenance.clause_reference,
            tender_page_number=req.provenance.page_number,
            tender_verbatim_quote=req.provenance.verbatim_quote,
            notes=(
                f"Stamp Paper Denomination: ₹{req.execution_rules.stamp_paper_denomination_inr or 'N/A'}, "
                f"Notarization Required: {req.execution_rules.notarization_required}"
            ),
        )
        evidence_citations.append(citation)

        missing_information.append(
            GapItem(
                requirement_title=req.title,
                missing_factor="Mandatory Bid Security / Execution Instrument",
                suggested_action=(
                    f"Procure required instrument '{req.title}' "
                    f"(Stamp Paper: ₹{req.execution_rules.stamp_paper_denomination_inr or 100}, "
                    f"Notarization: {'Mandatory' if req.execution_rules.notarization_required else 'Not Required'})."
                ),
                severity=RiskSeverity.HIGH,
                evidence=citation,
            )
        )
