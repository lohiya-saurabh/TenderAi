"""Layout-aware page text for the deterministic pipeline.

PDFium's text layer reads a ruled multi-column table column by column, so cells from
neighbouring columns interleave ("... of 50% of Annual turnover ... project length and b.
... should be equal to or more than Rs.5 Crores"). This module renders ruled tables
row by row ("cell | cell | cell"), joins a table row that continues across a page break,
and OCRs image-only (scanned) pages. Both steps degrade gracefully: without pdfplumber
or the Tesseract binary the plain PDFium text is returned unchanged.
"""

from __future__ import annotations

import logging
import shutil
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pypdfium2
import pypdfium2.raw as pdfium_raw

logger = logging.getLogger("tenderpulse_ai.pdf_layout")
# pdfminer (pdfplumber's parser) emits ~10^5 DEBUG records per document; with DEBUG file
# logging that floods logs/ai.log and slows extraction ~10x.
logging.getLogger("pdfminer").setLevel(logging.WARNING)

_MIN_TEXT_CHARS = 20  # below this a page is treated as image-only
_OCR_DPI = 300


def extract_layout_pages(pdf_path: str | Path, ocr_languages: str = "eng") -> list[str]:
    """Returns one text string per physical page (index = page_number - 1)."""
    path = Path(pdf_path)
    pdf = pypdfium2.PdfDocument(str(path))
    try:
        texts = [pdf[i].get_textpage().get_text_range() for i in range(len(pdf))]
        ruled = {
            i
            for i in range(len(pdf))
            if len(texts[i].strip()) >= _MIN_TEXT_CHARS and _has_ruling(pdf[i])
        }
        texts = _render_ruled_tables(path, texts, ruled)
        return _ocr_image_only_pages(pdf, texts, ocr_languages)
    finally:
        pdf.close()


# ------------------------------------------------------------------------------
# Ruled tables
# ------------------------------------------------------------------------------


def _cell(value: str | None) -> str:
    return " ".join((value or "").split())


def _has_ruling(page) -> bool:
    """Cheap PDFium pre-filter: does the page body carry table rules or cell boxes?

    Page frames and header/footer rules are ignored, so pdfplumber's (slow) layout parse
    only runs on pages that can hold a ruled table.
    """
    width, height = page.get_size()
    horiz = vert = cells = 0
    for obj in page.get_objects(filter=(pdfium_raw.FPDF_PAGEOBJ_PATH,), max_depth=2):
        left, bottom, right, top = obj.get_bounds()
        w, h = right - left, top - bottom
        if top < 0.06 * height or bottom > 0.94 * height or h > 0.85 * height:
            continue
        if h <= 3 and w >= 15:
            horiz += 1
        elif w <= 3 and h >= 8:
            vert += 1
        elif 8 <= w < 0.9 * width and 6 <= h < 0.9 * height:
            cells += 1
    return (horiz >= 3 and (vert >= 2 or cells >= 1)) or cells >= 4


def _render_ruled_tables(path: Path, texts: list[str], ruled: set[int]) -> list[str]:
    if not ruled:
        return texts
    try:
        import pdfplumber
    except ImportError:
        logger.warning("pdfplumber not installed: ruled tables keep PDFium column order.")
        return texts

    try:
        with pdfplumber.open(str(path)) as doc:
            page_tables: list[list[tuple[tuple[float, float, float, float], list[list[str]]]]] = []
            for i, page in enumerate(doc.pages):
                tables = []
                if i in ruled:
                    for table in page.find_tables():
                        rows = [[_cell(c) for c in row] for row in table.extract()]
                        rows = [r for r in rows if any(r)]
                        if rows and max(len(r) for r in rows) >= 2:
                            tables.append((table.bbox, rows))
                page_tables.append(tables)

            _join_rows_split_by_page_break(doc, page_tables)

            out = list(texts)
            for i, tables in enumerate(page_tables):
                if tables:
                    out[i] = _render_page(doc.pages[i], tables) or texts[i]
            return out
    except Exception as exc:  # noqa: BLE001 - malformed PDFs must not stop extraction
        logger.warning(
            "Ruled-table rendering failed for %s (%s); using PDFium text.", path.name, exc
        )
        return texts


