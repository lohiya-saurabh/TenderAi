from __future__ import annotations

from tenderpulse_ai.domain.context_assembler import ContextAssembler
from tenderpulse_ai.domain.cross_reference_resolver import (
    CrossReferenceLink,
    CrossReferenceResolver,
)
from tenderpulse_ai.domain.models import (
    CandidatePassage,
    DoclingBlock,
    DoclingParsedDocument,
    DocumentStructureTree,
    SectionNode,
)
from tenderpulse_ai.domain.tender_chunker import TenderDocumentChunk


def test_canonicalize_ref_id():
    # Contract Data
    assert (
        CrossReferenceResolver.canonicalize_ref_id("45.1", "Contract Data") == "contract_data:45.1"
    )
    assert (
        CrossReferenceResolver.canonicalize_ref_id(None, "Contract Data Clause 7.1")
        == "contract_data:7.1"
    )
    assert CrossReferenceResolver.canonicalize_ref_id(None, "Contract Data") == "contract_data"

    # Appendix
    assert (
        CrossReferenceResolver.canonicalize_ref_id("Appendix 2.1", "Appendix to ITB")
        == "appendix:2.1"
    )
    assert (
        CrossReferenceResolver.canonicalize_ref_id(None, "Appendix to Instructions") == "appendix"
    )

    # NIT / Notice Inviting Tender
    assert CrossReferenceResolver.canonicalize_ref_id("NIT Clause 1.1", "NIT Table") == "nit:1.1"
    assert CrossReferenceResolver.canonicalize_ref_id(None, "Notice Inviting Tender Table") == "nit"

    # Standard Clauses
    assert (
        CrossReferenceResolver.canonicalize_ref_id("Clause 14.2", "Earnest Money") == "clause:14.2"
    )
    assert (
        CrossReferenceResolver.canonicalize_ref_id("33.1", "Performance Guarantee") == "clause:33.1"
    )
    assert CrossReferenceResolver.canonicalize_ref_id("1.2.3", "Scope") == "clause:1.2.3"

    # None and empty inputs
    assert CrossReferenceResolver.canonicalize_ref_id(None, None) is None
    assert CrossReferenceResolver.canonicalize_ref_id("", "   ") is None
    assert CrossReferenceResolver.canonicalize_ref_id("Unnumbered Paragraph", "General") is None


