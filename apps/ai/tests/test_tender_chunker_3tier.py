from tenderpulse_ai.domain.models import DoclingBlock, DoclingParsedDocument, DoclingTable
from tenderpulse_ai.domain.tender_chunker import TenderChunker
from tenderpulse_ai.security.context import SecurityContext
from tenderpulse_ai.tools.retrieval import DocumentChunk, ScopedRetrievalTool


def test_3tier_chunking_generates_all_three_tiers():
    chunker = TenderChunker(target_chunk_chars=300, max_chunk_chars=600, overlap_chars=50)

    doc = DoclingParsedDocument(
        document_id="doc_nhai_test",
        file_name="nhai_tender.pdf",
        pages=[{"page_number": 1, "char_count": 500}],
        blocks=[
            DoclingBlock(
                block_id="blk_1",
                type="heading",
                level=1,
                text="PART I: INSTRUCTIONS TO BIDDERS",
                page_number=1,
            ),
            DoclingBlock(
                block_id="blk_2",
                type="heading",
                level=2,
                text="SECTION 2: BID SECURITY REQUIREMENTS",
                page_number=1,
            ),
            DoclingBlock(
                block_id="blk_3",
                type="heading",
                level=3,
                text="Clause 14.1 Earnest Money Deposit",
                page_number=1,
            ),
            DoclingBlock(
                block_id="blk_4",
                type="paragraph",
                level=None,
                text=(
                    "The bidder shall furnish, as part of its technical bid, an Earnest Money Deposit (EMD) "
                    "of Rs. 7.18 Crores. The EMD must be submitted in the form of a Bank Guarantee from a scheduled commercial bank. "
                    "Bids submitted without the requisite EMD shall be summarily rejected as non-responsive."
                ),
                page_number=1,
            ),
        ],
        tables=[],
    )

    chunks = chunker.chunk_document(doc)
    assert len(chunks) > 0

    tiers = {c.tier for c in chunks}
    assert "TIER1_SKELETON" in tiers
    assert "TIER2_PARENT" in tiers
    assert "TIER3_CHILD" in tiers

    # Verify Tier 1 Skeleton
    skeletons = [c for c in chunks if c.tier == "TIER1_SKELETON"]
    assert any("INSTRUCTIONS TO BIDDERS" in c.content for c in skeletons)
    assert all(c.parent_id is None for c in skeletons)
    assert all(c.metadata.get("is_skeleton") is True for c in skeletons)

    # Verify Tier 2 Parent
    parents = [c for c in chunks if c.tier == "TIER2_PARENT"]
    assert len(parents) >= 1
    emd_parents = [p for p in parents if "Earnest Money Deposit (EMD)" in p.content]
    assert len(emd_parents) == 1
    p = emd_parents[0]
    assert p.parent_id is None
    assert "Earnest Money Deposit (EMD)" in p.content
    assert p.canonical_ref_id == "clause:14.1"
    assert p.clause_reference == "14.1"

    # Verify Tier 3 Child
    children = [c for c in chunks if c.tier == "TIER3_CHILD" and c.parent_id == p.id]
    assert len(children) >= 2
    assert all(c.parent_id == p.id for c in children)
    assert all(c.canonical_ref_id == "clause:14.1" for c in children)
    assert any("7.18 Crores" in c.content for c in children)


def test_3tier_chunking_tables():
    chunker = TenderChunker()

    doc = DoclingParsedDocument(
        document_id="doc_table_test",
        file_name="tender_table.pdf",
        pages=[{"page_number": 1, "char_count": 300}],
        blocks=[],
        tables=[
            DoclingTable(
                table_id="tbl_milestones",
                page_number=1,
                caption="Project Milestone Schedule",
                headers=["Milestone No.", "Description of Deliverable", "Percentage of Payment"],
                rows=[
                    ["Milestone 1", "Submission of Inception Report", "10%"],
                    ["Milestone 2", "Approval of Feasibility Study", "25%"],
                    ["Milestone 3", "Final Detailed Project Report", "65%"],
                ],
                row_key_map={
                    "Milestone 1": "Submission of Inception Report | 10%",
                    "Milestone 2": "Approval of Feasibility Study | 25%",
                    "Milestone 3": "Final Detailed Project Report | 65%",
                },
            )
        ],
    )

    chunks = chunker.chunk_document(doc)

    sk_tables = [
        c for c in chunks if c.tier == "TIER1_SKELETON" and c.chunk_type == "TABLE_SKELETON"
    ]
    assert len(sk_tables) == 1
    assert "Project Milestone Schedule" in sk_tables[0].content
    assert sk_tables[0].canonical_ref_id == "skeleton:table:tbl_milestones"

    parent_tables = [c for c in chunks if c.tier == "TIER2_PARENT" and c.chunk_type == "TABLE"]
    assert len(parent_tables) == 1
    tbl_parent = parent_tables[0]
    assert "Milestone No." in tbl_parent.content
    assert tbl_parent.metadata.get("is_table") is True
    assert tbl_parent.metadata.get("rows_count") == 3

    child_rows = [c for c in chunks if c.tier == "TIER3_CHILD" and c.chunk_type == "TABLE_ROW"]
    assert len(child_rows) == 3
    assert all(c.parent_id == tbl_parent.id for c in child_rows)
    assert any("Inception Report" in c.content for c in child_rows)
    assert any("Feasibility Study" in c.content for c in child_rows)


