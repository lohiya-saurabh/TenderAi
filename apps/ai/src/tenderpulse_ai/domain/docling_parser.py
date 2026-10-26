import logging
import re
import time
from pathlib import Path
from typing import Any

from tenderpulse_ai.domain.models import DoclingBlock, DoclingParsedDocument, DoclingTable

logger = logging.getLogger("tenderpulse_ai.docling")

TABLE_LEAD_IN_PATTERN = re.compile(
    r"(?:(?:Sl\.?\s*No\.?|Particulars|Account\s*Name|Account\s*No\.?|IFSC|Beneficiary|Bank\s*Name|Branch)\b|Table\s*[-–—:]?\s*\d*|\b(?:as per details below|given below|following details|bank details)\b)",
    re.IGNORECASE,
)

TABLE_ROW_PATTERN = re.compile(
    r"^\s*(?:\d+[.)]\s+)?(?:Type\s*of\s*Account|Type|Name\s*of|Account|IFSC|Bank|Branch|Particulars|Details|Fee|Amount|Beneficiary|Tender Fee|EMD|Rate|Description|Item|Unit|Quantity|Mode|Payment|Canara|SBI|RTGS|NEFT|DD|FDR|BG|Table(?:\s*[-–—:]?\s*\d+)?|Canara Bank|State Bank|HDFC|ICICI|PNB|(?:Sl|Sr|S)\.?\s*No\.?)\b",
    re.IGNORECASE,
)

RUNNING_FURNITURE_PATTERN = re.compile(
    r"^(?:"
    r"Page\s+\d+(?:\s+of\s+\d+)?|"
    r"\d+\s+of\s+\d+|"
    r"-\s*\d+\s*-|"
    # Document reference codes repeated as running headers: "ABC / NIT / 2026 / 01"
    r"[A-Z0-9&.\-]+(?:\s*/\s*[A-Z0-9&.\-]+){2,}|"
    r"RFP\s+FOR\s+SELECTION\b.*|"
    r"BID\s+DOCUMENT\b.*|"
    r"(?:NIT|RFP)\s*(?:No\.?|Reference)?\s*[:\-–]?\s*[A-Za-z0-9/_-]+"
    r")\s*$",
    re.IGNORECASE,
)

DELETED_CLAUSE_PATTERN = re.compile(
    r"[-–—]?\s*(?:\[|\()?\s*(?:DELETED|Deleted|Omitted|OMITTED)\s*(?:\]|\))?\.?\s*$|"
    r"\[\s*[-–—]?\s*(?:DELETED|Deleted|Omitted|OMITTED)\s*\]\.?\s*$|"
    r"\(\s*[-–—]?\s*(?:DELETED|Deleted|Omitted|OMITTED)\s*\)\.?\s*$|"
    r"\b(?:is\s+deleted|stands?\s+deleted|has\s+been\s+deleted|have\s+been\s+deleted|is\s+omitted|stands?\s+omitted)\b|"
    r"^(?:Clause|Sub-Clause|Section|Article|Form|Annexure)\s+[\d.A-Za-z]+\s*[-–—:]\s*(?:\[|\()?\s*(?:DELETED|Deleted|Omitted|OMITTED)\s*(?:\]|\))?\.?\s*$",
    re.IGNORECASE | re.MULTILINE,
)

INLINE_DELETED_PATTERN = re.compile(
    r"[-–—]\s*(?:\[|\()?\s*(?:DELETED|Deleted|Omitted|OMITTED)\s*(?:\]|\))?\.?(?:\s+|$)|"
    r"\[\s*[-–—]?\s*(?:DELETED|Deleted|Omitted|OMITTED)\s*\]\.?(?:\s+|$)|"
    r"\(\s*[-–—]?\s*(?:DELETED|Deleted|Omitted|OMITTED)\s*\)\.?(?:\s+|$)|"
    r"\b(?:is\s+deleted|stands?\s+deleted|has\s+been\s+deleted|have\s+been\s+deleted|is\s+omitted|stands?\s+omitted)\b|"
    r"\b(?:DELETED|OMITTED)\.?\s*$",
    re.IGNORECASE | re.MULTILINE,
)

