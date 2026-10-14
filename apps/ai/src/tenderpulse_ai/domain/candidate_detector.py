import re
from typing import ClassVar

from tenderpulse_ai.domain.models import (
    CandidatePassage,
    DoclingParsedDocument,
    DocumentStructureTree,
)

__all__ = [
    "CANDIDATE_DETECTION_RULES",
    "RULES",
    "CandidateDetector",
]


CANDIDATE_DETECTION_RULES: list[tuple[re.Pattern, str]] = [
    # 1. Primary Deontic Modals & Mandatory Covenants
    (
        re.compile(
            r"\b(shall|must|required\s+to|mandated\s+to|covenants?\s+to|undertakes?\s+to|obligated\s+to)\b",
            re.IGNORECASE,
        ),
        "DEONTIC_MODAL",
    ),
    # 2. Eligibility & Disqualification Restrictions (P0)
    (
        re.compile(
            r"\b(eligible\s+bidders?|eligibility\s+criteria|debarred|debarment|blacklisted|blacklisting|disqualif(ied|ication)|rejected|non-responsive|ineligible|conflict\s+of\s+interest|litigation\s+history|insolven(cy|t))\b",
            re.IGNORECASE,
        ),
        "ELIGIBILITY_RESTRICTION",
    ),
    # 3. Mandatory Tender Submissions & Legal Documents (P0)
    (
        re.compile(
            r"\b(power\s+of\s+attorney|PoA|board\s+resolution|affidavit|undertaking|integrity\s+pact|consortium|joint\s+venture|JV\s+agreement|lead\s+member|solvency\s+certificate|GSTIN|PAN)\b",
            re.IGNORECASE,
        ),
        "MANDATORY_DOCUMENTS",
    ),
    # 4. Financial Securities & Guarantees
    (
        re.compile(
            r"\b(earnest\s+money|EMD|security\s+deposit|bank\s+guarantee|PBG|bid\s+security|performance\s+security)\b",
            re.IGNORECASE,
        ),
        "FINANCIAL_SECURITY",
    ),
    # 5. Financial Ratios & Minimum Thresholds
    (
        re.compile(
            r"\b(turnover|net\s+worth|solvency|audit(ed)?\s+balance\s+sheet|working\s+capital|line\s+of\s+credit|cash\s+flow|annual\s+revenue)\b",
            re.IGNORECASE,
        ),
        "FINANCIAL_THRESHOLD",
    ),
    # 6. Statutory Execution Rules (Stamp paper, Notarization, UDIN)
    (
        re.compile(
            r"\b(stamp\s+paper|notariz(ed|ation)|authorized\s+signatory|udin|attestation|oath\s+commissioner|consular\s+attestation)\b",
            re.IGNORECASE,
        ),
        "EXECUTION_RULE",
    ),
    # 7. Negative Covenants & Prohibitions (P1)
    (
        re.compile(
            r"\b(shall\s+not|will\s+not\s+be\s+permitted|prohibited\s+from|under\s+no\s+circumstances|in\s+the\s+event\s+of\s+default|failure\s+to\s+comply|grounds\s+for\s+rejection)\b",
            re.IGNORECASE,
        ),
        "NEGATIVE_COVENANTS",
    ),
    # 8. Technical Capability & Past Experience (P1)
    (
        re.compile(
            r"\b(similar\s+works?|qualifying\s+works?|completed\s+works?|experience\s+criteria|technical\s+capability|key\s+personnel|project\s+manager|plant\s+and\s+machinery|construction\s+equipment|tools\s+and\s+plants?)\b",
            re.IGNORECASE,
        ),
        "TECHNICAL_CRITERIA",
    ),
    # 9. Deadlines & Time limits
    (
        re.compile(
            r"\b(within\s+\d+\s+days|deadline|due\s+date|closing\s+time|submission\s+date|bid\s+validity)\b",
            re.IGNORECASE,
        ),
        "DEADLINE",
    ),
    # 10. Liquidated Damages & Penalties
    (
        re.compile(
            r"\b(liquidated\s+damages|delay\s+damages|damages\s+for\s+delay|penalty|forfeit(ure)?\s+of\s+bid\s+security)\b",
            re.IGNORECASE,
        ),
        "DAMAGES_PENALTY",
    ),
    # 11. Contract Lifecycle & Effective Dates
    (
        re.compile(
            r"\b(conditions?\s+precedent|appointed\s+date|commercial\s+operation\s+date|COD|concession\s+period|defect\s+liability\s+period|DLP)\b",
            re.IGNORECASE,
        ),
        "CONTRACT_LIFECYCLE",
    ),
    # 12. Escrow & Payment Waterfall
    (
        re.compile(
            r"\b(escrow\s+account|waterfall|priority\s+of\s+payments|concessionaire\s+bank\s+account)\b",
            re.IGNORECASE,
        ),
        "ESCROW_WATERFALL",
    ),
    # 13. Insurance Covenants
    (
        re.compile(
            r"\b(insurance|indemnity|co-insured|all-risk|third\s+party\s+insurance)\b",
            re.IGNORECASE,
        ),
        "INSURANCE_COVENANT",
    ),
    # 14. Dispute Resolution
    (
        re.compile(
            r"\b(dispute\s+resolution|arbitration|SAROD|conciliation|amicable\s+settlement)\b",
            re.IGNORECASE,
        ),
        "DISPUTE_RESOLUTION",
    ),
    # 15. Operational Safety
    (
        re.compile(
            r"\b(mobile\s+crane|ambulance|medical\s+aid|rescue\s+post|traffic\s+census|weigh-in-motion)\b",
            re.IGNORECASE,
        ),
        "SAFETY_OPERATIONS",
    ),
    # 16. Statutory & Environmental Permits
    (
        re.compile(
            r"\b(applicable\s+permits|schedule-e|schedule\s+e|clearance|environmental\s+clearance|forest\s+clearance)\b",
            re.IGNORECASE,
        ),
        "STATUTORY_PERMITS",
    ),
    # 17. Maintenance SLAs
    (
        re.compile(
            r"\b(maintenance\s+requirements?|level\s+of\s+service|time\s+limit\s+for\s+rectification|schedule-k|schedule\s+k|roughness\s+index|pothole)\b",
            re.IGNORECASE,
        ),
        "MAINTENANCE_SLA",
    ),
    # 18. Construction Milestones
    (
        re.compile(
            r"\b(project\s+milestone|completion\s+schedule|schedule-g|schedule\s+g|milestone\s+\d+)\b",
            re.IGNORECASE,
        ),
        "CONSTRUCTION_MILESTONES",
    ),
    # 19. Short Compact Instructions (P0)
    (
        re.compile(
            r"\b(must\s+sign|shall\s+apply|submit\s+emd|furnish\s+pbg|mandatory|compulsory|stipulated)\b",
            re.IGNORECASE,
        ),
        "SHORT_INSTRUCTION",
    ),
]

