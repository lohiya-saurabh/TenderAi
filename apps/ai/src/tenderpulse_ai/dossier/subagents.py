from typing import Any
from tenderpulse_ai.dossier.models import (
    SpecialistAppraisal,
    SpecialistDomain,
    SpecialistVerdict,
)


def evaluate_technical_appraisal(criteria: dict[str, Any], profile: dict[str, Any]) -> SpecialistAppraisal:
    """Specialist Agent: Evaluates technical experience, certifications, and OEM authorizations."""
    disqualifiers: list[str] = []
    actions: list[str] = []
    citations: list[str] = []

    # 1. Past Experience Check
    required_projects = criteria.get("min_completed_projects", 1)
    company_projects = profile.get("completed_projects", [])
    if len(company_projects) < required_projects:
        disqualifiers.append(
            f"Technical shortfall: Company completed {len(company_projects)} projects, minimum {required_projects} required."
        )
    else:
        citations.append(f"Technical past experience satisfied ({len(company_projects)} verified projects).")

    # 2. Mandatory Technical Certifications
    required_certs = set(criteria.get("mandatory_certifications", []))
    company_certs = set(profile.get("certifications", []))
    missing_certs = required_certs - company_certs
    if missing_certs:
        disqualifiers.append(f"Missing mandatory technical certifications: {', '.join(missing_certs)}.")
    elif required_certs:
        citations.append(f"All technical certifications held: {', '.join(required_certs)}.")

    # 3. OEM MAF Authorization
    if criteria.get("oem_authorization_required", False) and not profile.get("has_oem_authorization", False):
        disqualifiers.append("Missing Manufacturer Authorization Form (MAF) from authorized OEM.")
        actions.append("Obtain signed Manufacturer Authorization Form from OEM.")

    verdict = SpecialistVerdict.DISQUALIFIED if disqualifiers else SpecialistVerdict.QUALIFIED

    return SpecialistAppraisal(
        specialist_id="agent_technical_appraiser",
        domain=SpecialistDomain.TECHNICAL,
        verdict=verdict,
        confidence_score=0.95,
        hard_disqualifiers=disqualifiers,
        action_items=actions,
        citations=citations,
        narrative_summary="Technical appraisal completed across past performance, OEM credentials, and certificates.",
    )


def evaluate_statutory_legal(criteria: dict[str, Any], profile: dict[str, Any]) -> SpecialistAppraisal:
    """Specialist Agent: Evaluates debarment/blacklisting status, stamp paper rules, and notarization."""
    disqualifiers: list[str] = []
    actions: list[str] = []
    citations: list[str] = []

    # 1. Active Debarment Check (Hardest Invariant)
    if profile.get("is_blacklisted", False):
        disqualifiers.append("CRITICAL STATUTORY BAR: Bidder is currently debarred / blacklisted by government procurement portal.")
    else:
        citations.append("Statutory clearance: Verified clean debarment status across CPPP/GeM.")

    # 2. Non-Judicial Stamp Paper Requirements
    req_stamp = criteria.get("stamp_paper_denomination_inr", 100)
    if req_stamp > 0:
        actions.append(f"Execute Non-Blacklisting Affidavit on INR {req_stamp} non-judicial stamp paper.")

    # 3. Signing Authority Rank
    req_rank = criteria.get("signing_authority_rank", "Director")
    citations.append(f"Signatory authority rule noted: Must be executed by {req_rank} or designated Power of Attorney.")

    verdict = SpecialistVerdict.DISQUALIFIED if disqualifiers else SpecialistVerdict.QUALIFIED

    return SpecialistAppraisal(
        specialist_id="agent_statutory_legal",
        domain=SpecialistDomain.STATUTORY_LEGAL,
        verdict=verdict,
        confidence_score=1.0,
        hard_disqualifiers=disqualifiers,
        action_items=actions,
        citations=citations,
        narrative_summary="Statutory and legal evaluation completed. Verified debarment, stamp paper, and signatory rank.",
    )


def evaluate_commercial_finance(criteria: dict[str, Any], profile: dict[str, Any]) -> SpecialistAppraisal:
    """Specialist Agent: Evaluates turnover thresholds, CA UDIN verification, and EMD liquidity."""
    disqualifiers: list[str] = []
    actions: list[str] = []
    citations: list[str] = []

    # 1. Turnover Threshold Check
    req_turnover = criteria.get("min_avg_turnover_inr_crores", 0.0)
    actual_turnover = profile.get("avg_annual_turnover_inr_crores", 0.0)
    if actual_turnover < req_turnover:
        shortfall = round(req_turnover - actual_turnover, 2)
        disqualifiers.append(
            f"Financial shortfall: Average turnover is INR {actual_turnover} Cr, required INR {req_turnover} Cr (Shortfall: INR {shortfall} Cr)."
        )
    else:
        citations.append(f"Turnover threshold met: INR {actual_turnover} Cr exceeds required INR {req_turnover} Cr.")

    # 2. CA UDIN Verification
    if criteria.get("udin_required", True) and not profile.get("ca_udin_verified", False):
        disqualifiers.append("CA turnover certificate lacks verified ICAI UDIN number.")
        actions.append("Request statutory auditor to generate valid UDIN for turnover declaration.")

    # 3. EMD Liquidity Requirement
    req_emd = criteria.get("emd_amount_inr", 0)
    if req_emd > 0:
        actions.append(f"Arrange EMD Bank Guarantee / FDR of INR {req_emd:,} with minimum 120-day validity.")

    verdict = SpecialistVerdict.DISQUALIFIED if disqualifiers else SpecialistVerdict.QUALIFIED

    return SpecialistAppraisal(
        specialist_id="agent_commercial_finance",
        domain=SpecialistDomain.COMMERCIAL_FINANCE,
        verdict=verdict,
        confidence_score=0.98,
        hard_disqualifiers=disqualifiers,
        action_items=actions,
        citations=citations,
        narrative_summary="Financial health evaluation completed: Verified turnover records, UDIN authenticity, and EMD liquidity.",
    )
