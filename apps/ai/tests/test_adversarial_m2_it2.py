from __future__ import annotations

import pytest

from tenderpulse_ai.domain.candidate_detector import CandidateDetector
from tenderpulse_ai.domain.docling_parser import DoclingParserEngine, is_clause_deleted
from tenderpulse_ai.domain.models import (
    CandidateComplianceItem,
    DoclingBlock,
    DoclingParsedDocument,
    DoclingTable,
    DocumentStructureTree,
    ExecutionRulesProps,
    ProvenanceProps,
    SectionNode,
)
from tenderpulse_ai.domain.structure_builder import DocumentStructureBuilder
from tenderpulse_ai.domain.tender_chunker import TenderChunker
from tenderpulse_ai.extraction.rules import default_tender_extractor
from tenderpulse_ai.extraction.rules.base import get_clause_and_quote
from tenderpulse_ai.models.llm_client import StructuredLLMClient
from tenderpulse_ai.security.context import SecurityContext
from tenderpulse_ai.security.exceptions import (
    ToolRateLimitExceededException,
    UnauthorizedDocumentAccessException,
)
from tenderpulse_ai.tools.page_text import PageTextTool
from tenderpulse_ai.tools.retrieval import DocumentChunk, ScopedRetrievalTool
from tenderpulse_ai.workflow.nodes import WorkflowNodeContext, make_validation_node

# ==============================================================================
# CHALLENGE 1: Deleted Clause Suppression Across All Varied Markers & Pipeline
# ==============================================================================

MANDATORY_DELETION_PHRASES = [
    "- Deleted",
    "- DELETED.",
    "[Omitted]",
    "(Omitted)",
    "- Omitted.",
    "Deleted",
]

EXTENDED_DELETION_PHRASES = [
    "- Deleted",
    "- DELETED.",
    "[Omitted]",
    "(Omitted)",
    "- Omitted.",
    "Deleted",
    "[Deleted]",
    "(Deleted)",
    "— Deleted",  # Em-dash
    "– Deleted",  # En-dash
    "- OMITTED.",
    "stands deleted",
    "is omitted",
]


@pytest.mark.parametrize("phrase", EXTENDED_DELETION_PHRASES)
def test_adversarial_deleted_clause_patterns(phrase: str):
    """Adversarial stress-test for varied deletion phrases in is_clause_deleted."""
    heading = f"Clause 46.1 Mobilization Advance {phrase}"
    assert is_clause_deleted(heading) is True, f"Failed to detect deletion phrase: {phrase}"


