"""Extraction benchmark over real tender PDFs.

    uv run python -m tenderpulse_ai.evaluation.benchmark --docs 01,04,10 --compare last

Runs the production pipeline (LLM-only; honours LLM_REPLAY_MODE=off|record|replay) on each
document, writes a snapshot to .bench/<timestamp>.json and prints a before/after table plus
why candidates were rejected. Parsed pages are cached per PDF hash under .cache/pages, so
OCR and layout parsing run once per file.
"""

from __future__ import annotations

import argparse
import asyncio
import collections
import datetime
import hashlib
import json
import logging
import re
import sys
import time
from pathlib import Path
from typing import Any

APP_DIR = Path(__file__).resolve().parents[3]
DEFAULT_DOCS_DIR = APP_DIR / "data" / "procurement-evidence" / "01_Tender_Documents"
BENCH_DIR = APP_DIR / ".bench"
PAGE_CACHE_DIR = APP_DIR / ".cache" / "pages"

REJECTION_KINDS = (
    ("not_grounded", "not found on page"),
    ("fragment", "Dangling fragment"),
    ("deleted_clause", "deleted"),
    ("unknown_category", "Unrecognized category"),
    ("invalid_rules", "Invalid stamp paper"),
)


async def load_pages(pdf: Path) -> list[Any]:
    from tenderpulse_ai.domain.pdf_resolver import resolve_pdf_to_pages
    from tenderpulse_ai.extraction.contracts import NormalizedPage

    digest = hashlib.sha256(pdf.read_bytes()).hexdigest()[:16]
    cached = PAGE_CACHE_DIR / f"{digest}.json"
    if cached.exists():
        return [NormalizedPage(**p) for p in json.loads(cached.read_text())]
    pages = await resolve_pdf_to_pages(str(pdf), pdf.stem, pdf.name)
    cached.parent.mkdir(parents=True, exist_ok=True)
    cached.write_text(json.dumps([p.model_dump() for p in pages], ensure_ascii=False))
    return pages


def _quote_stats(items: list[dict[str, Any]]) -> dict[str, Any]:
    quotes = [i["provenance"]["verbatimQuote"] for i in items if not i.get("verification_status")]
    refs = [i["provenance"].get("clauseReference") or "" for i in items]
    generic = sum(1 for r in refs if re.match(r"^(?:Page \d+|Clause on Page|Clause Reference)", r))
    return {
        "avg_quote_chars": round(sum(map(len, quotes)) / len(quotes)) if quotes else 0,
        "quotes_over_700": sum(1 for q in quotes if len(q) > 700),
        "generic_refs": generic,
    }


async def run_document(pdf: Path) -> dict[str, Any]:
    from tenderpulse_ai.extraction.contracts import DocumentExtractionRequest
    from tenderpulse_ai.extraction.orchestrator import ProductionExtractionPipeline
    from tenderpulse_ai.models.llm_client import LLMExtractionError
    from tenderpulse_ai.security.context import SecurityContext

    pages = await load_pages(pdf)
    request = DocumentExtractionRequest(
        security_context=SecurityContext(
            tenant_id="bench",
            user_id="bench",
            workflow_run_id=f"bench_{pdf.stem}",
            allowed_document_ids=[pdf.stem],
            purpose="COMPLIANCE_EXTRACTION",
        ),
        bid_id=f"bench_{pdf.stem}",
        document_id=pdf.stem,
        file_name=pdf.name,
        pages=pages,
    )
    started = time.perf_counter()
    try:
        response = await ProductionExtractionPipeline().execute(request)
    except LLMExtractionError as exc:
        return {
            "status": "FAILED",
            "error": str(exc)[:300],
            "pages": len(pages),
            "seconds": round(time.perf_counter() - started, 1),
        }

    rejections: collections.Counter[str] = collections.Counter()
    samples: dict[str, list[str]] = collections.defaultdict(list)
    for event in response.audit_events:
        if event.get("action") != "DETERMINISTIC_VERIFICATION_EVALUATED":
            continue
        for reason in (event.get("details") or {}).get("reasons", []):
            kind = next((k for k, needle in REJECTION_KINDS if needle in reason), "other")
            rejections[kind] += 1
            if len(samples[kind]) < 3:
                samples[kind].append(reason[:160])
    model_failures = sum(
        1 for e in response.audit_events if e.get("action") == "MODEL_EXTRACTION_FAILED"
    )
    items = [i for i in response.items if not i.get("verification_status")]
    return {
        "status": response.status,
        "pages": len(pages),
        "items": len(items),
        "contradictions": len(response.uncertainty_items),
        "failed_pages": response.failed_pages,
        "model_failures": model_failures,
        "rejections": dict(rejections),
        "rejection_samples": dict(samples),
        **_quote_stats(items),
        "seconds": round(time.perf_counter() - started, 1),
    }


