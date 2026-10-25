import pytest

from tenderpulse_ai.agent.validation import CANONICAL_CATEGORIES
from tenderpulse_ai.domain.models import ProvenanceProps
from tenderpulse_ai.domain.pdf_resolver import (
    is_pure_toc_page,
    resolve_pdf_to_pages,
)
from tenderpulse_ai.infrastructure.llm.openai_compatible_client import (
    OpenAICompatibleLlmClient,
)
from tenderpulse_ai.models.llm_client import StructuredLLMClient
from tenderpulse_ai.pipeline import (
    DocumentExtractionRequest,
    ProductionExtractionPipeline,
    _extract_clause_from_clause_text,
    _extract_operative_clause,
    _extract_sentence,
    _is_calendar_date_or_measurement,
    default_tender_extractor,
    extract_clause_reference,
    is_toc_or_definition,
)
from tenderpulse_ai.security.context import SecurityContext


def test_clause_reference_word_boundary_and_roman_numeral_precision():
    """Verifies that English words do not match as division keywords or Roman numerals."""
    # Negative cases: English words matching division substring 'Part'
    negative_words = [
        ("The participating firms must submit their technical proposals online.", 4),
        ("In particular circumstances, the authority may grant time extensions.", 5),
        ("Firms that participate in consortium bidding shall be restricted.", 6),
        ("Particulars of past project experience must be uploaded to portal.", 3),
        ("The JV partners shall be jointly and severally responsible.", 7),
    ]
    for text, page in negative_words:
        ref = extract_clause_reference(text, page)
        ref_lower = ref.lower()
        assert "participat" not in ref_lower, f"Leaked 'participating' into clause ref: {ref}"
        assert "particular" not in ref_lower, f"Leaked 'particular' into clause ref: {ref}"
        assert "partner" not in ref_lower, f"Leaked 'partners' into clause ref: {ref}"

    # Negative cases: division keywords followed by ordinary English words or verbs starting with Roman letters
    false_keyword_phrases = [
        ("Schedule delivery of materials within thirty days of letter of award.", 2),
        ("Section details the technical specifications of road construction.", 3),
        ("Clause conditions apply to all sub-contractors on site.", 4),
        ("Clause limits on liability shall be capped at total contract price.", 4),
        ("Article value of works shall be calculated based on BOQ rates.", 5),
        ("Table indicates overall completion milestones across project phases.", 1),
        ("Clause defines the payment schedule.", 3),
        ("Clause mandates compliance with labour laws.", 3),
        ("Clause varies depending on project site.", 3),
        ("Clause deals with force majeure events.", 3),
        ("Clause clarifies the procedure.", 3),
        ("Part describes the work methodology.", 3),
        ("Section describes the bill of quantities.", 3),
        ("Part may be sub-contracted.", 1),
        ("Part can be divided.", 1),
    ]
    for text, page in false_keyword_phrases:
        ref = extract_clause_reference(text, page)
        assert ref == f"Clause on Page {page}", f"Falsely matched clause ref: '{ref}' from '{text}'"

    # Positive cases: structured clause numbers and valid divisions
    positive_cases = [
        ("Clause 11 Consultants may apply either as a sole firm or JV.", 4, "Clause 11 (Page 4)"),
        ("Clause 13.A Eligibility criteria for sole applicant.", 4, "Clause 13.A (Page 4)"),
        ("Clause 9.1.1 Performance Security Guarantee.", 5, "Clause 9.1.1 (Page 5)"),
        ("ARTICLE 12 OBLIGATIONS OF THE CONCESSIONAIRE", 5, "ARTICLE 12 (Page 5)"),
        ("Section 1.1 Scope of the Project Highway", 2, "Section 1.1 (Page 2)"),
        ("Schedule IV Penalty and Damage Matrix", 5, "Schedule IV (Page 5)"),
        ("SCHEDULE-G Project Completion Milestones", 5, "SCHEDULE-G (Page 5)"),
        ("Annexure A Format for Performance Bank Guarantee", 5, "Annexure A (Page 5)"),
        ("Appendix IB Format of Financial Bid Proposal", 5, "Appendix IB (Page 5)"),
        ("Table 1: Details of Project Road Length", 1, "Table 1 (Page 1)"),
        ("20. RFP submission must be received not later than 11:00 Hrs.", 8, "Clause 20 (Page 8)"),
        ("19. The individual key personnel proposed in the bid...", 8, "Clause 19 (Page 8)"),
        ("17. The Technical proposal and Financial Proposals shall...", 8, "Clause 17 (Page 8)"),
        ("10. The total time period for the assignment will be...", 4, "Clause 10 (Page 4)"),
        ("6. The interested consultancy firms may download...", 3, "Clause 6 (Page 3)"),
    ]
    for text, page, expected in positive_cases:
        ref = extract_clause_reference(text, page)
        assert ref == expected, f"Expected '{expected}', got '{ref}' for text: {text}"


