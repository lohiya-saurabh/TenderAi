from tenderpulse_ai.domain.candidate_detector import CandidateDetector
from tenderpulse_ai.domain.models import (
    DoclingBlock,
    DoclingParsedDocument,
    DoclingTable,
    DocumentStructureTree,
    SectionNode,
)


def _build_test_document(
    blocks_data: list[tuple[str, int, str]],
) -> tuple[DoclingParsedDocument, DocumentStructureTree]:
    """Helper to construct a DoclingParsedDocument and DocumentStructureTree.
    blocks_data: [(block_id, page_no, text), ...]
    """
    blocks = [
        DoclingBlock(block_id=b_id, page_number=page_no, text=text)
        for b_id, page_no, text in blocks_data
    ]
    doc = DoclingParsedDocument(
        document_id="doc_test_recall_001",
        file_name="tender_nit.pdf",
        pages=[{"page_number": p} for p in {b.page_number for b in blocks}],
        blocks=blocks,
        tables=[],
    )

    # Simple tree assigning all blocks to a root section
    root_node = SectionNode(
        node_id="sec_1",
        number="SECTION 2",
        title="SECTION 2: ELIGIBILITY & QUALIFICATION CRITERIA",
        level=1,
        parent_id=None,
        block_ids=[b.block_id for b in blocks],
    )
    tree = DocumentStructureTree(document_id=doc.document_id, nodes=[root_node])
    return doc, tree


