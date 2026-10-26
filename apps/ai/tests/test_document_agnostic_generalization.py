"""Document-agnostic generalization: structural algorithms, never tender-specific strings.

Each case uses wording that appears in NO benchmark tender (LiDAR instead of drone surveys,
SAP Ariba instead of a Data Lake portal, a Rs. 12 crore threshold instead of Rs. 5 crore)
to prove the engine does not depend on remembered phrases.
"""

from tenderpulse_ai.domain.docling_parser import (
    DoclingParserEngine,
    detect_repeated_furniture,
    stitch_cross_page_continuations,
)
from tenderpulse_ai.domain.models import DoclingBlock, VerifiedComplianceItem
from tenderpulse_ai.domain.structure_builder import ClauseTracker, DocumentStructureBuilder
from tenderpulse_ai.extraction.clause_references import (
    attribute_positional_clause_refs,
)
from tenderpulse_ai.extraction.contracts import DocumentExtractionRequest
from tenderpulse_ai.extraction.deduplication import (
    consolidate_verified_items,
    quote_overlap_ratio,
)
from tenderpulse_ai.security.context import SecurityContext


def _wrap(page: int, text: str) -> str:
    return (
        f'<untrusted_document_data document_id="d" page="{page}">{text}</untrusted_document_data>'
    )


def test_clause_tracker_positional_paths_ignore_mid_sentence_references():
    tracker = ClauseTracker()
    paths = [
        tracker.feed(t)
        for t in [
            "7. The Service Provider is required to:",
            "iv. Conduct a LiDAR survey monthly as per policy circular no. 42.17/2024;",
            "v. Upload reports in the format at Annexure-IX;",
            "8. Eligibility of bidders",
            "A. Criteria for sole bidder.",
            "1. The bidder should have executed two similar works.",  # table row, not a reset
            "B. Criteria for consortium members.",
            "Note: (1) Both conditions are to be fulfilled.",
            "(2) In case of consortium the lead member shall meet 60%.",
            "(ii) The following works shall not be counted:",
            "(a) Works below Rs. 1 crore.",
            "(iii) The bidder shall submit Form T-4.",
        ]
    ]
    assert paths == [
        "Clause 7",
        "Clause 7(iv)",
        "Clause 7(v)",
        "Clause 8",
        "Clause 8.A",
        "Clause 8.A(1)",
        "Clause 8.B",
        "Clause 8.B(1)",
        "Clause 8.B(2)",
        "Clause 8.B(ii)",
        "Clause 8.B(ii)(a)",
        "Clause 8.B(iii)",
    ]


def test_cross_page_stitcher_merges_lowercase_and_unterminated_continuations():
    blocks = [
        DoclingBlock(
            block_id="b1", text="The minimum average annual turnover of the bidder", page_number=4
        ),
        DoclingBlock(block_id="b2", text="shall not be less than Rs. 12 crore.", page_number=5),
        DoclingBlock(block_id="b3", text="9. Bid validity shall be 120 days.", page_number=5),
    ]
    stitched = stitch_cross_page_continuations(blocks)
    assert [b.block_id for b in stitched] == ["b1", "b3"]
    assert stitched[0].text.endswith("not be less than Rs. 12 crore.")
    assert stitched[0].spans_next_page is True


def test_new_structural_unit_on_next_page_is_not_stitched():
    blocks = [
        DoclingBlock(block_id="b1", text="The bidder shall submit the following", page_number=2),
        DoclingBlock(block_id="b2", text="(iii) Audited balance sheets.", page_number=3),
    ]
    assert len(stitch_cross_page_continuations(blocks)) == 2