def test_exclude_indian_dates_and_km_markers():
    """Verifies that calendar dates and kilometre indicators are never treated as clause references."""
    # Calendar dates
    assert _is_calendar_date_or_measurement("19.02.2026") is True
    assert _is_calendar_date_or_measurement("22.01.2026") is True
    assert _is_calendar_date_or_measurement("09.10.2026") is True
    assert _is_calendar_date_or_measurement("15.08.2024") is True

    # Decimal fractions and kilometre lengths
    assert _is_calendar_date_or_measurement("0.5") is True
    assert _is_calendar_date_or_measurement("0.25") is True
    assert _is_calendar_date_or_measurement("9.45", "link NH-71 9.45 km The RFP") is True

    # Clause heading detection must not treat dates as clause headers
    clause_with_date = "20. RFP submission must be received not later than 11:00 Hrs on 19.02.2026 as mentioned on portal."
    ref = _extract_clause_from_clause_text(clause_with_date, 8)
    assert ref == "Clause 20 (Page 8)", f"Date superseded clause number: {ref}"
    assert "19.02.2026" not in (ref or "")

    # Line-wrapped date in pre-text must not slice clause at date
    page_text = (
        "6. The interested consultancy firms may download the RFP from NHAI Website from \n"
        "22.01.2026 to 19.02.2026 upto 11:00 hrs. The Consultant who download the RFP document "
        "shall pay the non-refundable fee of Rs. 5,000/- through NEFT."
    )
    res = _extract_operative_clause(["download", "fee"], page_text, 3)
    assert res is not None
    quote, clause_ref = res
    assert "6. The interested" in quote, f"Quote sliced at wrapped date: {quote}"
    assert clause_ref == "Clause 6 (Page 3)", f"Clause ref matched date: {clause_ref}"

    # Line-initial dates and km measurements must not fall through to single_match (e.g. Clause 19, Clause 9)
    assert (
        extract_clause_reference("19.02.2026 Tender submission last date is 19.02.2026.", 2)
        == "Clause on Page 2"
    )
    assert extract_clause_reference("22.01.2026 Document download begins.", 2) == "Clause on Page 2"
    assert (
        extract_clause_reference("9.45 km section requires bituminous overlay.", 2)
        == "Clause on Page 2"
    )
    assert extract_clause_reference("2.5 lakh EMD must be submitted", 2) == "Clause on Page 2"


