from __future__ import annotations

import datetime
import json

import pytest
from fastapi.testclient import TestClient

from tenderpulse_ai.agent.schemas import (
    AmbiguityFlag,
    AmbiguityType,
    CriterionProps,
    ExecutionRulesProps,
    ProvenanceProps,
    RequirementCandidate,
    RequirementCriticality,
    RequirementKind,
)
from tenderpulse_ai.decision import (
    BidDecisionAgent,
    BidDecisionRequest,
    BidDecisionResponse,
    BidDecisionVerdict,
    CertificationEntry,
    CompanyProfileSnapshot,
    DecisionState,
    EquipmentEntry,
    ExperienceEntry,
    FinancialTurnover,
    OemAuthEntry,
    StaffEntry,
)
from tenderpulse_ai.main import app
from tenderpulse_ai.security.context import SecurityContext
from tenderpulse_ai.security.exceptions import AISecurityException

SUBMISSION_DEADLINE = datetime.date(2026, 11, 15)


def make_security_context(
    tenant_id: str = "org_lnt_infra",
    user_id: str = "usr_bid_director_01",
    purpose: str = "BID_DECISION",
) -> SecurityContext:
    return SecurityContext(
        tenant_id=tenant_id,
        user_id=user_id,
        workflow_run_id="run_decision_999",
        allowed_document_ids=["doc_tender_package_01"],
        purpose=purpose,  # type: ignore[arg-type]
    )


def make_company_profile(
    *,
    turnover_inr_crores: float = 65.0,
    is_blacklisted: bool = False,
    cert_valid_to: datetime.date | None = datetime.date(2027, 5, 20),
    operating_regions: list[str] | None = None,
) -> CompanyProfileSnapshot:
    return CompanyProfileSnapshot(
        company_id="comp_lnt_constructions",
        company_name="L&T Construction Engineering Ltd",
        profile_version_id="prof_v2_active",
        is_active=True,
        is_blacklisted=is_blacklisted,
        registrations={"GSTIN": "27AAACL1234F1Z1", "PAN": "AAACL1234F", "UDYAM": "UDYAM-MH-01-0001234"},
        turnover_records=[
            FinancialTurnover(
                financial_year="FY24",
                turnover_inr_crores=turnover_inr_crores,
                ca_udin="24123456AAAA1234",
                evidence_document_id="doc_ca_cert_fy24",
            )
        ],
        experience=[
            ExperienceEntry(
                entry_id="exp_01",
                project_name="Metro Elevated Viaduct Package 4",
                client_name="Maharashtra Metro Rail Corp",
                contract_value_inr_crores=120.0,
                completion_date=datetime.date(2024, 3, 31),
                work_type_tags=["metro", "viaduct", "civil"],
                location_state="Maharashtra",
                evidence_document_id="doc_completion_metro_pkg4",
            )
        ],
        operating_regions=operating_regions or ["Maharashtra", "Gujarat", "Karnataka"],
        certifications=[
            CertificationEntry(
                entry_id="cert_iso_9001",
                standard_name="ISO 9001:2015",
                issuing_body="BSI Group India",
                valid_from=datetime.date(2023, 1, 1),
                valid_to=cert_valid_to,
                evidence_document_id="doc_cert_iso9001_pdf",
            )
        ],
        oem_authorizations=[
            OemAuthEntry(
                entry_id="oem_caterpillar",
                oem_name="Caterpillar India",
                product_lines=["Heavy Earthmoving", "Excavators"],
                valid_from=datetime.date(2025, 1, 1),
                valid_to=datetime.date(2027, 1, 1),
                evidence_document_id="doc_maf_cat_2025",
            )
        ],
        staff=[
            StaffEntry(
                entry_id="staff_pm_01",
                name="Rajesh Sharma",
                role="Chief Project Manager",
                qualification="B.Tech Civil + PMP",
                experience_years=18,
                evidence_document_id="doc_cv_rajesh_sharma",
            )
        ],
        equipment=[
            EquipmentEntry(
                entry_id="eq_batching_01",
                name="Concrete Batching Plant 60m3/hr",
                equipment_type="Batching Plant",
                quantity=2,
                owned=True,
                evidence_document_id="doc_invoice_batching_plant",
            )
        ],
    )


