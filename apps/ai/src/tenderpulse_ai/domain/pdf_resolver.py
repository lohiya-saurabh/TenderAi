from __future__ import annotations

import logging
import tempfile
from pathlib import Path
from typing import TYPE_CHECKING
from urllib.parse import urlparse

import httpx

try:
    import pypdfium2
    PYPDFIUM2_AVAILABLE = True
except ImportError:
    pypdfium2 = None  # type: ignore[assignment]
    PYPDFIUM2_AVAILABLE = False

if TYPE_CHECKING:
    from tenderpulse_ai.pipeline import NormalizedPage

logger = logging.getLogger("tenderpulse_ai.pdf_resolver")

MAX_DOCUMENT_SIZE_BYTES = 150 * 1024 * 1024  # 150 MB safety guard


async def resolve_pdf_to_pages(
    download_url: str,
    document_id: str,
    file_name: str,
) -> list[NormalizedPage]:
    """Resolves a PDF from a presigned download URL, local path, or mock storage,

    extracting normalized pages without loading the PDF through Node.js.
    """
    from tenderpulse_ai.pipeline import NormalizedPage

    parsed_url = urlparse(download_url)
    is_http = parsed_url.scheme in ("http", "https")
    is_mock = (
        "mock-s3.tenderpulse.local" in download_url
        or ".local/" in download_url
        or "localhost:4566" in download_url
        or "127.0.0.1:4566" in download_url
    )

    temp_path: Path | None = None
    resolved_path: Path | None = None

    try:
        repo_root = Path(__file__).resolve().parents[5]
        # 1. Handle local mock storage URLs or file URLs during dev/testing
        if is_mock or not is_http:
            # Check local samples directories for matching filename
            candidate_dirs = [
                repo_root / "samples",
                repo_root / "data",
                Path.cwd() / "samples",
                Path.cwd() / "data",
            ]
            for candidate_dir in candidate_dirs:
                if candidate_dir.is_dir():
                    matching = candidate_dir / file_name
                    if matching.is_file():
                        resolved_path = matching
                        break
                    # Fallback check for matching pdfs across subdirectories
                    for f in candidate_dir.rglob("*.pdf"):
                        if f.name.lower() == file_name.lower():
                            resolved_path = f
                            break
                    if resolved_path:
                        break

            if not resolved_path and parsed_url.scheme == "file":
                local_file = Path(parsed_url.path)
                if local_file.is_file():
                    resolved_path = local_file

        # 2. Download from real HTTP / HTTPS presigned URL
        if not resolved_path and is_http and not is_mock:
            logger.info("Streaming PDF from presigned URL for doc_id=%s (url: %s...)", document_id, download_url[:60])
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_file:
                temp_path = Path(tmp_file.name)

            try:
                async with (
                    httpx.AsyncClient(timeout=45.0, follow_redirects=True) as client,
                    client.stream("GET", download_url) as response,
                ):
                    if response.status_code != 200:
                        logger.warning(
                            "Failed to fetch document from presigned URL: HTTP %d for doc %s. Falling back to local search.",
                            response.status_code,
                            document_id,
                        )
                    else:
                        total_bytes = 0
                        with open(temp_path, "wb") as f:  # noqa: ASYNC230
                            async for chunk in response.aiter_bytes(chunk_size=65536):
                                total_bytes += len(chunk)
                                if total_bytes > MAX_DOCUMENT_SIZE_BYTES:
                                    raise ValueError(
                                        f"Document exceeds maximum allowable size of {MAX_DOCUMENT_SIZE_BYTES} bytes."
                                    )
                                f.write(chunk)
                        resolved_path = temp_path
            except (httpx.RequestError, httpx.HTTPError) as err:
                logger.warning(
                    "Network error downloading document from presigned URL for doc %s: %s. Falling back to local search.",
                    document_id,
                    err,
                )

        # 3. Direct path fallback
        if not resolved_path:
            direct_path = Path(download_url)
            if direct_path.is_file():
                resolved_path = direct_path

        if not resolved_path or not resolved_path.is_file():
            raise FileNotFoundError(
                f"Could not resolve PDF file from download URL '{download_url}' for document '{document_id}' (file_name: '{file_name}')."
            )

        if not PYPDFIUM2_AVAILABLE or pypdfium2 is None:
            raise RuntimeError(
                "pypdfium2 is required for PDF text extraction but is not installed. Please install pypdfium2."
            )

        # 4. Extract pages using pypdfium2 (C++ PDFium engine)
        logger.info("Extracting pages from PDF %s using PDFium engine...", resolved_path.name)
        pdf = pypdfium2.PdfDocument(str(resolved_path))
        pages: list[NormalizedPage] = []
        for idx, page in enumerate(pdf):
            text_page = page.get_textpage()
            page_text = text_page.get_text_range()
            if page_text and page_text.strip():
                pages.append(
                    NormalizedPage(
                        page_number=idx + 1,
                        text=page_text.strip(),
                    )
                )

        logger.info("Successfully extracted %d non-empty pages from %s", len(pages), resolved_path.name)
        return filter_candidate_pages(pages)

    finally:
        # Clean up temporary download file if created
        if temp_path and temp_path.exists():
            try:
                temp_path.unlink()
            except OSError as e:
                logger.warning("Failed to clean up temporary PDF %s: %e", temp_path, e)


