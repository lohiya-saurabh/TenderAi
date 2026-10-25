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
from tenderpulse_ai.tools.page_text import PageTextTool
from tenderpulse_ai.tools.retrieval import ScopedRetrievalTool
from tenderpulse_ai.workflow.nodes import WorkflowNodeContext, make_validation_node

# ==============================================================================
# SUITE 1: Hostile Multi-line Paragraphs Ending in Bare Deleted / Omitted
# With Trailing Carriage Returns (\r), CRLF (\r\n), Tabs, and Whitespace
# ==============================================================================

HOSTILE_DELETION_VARIANTS = [
    # 1. Bare Deleted with CRLF
    "Clause 46.1 Mobilization Advance Deleted\r\n",
    # 2. Bare Deleted with bare CR (\r)
    "Clause 46.1 Mobilization Advance Deleted\r",
    # 3. Bare Deleted with trailing spaces and CRLF
    "Clause 46.1 Mobilization Advance Deleted   \r\n",
    # 4. Bare Deleted with trailing tab and CRLF
    "Clause 46.1 Mobilization Advance Deleted\t\r\n",
    # 5. Bare Omitted with CRLF
    "Clause 46.1 Mobilization Advance Omitted\r\n",
    # 6. Bare Omitted with bare CR
    "Clause 46.1 Mobilization Advance Omitted\r",
    # 7. Bare Omitted with trailing tab and spaces
    "Clause 46.1 Mobilization Advance Omitted\t  \r\n",
    # 8. Multi-line paragraph ending in bare Deleted with CRLF
    "The contractor was initially entitled to mobilization advance.\r\nPursuant to Addendum 1, this entitlement is hereby\r\nDeleted\r\n",
    # 9. Multi-line paragraph ending in bare Omitted with bare CR
    "All advance payments for plant and machinery under this section\r\nare permanently\r\nOmitted\r",
    # 10. Split clause title and bare Deleted
    "Clause 46.1 Mobilization Advance\r\nDeleted\r\n",
    # 11. Split clause title and bare Omitted
    "Clause 46.1 Mobilization Advance\r\nOmitted\r\n",
    # 12. Multi-line clause with operative text ending in bare Deleted
    "Clause 46.1 Mobilization Advance Deleted\r\nThe Authority shall pay 10% advance against bank guarantee.",
    # 13. Multi-line clause with operative text ending in bare Omitted
    "Clause 46.1 Mobilization Advance Omitted\r\nThe Authority shall pay 10% advance against bank guarantee.",
    # 14. Multiple trailing newlines and whitespace
    "Clause 46.1 Mobilization Advance Deleted\r\n\r\n   \r\n",
    # 15. Hyphenated and dash variants with CRLF
    "Clause 46.1 Mobilization Advance - Deleted\r\n",
    "Clause 46.1 Mobilization Advance — Deleted\r\n",
    "Clause 46.1 Mobilization Advance – Omitted\r\n",
    # 16. Bracketed and parenthesized variants with trailing whitespace
    "Clause 46.1 Mobilization Advance [Deleted]  \r\n",
    "Clause 46.1 Mobilization Advance (Omitted)\t\r\n",
    # 17. Case variations with CRLF
    "Clause 46.1 Mobilization Advance DELETED\r\n",
    "Clause 46.1 Mobilization Advance OMITTED\r\n",
    "Clause 46.1 Mobilization Advance deleted\r\n",
    "Clause 46.1 Mobilization Advance omitted\r\n",
]


@pytest.mark.parametrize("variant", HOSTILE_DELETION_VARIANTS)
def test_hostile_deleted_variants_direct_classifier(variant: str):
    """Verify is_clause_deleted detects all hostile multi-line, CRLF, and trailing whitespace variants."""
    assert is_clause_deleted(variant) is True, (
        f"Failed to detect deletion in hostile variant: {repr(variant)}"
    )


