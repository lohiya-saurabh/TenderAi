
from tenderpulse_ai.pipeline import (
    default_tender_extractor,
    extract_clause_reference,
    extract_monetary_amounts,
    extract_percentages,
    extract_temporal_durations,
)


def test_extract_temporal_durations_arbitrary_values():
    """Proves that temporal duration extraction works for arbitrary numbers and units."""
    samples = [
        ("within 30 days of LOA", 30, "days"),
        ("within 45 (forty-five) days", 45, "days"),
        ("within a period of 90 days", 90, "days"),
        ("no later than 120 (one hundred and twenty) days", 120, "days"),
        ("shall be satisfied within 180 days", 180, "days"),
        ("for a period of 365 days", 365, "days"),
        ("910th (nine hundred and tenth) day from Appointed Date", 910, "days"),
        ("valid for a duration of 3 years", 3, "years"),
        ("rectification within 24 hours", 24, "hours"),
        ("within 18 months", 18, "months"),
    ]
    for text, expected_val, expected_unit in samples:
        res = extract_temporal_durations(text)
        assert len(res) >= 1, f"Failed to extract duration from: {text}"
        assert res[0]["value"] == expected_val
        assert res[0]["unit"] == expected_unit


def test_extract_monetary_amounts_arbitrary_values():
    """Proves that currency/monetary extraction supports arbitrary amounts."""
    samples = [
        ("Rs. 10 lakh", 10.0, "lakh"),
        ("Rs. 25 lakh", 25.0, "lakh"),
        ("Rs. 50 lakh", 50.0, "lakh"),
        ("Rs. 1 crore", 1.0, "crore"),
        ("₹2.5 crore", 2.5, "crore"),
        ("Rs. 40.09 crore", 40.09, "crore"),
        ("25,00,000 (rupees twenty five lakh)", 2500000, "INR"),
        ("₹ 100 crore", 100.0, "crore"),
    ]
    for text, expected_val, expected_unit in samples:
        res = extract_monetary_amounts(text)
        assert len(res) >= 1, f"Failed to extract monetary amount from: {text}"
        assert res[0]["value"] == expected_val
        assert res[0]["unit"] == expected_unit


def test_extract_percentages_arbitrary_values():
    """Proves percentage extraction supports arbitrary rates."""
    samples = [
        ("0.1% (zero point one per cent)", 0.1),
        ("0.5% per week", 0.5),
        ("penalty of 5%", 5.0),
        ("advance of 10%", 10.0),
        ("not less than 40%", 40.0),
        ("equity holding of 74%", 74.0),
        ("minimum 26% shareholding", 26.0),
    ]
    for text, expected_val in samples:
        res = extract_percentages(text)
        assert len(res) >= 1, f"Failed to extract percentage from: {text}"
        assert res[0]["value"] == expected_val


def test_extract_clause_hierarchy_arbitrary_structures():
    """Proves dynamic hierarchy recognition for arbitrary clauses, articles, schedules, annexures, and numbers."""
    samples = [
        ("Clause 9.1.1 Performance Security", "Clause 9.1.1 (Page 5)"),
        ("Clause 7.3.2 Defect Rectification", "Clause 7.3.2 (Page 5)"),
        ("Clause 14.8 Taking Over Certificate", "Clause 14.8 (Page 5)"),
        ("Clause 3.1.4 Bidder Eligibility", "Clause 3.1.4 (Page 5)"),
        ("ARTICLE 12 OBLIGATIONS OF THE CONCESSIONAIRE", "ARTICLE 12 (Page 5)"),
        ("Article 4 Conditions Precedent", "Article 4 (Page 5)"),
        ("Schedule IV Penalty Matrix", "Schedule IV (Page 5)"),
        ("SCHEDULE-G Project Completion Schedule", "SCHEDULE-G (Page 5)"),
        ("Annexure A Format for Bank Guarantee", "Annexure A (Page 5)"),
        ("Appendix IB Financial Proposal", "Appendix IB (Page 5)"),
        ("4.2.7 The Contractor shall submit monthly reports", "Clause 4.2.7 (Page 5)"),
        ("1.1.1 Applicable Standards", "Clause 1.1.1 (Page 5)"),
        ("1 Scope of the Project", "Clause 1 (Page 5)"),
    ]
    for text, expected_ref in samples:
        ref = extract_clause_reference(text, 5)
        assert ref == expected_ref, f"Expected '{expected_ref}' but got '{ref}' for text: {text}"


