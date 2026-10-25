import re

from tenderpulse_ai.domain.models import (
    DoclingParsedDocument,
    DocumentStructureTree,
    SectionNode,
)


class DocumentStructureBuilder:
    """Node 2 - Build document structure (non-LLM AST Generator).

    Identifies section hierarchy deterministically:
    PART I
     ├── Section 1
     │    ├── 1.1
     │    ├── 1.2
     │    └── 1.3
     └── Section 2
    """

    # Regex patterns for arbitrary document hierarchy & section titles
    PART_PATTERN = re.compile(
        r"^(PART\s+[I|V|X\d]+|SCHEDULE\s*[-–—]?\s*[A-Za-z\dIVX]+|ANNEXURE\s*[-–—]?\s*[A-Za-z\d]+|APPENDIX\s*[-–—]?\s*[A-Za-z\d]+)",
        re.IGNORECASE,
    )
    SECTION_PATTERN = re.compile(r"^(SECTION\s+[\dA-Za-z]+|ARTICLE\s+[\dA-Za-z]+)", re.IGNORECASE)
    GUARDED_CLAUSE_PATTERN = re.compile(
        r"^(?:"
        r"(?:(?:GC|CC|GCC|SCC|ITB|BDS)\s*)?(?:Clause|Sub-Clause|Article|Section|Schedule|Annexure|Appendix|Table|PQ|Item)\s*[-–—:]?\s*(?:No\.?[ \t]*)?([A-Za-z\d]+(?:\.[A-Za-z\d]+)*)"
        r"|"
        r"([1-6]?\d(?:\.\d+){0,3})[.)]\s+([A-Z][A-Za-z0-9\s—–-]{2,})"
        r")",
        re.IGNORECASE,
    )
    CLAUSE_PATTERN = GUARDED_CLAUSE_PATTERN

    @staticmethod
    def _is_invalid_clause_candidate(text: str) -> bool:
        cleaned = text.strip()

        # 1. Calendar dates at start: 22.01.2026, 19.02.2026
        if re.match(r"^\d{1,2}\.\d{1,2}\.\d{2,4}\b", cleaned):
            return True

        # 2. Bare decimals at start: 0.5, 0.25
        if re.match(r"^0\.\d+\b", cleaned):
            return True

        # 3. Physical measurements / monetary values at start: 50 km, 100 meters
        if re.match(
            r"^\d+(?:\.\d+)?\s*(?:km|kms|mtr|meters|hrs|hours|am|pm|crore|crores|cr|lakh|lakhs|%|percent)\b",
            cleaned,
            re.IGNORECASE,
        ):
            return True

        # 4. Standalone or leading road chainages:
        # e.g., "Km. 87.000", "Ch. 12.000", "Chainage 348.000"
        if re.match(r"^(?:Km\.?|Ch\.?|Chainage)\s*\d+", cleaned, re.IGNORECASE):
            return True

        # 5. Chainage ranges at start:
        # e.g., "348.000 to 398.000", "Km. 87.000 to Km. 120.000", "12.000 - 15.000"
        if re.match(
            r"^(?:Km\.?\s*)?\d+(?:\.\d{3})?\s*(?:to|-)\s*(?:Km\.?\s*)?\d+(?:\.\d{3})?\b",
            cleaned,
            re.IGNORECASE,
        ):
            return True

        # 6. Standalone 2-digit / 3-digit decimal chainages (3-decimal place meter markers):
        # e.g., "12.000. Road Section", "48.000. Highway Construction", "348.000."
        if re.match(r"^\d{1,4}\.\d{3}\b", cleaned):
            return True

        # 7. Table items / bank detail lines:
        # e.g., "1. Name of Beneficiary", "2. Account No.", "3. Type of Account", "4. Name of Bank", "5. Branch IFSC"
        if re.match(
            r"^\d+[.)]\s+(?:Name of\s+(?:Beneficiary|Bank)|Account\s+No|Type of\s+Account|Name of Bank|Branch\s+IFSC|IFSC\s+CODE)\b",
            cleaned,
            re.IGNORECASE,
        ):
            return True

        return False

    def build_structure(self, doc: DoclingParsedDocument) -> DocumentStructureTree:
        tree = DocumentStructureTree(document_id=doc.document_id, nodes=[])

        current_part: SectionNode | None = None
        current_section: SectionNode | None = None
        current_clause: SectionNode | None = None

        node_counter = 1

        for block in doc.blocks:
            text = block.text.strip()

            part_match = self.PART_PATTERN.search(text)
            section_match = self.SECTION_PATTERN.search(text)
            clause_match = None
            if not self._is_invalid_clause_candidate(text):
                clause_match = self.GUARDED_CLAUSE_PATTERN.search(text)

            if part_match:
                node_id = f"sec_node_{node_counter}"
                node_counter += 1
                current_part = SectionNode(
                    node_id=node_id,
                    number=part_match.group(1).upper(),
                    title=text,
                    level=1,
                    parent_id=None,
                    block_ids=[block.block_id],
                )
                tree.nodes.append(current_part)
                current_section = None
                current_clause = None

            elif section_match:
                node_id = f"sec_node_{node_counter}"
                node_counter += 1
                parent_id = current_part.node_id if current_part else None
                current_section = SectionNode(
                    node_id=node_id,
                    number=section_match.group(1).upper(),
                    title=text,
                    level=2,
                    parent_id=parent_id,
                    block_ids=[block.block_id],
                )
                tree.nodes.append(current_section)
                current_clause = None

            elif clause_match:
                clause_number = clause_match.group(1) or clause_match.group(2) or "Clause"
                node_id = f"sec_node_{node_counter}"
                node_counter += 1
                parent_id = (
                    current_section.node_id
                    if current_section
                    else (current_part.node_id if current_part else None)
                )
                current_clause = SectionNode(
                    node_id=node_id,
                    number=clause_number,
                    title=text,
                    level=3,
                    parent_id=parent_id,
                    block_ids=[block.block_id],
                )
                tree.nodes.append(current_clause)

            else:
                # Assign block to active section/clause
                target_node = current_clause or current_section or current_part
                if target_node:
                    target_node.block_ids.append(block.block_id)

        # Fallback root node if no structural headings were found
        if not tree.nodes:
            fallback = SectionNode(
                node_id="sec_node_root",
                number="DOCUMENT_ROOT",
                title="General Document Content",
                level=1,
                parent_id=None,
                block_ids=[b.block_id for b in doc.blocks],
            )
            tree.nodes.append(fallback)

        return tree