TABLE_HEADER_START_PATTERN = re.compile(
    r"^(?:[0-9]+[.)]?|[A-Za-z][.)]|(?:Sl|Sr|S)\.?\s*No\.?|"
    r"Item|Description|Criteria|Milestone|Deliverable|Parameter|Component|"
    r"Activity|Stage|Phase|Personnel|Position|Designation|Role|Scope|"
    r"Fee|Amount|Percentage|Value|Cost|Price|Rate|Year|Date|Duration|"
    r"Period|Month|Category|Particulars|Details|Bank|Account|IFSC|"
    r"Turnover|Experience|Financial\s+Year|Key\s+Expert|Form|Schedule)\b",
    re.IGNORECASE,
)


LIST_MARKER_PATTERN = re.compile(
    r"^\s*(?:"
    r"\([A-Za-z\d]{1,4}\)\s+"  # (a) (iv) (12) (B)
    r"|(?:[ivxlc]{2,6}|[IVXLC]{2,6}|[a-z])[.)]\s+(?=[A-Z(“\"'])"  # xv. Providing / a) The
    r"|[A-Za-z\d]\.\s+"  # a. / B. / 5.
    r"|(?i:Note)\s*:?\s*\(\d{1,2}\)"  # Note: (1)
    r"|[*•-]\s+"
    r")"
)

# A line that opens a new structural unit: never a mid-sentence continuation.
STRUCTURAL_START_PATTERN = re.compile(
    r"^\s*(?:(?:PART|SECTION|ARTICLE|CLAUSE|SCHEDULE|ANNEXURE|APPENDIX)\b|\d{1,3}(?:\.\d{1,3})*[.)]\s|[A-Z]\.\s)",
    re.IGNORECASE,
)


def _furniture_key(line: str) -> str:
    return re.sub(r"\d+", "#", " ".join(line.lower().split()))[:120]


def detect_repeated_furniture(page_texts: list[str]) -> set[str]:
    """Document-agnostic running header/footer detection: an edge line (top/bottom 3) whose
    digit-normalized form recurs on >= 30% of pages (min 3) is furniture, whatever the issuer."""
    if len(page_texts) < 3:
        return set()
    counts: dict[str, int] = {}
    for text in page_texts:
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        for key in {_furniture_key(ln) for ln in lines[:3] + lines[-3:]}:
            counts[key] = counts.get(key, 0) + 1
    threshold = max(3, int(0.3 * len(page_texts)))
    return {k for k, c in counts.items() if c >= threshold}


def stitch_cross_page_continuations(blocks: list[DoclingBlock]) -> list[DoclingBlock]:
    """Merges a paragraph sliced by a physical page break (Page N -> Page N+1).

    The first paragraph of page N+1 is a continuation when it starts lowercase, or when
    page N's last paragraph has no terminal punctuation and page N+1 does not open a new
    structural unit (numbered clause, sub-clause, PART/SECTION...).
    """
    stitched: list[DoclingBlock] = []
    for curr in blocks:
        prev = stitched[-1] if stitched else None
        if (
            prev is not None
            and curr.page_number == prev.page_number + 1
            and prev.type == "paragraph"
            and curr.type == "paragraph"
            and not prev.is_deleted
            and not curr.is_deleted
        ):
            prev_text, curr_text = prev.text.rstrip(), curr.text.lstrip()
            opens_unit = bool(
                STRUCTURAL_START_PATTERN.match(curr_text) or LIST_MARKER_PATTERN.match(curr_text)
            )
            starts_lower = curr_text[:1].islower()
            prev_incomplete = not prev_text.endswith((".", ";", ":", "?", "!", ")", "|"))
            if not opens_unit and (starts_lower or prev_incomplete):
                prev.text = f"{prev_text} {curr_text}"
                prev.spans_next_page = True
                continue
        stitched.append(curr)
    return stitched