def test_enhanced_toc_and_index_filtering():
    """Verifies that pure TOC pages and inline TOC dot leader lines are filtered."""
    # Page with Table of Clauses
    toc_text = (
        "Section II: Instructions to Bidders\n"
        "Table of Clauses\n"
        "Clause A. General Clause D. Submission of Bids\n"
        "1 Scope of Bid 19 Sealing and Marking of Bids\n"
        "2 Source of Funds 21 Late Bids\n"
        "3 Eligible Bidders 22 Modification & Withdrawal of Bids\n"
        "15 Bid Validity 34 Advances\n"
        "16 Earnest Money/ Bid Security/ Forfeiture/Debarment\n"
        "33 Performance Security 35 Corrupt Practices\n"
    )
    assert is_pure_toc_page(toc_text) is True

    # Page with Contents
    contents_text = (
        "Contents\n"
        "1. Notice Inviting Tender\n"
        "2. Instructions to Bidders\n"
        "3. Qualification Criteria\n"
        "4. Conditions of Contract\n"
        "5. Technical Specifications\n"
    )
    assert is_pure_toc_page(contents_text) is True

    # Substantive page with obligations must NOT be marked as pure TOC
    substantive_text = (
        "Clause 16. Bid Security\n"
        "The Bidder shall furnish, as part of his Bid, a Bid Security in the amount of Rs. 10 Lakhs. "
        "Any bid not accompanied by an acceptable Bid Security shall be rejected by the Employer as non-responsive. "
        "The Bid Security shall be valid for 180 days beyond bid validity."
    )
    assert is_pure_toc_page(substantive_text) is False

    # is_toc_or_definition: Dot leaders and consecutive headings
    assert (
        is_toc_or_definition("16 Earnest Money/ Bid Security/ Forfeiture/Debarment ...... 16")
        is True
    )
    assert (
        is_toc_or_definition(
            "33 Performance Security 15 Bid Validity 34 Advances 16 Earnest Money/ Bid Security/ Forfeiture/Debarment"
        )
        is True
    )
    assert (
        is_toc_or_definition(
            "The Bidder shall furnish Earnest Money Deposit (EMD) within 15 days of award."
        )
        is False
    )


def test_negative_prohibition_graceful_handling():
    """Verifies that negative prohibitions do not emit positive mandatory requirements."""
    # Joint Venture prohibition
    jv_prohibited_prompt = (
        '<untrusted_document_data document_id="doc_jv" page="11">\n'
        "4.3 Bids from joint ventures are not allowed.\n"
        "4.4 To qualify for award of the contract, each bidder in its name should have completed works.\n"
        "</untrusted_document_data>"
    )
    items = default_tender_extractor("", jv_prohibited_prompt)
    jv_items = [i for i in items if "joint venture" in i.title.lower() or i.category == "EXECUTION"]
    assert len(jv_items) == 0, f"Emitted positive JV requirement for prohibited tender: {jv_items}"

    # Negative exclusion for similar work
    negative_exclusion_prompt = (
        '<untrusted_document_data document_id="doc_sw" page="6">\n'
        "(ii) The following assignments would not be counted for the purposes of maximum number of projects "
        "given at Sr. No. 3 to 4 of above Table:\n"
        "(a) IE/AE assignments where original assignment period is not completed.\n"
        "(b) DPR assignments where the bids for civil works have not been received.\n"
        "</untrusted_document_data>"
    )
    sw_items = default_tender_extractor("", negative_exclusion_prompt)
    similar_work_items = [
        i
        for i in sw_items
        if "similar work" in i.title.lower() or "similar work" in i.description.lower()
    ]
    assert len(similar_work_items) == 0, (
        f"Extracted negative exclusion as similar work: {similar_work_items}"
    )


def test_zero_synthetic_fallbacks():
    """Verifies zero synthetic fallback strings in models and client candidate building."""
    # ProvenanceProps default verbatim_quote must be empty
    p = ProvenanceProps()
    assert p.verbatim_quote == ""
    assert "Requirement extracted" not in p.verbatim_quote

    # Whitespace quote must remain empty
    p2 = ProvenanceProps(verbatim_quote="   \n  ")
    assert p2.verbatim_quote == ""

    # OpenAICompatibleLlmClient._build_candidate must drop ungrounded candidates cleanly
    client = OpenAICompatibleLlmClient(api_key="test_key")

    # Missing title -> dropped cleanly (None)
    cand_no_title = client._build_candidate(
        {"title": "", "provenance": {"verbatim_quote": "The bidder shall pay EMD."}}
    )
    assert cand_no_title is None

    # Missing quote -> dropped cleanly (None)
    cand_no_quote = client._build_candidate(
        {"title": "Bid Security EMD", "provenance": {"verbatim_quote": ""}}
    )
    assert cand_no_quote is None

    # Whitespace quote -> dropped cleanly (None)
    cand_ws_quote = client._build_candidate(
        {"title": "Bid Security EMD", "provenance": {"verbatim_quote": "   \t  "}}
    )
    assert cand_ws_quote is None


