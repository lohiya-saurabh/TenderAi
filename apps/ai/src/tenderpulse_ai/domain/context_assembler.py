import re

from tenderpulse_ai.domain.cross_reference_resolver import CrossReferenceResolver
from tenderpulse_ai.domain.models import (
    AssembledClauseContext,
    CandidatePassage,
    DoclingParsedDocument,
    DocumentStructureTree,
)
from tenderpulse_ai.domain.tender_chunker import TenderDocumentChunk


class ContextAssembler:
    """Node 4 - Context Assembly Engine.

    Assembles structural and local context for the LLM:
    Document
     └── Article 4
          └── Section 4.2
               └── Clause 4.2.3
    - Previous clause
    - Current clause
    - Following clause
    - Relevant definitions
    - Referenced clauses
    - 1-hop Hydrated Cross-References (Contract Data, Appendix, NIT)
    """

    DEF_PATTERN = re.compile(
        r'"([^"]+)"\s+(means|shall\s+mean|refers\s+to|is\s+defined\s+as)\b', re.IGNORECASE
    )
    # Keyword + separator + a real identifier (number, Roman numeral or single capital):
    # "partners" is not "Part ners", "Section of the" is not a reference.
    REF_PATTERN = re.compile(
        r"\b((?i:Sub-Clause|Clause|Section|Article|Part|Schedule|Annexure|Appendix))"
        r"(?:\s+|\s*[-–—]\s*)((?:\d+[A-Za-z]?|[IVXLC]+[A-Z]?|[A-Z])(?:\.\d+[A-Za-z]?)*)\b"
    )

    def assemble_contexts(
        self,
        doc: DoclingParsedDocument,
        tree: DocumentStructureTree,
        candidates: list[CandidatePassage],
        chunks: list[TenderDocumentChunk] | None = None,
    ) -> list[AssembledClauseContext]:
        # 1. Extract definitions from document
        definitions: dict[str, str] = {}
        for block in doc.blocks:
            match = self.DEF_PATTERN.search(block.text)
            if match:
                term = match.group(1).strip()
                definitions[term] = block.text

        # 2. Build block index map
        block_list = doc.blocks
        block_index_map = {b.block_id: i for i, b in enumerate(block_list)}

        # 3. Initialize CrossReferenceResolver if chunks provided
        resolver: CrossReferenceResolver | None = None
        if chunks:
            resolver = CrossReferenceResolver()
            resolver.index_chunks(chunks)

        assembled_list: list[AssembledClauseContext] = []

        for candidate in candidates:
            idx = block_index_map.get(candidate.block_id)

            prev_text = block_list[idx - 1].text if (idx is not None and idx > 0) else None
            next_text = (
                block_list[idx + 1].text
                if (idx is not None and idx < len(block_list) - 1)
                else None
            )

            # Find referenced clauses in current text
            referenced: list[str] = []
            for match in self.REF_PATTERN.finditer(candidate.text):
                ref_str = f"{match.group(1)} {match.group(2)}"
                if ref_str not in referenced:
                    referenced.append(ref_str)

            # Match definitions relevant to current text
            matched_defs: dict[str, str] = {}
            for term, def_text in definitions.items():
                if re.search(r"\b" + re.escape(term) + r"\b", candidate.text, re.IGNORECASE):
                    matched_defs[term] = def_text

            hydrated_context: str | None = None
            if resolver and chunks:
                target_canon = CrossReferenceResolver.canonicalize_ref_id(
                    candidate.section_number, candidate.section_path
                )
                matching_chunk = resolver._ref_index.get(target_canon) if target_canon else None
                if not matching_chunk:
                    for chk in chunks:
                        if candidate.text in chk.content or (
                            chk.verbatim_text and chk.verbatim_text in candidate.text
                        ):
                            matching_chunk = chk
                            break

                if matching_chunk:
                    hydrated = resolver.hydrate_context(matching_chunk, candidate.text)
                    if hydrated != candidate.text:
                        hydrated_context = hydrated
                    outbound, _ = resolver.resolve_references(
                        matching_chunk.canonical_ref_id or matching_chunk.id
                    )
                    for ref_id in outbound:
                        if ref_id not in referenced:
                            referenced.append(ref_id)

            assembled_list.append(
                AssembledClauseContext(
                    candidate_id=candidate.candidate_id,
                    section_path=candidate.section_path,
                    clause_reference=candidate.section_number,
                    current_clause=candidate.text,
                    previous_clause=prev_text,
                    following_clause=next_text,
                    relevant_definitions=matched_defs,
                    referenced_clauses=referenced,
                    page_number=candidate.page_number,
                    hydrated_context=hydrated_context,
                )
            )

        return assembled_list
