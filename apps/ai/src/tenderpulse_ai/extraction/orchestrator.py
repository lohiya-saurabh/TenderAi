from __future__ import annotations

import asyncio
import hashlib
import logging
from typing import Any

from tenderpulse_ai.chat.okf_registry import register_tender_okf
from tenderpulse_ai.domain.models import VerifiedComplianceItem
from tenderpulse_ai.extraction.clause_references import (
    attribute_clause_refs_from_pages,
    attribute_positional_clause_refs,
)
from tenderpulse_ai.extraction.contracts import (
    DocumentExtractionRequest,
    DocumentExtractionResponse,
    NormalizedPage,
)
from tenderpulse_ai.extraction.deduplication import (
    consolidate_verified_items,
    detect_clause_contradictions,
)
from tenderpulse_ai.extraction.okf_compiler import compile_tender_to_okf
from tenderpulse_ai.infrastructure.embeddings import get_embedder
from tenderpulse_ai.models.llm_client import LLMExtractionError, StructuredLLMClient
from tenderpulse_ai.tools.page_text import PageTextTool
from tenderpulse_ai.tools.retrieval import DocumentChunk, ScopedRetrievalTool
from tenderpulse_ai.workflow.nodes import WorkflowNodeContext
from tenderpulse_ai.workflow.state import ComplianceWorkflowState

logger = logging.getLogger(__name__)


