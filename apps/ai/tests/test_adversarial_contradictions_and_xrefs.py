from __future__ import annotations

import pytest

from tenderpulse_ai.domain.context_assembler import ContextAssembler
from tenderpulse_ai.domain.cross_reference_resolver import (
    CrossReferenceResolver,
)
from tenderpulse_ai.domain.models import (
    CandidatePassage,
    DoclingBlock,
    DoclingParsedDocument,
    DocumentStructureTree,
    ExecutionRulesProps,
    ProvenanceProps,
    SectionNode,
    VerifiedComplianceItem,
)
from tenderpulse_ai.domain.tender_chunker import TenderDocumentChunk
from tenderpulse_ai.extraction.contracts import DocumentExtractionRequest
from tenderpulse_ai.extraction.deduplication import (
    _are_items_contradictory,
    consolidate_verified_items,
    detect_clause_contradictions,
)
from tenderpulse_ai.security.context import SecurityContext


def _make_dummy_request(bid_id: str = "bid_adv_01") -> DocumentExtractionRequest:
    sec_ctx = SecurityContext(
        tenant_id="tenant_adv",
        user_id="user_adv",
        allowed_document_ids=["doc_adv_01"],
        workflow_run_id="run_adv_01",
    )
    return DocumentExtractionRequest(
        security_context=sec_ctx,
        bid_id=bid_id,
        document_id="doc_adv_01",
        file_name="adversarial_tender.pdf",
    )


# ==============================================================================
# MISSION 1: CONTRADICTION PRESERVATION & DYNAMIC ORDER OF PRECEDENCE
# ==============================================================================


@pytest.mark.parametrize(
    ("pbg_val_1", "pbg_val_2", "expected_contradiction"),
    [
        ("5%", "12%", True),
        ("2.5%", "7.5%", True),
        ("0.5%", "3.0%", True),
        ("15%", "15.0%", False),
        ("5%", "5.00%", False),
        ("3.5%", "3.50%", False),
        ("10%", "10.000%", False),
    ],
)
def test_adversarial_pbg_percentage_variations(
    pbg_val_1: str, pbg_val_2: str, expected_contradiction: bool
):
    """Stress-tests PBG anti-merge with hostile float variations, decimal places,

    and verifies that identical float representations never self-contradict.
    """
    req = _make_dummy_request()

    item1 = VerifiedComplianceItem(
        category="FINANCIAL",
        title="Performance Security (PBG) & Security Deposit",
        description=f"Submit PBG of {pbg_val_1} within 21 days.",
        execution_rules=ExecutionRulesProps(stamp_paper_required=True),
        provenance=ProvenanceProps(
            source_document_id="doc_adv_01",
            source_file_name="adversarial_tender.pdf",
            page_number=18,
            clause_reference="ITB Clause 38.1",
            verbatim_quote=f"The PBG amount shall be {pbg_val_1} of the contract price.",
            confidence_score=0.98,
        ),
    )

    item2 = VerifiedComplianceItem(
        category="FINANCIAL",
        title="Performance Security (PBG) & Security Deposit",
        description=f"Submit PBG of {pbg_val_2} post LOA.",
        execution_rules=ExecutionRulesProps(stamp_paper_required=True),
        provenance=ProvenanceProps(
            source_document_id="doc_adv_01",
            source_file_name="adversarial_tender.pdf",
            page_number=95,
            clause_reference="GCC Clause 59.2",
            verbatim_quote=f"The contractor shall provide PBG of {pbg_val_2} of contract value.",
            confidence_score=0.97,
        ),
    )

    is_contra = _are_items_contradictory(item1.to_api_payload(), item2.to_api_payload())
    assert is_contra is expected_contradiction

    consolidated = consolidate_verified_items([item1, item2], req)
    if expected_contradiction:
        # Must NOT merge
        assert len(consolidated) == 2
        quotes = [it["provenance"]["verbatimQuote"] for it in consolidated]
        assert any(pbg_val_1 in q for q in quotes)
        assert any(pbg_val_2 in q for q in quotes)
    else:
        # Same value stated in two sections (ITB p.18, GCC p.95): two clauses, each with its
        # own location identity, and no conflict between them.
        assert len(consolidated) == 2
        assert len({it["itemKey"] for it in consolidated}) == 2
        assert [it["provenance"]["clauseReference"] for it in consolidated] == [
            "ITB Clause 38.1",
            "GCC Clause 59.2",
        ]
        assert detect_clause_contradictions(consolidated) == []