RULES = CANDIDATE_DETECTION_RULES


class CandidateDetector:
    """Node 3 - High-Recall Candidate Requirement Detection & Scoring Engine.

    Identifies likely compliance requirements using layout, linguistic signals,
    hierarchical section context, and tabular structure.
    Prioritizes RECALL over precision to prevent silent exclusion of mandatory
    clauses, while filtering genuine cross-page running boilerplate.
    """

    RULES: ClassVar[list[tuple[re.Pattern, str]]] = CANDIDATE_DETECTION_RULES
    REQUIREMENT_SECTION_PATTERN: ClassVar[re.Pattern] = re.compile(
        r"\b(eligib|qualif|covenant|instruction|bid\s+security|penalty|damage|dispute|milestone|schedule|execution|specif|criteria|requirement|submission)\b",
        re.IGNORECASE,
    )

    def _find_repeating_boilerplate(self, doc: DoclingParsedDocument) -> set[str]:
        """Identifies running headers/footers repeated identically across multiple pages."""
        pages_by_norm_text: dict[str, set[int]] = {}
        for block in doc.blocks:
            norm = " ".join(block.text.strip().lower().split())
            if not norm:
                continue
            if norm not in pages_by_norm_text:
                pages_by_norm_text[norm] = set()
            pages_by_norm_text[norm].add(block.page_number)

        boilerplate: set[str] = set()
        for norm, pages in pages_by_norm_text.items():
            # If the exact same text appears on 3 or more distinct pages
            if len(pages) >= 3:
                # Confirm it looks like running header/footer (has RFP title, page label, or short metadata)
                if (
                    re.search(
                        r"\b(page\s+\d+|request\s+for\s+proposal|rfp|tender\s+no|confidential|all\s+rights\s+reserved)\b",
                        norm,
                    )
                    or len(norm) < 80
                ):
                    boilerplate.add(norm)
        return boilerplate

    def _calculate_priority_score(
        self,
        matched_rules: list[str],
        text: str,
        sec_title: str,
        is_table: bool = False,
    ) -> float:
        """Calculates a normalized priority score (0.0 to 1.0) for extraction scheduling."""
        base_weights = {
            "FINANCIAL_SECURITY": 0.95,
            "ELIGIBILITY_RESTRICTION": 0.95,
            "EXECUTION_RULE": 0.90,
            "DEONTIC_MODAL": 0.85,
            "FINANCIAL_THRESHOLD": 0.85,
            "MANDATORY_DOCUMENTS": 0.85,
            "DAMAGES_PENALTY": 0.85,
            "SHORT_INSTRUCTION": 0.85,
            "NEGATIVE_COVENANTS": 0.80,
            "TECHNICAL_CRITERIA": 0.80,
            "DEADLINE": 0.75,
            "MAINTENANCE_SLA": 0.75,
            "CONSTRUCTION_MILESTONES": 0.75,
            "INSURANCE_COVENANT": 0.70,
            "CONTRACT_LIFECYCLE": 0.70,
            "STATUTORY_PERMITS": 0.70,
            "DISPUTE_RESOLUTION": 0.70,
            "SAFETY_OPERATIONS": 0.70,
            "ESCROW_WATERFALL": 0.70,
        }
        score = max((base_weights.get(r, 0.60) for r in matched_rules), default=0.50)

        # Multi-rule signal reinforcement
        if len(matched_rules) > 1:
            score += min(0.10, (len(matched_rules) - 1) * 0.05)

        # Boost if parent section title is a known requirement header
        if self.REQUIREMENT_SECTION_PATTERN.search(sec_title):
            score += 0.10

        # Boost for concrete figures, currency, or durations
        if re.search(
            r"(?:Rs\.?|INR|₹|\bcrore|\blakh|\b%|\bdays?\b|\byears?\b)", text, re.IGNORECASE
        ):
            score += 0.05

        if is_table:
            score += 0.05

        return min(1.0, round(score, 2))

    def detect_candidates_with_unselected(
        self,
        doc: DoclingParsedDocument,
        tree: DocumentStructureTree,
    ) -> tuple[list[CandidatePassage], list[CandidatePassage]]:
        """Detects candidate passages while preserving unselected text for the Tier-2 Rescue Pass."""
        candidates: list[CandidatePassage] = []
        unselected: list[CandidatePassage] = []

        # 1. Build section lookup map: block_id -> (number, title, section_path)
        block_to_node: dict[str, tuple[str, str, str]] = {}
        node_lookup = {n.node_id: n for n in tree.nodes}

        for node in tree.nodes:
            path_parts = [node.number]
            curr = node
            while curr.parent_id and curr.parent_id in node_lookup:
                curr = node_lookup[curr.parent_id]
                path_parts.insert(0, curr.number)
            path_parts.insert(0, "Document")
            section_path = " > ".join(path_parts)

            for b_id in node.block_ids:
                block_to_node[b_id] = (node.number, node.title or node.number, section_path)

        boilerplate = self._find_repeating_boilerplate(doc)

        cand_counter = 1
        unselected_counter = 1

        # 2. Process physical blocks with context fusion
        for block in doc.blocks:
            text = block.text.strip()
            norm_text = " ".join(text.lower().split())

            # Skip confirmed cross-page repetitive boilerplate
            if norm_text in boilerplate:
                continue

            # Skip standalone page numbers or pure punctuation/symbols
            if (text.isdigit() and len(text) <= 4) or not re.search(r"[a-zA-Z0-9]", text):
                continue

            sec_num, sec_title, sec_path = block_to_node.get(
                block.block_id,
                ("Unassigned", "Document", "Document"),
            )

            # Context fusion: evaluate rules against the block text and combined section context
            combined_context = f"{sec_title} - {text}" if sec_title != "Document" else text

            matched_rules: list[str] = []
            for pattern, rule_name in self.RULES:
                if pattern.search(text) or pattern.search(combined_context):
                    matched_rules.append(rule_name)

            # Check if parent section title is an eligibility / requirement section
            is_req_section = bool(self.REQUIREMENT_SECTION_PATTERN.search(sec_title))
            is_short = len(text) < 15

            if is_req_section and not matched_rules:
                if not is_short:
                    # Capture un-keyworded clauses inside requirement sections as candidates (for normal paragraphs)
                    matched_rules.append("SECTION_CONTEXT_REQUIREMENT")
                elif re.search(r"(?:Rs\.?|INR|₹|\d)", text):
                    # Short text with numbers or currency in requirement section
                    matched_rules.append("SHORT_METRIC_REQUIREMENT")

            priority_score = self._calculate_priority_score(
                matched_rules=matched_rules,
                text=text,
                sec_title=sec_title,
                is_table=False,
            )

            if is_short and not matched_rules:
                # Trivial short fragment without signals -> assign to unselected for Rescue Pass
                unselected.append(
                    CandidatePassage(
                        candidate_id=f"unsel_{unselected_counter}",
                        section_number=sec_num,
                        section_path=sec_path,
                        text=text,
                        page_number=block.page_number,
                        block_id=block.block_id,
                        matched_rules=[],
                        priority_score=0.20,
                        is_table_cell=False,
                        extraction_tier="RESCUE",
                        context_path=sec_path,
                    )
                )
                unselected_counter += 1
                continue

            if matched_rules:
                candidates.append(
                    CandidatePassage(
                        candidate_id=f"cand_{cand_counter}",
                        section_number=sec_num,
                        section_path=sec_path,
                        text=text,
                        page_number=block.page_number,
                        block_id=block.block_id,
                        matched_rules=matched_rules,
                        priority_score=priority_score,
                        is_table_cell=False,
                        extraction_tier="PRIMARY",
                        context_path=sec_path,
                    )
                )
                cand_counter += 1
            else:
                unselected.append(
                    CandidatePassage(
                        candidate_id=f"unsel_{unselected_counter}",
                        section_number=sec_num,
                        section_path=sec_path,
                        text=text,
                        page_number=block.page_number,
                        block_id=block.block_id,
                        matched_rules=[],
                        priority_score=priority_score,
                        is_table_cell=False,
                        extraction_tier="RESCUE",
                        context_path=sec_path,
                    )
                )
                unselected_counter += 1

        # 3. Process structured table rows
        for tbl in doc.tables:
            if not tbl.rows:
                continue
            headers = (
                tbl.headers if tbl.headers else [f"Col {i + 1}" for i in range(len(tbl.rows[0]))]
            )

            for row_idx, row in enumerate(tbl.rows):
                # Construct tabular row context
                cells_desc = [f"{h}: {val}" for h, val in zip(headers, row) if val and val.strip()]
                if not cells_desc:
                    continue
                row_text = f"Table {tbl.table_id}: " + " | ".join(cells_desc)

                row_rules: list[str] = []
                for pattern, rule_name in self.RULES:
                    if pattern.search(row_text):
                        row_rules.append(rule_name)

                # If table row contains numbers, currency, or percentages, mark as candidate
                has_metrics = bool(
                    re.search(
                        r"(?:Rs\.?|INR|₹|\d+%|\d+\s*(?:days?|months?|years?))",
                        row_text,
                        re.IGNORECASE,
                    )
                )
                if has_metrics and not row_rules:
                    row_rules.append("TABLE_METRIC_ROW")

                p_score = self._calculate_priority_score(
                    matched_rules=row_rules,
                    text=row_text,
                    sec_title="Table Schedule",
                    is_table=True,
                )

                if row_rules:
                    candidates.append(
                        CandidatePassage(
                            candidate_id=f"cand_tbl_{tbl.table_id}_{row_idx + 1}",
                            section_number=f"Table {tbl.table_id}",
                            section_path=f"Document > Table {tbl.table_id}",
                            text=row_text,
                            page_number=tbl.page_number,
                            block_id=f"{tbl.table_id}_r{row_idx + 1}",
                            matched_rules=row_rules,
                            priority_score=p_score,
                            is_table_cell=True,
                            extraction_tier="PRIMARY",
                            context_path=f"Table {tbl.table_id}",
                        )
                    )
                    cand_counter += 1
                else:
                    unselected.append(
                        CandidatePassage(
                            candidate_id=f"unsel_tbl_{tbl.table_id}_{row_idx + 1}",
                            section_number=f"Table {tbl.table_id}",
                            section_path=f"Document > Table {tbl.table_id}",
                            text=row_text,
                            page_number=tbl.page_number,
                            block_id=f"{tbl.table_id}_r{row_idx + 1}",
                            matched_rules=[],
                            priority_score=p_score,
                            is_table_cell=True,
                            extraction_tier="RESCUE",
                            context_path=f"Table {tbl.table_id}",
                        )
                    )
                    unselected_counter += 1

        return candidates, unselected

    def detect_candidates(
        self,
        doc: DoclingParsedDocument,
        tree: DocumentStructureTree,
    ) -> list[CandidatePassage]:
        """Backwards-compatible API returning primary candidate passages."""
        candidates, _ = self.detect_candidates_with_unselected(doc, tree)
        return candidates