def test_adversarial_deleted_clause_suppression_full_pipeline():
    """Adversarial test: Construct document with all 6 required deletion phrases

    and verify NO candidate obligations or quotes are extracted through parser,
    candidate detector, or chunker.
    """
    adversarial_doc_text = """
PART I: INSTRUCTIONS TO BIDDERS

SECTION 2: BID DATA SHEET

Clause 33.1 Performance Security Requirement
The contractor shall submit Performance Security (PBG) of 3% of the contract price within 28 days of LOA.

Clause 46.1 Mobilization Advance - Deleted
The Employer shall pay mobilization advance of 10% against Bank Guarantee of equivalent amount.

Clause 46.2 Secured Advance on Materials - DELETED.
Advance on materials shall be paid at 75% of invoice value for permanent works.

Clause 46.3 Plant and Machinery Advance [Omitted]
An advance of 50% for plant and equipment shall be provided by the Authority.

Clause 46.4 Special Mobilization Advance (Omitted)
The contractor may request special mobilization advance of Rs. 5.00 Crores.

Clause 46.5 Financial Assistance - Omitted.
Financial assistance of Rs. 2.00 Crores shall be available upon formal request.

Clause 46.6 Interest on Advance Deleted
Interest at the rate of 10% per annum shall be charged on all advances.

Clause 14.1 Earnest Money Deposit
The bidder shall furnish Earnest Money Deposit (EMD) of Rs. 7.18 Crores via Bank Guarantee.
"""
    parser = DoclingParserEngine()
    doc = parser.parse_document(
        document_id="doc_adv_del",
        file_name="tender_adv_del.pdf",
        pages=[{"page_number": 1, "text": adversarial_doc_text}],
    )

    # 1. Verify parser correctly marked deleted clause blocks
    deleted_blocks = [b for b in doc.blocks if b.is_deleted]
    assert len(deleted_blocks) >= 6, (
        f"Expected at least 6 deleted blocks, found {len(deleted_blocks)}"
    )

    active_blocks = [
        b
        for b in doc.blocks
        if "Performance Security" in b.text or "Earnest Money Deposit" in b.text
    ]
    assert all(b.is_deleted is False for b in active_blocks)

    # 2. Build structure tree
    builder = DocumentStructureBuilder()
    tree = builder.build_structure(doc)

    # 3. Detect candidates through CandidateDetector
    detector = CandidateDetector()
    candidates = detector.detect_candidates(doc, tree)

    # Active clauses MUST produce candidates
    assert any("33.1" in c.section_number or "Performance Security" in c.text for c in candidates)
    assert any("14.1" in c.section_number or "Earnest Money" in c.text for c in candidates)

    # ZERO candidates or quotes can originate from deleted clauses
    forbidden_terms = [
        "46.1",
        "46.2",
        "46.3",
        "46.4",
        "46.5",
        "46.6",
        "Mobilization Advance",
        "Secured Advance",
        "Plant and Machinery Advance",
        "Special Mobilization Advance",
        "Financial Assistance",
        "Interest on Advance",
    ]
    for c in candidates:
        for term in forbidden_terms:
            assert term not in c.section_number, (
                f"Leaked deleted section number '{term}' in candidate: {c}"
            )
            assert term not in c.text, f"Leaked deleted text '{term}' in candidate text: {c.text}"

    # 4. Chunk document through TenderChunker
    chunker = TenderChunker()
    chunks = chunker.chunk_document(doc, tree)

    # Content chunks (Tier 2 Parents and Tier 3 Children)
    content_chunks = [ch for ch in chunks if ch.tier != "TIER1_SKELETON"]

    # Chunks must retain active provisions
    assert any("Performance Security" in ch.content for ch in content_chunks)
    assert any("7.18 Crores" in ch.content for ch in content_chunks)

    # Content chunks must NOT contain any deleted clause content or references
    for ch in content_chunks:
        for term in forbidden_terms:
            assert term not in ch.content, (
                f"Leaked deleted term '{term}' in content chunk {ch.id}: {ch.content}"
            )

    # Check Tier 1 Skeleton chunks: verify whether deleted clause numbers leak into section skeletons
    skeleton_chunks = [ch for ch in chunks if ch.tier == "TIER1_SKELETON"]
    leaked_in_skeleton = [
        (sk.id, term)
        for sk in skeleton_chunks
        for term in ["46.1", "46.2", "46.3", "46.4", "46.5", "46.6"]
        if term in sk.content
    ]
    # We document whether skeleton chunks contain deleted clause references
    # (Finding: Section 2 skeleton lists contained clauses from AST without checking is_clause_deleted)
    assert len(leaked_in_skeleton) == 0, (
        f"Tier 1 Skeleton chunks leak deleted clause numbers: {leaked_in_skeleton}"
    )


@pytest.mark.parametrize("phrase", MANDATORY_DELETION_PHRASES)
def test_adversarial_rules_suppress_deleted_clauses(phrase: str):
    """Adversarial test: Verify extraction rules return None / empty candidates for varied deletion phrases.

    Tests multi-line text where clause heading ends with deletion phrase followed by body.
    """
    text = (
        f"Clause 46.1 Mobilization Advance {phrase}\n"
        f"The Authority shall pay 10% mobilization advance against bank guarantee."
    )

    # 1. get_clause_and_quote returns None
    res = get_clause_and_quote(
        r"mobilization advance",
        "mobilization advance",
        ["mobilization advance"],
        text,
        text.lower(),
        1,
        f"Clause 46.1 {phrase}",
    )
    assert res is None, (
        f"Rule get_clause_and_quote failed to suppress deleted clause with '{phrase}'"
    )

    # 2. default_tender_extractor returns empty list
    items = default_tender_extractor("", text)
    assert items == [], f"default_tender_extractor leaked items for deleted clause with '{phrase}'"


