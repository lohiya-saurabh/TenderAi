import re

from tenderpulse_ai.domain.models import (
    AssembledClauseContext,
    CandidatePassage,
    DoclingParsedDocument,
    DocumentStructureTree,
)


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
    """

    DEF_PATTERN = re.compile(r'"([^"]+)"\s+(means|shall\s+mean|refers\s+to|is\s+defined\s+as)\b', re.IGNORECASE)
    REF_PATTERN = re.compile(r'\b(Clause|Section|Article|Part)\s+(\d+(\.\d+)*)\b', re.IGNORECASE)

    def assemble_contexts(
        self,
        doc: DoclingParsedDocument,
        tree: DocumentStructureTree,
        candidates: list[CandidatePassage],
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

        assembled_list: list[AssembledClauseContext] = []

        for candidate in candidates:
            idx = block_index_map.get(candidate.block_id)

            prev_text = block_list[idx - 1].text if (idx is not None and idx > 0) else None
            next_text = block_list[idx + 1].text if (idx is not None and idx < len(block_list) - 1) else None

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
                )
            )

        return assembled_list
