from pathlib import Path

import pytest

try:
    import pypdfium2
except ImportError:
    pypdfium2 = None  # type: ignore[assignment]

from tenderpulse_ai.pipeline import (
    DocumentExtractionRequest,
    NormalizedPage,
    ProductionExtractionPipeline,
    default_tender_extractor,
)
from tenderpulse_ai.security.context import SecurityContext


@pytest.fixture
def sec_context():
    return SecurityContext(
        tenant_id="org_contract_test",
        user_id="usr_reviewer_1",
        workflow_run_id="run_dca_101",
        allowed_document_ids=["doc_dca_001"],
        allowed_source_ids=["src_dca"],
        purpose="COMPLIANCE_EXTRACTION",
    )


def test_false_positive_suppression_on_non_rfp_covenants():
    """Verifies that negative contexts are suppressed and do not emit false positive qualifications."""
    # 1. Schedule T: Panel of Chartered Accountants turnover
    ca_firm_page = (
        "SCHEDULE-T (See Clause 33.2.1) PANEL OF CHARTERED ACCOUNTANTS\n"
        "2.2 Interested firms meeting the eligibility criteria shall be required to submit their application.\n"
        "The firm of Chartered Accountants shall furnish year-wise information relating to names of all companies "
        "with an annual turnover exceeding Rs. 100,00,00,000 (Rs. one hundred crore) whose annual accounts were audited by such firm."
    )
    items_ca = default_tender_extractor(
        "sys",
        f'<untrusted_document_data document_id="doc_1" page="315">\n{ca_firm_page}\n</untrusted_document_data>',
    )
    assert not any(i.title == "Technical Qualification & Annual Turnover" for i in items_ca), (
        "CA firm turnover should not be extracted as bidder qualification"
    )

    # 2. Schedule G: Capital spend exclusion on Plant and Machinery
    machinery_exclusion_page = (
        "SCHEDULE-G: PROJECT COMPLETION SCHEDULE\n"
        "Milestone-II shall occur on the date falling on the 480th day from the Appointed Date.\n"
        "The Concessionaire shall have incurred expenditure on physical works which shall not include advances "
        "of any kind to any person or expenditure of any kind on plant and machinery."
    )
    items_machinery = default_tender_extractor(
        "sys",
        f'<untrusted_document_data document_id="doc_1" page="208">\n{machinery_exclusion_page}\n</untrusted_document_data>',
    )
    assert not any(
        i.title == "Essential Plant, Machinery & Equipment Undertaking" for i in items_machinery
    ), "Expenditure exclusion should not trigger equipment undertaking"

    # 3. Schedule K: Table of Contents for Key Personnel
    toc_personnel_page = (
        "SCHEDULE-K: ASSET MANAGEMENT PROGRAMME\n"
        "TABLE OF CONTENTS\n"
        "4.1 General Overview ..................................................... 238\n"
        "4.2 Key Personnel ........................................................ 239\n"
        "4.3 Operations Plan ...................................................... 240"
    )
    items_personnel = default_tender_extractor(
        "sys",
        f'<untrusted_document_data document_id="doc_1" page="239">\n{toc_personnel_page}\n</untrusted_document_data>',
    )
    assert not any(
        i.title == "Key Technical Personnel & Project Management Team" for i in items_personnel
    ), "TOC line should not trigger Key Technical Personnel undertaking"

    # 4. Article 40.2: Permitted assignment for working capital
    assignment_page = (
        "ARTICLE 40: ASSIGNMENT AND CHARGES\n"
        "40.2 Permitted Assignment: The Concessionaire shall not assign rights except as security only for "
        "indebtedness to the Senior Lenders under the Financing Agreements and/or for working capital arrangements for the Project Highway."
    )
    items_solvency = default_tender_extractor(
        "sys",
        f'<untrusted_document_data document_id="doc_1" page="153">\n{assignment_page}\n</untrusted_document_data>',
    )
    assert not any(
        i.title == "Bank Solvency & Working Capital Credit Facilities" for i in items_solvency
    ), "Permitted assignment should not trigger banker solvency certificate"

    # 5. Article 48: Bare definition of Bid Security
    definition_page = (
        "ARTICLE 48: DEFINITIONS\n"
        "48.1 Definitions:\n"
        "“Bid Security” means the bid security provided by the Concessionaire to the Authority in accordance with the Request for Proposals for the Project, in the sum of Rs. 11.01 crore."
    )
    items_bid_sec = default_tender_extractor(
        "sys",
        f'<untrusted_document_data document_id="doc_1" page="180">\n{definition_page}\n</untrusted_document_data>',
    )
    assert not any(i.title == "Tender & Bid Security (EMD) Guarantee" for i in items_bid_sec), (
        "Bare glossary definition should not trigger operative EMD guarantee"
    )