def test_repeated_running_furniture_detected_without_issuer_names():
    pages = [
        f"ACME METRO RAIL CORP / RFP / 2027\nBody text {i}\nPage {i} of 9" for i in range(1, 6)
    ]
    furniture = detect_repeated_furniture(pages)
    assert any("acme metro rail corp" in k for k in furniture)
    doc = DoclingParserEngine(use_native_if_available=False).parse_document(
        "d", "f.pdf", [{"page_number": i + 1, "text": t} for i, t in enumerate(pages)]
    )
    assert not any("ACME METRO RAIL CORP" in b.text for b in doc.blocks)


def test_parser_splits_multi_letter_roman_and_inline_sub_clauses():
    page = (
        "12. (A) The Bidder may include an associate for equipment.\n"
        "(B) In addition, the Bidder may include an associate for key personnel.\n"
        "13. The Service Provider is broadly required to:\n"
        "xiv. Maintain the asset register;\n"
        "xv. Integrate with SAP Ariba for all purchase orders;\n"
    )
    doc = DoclingParserEngine(use_native_if_available=False).parse_document(
        "d", "f.pdf", [{"page_number": 1, "text": page}]
    )
    tree = DocumentStructureBuilder().build_structure(doc)
    by_text = {b.text.split()[0]: tree.block_paths.get(b.block_id) for b in doc.blocks}
    assert by_text["12."] == "Clause 12(A)"
    assert by_text["(B)"] == "Clause 12(B)"
    assert by_text["xiv."] == "Clause 13(xiv)"
    assert by_text["xv."] == "Clause 13(xv)"


def _verified(cat: str, title: str, quote: str, page: int) -> VerifiedComplianceItem:
    return VerifiedComplianceItem.model_validate(
        {
            "category": cat,
            "title": title,
            "description": title,
            "execution_rules": {},
            "provenance": {"page_number": page, "verbatim_quote": quote, "clause_reference": "x"},
        }
    )


def test_cross_category_duplicate_merged_most_specific_category_wins():
    quote = "Annual turnover of the firm should be equal to or more than Rs. 12 crore."
    req = DocumentExtractionRequest(
        security_context=SecurityContext(
            tenant_id="t",
            user_id="u",
            workflow_run_id="r",
            allowed_document_ids=["d"],
            allowed_source_ids=["s"],
            purpose="COMPLIANCE_EXTRACTION",
        ),
        bid_id="b",
        document_id="d",
        file_name="f.pdf",
    )
    items = consolidate_verified_items(
        [
            _verified("TECHNICAL", "Technical Qualification & Annual Turnover", quote, 5),
            _verified("FINANCIAL", "Minimum Annual Turnover Threshold (Rs. 12 crore)", quote, 5),
        ],
        req,
    )
    assert len(items) == 1 and items[0]["category"] == "FINANCIAL"
    assert quote_overlap_ratio(quote, quote[:40]) == 1.0


def test_positional_attribution_replaces_regex_guess():
    page = (
        "5. The Service Provider is required to:\n"
        "xix. To conduct LiDAR survey monthly as per policy circular no. 42.17/2024;\n"
    )
    doc = DoclingParserEngine(use_native_if_available=False).parse_document(
        "d", "f.pdf", [{"page_number": 2, "text": page}]
    )
    tree = DocumentStructureBuilder().build_structure(doc)
    item = _verified(
        "TECHNICAL",
        "LiDAR",
        "To conduct LiDAR survey monthly as per policy circular no. 42.17/2024",
        2,
    )
    item.provenance.clause_reference = "Clause 42.17 (Page 2)"
    assert attribute_positional_clause_refs([item], doc, tree) == 1
    assert item.provenance.clause_reference == "Clause 5(xix) (Page 2)"


# ------------------------------------------------------------------------------
# Layout-aware page text, OCR, merge integrity, clause keywords, ingestion mode
# ------------------------------------------------------------------------------

_NHAI_02 = "data/procurement-evidence/01_Tender_Documents/02_NHAI_Greenfield_Exp_1450Cr_NIT.pdf"
_NHAI_01 = "data/procurement-evidence/01_Tender_Documents/01_NHAI_HAM_850Cr_NIT.pdf"
_SCANNED = "data/procurement-evidence/01_Tender_Documents/08_NHAI_ATMS_Tolling_180Cr_NIT.pdf"


