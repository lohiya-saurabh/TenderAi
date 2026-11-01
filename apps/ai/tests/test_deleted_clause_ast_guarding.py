from __future__ import annotations

import pytest
from fakes import fake_llm_client

from tenderpulse_ai.domain.candidate_detector import CandidateDetector
from tenderpulse_ai.domain.docling_parser import DoclingParserEngine, is_clause_deleted
from tenderpulse_ai.domain.models import (
    CandidateComplianceItem,
    DoclingBlock,
    DoclingParsedDocument,
    DocumentStructureTree,
    ExecutionRulesProps,
    ProvenanceProps,
    SectionNode,
)
from tenderpulse_ai.domain.structure_builder import DocumentStructureBuilder
from tenderpulse_ai.domain.tender_chunker import TenderChunker
from tenderpulse_ai.security.context import SecurityContext
from tenderpulse_ai.tools.page_text import PageTextTool
from tenderpulse_ai.tools.retrieval import ScopedRetrievalTool
from tenderpulse_ai.workflow.nodes import WorkflowNodeContext, make_validation_node


def test_is_clause_deleted_patterns():
    # 1. Standard deletion markers
    assert is_clause_deleted("Clause 46.1 Advance Payment - DELETED") is True
    assert is_clause_deleted("Clause 46.1 Advance Payment - DELETED.") is True
    assert is_clause_deleted("Clause 46 Mobilization Advance stands deleted") is True
    assert is_clause_deleted("Clause 46 Mobilization Advance stands deleted.") is True
    assert is_clause_deleted("Clause 46 has been deleted") is True
    assert is_clause_deleted("Sub-Clause 14.3 is deleted in its entirety.") is True
    assert is_clause_deleted("Clause 21.1 Insurance for Works - OMITTED") is True
    assert is_clause_deleted("Clause 21 stands omitted") is True
    assert is_clause_deleted("Clause 46.1 - DELETED") is True

    # 2. Active, non-deleted clauses
    assert (
        is_clause_deleted(
            "Clause 46.1 Advance Payment: The Authority shall pay an advance payment of 10%"
        )
        is False
    )
    assert (
        is_clause_deleted(
            "Clause 33.1 Performance Security (PBG) of 3% shall be submitted within 28 days."
        )
        is False
    )
    assert is_clause_deleted("Clause 14.1 Earnest Money Deposit of Rs. 7.18 Crores.") is False
    assert is_clause_deleted("") is False
    assert is_clause_deleted(None) is False


def test_docling_parser_marks_deleted_blocks():
    parser = DoclingParserEngine()
    text = (
        "PART I: INSTRUCTIONS TO BIDDERS\n\n"
        "Clause 33.1 Performance Security\n"
        "The contractor shall provide Performance Security of 3% of the contract price.\n\n"
        "Clause 46.1 Mobilization Advance - DELETED\n"
        "This clause has been deleted.\n\n"
        "Clause 14.1 Earnest Money Deposit\n"
        "The bidder shall furnish EMD of Rs. 7.18 Crores."
    )

    doc = parser.parse_document(
        document_id="doc_deleted_test",
        file_name="tender.pdf",
        pages=[{"page_number": 1, "text": text}],
    )
    assert len(doc.blocks) > 0

    pbg_blocks = [b for b in doc.blocks if "Performance Security" in b.text]
    assert len(pbg_blocks) >= 1
    assert all(b.is_deleted is False for b in pbg_blocks)

    del_blocks = [b for b in doc.blocks if "DELETED" in b.text or "has been deleted" in b.text]
    assert len(del_blocks) >= 1
    assert all(b.is_deleted is True for b in del_blocks)


def test_candidate_detector_suppresses_deleted_clauses():
    detector = CandidateDetector()

    doc = DoclingParsedDocument(
        document_id="doc_cand_test",
        file_name="tender.pdf",
        pages=[{"page_number": 1, "char_count": 500}],
        blocks=[
            DoclingBlock(
                block_id="blk_active_pbg",
                type="paragraph",
                text="Clause 33.1: The contractor shall submit Performance Security (PBG) of 3% within 28 days of LOA.",
                page_number=1,
                is_deleted=False,
            ),
            DoclingBlock(
                block_id="blk_del_adv1",
                type="paragraph",
                text="Clause 46.1 Mobilization Advance of 10% - DELETED",
                page_number=1,
                is_deleted=True,
            ),
            DoclingBlock(
                block_id="blk_del_adv2",
                type="paragraph",
                text="Clause 46.2 Secured Advance on Materials stands deleted in its entirety.",
                page_number=1,
                is_deleted=False,  # text pattern triggers is_clause_deleted
            ),
        ],
        tables=[],
    )

    tree = DocumentStructureTree(
        document_id="doc_cand_test",
        nodes=[
            SectionNode(
                node_id="sec_active",
                number="33.1",
                title="Clause 33.1 Performance Security",
                level=3,
                block_ids=["blk_active_pbg"],
            ),
            SectionNode(
                node_id="sec_del",
                number="46.1",
                title="Clause 46.1 Mobilization Advance - DELETED",
                level=3,
                block_ids=["blk_del_adv1", "blk_del_adv2"],
            ),
        ],
    )

    candidates = detector.detect_candidates(doc, tree)

    # 1. Active clause produces candidates
    assert any("Performance Security" in c.text or "33.1" in c.section_number for c in candidates)

    # 2. Deleted clauses are completely suppressed
    assert not any("46.1" in c.section_number for c in candidates)
    assert not any("Mobilization Advance" in c.text for c in candidates)
    assert not any("Secured Advance" in c.text for c in candidates)