def _previous_snapshot(spec: str | None, current: Path) -> dict[str, Any] | None:
    if not spec:
        return None
    if spec == "last":
        snaps = sorted(p for p in BENCH_DIR.glob("*.json") if p != current)
        return json.loads(snaps[-1].read_text()) if snaps else None
    return json.loads(Path(spec).read_text())


def _cell(now: Any, before: Any) -> str:
    if before is None or before == now:
        return str(now)
    return f"{before}→{now}"


def print_report(results: dict[str, Any], previous: dict[str, Any] | None) -> None:
    cols = (
        "status",
        "items",
        "contradictions",
        "model_failures",
        "quotes_over_700",
        "generic_refs",
        "seconds",
    )
    prev_docs = (previous or {}).get("documents", {})
    print(f"\n{'document':40} " + " ".join(f"{c:>16}" for c in cols))
    for name, row in results["documents"].items():
        before = prev_docs.get(name, {})
        print(
            f"{name[:40]:40} "
            + " ".join(f"{_cell(row.get(c, '-'), before.get(c)):>16}" for c in cols)
        )
    print("\nRejections (why candidates failed validation):")
    for name, row in results["documents"].items():
        if row.get("error"):
            print(f"  {name}: LLM FAILED: {row['error']}")
            continue
        if row.get("failed_pages"):
            print(f"  {name}: LLM failed on pages {row['failed_pages']}")
        for kind, n in sorted(row.get("rejections", {}).items(), key=lambda kv: -kv[1]):
            print(f"  {name}: {kind} x{n}")
            for sample in row["rejection_samples"].get(kind, []):
                print(f"      - {sample}")


async def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--docs", default="", help="comma-separated file-name prefixes (default: all)"
    )
    parser.add_argument("--dir", default=str(DEFAULT_DOCS_DIR), help="folder of tender PDFs")
    parser.add_argument("--compare", default="last", help="'last', a snapshot path, or '' for none")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")
    prefixes = [p.strip() for p in args.docs.split(",") if p.strip()]
    pdfs = sorted(
        p
        for p in Path(args.dir).glob("*.pdf")
        if not prefixes or any(p.name.startswith(x) for x in prefixes)
    )
    if not pdfs:
        print(f"No PDFs matched {prefixes or '*'} in {args.dir}", file=sys.stderr)
        return 2

    from tenderpulse_ai.config import settings

    results: dict[str, Any] = {
        "created_at": datetime.datetime.now(datetime.UTC).isoformat(timespec="seconds"),
        "llm_replay_mode": settings.llm_replay_mode,
        "llm_model": settings.llm_model,
        "documents": {},
    }
    for pdf in pdfs:
        print(f"… {pdf.name}", file=sys.stderr)
        results["documents"][pdf.stem] = await run_document(pdf)

    BENCH_DIR.mkdir(exist_ok=True)
    snapshot = BENCH_DIR / f"{results['created_at'].replace(':', '')}.json"
    previous = _previous_snapshot(args.compare, snapshot)
    snapshot.write_text(json.dumps(results, indent=1, ensure_ascii=False))
    print_report(results, previous)
    print(f"\nSnapshot: {snapshot}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