@pytest.mark.asyncio
@pytest.mark.parametrize("phrase", MANDATORY_DELETION_PHRASES)
async def test_adversarial_validation_node_rejects_deleted_candidates(phrase: str):
    """Adversarial test: Verify workflow validation node rejects candidate obligations

    originating from deleted clauses with varied phrases.
    """
    sec_ctx = SecurityContext(
        tenant_id="tenant_adv",
        user_id="user_adv",
        allowed_document_ids=["doc_adv"],
        workflow_run_id="run_adv_val",
    )
    node_ctx = WorkflowNodeContext(
        retrieval_tool=ScopedRetrievalTool(),
        page_text_tool=PageTextTool(),
        llm_client=StructuredLLMClient(enable_live_client=False),
    )
    val_node = make_validation_node(node_ctx)

    candidate = CandidateComplianceItem(
        category="FINANCIAL",
        title="Mobilization Advance Payment",
        description="Advance payment equal to 10% of contract value.",
        execution_rules=ExecutionRulesProps(),
        provenance=ProvenanceProps(
            source_document_id="doc_adv",
            source_file_name="tender_adv.pdf",
            page_number=1,
            clause_reference=f"Clause 46.1 {phrase}",
            verbatim_quote=f"Clause 46.1 Mobilization Advance {phrase}",
            confidence_score=0.95,
        ),
    )

    state = {
        "security_context": sec_ctx.model_dump(),
        "bid_id": "bid_adv_1",
        "document_id": "doc_adv",
        "page_number": 1,
        "raw_page_text": f"Clause 46.1 Mobilization Advance {phrase}",
        "extracted_candidates": [candidate],
        "document_structure": DocumentStructureTree(
            document_id="doc_adv",
            nodes=[
                SectionNode(
                    node_id="sec_del",
                    number="46.1",
                    title=f"Clause 46.1 Mobilization Advance {phrase}",
                    level=3,
                )
            ],
        ).model_dump(),
    }

    result = await val_node(state)
    verified = result.get("verified_items", [])
    unverified = result.get("unverified_items", [])
    feedback = result.get("error_feedback", "")

    assert len(verified) == 0, f"Candidate with phrase '{phrase}' was falsely verified!"
    assert len(unverified) == 1, (
        f"Candidate with phrase '{phrase}' was not routed to unverified items!"
    )
    assert "originates from deleted/omitted clause" in feedback, (
        f"Validation feedback missing deletion explanation: {feedback}"
    )


# ==============================================================================
# CHALLENGE 2: Guarded Legal AST (Hostile Chainages vs Valid Headings)
# ==============================================================================

HOSTILE_CHAINAGE_TEXTS = [
    "Km. 87.000",
    "12.000. Road Section",
    "348.000 - 350.000",
    "22.01.2026",
    "348.000 to 398.000 Construction Corridor",
    "Km. 87.000 to Km. 120.000",
    "Ch. 12.000 to 15.000 Alignment",
    "12.000 to 45.000 Construction of minor bridges and culverts",
    "48.000. Highway Widening Work",
    "348.000 Highway Alignment Chainage Data",
    "19.02.2026 Opening of Technical Bids",
    "0.5 percent per day delay liquidated damages",
    "50 km highway widening project",
    "100 meters buffer corridor",
    "Chainage 42.500",
    "Ch. 99.123",
]

VALID_LEGAL_HEADINGS = [
    ("Clause 1.2 Scope of Works from Km. 87.000 to Km. 120.000", 3, "1.2"),
    ("Clause 33.1 Performance Security Requirement", 3, "33.1"),
    ("Clause 14.1 Earnest Money Deposit of Rs 7.18 Crores", 3, "14.1"),
    ("Section 2.1 Technical Evaluation Criteria", 2, "SECTION 2"),
    ("Table 1.1 Technical Parameters and Chainage Distribution", 3, "1.1"),
    ("Sub-Clause 14.3 Mobilization Advance", 3, "14.3"),
    ("PART I BIDDING PROCEDURES", 1, "PART I"),
]


