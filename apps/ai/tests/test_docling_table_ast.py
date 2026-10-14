import pytest
from tenderpulse_ai.domain.docling_parser import DoclingParserEngine
from tenderpulse_ai.domain.models import DoclingTable


def test_docling_table_markdown_and_record_serialization():
    table = DoclingTable(
        table_id="tbl_1_1",
        page_number=1,
        headers=["Financial Year", "Audited Turnover (INR Cr)", "UDIN Status"],
        rows=[
            ["FY 2021-22", "42.50", "Verified"],
            ["FY 2022-23", "55.80", "Verified"],
            ["FY 2023-24", "61.20", "Verified"],
        ],
    )

    # 1. Test Markdown generation
    md = table.to_markdown()
    assert "| Financial Year | Audited Turnover (INR Cr) | UDIN Status |" in md
    assert "| --- | --- | --- |" in md
    assert "| FY 2021-22 | 42.50 | Verified |" in md

    # 2. Test Record Dict mapping
    records = table.to_dict_records()
    assert len(records) == 3
    assert records[0]["Financial Year"] == "FY 2021-22"
    assert records[0]["Audited Turnover (INR Cr)"] == "42.50"

    # 3. Test Cell Retrieval
    assert table.get_cell(1, "Audited Turnover (INR Cr)") == "55.80"
    assert table.get_cell(99, "NonExistent") is None


def test_docling_parser_parses_pipe_delimited_table_with_bboxes():
    parser = DoclingParserEngine(use_native_if_available=False)

    text_with_table = """
SECTION 4: FINANCIAL CRITERIA

The bidder must submit turnover figures in the format below:

| Financial Year | Required Turnover (Cr) | Minimum Net Worth (Cr) |
| -------------- | ---------------------- | ---------------------- |
| 2021-22        | 40.00                  | 10.00                  |
| 2022-23        | 45.00                  | 12.00                  |
| 2023-24        | 50.00                  | 15.00                  |

All certificates must be signed by statutory auditor.
"""

    doc = parser.parse_document(
        document_id="doc_financial_01",
        file_name="tender_nit.pdf",
        pages=[{"page_number": 1, "text": text_with_table}],
    )

    assert len(doc.tables) >= 1
    table = doc.tables[0]
    assert table.headers == ["Financial Year", "Required Turnover (Cr)", "Minimum Net Worth (Cr)"]
    assert len(table.rows) == 3
    assert table.rows[0][0] == "2021-22"
    assert table.rows[0][1] == "40.00"

    # Verify blocks contain bounding box coordinates
    assert len(doc.blocks) > 0
    first_block = doc.blocks[0]
    assert first_block.bbox is not None
    assert len(first_block.bbox) == 4