def test_tender_chunker_suppresses_deleted_clauses():
    chunker = TenderChunker()

    doc = DoclingParsedDocument(
        document_id="doc_chunk_del_test",
        file_name="tender.pdf",
        pages=[{"page_number": 1, "char_count": 500}],
        blocks=[
            DoclingBlock(
                block_id="blk_1",
                type="heading",
                text="Clause 14.1 Earnest Money Deposit",
                page_number=1,
                is_deleted=False,
            ),
            DoclingBlock(
                block_id="blk_2",
                type="paragraph",
                text="The bidder shall submit EMD of Rs. 7.18 Crores via Bank Guarantee.",
                page_number=1,
                is_deleted=False,
            ),
            DoclingBlock(
                block_id="blk_3",
                type="heading",
                text="Clause 46 Advance Payment - DELETED",
                page_number=1,
                is_deleted=True,
            ),
            DoclingBlock(
                block_id="blk_4",
                type="paragraph",
                text="Mobilization advance stands deleted.",
                page_number=1,
                is_deleted=True,
            ),
        ],
        tables=[],
    )

    tree = DocumentStructureTree(
        document_id="doc_chunk_del_test",
        nodes=[
            SectionNode(
                node_id="sec_1",
                number="14.1",
                title="Clause 14.1 Earnest Money Deposit",
                level=3,
                block_ids=["blk_1", "blk_2"],
            ),
            SectionNode(
                node_id="sec_2",
                number="46",
                title="Clause 46 Advance Payment - DELETED",
                level=3,
                block_ids=["blk_3", "blk_4"],
            ),
        ],
    )

    chunks = chunker.chunk_document(doc, tree)

    # Chunks must contain EMD
    assert any("7.18 Crores" in c.content for c in chunks)
    # Chunks must NOT contain any deleted clause content
    assert not any("Mobilization advance" in c.content for c in chunks)
    assert not any("Clause 46 Advance Payment" in c.content for c in chunks)


@pytest.mark.asyncio
async def test_workflow_validation_node_rejects_deleted_clauses():
    sec_ctx = SecurityContext(
        tenant_id="tenant_nhai",
        user_id="user_test",
        allowed_document_ids=["doc_val_del"],
        workflow_run_id="run_val_01",
    )

    node_ctx = WorkflowNodeContext(
        retrieval_tool=ScopedRetrievalTool(),
        page_text_tool=PageTextTool(),
        llm_client=fake_llm_client(lambda s, u: []),
    )
    val_node = make_validation_node(node_ctx)

    active_candidate = CandidateComplianceItem(
        category="FINANCIAL",
        title="Performance Security (PBG)",
        description="Submission of 3% PBG within 28 days.",
        execution_rules=ExecutionRulesProps(),
        provenance=ProvenanceProps(
            source_document_id="doc_val_del",
            source_file_name="tender.pdf",
            page_number=1,
            clause_reference="Clause 33.1",
            verbatim_quote="The contractor shall submit PBG equal to 3% within 28 days.",
            confidence_score=0.98,
        ),
    )

    deleted_candidate = CandidateComplianceItem(
        category="FINANCIAL",
        title="Mobilization Advance",
        description="Advance payment of 10%.",
        execution_rules=ExecutionRulesProps(),
        provenance=ProvenanceProps(
            source_document_id="doc_val_del",
            source_file_name="tender.pdf",
            page_number=1,
            clause_reference="Clause 46.1 (DELETED)",
            verbatim_quote="Clause 46.1 Advance Payment - DELETED",
            confidence_score=0.95,
        ),
    )

    state = {
        "security_context": sec_ctx.model_dump(),
        "bid_id": "bid_val_1",
        "document_id": "doc_val_del",
        "page_number": 1,
        "raw_page_text": (
            "Clause 33.1. The contractor shall submit PBG equal to 3% within 28 days.\n"
            "Clause 46.1 Advance Payment - DELETED"
        ),
        "extracted_candidates": [active_candidate, deleted_candidate],
        "document_structure": DocumentStructureTree(
            document_id="doc_val_del",
            nodes=[
                SectionNode(
                    node_id="sec_active",
                    number="33.1",
                    title="Clause 33.1 Performance Security",
                    level=3,
                ),
                SectionNode(
                    node_id="sec_del",
                    number="46.1",
                    title="Clause 46.1 Advance Payment - DELETED",
                    level=3,
                ),
            ],
        ).model_dump(),
    }

    result = await val_node(state)

    verified = result.get("verified_items", [])
    unverified = result.get("unverified_items", [])
    error_feedback = result.get("error_feedback") or ""

    # Active candidate must be verified
    assert len(verified) == 1
    assert verified[0].title == "Performance Security (PBG)"

    # Deleted candidate must be rejected into unverified
    assert len(unverified) == 1
    assert unverified[0].title == "Mobilization Advance"
    assert "originates from deleted/omitted clause" in error_feedback


