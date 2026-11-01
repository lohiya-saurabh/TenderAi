from __future__ import annotations

import re

from pydantic import BaseModel

from tenderpulse_ai.domain.tender_chunker import TenderDocumentChunk


class CrossReferenceLink(BaseModel):
    source_ref_id: str
    target_ref_id: str
    target_section: str
    target_page: int
    raw_reference_text: str
    hydrated_content: str


class CrossReferenceResolver:
    """
    Builds a bidirectional reference graph linking ITB/GCC shell clauses with
    Contract Data (e.g. pp. 88-89), Appendix to ITB (e.g. p. 23), and NIT 1.1 (e.g. p. 4).
    Hydrates 1-hop cross references directly into prompt context.
    """

    def __init__(self) -> None:
        self._ref_index: dict[str, TenderDocumentChunk] = {}
        self._links: dict[str, list[CrossReferenceLink]] = {}

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
        if "nit" in text or "notice inviting tender" in text:
            m = re.search(r"(\d+(?:\.\d+)*)", text)
            return f"nit:{m.group(1)}" if m else "nit"
        m = re.search(r"clause\s*(\d+(?:\.\d+)*)", text)
        if m:
            return f"clause:{m.group(1)}"
        m = re.search(r"\b(\d+(?:\.\d+)+)\b", text)
        if m:
            return f"clause:{m.group(1)}"
        return None

    def index_chunks(self, chunks: list[TenderDocumentChunk]) -> None:
        for chunk in chunks:
            ref_id = chunk.canonical_ref_id or self.canonicalize_ref_id(
                chunk.clause_reference, chunk.section_title
            )
            if ref_id:
                chunk.canonical_ref_id = ref_id
                self._ref_index[ref_id] = chunk

        # Build bidirectional links
        for ref_id, chunk in self._ref_index.items():
            discovered = self._discover_references(chunk)
            if discovered:
                self._links[ref_id] = discovered

    def _discover_references(self, chunk: TenderDocumentChunk) -> list[CrossReferenceLink]:
        links: list[CrossReferenceLink] = []
        content = chunk.content.lower()
        chunk_ref = (
            chunk.canonical_ref_id
            or self.canonicalize_ref_id(chunk.clause_reference, chunk.section_title)
            or ""
        )
        if not chunk.canonical_ref_id and chunk_ref:
            chunk.canonical_ref_id = chunk_ref

        # Check references to Contract Data
        if "contract data" in content and not chunk_ref.startswith("contract_data"):
            target_chunk = self._find_best_target("contract_data", chunk)
            if target_chunk:
                links.append(
                    CrossReferenceLink(
                        source_ref_id=chunk.canonical_ref_id or chunk.id,
                        target_ref_id=target_chunk.canonical_ref_id or target_chunk.id,
                        target_section=target_chunk.section_title or "Contract Data",
                        target_page=target_chunk.page_number,
                        raw_reference_text="Contract Data",
                        hydrated_content=target_chunk.verbatim_text or target_chunk.content,
                    )
                )

        # Check references to Appendix / ITB
        if "appendix" in content and not chunk_ref.startswith("appendix"):
            target_chunk = self._find_best_target("appendix", chunk)
            if target_chunk:
                links.append(
                    CrossReferenceLink(
                        source_ref_id=chunk.canonical_ref_id or chunk.id,
                        target_ref_id=target_chunk.canonical_ref_id or target_chunk.id,
                        target_section=target_chunk.section_title or "Appendix to ITB",
                        target_page=target_chunk.page_number,
                        raw_reference_text="Appendix",
                        hydrated_content=target_chunk.verbatim_text or target_chunk.content,
                    )
                )

        # Check references to NIT Table
        if ("nit" in content or "notice inviting tender" in content) and not chunk_ref.startswith(
            "nit"
        ):
            target_chunk = self._find_best_target("nit", chunk)
            if target_chunk:
                links.append(
                    CrossReferenceLink(
                        source_ref_id=chunk.canonical_ref_id or chunk.id,
                        target_ref_id=target_chunk.canonical_ref_id or target_chunk.id,
                        target_section=target_chunk.section_title or "NIT Table",
                        target_page=target_chunk.page_number,
                        raw_reference_text="NIT Table",
                        hydrated_content=target_chunk.verbatim_text or target_chunk.content,
                    )
                )

        return links

    def _find_best_target(
        self, target_prefix: str, source_chunk: TenderDocumentChunk
    ) -> TenderDocumentChunk | None:
        source_ref = (
            source_chunk.canonical_ref_id
            or self.canonicalize_ref_id(source_chunk.clause_reference, source_chunk.section_title)
            or ""
        )
        if source_ref.startswith(f"{target_prefix}:") or source_ref == target_prefix:
            return None
        # Match specific clause number if possible (e.g. clause:45.1 -> contract_data:45.1)
        if ":" in source_ref:
            num = source_ref.split(":", 1)[1]
            exact_key = f"{target_prefix}:{num}"
            if (
                exact_key in self._ref_index
                and exact_key != source_ref
                and self._ref_index[exact_key].id != source_chunk.id
            ):
                return self._ref_index[exact_key]

        # Match any chunk matching target_prefix
        for key, chunk in self._ref_index.items():
            if key.startswith(target_prefix) and key != source_ref and chunk.id != source_chunk.id:
                return chunk
        return None

    def hydrate_context(self, chunk: TenderDocumentChunk, base_context: str) -> str:
        ref_id = chunk.canonical_ref_id or self.canonicalize_ref_id(
            chunk.clause_reference, chunk.section_title
        )
        if not ref_id:
            return base_context

        links = self._links.get(ref_id, [])
        if not links:
            return base_context

        hydration_blocks: list[str] = []
        for link in links:
            hydration_blocks.append(
                f"\n--- HYDRATED REFERENCE ({link.target_section} - Page {link.target_page}) ---\n"
                f"{link.hydrated_content}\n"
                f"----------------------------------------------------------------------"
            )
        return base_context + "\n" + "\n".join(hydration_blocks)

    def resolve_references(self, chunk_id_or_ref_id: str) -> tuple[list[str], list[str]]:
        outbound: list[str] = []
        inbound: list[str] = []
        for ref_id, links in self._links.items():
            if ref_id == chunk_id_or_ref_id:
                outbound.extend([link.target_ref_id for link in links])
            for link in links:
                if link.target_ref_id == chunk_id_or_ref_id:
                    inbound.append(ref_id)
        return outbound, inbound