def test_contract_execution_covenants_extraction():
    """Tests extraction of primary contract covenants with exact verbatim quotes and parameters."""
    sample_texts = [
        # Article 4.1.3: Concessionaire Conditions Precedent
        (
            30,
            (
                "4.1.3 The Conditions Precedent required to be satisfied by the Concessionaire within a period of "
                "180 (one hundred and eighty) days from the date of this Agreement shall be deemed to have been fulfilled "
                "when the Concessionaire shall have: (a) provided Performance Security to the Authority; "
                "(b) executed and procured execution of the Escrow Agreement; (c) executed and procured execution of the Substitution Agreement; "
                "(d) procured all the Applicable Permits specified in Schedule-E unconditionally."
            ),
            "Conditions Precedent Satisfaction (Concessionaire 180-Day CPs)",
            "EXECUTION",
        ),
        # Article 9.1.1: Primary Performance Security Rs. 33.02 Cr
        (
            48,
            (
                "ARTICLE 9 PERFORMANCE SECURITY\n"
                "9.1 Performance Security\n"
                "9.1.1 The Concessionaire shall, for the performance of its obligations hereunder during the Construction Period, "
                "provide to the Authority no later than 120 (one hundred and twenty) days from the date of this Agreement, "
                "an irrevocable and unconditional e-bank guarantee from a Bank or insurance surety bond for a sum equivalent to Rs. 33.02 crore."
            ),
            "Performance Security (PBG) & Security Deposit",
            "FINANCIAL",
        ),
        # Article 12.4.1: Scheduled COD (910 days)
        (
            60,
            (
                "12.4.1 On or after the Appointed Date, the Concessionaire shall undertake construction of Four-Laning. "
                "The 910th (nine hundred and tenth) day from the Appointed Date shall be the scheduled date for completion of Four-Laning, "
                "(the “Scheduled Four-Laning Date”) and the Concessionaire agrees and undertakes that Four-Laning shall be completed on or before the Scheduled Four-Laning Date."
            ),
            "Scheduled Project Completion Date (COD)",
            "EXECUTION",
        ),
        # Schedule G: Milestones
        (
            208,
            (
                "SCHEDULE –G (See Clause 12.1) PROJECT COMPLETION SCHEDULE\n"
                "1 Project Completion Schedule: During Construction Period, the Concessionaire shall comply with the requirements set forth in this Schedule-G.\n"
                "2 Project Milestone-I shall occur on the date falling on the 180th day from the Appointed Date.\n"
                "3 Project Milestone-II shall occur on the date falling on the 480th day from the Appointed Date."
            ),
            "Progressive Construction Milestones & Completion Schedule (Schedule G)",
            "TECHNICAL",
        ),
        # Clause 17.5.2: Heavy Mobile Rescue Cranes
        (
            81,
            (
                "17.5.2 The Concessionaire’s responsibility for rescue operations on the Project Highway shall include prompt removal of vehicles or debris. "
                "For this purpose, it shall maintain and operate a round-the-clock vehicle rescue post with one mobile crane having the capacity "
                "to lift a truck with a Gross Vehicle Weight of 30,000 (thirty thousand) kilograms and one additional mobile crane having the capacity "
                "to lift a truck with a Gross Vehicle Weight of 15,000 (fifteen thousand) kilograms."
            ),
            "Round-the-Clock Emergency Rescue Post & Mobile Heavy Cranes",
            "EXECUTION",
        ),
        # Clause 17.5.4: Accident Fatality & Injury Liabilities
        (
            82,
            (
                "17.5.4 (i) In the event another accident occurs within one year and was caused by any defect or deficiency in the Project, "
                "the Concessionaire shall be liable to pay Rs. 25 lakh (Rupees twenty-five lakh) for each fatality in such accident and "
                "Rs. 10 lakh (Rupees ten lakh) for each grievous injury."
            ),
            "Accident Fatality & Grievous Injury Strict Liability Compensation",
            "LEGAL",
        ),
        # Article 25.5.1: State Construction Grant Rs. 40.09 Cr
        (
            102,
            (
                "25.5.1 Rs.40.09 crore (Rupees Forty Crore and Nine Lakh) shall be due and payable to the Concessionaire in "
                "10 (ten) equal instalments during the Construction Period in accordance with the provisions of Clause 25.5.2."
            ),
            "State Construction Support Grant",
            "FINANCIAL",
        ),
        # Article 31.3.1: Escrow Waterfall
        (
            117,
            (
                "31.3.1 The Concessionaire shall give irrevocable instructions to the Escrow Bank instructing that deposits in the "
                "Escrow Account shall be appropriated in the following order every month: (a) all taxes due and payable; "
                "(b) all payments relating to construction; (c) O&M Expenses; (d) Concession Fee; (e) Senior Debt service."
            ),
            "Escrow Account Withdrawal Priority Waterfall",
            "FINANCIAL",
        ),
        # Article 32.1.1: Comprehensive Project Insurance & Co-Insured
        (
            119,
            (
                "32.1.1 The Concessionaire shall effect and maintain at its own cost, during the Construction Period and the Operation Period, "
                "such insurances as required under the Financing Agreements. The Concessionaire shall procure that in each insurance policy, "
                "the Authority shall be a co-insured and that the insurer shall pay the proceeds of insurance into the Escrow Account."
            ),
            "Comprehensive Project Insurances & Authority Co-Insured Mandate",
            "LEGAL",
        ),
        # Article 44: SAROD Dispute Resolution
        (
            166,
            (
                "44.3 Arbitration: Any Dispute which is not resolved amicably by conciliation and the aggregate claim whereof does not "
                "exceed Rs. 10,00,00,000 (Rupees ten crore) shall be referred to and decided by arbitration under the rules of "
                "Society for Affordable Redressal of Disputes (SAROD)."
            ),
            "Tiered Dispute Resolution & SAROD Arbitration Agreement",
            "LEGAL",
        ),
        # Schedule E: Statutory Permits
        (
            200,
            (
                "SCHEDULE-E (See Clause 4.1.3) APPLICABLE PERMITS\n"
                "1 Applicable Permits: The Concessionaire shall obtain the following Applicable Permits on or before the Appointed Date:\n"
                "(i) Permission of the State Government for extracting boulders from quarry;\n"
                "(ii) Consent to establish and operate stone crushers from State Pollution Control Board;\n"
                "(iii) Explosives licence from Controller of Explosives."
            ),
            "Statutory Clearances & Applicable Permits (Schedule E)",
            "STATUTORY",
        ),
        # Schedule K: Maintenance Standards Table 1
        (
            243,
            (
                "SCHEDULE-K: MAINTENANCE REQUIREMENTS\n"
                "Table -1: Maintenance Criteria for Pavements: Flexible Pavement\n"
                "The Concessionaire shall repair and rectify defects within the following limits:\n"
                "Potholes: Nil (Time limit for Rectification/ Repair: 24 to 48 hours)\n"
                "Cracking: Nil (Time limit for Rectification: 7 to 15 days)\n"
                "Rutting: Nil (Time limit for Rectification: 15 to 30 days)"
            ),
            "Highway Maintenance Standards & Defect Rectification SLAs (Schedule K)",
            "TECHNICAL",
        ),
    ]

    for page_no, text, expected_title, expected_category in sample_texts:
        block = f'<untrusted_document_data document_id="doc_dca" page="{page_no}">\n{text}\n</untrusted_document_data>'
        items = default_tender_extractor("System Prompt", block)
        matched = next((i for i in items if i.title == expected_title), None)
        assert matched is not None, (
            f"Expected covenant '{expected_title}' not found on page {page_no}"
        )
        assert matched.category == expected_category
        assert len(matched.provenance.verbatim_quote) > 15
        assert matched.provenance.page_number == page_no