def test_structure_builder_rejects_road_chainages_and_preserves_valid_headings():
    # 1. Invalid clause candidate classifier checks

    # Standalone 3-decimal place meter chainages (^\d{1,4}\.\d{3}\b)
    assert DocumentStructureBuilder._is_invalid_clause_candidate("12.000") is True
    assert DocumentStructureBuilder._is_invalid_clause_candidate("48.000") is True
    assert DocumentStructureBuilder._is_invalid_clause_candidate("348.000") is True
    assert (
        DocumentStructureBuilder._is_invalid_clause_candidate("12.000. Highway Widening Work")
        is True
    )

    # Chainage ranges at start
    assert (
        DocumentStructureBuilder._is_invalid_clause_candidate(
            "348.000 to 398.000 Construction Corridor"
        )
        is True
    )
    assert (
        DocumentStructureBuilder._is_invalid_clause_candidate("Km. 87.000 to Km. 120.000") is True
    )
    assert DocumentStructureBuilder._is_invalid_clause_candidate("Ch. 12.000 to 15.000") is True
    assert DocumentStructureBuilder._is_invalid_clause_candidate("Km. 87.000") is True

    # Calendar dates & physical measurements
    assert DocumentStructureBuilder._is_invalid_clause_candidate("22.01.2026 Bid Due Date") is True
    assert (
        DocumentStructureBuilder._is_invalid_clause_candidate(
            "19.02.2026 Opening of Technical Bids"
        )
        is True
    )
    assert DocumentStructureBuilder._is_invalid_clause_candidate("0.5 percent per day") is True
    assert DocumentStructureBuilder._is_invalid_clause_candidate("50 km highway corridor") is True

    # Valid legal headings that MUST be preserved
    assert (
        DocumentStructureBuilder._is_invalid_clause_candidate(
            "Clause 1.2 Scope of Works from Km. 87.000 to Km. 120.000"
        )
        is False
    )
    assert (
        DocumentStructureBuilder._is_invalid_clause_candidate(
            "Clause 33.1 Performance Security Requirement"
        )
        is False
    )
    assert (
        DocumentStructureBuilder._is_invalid_clause_candidate("14.1 Earnest Money Deposit") is False
    )
    assert (
        DocumentStructureBuilder._is_invalid_clause_candidate(
            "Section 2.1 Technical Evaluation Criteria"
        )
        is False
    )


def test_structure_builder_ast_generation_filtering():
    builder = DocumentStructureBuilder()

    doc = DoclingParsedDocument(
        document_id="doc_ast_nhai",
        file_name="nhai_tender.pdf",
        pages=[{"page_number": 1, "char_count": 800}],
        blocks=[
            DoclingBlock(
                block_id="b1",
                type="heading",
                text="PART I BIDDING PROCEDURES",
                page_number=1,
            ),
            DoclingBlock(
                block_id="b2",
                type="heading",
                text="SECTION 2 INSTRUCTIONS TO BIDDERS",
                page_number=1,
            ),
            DoclingBlock(
                block_id="b3",
                type="heading",
                text="Clause 1.2 Scope of Works from Km. 87.000 to Km. 120.000",
                page_number=1,
            ),
            DoclingBlock(
                block_id="b4",
                type="paragraph",
                text="12.000 to 45.000 Construction of minor bridges and culverts.",
                page_number=1,
            ),
            DoclingBlock(
                block_id="b5",
                type="paragraph",
                text="348.000 Highway Alignment Chainage Data",
                page_number=1,
            ),
            DoclingBlock(
                block_id="b6",
                type="paragraph",
                text="22.01.2026 Bid Due Date and Online Submission Deadline",
                page_number=1,
            ),
            DoclingBlock(
                block_id="b7",
                type="heading",
                text="Clause 14.1 Earnest Money Deposit of Rs 7.18 Crores",
                page_number=1,
            ),
        ],
        tables=[],
    )

    tree = builder.build_structure(doc)
    node_numbers = [n.number for n in tree.nodes]
    node_titles = [n.title for n in tree.nodes]

    # Valid nodes are preserved in tree
    assert "PART I" in node_numbers
    assert "SECTION 2" in node_numbers
    assert "1.2" in node_numbers
    assert "14.1" in node_numbers

    # Verify Clause 1.2 Scope of Works is in AST
    assert any("Clause 1.2 Scope of Works" in t for t in node_titles)
    clause_1_2 = next(n for n in tree.nodes if n.number == "1.2")
    assert clause_1_2.level == 3
    assert "Km. 87.000 to Km. 120.000" in clause_1_2.title

    # Verify road chainages and dates are NOT converted into AST nodes
    assert not any("12.000" in n.number for n in tree.nodes)
    assert not any("348.000" in n.number for n in tree.nodes)
    assert not any("22.01.2026" in n.number for n in tree.nodes)
    assert len(tree.nodes) == 4
