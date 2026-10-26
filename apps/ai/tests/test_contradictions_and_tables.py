from __future__ import annotations

from tenderpulse_ai.domain.models import (
    ExecutionRulesProps,
    ProvenanceProps,
    VerifiedComplianceItem,
)
from tenderpulse_ai.extraction.contracts import DocumentExtractionRequest
from tenderpulse_ai.extraction.deduplication import (
    _are_items_contradictory,
    consolidate_verified_items,
    detect_clause_contradictions,
)
from tenderpulse_ai.security.context import SecurityContext


def _dummy_request() -> DocumentExtractionRequest:
    sec_ctx = SecurityContext(
        tenant_id="tenant_nhai",
        user_id="user_test",
        allowed_document_ids=["doc_nhai_101"],
        workflow_run_id="run_contra_01",
    )
    return DocumentExtractionRequest(
        security_context=sec_ctx,
        bid_id="bid_nhai_101",
        document_id="doc_nhai_101",
        file_name="nhai_tender.pdf",
    )


def test_deduplication_anti_merge_guards_pbg():
    req = _dummy_request()

    # 1. PBG 3% (ITB Clause 33.1) vs PBG 10% (GCC Clause 47.1)
    pbg_3pct = VerifiedComplianceItem(
        category="FINANCIAL",
        title="Performance Security (PBG) & Security Deposit",
        description="Submission of Performance Security / Bank Guarantee of 3% of contract price within 28 days post Letter of Acceptance.",
        execution_rules=ExecutionRulesProps(
            stamp_paper_required=True, stamp_paper_denomination_inr=100
        ),
        provenance=ProvenanceProps(
            source_document_id="doc_nhai_101",
            source_file_name="nhai_tender.pdf",
            page_number=14,
            clause_reference="ITB Clause 33.1",
            verbatim_quote="The successful bidder shall submit Performance Security (PBG) equal to 3% of the contract value within 28 days.",
            confidence_score=0.99,
        ),
    )

    pbg_10pct = VerifiedComplianceItem(
        category="FINANCIAL",
        title="Performance Security (PBG) & Security Deposit",
        description="Submission of Performance Security / Bank Guarantee of 10% of contract price post Letter of Acceptance.",
        execution_rules=ExecutionRulesProps(
            stamp_paper_required=True, stamp_paper_denomination_inr=100
        ),
        provenance=ProvenanceProps(
            source_document_id="doc_nhai_101",
            source_file_name="nhai_tender.pdf",
            page_number=88,
            clause_reference="GCC Clause 47.1",
            verbatim_quote="The contractor shall provide Performance Security of 10% of the contract price for due performance.",
            confidence_score=0.98,
        ),
    )

    # Verify anti-merge detector identifies them as contradictory
    assert _are_items_contradictory(pbg_3pct.to_api_payload(), pbg_10pct.to_api_payload()) is True

    # Consolidate items: both items must be preserved, NOT merged into one
    consolidated = consolidate_verified_items([pbg_3pct, pbg_10pct], req)
    assert len(consolidated) == 2
    quotes = [it["provenance"]["verbatimQuote"] for it in consolidated]
    assert any("3%" in q for q in quotes)
    assert any("10%" in q for q in quotes)


def test_deduplication_anti_merge_guards_emd_vs_bsd():
    req = _dummy_request()

    # 2. Monetary EMD (NIT 1.1) vs Bid Securing Declaration (ITB 14.2)
    emd_monetary = VerifiedComplianceItem(
        category="FINANCIAL",
        title="Tender & Bid Security (EMD) Guarantee",
        description="Submission of Earnest Money Deposit / Bid Security of Rs. 7.18 Crores.",
        execution_rules=ExecutionRulesProps(stamp_paper_required=True),
        provenance=ProvenanceProps(
            source_document_id="doc_nhai_101",
            source_file_name="nhai_tender.pdf",
            page_number=3,
            clause_reference="NIT Clause 1.1",
            verbatim_quote="The bidder shall furnish Earnest Money Deposit of Rs. 7.18 Crores in the form of Bank Guarantee.",
            confidence_score=0.99,
        ),
    )

    bsd_declaration = VerifiedComplianceItem(
        category="FINANCIAL",
        title="Tender & Bid Security (EMD) Guarantee",
        description="Submission of Bid Securing Declaration in the prescribed format in lieu of monetary Earnest Money Deposit.",
        execution_rules=ExecutionRulesProps(stamp_paper_required=True),
        provenance=ProvenanceProps(
            source_document_id="doc_nhai_101",
            source_file_name="nhai_tender.pdf",
            page_number=12,
            clause_reference="ITB Clause 14.2",
            verbatim_quote="The bidder shall submit a signed Bid Securing Declaration in lieu of EMD as per format.",
            confidence_score=0.97,
        ),
    )

    assert (
        _are_items_contradictory(emd_monetary.to_api_payload(), bsd_declaration.to_api_payload())
        is True
    )

    consolidated = consolidate_verified_items([emd_monetary, bsd_declaration], req)
    assert len(consolidated) == 2
    descs = [it["description"] for it in consolidated]
    assert any("7.18 Crores" in d for d in descs)
    assert any("Bid Securing Declaration" in d for d in descs)