def test_adversarial_pbg_dynamic_order_of_precedence_ruling():
    """Verifies that order-of-precedence rulings are strictly dynamically generated

    with zero static benchmark strings (no residual '33.1', '47.1', '3%').
    """
    item_bds = {
        "title": "Performance Security (PBG)",
        "description": "PBG 2.5%",
        "provenance": {
            "clauseReference": "BDS Sub-Clause 19.3",
            "pageNumber": 25,
            "verbatimQuote": "Performance Security shall be 2.5% of accepted contract amount.",
        },
    }
    item_gcc = {
        "title": "Performance Security (PBG)",
        "description": "PBG 7.5%",
        "provenance": {
            "clauseReference": "GCC Sub-Clause 64.1",
            "pageNumber": 110,
            "verbatimQuote": "Performance Security shall be 7.5% of contract price.",
        },
    }

    contradictions = detect_clause_contradictions([item_bds, item_gcc])
    assert len(contradictions) == 1
    contra = contradictions[0]
    ruling = contra["order_of_precedence_ruling"]

    # Must dynamically cite actual conflicting clauses and values
    assert "BDS Sub-Clause 19.3 (2.5%)" in ruling
    assert "GCC Sub-Clause 64.1 (7.5%)" in ruling
    assert "governs over" in ruling

    # ZERO hardcoded benchmark strings allowed
    assert "33.1" not in ruling
    assert "47.1" not in ruling
    assert "3%" not in ruling
    assert "10%" not in ruling


def test_adversarial_emd_vs_bsd_hostile_formats():
    """Stress-tests EMD monetary vs Bid Securing Declaration across Indian currency notations:

    'Rs.', 'INR', '₹', 'Crore', 'Lakh', and formatted numbers with commas.
    """
    req = _make_dummy_request()

    emd_variants = [
        "Earnest Money Deposit of ₹ 50,00,000/- in form of BG",
        "EMD of Rs. 2.50 Crores required with technical bid",
        "Bid Security amount of INR 75 Lakhs",
        "EMD of 1,25,00,000 deposited through RTGS",
    ]

    for emd_text in emd_variants:
        emd_item = VerifiedComplianceItem(
            category="FINANCIAL",
            title="Earnest Money Deposit (EMD) Guarantee",
            description=emd_text,
            execution_rules=ExecutionRulesProps(stamp_paper_required=True),
            provenance=ProvenanceProps(
                source_document_id="doc_adv_01",
                source_file_name="adversarial_tender.pdf",
                page_number=4,
                clause_reference="NIT Clause 2.1",
                verbatim_quote=emd_text,
                confidence_score=0.99,
            ),
        )

        bsd_item = VerifiedComplianceItem(
            category="FINANCIAL",
            title="Earnest Money Deposit (EMD) Guarantee",
            description="Submission of signed Bid Securing Declaration as per Annexure-IV.",
            execution_rules=ExecutionRulesProps(stamp_paper_required=True),
            provenance=ProvenanceProps(
                source_document_id="doc_adv_01",
                source_file_name="adversarial_tender.pdf",
                page_number=19,
                clause_reference="ITB Clause 15.3",
                verbatim_quote="In lieu of EMD, the bidder shall submit Bid Securing Declaration.",
                confidence_score=0.96,
            ),
        )

        # Anti-merge guard must trigger
        assert (
            _are_items_contradictory(emd_item.to_api_payload(), bsd_item.to_api_payload()) is True
        )

        consolidated = consolidate_verified_items([emd_item, bsd_item], req)
        assert len(consolidated) == 2

        # Contradiction detection must cite NIT and ITB clauses
        contradictions = detect_clause_contradictions(
            [emd_item.to_api_payload(), bsd_item.to_api_payload()]
        )
        assert len(contradictions) == 1
        ruling = contradictions[0]["order_of_precedence_ruling"]
        assert "NIT Clause 2.1" in ruling
        assert "ITB Clause 15.3" in ruling