def test_adversarial_guarded_ast_classifier():
    """Adversarial unit test: Validate _is_invalid_clause_candidate classification."""
    # 1. All hostile texts MUST be classified as invalid clause candidates
    for hostile in HOSTILE_CHAINAGE_TEXTS:
        assert DocumentStructureBuilder._is_invalid_clause_candidate(hostile) is True, (
            f"Failed to flag hostile chainage/date as invalid candidate: {hostile}"
        )

    # 2. All valid legal headings MUST NOT be classified as invalid candidates
    for valid_heading, _, _ in VALID_LEGAL_HEADINGS:
        if not (valid_heading.startswith("PART") or valid_heading.startswith("Section")):
            assert DocumentStructureBuilder._is_invalid_clause_candidate(valid_heading) is False, (
                f"Falsely classified valid legal heading as invalid candidate: {valid_heading}"
            )


def test_adversarial_ast_structure_building():
    """Adversarial stress-test: Feed document mixing hostile chainages with valid headings

    and verify NONE of the hostile chainages create Level 3 AST section headings,
    while valid headings (including those with Km chainages in their titles) DO.
    """
    blocks = [
        DoclingBlock(
            block_id="b_part1",
            type="heading",
            text="PART I BIDDING PROCEDURES",
            page_number=1,
        ),
        DoclingBlock(
            block_id="b_sec2",
            type="heading",
            text="SECTION 2 INSTRUCTIONS TO BIDDERS",
            page_number=1,
        ),
        DoclingBlock(
            block_id="b_cl_1_2",
            type="heading",
            text="Clause 1.2 Scope of Works from Km. 87.000 to Km. 120.000",
            page_number=1,
        ),
    ]

    # Hostile chainage paragraphs that should NOT become headings
    for idx, hostile_text in enumerate(HOSTILE_CHAINAGE_TEXTS, start=1):
        blocks.append(
            DoclingBlock(
                block_id=f"b_hostile_{idx}",
                type="paragraph",
                text=hostile_text,
                page_number=1,
            )
        )

    # Another valid clause
    blocks.append(
        DoclingBlock(
            block_id="b_cl_33_1",
            type="heading",
            text="Clause 33.1 Performance Security Requirement",
            page_number=1,
        )
    )
    blocks.append(
        DoclingBlock(
            block_id="b_cl_33_1_body",
            type="paragraph",
            text="The contractor shall submit PBG of 3%.",
            page_number=1,
        )
    )

    doc = DoclingParsedDocument(
        document_id="doc_ast_hostile",
        file_name="tender_hostile.pdf",
        pages=[{"page_number": 1}],
        blocks=blocks,
        tables=[],
    )

    builder = DocumentStructureBuilder()
    tree = builder.build_structure(doc)

    node_numbers = [n.number for n in tree.nodes]
    level_3_nodes = [n for n in tree.nodes if n.level == 3]

    # 1. Valid headings ARE created
    assert "PART I" in node_numbers
    assert "SECTION 2" in node_numbers
    assert any(n.number == "1.2" for n in level_3_nodes)
    assert any(n.number == "33.1" for n in level_3_nodes)

    # Clause 1.2 must retain full title with Km chainages
    cl_1_2_node = next(n for n in level_3_nodes if n.number == "1.2")
    assert "Km. 87.000 to Km. 120.000" in cl_1_2_node.title

    # 2. Hostile chainages and dates MUST NOT create Level 3 AST section headings
    hostile_node_prefixes = [
        "12.000",
        "48.000",
        "348.000",
        "22.01.2026",
        "19.02.2026",
        "0.5",
        "50",
        "100",
        "Km. 87.000",
    ]
    for n in tree.nodes:
        for prefix in hostile_node_prefixes:
            assert n.number != prefix, (
                f"Hostile text '{prefix}' was converted into an AST section node!"
            )
            assert not (n.title.startswith(prefix) and n.level == 3), (
                f"Hostile text '{n.title}' was converted into a Level 3 AST section node!"
            )

    # Total AST nodes must be exactly 4 (PART I, SECTION 2, Clause 1.2, Clause 33.1)
    assert len(tree.nodes) == 4, (
        f"Expected exactly 4 AST nodes, found {len(tree.nodes)}: {[n.title for n in tree.nodes]}"
    )