@pytest.mark.asyncio
async def test_dca_full_pipeline_execution_on_selected_pages(sec_context):
    """Executes the complete production pipeline against key pages from DCA.pdf,

    verifying deterministic validation, deduplication, and absence of false positives.
    """
    repo_root = Path(__file__).resolve().parents[3]
    dca_pdf_path = repo_root / "samples" / "DCA.pdf"
    if not dca_pdf_path.is_file():
        pytest.skip(f"DCA.pdf not present at {dca_pdf_path}")
    if pypdfium2 is None:
        pytest.skip("pypdfium2 is not installed")

    pdf = pypdfium2.PdfDocument(str(dca_pdf_path))
    # Test on key pages covering covenants + false positive pages
    test_page_numbers = [30, 48, 60, 81, 82, 93, 102, 117, 119, 153, 166, 200, 208, 239, 243, 315]
    pages = [
        NormalizedPage(page_number=p, text=pdf[p - 1].get_textpage().get_text_range())
        for p in test_page_numbers
    ]

    pipeline = ProductionExtractionPipeline()
    req = DocumentExtractionRequest(
        security_context=sec_context,
        bid_id="bid_dca_pilot_01",
        document_id="doc_dca_001",
        document_type="CONCESSION_AGREEMENT",
        file_name="DCA.pdf",
        pages=pages,
    )

    response = await pipeline.execute(req)
    assert response.status in ("REVIEW_READY", "HUMAN_REVIEW_REQUIRED")
    assert len(response.items) >= 10

    # Ensure 0 false positives
    titles = [i["title"] for i in response.items]
    assert "Technical Qualification & Annual Turnover" not in titles
    assert "Essential Plant, Machinery & Equipment Undertaking" not in titles
    assert "Bank Solvency & Working Capital Credit Facilities" not in titles

    # Ensure vital covenants are extracted
    assert any("Conditions Precedent" in t for t in titles)
    assert any("Performance Security" in t for t in titles)
    assert any("Scheduled" in t for t in titles)
    assert any("Rescue Post" in t or "Cranes" in t for t in titles)
    assert any("Ambulance" in t for t in titles)
    assert any("Construction Support Grant" in t for t in titles)
    assert any("Escrow Account" in t for t in titles)
    assert any("Insurances" in t for t in titles)
    assert any("SAROD" in t for t in titles)
    assert any("Statutory Clearances" in t or "Applicable Permits" in t for t in titles)
    assert any("Maintenance Standards" in t or "SLAs" in t for t in titles)