def test_deduplication_anti_merge_guards_gst_inclusive_vs_exclusive():
    req = _dummy_request()

    # 3. GST Pricing Treatment: Inclusive vs Exclusive
    gst_inclusive = VerifiedComplianceItem(
        category="COMMERCIAL",
        title="GST and Statutory Taxes",
        description="Rates quoted shall include all statutory duties and GST.",
        execution_rules=ExecutionRulesProps(),
        provenance=ProvenanceProps(
            source_document_id="doc_nhai_101",
            source_file_name="nhai_tender.pdf",
            page_number=45,
            clause_reference="GCC Clause 12.1",
            verbatim_quote="The Contract Price is inclusive of all taxes and GST applicable under Indian law.",
            confidence_score=0.95,
        ),
    )

    gst_exclusive = VerifiedComplianceItem(
        category="COMMERCIAL",
        title="GST and Statutory Taxes",
        description="Bid price is exclusive of GST which will be reimbursed separately.",
        execution_rules=ExecutionRulesProps(),
        provenance=ProvenanceProps(
            source_document_id="doc_nhai_101",
            source_file_name="nhai_tender.pdf",
            page_number=20,
            clause_reference="ITB Clause 18.3",
            verbatim_quote="The rates quoted by bidder shall be exclusive of GST which shall be paid extra as applicable.",
            confidence_score=0.96,
        ),
    )

    assert (
        _are_items_contradictory(gst_inclusive.to_api_payload(), gst_exclusive.to_api_payload())
        is True
    )

    consolidated = consolidate_verified_items([gst_inclusive, gst_exclusive], req)
    assert len(consolidated) == 2


def test_deduplication_merges_non_contradictory_items_across_pages():
    req = _dummy_request()

    item_page_10 = VerifiedComplianceItem(
        category="FINANCIAL",
        title="Annual Turnover Requirement",
        description="Turnover of Rs. 50 Crores in preceding 5 years.",
        execution_rules=ExecutionRulesProps(udin_required=False),
        provenance=ProvenanceProps(
            source_document_id="doc_nhai_101",
            source_file_name="nhai_tender.pdf",
            page_number=10,
            clause_reference="Clause 4.2",
            verbatim_quote="The bidder must have an average annual turnover of Rs. 50 Crores across 5 years.",
            confidence_score=0.94,
        ),
    )

    item_page_15 = VerifiedComplianceItem(
        category="FINANCIAL",
        title="Annual Turnover Requirement",
        description="Turnover of Rs. 50 Crores certified by Chartered Accountant with UDIN.",
        execution_rules=ExecutionRulesProps(udin_required=True),
        provenance=ProvenanceProps(
            source_document_id="doc_nhai_101",
            source_file_name="nhai_tender.pdf",
            page_number=15,
            clause_reference="Clause 4.2",
            verbatim_quote="The bidder must have an average annual turnover of Rs. 50 Crores across 5 years.",
            confidence_score=0.98,
        ),
    )

    # Should safely fuse rules and merge supporting pages
    consolidated = consolidate_verified_items([item_page_10, item_page_15], req)
    assert len(consolidated) == 1
    merged = consolidated[0]
    assert merged["executionRules"]["udinRequired"] is True
    assert "Pages 10, 15" in merged["provenance"]["clauseReference"]


def test_detect_clause_contradictions_float_normalization():
    # 1. 10% vs 10.0% should NOT self-contradict
    item_10pct = {
        "title": "Performance Security (PBG)",
        "description": "Submit PBG of 10% within 28 days.",
        "provenance": {
            "clauseReference": "GCC Clause 47.1",
            "pageNumber": 88,
            "verbatimQuote": "The performance security shall be 10% of contract price.",
        },
    }

    item_10_0pct = {
        "title": "Performance Security (PBG)",
        "description": "Submit PBG of 10.0% within 28 days.",
        "provenance": {
            "clauseReference": "Contract Data Clause 47.1",
            "pageNumber": 89,
            "verbatimQuote": "The performance security amount shall be 10.0% of contract price.",
        },
    }

    contradictions_same = detect_clause_contradictions([item_10pct, item_10_0pct])
    assert contradictions_same == []

    # 2. 10.00% vs 10% should NOT self-contradict
    item_10_00pct = {
        "title": "Performance Security (PBG)",
        "description": "Submit PBG of 10.00%.",
        "provenance": {
            "clauseReference": "SCC Clause 47.1",
            "pageNumber": 90,
            "verbatimQuote": "PBG shall be 10.00% of price.",
        },
    }
    assert detect_clause_contradictions([item_10pct, item_10_00pct]) == []

    # 3. 3% vs 10% MUST trigger contradiction
    item_3pct = {
        "title": "Performance Security (PBG)",
        "description": "Submit PBG of 3%.",
        "provenance": {
            "clauseReference": "ITB Clause 33.1",
            "pageNumber": 14,
            "verbatimQuote": "The performance security shall be 3% of contract value.",
        },
    }
    contradictions_diff = detect_clause_contradictions([item_3pct, item_10pct])
    assert len(contradictions_diff) == 1
    assert contradictions_diff[0]["topic"] == "Performance Security (PBG) Percentage Conflict"