# ==============================================================================
# CHALLENGE 3: 3-Tier Chunking & Small-to-Big Retrieval Tool Expansion
# ==============================================================================


def test_adversarial_3tier_chunking_complex_nested_document_and_tables():
    """Adversarial stress-test: Challenge TenderChunker with complex nested document

    containing multiple parts, sections, clauses across pages and complex tables.
    Verify parent/child linking integrity across all 3 tiers.
    """
    blocks = [
        # Page 1
        DoclingBlock(
            block_id="b1",
            type="heading",
            text="PART I: INSTRUCTIONS TO BIDDERS",
            page_number=1,
        ),
        DoclingBlock(
            block_id="b2",
            type="heading",
            text="SECTION 2: BID DATA SHEET",
            page_number=1,
        ),
        DoclingBlock(
            block_id="b3",
            type="heading",
            text="Clause 4.1 Bid Security and EMD Payment Particulars",
            page_number=1,
        ),
        DoclingBlock(
            block_id="b4",
            type="paragraph",
            text=(
                "The bidder shall furnish Earnest Money Deposit (EMD) as specified below. "
                "Payments must be remitted strictly into the dedicated NHAI bank account."
            ),
            page_number=1,
        ),
        # Page 2
        DoclingBlock(
            block_id="b5",
            type="heading",
            text="SECTION 3: EVALUATION METHODOLOGY",
            page_number=2,
        ),
        DoclingBlock(
            block_id="b6",
            type="heading",
            text="Clause 5.1 Minimum Financial Capacity and Net Worth",
            page_number=2,
        ),
        DoclingBlock(
            block_id="b7",
            type="paragraph",
            text=(
                "The bidder must demonstrate average annual financial turnover exceeding ₹1450.00 Crores. "
                "Net worth must be at least ₹290.00 Crores as audited by Chartered Accountant with UDIN."
            ),
            page_number=2,
        ),
        # Page 3
        DoclingBlock(
            block_id="b8",
            type="heading",
            text="Clause 6.1 Equipment Capability Matrix",
            page_number=3,
        ),
        DoclingBlock(
            block_id="b9",
            type="paragraph",
            text="The contractor shall mobilize the minimum fleet of plant and equipment listed below.",
            page_number=3,
        ),
    ]

    # Table 1: Bank Account Details (Page 1)
    bank_table = DoclingTable(
        table_id="tbl_bank_1",
        page_number=1,
        headers=["Sl No", "Particulars", "Details"],
        rows=[
            ["1", "Beneficiary Name", "National Highways Authority of India"],
            ["2", "Bank Name", "Canara Bank"],
            ["3", "Account Number", "0385201800065"],
            ["4", "IFSC Code", "CNRB0001624"],
            ["5", "Branch", "Sector 10 Panchkula"],
        ],
        caption="Table 4.1: Banking Particulars for EMD Remittance",
    )

    # Table 2: Financial Thresholds (Page 2)
    fin_table = DoclingTable(
        table_id="tbl_fin_2",
        page_number=2,
        headers=["Financial Year", "Minimum Annual Turnover", "Net Worth Requirement"],
        rows=[
            ["2023-2024", "₹1450.00 Crores", "₹290.00 Crores"],
            ["2022-2023", "₹1200.00 Crores", "₹240.00 Crores"],
            ["2021-2022", "₹1000.00 Crores", "₹200.00 Crores"],
        ],
        caption="Table 5.1: Financial Turnover Thresholds",
    )

    doc = DoclingParsedDocument(
        document_id="doc_adv_chunker",
        file_name="complex_tender.pdf",
        pages=[{"page_number": 1}, {"page_number": 2}, {"page_number": 3}],
        blocks=blocks,
        tables=[bank_table, fin_table],
    )

    builder = DocumentStructureBuilder()
    tree = builder.build_structure(doc)
    chunker = TenderChunker()
    chunks = chunker.chunk_document(doc, tree)

    # 1. Structure Verification
    skeletons = [c for c in chunks if c.tier == "TIER1_SKELETON"]
    parents = [c for c in chunks if c.tier == "TIER2_PARENT"]
    children = [c for c in chunks if c.tier == "TIER3_CHILD"]

    assert len(skeletons) > 0, "No Tier 1 Skeleton chunks generated!"
    assert len(parents) > 0, "No Tier 2 Parent chunks generated!"
    assert len(children) > 0, "No Tier 3 Child chunks generated!"

    # 2. Skeleton Chunks Invariants
    assert all(sk.parent_id is None for sk in skeletons)
    assert any("PART I" in sk.content for sk in skeletons)
    assert any("SECTION 2" in sk.content for sk in skeletons)
    assert any("Table tbl_bank_1" in sk.content for sk in skeletons)

    # 3. Parent Chunks Invariants
    parent_id_set = {p.id for p in parents}
    assert all(p.parent_id is None for p in parents)
    table_parents = [p for p in parents if p.chunk_type == "TABLE"]
    assert len(table_parents) == 2, f"Expected 2 table parents, found {len(table_parents)}"
    assert any("0385201800065" in tp.content for tp in table_parents)
    assert any("CNRB0001624" in tp.content for tp in table_parents)
    assert any("₹1450.00 Crores" in tp.content for tp in table_parents)

    # 4. Child Chunks & Parent/Child Linking Invariants
    dangling_children = [c for c in children if c.parent_id not in parent_id_set]
    assert len(dangling_children) == 0, (
        f"Found {len(dangling_children)} dangling children: {[c.id for c in dangling_children]}"
    )

    table_row_children = [c for c in children if c.chunk_type == "TABLE_ROW"]
    assert len(table_row_children) == 8  # 5 rows for bank table + 3 rows for fin table
    for r_child in table_row_children:
        assert r_child.parent_id in parent_id_set
        assert r_child.metadata.get("parent_id") == r_child.parent_id

    assert any("CNRB0001624" in c.content for c in table_row_children)
    assert any("0385201800065" in c.content for c in table_row_children)
    assert any("₹290.00 Crores" in c.content for c in table_row_children)