class TestCandidateDetectorRecall:
    """Verifies that CandidateDetector prioritizes recall over precision and eliminates silent blind spots."""

    def test_short_requirements_are_not_discarded(self):
        """P0: Short requirements (<15 chars) such as 'Submit EMD' or 'Must sign' must be detected."""
        blocks_data = [
            ("b1", 1, "Submit EMD."),  # 11 chars
            ("b2", 1, "Must sign."),  # 10 chars
            ("b3", 1, "₹5,00,000"),  # 9 chars
            ("b4", 1, "Random text."),  # 12 chars without signals
        ]
        doc, tree = _build_test_document(blocks_data)
        detector = CandidateDetector()
        candidates, unselected = detector.detect_candidates_with_unselected(doc, tree)

        candidate_texts = [c.text for c in candidates]
        assert "Submit EMD." in candidate_texts, "Short 'Submit EMD.' was silently discarded!"
        assert "Must sign." in candidate_texts, "Short 'Must sign.' was silently discarded!"
        assert "₹5,00,000" in candidate_texts, (
            "Short numerical currency '₹5,00,000' in requirement section was silently discarded!"
        )

        # Random text without candidate signals is retained in unselected for the Rescue Pass
        unselected_texts = [u.text for u in unselected]
        assert "Random text." in unselected_texts

    def test_negative_eligibility_and_debarment_without_shall_or_must(self):
        """P0: Debarment clauses like 'Bids submitted by firms appearing on the debarred list will be rejected'

        must be detected as candidates even without 'shall' or 'must'.
        """
        blocks_data = [
            (
                "b1",
                2,
                "Bids submitted by firms appearing on the debarred list will be rejected.",
            ),
            (
                "b2",
                2,
                "Any entity with a conflict of interest under Clause 2.1 is ineligible.",
            ),
            (
                "b3",
                2,
                "Joint ventures with lead member holding under 51% will be disqualified.",
            ),
        ]
        doc, tree = _build_test_document(blocks_data)
        detector = CandidateDetector()
        candidates = detector.detect_candidates(doc, tree)

        candidate_texts = [c.text for c in candidates]
        assert (
            "Bids submitted by firms appearing on the debarred list will be rejected."
            in candidate_texts
        )
        assert (
            "Any entity with a conflict of interest under Clause 2.1 is ineligible."
            in candidate_texts
        )
        assert (
            "Joint ventures with lead member holding under 51% will be disqualified."
            in candidate_texts
        )

        debarred_cand = next(c for c in candidates if "debarred list" in c.text)
        assert "ELIGIBILITY_RESTRICTION" in debarred_cand.matched_rules
        assert debarred_cand.priority_score >= 0.85

    def test_table_rows_and_cells_are_preserved_with_column_context(self):
        """P0: Preserves tabular structure, table cells, and column context as candidates."""
        blocks_data = [
            ("b1", 1, "The contractor shall adhere to the following maintenance criteria:")
        ]
        doc, tree = _build_test_document(blocks_data)

        # Attach structured table
        table = DoclingTable(
            table_id="tbl_sched_k",
            page_number=1,
            headers=["Defect Type", "Rectification SLA", "Daily Penalty"],
            rows=[
                ["Potholes", "Within 24 hours", "0.5% of daily toll fee"],
                ["Cracking", "Within 15 days", "₹50,000 per day"],
            ],
            caption="Schedule-K Highway Maintenance SLAs",
        )
        doc.tables.append(table)

        detector = CandidateDetector()
        candidates = detector.detect_candidates(doc, tree)

        table_candidates = [c for c in candidates if c.is_table_cell]
        assert len(table_candidates) == 2
        assert "Potholes" in table_candidates[0].text
        assert "Within 24 hours" in table_candidates[0].text
        assert table_candidates[0].priority_score >= 0.70

    def test_true_boilerplate_repetition_filtering(self):
        """P0: True cross-page repetitive running headers/footers are filtered, but unique clauses on those pages are retained."""
        running_header = "REQUEST FOR PROPOSAL - BOT (TOLL) - NHAI/2026/01"
        running_footer = "Page Confidential | Strictly for Bidder Reference"

        blocks_data = [
            # Page 1
            ("p1_h", 1, running_header),
            ("p1_b", 1, "The bidder shall submit an EMD of INR 10,00,000."),
            ("p1_f", 1, running_footer),
            # Page 2
            ("p2_h", 2, running_header),
            ("p2_b", 2, "Liquidated damages of 0.1% per day shall apply for milestone delay."),
            ("p2_f", 2, running_footer),
            # Page 3
            ("p3_h", 3, running_header),
            ("p3_b", 3, "Contractor must maintain All-Risk Project Insurance."),
            ("p3_f", 3, running_footer),
        ]
        doc, tree = _build_test_document(blocks_data)
        detector = CandidateDetector()
        candidates = detector.detect_candidates(doc, tree)

        candidate_texts = [c.text for c in candidates]
        # Running header and footer appear across 3 pages -> must be filtered
        assert running_header not in candidate_texts
        assert running_footer not in candidate_texts

        # Operative clauses on each page must be retained
        assert "The bidder shall submit an EMD of INR 10,00,000." in candidate_texts
        assert (
            "Liquidated damages of 0.1% per day shall apply for milestone delay." in candidate_texts
        )
        assert "Contractor must maintain All-Risk Project Insurance." in candidate_texts

    def test_candidate_recall_benchmark_exceeds_98_percent(self):
        """P1: Benchmark measuring Candidate Recall across representative Indian tender clauses."""
        ground_truth_clauses = [
            "The bidder must submit an Earnest Money Deposit (EMD) of INR 5,00,000 on Rs 100 stamp paper.",
            "Bids submitted by firms appearing on the debarred list will be rejected.",
            "Minimum average annual construction turnover of Rs. 40.09 crore during last 5 financial years.",
            "Must sign Integrity Pact on non-judicial stamp paper.",
            "Liquidated damages for delay shall be 0.1% per day subject to a maximum of 10% of Contract Price.",
            "Any entity with a conflict of interest under Clause 2.1.14 is ineligible.",
            "Key technical personnel including Project Manager with 15 years experience mandatory.",
            "Submit EMD.",
            "All-risk project insurance coverage must name the Authority as co-insured.",
            "Rectification of potholes within 24 hours under Schedule-K level of service.",
        ]

        blocks_data = [(f"b_{i + 1}", 1, clause) for i, clause in enumerate(ground_truth_clauses)]
        doc, tree = _build_test_document(blocks_data)
        detector = CandidateDetector()
        candidates = detector.detect_candidates(doc, tree)

        candidate_texts = {c.text for c in candidates}
        detected_count = sum(1 for clause in ground_truth_clauses if clause in candidate_texts)
        candidate_recall = detected_count / len(ground_truth_clauses)

        assert candidate_recall >= 0.98, (
            f"Candidate Recall was {candidate_recall:.2%}, expected >= 98.00%!"
        )
        assert detected_count == len(ground_truth_clauses)
