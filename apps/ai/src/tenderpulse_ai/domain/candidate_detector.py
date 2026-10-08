import re
from typing import ClassVar

from tenderpulse_ai.domain.models import (
    CandidatePassage,
    DoclingParsedDocument,
    DocumentStructureTree,
)


class CandidateDetector:
    """Node 3 - Candidate Requirement Detection Engine.

    Finds passages that might contain compliance requirements using layout + lightweight linguistic rules.
    Filters out boilerplate headers/footers to reduce LLM tokens.
    """

    RULES: ClassVar[list[tuple[re.Pattern, str]]] = [
        (re.compile(r"\b(shall|must|required\s+to|mandated\s+to)\b", re.IGNORECASE), "DEONTIC_MODAL"),
        (re.compile(r"\b(eligible\s+bidders?|eligibility\s+criteria)\b", re.IGNORECASE), "ELIGIBILITY"),
        (re.compile(r"\b(earnest\s+money|EMD|security\s+deposit|bank\s+guarantee)\b", re.IGNORECASE), "FINANCIAL_SECURITY"),
        (re.compile(r"\b(within\s+\d+\s+days|deadline|due\s+date|closing\s+time)\b", re.IGNORECASE), "DEADLINE"),
        (re.compile(r"\b(stamp\s+paper|notariz(ed|ation)|authorized\s+signatory|udin)\b", re.IGNORECASE), "EXECUTION_RULE"),
        (re.compile(r"\b(turnover|net\s+worth|solvency|audit(ed)?\s+balance\s+sheet)\b", re.IGNORECASE), "FINANCIAL_THRESHOLD"),
        (re.compile(r"\b(conditions?\s+precedent|appointed\s+date|commercial\s+operation\s+date|COD)\b", re.IGNORECASE), "CONTRACT_LIFECYCLE"),
        (re.compile(r"\b(liquidated\s+damages|delay\s+damages|damages\s+for\s+delay)\b", re.IGNORECASE), "DAMAGES_PENALTY"),
        (re.compile(r"\b(escrow\s+account|waterfall|priority\s+of\s+payments)\b", re.IGNORECASE), "ESCROW_WATERFALL"),
        (re.compile(r"\b(insurance|indemnity|co-insured|all-risk)\b", re.IGNORECASE), "INSURANCE_COVENANT"),
        (re.compile(r"\b(dispute\s+resolution|arbitration|SAROD|conciliation)\b", re.IGNORECASE), "DISPUTE_RESOLUTION"),
        (re.compile(r"\b(mobile\s+crane|ambulance|medical\s+aid|rescue\s+post|traffic\s+census|weigh-in-motion)\b", re.IGNORECASE), "SAFETY_OPERATIONS"),
        (re.compile(r"\b(applicable\s+permits|schedule-e|schedule\s+e|clearance)\b", re.IGNORECASE), "STATUTORY_PERMITS"),
        (re.compile(r"\b(maintenance\s+requirements?|level\s+of\s+service|time\s+limit\s+for\s+rectification|schedule-k|schedule\s+k)\b", re.IGNORECASE), "MAINTENANCE_SLA"),
        (re.compile(r"\b(project\s+milestone|completion\s+schedule|schedule-g|schedule\s+g)\b", re.IGNORECASE), "CONSTRUCTION_MILESTONES"),
    ]

    def detect_candidates(
        self,
        doc: DoclingParsedDocument,
        tree: DocumentStructureTree,
    ) -> list[CandidatePassage]:
        candidates: list[CandidatePassage] = []

        # Create block_id -> section mapping (block_id -> (section_number, section_path))
        block_to_node: dict[str, tuple[str, str]] = {}
        node_lookup = {n.node_id: n for n in tree.nodes}

        for node in tree.nodes:
            # Build full section path: e.g. "Document > PART I > Section 1 > 1.1"
            path_parts = [node.number]
            curr = node
            while curr.parent_id and curr.parent_id in node_lookup:
                curr = node_lookup[curr.parent_id]
                path_parts.insert(0, curr.number)
            path_parts.insert(0, "Document")
            section_path = " > ".join(path_parts)

            for b_id in node.block_ids:
                block_to_node[b_id] = (node.number, section_path)

        cand_counter = 1
        for block in doc.blocks:
            text = block.text.strip()

            # Skip short generic boilerplate lines (< 15 chars)
            if len(text) < 15:
                continue

            matched_rules = []
            for pattern, rule_name in self.RULES:
                if pattern.search(text):
                    matched_rules.append(rule_name)

            if matched_rules:
                sec_num, sec_path = block_to_node.get(block.block_id, ("Unassigned", "Document"))
                candidates.append(
                    CandidatePassage(
                        candidate_id=f"cand_{cand_counter}",
                        section_number=sec_num,
                        section_path=sec_path,
                        text=text,
                        page_number=block.page_number,
                        block_id=block.block_id,
                        matched_rules=matched_rules,
                    )
                )
                cand_counter += 1

        return candidates