def _row_as_key_values(headers: list[str], cells: list[str]) -> str:
    """Universal key-value row: 'Header 2: cell 2 | Header 3: cell 3' (headers when aligned)."""
    pairs = []
    for idx, cell in enumerate(cells[1:], start=1):
        if not cell:
            continue
        header = headers[idx] if len(headers) == len(cells) and idx < len(headers) else ""
        pairs.append(f"{header}: {cell}" if header else cell)
    return " | ".join(pairs)


def is_clause_deleted(heading_or_text: str) -> bool:
    """Checks whether text ends with or contains an operative deletion/omission marker."""
    cleaned = (heading_or_text or "").strip()
    return bool(DELETED_CLAUSE_PATTERN.search(cleaned) or INLINE_DELETED_PATTERN.search(cleaned))


def _is_valid_continuing_table_row(
    active_table: DoclingTable | None, spatial_cols: list[str], line: str
) -> bool:
    if active_table is None:
        return False
    # 1. If first cell starts with row marker (e.g. "1", "2.", "a)", "•")
    if re.match(r"^(?:[0-9]+[.)]?|[A-Za-z][.)]|•|\-|\*)\s*", spatial_cols[0]):
        return True
    # 2. If matching column count and not full prose sentence
    if len(spatial_cols) == len(active_table.headers):
        if not re.search(r"\b(shall|must|is required to|will be|hereby)\b", line, re.IGNORECASE):
            return True
    # 3. If line starts with major heading marker
    if re.match(
        r"^(PART\s+[I|V|X]+|SECTION\s+\d+|ARTICLE\s+\d+|CLAUSE\s+\d+|\d+\.\d+(?:\.\d+)*[.)]?\s+[A-Za-z]|Note\b)",
        line,
        re.IGNORECASE,
    ):
        return False
    # 4. If first cell is long prose with stop words, it's not a table
    if len(spatial_cols[0]) > 40 and re.search(
        r"\b(this|that|with|from|where|which)\b", spatial_cols[0], re.IGNORECASE
    ):
        return False
    return False
    if line.strip().endswith(".") and len(spatial_cols) != len(active_table.headers):
        return False
    return len(spatial_cols) >= 2


try:
    from docling.document_converter import DocumentConverter

    DOCLING_AVAILABLE = True
except ImportError:
    DocumentConverter = None  # type: ignore[assignment,misc]
    DOCLING_AVAILABLE = False