def test_adversarial_gst_treatment_variations():
    """Stress-tests standard GST pricing treatment conflicts (inclusive vs exclusive)."""
    req = _make_dummy_request()

    gst_inc = VerifiedComplianceItem(
        category="COMMERCIAL",
        title="Taxes and Duties (GST)",
        description="The quoted contract price is inclusive of all taxes and GST.",
        execution_rules=ExecutionRulesProps(),
        provenance=ProvenanceProps(
            source_document_id="doc_adv_01",
            source_file_name="adversarial_tender.pdf",
            page_number=55,
            clause_reference="General Conditions Clause 14.1",
            verbatim_quote="Contract rates are inclusive of all taxes including GST.",
            confidence_score=0.95,
        ),
    )

    gst_exc = VerifiedComplianceItem(
        category="COMMERCIAL",
        title="Taxes and Duties (GST)",
        description="Rates shall be exclusive of GST which shall be reimbursed at actuals.",
        execution_rules=ExecutionRulesProps(),
        provenance=ProvenanceProps(
            source_document_id="doc_adv_01",
            source_file_name="adversarial_tender.pdf",
            page_number=22,
            clause_reference="Section 2 Instructions Clause 7.2",
            verbatim_quote="Prices quoted shall be exclusive of GST applicable on works.",
            confidence_score=0.97,
        ),
    )

    assert _are_items_contradictory(gst_inc.to_api_payload(), gst_exc.to_api_payload()) is True

    consolidated = consolidate_verified_items([gst_inc, gst_exc], req)
    assert len(consolidated) == 2

    contradictions = detect_clause_contradictions(
        [gst_inc.to_api_payload(), gst_exc.to_api_payload()]
    )
    assert len(contradictions) == 1
    ruling = contradictions[0]["order_of_precedence_ruling"]
    assert "Section 2 Instructions Clause 7.2" in ruling
    assert "General Conditions Clause 14.1" in ruling


def test_adversarial_gst_treatment_intervening_words():
    """Tests GST anti-merge when phrases have intervening words like

    'inclusive of all statutory levies and GST' or 'exclusive of applicable GST'.
    Reveals whether rigid regex fails to detect contradiction.
    """
    req = _make_dummy_request()

    gst_inc = VerifiedComplianceItem(
        category="COMMERCIAL",
        title="Taxes and Duties (GST)",
        description="Prices are inclusive of all statutory levies and GST.",
        execution_rules=ExecutionRulesProps(),
        provenance=ProvenanceProps(
            source_document_id="doc_adv_01",
            source_file_name="adversarial_tender.pdf",
            page_number=55,
            clause_reference="General Conditions Clause 14.1",
            verbatim_quote="Prices are inclusive of all statutory levies and GST.",
            confidence_score=0.95,
        ),
    )

    gst_exc = VerifiedComplianceItem(
        category="COMMERCIAL",
        title="Taxes and Duties (GST)",
        description="Prices are exclusive of applicable GST.",
        execution_rules=ExecutionRulesProps(),
        provenance=ProvenanceProps(
            source_document_id="doc_adv_01",
            source_file_name="adversarial_tender.pdf",
            page_number=22,
            clause_reference="Section 2 Instructions Clause 7.2",
            verbatim_quote="Prices are exclusive of applicable GST.",
            confidence_score=0.97,
        ),
    )

    assert _are_items_contradictory(gst_inc.to_api_payload(), gst_exc.to_api_payload()) is True
    consolidated = consolidate_verified_items([gst_inc, gst_exc], req)
    assert len(consolidated) == 2