def make_standard_requirements() -> list[RequirementCandidate]:
    return [
        RequirementCandidate(
            category="FINANCIAL",
            kind=RequirementKind.ELIGIBILITY_THRESHOLD,
            criticality=RequirementCriticality.HARD_ELIGIBILITY,
            title="Annual Average Financial Turnover",
            description="Bidder must have minimum annual turnover of INR 50 Crores in the last financial year.",
            criterion=CriterionProps(type="TURNOVER", operator="GTE", threshold=50.0, unit="CRORES"),
            provenance=ProvenanceProps(
                source_document_id="doc_tender_package_01",
                source_file_name="NIT_Package.pdf",
                page_number=12,
                clause_reference="Clause 12.1 (Financial)",
                verbatim_quote="Bidder must have minimum annual turnover of INR 50 Crores in the last financial year.",
                confidence_score=0.99,
            ),
        ),
        RequirementCandidate(
            category="TECHNICAL",
            kind=RequirementKind.ELIGIBILITY_THRESHOLD,
            criticality=RequirementCriticality.HARD_ELIGIBILITY,
            title="Past Similar Work Experience",
            description="Bidder must have completed at least one similar infrastructure work in the last 7 years.",
            provenance=ProvenanceProps(
                source_document_id="doc_tender_package_01",
                source_file_name="NIT_Package.pdf",
                page_number=14,
                clause_reference="Clause 14.3 (Technical)",
                verbatim_quote="completed at least one similar infrastructure work in the last 7 years",
                confidence_score=0.98,
            ),
        ),
        RequirementCandidate(
            category="STATUTORY",
            kind=RequirementKind.DOCUMENT_SUBMISSION,
            criticality=RequirementCriticality.HARD_ELIGIBILITY,
            title="Quality Management Certification (ISO 9001)",
            description="Valid ISO 9001 quality management certification required as on submission date.",
            provenance=ProvenanceProps(
                source_document_id="doc_tender_package_01",
                source_file_name="NIT_Package.pdf",
                page_number=16,
                clause_reference="Clause 16.1 (Quality)",
                verbatim_quote="Valid ISO 9001 quality management certification required as on submission date.",
                confidence_score=0.97,
            ),
        ),
        RequirementCandidate(
            category="FINANCIAL",
            kind=RequirementKind.DOCUMENT_SUBMISSION,
            criticality=RequirementCriticality.SUBMISSION_MANDATORY,
            title="Earnest Money Deposit (EMD) Guarantee",
            description="Submit EMD of INR 10 Lakhs on stamp paper with notarization.",
            execution_rules=ExecutionRulesProps(
                stamp_paper_required=True,
                stamp_paper_denomination_inr=100,
                notarization_required=True,
            ),
            provenance=ProvenanceProps(
                source_document_id="doc_tender_package_01",
                source_file_name="NIT_Package.pdf",
                page_number=20,
                clause_reference="Clause 20.2 (Securities)",
                verbatim_quote="Submit EMD of INR 10 Lakhs on stamp paper with notarization.",
                confidence_score=0.99,
            ),
        ),
    ]


def make_request(
    *,
    company_profile: CompanyProfileSnapshot | None = None,
    requirements: list[RequirementCandidate] | None = None,
    project_location_state: str = "Maharashtra",
    estimated_value_inr_crores: float = 25.0,
    submission_deadline: datetime.date = SUBMISSION_DEADLINE,
    **sec_kwargs,
) -> BidDecisionRequest:
    return BidDecisionRequest(
        security_context=make_security_context(**sec_kwargs),
        tender_id="tnd_highspeed_rail_01",
        tender_title="Construction of High-Speed Rail Terminal",
        estimated_value_inr_crores=estimated_value_inr_crores,
        submission_deadline=submission_deadline,
        project_location_state=project_location_state,
        requirements=requirements if requirements is not None else make_standard_requirements(),
        company_profile=company_profile or make_company_profile(),
    )