@pytest.mark.parametrize("variant", HOSTILE_DELETION_VARIANTS)
def test_hostile_deleted_variants_docling_parser(variant: str):
    """Verify DoclingParserEngine marks blocks with hostile deletion variants as is_deleted=True."""
    doc_text = f"SECTION 2: BID DATA SHEET\r\n\r\n{variant}\r\n\r\nClause 10.1 Active Clause\r\nActive text."
    engine = DoclingParserEngine()
    doc = engine.parse_document("doc_hostile_del", "test.pdf", pages=[], raw_text=doc_text)

    del_blocks = [b for b in doc.blocks if b.is_deleted]
    assert len(del_blocks) >= 1, (
        f"DoclingParserEngine failed to flag deleted block for variant: {repr(variant)}"
    )

    active_blocks = [
        b for b in doc.blocks if "Clause 10.1 Active Clause" in b.text or "Active text" in b.text
    ]
    for ab in active_blocks:
        assert ab.is_deleted is False, f"Falsely marked active block as deleted: {ab.text}"


@pytest.mark.parametrize("variant", HOSTILE_DELETION_VARIANTS)
def test_hostile_deleted_variants_rule_suppression(variant: str):
    """Verify get_clause_and_quote suppresses all hostile deletion variants."""
    text = f"{variant}\nThe Authority shall pay 10% mobilization advance against bank guarantee."
    res = get_clause_and_quote(
        r"mobilization advance",
        "mobilization advance",
        ["mobilization advance"],
        text,
        text.lower(),
        1,
        variant.strip(),
    )
    assert res is None, f"Rule failed to suppress hostile deletion variant: {repr(variant)}"

    items = default_tender_extractor("", text)
    assert items == [], f"default_tender_extractor leaked items for variant: {repr(variant)}"


@pytest.mark.asyncio
@pytest.mark.parametrize("variant", HOSTILE_DELETION_VARIANTS)
async def test_hostile_deleted_variants_validation_node(variant: str):
    """Verify validation node rejects candidates containing hostile deletion variants."""
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
            clause_reference=variant.strip(),
            verbatim_quote=variant.strip(),
            confidence_score=0.95,
        ),
    )

    state = {
        "security_context": sec_ctx.model_dump(),
        "bid_id": "bid_adv_1",
        "document_id": "doc_adv",
        "page_number": 1,
        "raw_page_text": variant,
        "extracted_candidates": [candidate],
        "document_structure": DocumentStructureTree(
            document_id="doc_adv",
            nodes=[
                SectionNode(
                    node_id="sec_del",
                    number="46.1",
                    title=variant.strip(),
                    level=3,
                )
            ],
        ).model_dump(),
    }

    result = await val_node(state)
    verified = result.get("verified_items", [])
    unverified = result.get("unverified_items", [])
    feedback = result.get("error_feedback", "")

    assert len(verified) == 0, f"Candidate with variant '{repr(variant)}' was falsely verified!"
    assert len(unverified) == 1, (
        f"Candidate with variant '{repr(variant)}' was not routed to unverified items!"
    )
    assert "originates from deleted/omitted clause" in feedback, (
        f"Validation feedback missing deletion explanation: {feedback}"
    )


# ==============================================================================
# SUITE 2: Tier 1 Skeleton Chunk Generation with Multiple Deleted Clauses
# Zero Leaked Clause Numbers in "Contained Clauses:"
# ==============================================================================