# ==============================================================================
# MISSION 2: TABLE QUOTE SEVERING & CANARA BANK COORDINATES
# ==============================================================================


# ==============================================================================
# MISSION 3: CROSS-REFERENCE HYDRATION ADVERSARIAL STRESS TESTING
# ==============================================================================


def test_adversarial_cross_reference_cyclic_linking():
    """Challenges CrossReferenceResolver with cyclic cross-references

    (Chunk A -> Chunk B -> Chunk A) to verify termination and clean bidirectional resolution.
    """
    resolver = CrossReferenceResolver()

    # Chunk A (Contract Data) referencing Appendix
    chunk_cd = TenderDocumentChunk(
        id="chk_cd_45",
        chunk_index=0,
        chunk_type="CLAUSE",
        clause_reference="45.1",
        section_title="Contract Data",
        canonical_ref_id="contract_data:45.1",
        page_number=88,
        content="Contract Data Clause 45.1: Liquidated damages as specified in Appendix 2.1.",
        verbatim_text="Liquidated damages as specified in Appendix 2.1.",
    )

    # Chunk B (Appendix) referencing Contract Data
    chunk_app = TenderDocumentChunk(
        id="chk_app_2",
        chunk_index=1,
        chunk_type="CLAUSE",
        clause_reference="2.1",
        section_title="Appendix to ITB",
        canonical_ref_id="appendix:2.1",
        page_number=23,
        content="Appendix 2.1: Liquidated damages apply per Contract Data Clause 45.1 at 0.05% per day.",
        verbatim_text="Liquidated damages apply per Contract Data Clause 45.1 at 0.05% per day.",
    )

    # Indexing must not loop indefinitely
    resolver.index_chunks([chunk_cd, chunk_app])

    # Outbound and inbound links for both
    out_cd, in_cd = resolver.resolve_references("contract_data:45.1")
    assert "appendix:2.1" in out_cd
    assert "appendix:2.1" in in_cd

    out_app, in_app = resolver.resolve_references("appendix:2.1")
    assert "contract_data:45.1" in out_app
    assert "contract_data:45.1" in in_app

    # Hydration must terminate and inject 1-hop context without recursion
    hydrated_cd = resolver.hydrate_context(chunk_cd, "Evaluating LDs under CD 45.1")
    assert "Evaluating LDs under CD 45.1" in hydrated_cd
    assert "Appendix to ITB - Page 23" in hydrated_cd
    assert "0.05% per day" in hydrated_cd

    hydrated_app = resolver.hydrate_context(chunk_app, "Evaluating LDs under App 2.1")
    assert "Evaluating LDs under App 2.1" in hydrated_app
    assert "Contract Data - Page 88" in hydrated_app


def test_adversarial_cross_reference_self_referencing_guard():
    """Challenges CrossReferenceResolver with chunks that mention their own section

    or clause number to verify anti-self-referencing guarantees.
    """
    resolver = CrossReferenceResolver()

    # Chunk in Contract Data mentioning "Contract Data Clause 33.1"
    chunk_cd_self = TenderDocumentChunk(
        id="chk_cd_33",
        chunk_index=0,
        chunk_type="CLAUSE",
        clause_reference="33.1",
        section_title="Contract Data",
        canonical_ref_id="contract_data:33.1",
        page_number=88,
        content="Contract Data Clause 33.1: Performance Security under Contract Data Clause 33.1 is 3%.",
        verbatim_text="Performance Security under Contract Data Clause 33.1 is 3%.",
    )

    # Chunk in NIT mentioning "Notice Inviting Tender"
    chunk_nit_self = TenderDocumentChunk(
        id="chk_nit_1",
        chunk_index=1,
        chunk_type="CLAUSE",
        clause_reference="1.1",
        section_title="Notice Inviting Tender",
        canonical_ref_id="nit:1.1",
        page_number=3,
        content="Notice Inviting Tender Clause 1.1: Earnest Money Deposit under Notice Inviting Tender is Rs. 5 Crores.",
        verbatim_text="Earnest Money Deposit under Notice Inviting Tender is Rs. 5 Crores.",
    )

    resolver.index_chunks([chunk_cd_self, chunk_nit_self])

    # Must NOT discover self-references
    out_cd, in_cd = resolver.resolve_references("contract_data:33.1")
    assert out_cd == []
    assert in_cd == []

    out_nit, in_nit = resolver.resolve_references("nit:1.1")
    assert out_nit == []
    assert in_nit == []

    # Hydrated context should remain untouched
    base_cd = "Base CD content"
    assert resolver.hydrate_context(chunk_cd_self, base_cd) == base_cd

    base_nit = "Base NIT content"
    assert resolver.hydrate_context(chunk_nit_self, base_nit) == base_nit