def test_small_to_big_parent_expansion_in_retrieval():
    sec_ctx = SecurityContext(
        tenant_id="tenant_nhai",
        user_id="user_test",
        allowed_document_ids=["doc_101"],
        workflow_run_id="run_retrieval_01",
    )

    retrieval_tool = ScopedRetrievalTool(enable_jev_rerank=False)

    parent_chunk = DocumentChunk(
        chunk_id="chk_parent_01",
        tenant_id="tenant_nhai",
        document_id="doc_101",
        page_number=4,
        text=(
            "Clause 33.1: The successful bidder shall submit Performance Security (PBG) "
            "equal to 3% of the contract value within 28 days of letter of acceptance. "
            "Failure to submit the performance security shall constitute grounds for annulment of the award."
        ),
        clause_reference="Clause 33.1",
        tier="TIER2_PARENT",
        parent_id=None,
        metadata={"category": "financial"},
    )

    child_chunk = DocumentChunk(
        chunk_id="chk_child_01",
        tenant_id="tenant_nhai",
        document_id="doc_101",
        page_number=4,
        text="The successful bidder shall submit Performance Security (PBG) equal to 3% of the contract value.",
        clause_reference="Clause 33.1",
        tier="TIER3_CHILD",
        parent_id="chk_parent_01",
        metadata={"category": "financial"},
    )

    retrieval_tool.seed_chunks([parent_chunk, child_chunk])

    # 1. Retrieval with expand_to_parent=True: Child match expands to parent
    expanded_results = retrieval_tool.retrieve(
        security_context=sec_ctx,
        target_document_id="doc_101",
        query="Performance Security PBG 3 percent",
        top_k=2,
        expand_to_parent=True,
    )
    assert len(expanded_results) >= 1
    first_res = expanded_results[0]
    assert first_res.chunk_id == "chk_parent_01"
    assert first_res.tier == "TIER2_PARENT"
    assert "within 28 days" in first_res.text
    assert "child_hit" in first_res.metadata
    assert first_res.metadata["child_hit"]["chunk_id"] == "chk_child_01"

    # 2. Retrieval with expand_to_parent=False: Returns child directly
    unexpanded_results = retrieval_tool.retrieve(
        security_context=sec_ctx,
        target_document_id="doc_101",
        query="Performance Security PBG 3 percent",
        top_k=2,
        expand_to_parent=False,
    )
    assert len(unexpanded_results) >= 1
    assert any(c.chunk_id == "chk_child_01" for c in unexpanded_results)


def test_canonical_ref_id_generation():
    assert TenderChunker.canonicalize_ref_id("45.1", "Contract Data") == "contract_data:45.1"
    assert (
        TenderChunker.canonicalize_ref_id(None, "Contract Data Clause 7.1") == "contract_data:7.1"
    )
    assert TenderChunker.canonicalize_ref_id("Appendix 2.1", "Appendix to ITB") == "appendix:2.1"
    assert TenderChunker.canonicalize_ref_id("NIT Clause 1.1", "NIT Table") == "nit:1.1"
    assert TenderChunker.canonicalize_ref_id("Clause 14.2", "Earnest Money") == "clause:14.2"
    assert TenderChunker.canonicalize_ref_id("33.1", "Performance Guarantee") == "clause:33.1"
    assert TenderChunker.canonicalize_ref_id(None, None) is None