# ------------------------------------------------------------------ Test Cases


@pytest.mark.asyncio
async def test_bid_decision_go_when_all_criteria_comfortably_met():
    agent = BidDecisionAgent()
    request = make_request()

    response = await agent.evaluate(request)

    # 1. Verdict and State
    assert response.verdict == BidDecisionVerdict.CONDITIONAL_GO or response.verdict == BidDecisionVerdict.GO
    # Note: EMD is a mandatory submission item to procure, so it generates a GAP item
    assert response.state == DecisionState.AI_PROPOSED
    assert response.hard_disqualifiers == []
    assert response.readiness_score >= 0.80

    # 2. Reasons to pursue
    categories = {r.category for r in response.reasons_to_pursue}
    assert "FINANCIAL" in categories
    assert "TECHNICAL" in categories
    assert "GEOGRAPHY" in categories
    assert "CERTIFICATIONS" in categories

    # 3. Dual-provenance citations
    assert len(response.evidence_citations) >= 4
    for cit in response.evidence_citations:
        assert cit.tender_clause_reference != ""
        assert cit.tender_page_number >= 1


@pytest.mark.asyncio
async def test_bid_decision_hard_disqualifier_turnover_shortfall_produces_no_go():
    agent = BidDecisionAgent()
    # Company has only 30 Cr turnover vs 50 Cr required
    weak_company = make_company_profile(turnover_inr_crores=30.0)
    request = make_request(company_profile=weak_company)

    response = await agent.evaluate(request)

    assert response.verdict == BidDecisionVerdict.NO_GO
    assert len(response.hard_disqualifiers) >= 1
    disq = response.hard_disqualifiers[0]
    assert "Turnover" in disq.requirement_title
    assert "shortfall" in disq.shortfall_detail.lower() or "below" in disq.reason.lower()
    assert any("shortfall" in r.title.lower() for r in response.reasons_not_to_pursue)


@pytest.mark.asyncio
async def test_bid_decision_blacklisted_company_produces_hard_no_go():
    agent = BidDecisionAgent()
    blacklisted_company = make_company_profile(is_blacklisted=True)
    request = make_request(company_profile=blacklisted_company)

    response = await agent.evaluate(request)

    assert response.verdict == BidDecisionVerdict.NO_GO
    assert any("debarment" in d.reason.lower() for d in response.hard_disqualifiers)


@pytest.mark.asyncio
async def test_bid_decision_expired_mandatory_certification_produces_no_go():
    agent = BidDecisionAgent()
    # Certificate expired before submission deadline (2026-11-15)
    expired_cert_company = make_company_profile(
        cert_valid_to=datetime.date(2026, 9, 30)
    )
    request = make_request(company_profile=expired_cert_company)

    response = await agent.evaluate(request)

    assert response.verdict == BidDecisionVerdict.NO_GO
    assert any("certification" in d.requirement_title.lower() for d in response.hard_disqualifiers)


@pytest.mark.asyncio
async def test_bid_decision_geographic_misalignment_creates_gap_item():
    agent = BidDecisionAgent()
    # Company operates in South India, but tender is in Assam
    request = make_request(
        company_profile=make_company_profile(operating_regions=["Tamil Nadu", "Kerala"]),
        project_location_state="Assam",
    )

    response = await agent.evaluate(request)

    # Geographic absence is not a hard disqualifier, but emits a structured GapItem
    assert any("geographic" in g.requirement_title.lower() for g in response.missing_information)