def test_dynamic_order_of_precedence_rulings():
    # 1. Benchmark scenario: ITB 33.1 (3%) vs GCC 47.1 (10%)
    item_itb_3 = {
        "title": "Performance Security (PBG)",
        "description": "PBG 3%",
        "provenance": {
            "clauseReference": "ITB Clause 33.1",
            "pageNumber": 14,
            "verbatimQuote": "Submit PBG of 3%.",
        },
    }
    item_gcc_10 = {
        "title": "Performance Security (PBG)",
        "description": "PBG 10%",
        "provenance": {
            "clauseReference": "GCC Clause 47.1",
            "pageNumber": 88,
            "verbatimQuote": "Submit PBG of 10%.",
        },
    }
    res_bench = detect_clause_contradictions([item_itb_3, item_gcc_10])
    assert len(res_bench) == 1
    ruling_bench = res_bench[0]["order_of_precedence_ruling"]
    assert "ITB Clause 33.1 (3%)" in ruling_bench
    assert "GCC Clause 47.1 (10%)" in ruling_bench
    assert "governs over" in ruling_bench

    # 2. Arbitrary non-benchmark scenario: BDS Clause 18.2 (5%) vs GCC Clause 52.1 (12%)
    # Verifies rulings are generated dynamically and do NOT contain static hardcoded benchmark strings
    item_bds_5 = {
        "title": "Performance Security (PBG)",
        "description": "PBG 5%",
        "provenance": {
            "clauseReference": "BDS Clause 18.2",
            "pageNumber": 22,
            "verbatimQuote": "The PBG is 5% of bid amount.",
        },
    }
    item_gcc_12 = {
        "title": "Performance Security (PBG)",
        "description": "PBG 12%",
        "provenance": {
            "clauseReference": "GCC Clause 52.1",
            "pageNumber": 95,
            "verbatimQuote": "The PBG shall be 12% of total price.",
        },
    }
    res_arbitrary = detect_clause_contradictions([item_bds_5, item_gcc_12])
    assert len(res_arbitrary) == 1
    ruling_arb = res_arbitrary[0]["order_of_precedence_ruling"]
    assert "BDS Clause 18.2 (5%)" in ruling_arb
    assert "GCC Clause 52.1 (12%)" in ruling_arb
    # Asserts no residual hardcoded benchmark values from other tenders
    assert "33.1" not in ruling_arb
    assert "47.1" not in ruling_arb
    assert "3%" not in ruling_arb

    # 3. Dynamic ruling for EMD vs BSD
    emd_item = {
        "title": "Earnest Money Deposit",
        "description": "EMD Rs. 5 Crores",
        "provenance": {
            "clauseReference": "NIT Clause 1.1",
            "pageNumber": 3,
            "verbatimQuote": "EMD of Rs. 5 Crores required.",
        },
    }
    bsd_item = {
        "title": "Bid Security",
        "description": "Bid Securing Declaration format",
        "provenance": {
            "clauseReference": "ITB Clause 14.2",
            "pageNumber": 12,
            "verbatimQuote": "Furnish Bid Securing Declaration.",
        },
    }
    res_emd = detect_clause_contradictions([emd_item, bsd_item])
    assert len(res_emd) == 1
    ruling_emd = res_emd[0]["order_of_precedence_ruling"]
    assert "NIT Clause 1.1" in ruling_emd
    assert "ITB Clause 14.2" in ruling_emd
    assert "governs over" in ruling_emd

    # 4. Dynamic ruling for GST
    gst_inc = {
        "title": "GST Treatment",
        "description": "Taxes",
        "provenance": {
            "clauseReference": "General Conditions Clause 12.1",
            "pageNumber": 50,
            "verbatimQuote": "Rates are inclusive of all taxes and GST.",
        },
    }
    gst_exc = {
        "title": "GST Treatment",
        "description": "Taxes",
        "provenance": {
            "clauseReference": "Financial Proposal Notes Clause 4.1",
            "pageNumber": 22,
            "verbatimQuote": "Price is exclusive of GST.",
        },
    }
    res_gst = detect_clause_contradictions([gst_inc, gst_exc])
    assert len(res_gst) == 1
    ruling_gst = res_gst[0]["order_of_precedence_ruling"]
    assert "Financial Proposal Notes Clause 4.1" in ruling_gst
    assert "General Conditions Clause 12.1" in ruling_gst