def test_skeleton_chunks_zero_leaked_clauses_multi_deleted_section():
    """Verify Tier 1 Skeleton chunk generation filters out all deleted child clauses.

    Construct a section with 10 deleted clauses and 2 active clauses.
    Assert that 'Contained Clauses:' contains ONLY active clauses and ZERO deleted clause numbers.
    """
    section_node = SectionNode(
        node_id="sec_node_bds",
        number="SECTION 2",
        title="SECTION 2: BID DATA SHEET",
        level=2,
        parent_id=None,
        block_ids=["blk_sec_2"],
    )

    deleted_clause_definitions = [
        ("46.1", "Clause 46.1 Mobilization Advance - Deleted\r\n"),
        ("46.2", "Clause 46.2 Secured Advance on Materials - DELETED.\r\n"),
        ("46.3", "Clause 46.3 Plant and Machinery Advance [Omitted]\r\n"),
        ("46.4", "Clause 46.4 Special Mobilization Advance (Omitted)\r\n"),
        ("46.5", "Clause 46.5 Financial Assistance - Omitted.\r\n"),
        ("46.6", "Clause 46.6 Interest on Advance Deleted\r\n"),
        ("46.7", "Clause 46.7 Additional Advance [Deleted]\r\n"),
        ("46.8", "Clause 46.8 Emergency Advance (Deleted)\r\n"),
        ("46.9", "Clause 46.9 Equipment Loan stands deleted\r\n"),
        ("46.10", "Clause 46.10 Discretionary Advance is omitted\r\n"),
    ]

    active_clause_definitions = [
        ("33.1", "Clause 33.1 Performance Security Requirement"),
        ("14.1", "Clause 14.1 Earnest Money Deposit"),
    ]

    nodes = [section_node]
    blocks = [
        DoclingBlock(
            block_id="blk_sec_2", type="heading", level=2, text=section_node.title, page_number=1
        )
    ]

    # Add deleted clauses
    for idx, (num, title) in enumerate(deleted_clause_definitions, start=1):
        nid = f"sec_node_del_{idx}"
        bid = f"blk_del_{idx}"
        nodes.append(
            SectionNode(
                node_id=nid,
                number=num,
                title=title,
                level=3,
                parent_id="sec_node_bds",
                block_ids=[bid],
            )
        )
        blocks.append(
            DoclingBlock(
                block_id=bid, type="heading", level=3, text=title, page_number=1, is_deleted=True
            )
        )

    # Add active clauses
    for idx, (num, title) in enumerate(active_clause_definitions, start=1):
        nid = f"sec_node_act_{idx}"
        bid = f"blk_act_{idx}"
        nodes.append(
            SectionNode(
                node_id=nid,
                number=num,
                title=title,
                level=3,
                parent_id="sec_node_bds",
                block_ids=[bid],
            )
        )
        blocks.append(
            DoclingBlock(
                block_id=bid, type="heading", level=3, text=title, page_number=1, is_deleted=False
            )
        )

    tree = DocumentStructureTree(document_id="doc_sk_test", nodes=nodes)
    doc = DoclingParsedDocument(
        document_id="doc_sk_test",
        file_name="tender_sk.pdf",
        pages=[{"page_number": 1}],
        blocks=blocks,
        tables=[],
    )

    chunker = TenderChunker()
    chunks = chunker.chunk_document(doc, tree)

    skeleton_chunks = [
        c for c in chunks if c.tier == "TIER1_SKELETON" and c.chunk_type == "SKELETON"
    ]
    assert len(skeleton_chunks) >= 1, "Expected at least 1 skeleton chunk"

    sec_sk = next(c for c in skeleton_chunks if "SECTION 2" in c.content)
    content = sec_sk.content

    # Verify active clauses ARE present
    assert "33.1" in content, f"Active clause 33.1 missing from skeleton chunk: {content}"
    assert "14.1" in content, f"Active clause 14.1 missing from skeleton chunk: {content}"

    # Verify ZERO deleted clauses leaked into Contained Clauses
    for num, _ in deleted_clause_definitions:
        assert num not in content, (
            f"LEAKED DELETED CLAUSE: Clause {num} found in skeleton chunk content:\n{content}"
        )