@pytest.mark.asyncio
async def test_bid_decision_detects_tight_deadline_critical_risk():
    agent = BidDecisionAgent()
    # Deadline tomorrow
    tomorrow = datetime.datetime.now(datetime.UTC).date() + datetime.timedelta(days=1)
    request = make_request(submission_deadline=tomorrow)

    response = await agent.evaluate(request)

    risks = [r for r in response.commercial_risks if r.category == "TIMELINE"]
    assert len(risks) >= 1
    assert risks[0].severity == "CRITICAL"


@pytest.mark.asyncio
async def test_bid_decision_propagates_ambiguity_flags_to_uncertain_areas():
    agent = BidDecisionAgent()
    reqs = make_standard_requirements()
    # Attach ambiguity flag to requirement
    reqs[0].ambiguity_flags.append(
        AmbiguityFlag(
            type=AmbiguityType.VAGUE_QUANTIFIER,
            detail="Clause mentions 'adequate financial reserves' without numeric threshold",
            quote="adequate financial reserves",
        )
    )
    request = make_request(requirements=reqs)

    response = await agent.evaluate(request)

    assert len(response.uncertain_areas) >= 1
    uncertainty = response.uncertain_areas[0]
    assert uncertainty.ambiguity_type == "VAGUE_QUANTIFIER"
    assert "adequate financial reserves" in uncertainty.quote


@pytest.mark.asyncio
async def test_bid_decision_audit_events_are_reference_only():
    agent = BidDecisionAgent()
    request = make_request()

    response = await agent.evaluate(request)

    events_str = json.dumps(response.audit_events)
    # Secrets / proprietary financials not leaked into audit events
    assert "27AAACL1234F1Z1" not in events_str  # GSTIN
    assert "AAACL1234F" not in events_str  # PAN
    assert any(e["action"] == "DETERMINISTIC_ELIGIBILITY_EVALUATED" for e in response.audit_events)
    assert any(e["action"] == "BID_DECISION_PROPOSED" for e in response.audit_events)


@pytest.mark.asyncio
async def test_bid_decision_unauthorized_purpose_is_blocked():
    agent = BidDecisionAgent()
    request = make_request(purpose="PROPOSAL_DRAFTING")

    with pytest.raises(AISecurityException):
        await agent.evaluate(request)


@pytest.mark.asyncio
async def test_bid_decision_persistence_sink_async():
    persisted: list[BidDecisionResponse] = []

    async def async_sink(resp: BidDecisionResponse) -> None:
        persisted.append(resp)

    agent = BidDecisionAgent(persistence_sink=async_sink)
    request = make_request()
    response = await agent.evaluate(request)

    assert len(persisted) == 1
    assert persisted[0].tender_id == response.tender_id


@pytest.mark.asyncio
async def test_bid_decision_persistence_sink_sync():
    persisted: list[BidDecisionResponse] = []

    def sync_sink(resp: BidDecisionResponse) -> None:
        persisted.append(resp)

    agent = BidDecisionAgent(persistence_sink=sync_sink)
    request = make_request()
    response = await agent.evaluate(request)

    assert len(persisted) == 1
    assert persisted[0].tender_id == response.tender_id


# ------------------------------------------------------------------ API Route Tests


def test_api_bid_decision_endpoint_unauthorized():
    client = TestClient(app)
    response = client.post(
        "/api/v1/agent/bid-decision",
        json={"some": "payload"},
    )
    assert response.status_code == 401


def test_api_bid_decision_endpoint_authorized():
    client = TestClient(app)
    headers = {"X-Internal-Service-Key": "tenderpulse-internal-secret-2026"}
    request = make_request()

    response = client.post(
        "/api/v1/agent/bid-decision",
        json=json.loads(request.model_dump_json()),
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["tender_id"] == "tnd_highspeed_rail_01"
    assert data["company_id"] == "comp_lnt_constructions"
    assert data["verdict"] in ("GO", "CONDITIONAL_GO", "NO_GO")
    assert "reasons_to_pursue" in data
    assert "hard_disqualifiers" in data
    assert "missing_information" in data