def test_sentence_boundary_precision_abbreviations():
    """Verifies that sentences are not broken at periods of standard abbreviations."""
    text = (
        "The bids may be downloaded upto 11:00 hrs. on 19.02.2026. "
        "The Consultant shall pay the non-refundable fee of Rs. 5,000/- through NEFT. "
        "Technical bids will be opened on 20.02.2026 at 11:30 hrs. IST."
    )
    sentence = _extract_sentence(r"fee", text)
    assert sentence is not None
    assert "Rs. 5,000" in sentence, f"Sentence split on 'Rs.': {sentence}"
    assert sentence.startswith("The Consultant shall pay"), f"Wrong sentence start: {sentence}"

    # Pvt. Ltd. abbreviation protection
    pvt_text = "M/s. ABC Pvt. Ltd. shall submit bank guarantee of Rs. 10.00 Crores. Next sentence."
    pvt_sent = _extract_sentence("bank guarantee", pvt_text)
    assert pvt_sent is not None
    assert pvt_sent.startswith("M/s. ABC Pvt. Ltd."), (
        f"Sentence truncated before Pvt. Ltd.: {pvt_sent}"
    )


def test_currency_and_percentage_measurements():
    """Verifies that currency amounts, percentages, and plural units are excluded from clause numbers."""
    # Contextual lookahead and lookbehind in _is_calendar_date_or_measurement
    assert _is_calendar_date_or_measurement("1.5", "1.5 percent penalty per day") is True
    assert _is_calendar_date_or_measurement("1.5", "1.5% penalty per day") is True
    assert (
        _is_calendar_date_or_measurement(
            "50.00",
            "The Bidder shall submit Earnest Money Deposit of Rs. 50.00 Crores at 11:00 hrs.",
        )
        is True
    )
    assert _is_calendar_date_or_measurement("10.50", "Rs. 10.50 Lakhs") is True
    assert _is_calendar_date_or_measurement("5.25", "Rs. 5.25 Cr") is True
    assert (
        _is_calendar_date_or_measurement(
            "25.00", "pay non-refundable fee of Rs. 25.00 through NEFT"
        )
        is True
    )
    assert _is_calendar_date_or_measurement("100.00", "fee of INR 100.00 for document") is True
    assert _is_calendar_date_or_measurement("500.00", "amount of ₹ 500.00 must be paid") is True

    # Clause extraction must not extract currency or percentage as clause
    assert extract_clause_reference("1.5 percent penalty per day", 2) == "Clause on Page 2"
    assert extract_clause_reference("1.5% penalty per day", 2) == "Clause on Page 2"
    assert (
        _extract_clause_from_clause_text(
            "The Bidder shall submit Earnest Money Deposit of Rs. 50.00 Crores at 11:00 hrs.",
            1,
        )
        != "Clause 50.00 (Page 1)"
    )
    assert _extract_clause_from_clause_text("Performance security equal to 5.00 %", 1) is None
    assert _extract_clause_from_clause_text("GST rate applicable is 18.00 %", 1) is None
    assert _extract_clause_from_clause_text("Rs. 10.50 Lakhs", 1) is None
    assert _extract_clause_from_clause_text("Rs. 5.25 Cr", 1) is None


def test_jv_prohibition_robust_suppression():
    """Verifies that all variations of JV/Consortium prohibitions completely suppress positive JV candidates."""
    prohibition_clauses = [
        "b) No Bidder shall submit more than one Bid for the Project. JV/Consortium are not allowed to bid.",
        "b) No Bidder shall submit more than one Bid for the Project. JV/Consortium are not allowed.",
        "4.3 Bids from joint ventures are not allowed.",
        "Joint ventures are strictly prohibited for this work.",
        "Neither JV nor consortium is permitted to participate.",
        "Bids by JV/Consortium are not permitted under any circumstances.",
        "No joint venture or consortium bids shall be accepted.",
        "Joint venture is not allowed.",
    ]
    for clause in prohibition_clauses:
        prompt = f'<untrusted_document_data document_id="doc_jv" page="18">\n{clause}\n</untrusted_document_data>'
        items = default_tender_extractor("", prompt)
        jv_items = [
            i for i in items if "joint venture" in i.title.lower() or i.category == "EXECUTION"
        ]
        assert len(jv_items) == 0, (
            f"Failed to suppress JV candidate on prohibition: '{clause}'. Emitted: {jv_items}"
        )