def test_skeleton_chunks_all_deleted_child_clauses():
    """Verify that when ALL child clauses under a section are deleted,

    the skeleton chunk emits 'Contained Clauses: General Provisions'
    and zero clause numbers.
    """
    section_node = SectionNode(
        node_id="sec_node_all_del",
        number="SECTION 5",
        title="SECTION 5: ADVANCE PAYMENTS",
        level=2,
        parent_id=None,
        block_ids=["blk_sec_5"],
    )

    deleted_clauses = [
        ("5.1", "Clause 5.1 Mobilization Advance Deleted\r\n"),
        ("5.2", "Clause 5.2 Machinery Advance [Omitted]\r\n"),
        ("5.3", "Clause 5.3 Material Advance - Deleted\r\n"),
    ]

    nodes = [section_node]
    blocks = [
        DoclingBlock(
            block_id="blk_sec_5", type="heading", level=2, text=section_node.title, page_number=1
        )
    ]

    for idx, (num, title) in enumerate(deleted_clauses, start=1):
        nid = f"sec_node_del_{idx}"
        bid = f"blk_del_{idx}"
        nodes.append(
            SectionNode(
                node_id=nid,
                number=num,
                title=title,
                level=3,
                parent_id="sec_node_all_del",
                block_ids=[bid],
            )
        )
        blocks.append(
            DoclingBlock(
                block_id=bid, type="heading", level=3, text=title, page_number=1, is_deleted=True
            )
        )

    tree = DocumentStructureTree(document_id="doc_all_del", nodes=nodes)
    doc = DoclingParsedDocument(
        document_id="doc_all_del",
        file_name="tender_all_del.pdf",
        pages=[{"page_number": 1}],
        blocks=blocks,
        tables=[],
    )

    chunker = TenderChunker()
    chunks = chunker.chunk_document(doc, tree)

    skeleton_chunks = [
        c for c in chunks if c.tier == "TIER1_SKELETON" and c.chunk_type == "SKELETON"
    ]
    sec_sk = next(c for c in skeleton_chunks if "SECTION 5" in c.content)
    content = sec_sk.content

    assert "Contained Clauses: General Provisions" in content, (
        f"Expected 'Contained Clauses: General Provisions' when all children deleted, got:\n{content}"
    )
    for num, _ in deleted_clauses:
        assert num not in content, f"Leaked deleted clause {num} in all-deleted section:\n{content}"


def test_skeleton_chunks_deleted_section_completely_suppressed():
    """Verify that if a Section itself is marked deleted, no skeleton chunk is generated for it."""
    section_node = SectionNode(
        node_id="sec_node_del_sec",
        number="SECTION 6",
        title="SECTION 6: MOBILIZATION ADVANCES - DELETED\r\n",
        level=2,
        parent_id=None,
        block_ids=["blk_sec_6"],
    )
    tree = DocumentStructureTree(document_id="doc_del_sec", nodes=[section_node])
    doc = DoclingParsedDocument(
        document_id="doc_del_sec",
        file_name="tender_del_sec.pdf",
        pages=[{"page_number": 1}],
        blocks=[
            DoclingBlock(
                block_id="blk_sec_6",
                type="heading",
                level=2,
                text=section_node.title,
                page_number=1,
                is_deleted=True,
            )
        ],
        tables=[],
    )

    chunker = TenderChunker()
    chunks = chunker.chunk_document(doc, tree)

    skeleton_chunks = [
        c for c in chunks if c.tier == "TIER1_SKELETON" and c.chunk_type == "SKELETON"
    ]
    for sk in skeleton_chunks:
        assert "SECTION 6" not in sk.content, (
            f"Deleted Section 6 should not have a skeleton chunk:\n{sk}"
        )


def test_skeleton_chunks_deleted_table_suppression():
    """Verify that tables with deleted captions do not generate table skeleton chunks."""
    tbl_deleted = DoclingTable(
        table_id="tbl_adv_del",
        page_number=1,
        headers=["Type", "Amount", "Status"],
        rows=[["Mobilization", "10%", "Deleted"]],
        row_key_map={"Mobilization": "10% | Deleted"},
        caption="Table 4.1 Advance Payment Terms - Deleted\r\n",
    )
    tbl_active = DoclingTable(
        table_id="tbl_fee_act",
        page_number=1,
        headers=["Item", "Account", "IFSC"],
        rows=[["Tender Fee", "0385201800065", "CNRB0001624"]],
        row_key_map={"Tender Fee": "0385201800065 | CNRB0001624"},
        caption="Table 4.2 Bank Payment Details",
    )

    doc = DoclingParsedDocument(
        document_id="doc_tbl_del",
        file_name="tender_tbl.pdf",
        pages=[{"page_number": 1}],
        blocks=[],
        tables=[tbl_deleted, tbl_active],
    )
    tree = DocumentStructureTree(document_id="doc_tbl_del", nodes=[])

    chunker = TenderChunker()
    chunks = chunker.chunk_document(doc, tree)

    sk_tables = [c for c in chunks if c.chunk_type == "TABLE_SKELETON"]
    # Table 4.1 (deleted) must NOT be present
    for t_sk in sk_tables:
        assert "tbl_adv_del" not in t_sk.id, f"Deleted table generated skeleton chunk: {t_sk}"
        assert "Table 4.1" not in t_sk.content, f"Deleted table caption found in skeleton: {t_sk}"

    # Table 4.2 (active) MUST be present
    active_t_sk = [t for t in sk_tables if "tbl_fee_act" in t.id]
    assert len(active_t_sk) == 1, "Active table missing from table skeleton chunks"


