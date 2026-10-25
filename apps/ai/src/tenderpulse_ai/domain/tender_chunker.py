from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel, Field

from tenderpulse_ai.domain.docling_parser import is_clause_deleted
from tenderpulse_ai.domain.models import DoclingParsedDocument, DocumentStructureTree, SectionNode
from tenderpulse_ai.domain.structure_builder import DocumentStructureBuilder


class TenderDocumentChunk(BaseModel):
    """
    Structured representation of a document chunk produced by
    Hierarchical Contextual Semantic Chunking (HCSC).
    """

    id: str = Field(..., description="Unique chunk identifier")
    chunk_index: int = Field(..., ge=0, description="0-indexed position within document")
    chunk_type: str = Field(default="PROSE", description="PROSE, TABLE, HEADING, or CLAUSE")
    content: str = Field(..., min_length=1, description="Textual or tabular content of the chunk")
    page_number: int = Field(default=1, ge=1, description="Physical PDF source page number")
    section_title: str | None = Field(default=None, description="Enclosing section title")
    clause_reference: str | None = Field(
        default=None, description="Specific clause or sub-clause number"
    )
    bounding_box: dict[str, Any] | list[float] | None = Field(
        default=None, description="Visual coordinates"
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict, description="Contextual breadcrumbs and attributes"
    )
    embedding: list[float] | None = Field(default=None, description="Dense vector embedding")
    parent_id: str | None = Field(
        default=None, description="Parent chunk identifier for Small-to-Big retrieval"
    )
    canonical_ref_id: str | None = Field(
        default=None, description="Canonical clause identifier e.g. clause:45.1"
    )
    tier: str = Field(
        default="TIER2_PARENT", description="TIER1_SKELETON, TIER2_PARENT, or TIER3_CHILD"
    )
    verbatim_text: str | None = Field(
        default=None, description="Raw unadorned text for UI citation"
    )

    def to_wire_dict(self) -> dict[str, Any]:
        """Maps to camelCase / wire DTO format for API serialization."""
        return {
            "id": self.id,
            "chunkId": self.id,
            "chunkIndex": self.chunk_index,
            "chunkType": self.chunk_type,
            "content": self.content,
            "pageNumber": self.page_number,
            "sectionTitle": self.section_title,
            "clauseReference": self.clause_reference,
            "parentId": self.parent_id,
            "canonicalRefId": self.canonical_ref_id,
            "tier": self.tier,
            "verbatimText": self.verbatim_text,
            "boundingBox": self.bounding_box
            if isinstance(self.bounding_box, dict)
            else ({"bbox": self.bounding_box} if self.bounding_box else None),
            "metadata": self.metadata,
            "embedding": self.embedding,
        }


def _split_into_sentences(text: str) -> list[str]:
    """Splits text into sentences while protecting currency abbreviations, decimals, and numbers."""
    protected = re.sub(r"\b(Rs|No|Dr|Mr|Mrs|Ms|vs|approx|e\.g|i\.e)\.\s+", r"\1<<DOT>> ", text)
    protected = re.sub(r"(\d+)\.(\d+)", r"\1<<DOT>>\2", protected)
    raw = [s.strip() for s in re.split(r"(?<=[.!?])\s+", protected) if s.strip()]
    return [s.replace("<<DOT>>", ".") for s in raw]