def test_adversarial_cross_reference_within_same_section_when_canonical_id_is_none():
    """Tests chunks where canonical_ref_id is None on the chunk object.

    Verifies whether chunks within the same section (e.g. NIT or Contract Data)
    erroneously link to other chunks in the same section as cross-references.
    """
    resolver = CrossReferenceResolver()

    chunk_nit_1 = TenderDocumentChunk(
        id="chk_nit_1",
        chunk_index=0,
        chunk_type="CLAUSE",
        clause_reference="1.1",
        section_title="Notice Inviting Tender",
        canonical_ref_id=None,
        page_number=3,
        content="Notice Inviting Tender Clause 1.1: Earnest Money Deposit is Rs. 5 Crores as per Notice Inviting Tender Table.",
        verbatim_text="Earnest Money Deposit is Rs. 5 Crores.",
    )

    chunk_nit_2 = TenderDocumentChunk(
        id="chk_nit_2",
        chunk_index=1,
        chunk_type="CLAUSE",
        clause_reference="1.2",
        section_title="Notice Inviting Tender",
        canonical_ref_id=None,
        page_number=4,
        content="Notice Inviting Tender Clause 1.2: Tender Fee is Rs. 10,000.",
        verbatim_text="Tender Fee is Rs. 10,000.",
    )

    resolver.index_chunks([chunk_nit_1, chunk_nit_2])

    out_1, in_1 = resolver.resolve_references("nit:1.1")
    # NIT clause 1.1 should NOT link to NIT clause 1.2 as an external cross-reference!
    assert out_1 == [], f"NIT chunk erroneously linked within its own section: {out_1}"


def test_adversarial_cross_reference_missing_target_clauses():
    """Challenges CrossReferenceResolver when clauses reference non-existent sections or clauses."""
    resolver = CrossReferenceResolver()

    chunk_orphan = TenderDocumentChunk(
        id="chk_itb_orphan",
        chunk_index=0,
        chunk_type="CLAUSE",
        clause_reference="99.1",
        section_title="Instructions to Bidders",
        canonical_ref_id="clause:99.1",
        page_number=40,
        content="Clause 99.1: Refer to Contract Data Clause 999.1 for warranty bond stipulations.",
        verbatim_text="Refer to Contract Data Clause 999.1 for warranty bond stipulations.",
    )

    # Index only the orphan chunk with no Contract Data available
    resolver.index_chunks([chunk_orphan])

    out_orphan, in_orphan = resolver.resolve_references("clause:99.1")
    assert out_orphan == []
    assert in_orphan == []

    # Hydration should return base context cleanly without crashing
    hydrated = resolver.hydrate_context(chunk_orphan, "Initial orphan context")
    assert hydrated == "Initial orphan context"


