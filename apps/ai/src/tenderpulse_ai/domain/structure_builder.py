import re

from tenderpulse_ai.domain.models import (
    DoclingBlock,
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

    # Regex patterns for section titles & numbers
    PART_PATTERN = re.compile(r"^(PART\s+[I|V|X\d]+)", re.IGNORECASE)
    SECTION_PATTERN = re.compile(r"^(SECTION\s+\d+|ARTICLE\s+\d+)", re.IGNORECASE)
    CLAUSE_PATTERN = re.compile(r"^(\d+(\.\d+)+|\d+\.\b)", re.IGNORECASE)

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
            clause_match = self.CLAUSE_PATTERN.search(text)

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
                node_id = f"sec_node_{node_counter}"
                node_counter += 1
                parent_id = (
                    current_section.node_id
                    if current_section
                    else (current_part.node_id if current_part else None)
                )
                current_clause = SectionNode(
                    node_id=node_id,
                    number=clause_match.group(1),
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
