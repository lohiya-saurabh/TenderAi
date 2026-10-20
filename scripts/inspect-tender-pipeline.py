#!/usr/bin/env python3
"""
TenderPulse AI - LangGraph Document Extraction Pipeline Inspector
Inspects how DoclingParserEngine, DocumentStructureBuilder, CandidateDetector,
ContextAssembler, Extraction, and DeterministicValidator parse and extract data
from authentic procurement PDFs.

Saves full, unabridged node outputs to dedicated files:
  - node1_output.json & node1_output.md (DoclingParserEngine - Layout & Block AST)
  - node2_output.json & node2_output.md (DocumentStructureBuilder - Hierarchical AST & Clause Tree)
  - node3_output.json & node3_output.md (CandidateDetector - Sieve, Rule Hits & Priority Scoring)
  - node4_output.json & node4_output.md (ContextAssembler - Fused Context Envelopes)
  - node5_output.json & node5_output.md (Extraction & DeterministicValidator - Compliance Matrix)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

# Ensure apps/ai/src is in sys.path
REPO_ROOT = Path(__file__).resolve().parents[1]
AI_SRC = REPO_ROOT / "apps" / "ai" / "src"
if str(AI_SRC) not in sys.path:
    sys.path.insert(0, str(AI_SRC))

try:
    import pypdfium2
except ImportError:
    print("Error: pypdfium2 is required. Please run using ./.venv/bin/python", file=sys.stderr)
    sys.exit(1)

from tenderpulse_ai.domain.candidate_detector import CandidateDetector
from tenderpulse_ai.domain.context_assembler import ContextAssembler
from tenderpulse_ai.domain.docling_parser import DoclingParserEngine
from tenderpulse_ai.domain.models import DoclingParsedDocument, DocumentStructureTree
from tenderpulse_ai.domain.structure_builder import DocumentStructureBuilder
from tenderpulse_ai.domain.validator import DeterministicValidator
from tenderpulse_ai.pipeline import default_tender_extractor

# ANSI Color codes for terminal visualization
BOLD = "\033[1m"
DIM = "\033[2m"
CYAN = "\033[36m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
BLUE = "\033[34m"
MAGENTA = "\033[35m"
RED = "\033[31m"
RESET = "\033[0m"


def print_banner(title: str, subtitle: str = "") -> None:
    width = 80
    print("\n" + "=" * width)
    print(f"{BOLD}{CYAN}{title.center(width)}{RESET}")
    if subtitle:
        print(f"{DIM}{subtitle.center(width)}{RESET}")
    print("=" * width)


def print_node_header(node_num: int, node_name: str, purpose: str) -> None:
    print(f"\n{BOLD}{GREEN}Node {node_num}: {node_name}{RESET} — {YELLOW}{purpose}{RESET}")
    print("-" * 80)


def extract_pages(pdf_path: Path) -> list[dict[str, Any]]:
    """Extracts raw text pages from PDF using PDFium."""
    pdf = pypdfium2.PdfDocument(str(pdf_path))
    pages: list[dict[str, Any]] = []
    for idx, page in enumerate(pdf):
        text_page = page.get_textpage()
        page_text = text_page.get_text_range()
        pages.append({
            "page_number": idx + 1,
            "text": page_text.strip() if page_text else "",
            "char_count": len(page_text.strip()) if page_text else 0,
        })
    return pages


def link_or_copy(src: Path, dst: Path) -> None:
    """Creates a symlink or fallback file copy in working dir for convenience."""
    try:
        if dst.is_symlink() or dst.exists():
            dst.unlink()
        dst.symlink_to(src.resolve())
    except Exception:
        dst.write_bytes(src.read_bytes())


# =============================================================================
# Exporters for Node Outputs (Full & Unabridged)
# =============================================================================

def save_node1_output(
    output_dir: Path,
    docling_doc: DoclingParsedDocument,
    pdf_path: Path,
    raw_pages: list[dict[str, Any]],
    file_sha256: str,
) -> tuple[Path, Path]:
    """Saves full unabridged output of Node 1: DoclingParserEngine."""
    block_types: dict[str, int] = {}
    for b in docling_doc.blocks:
        block_types[b.type] = block_types.get(b.type, 0) + 1

    # 1. JSON Export
    json_path = output_dir / "node1_output.json"
    json_data = {
        "node_number": 1,
        "node_name": "DoclingParserEngine",
        "description": "Physical Layout Segmentation & Text Primitives AST",
        "document_metadata": {
            "document_id": docling_doc.document_id,
            "file_name": pdf_path.name,
            "file_path": str(pdf_path),
            "file_sha256": file_sha256,
            "total_pages": len(raw_pages),
            "total_blocks": len(docling_doc.blocks),
            "total_tables": len(docling_doc.tables),
            "block_types_breakdown": block_types,
        },
        "blocks": [b.model_dump() for b in docling_doc.blocks],
        "tables": [t.model_dump() for t in docling_doc.tables],
    }
    json_path.write_text(json.dumps(json_data, indent=2, default=str), encoding="utf-8")

    # 2. Markdown Export
    md_path = output_dir / "node1_output.md"
    blocks_by_page: dict[int, list[Any]] = {}
    for b in docling_doc.blocks:
        blocks_by_page.setdefault(b.page_number, []).append(b)

    md_lines: list[str] = [
        f"# Node 1 Output: DoclingParserEngine",
        f"",
        f"**Purpose**: Converts unstructured raw PDF text streams into atomic layout blocks (headings, paragraphs, tables) tagged with bounding-box coordinates, heading hierarchy levels, and physical page numbers.",
        f"",
        f"## Document Metadata",
        f"- **File Name**: `{pdf_path.name}`",
        f"- **SHA-256**: `{file_sha256}`",
        f"- **Total Pages**: {len(raw_pages)}",
        f"- **Total Blocks Extracted**: **{len(docling_doc.blocks)}**",
        f"- **Total Tables Detected**: **{len(docling_doc.tables)}**",
        f"",
        f"### Block Type Breakdown",
        f"| Block Type | Count | Percentage |",
        f"| :--- | :--- | :--- |",
    ]
    total_b = len(docling_doc.blocks)
    for btype, cnt in sorted(block_types.items(), key=lambda x: x[1], reverse=True):
        pct = (cnt / total_b * 100) if total_b else 0
        md_lines.append(f"| `{btype}` | {cnt} | {pct:.1f}% |")

    md_lines.extend([
        f"",
        f"---",
        f"",
        f"## Complete Unabridged Blocks Listing ({total_b} Blocks)",
        f"",
    ])

    for page_num in sorted(blocks_by_page.keys()):
        p_blocks = blocks_by_page[page_num]
        md_lines.append(f"### Page {page_num} ({len(p_blocks)} Blocks)\n")
        for b in p_blocks:
            lvl_tag = f" | Level {b.level}" if b.level is not None else ""
            bbox_str = f"[{b.bbox[0]:.1f}, {b.bbox[1]:.1f}, {b.bbox[2]:.1f}, {b.bbox[3]:.1f}]" if b.bbox else "None"
            md_lines.append(f"#### Block `{b.block_id}` — Type: `{b.type.upper()}`{lvl_tag}")
            md_lines.append(f"- **Page**: {b.page_number}")
            md_lines.append(f"- **Bounding Box**: `{bbox_str}`")
            md_lines.append(f"- **Verbatim Text**:\n")
            md_lines.append("```text")
            md_lines.append(b.text.strip())
            md_lines.append("```\n")

    md_path.write_text("\n".join(md_lines), encoding="utf-8")
    return json_path, md_path


def save_node2_output(
    output_dir: Path,
    doc_tree: DocumentStructureTree,
    docling_doc: DoclingParsedDocument,
    pdf_path: Path,
    file_sha256: str,
) -> tuple[Path, Path]:
    """Saves full unabridged output of Node 2: DocumentStructureBuilder."""
    block_map = {b.block_id: b for b in docling_doc.blocks}

    level_counts: dict[int, int] = {}
    for n in doc_tree.nodes:
        level_counts[n.level] = level_counts.get(n.level, 0) + 1

    # 1. JSON Export
    json_path = output_dir / "node2_output.json"
    json_data = {
        "node_number": 2,
        "node_name": "DocumentStructureBuilder",
        "description": "Hierarchical AST Section & Clause Tree",
        "document_metadata": {
            "document_id": doc_tree.document_id,
            "file_name": pdf_path.name,
            "file_sha256": file_sha256,
            "total_nodes": len(doc_tree.nodes),
            "level_distribution": level_counts,
        },
        "nodes": [
            {
                "node_id": n.node_id,
                "number": n.number,
                "title": n.title,
                "level": n.level,
                "parent_id": n.parent_id,
                "block_ids": n.block_ids,
                "block_count": len(n.block_ids),
                "blocks": [
                    {
                        "block_id": bid,
                        "page_number": block_map[bid].page_number if bid in block_map else None,
                        "type": block_map[bid].type if bid in block_map else None,
                        "text": block_map[bid].text if bid in block_map else "",
                    }
                    for bid in n.block_ids
                ],
            }
            for n in doc_tree.nodes
        ],
    }
    json_path.write_text(json.dumps(json_data, indent=2, default=str), encoding="utf-8")

    # 2. Markdown Export
    md_path = output_dir / "node2_output.md"
    md_lines: list[str] = [
        f"# Node 2 Output: DocumentStructureBuilder",
        f"",
        f"**Purpose**: Assembles a deterministic hierarchical Abstract Syntax Tree (AST) of the document. Maps sections, clauses, and sub-clauses into parent-child trees without costly LLM calls, assigning every layout block to its enclosing legal breadcrumb.",
        f"",
        f"## AST Structure Overview",
        f"- **File Name**: `{pdf_path.name}`",
        f"- **Total Structural Nodes**: **{len(doc_tree.nodes)}**",
        f"",
        f"### Hierarchy Levels Distribution",
        f"| Level | Meaning | Count |",
        f"| :--- | :--- | :--- |",
    ]
    for lvl, cnt in sorted(level_counts.items()):
        meaning = "Part / Schedule" if lvl == 1 else ("Section / Article" if lvl == 2 else "Clause / Sub-Clause")
        md_lines.append(f"| Level {lvl} | {meaning} | {cnt} nodes |")

    md_lines.extend([
        f"",
        f"---",
        f"",
        f"## Hierarchical Document Tree (Visual AST)",
        f"```text",
    ])

    for node in doc_tree.nodes:
        indent = "    " * (node.level - 1)
        prefix = "└── " if node.level > 1 else "├── "
        clean_title = node.title.replace("\n", " ").strip()
        md_lines.append(f"{indent}{prefix}[L{node.level}] {node.number} — {clean_title} ({len(node.block_ids)} blocks)")

    md_lines.extend([
        f"```",
        f"",
        f"---",
        f"",
        f"## Detailed AST Nodes & Enclosed Text ({len(doc_tree.nodes)} Nodes)",
        f"",
    ])

    for idx, node in enumerate(doc_tree.nodes, start=1):
        lvl_label = "Part/Schedule" if node.level == 1 else ("Section/Article" if node.level == 2 else "Clause/Sub-Clause")
        md_lines.append(f"### Node {idx}: `{node.node_id}` — {node.number} (Level {node.level}: {lvl_label})")
        md_lines.append(f"- **Title**: `{node.title.strip()}`")
        md_lines.append(f"- **Parent Node**: `{node.parent_id or 'None (Root)'}`")
        md_lines.append(f"- **Assigned Blocks ({len(node.block_ids)})**: `{', '.join(node.block_ids) if node.block_ids else 'None'}`")
        md_lines.append(f"- **Enclosed Content**:\n")

        if node.block_ids:
            for bid in node.block_ids:
                blk = block_map.get(bid)
                if blk:
                    md_lines.append(f"  > **`{blk.block_id}`** (P.{blk.page_number} {blk.type}):")
                    text_indented = "\n".join("  > " + line for line in blk.text.strip().splitlines())
                    md_lines.append(f"{text_indented}\n")
        else:
            md_lines.append("  *(No direct text blocks; container node)*\n")

    md_path.write_text("\n".join(md_lines), encoding="utf-8")
    return json_path, md_path


def save_node3_output(
    output_dir: Path,
    candidates: list[Any],
    unselected: list[Any],
    rule_histogram: dict[str, int],
    pdf_path: Path,
    file_sha256: str,
) -> tuple[Path, Path]:
    """Saves full unabridged output of Node 3: CandidateDetector."""
    sorted_candidates = sorted(candidates, key=lambda c: c.priority_score, reverse=True)

    # 1. JSON Export
    json_path = output_dir / "node3_output.json"
    json_data = {
        "node_number": 3,
        "node_name": "CandidateDetector",
        "description": "High-Recall Deterministic Sieve & Priority Scoring",
        "document_metadata": {
            "file_name": pdf_path.name,
            "file_sha256": file_sha256,
            "total_candidates": len(candidates),
            "total_unselected": len(unselected),
            "total_blocks_analyzed": len(candidates) + len(unselected),
            "rules_triggered": rule_histogram,
        },
        "candidates": [c.model_dump() for c in sorted_candidates],
        "unselected_passages": [u.model_dump() for u in unselected],
    }
    json_path.write_text(json.dumps(json_data, indent=2, default=str), encoding="utf-8")

    # 2. Markdown Export
    md_path = output_dir / "node3_output.md"
    md_lines: list[str] = [
        f"# Node 3 Output: CandidateDetector",
        f"",
        f"**Purpose**: High-recall deterministic sieve that scans all blocks against 19 Indian procurement rules (deontic modals, bid security/EMD, turnover, technical criteria, stamp paper, negative covenants). Filters cross-page boilerplate and scores passages (0.00 to 1.00) for downstream extraction.",
        f"",
        f"## Sieve Summary",
        f"- **File Name**: `{pdf_path.name}`",
        f"- **Candidate Passages (Tier-1 Sieve)**: **{len(candidates)}**",
        f"- **Unselected Passages (Tier-2 Rescue Pool)**: **{len(unselected)}**",
        f"- **Total Passages Evaluated**: {len(candidates) + len(unselected)}",
        f"",
        f"### Procurement Rules Trigger Histogram",
        f"| Rule Name | Matches | Frequency Bar |",
        f"| :--- | :--- | :--- |",
    ]
    for rule, count in sorted(rule_histogram.items(), key=lambda x: x[1], reverse=True):
        bar = "█" * min(25, int(count / 2) + 1)
        md_lines.append(f"| `{rule}` | {count} | {bar} |")

    md_lines.extend([
        f"",
        f"---",
        f"",
        f"## Tier-1 Candidate Passages (Complete Listing: {len(sorted_candidates)} Passages)",
        f"",
    ])

    for idx, c in enumerate(sorted_candidates, start=1):
        md_lines.append(f"### Candidate {idx}: `{c.candidate_id}` [Priority Score: {c.priority_score:.2f}]")
        md_lines.append(f"- **Physical Page**: Page {c.page_number}")
        md_lines.append(f"- **Clause / Section Reference**: `{c.section_number}`")
        md_lines.append(f"- **Hierarchy Path**: `{c.section_path}`")
        md_lines.append(f"- **Source Block ID**: `{c.block_id}`")
        md_lines.append(f"- **Extraction Tier**: `{c.extraction_tier}`")
        md_lines.append(f"- **Matched Procurement Rules**: `{', '.join(c.matched_rules)}`")
        md_lines.append(f"- **Verbatim Candidate Text**:\n")
        md_lines.append("```text")
        md_lines.append(c.text.strip())
        md_lines.append("```\n")

    md_lines.extend([
        f"---",
        f"",
        f"## Tier-2 Unselected Passages Held for Rescue Pass ({len(unselected)} Passages)",
        f"",
    ])

    for idx, u in enumerate(unselected, start=1):
        md_lines.append(f"### Unselected {idx}: `{u.candidate_id}` [Page {u.page_number}]")
        md_lines.append(f"- **Hierarchy Path**: `{u.section_path}`")
        md_lines.append(f"- **Source Block ID**: `{u.block_id}`")
        md_lines.append(f"- **Verbatim Text**:\n")
        md_lines.append("```text")
        md_lines.append(u.text.strip())
        md_lines.append("```\n")

    md_path.write_text("\n".join(md_lines), encoding="utf-8")
    return json_path, md_path


def save_node4_output(
    output_dir: Path,
    assembled_contexts: list[Any],
    pdf_path: Path,
    file_sha256: str,
) -> tuple[Path, Path]:
    """Saves full unabridged output of Node 4: ContextAssembler."""
    # 1. JSON Export
    json_path = output_dir / "node4_output.json"
    json_data = {
        "node_number": 4,
        "node_name": "ContextAssembler",
        "description": "Clause Windowing & Hierarchical Context Fusion",
        "document_metadata": {
            "file_name": pdf_path.name,
            "file_sha256": file_sha256,
            "total_envelopes": len(assembled_contexts),
        },
        "envelopes": [ctx.model_dump() for ctx in assembled_contexts],
    }
    json_path.write_text(json.dumps(json_data, indent=2, default=str), encoding="utf-8")

    # 2. Markdown Export
    md_path = output_dir / "node4_output.md"
    md_lines: list[str] = [
        f"# Node 4 Output: ContextAssembler",
        f"",
        f"**Purpose**: Fuses candidate passages with parent section paths, sibling blocks, and preceding/following clauses into complete context envelopes so that the LLM understands pronouns and cross-references like 'as mentioned in clause 2.1 above'.",
        f"",
        f"## Overview",
        f"- **File Name**: `{pdf_path.name}`",
        f"- **Total Context Envelopes Assembled**: **{len(assembled_contexts)}**",
        f"",
        f"---",
        f"",
        f"## Assembled Context Envelopes (Complete Listing: {len(assembled_contexts)} Envelopes)",
        f"",
    ]

    for idx, ctx in enumerate(assembled_contexts, start=1):
        md_lines.append(f"### Envelope {idx}: `{ctx.candidate_id}` (Page {ctx.page_number})")
        md_lines.append(f"- **Clause Reference**: `{ctx.clause_reference}`")
        md_lines.append(f"- **Section Path**: `{ctx.section_path}`")
        md_lines.append(f"- **Current Clause**:\n")
        md_lines.append("```text")
        md_lines.append(ctx.current_clause.strip())
        md_lines.append("```\n")

        if ctx.previous_clause:
            md_lines.append(f"- **Preceding Context**:\n")
            md_lines.append("```text")
            md_lines.append(ctx.previous_clause.strip())
            md_lines.append("```\n")

        if ctx.following_clause:
            md_lines.append(f"- **Following Context**:\n")
            md_lines.append("```text")
            md_lines.append(ctx.following_clause.strip())
            md_lines.append("```\n")

    md_path.write_text("\n".join(md_lines), encoding="utf-8")
    return json_path, md_path


def save_node5_output(
    output_dir: Path,
    validation_results: list[dict[str, Any]],
    pdf_path: Path,
    file_sha256: str,
) -> tuple[Path, Path]:
    """Saves full unabridged output of Node 5: Extraction & Deterministic Validation."""
    grounded_count = sum(1 for v in validation_results if v["is_grounded"])
    grounded_pct = (grounded_count / len(validation_results) * 100) if validation_results else 100.0

    # 1. JSON Export
    json_path = output_dir / "node5_output.json"
    json_data = {
        "node_number": 5,
        "node_name": "ExtractionAndValidation",
        "description": "Structured Compliance Extraction & Physical Substring Grounding Verification",
        "document_metadata": {
            "file_name": pdf_path.name,
            "file_sha256": file_sha256,
            "total_items": len(validation_results),
            "grounded_count": grounded_count,
            "grounded_percentage": grounded_pct,
        },
        "items": [
            {
                "category": v["item"].category,
                "title": v["item"].title,
                "description": v["item"].description,
                "page": v["page"],
                "clause_reference": v["item"].provenance.clause_reference,
                "verbatim_quote": v["item"].provenance.verbatim_quote,
                "is_grounded": v["is_grounded"],
                "confidence_score": v["item"].provenance.confidence_score,
                "execution_rules": v["item"].execution_rules.model_dump(),
            }
            for v in validation_results
        ],
    }
    json_path.write_text(json.dumps(json_data, indent=2, default=str), encoding="utf-8")

    # 2. Markdown Export
    md_path = output_dir / "node5_output.md"
    md_lines: list[str] = [
        f"# Node 5 Output: Extraction & Deterministic Validation",
        f"",
        f"**Purpose**: Translates candidate envelopes into verified compliance requirements and performs deterministic substring grounding checks against physical PDF pages to guarantee zero hallucinations.",
        f"",
        f"## Extraction & Verification Summary",
        f"- **File Name**: `{pdf_path.name}`",
        f"- **Total Extracted Compliance Requirements**: **{len(validation_results)}**",
        f"- **Physical Substring Grounding Match**: **{grounded_count}/{len(validation_results)} ({grounded_pct:.0f}% exact match)**",
        f"",
        f"---",
        f"",
        f"## Verified Compliance Matrix (Complete Listing)",
        f"",
    ]

    for idx, v in enumerate(validation_results, start=1):
        item = v["item"]
        grounded_str = "Verified (100% Exact Physical Substring Match)" if v["is_grounded"] else "Failed Grounding"
        md_lines.append(f"### Requirement {idx}: {item.title}")
        md_lines.append(f"- **Category**: `{item.category}`")
        md_lines.append(f"- **Physical Page**: Page {v['page']}")
        md_lines.append(f"- **Clause Reference**: `{item.provenance.clause_reference or 'General'}`")
        md_lines.append(f"- **Deterministic Grounding**: `{grounded_str}`")
        md_lines.append(f"- **Confidence Score**: `{item.provenance.confidence_score:.2f}`")
        md_lines.append(f"- **Execution Rules**:")
        md_lines.append(f"  - Stamp Paper Required: `{'Yes' if item.execution_rules.stamp_paper_required else 'No'}` (Denomination: ₹{item.execution_rules.stamp_paper_denomination_inr or 'N/A'})")
        md_lines.append(f"  - Notarization Required: `{'Yes' if item.execution_rules.notarization_required else 'No'}`")
        md_lines.append(f"  - UDIN Required: `{'Yes' if item.execution_rules.udin_required else 'No'}`")
        if item.execution_rules.signing_authority_rank:
            md_lines.append(f"  - Signing Authority Rank: `{item.execution_rules.signing_authority_rank}`")
        md_lines.append(f"- **Description**: {item.description}")
        md_lines.append(f"- **Verbatim Quote Citation**:\n")
        md_lines.append("```text")
        md_lines.append(item.provenance.verbatim_quote.strip())
        md_lines.append("```\n")

    md_path.write_text("\n".join(md_lines), encoding="utf-8")
    return json_path, md_path


def run_inspection(
    pdf_path: Path,
    target_node: str = "all",
    target_page: int | None = None,
    verbose: bool = False,
    output_dir: Path | None = None,
    export_json: Path | None = None,
    export_md: Path | None = None,
) -> None:
    if not pdf_path.exists():
        print(f"{RED}Error: PDF file not found at {pdf_path}{RESET}", file=sys.stderr)
        sys.exit(1)

    # Set default output directory to "inspection_output" if not specified
    if output_dir is None:
        output_dir = REPO_ROOT / "inspection_output"
    output_dir.mkdir(parents=True, exist_ok=True)

    file_size_kb = round(pdf_path.stat().st_size / 1024, 2)
    file_sha256 = hashlib.sha256(pdf_path.read_bytes()).hexdigest()

    print_banner(
        "TenderPulse AI - Document Processing Pipeline Inspector",
        f"Inspecting file: {pdf_path.name} ({file_size_kb} KB)",
    )

    print(f"{BOLD}Target File:{RESET} {pdf_path}")
    print(f"{BOLD}SHA-256:{RESET}     {file_sha256}")
    print(f"{BOLD}Output Dir:{RESET}  {output_dir}")

    # =========================================================================
    # Phase 0: Physical Page Extraction (PDFium C++ Engine)
    # =========================================================================
    t0 = time.perf_counter()
    raw_pages = extract_pages(pdf_path)
    total_pages = len(raw_pages)
    total_chars = sum(p["char_count"] for p in raw_pages)
    t_extract = (time.perf_counter() - t0) * 1000

    print(f"{BOLD}Pages:{RESET}       {total_pages} pages | {total_chars:,} characters extracted in {t_extract:.1f}ms")

    if target_page:
        if 1 <= target_page <= total_pages:
            raw_pages = [raw_pages[target_page - 1]]
            print(f"{YELLOW}* Filtered inspection to Page {target_page} only *{RESET}")
        else:
            print(f"{RED}Error: Target page {target_page} out of range (1..{total_pages}){RESET}")
            sys.exit(1)

    generated_files: list[tuple[str, Path, Path]] = []

    # =========================================================================
    # Node 1: DoclingParserEngine
    # =========================================================================
    docling_doc: DoclingParsedDocument | None = None
    if target_node in ("all", "1", "docling"):
        print_node_header(1, "DoclingParserEngine", "Physical Layout & Block Segmentation AST")
        print(f"{DIM}Role in LangGraph: Converts unstructured PDF text streams into structured text primitives{RESET}")
        print(f"{DIM}(headings, paragraphs, tables) with coordinates (bbox), level tagging, and page numbers.{RESET}\n")

        t0 = time.perf_counter()
        doc_parser = DoclingParserEngine(use_native_if_available=False)
        docling_doc = doc_parser.parse_document(
            document_id="nhai-doc-02",
            file_name=pdf_path.name,
            pages=raw_pages,
        )
        t_node1 = (time.perf_counter() - t0) * 1000

        block_types: dict[str, int] = {}
        for b in docling_doc.blocks:
            block_types[b.type] = block_types.get(b.type, 0) + 1

        print(f"  {GREEN}✔ Parsed in {t_node1:.1f}ms{RESET}")
        print(f"  • Total Blocks Generated: {BOLD}{len(docling_doc.blocks)}{RESET}")
        for btype, count in block_types.items():
            print(f"    - {btype.capitalize():12}: {count} blocks")
        print(f"  • Tables Detected:        {BOLD}{len(docling_doc.tables)}{RESET}")

        print(f"\n  {BOLD}Sample Segmented Blocks (First 6 blocks):{RESET}")
        print(f"  {'Block ID':<16} {'Type':<12} {'Level':<7} {'Page':<6} {'Bounding Box (simulated)':<22} {'Preview'}")
        print("  " + "-" * 78)
        for b in docling_doc.blocks[:6]:
            preview = b.text.replace("\n", " ")[:35] + ("..." if len(b.text) > 35 else "")
            lvl_str = str(b.level) if b.level is not None else "-"
            bbox_str = f"[{b.bbox[0]:.0f},{b.bbox[1]:.0f},{b.bbox[2]:.0f},{b.bbox[3]:.0f}]" if b.bbox else "-"
            print(f"  {b.block_id:<16} {b.type:<12} {lvl_str:<7} {b.page_number:<6} {bbox_str:<22} {preview}")

        # Save complete unabridged output to node1_output.json and node1_output.md
        n1_json, n1_md = save_node1_output(output_dir, docling_doc, pdf_path, raw_pages, file_sha256)
        generated_files.append(("Node 1 (DoclingParserEngine)", n1_json, n1_md))
        print(f"\n  {GREEN}✔ Full output saved to:{RESET}")
        print(f"    - {n1_json}")
        print(f"    - {n1_md}")

    # Fallback if Node 1 wasn't selected directly
    if not docling_doc:
        doc_parser = DoclingParserEngine(use_native_if_available=False)
        docling_doc = doc_parser.parse_document("nhai-doc-02", pdf_path.name, raw_pages)

    # =========================================================================
    # Node 2: DocumentStructureBuilder
    # =========================================================================
    doc_tree: DocumentStructureTree | None = None
    if target_node in ("all", "2", "structure"):
        print_node_header(2, "DocumentStructureBuilder", "Hierarchical AST Section & Clause Tree")
        print(f"{DIM}Role in LangGraph: Builds a deterministic document hierarchy without costly LLM calls.{RESET}")
        print(f"{DIM}Maps every block to its enclosing legal Section/Article/Clause breadcrumb.{RESET}\n")

        t0 = time.perf_counter()
        doc_builder = DocumentStructureBuilder()
        doc_tree = doc_builder.build_structure(docling_doc)
        t_node2 = (time.perf_counter() - t0) * 1000

        print(f"  {GREEN}✔ Built structure tree in {t_node2:.1f}ms{RESET}")
        print(f"  • Total Structural Nodes: {BOLD}{len(doc_tree.nodes)}{RESET}")

        level_counts: dict[int, int] = {}
        for n in doc_tree.nodes:
            level_counts[n.level] = level_counts.get(n.level, 0) + 1
        for lvl, cnt in sorted(level_counts.items()):
            label = "Part/Schedule" if lvl == 1 else ("Section/Article" if lvl == 2 else "Clause/Sub-Clause")
            print(f"    - Level {lvl} ({label:<18}): {cnt} nodes")

        print(f"\n  {BOLD}Hierarchical Document Tree (Sample Branches):{RESET}")
        for idx, node in enumerate(doc_tree.nodes[:12]):
            indent = "    " * (node.level - 1)
            prefix = "└── " if node.level > 1 else "├── "
            title_clean = node.title.replace("\n", " ").strip()[:65]
            if len(node.title) > 65:
                title_clean += "..."
            print(f"  {indent}{prefix}{CYAN}[L{node.level}] {node.number}{RESET} — {title_clean} {DIM}({len(node.block_ids)} blocks){RESET}")

        # Save complete unabridged output to node2_output.json and node2_output.md
        n2_json, n2_md = save_node2_output(output_dir, doc_tree, docling_doc, pdf_path, file_sha256)
        generated_files.append(("Node 2 (DocumentStructureBuilder)", n2_json, n2_md))
        print(f"\n  {GREEN}✔ Full output saved to:{RESET}")
        print(f"    - {n2_json}")
        print(f"    - {n2_md}")

    if not doc_tree:
        doc_builder = DocumentStructureBuilder()
        doc_tree = doc_builder.build_structure(docling_doc)

    # =========================================================================
    # Node 3: CandidateDetector
    # =========================================================================
    candidates: list[Any] = []
    unselected: list[Any] = []
    if target_node in ("all", "3", "candidates"):
        print_node_header(3, "CandidateDetector", "High-Recall Deterministic Sieve & Priority Scoring")
        print(f"{DIM}Role in LangGraph: Evaluates 19 Indian procurement rules (deontic modals, eligibility, securities,{RESET}")
        print(f"{DIM}turnover, stamp duties). Filters cross-page boilerplate and scores candidate passages (0.0–1.0).{RESET}\n")

        t0 = time.perf_counter()
        detector = CandidateDetector()
        candidates, unselected = detector.detect_candidates_with_unselected(docling_doc, doc_tree)
        t_node3 = (time.perf_counter() - t0) * 1000

        print(f"  {GREEN}✔ Scanned {len(docling_doc.blocks)} blocks in {t_node3:.1f}ms{RESET}")
        print(f"  • Candidate Passages (Tier-1 Sieve): {BOLD}{GREEN}{len(candidates)}{RESET} passages")
        print(f"  • Unselected Passages (Held for Tier-2): {BOLD}{DIM}{len(unselected)}{RESET} passages")

        rule_histogram: dict[str, int] = {}
        for c in candidates:
            for r in c.matched_rules:
                rule_histogram[r] = rule_histogram.get(r, 0) + 1

        print(f"\n  {BOLD}Procurement Rules Triggered:{RESET}")
        for rule, count in sorted(rule_histogram.items(), key=lambda x: x[1], reverse=True):
            bar = "█" * min(30, int(count / 2) + 1)
            print(f"    - {rule:<25}: {count:3d}  {CYAN}{bar}{RESET}")

        print(f"\n  {BOLD}Top High-Priority Candidates Detected:{RESET}")
        sorted_candidates = sorted(candidates, key=lambda c: c.priority_score, reverse=True)
        print(f"  {'Score':<7} {'Page':<6} {'Section / Clause':<26} {'Matched Rules':<30} {'Snippet'}")
        print("  " + "-" * 78)
        for c in sorted_candidates[:8]:
            snippet = c.text.replace("\n", " ")[:35] + ("..." if len(c.text) > 35 else "")
            rules_str = ",".join(c.matched_rules[:2])
            if len(c.matched_rules) > 2:
                rules_str += f"+{len(c.matched_rules)-2}"
            sec_ref = (c.section_number or c.section_path or "General")[:24]
            score_color = GREEN if c.priority_score >= 0.90 else (YELLOW if c.priority_score >= 0.80 else CYAN)
            print(f"  {score_color}{c.priority_score:.2f}{RESET}   {c.page_number:<6} {sec_ref:<26} {rules_str:<30} {snippet}")

        # Save complete unabridged output to node3_output.json and node3_output.md
        n3_json, n3_md = save_node3_output(output_dir, candidates, unselected, rule_histogram, pdf_path, file_sha256)
        generated_files.append(("Node 3 (CandidateDetector)", n3_json, n3_md))
        print(f"\n  {GREEN}✔ Full output saved to:{RESET}")
        print(f"    - {n3_json}")
        print(f"    - {n3_md}")

    if not candidates:
        detector = CandidateDetector()
        candidates, unselected = detector.detect_candidates_with_unselected(docling_doc, doc_tree)

    # =========================================================================
    # Node 4: ContextAssembler
    # =========================================================================
    assembled_contexts: list[Any] = []
    if target_node in ("all", "4", "context"):
        print_node_header(4, "ContextAssembler", "Clause Windowing & Hierarchical Context Fusion")
        print(f"{DIM}Role in LangGraph: Fuses candidate passages with parent section paths and sibling blocks,{RESET}")
        print(f"{DIM}providing complete context windows so the LLM understands references like 'as mentioned above'.{RESET}\n")

        t0 = time.perf_counter()
        assembler = ContextAssembler()
        assembled_contexts = assembler.assemble_contexts(docling_doc, doc_tree, candidates)
        t_node4 = (time.perf_counter() - t0) * 1000

        print(f"  {GREEN}✔ Assembled {len(assembled_contexts)} context envelopes in {t_node4:.1f}ms{RESET}")

        # Save complete unabridged output to node4_output.json and node4_output.md
        n4_json, n4_md = save_node4_output(output_dir, assembled_contexts, pdf_path, file_sha256)
        generated_files.append(("Node 4 (ContextAssembler)", n4_json, n4_md))
        print(f"\n  {GREEN}✔ Full output saved to:{RESET}")
        print(f"    - {n4_json}")
        print(f"    - {n4_md}")

    # =========================================================================
    # Nodes 5, 6, 7: Extraction, Rescue & Deterministic Validation
    # =========================================================================
    if target_node in ("all", "5", "6", "7", "extraction"):
        print_node_header(5, "LLMExtraction & Deterministic Validation", "Compliance Items & Exact Grounding")
        print(f"{DIM}Role in LangGraph: Translates passages into structured items and validates that verbatim{RESET}")
        print(f"{DIM}quotes exist word-for-word in physical pages (zero hallucination guarantee).{RESET}\n")

        all_extracted = []
        validator = DeterministicValidator()
        validation_results = []

        for p in raw_pages:
            user_prompt = (
                f'<untrusted_document_data document_id="nhai-doc-02" page="{p["page_number"]}">\n'
                f'{p["text"]}\n'
                f'</untrusted_document_data>'
            )
            items = default_tender_extractor("Procurement Auditor", user_prompt)
            for item in items:
                all_extracted.append(item)
                # Physical page grounding check
                norm_quote = " ".join(item.provenance.verbatim_quote.split())
                norm_page_text = " ".join(p["text"].split())
                is_grounded = norm_quote in norm_page_text
                validation_results.append({
                    "item": item,
                    "page": p["page_number"],
                    "is_grounded": is_grounded,
                })

        print(f"  • Total Extracted Compliance Items: {BOLD}{GREEN}{len(all_extracted)}{RESET}")
        grounded_count = sum(1 for v in validation_results if v["is_grounded"])
        grounded_pct = (grounded_count / len(validation_results) * 100) if validation_results else 100.0
        print(f"  • Deterministic Page Grounding:      {BOLD}{GREEN}{grounded_count}/{len(validation_results)} ({grounded_pct:.0f}% exact substring match){RESET}\n")

        # Save complete unabridged output to node5_output.json and node5_output.md
        n5_json, n5_md = save_node5_output(output_dir, validation_results, pdf_path, file_sha256)
        generated_files.append(("Node 5 (Extraction & Grounding)", n5_json, n5_md))
        print(f"  {GREEN}✔ Full output saved to:{RESET}")
        print(f"    - {n5_json}")
        print(f"    - {n5_md}")

    # =========================================================================
    # Convenience Links in Project Root & Global Summary
    # =========================================================================
    # Create convenience symlinks/copies in REPO_ROOT for immediate access like `cat node1_output.md`
    for node_name, jpath, mpath in generated_files:
        link_or_copy(jpath, REPO_ROOT / jpath.name)
        link_or_copy(mpath, REPO_ROOT / mpath.name)

    # Optional explicit exports if requested
    if export_json:
        export_json.parent.mkdir(parents=True, exist_ok=True)
        summary_bundle = {
            "file_info": {
                "name": pdf_path.name,
                "path": str(pdf_path),
                "sha256": file_sha256,
                "total_pages": total_pages,
            },
            "output_directory": str(output_dir),
            "generated_files": [
                {"node": name, "json": str(j), "md": str(m)}
                for name, j, m in generated_files
            ],
        }
        export_json.write_text(json.dumps(summary_bundle, indent=2), encoding="utf-8")
        print(f"\n{BOLD}✔ Exported summary JSON to:{RESET} {export_json}")

    if export_md:
        export_md.parent.mkdir(parents=True, exist_ok=True)
        export_md.write_text(
            f"# Pipeline Inspection Summary\n\nAll node outputs have been successfully written to `{output_dir}`.\n",
            encoding="utf-8",
        )

    # Final summary box
    print("\n" + "=" * 80)
    print(f"{BOLD}{GREEN}Inspection Complete for {pdf_path.name}{RESET}")
    print(f"All full node outputs are saved and ready for your inspection:")
    for node_name, jpath, mpath in generated_files:
        print(f"  • {BOLD}{node_name}:{RESET}")
        print(f"    - {CYAN}{jpath.name}{RESET}  (JSON: {jpath.stat().st_size:,} bytes)")
        print(f"    - {CYAN}{mpath.name}{RESET}    (Markdown: {mpath.stat().st_size:,} bytes)")
    print(f"\nYou can inspect them directly, e.g.:")
    print(f"  $ {YELLOW}cat node1_output.md | less{RESET}  (Docling layout blocks)")
    print(f"  $ {YELLOW}cat node2_output.md | less{RESET}  (AST structure tree)")
    print(f"  $ {YELLOW}cat node3_output.md | less{RESET}  (143 candidates & 195 unselected)")
    print("=" * 80 + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Inspect LangGraph extraction pipeline nodes on authentic tender PDFs and save full node outputs."
    )
    default_pdf = REPO_ROOT / "data" / "procurement-evidence" / "01_Tender_Documents" / "02_NHAI_Greenfield_Exp_1450Cr_NIT.pdf"
    default_out_dir = REPO_ROOT / "inspection_output"

    parser.add_argument(
        "--pdf",
        type=Path,
        default=default_pdf,
        help="Path to tender PDF document (default: NHAI 1450Cr NIT)",
    )
    parser.add_argument(
        "--node",
        type=str,
        default="all",
        choices=["all", "1", "2", "3", "4", "5", "6", "7", "docling", "structure", "candidates", "context", "extraction"],
        help="Specify which node to inspect (default: all)",
    )
    parser.add_argument(
        "--page",
        type=int,
        default=None,
        help="Filter inspection to a specific physical page (e.g. 1..8)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=default_out_dir,
        help=f"Directory to save full node output files (default: {default_out_dir})",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Display extended block and clause diagnostics",
    )
    parser.add_argument(
        "--export-json",
        type=Path,
        default=None,
        help="Path to export global summary to JSON",
    )
    parser.add_argument(
        "--export-md",
        type=Path,
        default=None,
        help="Path to export global summary Markdown report",
    )

    args = parser.parse_args()
    run_inspection(
        pdf_path=args.pdf,
        target_node=args.node,
        target_page=args.page,
        verbose=args.verbose,
        output_dir=args.output_dir,
        export_json=args.export_json,
        export_md=args.export_md,
    )


if __name__ == "__main__":
    main()