def test_adversarial_context_assembler_end_to_end_hydration():
    """End-to-end stress test of ContextAssembler with cross-reference resolver

    handling mixed references: one resolved, one orphan, and one self-mention.
    """
    doc = DoclingParsedDocument(
        document_id="doc_adv_e2e",
        file_name="adv_tender.pdf",
        pages=[
            {"page_number": 12, "char_count": 300},
            {"page_number": 88, "char_count": 300},
            {"page_number": 50, "char_count": 300},
        ],
        blocks=[
            DoclingBlock(
                block_id="blk_1",
                type="paragraph",
                text="The Contractor shall submit Performance Security as specified in Contract Data Clause 33.1.",
                page_number=12,
            ),
            DoclingBlock(
                block_id="blk_2",
                type="paragraph",
                text="Contract Data Clause 33.1: Performance Security is 3% of contract value.",
                page_number=88,
            ),
            DoclingBlock(
                block_id="blk_3",
                type="paragraph",
                text="Clause 77.1: Warranty provisions as per Appendix 99.1.",
                page_number=50,
            ),
        ],
        tables=[],
    )

    tree = DocumentStructureTree(
        document_id="doc_adv_e2e",
        nodes=[
            SectionNode(
                node_id="sec_1",
                number="33.1",
                title="Performance Security",
                level=2,
                block_ids=["blk_1"],
            ),
            SectionNode(
                node_id="sec_2",
                number="33.1",
                title="Contract Data Clause 33.1",
                level=2,
                block_ids=["blk_2"],
            ),
            SectionNode(
                node_id="sec_3",
                number="77.1",
                title="Warranty Clause 77.1",
                level=2,
                block_ids=["blk_3"],
            ),
        ],
    )

    chunks = [
        TenderDocumentChunk(
            id="chk_itb_33",
            chunk_index=0,
            chunk_type="CLAUSE",
            clause_reference="33.1",
            section_title="Instructions to Bidders",
            canonical_ref_id="clause:33.1",
            page_number=12,
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
            content="Contract Data Clause 33.1: Performance Security is 3% of contract value.",
            verbatim_text="Contract Data Clause 33.1: Performance Security is 3% of contract value.",
        ),
        TenderDocumentChunk(
            id="chk_itb_77",
            chunk_index=2,
            chunk_type="CLAUSE",
            clause_reference="77.1",
            section_title="Instructions to Bidders",
            canonical_ref_id="clause:77.1",
            page_number=50,
            content="Clause 77.1: Warranty provisions as per Appendix 99.1.",
            verbatim_text="Clause 77.1: Warranty provisions as per Appendix 99.1.",
        ),
    ]

    candidates = [
        CandidatePassage(
            candidate_id="cand_1",
            section_number="33.1",
            section_path="ITB > PBG",
            text="The Contractor shall submit Performance Security as specified in Contract Data Clause 33.1.",
            page_number=12,
            block_id="blk_1",
            matched_rules=["financial_pbg"],
        ),
        CandidatePassage(
            candidate_id="cand_2",
            section_number="77.1",
            section_path="ITB > Warranty",
            text="Clause 77.1: Warranty provisions as per Appendix 99.1.",
            page_number=50,
            block_id="blk_3",
            matched_rules=["operational_warranty"],
        ),
    ]

    assembler = ContextAssembler()
    assembled = assembler.assemble_contexts(
        doc=doc,
        tree=tree,
        candidates=candidates,
        chunks=chunks,
    )

    assert len(assembled) == 2

    # cand_1 must have hydrated Contract Data context
    c1 = next(c for c in assembled if c.candidate_id == "cand_1")
    assert c1.hydrated_context is not None
    assert "--- HYDRATED REFERENCE (Contract Data - Page 88) ---" in c1.hydrated_context
    assert "Performance Security is 3% of contract value" in c1.hydrated_context
    assert "contract_data:33.1" in c1.referenced_clauses

    # cand_2 (orphan reference to missing Appendix 99.1) must assemble cleanly without failure
    c2 = next(c for c in assembled if c.candidate_id == "cand_2")
    assert c2.candidate_id == "cand_2"
    assert c2.hydrated_context is None
    # Text mentions are captured by regex, but no canonical cross-reference link was resolved
    assert "appendix:99.1" not in c2.referenced_clauses