def test_real_document_10_nhai_outer_ring_prohibitions_and_statutory():
    """Verifies real document extraction on 10_NHAI_Outer_Ring_Exp_1850Cr_NIT.pdf:
    1. Page 18: Outright JV prohibition suppresses positive JV candidates
    2. Pages 21, 22, 51: GFR 144(xi) Land Border & Source-Code Residency captured
    3. Pages 122, 128: HiSilicon Camera Chipset Ban captured
    4. Pages 105, 118: Legal Metrology Stamping & Rs. 5 Lakh Penalty captured
    """
    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(
        "data/procurement-evidence/01_Tender_Documents/10_NHAI_Outer_Ring_Exp_1850Cr_NIT.pdf"
    )

    # 1. Page 18: JV Suppression
    p18 = pdf[17].get_textpage().get_text_range()
    items_p18 = default_tender_extractor(
        "", f'<untrusted_document_data document_id="d" page="18">{p18}</untrusted_document_data>'
    )
    jv_items = [i for i in items_p18 if "joint venture" in i.title.lower()]
    assert len(jv_items) == 0, f"Emitted positive JV candidate on prohibited Page 18: {jv_items}"

    # 2. Pages 21, 22, 51: GFR 144(xi)
    for p in [21, 22, 51]:
        p_text = pdf[p - 1].get_textpage().get_text_range()
        items = default_tender_extractor(
            "",
            f'<untrusted_document_data document_id="d" page="{p}">{p_text}</untrusted_document_data>',
        )
        gfr_items = [
            i
            for i in items
            if "gfr rule 144(xi)" in i.title.lower() or "land border" in i.title.lower()
        ]
        assert len(gfr_items) >= 1, f"Missing GFR 144(xi) candidate on Page {p}"
        assert gfr_items[0].category == "STATUTORY"
        assert (
            "land border" in gfr_items[0].provenance.verbatim_quote.lower()
            or "144 (xi)" in gfr_items[0].provenance.verbatim_quote.lower()
        )

    # 3. Pages 122, 128: HiSilicon Camera Chipset Ban
    for p in [122, 128]:
        p_text = pdf[p - 1].get_textpage().get_text_range()
        items = default_tender_extractor(
            "",
            f'<untrusted_document_data document_id="d" page="{p}">{p_text}</untrusted_document_data>',
        )
        hisi_items = [i for i in items if "hisilicon" in i.title.lower()]
        assert len(hisi_items) >= 1, f"Missing HiSilicon ban candidate on Page {p}"
        assert hisi_items[0].category == "TECHNICAL"
        assert "hisilicon" in hisi_items[0].provenance.verbatim_quote.lower()

    # 4. Pages 105, 118: Legal Metrology Stamping & Rs. 5 Lakh Penalty
    for p in [105, 118]:
        p_text = pdf[p - 1].get_textpage().get_text_range()
        items = default_tender_extractor(
            "",
            f'<untrusted_document_data document_id="d" page="{p}">{p_text}</untrusted_document_data>',
        )
        lm_items = [
            i
            for i in items
            if "legal metrology" in i.title.lower() or "stamping" in i.title.lower()
        ]
        assert len(lm_items) >= 1, f"Missing Legal Metrology candidate on Page {p}"
        assert lm_items[0].category == "STATUTORY"
        if p == 118:
            assert (
                "5,00,000" in lm_items[0].provenance.verbatim_quote
                or "5.00 Lakh" in lm_items[0].description
            )