def test_index_chunks_and_bidirectional_discovery():
    resolver = CrossReferenceResolver()

    chunks = [
        # ITB Shell Clause 33.1 referencing Contract Data
        TenderDocumentChunk(
            id="chk_itb_33",
            chunk_index=0,
            chunk_type="CLAUSE",
            clause_reference="33.1",
            section_title="Instructions to Bidders",
            canonical_ref_id="clause:33.1",
            page_number=14,
            content="Clause 33.1: The bidder shall submit Performance Security as specified in Contract Data Clause 33.1.",
            verbatim_text="The bidder shall submit Performance Security as specified in Contract Data.",
        ),
        # Contract Data 33.1
        TenderDocumentChunk(
            id="chk_cd_33",
            chunk_index=1,
            chunk_type="CLAUSE",
            clause_reference="33.1",
            section_title="Contract Data",
            canonical_ref_id="contract_data:33.1",
            page_number=88,
            content="Contract Data Clause 33.1: Performance Security amount is 3% of the Contract Price.",
            verbatim_text="Performance Security amount is 3% of the Contract Price.",
        ),
        # ITB Shell Clause 14.1 referencing NIT
        TenderDocumentChunk(
            id="chk_itb_14",
            chunk_index=2,
            chunk_type="CLAUSE",
            clause_reference="14.1",
            section_title="Instructions to Bidders",
            canonical_ref_id="clause:14.1",
            page_number=10,
            content="Clause 14.1: Bid Security / EMD details are given in the NIT Table.",
            verbatim_text="Bid Security details are given in the NIT Table.",
        ),
        # NIT Clause 1.1
        TenderDocumentChunk(
            id="chk_nit_1",
            chunk_index=3,
            chunk_type="CLAUSE",
            clause_reference="1.1",
            section_title="Notice Inviting Tender",
            canonical_ref_id="nit:1.1",
            page_number=3,
            content="NIT Clause 1.1: Earnest Money Deposit is Rs. 7.18 Crores.",
            verbatim_text="Earnest Money Deposit is Rs. 7.18 Crores.",
        ),
        # ITB Clause 25.1 referencing Appendix
        TenderDocumentChunk(
            id="chk_itb_25",
            chunk_index=4,
            chunk_type="CLAUSE",
            clause_reference="25.1",
            section_title="Instructions to Bidders",
            canonical_ref_id="clause:25.1",
            page_number=18,
            content="Clause 25.1: Liquidated damages are specified in Appendix 2.1.",
            verbatim_text="Liquidated damages are specified in Appendix 2.1.",
        ),
        # Appendix 2.1
        TenderDocumentChunk(
            id="chk_app_2",
            chunk_index=5,
            chunk_type="CLAUSE",
            clause_reference="2.1",
            section_title="Appendix to ITB",
            canonical_ref_id="appendix:2.1",
            page_number=23,
            content="Appendix 2.1: Liquidated damages shall be 0.05% per day.",
            verbatim_text="Liquidated damages shall be 0.05% per day.",
        ),
    ]

    resolver.index_chunks(chunks)

    # 1. Verify chunk indexing
    assert "clause:33.1" in resolver._ref_index
    assert "contract_data:33.1" in resolver._ref_index
    assert "clause:14.1" in resolver._ref_index
    assert "nit:1.1" in resolver._ref_index
    assert "clause:25.1" in resolver._ref_index
    assert "appendix:2.1" in resolver._ref_index

    # 2. Verify links discovered
    links_33 = resolver._links.get("clause:33.1", [])
    assert len(links_33) == 1
    assert isinstance(links_33[0], CrossReferenceLink)
    assert links_33[0].target_ref_id == "contract_data:33.1"
    assert links_33[0].target_section == "Contract Data"
    assert links_33[0].target_page == 88

    links_14 = resolver._links.get("clause:14.1", [])
    assert len(links_14) == 1
    assert links_14[0].target_ref_id in ("nit:1.1", "nit")
    assert links_14[0].target_section == "Notice Inviting Tender"
    assert links_14[0].target_page == 3

    links_25 = resolver._links.get("clause:25.1", [])
    assert len(links_25) == 1
    assert links_25[0].target_ref_id == "appendix:2.1"
    assert links_25[0].target_section == "Appendix to ITB"
    assert links_25[0].target_page == 23

    # 3. Verify bidirectional resolution via resolve_references
    outbound_33, inbound_33 = resolver.resolve_references("clause:33.1")
    assert "contract_data:33.1" in outbound_33
    assert inbound_33 == []

    outbound_cd, inbound_cd = resolver.resolve_references("contract_data:33.1")
    assert outbound_cd == []
    assert "clause:33.1" in inbound_cd

    outbound_14, _ = resolver.resolve_references("clause:14.1")
    assert any("nit" in r for r in outbound_14)

    outbound_25, _ = resolver.resolve_references("clause:25.1")
    assert "appendix:2.1" in outbound_25


def test_hydrate_context_across_sections():
    resolver = CrossReferenceResolver()

    chk_itb = TenderDocumentChunk(
        id="chk_itb_33",
        chunk_index=0,
        chunk_type="CLAUSE",
        clause_reference="33.1",
        section_title="Instructions to Bidders",
        canonical_ref_id="clause:33.1",
        page_number=14,
        content="The Contractor shall submit Performance Security as per Contract Data Clause 33.1.",
        verbatim_text="The Contractor shall submit Performance Security as per Contract Data.",
    )
    chk_cd = TenderDocumentChunk(
        id="chk_cd_33",
        chunk_index=1,
        chunk_type="CLAUSE",
        clause_reference="33.1",
        section_title="Contract Data",
        canonical_ref_id="contract_data:33.1",
        page_number=88,
        content="Contract Data Clause 33.1: Performance Security amount is 3% of the Contract Price.",
        verbatim_text="Performance Security amount is 3% of the Contract Price.",
    )
    resolver.index_chunks([chk_itb, chk_cd])

    base_context = "Reviewing PBG requirement under ITB 33.1"
    hydrated = resolver.hydrate_context(chk_itb, base_context)

    # 1. Base context is preserved
    assert base_context in hydrated
    # 2. Contract Data block is injected
    assert "--- HYDRATED REFERENCE (Contract Data - Page 88) ---" in hydrated
    assert "Performance Security amount is 3% of the Contract Price." in hydrated
    assert "----------------------------------------------------------------------" in hydrated

    # 3. Chunks without cross references return base context untouched
    unhydrated = resolver.hydrate_context(chk_cd, "Contract Data stand-alone text")
    assert unhydrated == "Contract Data stand-alone text"

    # 4. Unknown or un-canonicalized chunk returns base context untouched
    raw_chunk = TenderDocumentChunk(
        id="chk_raw",
        chunk_index=2,
        chunk_type="PROSE",
        content="General prose without references",
        page_number=50,
    )
    assert resolver.hydrate_context(raw_chunk, "Base text") == "Base text"