# ==============================================================================
# SUITE 3: Guarded Legal AST with Road Chainages
# ==============================================================================

ADVERSARIAL_CHAINAGE_TEXTS = [
    # Standalone 3-decimal meter chainages
    "12.000. Road Section",
    "48.000. Highway Widening Work",
    "348.000 Highway Alignment Chainage Data",
    "15.250 Pavement Resurfacing Section",
    "108.500 Toll Plaza Location",
    # Km prefixes with decimals
    "Km. 87.000",
    "Km 0.000 to Km 50.000 Project Highway",
    "Km. 87.000 to Km. 120.000",
    "KM 108.500 Toll Plaza Location",
    # Ch / Chainage prefixes
    "Ch. 12.000 to 15.000 Alignment",
    "Chainage 42.500",
    "Ch. 99.123",
    "Chainage 348.000",
    "Ch 10.500 Culvert Location",
    # Plus format road chainages
    "Km 12+400 to Km 45+800 Highway Widening",
    "Chainage 12+400 to 45+800 Pavement Construction",
    "Ch. 12+400 to 45+800",
    "12+400 to 45+800 Bituminous Concrete",
    "Km. 0+000 Start of Four Laning Project",
    "Chainage: 45.000 Bridge Location",
    # Chainage ranges
    "348.000 - 350.000",
    "348.000 to 398.000 Construction Corridor",
    "12.000 to 45.000 Construction of minor bridges and culverts",
    "0.000 to 25.000 Widening to 4 lanes",
    "5.000 to 10.000 Earthwork in Embankment",
    # Calendar dates
    "22.01.2026",
    "19.02.2026 Opening of Technical Bids",
    "15.08.2025 Submission Deadline",
    # Bare decimals / percentages / physical measurements
    "0.5 percent per day delay liquidated damages",
    "0.25 percent per week penalty",
    "50 km highway widening project",
    "100 meters buffer corridor",
    "1.5 crore mobilization advance limit",
]

VALID_LEGAL_HEADINGS_WITH_CHAINAGES = [
    ("Clause 1.2 Scope of Works from Km. 87.000 to Km. 120.000", "1.2"),
    ("Clause 4.10 Highway Realignment between Ch. 12.000 and Ch. 25.000", "4.10"),
    ("Clause 5.3 Maintenance of Chainage 42+500 to 60+000", "5.3"),
    ("Table 1.1 Technical Parameters and Chainage Distribution", "1.1"),
    ("Sub-Clause 14.3 Mobilization Advance at Km 0.000 Site Camp", "14.3"),
    ("Clause 22.4 Culvert Construction at Km 15.400", "22.4"),
    ("Clause 33.1 Performance Security Requirement", "33.1"),
    ("Clause 14.1 Earnest Money Deposit of Rs 7.18 Crores", "14.1"),
]


@pytest.mark.parametrize("chainage_text", ADVERSARIAL_CHAINAGE_TEXTS)
def test_adversarial_chainage_rejection_by_classifier(chainage_text: str):
    """Verify that hostile road chainages, dates, and measurements are classified as invalid clause candidates."""
    is_invalid = DocumentStructureBuilder._is_invalid_clause_candidate(chainage_text)
    clause_match = DocumentStructureBuilder.GUARDED_CLAUSE_PATTERN.search(chainage_text)

    # Either _is_invalid_clause_candidate is True, OR GUARDED_CLAUSE_PATTERN does not match
    assert is_invalid or (clause_match is None), (
        f"Hostile chainage text escaped classifier and matched clause pattern: {chainage_text}"
    )