def test_regression_different_durations_same_pipeline():
    """
    Document A: 120 days post-termination defect liability.
    Document B: 90 days post-termination defect liability.
    Document C: 180 days post-termination defect liability.
    Both must be extracted successfully with each retaining its own value without code changes.
    """
    doc_a = (
        '<untrusted_document_data document_id="doc_a" page="70">\n'
        "Clause 39.1 Defect Liability: The Concessionaire shall remedy defects and deficiencies in the project highway "
        "for a period of 120 (one hundred and twenty) days after termination of this Agreement.\n"
        "</untrusted_document_data>"
    )
    doc_b = (
        '<untrusted_document_data document_id="doc_b" page="70">\n'
        "Clause 18.4 Defect Liability: The Contractor shall remedy defects and deficiencies in the works "
        "for a period of 90 (ninety) days after termination of this Agreement.\n"
        "</untrusted_document_data>"
    )
    doc_c = (
        '<untrusted_document_data document_id="doc_c" page="70">\n'
        "Clause 22.3 Defect Liability: The Concessionaire shall remedy defects and deficiencies "
        "for a period of 180 (one hundred and eighty) days after termination of this Agreement.\n"
        "</untrusted_document_data>"
    )

    items_a = default_tender_extractor("sys", doc_a)
    items_b = default_tender_extractor("sys", doc_b)
    items_c = default_tender_extractor("sys", doc_c)

    item_a = next(i for i in items_a if "Post-Termination" in i.title)
    item_b = next(i for i in items_b if "Post-Termination" in i.title)
    item_c = next(i for i in items_c if "Post-Termination" in i.title)

    assert "120-Day" in item_a.title
    assert "90-Day" in item_b.title
    assert "180-Day" in item_c.title

    assert "120-day" in item_a.description
    assert "90-day" in item_b.description
    assert "180-day" in item_c.description

    assert "39.1" in item_a.provenance.clause_reference
    assert "18.4" in item_b.provenance.clause_reference
    assert "22.3" in item_c.provenance.clause_reference


def test_regression_different_clauses_same_pipeline():
    """
    Tests Performance Security under different clause numbers:
    Document A: Clause 9.1.1
    Document B: Clause 7.3.2
    Document C: Clause 3.1.4
    """
    doc_a = (
        '<untrusted_document_data document_id="doc_a" page="45">\n'
        "Clause 9.1.1 The Concessionaire shall provide to the Authority an irrevocable and unconditional "
        "performance bank guarantee for due performance of the contract.\n"
        "</untrusted_document_data>"
    )
    doc_b = (
        '<untrusted_document_data document_id="doc_b" page="45">\n'
        "Clause 7.3.2 The Contractor shall furnish an irrevocable and unconditional "
        "performance bank guarantee within 30 days of LOA.\n"
        "</untrusted_document_data>"
    )
    doc_c = (
        '<untrusted_document_data document_id="doc_c" page="45">\n'
        "Clause 3.1.4 The Bidder shall submit a performance security in the form of an unconditional "
        "bank guarantee prior to signing of contract.\n"
        "</untrusted_document_data>"
    )

    items_a = default_tender_extractor("sys", doc_a)
    items_b = default_tender_extractor("sys", doc_b)
    items_c = default_tender_extractor("sys", doc_c)

    item_a = next(i for i in items_a if "Performance Security" in i.title)
    item_b = next(i for i in items_b if "Performance Security" in i.title)
    item_c = next(i for i in items_c if "Performance Security" in i.title)

    assert "9.1.1" in item_a.provenance.clause_reference
    assert "7.3.2" in item_b.provenance.clause_reference
    assert "3.1.4" in item_c.provenance.clause_reference