def _join_rows_split_by_page_break(doc, page_tables) -> None:
    """A table ending at the bottom of page N whose first row on page N+1 has an empty
    leading cell (no new row index) is the same row: concatenate cell by cell."""
    for i in range(1, len(page_tables)):
        prev, cur = page_tables[i - 1], page_tables[i]
        if not prev or not cur:
            continue
        (prev_box, prev_rows), (cur_box, cur_rows) = prev[-1], cur[0]
        if not prev_rows or not cur_rows:
            continue
        ends_page = prev_box[3] > 0.75 * doc.pages[i - 1].height
        starts_page = cur_box[1] < 0.25 * doc.pages[i].height
        if (
            ends_page
            and starts_page
            and len(cur_rows[0]) == len(prev_rows[-1])
            and not cur_rows[0][0]
        ):
            prev_rows[-1] = [f"{a} {b}".strip() for a, b in zip(prev_rows[-1], cur_rows[0])]
            cur_rows.pop(0)


def _render_page(page, tables) -> str:
    boxes = [box for box, _ in tables]

    def outside_tables(obj) -> bool:
        if obj.get("object_type") != "char":
            return True
        cx, cy = (obj["x0"] + obj["x1"]) / 2, (obj["top"] + obj["bottom"]) / 2
        return not any(b[0] <= cx <= b[2] and b[1] <= cy <= b[3] for b in boxes)

    free = page.filter(outside_tables)
    x0, top0, x1, bottom0 = page.bbox

    def band(top: float, bottom: float) -> str:
        top, bottom = max(top, top0), min(bottom, bottom0)
        if bottom - top < 1:
            return ""
        return free.crop((x0, top, x1, bottom)).extract_text() or ""

    parts: list[str] = []
    cursor = top0
    for box, rows in sorted(tables, key=lambda t: t[0][1]):
        parts.append(band(cursor, box[1]))
        parts.extend(" | ".join(row) for row in rows)
        parts.append(band(box[1], box[3]))  # text printed beside the table
        cursor = max(cursor, box[3])
    parts.append(band(cursor, bottom0))
    return "\n".join(p for p in parts if p.strip())


# ------------------------------------------------------------------------------
# OCR for scanned pages
# ------------------------------------------------------------------------------


def _ocr_image_only_pages(pdf, texts: list[str], languages: str) -> list[str]:
    empty = [i for i, t in enumerate(texts) if len(t.strip()) < _MIN_TEXT_CHARS]
    if not empty:
        return texts
    binary = shutil.which("tesseract")
    if not binary:
        logger.warning(
            "%d image-only page(s) skipped: install the Tesseract OCR binary to read scanned PDFs.",
            len(empty),
        )
        return texts

    # Rendering is not thread-safe in PDFium: render serially, OCR in parallel processes.
    out = list(texts)
    with tempfile.TemporaryDirectory() as tmp:
        images = {}
        for i in empty:
            img_path = Path(tmp) / f"p{i + 1}.png"
            pdf[i].render(scale=_OCR_DPI / 72).to_pil().convert("L").save(img_path)
            images[i] = img_path

        def ocr(i: int) -> tuple[int, str]:
            result = subprocess.run(
                [binary, str(images[i]), "stdout", "-l", languages],
                capture_output=True,
                text=True,
                timeout=120,
            )
            return i, result.stdout if result.returncode == 0 else ""

        with ThreadPoolExecutor(max_workers=4) as pool:
            for i, text in pool.map(ocr, images):
                if text.strip():
                    out[i] = text
    logger.info(
        "OCR recovered text for %d of %d image-only pages.",
        sum(1 for i in empty if out[i].strip()),
        len(empty),
    )
    return out


__all__ = ["extract_layout_pages"]