@pytest.mark.parametrize("valid_heading,expected_number", VALID_LEGAL_HEADINGS_WITH_CHAINAGES)
def test_valid_legal_headings_with_chainages_accepted(valid_heading: str, expected_number: str):
    """Verify that valid legal headings containing road chainages in their titles are NOT rejected."""
    assert DocumentStructureBuilder._is_invalid_clause_candidate(valid_heading) is False, (
        f"Valid legal heading erroneously rejected by _is_invalid_clause_candidate: {valid_heading}"
    )
    match = DocumentStructureBuilder.GUARDED_CLAUSE_PATTERN.search(valid_heading)
    assert match is not None, (
        f"Valid legal heading failed to match GUARDED_CLAUSE_PATTERN: {valid_heading}"
    )
    extracted_num = match.group(1) or match.group(2)
    assert extracted_num == expected_number, (
        f"Extracted clause number '{extracted_num}' does not match expected '{expected_number}' for: {valid_heading}"
    )


def test_adversarial_guarded_ast_full_document_stress():
    """Adversarial stress test on complete document containing hostile chainages mixed with valid headings.

    Verifies:
    1. Zero hostile chainages become Level 3 AST section nodes.
    2. All valid headings (including those with Km chainages in their titles) DO become Level 3 AST section nodes.
    3. Valid headings retain their full title including chainage details.
    """
    blocks = [
        DoclingBlock(
            block_id="b_part1",
            type="heading",
            level=1,
            text="PART I BIDDING PROCEDURES",
            page_number=1,
        ),
        DoclingBlock(
            block_id="b_sec2",
            type="heading",
            level=2,
            text="SECTION 2 INSTRUCTIONS TO BIDDERS",
            page_number=1,
        ),
    ]

    for idx, (heading, _) in enumerate(VALID_LEGAL_HEADINGS_WITH_CHAINAGES, start=1):
        blocks.append(
            DoclingBlock(
                block_id=f"b_val_heading_{idx}",
                type="heading",
                level=3,
                text=heading,
                page_number=1,
            )
        )
        blocks.append(
            DoclingBlock(
                block_id=f"b_val_body_{idx}",
                type="paragraph",
                level=None,
                text=f"The contractor shall strictly comply with the stipulations of {heading}.",
                page_number=1,
            )
        )

    for idx, chainage in enumerate(ADVERSARIAL_CHAINAGE_TEXTS, start=1):
        blocks.append(
            DoclingBlock(
                block_id=f"b_hostile_chainage_{idx}",
                type="paragraph",
                level=None,
                text=chainage,
                page_number=1,
            )
        )

    doc = DoclingParsedDocument(
        document_id="doc_chainage_stress",
        file_name="tender_chainage.pdf",
        pages=[{"page_number": 1}],
        blocks=blocks,
        tables=[],
    )

    builder = DocumentStructureBuilder()
    tree = builder.build_structure(doc)

    level_3_nodes = [n for n in tree.nodes if n.level == 3]
    level_3_numbers = [n.number for n in level_3_nodes]
    level_3_titles = [n.title for n in level_3_nodes]

    # 1. All expected valid clause numbers must be present
    for _, exp_num in VALID_LEGAL_HEADINGS_WITH_CHAINAGES:
        assert exp_num in level_3_numbers, (
            f"Valid clause {exp_num} missing from AST level 3 nodes: {level_3_numbers}"
        )

    # 2. Scope of Works retain full chainage title
    scope_node = next(n for n in level_3_nodes if n.number == "1.2")
    assert "Km. 87.000 to Km. 120.000" in scope_node.title

    # 3. NONE of the hostile chainages should have become a level 3 AST node
    hostile_forbidden_numbers = [
        "12.000",
        "48.000",
        "348.000",
        "15.250",
        "108.500",
        "22.01.2026",
        "19.02.2026",
        "15.08.2025",
        "0.5",
        "0.25",
        "50",
        "100",
        "1.5",
        "87.000",
        "42.500",
        "99.123",
    ]
    for fn in hostile_forbidden_numbers:
        assert fn not in level_3_numbers, (
            f"HOSTILE CHAINAGE LEAKED AS AST NODE NUMBER: '{fn}' in {level_3_numbers}"
        )

    for chainage in ADVERSARIAL_CHAINAGE_TEXTS:
        assert chainage not in level_3_titles, (
            f"HOSTILE CHAINAGE LEAKED AS AST NODE TITLE: '{chainage}'"
        )


# ==============================================================================
# SUITE 4: Full Pipeline End-to-End Extraction with Hostile Deletions & Chainages
# ==============================================================================