def test_regression_different_monetary_amounts_same_pipeline():
    """
    Tests State Construction Support Grant under arbitrary amounts and tranche counts:
    Document A: Rs. 40.09 crore in 10 instalments
    Document B: Rs. 25 crore in 5 instalments
    Document C: Rs. 2.5 crore in 4 instalments
    """
    doc_a = (
        '<untrusted_document_data document_id="doc_a" page="102">\n'
        "Clause 25.5.1 Rs.40.09 crore shall be due and payable to the Concessionaire in 10 equal instalments "
        "during the Construction Period linked to milestones.\n"
        "</untrusted_document_data>"
    )
    doc_b = (
        '<untrusted_document_data document_id="doc_b" page="102">\n'
        "Clause 14.2 Rs.25 crore shall be due and payable to the Contractor in 5 equal instalments "
        "during the Construction Period linked to physical progress.\n"
        "</untrusted_document_data>"
    )
    doc_c = (
        '<untrusted_document_data document_id="doc_c" page="102">\n'
        "Clause 8.1 Rs.2.5 crore shall be due and payable to the Concessionaire in 4 equal instalments "
        "during the Construction Period.\n"
        "</untrusted_document_data>"
    )

    items_a = default_tender_extractor("sys", doc_a)
    items_b = default_tender_extractor("sys", doc_b)
    items_c = default_tender_extractor("sys", doc_c)

    item_a = next(i for i in items_a if "State Construction Support Grant" in i.title)
    item_b = next(i for i in items_b if "State Construction Support Grant" in i.title)
    item_c = next(i for i in items_c if "State Construction Support Grant" in i.title)

    assert "40.09 Crore" in item_a.title
    assert "10 Tranches" in item_a.title
    assert "25 Crore" in item_b.title
    assert "5 Tranches" in item_b.title
    assert "2.5 Crore" in item_c.title
    assert "4 Tranches" in item_c.title


def test_regression_different_accident_liabilities_same_pipeline():
    """
    Tests accident strict liability under arbitrary compensation values:
    Document A: Rs. 25 lakh per fatality, Rs. 10 lakh per grievous injury
    Document B: Rs. 50 lakh per fatality, Rs. 20 lakh per grievous injury
    Document C: Rs. 2 crore per fatality, Rs. 50 lakh per grievous injury
    """
    doc_a = (
        '<untrusted_document_data document_id="doc_a" page="82">\n'
        "Clause 17.5.4 In case of accident caused by project defect, the Concessionaire shall be liable to pay "
        "Rs. 25 lakh for each fatality in such accident and Rs. 10 lakh for each grievous injury.\n"
        "</untrusted_document_data>"
    )
    doc_b = (
        '<untrusted_document_data document_id="doc_b" page="82">\n'
        "Clause 11.2 In case of accident, the Concessionaire shall be liable to pay "
        "Rs. 50 lakh for each fatality in such accident and Rs. 20 lakh for each grievous injury.\n"
        "</untrusted_document_data>"
    )
    doc_c = (
        '<untrusted_document_data document_id="doc_c" page="82">\n'
        "Clause 29.7 In the event of fatal accident, the Contractor shall be liable to pay "
        "Rs. 2 crore for each fatality in such accident and Rs. 50 lakh for each grievous injury.\n"
        "</untrusted_document_data>"
    )

    items_a = default_tender_extractor("sys", doc_a)
    items_b = default_tender_extractor("sys", doc_b)
    items_c = default_tender_extractor("sys", doc_c)

    item_a = next(i for i in items_a if "Accident Fatality" in i.title)
    item_b = next(i for i in items_b if "Accident Fatality" in i.title)
    item_c = next(i for i in items_c if "Accident Fatality" in i.title)

    assert "Rs. 25 Lakh" in item_a.description
    assert "Rs. 10 Lakh" in item_a.description

    assert "Rs. 50 Lakh" in item_b.description
    assert "Rs. 20 Lakh" in item_b.description

    assert "Rs. 2 Crore" in item_c.description
    assert "Rs. 50 Lakh" in item_c.description