def test_adversarial_small_to_big_retrieval_expansion():
    """Adversarial stress-test: Challenge ScopedRetrievalTool with Small-to-Big expansion

    on child hits (table rows and clause sentences) and security bounds.
    """
    sec_ctx = SecurityContext(
        tenant_id="tenant_nhai",
        user_id="user_challenger",
        allowed_document_ids=["doc_adv_chunker"],
        workflow_run_id="run_adv_retrieval_1",
    )

    # Re-use chunks generated from complex document
    blocks = [
        DoclingBlock(
            block_id="b1",
            type="heading",
            text="Clause 4.1 Bid Security and EMD Payment Particulars",
            page_number=1,
        ),
        DoclingBlock(
            block_id="b2",
            type="paragraph",
            text="The bidder shall furnish EMD into the specified bank account.",
            page_number=1,
        ),
    ]
    bank_table = DoclingTable(
        table_id="bank_4_1",
        page_number=1,
        headers=["Sl No", "Particulars", "Details"],
        rows=[
            ["1", "Beneficiary Name", "National Highways Authority of India"],
            ["2", "Bank Name", "Canara Bank"],
            ["3", "Account Number", "0385201800065"],
            ["4", "IFSC Code", "CNRB0001624"],
            ["5", "Branch", "Sector 10 Panchkula"],
        ],
        caption="Table 4.1: Banking Particulars",
    )
    doc = DoclingParsedDocument(
        document_id="doc_adv_chunker",
        file_name="tender.pdf",
        pages=[{"page_number": 1}],
        blocks=blocks,
        tables=[bank_table],
    )
    builder = DocumentStructureBuilder()
    tree = builder.build_structure(doc)
    chunker = TenderChunker()
    extracted_chunks = chunker.chunk_document(doc, tree)

    doc_chunks = [
        DocumentChunk(
            chunk_id=c.id,
            tenant_id="tenant_nhai",
            document_id="doc_adv_chunker",
            page_number=c.page_number,
            clause_reference=c.clause_reference or "General",
            text=c.verbatim_text or c.content,
            parent_id=c.parent_id,
            tier=c.tier,
            canonical_ref_id=c.canonical_ref_id,
            metadata=c.metadata,
        )
        for c in extracted_chunks
    ]

    retrieval_tool = ScopedRetrievalTool()
    retrieval_tool.seed_chunks(doc_chunks)

    # 1. Test Small-to-Big Retrieval with expand_to_parent=True
    # Query targets specific table cell (IFSC code)
    results = retrieval_tool.retrieve(
        security_context=sec_ctx,
        target_document_id="doc_adv_chunker",
        query="CNRB0001624 Canara Bank account 0385201800065",
        top_k=3,
        expand_to_parent=True,
    )

    assert len(results) > 0, "No results returned for IFSC query!"
    top_result = results[0]

    # With expand_to_parent=True, the top result MUST be expanded to the TIER2_PARENT table!
    assert top_result.tier == "TIER2_PARENT", (
        f"Expected top result to expand to TIER2_PARENT, got {top_result.tier}"
    )
    assert top_result.chunk_id.startswith("chk_doc_adv_chunker_p_tbl_")
    assert "Canara Bank" in top_result.text
    assert "0385201800065" in top_result.text
    assert "CNRB0001624" in top_result.text
    assert "Sector 10 Panchkula" in top_result.text

    # Verify child_hit metadata is recorded
    assert "child_hit" in top_result.metadata
    assert "CNRB0001624" in top_result.metadata["child_hit"]["text"]

    # 2. Test Retrieval with expand_to_parent=False
    results_no_expand = retrieval_tool.retrieve(
        security_context=sec_ctx,
        target_document_id="doc_adv_chunker",
        query="CNRB0001624 IFSC",
        top_k=3,
        expand_to_parent=False,
    )
    assert len(results_no_expand) > 0
    # When expand_to_parent=False, child chunks MUST be preserved in unexpanded form
    assert any(r.tier == "TIER3_CHILD" for r in results_no_expand), (
        f"Expected at least one TIER3_CHILD chunk when expand_to_parent=False, got tiers: {[r.tier for r in results_no_expand]}"
    )

    # 3. Security Boundary: Anti-IDOR check
    unauthorized_sec_ctx = SecurityContext(
        tenant_id="tenant_nhai",
        user_id="user_malicious",
        allowed_document_ids=["doc_other_allowed"],
        workflow_run_id="run_adv_unauthorized",
    )
    with pytest.raises(UnauthorizedDocumentAccessException):
        retrieval_tool.retrieve(
            security_context=unauthorized_sec_ctx,
            target_document_id="doc_adv_chunker",
            query="Canara Bank",
        )

    # 4. Security Boundary: Rate Limiting
    rate_limited_sec_ctx = SecurityContext(
        tenant_id="tenant_nhai",
        user_id="user_fast",
        allowed_document_ids=["doc_adv_chunker"],
        workflow_run_id="run_rate_limit_test",
    )
    for _ in range(15):
        retrieval_tool.retrieve(
            security_context=rate_limited_sec_ctx,
            target_document_id="doc_adv_chunker",
            query="Canara Bank",
        )
    with pytest.raises(ToolRateLimitExceededException):
        retrieval_tool.retrieve(
            security_context=rate_limited_sec_ctx,
            target_document_id="doc_adv_chunker",
            query="Canara Bank",
        )