PROCUREMENT_KEYWORDS: tuple[str, ...] = (
    "earnest money", "emd", "bid security", "tender security",
    "performance security", "performance bank guarantee", "pbg", "bank guarantee",
    "power of attorney", "consortium", "joint venture", "jv agreement",
    "board resolution", "authorized signatory", "annual turnover", "net worth",
    "financial capacity", "solvency", "working capital", "similar work",
    "past experience", "technical capacity", "technical experience",
    "personnel", "key expert", "project manager", "equipment", "machinery",
    "validity of bids", "bid validity", "period of validity",
    "liquidated damages", "delay damages", "defect liability",
    "litigation", "debarment", "blacklisting", "integrity pact",
    "conflict of interest", "stamp", "notary", "udin", "local content",
    "make in india", "gst", "gstin", "taxes and duties",
    "conditions precedent", "project milestone", "completion schedule",
    "commercial operation date", "cod", "applicable permits",
    "maintenance criteria", "maintenance manual", "rectification",
    "pothole", "rescue post", "mobile crane", "ambulance", "medical aid",
    "escrow account", "priority of payments", "co-insured", "all-risk",
    "dispute resolution", "arbitration", "conciliation",
)


def is_pure_toc_page(text: str) -> bool:
    """Detects whether a page is purely a Table of Contents / Index."""
    import re
    if not text or not text.strip():
        return True
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    if not lines:
        return True
    text_lower = text.lower()
    is_toc_title = any(kw in text_lower for kw in ("table of contents", "index of clauses", "brief contents"))
    toc_lines = 0
    for line in lines:
        if re.search(r"\.{3,}|\u2026|\s+\d+$", line) or re.search(r"^(section|clause|chapter|part)\s+[\dIVXLCDM]+", line, re.IGNORECASE):
            toc_lines += 1
    toc_ratio = toc_lines / len(lines)
    has_operative = bool(re.search(r"\b(shall|must|is required to|will be forfeited|undertakes to)\b", text, re.IGNORECASE))
    if is_toc_title and toc_ratio > 0.2 and not has_operative:
        return True
    return toc_ratio > 0.5 and not has_operative


def filter_candidate_pages(
    pages: list[NormalizedPage],
    max_candidate_pages: int = 45,
) -> list[NormalizedPage]:
    """Filters large multi-page documents to high-signal candidate pages.

    Preserves first pages (NIT metadata), discards pure TOC pages, and ranks
    substantive pages by Indian Public Procurement / contract covenant keywords.
    """
    if len(pages) <= 30:
        non_toc = [p for p in pages if not is_pure_toc_page(p.text)]
        return non_toc if non_toc else pages

    initial_pages = [p for p in pages[:10] if not is_pure_toc_page(p.text)]
    remaining_pages = pages[10:]

    scored_pages: list[tuple[int, NormalizedPage]] = []
    for p in remaining_pages:
        if is_pure_toc_page(p.text):
            continue
        text_lower = p.text.lower()
        score = sum(1 for kw in PROCUREMENT_KEYWORDS if kw in text_lower)
        if score > 0:
            scored_pages.append((score, p))

    scored_pages.sort(key=lambda x: x[0], reverse=True)
    limit = max(10, max_candidate_pages - len(initial_pages))
    top_scored = [p for _, p in scored_pages[:limit]]

    page_map = {p.page_number: p for p in initial_pages}
    for p in top_scored:
        page_map[p.page_number] = p

    filtered = sorted(page_map.values(), key=lambda p: p.page_number)
    logger.info("Filtered %d raw pages to %d candidate pages for compliance extraction", len(pages), len(filtered))
    return filtered
