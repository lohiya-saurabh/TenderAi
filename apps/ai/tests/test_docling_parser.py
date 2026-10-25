from unittest.mock import MagicMock

from tenderpulse_ai.domain.docling_parser import DoclingParserEngine
from tenderpulse_ai.domain.models import DoclingParsedDocument


def test_docling_parser_fallback_normalization():
    """Verify DoclingParserEngine constructs valid Docling JSON AST structure."""
    engine = DoclingParserEngine(use_native_if_available=False)
    assert engine.is_native_available() is False

    pages = [
        {
            "page_number": 1,
            "text": "PART I: INVITATION FOR BIDS\nSection 1: General Information\n1.1 Scope of Work\nThe contractor shall execute the project according to specifications.",
        },
        {
            "page_number": 2,
            "text": "Item No | Description | Quantity\n1 | Steel bars | 50 MT\n2 | Cement bags | 500 Bags",
        },
    ]

    doc = engine.parse_document(
        document_id="doc_nit_test",
        file_name="NIT.pdf",
        pages=pages,
    )

    assert isinstance(doc, DoclingParsedDocument)
    assert doc.document_id == "doc_nit_test"
    assert doc.file_name == "NIT.pdf"
    assert len(doc.pages) == 2

    # Check headings
    heading_blocks = [b for b in doc.blocks if b.type == "heading"]
    assert len(heading_blocks) >= 2
    assert any(b.text.startswith("PART I") and b.level == 1 for b in heading_blocks)
    assert any("Section 1" in b.text and b.level == 2 for b in heading_blocks)

    # Check tables
    assert len(doc.tables) >= 1
    table = doc.tables[0]
    assert table.page_number == 2
    assert "Steel bars" in table.rows[0][1]


def test_docling_native_adapter_mapping():
    """Verify _map_native_docling_document correctly maps official DoclingDocument AST."""
    engine = DoclingParserEngine(use_native_if_available=False)

    # Mock an official docling DoclingDocument
    mock_doc = MagicMock()

    # Mock pages
    mock_doc.pages = {
        1: MagicMock(size={"width": 595.0, "height": 842.0}),
        2: MagicMock(size={"width": 595.0, "height": 842.0}),
    }

    # Mock block item with prov
    mock_prov = MagicMock()
    mock_prov.page_no = 1
    mock_bbox = MagicMock()
    mock_bbox.as_tuple.return_value = (50.0, 100.0, 500.0, 120.0)
    mock_prov.bbox = mock_bbox

    mock_item_heading = MagicMock()
    mock_item_heading.text = "SECTION 4: TECHNICAL ELIGIBILITY"
    mock_item_heading.label = "section_heading"
    mock_item_heading.prov = [mock_prov]

    mock_item_para = MagicMock()
    mock_item_para.text = "The bidder must submit valid ISO 9001 certification."
    mock_item_para.label = "paragraph"
    mock_item_para.prov = [mock_prov]

    mock_doc.iterate_items.return_value = [
        (mock_item_heading, 1),
        (mock_item_para, 2),
    ]

    # Mock table
    mock_table = MagicMock()
    mock_table_prov = MagicMock()
    mock_table_prov.page_no = 1
    mock_table.prov = [mock_table_prov]
    mock_cell1 = MagicMock(text="Criteria")
    mock_cell2 = MagicMock(text="Minimum Turnover")
    mock_cell3 = MagicMock(text="Roads")
    mock_cell4 = MagicMock(text="50 Cr")
    mock_table.data.grid = [[mock_cell1, mock_cell2], [mock_cell3, mock_cell4]]
    # Delete export_to_dataframe attribute so it tests grid extraction
    del mock_table.export_to_dataframe
    mock_doc.tables = [mock_table]

    parsed = engine._map_native_docling_document(
        document_id="doc_mock_123",
        file_name="tender.pdf",
        doc=mock_doc,
    )

    assert parsed.document_id == "doc_mock_123"
    assert len(parsed.pages) == 2
    assert len(parsed.blocks) == 2
    assert parsed.blocks[0].type == "heading"
    assert parsed.blocks[0].bbox == [50.0, 100.0, 500.0, 120.0]
    assert parsed.blocks[1].type == "paragraph"
    assert len(parsed.tables) == 1
    assert parsed.tables[0].headers == ["Criteria", "Minimum Turnover"]
    assert parsed.tables[0].rows == [["Roads", "50 Cr"]]


def test_docling_parser_running_furniture_stripping():
    engine = DoclingParserEngine(use_native_if_available=False)
    page_text = (
        "IHMCL / NIT / 2026 / 01\n"
        "Page 1 of 142\n"
        "SECTION 1: GENERAL INFORMATION\n"
        "This is the actual operative clause for the project.\n"
        "- 1 -"
    )
    doc = engine.parse_document(
        document_id="doc_furn_test",
        file_name="tender.pdf",
        pages=[{"page_number": 1, "text": page_text}],
    )
    block_texts = [b.text for b in doc.blocks]
    assert not any("Page 1 of 142" in t for t in block_texts)
    assert not any("IHMCL" in t for t in block_texts)
    assert not any("- 1 -" in t for t in block_texts)
    assert any("SECTION 1: GENERAL INFORMATION" in t for t in block_texts)


def test_docling_parser_deleted_clause_marking():
    engine = DoclingParserEngine(use_native_if_available=False)
    page_text = (
        "Clause 46: Advance Payment - Deleted.\nContract Data 7.1: Subcontracting is omitted."
    )
    doc = engine.parse_document(
        document_id="doc_del_test",
        file_name="tender.pdf",
        pages=[{"page_number": 1, "text": page_text}],
    )
    assert any(b.is_deleted for b in doc.blocks)


def test_docling_parser_spatial_whitespace_table():
    engine = DoclingParserEngine(use_native_if_available=False)
    page_text = (
        "SECTION 3: ELIGIBILITY CRITERIA\n"
        "Sl. No.    Qualification Criteria       Threshold Requirement\n"
        "1          Annual Turnover              Rs. 50 Crores\n"
        "2          Net Worth                    Rs. 10 Crores\n"
    )
    doc = engine.parse_document(
        document_id="doc_spatial_test",
        file_name="tender.pdf",
        pages=[{"page_number": 1, "text": page_text}],
    )
    assert len(doc.tables) == 1
    tbl = doc.tables[0]
    assert "Annual Turnover" in tbl.rows[0][1]
    assert tbl.row_key_map.get("1") == "Annual Turnover | Rs. 50 Crores"


def test_docling_parser_paragraph_coalescing():
    engine = DoclingParserEngine(use_native_if_available=False)
    page_text = (
        "SECTION 2: OBLIGATIONS\n"
        "The contractor shall main-\n"
        "tain continuous traffic flow and\n"
        "deploy certified safety marshals."
    )
    doc = engine.parse_document(
        document_id="doc_coalesce_test",
        file_name="tender.pdf",
        pages=[{"page_number": 1, "text": page_text}],
    )
    paras = [b for b in doc.blocks if b.type == "paragraph"]
    assert len(paras) == 1
    assert (
        paras[0].text
        == "The contractor shall maintain continuous traffic flow and deploy certified safety marshals."
    )