def test_ruled_table_rendered_row_by_row_and_joined_across_page_break():
    import os

    import pytest

    if not os.path.exists(_NHAI_02):
        pytest.skip("benchmark PDF not available")
    from tenderpulse_ai.domain.pdf_layout import extract_layout_pages

    pages = extract_layout_pages(_NHAI_02)
    # Column-interleaved in the PDFium text layer; one contiguous cell here, with the
    # page-5 continuation row joined back onto page 4.
    assert (
        "Annual turnover (average of last 5 years or in each of the preceding two years) of the "
        "firm from consultancy business should be equal to or more than Rs.5 Crores."
    ) in pages[3]
    assert "2. | Account No. | 0385201800065" in pages[2]


def test_table_rendered_table_of_contents_is_still_detected():
    import os

    import pytest

    if not os.path.exists(_NHAI_01):
        pytest.skip("benchmark PDF not available")
    from tenderpulse_ai.domain.pdf_layout import extract_layout_pages
    from tenderpulse_ai.domain.pdf_resolver import is_pure_toc_page

    pages = extract_layout_pages(_NHAI_01)
    assert "|" in pages[8] and is_pure_toc_page(pages[8])


def test_scanned_pages_are_ocred_when_tesseract_is_installed():
    import os
    import shutil

    import pytest

    if not os.path.exists(_SCANNED) or not shutil.which("tesseract"):
        pytest.skip("scanned benchmark PDF or tesseract binary not available")
    import pypdfium2

    from tenderpulse_ai.domain.pdf_layout import _ocr_image_only_pages

    pdf = pypdfium2.PdfDocument(_SCANNED)
    texts = _ocr_image_only_pages(pdf, [""] + ["x" * 40] * (len(pdf) - 1), "eng")
    assert "National Highways Authority" in texts[0]


def test_merge_adopts_title_description_and_quote_together():
    req = DocumentExtractionRequest(
        security_context=SecurityContext(
            tenant_id="t",
            user_id="u",
            workflow_run_id="r",
            allowed_document_ids=["d"],
            allowed_source_ids=["s"],
            purpose="COMPLIANCE_EXTRACTION",
        ),
        bid_id="b",
        document_id="d",
        file_name="f.pdf",
    )
    quote = "In case any partner of the joint venture has remaining bid capacity less than 0.5 the bid shall be non-responsive."
    a = _verified("EXECUTION", "Joint Venture Ineligible Partner Bid Capacity Threshold", quote, 6)
    a.description = (
        "JV partner with remaining bid capacity below 0.5 makes the JV bid non-responsive."
    )
    b = _verified("EXECUTION", "Joint Venture & Consortium Agreement", quote + " Lead member", 6)
    b.description = "Joint Venture agreement / Consortium MOU defining lead member equity."
    items = consolidate_verified_items([a, b], req)
    assert len(items) == 1
    pair = {(a.title, a.description), (b.title, b.description)}
    assert (items[0]["title"], items[0]["description"]) in pair


def test_clause_tracker_handles_chapters_rules_paragraphs_and_roman_numbering():
    tracker = ClauseTracker()
    assert tracker.feed("Chapter 3 Eligibility of Bidders") == "Chapter 3"
    assert tracker.feed("Rule 12 The bidder shall furnish the GST registration.") == "Rule 12"
    assert tracker.feed("(b) A copy of PAN shall be enclosed.") == "Rule 12(b)"
    assert tracker.feed("Section IV General Conditions") == "Section IV"
    assert tracker.feed("Article VII Indemnity") == "Article VII"
    assert tracker.feed("Paragraph 4.1 The Contractor shall indemnify the Employer.") == (
        "Paragraph 4.1"
    )