def test_full_pipeline_with_hostile_deletions_and_chainages():
    """End-to-end integration test with Docling parsing, Structure Builder,

    Tender Chunker, and Candidate Detector.
    Ensures that in a multi-page document with hostile deletions and road chainages:
    1. Zero deleted obligations are detected.
    2. Zero deleted clauses appear in Tier 1 skeleton chunks.
    3. Zero hostile road chainages become clause references.
    4. Legitimate obligations (PBG, EMD, Scope) are preserved with high fidelity.
    """
    tender_text = """
PART I: BIDDING PROCEDURES

SECTION 2: BID DATA SHEET

Clause 33.1 Performance Security Requirement
The successful bidder shall submit Performance Bank Guarantee (PBG) of 3% of the contract value within 28 days of issuance of Letter of Award (LOA).

Clause 14.1 Earnest Money Deposit
The bidder shall furnish Earnest Money Deposit (EMD) of INR 7,18,00,000 (Rupees Seven Crore Eighteen Lakhs only) via Bank Guarantee or online payment.

Clause 46.1 Mobilization Advance Deleted\r
The Authority shall provide 10% mobilization advance against equivalent bank guarantee.\r

Clause 46.2 Plant and Machinery Advance [Omitted]\r\n
Advance of 50% invoice value for plant and machinery shall be paid.\r\n

Clause 46.3 Secured Advance on Materials - DELETED.\r\n
Payment of 75% on invoice value of construction materials shall be made.\r\n

Clause 1.2 Scope of Works from Km. 87.000 to Km. 120.000
The scope includes four-laning of the existing 2-lane highway from Km. 87.000 to Km. 120.000 of NH-44.

348.000 to 398.000 Construction Corridor
The alignment passes through agricultural land from 348.000 to 398.000.

12.000. Road Section
Clearance of right of way along 12.000. Road Section shall be completed prior to commencement.

22.01.2026 Technical Bid Submission Deadline
All bids must be submitted online before 15:00 hours on 22.01.2026.
"""

    engine = DoclingParserEngine()
    parsed_doc = engine.parse_document(
        "doc_e2e_stress", "tender_stress.pdf", pages=[], raw_text=tender_text
    )

    builder = DocumentStructureBuilder()
    tree = builder.build_structure(parsed_doc)

    chunker = TenderChunker()
    chunks = chunker.chunk_document(parsed_doc, tree)

    detector = CandidateDetector()
    candidates = detector.detect_candidates(parsed_doc, tree)

    # 1. Verify candidate obligations
    candidate_sections = [c.section_number for c in candidates if c.section_number]
    candidate_texts = [c.text for c in candidates if c.text]

    # Active clauses MUST be detected
    assert any("33.1" in sec for sec in candidate_sections), (
        f"PBG Clause 33.1 missing: {candidate_sections}"
    )
    assert any("14.1" in sec for sec in candidate_sections), (
        f"EMD Clause 14.1 missing: {candidate_sections}"
    )

    # Deleted clauses MUST NOT be detected
    for del_clause in ["46.1", "46.2", "46.3"]:
        assert not any(del_clause in sec for sec in candidate_sections), (
            f"DELETED CLAUSE EXTRACTED AS OBLIGATION: {del_clause} in {candidate_sections}"
        )

    # Deleted texts MUST NOT be present
    for text in candidate_texts:
        assert not is_clause_deleted(text), f"DELETED TEXT EXTRACTED: {text}"

    # Hostile chainages MUST NOT be section numbers
    for hostile_ref in ["348.000", "12.000"]:
        assert not any(hostile_ref in sec for sec in candidate_sections), (
            f"HOSTILE CHAINAGE EXTRACTED AS SECTION NUMBER: {hostile_ref}"
        )

    # 2. Verify Tier 1 Skeleton chunks
    sk_chunks = [c for c in chunks if c.tier == "TIER1_SKELETON" and c.chunk_type == "SKELETON"]
    for sk in sk_chunks:
        content = sk.content
        for del_clause in ["46.1", "46.2", "46.3"]:
            assert del_clause not in content, (
                f"DELETED CLAUSE NUMBER {del_clause} LEAKED IN SKELETON CHUNK:\n{content}"
            )
