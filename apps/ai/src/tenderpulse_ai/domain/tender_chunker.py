from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel, Field

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
            "boundingBox": self.bounding_box
            if isinstance(self.bounding_box, dict)
            else ({"bbox": self.bounding_box} if self.bounding_box else None),
            "metadata": self.metadata,
            "embedding": self.embedding,
        }


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

        raw_chunks: list[dict[str, Any]] = []

        # 1. Process blocks
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

            raw_chunks.append(
                {
                    "chunk_type": "CLAUSE" if clause_ref else "PROSE",
                    "content": content,
                    "page_number": curr_page,
                    "section_title": sec_title,
                    "clause_reference": clause_ref,
                    "bounding_box": curr_bbox,
                    "metadata": {
                        "document_id": doc.document_id,
                        "section_path": path_str,
                        "char_count": len(content),
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

            block_text = block.text.strip()
            if not block_text:
                continue

            # If node changed, flush buffer without cross-section overlap
            if node != curr_node and curr_buffer:
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
                sentences = re.split(r"(?<=[.!?])\s+", block_text)
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

        # 2. Process tables
        for tbl in doc.tables:
            tbl_md = tbl.to_markdown()
            if not tbl_md:
                continue
            table_header = f"[Table {tbl.table_id} - Page {tbl.page_number}]\n"
            raw_chunks.append(
                {
                    "chunk_type": "TABLE",
                    "content": f"{table_header}{tbl_md}",
                    "page_number": tbl.page_number,
                    "section_title": tbl.caption or f"Table {tbl.table_id}",
                    "clause_reference": tbl.table_id,
                    "bounding_box": None,
                    "metadata": {
                        "document_id": doc.document_id,
                        "table_id": tbl.table_id,
                        "rows_count": len(tbl.rows),
                        "cols_count": len(tbl.headers),
                        "is_table": True,
                    },
                }
            )

        # Sort chunks stably by page_number
        raw_chunks.sort(key=lambda c: c["page_number"])

        # Create structured chunks with sequential index
        result: list[TenderDocumentChunk] = []
        for idx, item in enumerate(raw_chunks):
            chunk_id = f"chk_{doc.document_id}_{idx}"
            result.append(
                TenderDocumentChunk(
                    id=chunk_id,
                    chunk_index=idx,
                    chunk_type=item["chunk_type"],
                    content=item["content"],
                    page_number=item["page_number"],
                    section_title=item["section_title"],
                    clause_reference=item["clause_reference"],
                    bounding_box=item["bounding_box"],
                    metadata=item["metadata"],
                    embedding=None,
                )
            )

        return result