class ProductionExtractionPipeline:
    """Executes the end-to-end production AI extraction pipeline:

    Normalized content -> Upfront 5 Stages -> 3-Tier Chunking ->
    Scoped Retrieval -> LangGraph Compliance Workflow -> Deduplication -> OKF Compilation.
    """

    def __init__(self, llm_client: StructuredLLMClient | None = None):
        self.llm_client = llm_client or StructuredLLMClient()

    async def execute(self, request: DocumentExtractionRequest) -> DocumentExtractionResponse:
        sec_ctx = request.security_context
        all_verified_items: list[VerifiedComplianceItem] = []
        all_audit_events: list[dict[str, Any]] = []
        human_review_required = False

        if not request.pages and request.download_url:
            from tenderpulse_ai.domain.pdf_resolver import resolve_pdf_to_pages

            try:
                request.pages = await resolve_pdf_to_pages(
                    download_url=request.download_url,
                    document_id=request.document_id,
                    file_name=request.file_name,
                )
            except Exception as exc:
                logger.warning(
                    "Could not resolve PDF pages from download URL for doc %s: %s.",
                    request.document_id,
                    exc,
                )

        if not request.pages:
            raise ValueError(
                f"No extractable pages found for document '{request.document_id}' ({request.file_name})."
            )

        # Upfront 5 architectural stages
        from tenderpulse_ai.domain.candidate_detector import CandidateDetector
        from tenderpulse_ai.domain.context_assembler import ContextAssembler
        from tenderpulse_ai.domain.docling_parser import DoclingParserEngine
        from tenderpulse_ai.domain.structure_builder import DocumentStructureBuilder
        from tenderpulse_ai.domain.tender_chunker import TenderChunker

        # 1. Parse and chunk the full document first to generate wire_chunks across all pages
        doc_parser = DoclingParserEngine()
        docling_doc = doc_parser.parse_document(
            document_id=request.document_id,
            file_name=request.file_name,
            pages=[{"page_number": p.page_number, "text": p.text} for p in request.pages],
        )
        doc_builder = DocumentStructureBuilder()
        doc_tree = doc_builder.build_structure(docling_doc)

        chunker = TenderChunker()
        extracted_chunks = chunker.chunk_document(docling_doc, doc_tree)
        wire_chunks = [c.to_wire_dict() for c in extracted_chunks]

        # Convert extracted chunks to DocumentChunk DTOs for 3-tier retrieval
        all_doc_chunks = [
            DocumentChunk(
                chunk_id=c.id,
                tenant_id=sec_ctx.tenant_id,
                document_id=request.document_id,
                page_number=c.page_number,
                clause_reference=c.clause_reference or None,
                text=c.verbatim_text or c.content,
                parent_id=c.parent_id,
                tier=c.tier.value if hasattr(c.tier, "value") else str(c.tier),
                canonical_ref_id=c.canonical_ref_id,
                metadata=c.metadata,
            )
            for c in extracted_chunks
        ]

        detector = CandidateDetector()
        detected_candidates = detector.detect_candidates(docling_doc, doc_tree)

        assembler = ContextAssembler()
        assembled_contexts = assembler.assemble_contexts(
            docling_doc, doc_tree, detected_candidates, chunks=extracted_chunks
        )

        # Pre-group candidates, unselected passages, and contexts by page_number
        candidates_by_page: dict[int, list[dict[str, Any]]] = {}
        for c in detected_candidates:
            candidates_by_page.setdefault(c.page_number, []).append(c.model_dump())

        contexts_by_page: dict[int, list[dict[str, Any]]] = {}
        for a in assembled_contexts:
            contexts_by_page.setdefault(a.page_number, []).append(a.model_dump())

        page_text_by_number = {p.page_number: p.text for p in request.pages}
        shared_docling_dict = docling_doc.model_dump()
        shared_structure_dict = doc_tree.model_dump()

        # Every page goes to the LLM except pure table-of-contents / index pages.
        from tenderpulse_ai.domain.pdf_resolver import is_pure_toc_page

        candidate_pages = [p for p in request.pages if not is_pure_toc_page(p.text)] or list(
            request.pages
        )

        # Step 3: Batch 2–3 Pages per Prompt Window instead of 1 physical page at a time
        from tenderpulse_ai.config import settings

        window_size = max(1, min(settings.batch_page_window_size, 3))
        page_windows: list[list[NormalizedPage]] = [
            candidate_pages[i : i + window_size]
            for i in range(0, len(candidate_pages), window_size)
        ]

        # Process page windows through LangGraph compliance workflow (bounded concurrency to respect gateway in-flight limits)
        sem = asyncio.Semaphore(max(1, settings.llm_max_concurrency))

        async def _process_window(window: list[NormalizedPage]) -> dict[str, Any]:
            async with sem:
                retrieval_tool = ScopedRetrievalTool(embedder=get_embedder())
                page_text_tool = PageTextTool()

                window_page_numbers = {p.page_number for p in window}

                # Seed physical page text for all pages in the window
                for p in window:
                    page_text_tool.seed_page(
                        tenant_id=sec_ctx.tenant_id,
                        document_id=request.document_id,
                        page_number=p.page_number,
                        text=p.text,
                    )

                # Seed 3-tier chunks for all pages in the current window
                window_chunks = [c for c in all_doc_chunks if c.page_number in window_page_numbers]
                # Seeding embeds chunks with the local model: run it off the event loop.
                await asyncio.to_thread(
                    retrieval_tool.seed_chunks,
                    window_chunks
                    or [
                        DocumentChunk(
                            chunk_id=f"chk_{request.document_id}_{p.page_number}",
                            tenant_id=sec_ctx.tenant_id,
                            document_id=request.document_id,
                            page_number=p.page_number,
                            text=p.text,
                        )
                        for p in window
                    ],
                )
                # Index all document chunks by ID for small-to-big parent expansion
                for c in all_doc_chunks:
                    retrieval_tool._chunks_by_id[c.chunk_id] = c

                node_ctx = WorkflowNodeContext(
                    retrieval_tool=retrieval_tool,
                    page_text_tool=page_text_tool,
                    llm_client=self.llm_client,
                )
                from tenderpulse_ai.workflow.graph import build_compliance_workflow_graph

                graph = build_compliance_workflow_graph(node_ctx)

                window_candidates = []
                for p in window:
                    window_candidates.extend(candidates_by_page.get(p.page_number, []))

                window_contexts = []
                for p in window:
                    window_contexts.extend(contexts_by_page.get(p.page_number, []))

                combined_page_text = "\n\n".join(
                    f"--- PAGE {p.page_number} ---\n{p.text}" for p in window
                )
                # Text stitched across the window's trailing page break must stay groundable.
                next_page = page_text_by_number.get(window[-1].page_number + 1, "")

                initial_state: ComplianceWorkflowState = {
                    "security_context": sec_ctx.model_dump(),
                    "bid_id": request.bid_id,
                    "document_id": request.document_id,
                    "file_name": request.file_name,
                    "page_number": window[0].page_number,
                    "raw_page_text": combined_page_text,
                    "pages": [{"page_number": p.page_number, "text": p.text} for p in window],
                    "continuation_text": next_page,
                    "docling_document": shared_docling_dict,
                    "document_structure": shared_structure_dict,
                    "detected_candidates": window_candidates,
                    "assembled_contexts": window_contexts,
                    "retrieved_chunks": [],
                    "extracted_candidates": [],
                    "verified_items": [],
                    "unverified_items": [],
                    "retry_count": 0,
                    "error_feedback": None,
                    "status": "INITIALIZED",
                    "human_review_required": False,
                    "audit_events": [],
                }

                pages_label = "-".join(str(p.page_number) for p in window)
                thread_id = (
                    f"tenant_{sec_ctx.tenant_id}:company_{sec_ctx.company_id or 'unassigned'}:"
                    f"run_{sec_ctx.workflow_run_id}:bid_{request.bid_id}:"
                    f"doc_{request.document_id}:pages_{pages_label}"
                )
                config: Any = {"configurable": {"thread_id": thread_id}}
                final_state = await graph.ainvoke(initial_state, config=config)
                return final_state

        page_results = await asyncio.gather(*(_process_window(w) for w in page_windows))
        failed_pages: list[int] = []
        extraction_errors: list[str] = []
        for window, final_state in zip(page_windows, page_results):
            if final_state.get("human_review_required", False):
                human_review_required = True
            if final_state.get("extraction_error"):
                failed_pages.extend(p.page_number for p in window)
                extraction_errors.append(final_state["extraction_error"])
            all_verified_items.extend(final_state.get("verified_items", []))
            all_audit_events.extend(final_state.get("audit_events", []))

        # LLM-only: when no window got a valid model answer there is nothing to return.
        # Raising lets the queue worker retry the job and finally publish status=FAILED.
        if page_windows and len(extraction_errors) == len(page_windows):
            raise LLMExtractionError(
                f"LLM extraction failed for all {len(page_windows)} page windows of "
                f"'{request.document_id}': {extraction_errors[-1]}"
            )
        if failed_pages:
            logger.warning(
                "LLM extraction failed on pages %s of doc %s; returning partial result for review.",
                failed_pages,
                request.document_id,
            )

        # Positional AST clause attribution (line-start markers only), then consolidation
        attribute_positional_clause_refs(all_verified_items, docling_doc, doc_tree)
        # The tender's own line-start number around the quote is authoritative (same page only).
        attribute_clause_refs_from_pages(all_verified_items, page_text_by_number)
        formatted_items = consolidate_verified_items(all_verified_items, request)

        # Intra-document clause contradiction detection
        contradictions = detect_clause_contradictions(formatted_items)
        if contradictions:
            human_review_required = True

        # Automated PDF-to-OKF compilation
        okf_bundle = compile_tender_to_okf(
            items=formatted_items,
            contradictions=contradictions,
            tender_metadata={
                "document_id": request.document_id,
                "bid_id": request.bid_id,
                "file_name": request.file_name,
            },
        )
        register_tender_okf(request.bid_id, okf_bundle)

        # Conflicts are their own records linked to the clauses that state each value; they
        # are never added to the clause list. The generated precedence note is AI text and
        # travels separately from the verbatim quotes.
        conflicts = [to_wire_conflict(request.document_id, c) for c in contradictions]
        conflicts = [c for c in conflicts if len(c["values"]) >= 2]

        coverage = {
            "documentId": request.document_id,
            "pageCount": len(request.pages),
            "failedPages": [
                {"page": p, "reason": "LLM_EXTRACTION_FAILED"} for p in sorted(set(failed_pages))
            ],
            "status": "PARTIAL" if failed_pages else "COMPLETE",
        }
        failed_set = set(failed_pages)
        for item in formatted_items:
            page = item["provenance"]["pageNumber"]
            flags: list[str] = []
            if failed_set & {page - 1, page + 1}:
                flags.append("NEAR_FAILED_PAGE")
            if any(item["itemKey"] in {v["itemKey"] for v in c["values"]} for c in conflicts):
                flags.append("CONFLICT")
            item["flags"] = flags

        return DocumentExtractionResponse(
            bid_id=request.bid_id,
            document_id=request.document_id,
            status="REVIEW_READY" if not human_review_required else "HUMAN_REVIEW_REQUIRED",
            items=formatted_items,
            chunks=wire_chunks,
            human_review_required=human_review_required,
            audit_events=all_audit_events,
            okf_bundle=okf_bundle.model_dump(),
            uncertainty_items=contradictions,
            failed_pages=sorted(set(failed_pages)),
            conflicts=conflicts,
            coverage=coverage,
        )


def to_wire_conflict(document_id: str, contradiction: dict[str, Any]) -> dict[str, Any]:
    """Shared-contract conflict: each value links to the clause (itemKey) that states it."""
    values = [
        {
            "display": s.get("display") or s.get("title") or "",
            "itemKey": s.get("itemKey"),
            "quote": s.get("verbatimQuote") or "",
            "page": s.get("pageNumber"),
            "clauseRef": s.get("clauseReference"),
        }
        for s in contradiction.get("sources", [])
        if s.get("itemKey") and s.get("verbatimQuote")
    ]
    topic = contradiction.get("topic") or "Conflicting values"
    key_src = "|".join(sorted(v["itemKey"] for v in values))
    return {
        "conflictKey": "cf_"
        + hashlib.sha256(f"{document_id}|{topic}|{key_src}".encode()).hexdigest()[:24],
        "topic": topic,
        "attribute": contradiction.get("attribute") or topic,
        "values": values,
        # Generated reasoning, never tender text; the UI labels it "AI suggestion".
        "aiPrecedenceNote": contradiction.get("order_of_precedence_ruling"),
    }


__all__ = ["ProductionExtractionPipeline"]
