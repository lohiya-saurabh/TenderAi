import logging
import re
import time
from pathlib import Path
from typing import Any

from tenderpulse_ai.domain.models import DoclingBlock, DoclingParsedDocument, DoclingTable

logger = logging.getLogger("tenderpulse_ai.docling")

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
                parsed_pages.append({
                    "page_number": int(page_no),
                    "size": getattr(page_obj, "size", None),
                })
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

            block_type = "heading" if "heading" in label or "title" in label or "section" in label else "paragraph"
            heading_level = 1 if "title" in label else (2 if "section" in label else 3) if block_type == "heading" else None

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

        block_counter = 1
        for page in pages:
            page_no = page.get("page_number", 1)
            text_content = page.get("text", "")

            parsed_pages.append({"page_number": page_no, "char_count": len(text_content)})

            lines = [line.strip() for line in text_content.splitlines() if line.strip()]
            for line in lines:
                is_heading = bool(
                    re.match(
                        r"^(PART\s+[I|V|X]+|SECTION\s+\d+|\d+(\.\d+)*\b|ARTICLE\s+\d+|CLAUSE\s+\d+)",
                        line,
                        re.IGNORECASE,
                    )
                )

                if "|" in line or "\t" in line:
                    cells = [c.strip() for c in re.split(r"[|\t]", line) if c.strip()]
                    if len(cells) >= 2:
                        if parsed_tables and parsed_tables[-1].page_number == page_no and not parsed_tables[-1].rows or parsed_tables and parsed_tables[-1].page_number == page_no:
                            parsed_tables[-1].rows.append(cells)
                        else:
                            parsed_tables.append(
                                DoclingTable(
                                    table_id=f"tbl_{page_no}_{len(parsed_tables) + 1}",
                                    page_number=page_no,
                                    headers=cells,
                                    rows=[],
                                )
                            )

                block_type = "heading" if is_heading else "paragraph"
                level = 1 if "PART" in line.upper() else (2 if "SECTION" in line.upper() else 3) if is_heading else None

                parsed_blocks.append(
                    DoclingBlock(
                        block_id=f"blk_{page_no}_{block_counter}",
                        type=block_type,
                        level=level,
                        text=line,
                        page_number=page_no,
                    )
                )
                block_counter += 1

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