class DoclingParserEngine:
    """Node 1 - PDF to Docling Converter.

    Supports native IBM Docling (https://docling-project.github.io/docling)
    via DocumentConverter when available, with layout-preserving fallback
    for lightweight testing and environments without PyTorch/OCR weights.

    Output Contract:
    {
        "document_id": "...",
        "pages": [...],
        "blocks": [...],
        "tables": [...]
    }
    """

    def __init__(self, use_native_if_available: bool = True):
        self.use_native = use_native_if_available and DOCLING_AVAILABLE
        self._converter = DocumentConverter() if self.use_native and DocumentConverter else None

    def is_native_available(self) -> bool:
        return self.use_native

    def parse_pdf_file(
        self,
        document_id: str,
        pdf_path: str | Path,
    ) -> DoclingParsedDocument:
        """Parse a physical PDF file directly with native Docling DocumentConverter."""
        target_path = Path(pdf_path)
        if not target_path.exists():
            raise FileNotFoundError(f"PDF file not found at: {pdf_path}")

        if self.use_native and self._converter:
            try:
                conv_result = self._converter.convert(str(target_path))
                doc = conv_result.document
                return self._map_native_docling_document(document_id, target_path.name, doc)
            except Exception as e:  # noqa: BLE001
                logger.warning(
                    f"Native Docling parsing failed for {pdf_path}, falling back to text normalizer: {e}"
                )

        # Fallback if native parsing not possible or encounters an issue
        return self.parse_document(
            document_id=document_id,
            file_name=target_path.name,
            pages=[],
            raw_text=target_path.read_text(encoding="utf-8", errors="ignore"),
        )

    def _map_native_docling_document(
        self,
        document_id: str,
        file_name: str,
        doc: Any,
    ) -> DoclingParsedDocument:
        """Maps an official docling DoclingDocument AST to TenderAi DoclingParsedDocument."""
        parsed_blocks: list[DoclingBlock] = []
        parsed_tables: list[DoclingTable] = []
        parsed_pages: list[dict[str, Any]] = []

        # 1. Pages
        if hasattr(doc, "pages") and isinstance(doc.pages, dict):
            for page_no, page_obj in doc.pages.items():
                parsed_pages.append(
                    {
                        "page_number": int(page_no),
                        "size": getattr(page_obj, "size", None),
                    }
                )
        else:
            parsed_pages.append({"page_number": 1})

        # 2. Blocks / Items
        block_counter = 1
        # Docling documents provide iterate_items()
        items = doc.iterate_items() if hasattr(doc, "iterate_items") else getattr(doc, "texts", [])
        for item, _level in items:
            text = getattr(item, "text", str(item)).strip()
            if not text:
                continue

            label = str(getattr(item, "label", "paragraph")).lower()
            prov = getattr(item, "prov", None)
            page_no = 1
            bbox = None
            if prov and len(prov) > 0:
                page_no = getattr(prov[0], "page_no", 1)
                bbox_obj = getattr(prov[0], "bbox", None)
                if bbox_obj and hasattr(bbox_obj, "as_tuple"):
                    bbox = list(bbox_obj.as_tuple())

            block_type = (
                "heading"
                if "heading" in label or "title" in label or "section" in label
                else "paragraph"
            )
            heading_level = (
                1
                if "title" in label
                else (2 if "section" in label else 3)
                if block_type == "heading"
                else None
            )

            parsed_blocks.append(
                DoclingBlock(
                    block_id=f"blk_{page_no}_{block_counter}",
                    type=block_type,
                    level=heading_level,
                    text=text,
                    page_number=page_no,
                    bbox=bbox,
                )
            )
            block_counter += 1

        # 3. Tables
        tables = getattr(doc, "tables", [])
        for idx, tbl in enumerate(tables):
            t_prov = getattr(tbl, "prov", None)
            t_page = getattr(t_prov[0], "page_no", 1) if (t_prov and len(t_prov) > 0) else 1
            rows: list[list[str]] = []
            headers: list[str] = []

            # Check if export_to_dataframe exists
            if hasattr(tbl, "export_to_dataframe"):
                df = tbl.export_to_dataframe()
                headers = [str(c) for c in df.columns]
                rows = [[str(val) for val in row] for row in df.values]
            elif hasattr(tbl, "data") and hasattr(tbl.data, "grid"):
                for row_cells in tbl.data.grid:
                    cell_texts = [getattr(c, "text", str(c)).strip() for c in row_cells]
                    rows.append(cell_texts)
                if rows:
                    headers = rows[0]
                    rows = rows[1:]

            parsed_tables.append(
                DoclingTable(
                    table_id=f"tbl_{t_page}_{idx + 1}",
                    page_number=t_page,
                    headers=headers,
                    rows=rows,
                )
            )

        return DoclingParsedDocument(
            document_id=document_id,
            file_name=file_name,
            pages=parsed_pages,
            blocks=parsed_blocks,
            tables=parsed_tables,
        )

    def parse_document(
        self,
        document_id: str,
        file_name: str,
        pages: list[dict[str, Any]],
        raw_text: str | None = None,
        pdf_path: str | Path | None = None,
    ) -> DoclingParsedDocument:
        """Parses document from file path (with native Docling) or from pre-extracted pages/text."""
        start_time = time.perf_counter()
        logger.info(
            "Starting Docling parse for doc_id=%s, file=%s",
            document_id,
            file_name,
            extra={
                "event": "docling.parse.started",
                "document_id": document_id,
                "metadata": {"file_name": file_name, "has_pdf_path": bool(pdf_path)},
            },
        )

        if pdf_path and Path(pdf_path).is_file() and self.use_native:
            return self.parse_pdf_file(document_id, pdf_path)

        parsed_blocks: list[DoclingBlock] = []
        parsed_tables: list[DoclingTable] = []
        parsed_pages: list[dict[str, Any]] = []

        if not pages and raw_text:
            pages = [{"page_number": 1, "text": raw_text}]

        page_text_list = [
            (p.get("text", "") if isinstance(p, dict) else getattr(p, "text", "")) for p in pages
        ]
        repeated_furniture = detect_repeated_furniture(page_text_list)
        active_table: DoclingTable | None = None

        block_counter = 1
        for page in pages:
            if isinstance(page, dict):
                page_no = page.get("page_number", 1)
                text_content = page.get("text", "")
            else:
                page_no = getattr(page, "page_number", 1)
                text_content = getattr(page, "text", "")

            parsed_pages.append({"page_number": page_no, "char_count": len(text_content)})

            raw_lines = [line.strip() for line in text_content.splitlines() if line.strip()]
            total_raw_lines = len(raw_lines)

            # Strip running furniture (headers, footers, page numbering)
            lines: list[str] = []
            for idx, line in enumerate(raw_lines):
                is_boundary = idx < 3 or idx >= (total_raw_lines - 3)
                if is_boundary and (
                    RUNNING_FURNITURE_PATTERN.match(line)
                    or _furniture_key(line) in repeated_furniture
                ):
                    continue
                if re.match(
                    r"^(?:Page\s+\d+(?:\s+of\s+\d+)?|-\s*\d+\s*-|\d+\s+of\s+\d+)$",
                    line,
                    re.IGNORECASE,
                ):
                    continue
                lines.append(line)

            page_blocks: list[DoclingBlock] = []
            current_para_lines: list[str] = []
            current_para_y_top: float | None = None
            in_table_coalesce = False

            def flush_para():
                nonlocal block_counter, current_para_lines, current_para_y_top, in_table_coalesce
                if not current_para_lines:
                    return
                # Dehyphenate and join
                para_text = ""
                for p_line in current_para_lines:
                    if not para_text:
                        para_text = p_line
                    elif para_text.endswith("-") and not para_text.endswith(" -"):
                        para_text = para_text[:-1] + p_line
                    else:
                        para_text = para_text + " " + p_line

                y_top = (
                    current_para_y_top
                    if current_para_y_top is not None
                    else float((block_counter % 40) * 20)
                )
                y_bottom = y_top + 18.0 * max(1, len(current_para_lines))
                simulated_bbox = [50.0, y_top, 545.0, y_bottom]

                is_del = is_clause_deleted(para_text)
                page_blocks.append(
                    DoclingBlock(
                        block_id=f"blk_{page_no}_{block_counter}",
                        type="paragraph",
                        level=None,
                        text=para_text,
                        page_number=page_no,
                        bbox=simulated_bbox,
                        is_deleted=is_del,
                    )
                )
                block_counter += 1
                current_para_lines = []
                current_para_y_top = None
                in_table_coalesce = False

            # A table may continue from the previous page only if that page ended inside it.
            if not (parsed_blocks and parsed_blocks[-1].type == "table_row"):
                active_table = None

            for li, line in enumerate(lines):
                next_line = lines[li + 1] if li + 1 < len(lines) else ""
                is_table_separator = bool(re.match(r"^\|?\s*[-:]+[-| :]+\s*\|?$", line))
                if is_table_separator:
                    continue

                # Pipe table or whitespace-aligned table
                is_pipe_table = "|" in line or "\t" in line
                is_spatial_table = False
                spatial_cols: list[str] = []
                if not is_pipe_table:
                    spatial_cols = [c.strip() for c in re.split(r"\s{2,}", line) if c.strip()]
                    if len(spatial_cols) >= 2:
                        if active_table is not None:
                            if _is_valid_continuing_table_row(active_table, spatial_cols, line):
                                is_spatial_table = True
                            else:
                                active_table = None
                        elif TABLE_HEADER_START_PATTERN.search(spatial_cols[0]) or (
                            # >= 2 consecutive lines with the same multi-space column layout
                            len([c for c in re.split(r"\s{2,}", next_line) if c.strip()])
                            == len(spatial_cols)
                            and "|" not in next_line
                        ):
                            is_spatial_table = True

                is_table_row = is_pipe_table or is_spatial_table

                is_date = bool(re.match(r"^\d{1,2}\.\d{1,2}\.\d{2,4}\b", line))
                is_measurement = bool(
                    re.match(
                        r"^\d+(?:\.\d+)?\s*(?:km|kms|mtr|meters|hrs|hours|%)\b",
                        line,
                        re.IGNORECASE,
                    )
                )
                is_chainage = bool(
                    re.match(
                        r"^(?:Km\.?|Ch\.?|Chainage)\s*\d+|^\d{1,4}\.\d{3}\b", line, re.IGNORECASE
                    )
                )
                is_tbl_row = bool(TABLE_ROW_PATTERN.search(line))
                is_lead_in = bool(TABLE_LEAD_IN_PATTERN.search(line))

                is_heading = False
                if (
                    not is_table_row
                    and not is_date
                    and not is_measurement
                    and not is_chainage
                    and not is_tbl_row
                    and not is_lead_in
                ):
                    is_heading = bool(
                        re.match(
                            r"^(PART\s+[I|V|X]+|SECTION\s+\d+|ARTICLE\s+\d+|CLAUSE\s+\d+|[1-9]\d*(?:\.\d+)*[.)]\s+[A-Za-z(])",
                            line,
                            re.IGNORECASE,
                        )
                    )
                    # A numbered line whose sentence wraps onto a lowercase next line opens a
                    # paragraph ("3. The proposal shall ... would be" / "the same language.").
                    wraps_into_next = next_line[:1].islower() or (
                        line[:1].isdigit()
                        and len(line) > 60
                        and not line.endswith((".", ":", ";"))
                        and bool(next_line)
                        and not STRUCTURAL_START_PATTERN.match(next_line)
                        and not LIST_MARKER_PATTERN.match(next_line)
                    )
                    if is_heading and wraps_into_next:
                        flush_para()
                        current_para_y_top = float((block_counter % 40) * 20)
                        current_para_lines.append(line)
                        continue

                if is_lead_in or (
                    current_para_lines
                    and (
                        current_para_lines[-1].endswith(";") or current_para_lines[-1].endswith(":")
                    )
                    and is_tbl_row
                ):
                    in_table_coalesce = True

                if is_table_row:
                    flush_para()
                    if is_pipe_table:
                        # Keep empty interior cells so columns stay aligned with headers.
                        cells = [c.strip() for c in re.split(r"[|\t]", line)]
                        while (
                            cells
                            and not cells[0]
                            and len(cells) > 1
                            and line.lstrip().startswith("|")
                        ):
                            cells.pop(0)
                        while cells and not cells[-1]:
                            cells.pop()
                    else:
                        cells = spatial_cols

                    if len(cells) >= 2:
                        continues_prev_page = (
                            active_table is not None
                            and active_table.page_number == page_no - 1
                            and len(cells) == len(active_table.headers)
                        )
                        if active_table is not None and (
                            active_table.page_number == page_no or continues_prev_page
                        ):
                            active_table.rows.append(cells)
                            if cells:
                                active_table.row_key_map[cells[0]] = _row_as_key_values(
                                    active_table.headers, cells
                                )
                        else:
                            active_table = DoclingTable(
                                table_id=f"tbl_{page_no}_{len(parsed_tables) + 1}",
                                page_number=page_no,
                                headers=cells,
                                rows=[],
                                row_key_map={},
                            )
                            parsed_tables.append(active_table)

                    y_top = float((block_counter % 40) * 20)
                    y_bottom = y_top + 18.0
                    page_blocks.append(
                        DoclingBlock(
                            block_id=f"blk_{page_no}_{block_counter}",
                            type="table_row",
                            level=None,
                            text=line,
                            page_number=page_no,
                            bbox=[50.0, y_top, 545.0, y_bottom],
                            is_deleted=is_clause_deleted(line),
                        )
                    )
                    block_counter += 1
                    continue
                else:
                    active_table = None

                if is_heading:
                    flush_para()
                    level = 1 if "PART" in line.upper() else (2 if "SECTION" in line.upper() else 3)
                    y_top = float((block_counter % 40) * 20)
                    y_bottom = y_top + 18.0
                    is_del = is_clause_deleted(line)
                    page_blocks.append(
                        DoclingBlock(
                            block_id=f"blk_{page_no}_{block_counter}",
                            type="heading",
                            level=level,
                            text=line,
                            page_number=page_no,
                            bbox=[50.0, y_top, 545.0, y_bottom],
                            is_deleted=is_del,
                        )
                    )
                    block_counter += 1
                    continue

                is_bank_or_table_row = bool(
                    re.match(
                        r"^\s*\d+[.)]\s+(?:Name of\s+(?:Beneficiary|Bank)|Account\s+No|Type of\s+Account|Name of Bank|Branch\s+IFSC|IFSC\s+CODE)\b",
                        line,
                        re.IGNORECASE,
                    )
                )
                has_active_table_lead = bool(
                    current_para_lines
                    and (
                        any(TABLE_LEAD_IN_PATTERN.search(pl) for pl in current_para_lines)
                        or any(
                            "authority’s bank" in pl.lower()
                            or "authority's bank" in pl.lower()
                            or "particulars details" in pl.lower()
                            for pl in current_para_lines
                        )
                    )
                )

                if (in_table_coalesce or has_active_table_lead) and (
                    is_bank_or_table_row or is_tbl_row
                ):
                    if not current_para_lines:
                        current_para_y_top = float((block_counter % 40) * 20)
                    current_para_lines.append(line)
                    continue

                # Paragraph line: check if it starts a new item or coalesces with existing
                is_list_bullet = bool(LIST_MARKER_PATTERN.match(line))
                prev_ends_with_colon = bool(
                    current_para_lines and current_para_lines[-1].endswith(":")
                )

                # Table rows in a lead-in were absorbed above; any other enumerated line opens
                # a new sub-clause block, even after a lead-in word such as "... above Table."
                if is_list_bullet or (prev_ends_with_colon and not in_table_coalesce):
                    flush_para()

                if not current_para_lines:
                    current_para_y_top = float((block_counter % 40) * 20)
                current_para_lines.append(line)

            flush_para()
            parsed_blocks.extend(page_blocks)

        parsed_blocks = stitch_cross_page_continuations(parsed_blocks)

        duration_ms = round((time.perf_counter() - start_time) * 1000, 1)
        logger.info(
            "Docling parsed %d blocks, %d tables across %d pages for doc_id=%s (%.1fms)",
            len(parsed_blocks),
            len(parsed_tables),
            len(parsed_pages),
            document_id,
            duration_ms,
            extra={
                "event": "docling.parse.completed",
                "document_id": document_id,
                "duration_ms": duration_ms,
                "metadata": {
                    "blocks_count": len(parsed_blocks),
                    "tables_count": len(parsed_tables),
                    "pages_count": len(parsed_pages),
                },
            },
        )

        return DoclingParsedDocument(
            document_id=document_id,
            file_name=file_name,
            pages=parsed_pages,
            blocks=parsed_blocks,
            tables=parsed_tables,
        )