def test_context_assembler_integration_with_cross_reference_resolver():
    doc = DoclingParsedDocument(
        document_id="doc_xref_nhai",
        file_name="nhai_tender.pdf",
        pages=[{"page_number": 14, "char_count": 400}, {"page_number": 88, "char_count": 300}],
        blocks=[
            DoclingBlock(
                block_id="blk_itb_33",
                type="paragraph",
                text="The Contractor shall submit Performance Security as specified in Contract Data Clause 33.1.",
                page_number=14,
            ),
            DoclingBlock(
                block_id="blk_cd_33",
                type="paragraph",
                text="Contract Data Clause 33.1: Performance Security is 3% of the accepted contract amount.",
                page_number=88,
            ),
        ],
        tables=[],
    )

    tree = DocumentStructureTree(
        document_id="doc_xref_nhai",
        nodes=[
            SectionNode(
                node_id="sec_itb",
                number="33.1",
                title="Clause 33.1 Performance Security",
                level=3,
                block_ids=["blk_itb_33"],
            ),
            SectionNode(
                node_id="sec_cd",
                number="33.1",
                title="Contract Data Clause 33.1",
                level=3,
                block_ids=["blk_cd_33"],
            ),
        ],
    )

    candidates = [
        CandidatePassage(
            candidate_id="cand_pbg_1",
            section_number="33.1",
            section_path="ITB > Performance Security",
            text="The Contractor shall submit Performance Security as specified in Contract Data Clause 33.1.",
            page_number=14,
            block_id="blk_itb_33",
            matched_rules=["financial_pbg"],
        )
    ]

    chunks = [
        TenderDocumentChunk(
            id="chk_itb_33",
            chunk_index=0,
            chunk_type="CLAUSE",
            clause_reference="33.1",
            section_title="Instructions to Bidders",
            canonical_ref_id="clause:33.1",
            page_number=14,
            content="The Contractor shall submit Performance Security as specified in Contract Data Clause 33.1.",
            verbatim_text="The Contractor shall submit Performance Security as specified in Contract Data Clause 33.1.",
        ),
        TenderDocumentChunk(
            id="chk_cd_33",
            chunk_index=1,
            chunk_type="CLAUSE",
            clause_reference="33.1",
            section_title="Contract Data",
            canonical_ref_id="contract_data:33.1",
            page_number=88,
            content="Contract Data Clause 33.1: Performance Security is 3% of the accepted contract amount.",
            verbatim_text="Performance Security is 3% of the accepted contract amount.",
        ),
    ]

    assembler = ContextAssembler()
    assembled = assembler.assemble_contexts(
        doc=doc,
        tree=tree,
        candidates=candidates,
        chunks=chunks,
    )

    assert len(assembled) == 1
    ctx = assembled[0]
    assert ctx.candidate_id == "cand_pbg_1"
    assert ctx.hydrated_context is not None
    assert "--- HYDRATED REFERENCE (Contract Data - Page 88) ---" in ctx.hydrated_context
    assert "3% of the accepted contract amount" in ctx.hydrated_context
    assert "contract_data:33.1" in ctx.referenced_clauses