@pytest.mark.asyncio
async def test_real_document_nhai_nit_extraction():
    """Integration test verifying extraction on real NHAI tender documents across B1-B30 benchmark obligations."""
    sec_ctx = SecurityContext(
        tenant_id="org_test",
        user_id="usr_1",
        workflow_run_id="run_nhai_eval",
        allowed_document_ids=["doc_1", "doc_2", "doc_10"],
        allowed_source_ids=["src_1"],
        purpose="COMPLIANCE_EXTRACTION",
    )
    pipeline = ProductionExtractionPipeline(
        llm_client=StructuredLLMClient(enable_live_client=False)
    )

    # 1. Verify 02_NHAI_Greenfield_Exp_1450Cr_NIT.pdf (Benchmark B1-B30)
    pages2 = await resolve_pdf_to_pages(
        "data/procurement-evidence/01_Tender_Documents/02_NHAI_Greenfield_Exp_1450Cr_NIT.pdf",
        "doc_2",
        "02_NHAI.pdf",
    )
    res2 = await pipeline.execute(
        DocumentExtractionRequest(
            security_context=sec_ctx,
            bid_id="bid_2",
            document_id="doc_2",
            file_name="02_NHAI.pdf",
            pages=pages2,
        )
    )
    assert len(res2.items) >= 25, f"Expected >=25 items, got {len(res2.items)}"

    # a. Canara Bank coordinates (0385201800065, CNRB0001624, Sector 10 Panchkula)
    fee_item = next((i for i in res2.items if i["title"] == "RFP Document Fee Payment"), None)
    assert fee_item is not None, "Missing RFP Document Fee Payment item"
    fee_quote = fee_item["provenance"]["verbatimQuote"]
    assert "0385201800065" in fee_quote, f"Missing Canara Bank Account No in quote: {fee_quote}"
    assert "CNRB0001624" in fee_quote, f"Missing IFSC code in quote: {fee_quote}"
    assert "Canara Bank" in fee_item["description"]
    assert "Sector 10 Panchkula" in fee_item["description"]

    # b. Rs. 5.0 Cr turnover threshold
    turnover_item = next(
        (
            i
            for i in res2.items
            if "Turnover" in i["title"]
            and "Matrix" not in i["title"]
            and i["category"] in ("FINANCIAL", "TECHNICAL")
        ),
        None,
    )
    assert turnover_item is not None, "Missing Annual Turnover item"
    assert "5" in turnover_item["description"] and "Crore" in turnover_item["description"]
    assert (
        "5" in turnover_item["provenance"]["verbatimQuote"]
        and "Crore" in turnover_item["provenance"]["verbatimQuote"]
    )

    # c. 4-Tier Capacity Matrix
    matrix_item = next(
        (i for i in res2.items if "Capacity" in i["title"] or "Matrix" in i["title"]), None
    )
    assert matrix_item is not None, "Missing Technical Capacity Matrix item"
    assert "Tier" in matrix_item["description"] or "Upto 10 Cr" in matrix_item["description"]
    assert "10 staff" in matrix_item["description"]
    assert "60 staff" in matrix_item["description"]

    # d. Assert specific critical benchmark obligations are present
    titles2 = [i["title"] for i in res2.items]
    assert any("Drone" in t for t in titles2), "Missing B2: Bi-Annual Drone survey"
    assert any("Monthly Progress Report" in t or "MPR" in t for t in titles2), (
        "Missing B3: Monthly Progress Report"
    )
    assert any("Quality Assurance" in t for t in titles2), "Missing B4: QA Testing"
    assert any("QCBS" in t for t in titles2), "Missing B6: QCBS 80:20 evaluation formula"
    assert any("Ceiling" in t and "Joint Venture" in t for t in titles2), (
        "Missing B8: JV ceiling max 2 partners"
    )
    assert any("Associate" in t and "Exclusivity" in t for t in titles2), (
        "Missing B9: Equipment Associate exclusivity"
    )
    assert any("Associate" in t and "Personnel" in t for t in titles2), (
        "Missing B10: Associate Key Personnel ceiling"
    )
    assert any("DPR" in t for t in titles2), "Missing B12: Past DPR experience"
    assert any("Escalation" in t or "Multipliers" in t for t in titles2), (
        "Missing B20: Escalation multipliers"
    )
    assert any("English Language" in t for t in titles2), "Missing B25: English language submission"

    for item in res2.items:
        clause = item["provenance"]["clauseReference"]
        quote = item["provenance"]["verbatimQuote"]
        cat = item["category"]

        # Quality assertions
        assert "participat" not in clause.lower(), f"False clause reference: {clause}"
        assert "particular" not in clause.lower(), f"False clause reference: {clause}"
        assert "partner" not in clause.lower(), f"False clause reference: {clause}"
        assert "19.02.2026" not in clause, f"Date in clause reference: {clause}"
        assert "22.01.2026" not in clause, f"Date in clause reference: {clause}"
        assert "Clause 0.5" not in clause, f"Fraction in clause reference: {clause}"
        assert "Requirement extracted" not in quote, f"Synthetic quote fallback found: {quote}"
        assert "Operative Requirement" not in quote, f"Synthetic quote fallback found: {quote}"
        assert cat in CANONICAL_CATEGORIES, f"Invalid category: {cat}"

    # 2. Verify 01_NHAI_HAM_850Cr_NIT.pdf
    pages1 = await resolve_pdf_to_pages(
        "data/procurement-evidence/01_Tender_Documents/01_NHAI_HAM_850Cr_NIT.pdf",
        "doc_1",
        "01_NHAI.pdf",
    )
    res1 = await pipeline.execute(
        DocumentExtractionRequest(
            security_context=sec_ctx,
            bid_id="bid_1",
            document_id="doc_1",
            file_name="01_NHAI.pdf",
            pages=pages1,
        )
    )
    assert len(res1.items) >= 10
    for item in res1.items:
        clause = item["provenance"]["clauseReference"]
        quote = item["provenance"]["verbatimQuote"]
        title = item["title"]

        assert "participat" not in clause.lower(), f"False clause reference: {clause}"
        assert "particular" not in clause.lower(), f"False clause reference: {clause}"
        assert "Pages 9" not in clause and "Page 9" not in clause, f"TOC page leaked: {clause}"
        assert "joint venture" not in title.lower(), f"JV emitted when prohibited: {title}"
        assert "Requirement extracted" not in quote, f"Synthetic quote fallback found: {quote}"

    # 3. Verify 10_NHAI_Outer_Ring_Exp_1850Cr_NIT.pdf (Adversarial Robustness)
    pages10 = await resolve_pdf_to_pages(
        "data/procurement-evidence/01_Tender_Documents/10_NHAI_Outer_Ring_Exp_1850Cr_NIT.pdf",
        "doc_10",
        "10_NHAI.pdf",
    )
    res10 = await pipeline.execute(
        DocumentExtractionRequest(
            security_context=sec_ctx,
            bid_id="bid_10",
            document_id="doc_10",
            file_name="10_NHAI.pdf",
            pages=pages10,
        )
    )
    # a. JV outright prohibition on Page 18 emits 0 positive JV items
    assert not any(
        "Joint Venture" in it["title"] and it["provenance"]["pageNumber"] == 18
        for it in res10.items
    ), "Emitted positive Joint Venture item on Page 18 where JV is explicitly prohibited!"

    # b. GFR 144(xi) land border & source code residency is extracted
    gfr_item = next(
        (it for it in res10.items if "144(xi)" in it["title"] or "Land Border" in it["title"]),
        None,
    )
    assert gfr_item is not None, "Missing GFR 144(xi) land border requirement on 10_NHAI"
    assert "land border" in gfr_item["provenance"]["verbatimQuote"].lower()

    # c. HiSilicon camera chipset ban is extracted
    hisilicon_item = next((it for it in res10.items if "HiSilicon" in it["title"]), None)
    assert hisilicon_item is not None, "Missing HiSilicon camera chipset ban on 10_NHAI"
    assert "hisilicon" in hisilicon_item["provenance"]["verbatimQuote"].lower()

    # d. Legal Metrology stamping validity & penalty is extracted
    metrology_item = next(
        (it for it in res10.items if "Metrology" in it["title"] or "Stamping" in it["title"]), None
    )
    assert metrology_item is not None, "Missing Legal Metrology stamping penalty on 10_NHAI"
    assert "5,00,000" in metrology_item["provenance"]["verbatimQuote"]