class TenderChunker:
    """
    Hierarchical Contextual Semantic Chunking (HCSC) using Docling AST.

    Features:
    1. Hierarchical Context: Traverses the DocumentStructureTree to maintain breadcrumb
       hierarchy (e.g. Part > Section > Clause) across all extracted chunks.
    2. Contextual Prefixing: Enriches chunk content with explicit hierarchy tags so retrieval
       models never lose structural provenance.
    3. Semantic Boundary Preservation: Splits text along natural clause and sentence boundaries,
       never severing numbers, denominations, or statutory conditions mid-sentence.
    4. Structural Table Preservation: Ingests DoclingTable objects directly as native Markdown
       tables preserving row/column alignment.
    """

    def __init__(
        self, target_chunk_chars: int = 1200, max_chunk_chars: int = 2000, overlap_chars: int = 150
    ):
        self.target_chunk_chars = target_chunk_chars
        self.max_chunk_chars = max_chunk_chars
        self.overlap_chars = overlap_chars

    @staticmethod
    def canonicalize_ref_id(clause_ref: str | None, section_title: str | None) -> str | None:
        text = f"{clause_ref or ''} {section_title or ''}".lower()
        if not text.strip():
            return None
        if "contract data" in text:
            m = re.search(r"(\d+(?:\.\d+)*)", text)
            return f"contract_data:{m.group(1)}" if m else "contract_data"
        if "appendix" in text:
            m = re.search(r"(\d+(?:\.\d+)*)", text)
            return f"appendix:{m.group(1)}" if m else "appendix"
        if "nit" in text:
            m = re.search(r"(\d+(?:\.\d+)*)", text)
            return f"nit:{m.group(1)}" if m else "nit"
        m = re.search(r"clause\s*(\d+(?:\.\d+)*)", text)
        if m:
            return f"clause:{m.group(1)}"
        m = re.search(r"\b(\d+(?:\.\d+)+)\b", text)
        if m:
            return f"clause:{m.group(1)}"
        return None

    def chunk_document(
        self,
        doc: DoclingParsedDocument,
        tree: DocumentStructureTree | None = None,
    ) -> list[TenderDocumentChunk]:
        """
        Transforms a parsed Docling document AST into a list of contextualized semantic chunks.
        """
        if tree is None:
            builder = DocumentStructureBuilder()
            tree = builder.build_structure(doc)

        # Build block_id -> SectionNode hierarchy mapping
        block_to_node: dict[str, SectionNode] = {}
        node_parents: dict[str, str] = {}
        node_by_id: dict[str, SectionNode] = {}

        for node in tree.nodes:
            node_by_id[node.node_id] = node
            if node.parent_id:
                node_parents[node.node_id] = node.parent_id
            for blk_id in node.block_ids:
                block_to_node[blk_id] = node

        def format_node_label(n: SectionNode) -> str:
            num = (n.number or "").strip()
            title = (n.title or "").strip()
            if num and title:
                if num.lower() in title.lower():
                    return title
                return f"{num} - {title}"
            return title or num or ""

        def get_hierarchy_path(node: SectionNode | None) -> list[SectionNode]:
            path: list[SectionNode] = []
            curr = node
            visited: set[str] = set()
            while curr and curr.node_id not in visited:
                visited.add(curr.node_id)
                path.insert(0, curr)
                parent_id = node_parents.get(curr.node_id)
                curr = node_by_id.get(parent_id) if parent_id else None
            return path

        skeleton_chunks: list[dict[str, Any]] = []
        parent_chunks: list[dict[str, Any]] = []
        child_chunks: list[dict[str, Any]] = []

        # 1. Generate Tier 1 Skeleton Chunks from AST structure and table schemas
        for node in tree.nodes:
            if node.level <= 2:
                if is_clause_deleted(node.title or "") or is_clause_deleted(node.number or ""):
                    continue
                child_clauses = [
                    n.number
                    for n in tree.nodes
                    if n.parent_id == node.node_id
                    and n.number
                    and not is_clause_deleted(n.title or "")
                    and not is_clause_deleted(n.number or "")
                ]
                contained_str = (
                    f"Contained Clauses: {', '.join(child_clauses)}"
                    if child_clauses
                    else "Contained Clauses: General Provisions"
                )
                sk_id = f"chk_{doc.document_id}_sk_{node.node_id}"
                sk_canon = f"skeleton:{node.node_id}"
                node_num_title = (
                    f"{node.number} - {node.title}"
                    if node.number and node.title
                    else (node.title or node.number)
                )
                skeleton_chunks.append(
                    {
                        "id": sk_id,
                        "chunk_type": "SKELETON",
                        "content": f"[SECTION SKELETON: {node.title}]\nSection: {node_num_title}\n{contained_str}",
                        "verbatim_text": None,
                        "page_number": 1,
                        "section_title": node.title,
                        "clause_reference": node.number,
                        "canonical_ref_id": sk_canon,
                        "tier": "TIER1_SKELETON",
                        "parent_id": None,
                        "bounding_box": None,
                        "metadata": {
                            "document_id": doc.document_id,
                            "node_id": node.node_id,
                            "level": node.level,
                            "is_skeleton": True,
                            "canonical_ref_id": sk_canon,
                        },
                    }
                )

        for tbl in doc.tables:
            if is_clause_deleted(tbl.caption or ""):
                continue
            sk_tbl_id = f"chk_{doc.document_id}_sk_tbl_{tbl.table_id}"
            sk_tbl_canon = f"skeleton:table:{tbl.table_id}"
            skeleton_chunks.append(
                {
                    "id": sk_tbl_id,
                    "chunk_type": "TABLE_SKELETON",
                    "content": (
                        f"[TABLE SKELETON: Table {tbl.table_id} - Page {tbl.page_number}]\n"
                        f"Caption: {tbl.caption or 'Table'}\n"
                        f"Headers: {', '.join(tbl.headers)}\n"
                        f"Row Key Map: {getattr(tbl, 'row_key_map', {})}"
                    ),
                    "verbatim_text": None,
                    "page_number": tbl.page_number,
                    "section_title": tbl.caption or f"Table {tbl.table_id}",
                    "clause_reference": tbl.table_id,
                    "canonical_ref_id": sk_tbl_canon,
                    "tier": "TIER1_SKELETON",
                    "parent_id": None,
                    "bounding_box": None,
                    "metadata": {
                        "document_id": doc.document_id,
                        "table_id": tbl.table_id,
                        "is_skeleton": True,
                        "canonical_ref_id": sk_tbl_canon,
                    },
                }
            )

        if not skeleton_chunks:
            sk_root_id = f"chk_{doc.document_id}_sk_root"
            skeleton_chunks.append(
                {
                    "id": sk_root_id,
                    "chunk_type": "SKELETON",
                    "content": f"[DOCUMENT SKELETON: {doc.file_name or doc.document_id}]\nTotal Blocks: {len(doc.blocks)}\nTotal Tables: {len(doc.tables)}",
                    "verbatim_text": None,
                    "page_number": 1,
                    "section_title": "Document Overview",
                    "clause_reference": None,
                    "canonical_ref_id": f"skeleton:{doc.document_id}",
                    "tier": "TIER1_SKELETON",
                    "parent_id": None,
                    "bounding_box": None,
                    "metadata": {"document_id": doc.document_id, "is_skeleton": True},
                }
            )

        # 2. Process blocks into Tier 2 Parents and Tier 3 Children
        curr_buffer: list[str] = []
        curr_len = 0
        curr_node: SectionNode | None = None
        curr_page = 1
        curr_bbox: Any = None

        def flush_buffer(
            clause_ref: str | None, sec_title: str | None, path_str: str, keep_overlap: bool = False
        ):
            nonlocal curr_buffer, curr_len, curr_page, curr_bbox
            if not curr_buffer:
                return

            full_text = " ".join(curr_buffer).strip()
            if not full_text:
                curr_buffer = []
                curr_len = 0
                return

            # Apply contextual header
            header_prefix = f"[{path_str}]\n" if path_str else ""
            content = f"{header_prefix}{full_text}"
            canon_id = self.canonicalize_ref_id(clause_ref, sec_title)
            parent_id = f"chk_{doc.document_id}_p{len(parent_chunks)}"

            parent_chunks.append(
                {
                    "id": parent_id,
                    "chunk_type": "CLAUSE" if clause_ref else "PROSE",
                    "content": content,
                    "verbatim_text": full_text,
                    "page_number": curr_page,
                    "section_title": sec_title,
                    "clause_reference": clause_ref,
                    "canonical_ref_id": canon_id,
                    "tier": "TIER2_PARENT",
                    "parent_id": None,
                    "bounding_box": curr_bbox,
                    "metadata": {
                        "document_id": doc.document_id,
                        "section_path": path_str,
                        "char_count": len(content),
                        "canonical_ref_id": canon_id,
                    },
                }
            )

            # Generate Tier 3 Child chunks along sentence boundaries
            sentences = _split_into_sentences(full_text)
            for c_idx, sent in enumerate(sentences):
                if len(sent) >= 15 or len(sentences) == 1:
                    child_chunks.append(
                        {
                            "id": f"{parent_id}_c{c_idx}",
                            "chunk_type": "CLAUSE_CHILD",
                            "content": f"[{path_str} > {clause_ref or 'Clause'}]\n{sent}"
                            if path_str
                            else sent,
                            "verbatim_text": sent,
                            "page_number": curr_page,
                            "section_title": sec_title,
                            "clause_reference": clause_ref,
                            "canonical_ref_id": canon_id,
                            "tier": "TIER3_CHILD",
                            "parent_id": parent_id,
                            "bounding_box": curr_bbox,
                            "metadata": {
                                "document_id": doc.document_id,
                                "section_path": path_str,
                                "char_count": len(sent),
                                "canonical_ref_id": canon_id,
                                "parent_id": parent_id,
                            },
                        }
                    )

            if keep_overlap and self.overlap_chars > 0 and len(curr_buffer) > 1:
                last_sent = curr_buffer[-1]
                if len(last_sent) <= self.overlap_chars:
                    curr_buffer = [last_sent]
                    curr_len = len(last_sent)
                else:
                    curr_buffer = []
                    curr_len = 0
            else:
                curr_buffer = []
                curr_len = 0

            curr_bbox = None

        for block in doc.blocks:
            node = block_to_node.get(block.block_id)
            block_text = block.text.strip()
            if not block_text:
                continue

            # Skip deleted blocks and blocks belonging to deleted parent sections
            if getattr(block, "is_deleted", False) or is_clause_deleted(block_text):
                continue
            if node and is_clause_deleted(node.title or ""):
                continue

            hierarchy = get_hierarchy_path(node)
            path_str = (
                " > ".join(format_node_label(n) for n in hierarchy if format_node_label(n))
                if hierarchy
                else ""
            )
            clause_ref = next(
                (
                    n.number
                    for n in reversed(hierarchy)
                    if n.level >= 3 or "clause" in (n.number or "").lower()
                ),
                None,
            )
            sec_title = next((format_node_label(n) for n in hierarchy if n.level <= 2), None)

            # If node changed or page changed, flush buffer without cross-section overlap
            page_changed = block.page_number != curr_page
            node_changed = node != curr_node
            should_flush = (node_changed or page_changed) and curr_buffer
            if should_flush:
                prev_hier = get_hierarchy_path(curr_node)
                prev_path = (
                    " > ".join(format_node_label(n) for n in prev_hier if format_node_label(n))
                    if prev_hier
                    else ""
                )
                prev_clause = next(
                    (
                        n.number
                        for n in reversed(prev_hier)
                        if n.level >= 3 or "clause" in (n.number or "").lower()
                    ),
                    None,
                )
                prev_sec = next((format_node_label(n) for n in prev_hier if n.level <= 2), None)
                flush_buffer(prev_clause, prev_sec, prev_path, keep_overlap=False)

            if not curr_buffer:
                curr_page = block.page_number
                curr_bbox = block.bbox

            curr_node = node

            # If block itself is huge, split along sentence boundaries
            if len(block_text) > self.max_chunk_chars:
                sentences = _split_into_sentences(block_text)
                for sentence in sentences:
                    sentence = sentence.strip()
                    if not sentence:
                        continue
                    if curr_len + len(sentence) > self.target_chunk_chars and curr_buffer:
                        flush_buffer(clause_ref, sec_title, path_str, keep_overlap=True)
                        if not curr_buffer:
                            curr_page = block.page_number
                            curr_bbox = block.bbox
                    curr_buffer.append(sentence)
                    curr_len += len(sentence)
            else:
                if curr_len + len(block_text) > self.target_chunk_chars and curr_buffer:
                    flush_buffer(clause_ref, sec_title, path_str, keep_overlap=False)
                    if not curr_buffer:
                        curr_page = block.page_number
                        curr_bbox = block.bbox
                curr_buffer.append(block_text)
                curr_len += len(block_text)

        if curr_buffer:
            final_hier = get_hierarchy_path(curr_node)
            final_path = (
                " > ".join(format_node_label(n) for n in final_hier if format_node_label(n))
                if final_hier
                else ""
            )
            final_clause = next(
                (
                    n.number
                    for n in reversed(final_hier)
                    if n.level >= 3 or "clause" in (n.number or "").lower()
                ),
                None,
            )
            final_sec = next((format_node_label(n) for n in final_hier if n.level <= 2), None)
            flush_buffer(final_clause, final_sec, final_path, keep_overlap=False)

        # 3. Process tables into Tier 2 Parents and Tier 3 Child Rows
        for tbl in doc.tables:
            if is_clause_deleted(tbl.caption or ""):
                continue
            tbl_md = tbl.to_markdown()
            if not tbl_md:
                continue
            table_header = f"[Table {tbl.table_id} - Page {tbl.page_number}]\n"
            canon_id = f"table:{tbl.table_id}"
            tbl_parent_id = f"chk_{doc.document_id}_p_tbl_{tbl.table_id}"

            parent_chunks.append(
                {
                    "id": tbl_parent_id,
                    "chunk_type": "TABLE",
                    "content": f"{table_header}{tbl_md}",
                    "verbatim_text": tbl_md,
                    "page_number": tbl.page_number,
                    "section_title": tbl.caption or f"Table {tbl.table_id}",
                    "clause_reference": tbl.table_id,
                    "canonical_ref_id": canon_id,
                    "tier": "TIER2_PARENT",
                    "parent_id": None,
                    "bounding_box": None,
                    "metadata": {
                        "document_id": doc.document_id,
                        "table_id": tbl.table_id,
                        "rows_count": len(tbl.rows),
                        "cols_count": len(tbl.headers),
                        "is_table": True,
                        "canonical_ref_id": canon_id,
                        "row_key_map": getattr(tbl, "row_key_map", {}),
                    },
                }
            )

            for r_idx, r in enumerate(tbl.rows):
                row_text = " | ".join(r)
                child_chunks.append(
                    {
                        "id": f"{tbl_parent_id}_r{r_idx}",
                        "chunk_type": "TABLE_ROW",
                        "content": (
                            f"| {' | '.join(tbl.headers)} |\n"
                            f"| {' | '.join(['---'] * len(tbl.headers))} |\n"
                            f"| {' | '.join(r)} |"
                        ),
                        "verbatim_text": row_text,
                        "page_number": tbl.page_number,
                        "section_title": tbl.caption or f"Table {tbl.table_id}",
                        "clause_reference": tbl.table_id,
                        "canonical_ref_id": canon_id,
                        "tier": "TIER3_CHILD",
                        "parent_id": tbl_parent_id,
                        "bounding_box": None,
                        "metadata": {
                            "document_id": doc.document_id,
                            "table_id": tbl.table_id,
                            "row_index": r_idx,
                            "canonical_ref_id": canon_id,
                            "parent_id": tbl_parent_id,
                        },
                    }
                )

        # 4. Combine and sort all chunks stably by page and tier hierarchy
        all_raw = parent_chunks + child_chunks + skeleton_chunks
        tier_order = {"TIER2_PARENT": 0, "TIER3_CHILD": 1, "TIER1_SKELETON": 2}
        all_raw.sort(key=lambda c: (c["page_number"], tier_order.get(c.get("tier", ""), 0)))

        result: list[TenderDocumentChunk] = []
        for idx, item in enumerate(all_raw):
            result.append(
                TenderDocumentChunk(
                    id=item["id"],
                    chunk_index=idx,
                    chunk_type=item["chunk_type"],
                    content=item["content"],
                    verbatim_text=item.get("verbatim_text"),
                    page_number=item["page_number"],
                    section_title=item["section_title"],
                    clause_reference=item["clause_reference"],
                    canonical_ref_id=item.get("canonical_ref_id"),
                    parent_id=item.get("parent_id"),
                    tier=item.get("tier", "TIER2_PARENT"),
                    bounding_box=item["bounding_box"],
                    metadata=item["metadata"],
                    embedding=None,
                )
            )

        return result
