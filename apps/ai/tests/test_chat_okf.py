from __future__ import annotations

import pytest

from tenderpulse_ai.chat.okf_registry import (
    clear_okf_registry,
    get_tender_okf,
    register_tender_okf,
)
from tenderpulse_ai.chat.schemas import CitationSourceType
from tenderpulse_ai.chat.workflow import (
    ChatWorkflowState,
    _synthesize_deterministic_template,
    citation_generation_node,
    tool_calling_node,
)
from tenderpulse_ai.extraction.okf_compiler import OKFBundle, OKFConceptNode
from tenderpulse_ai.security.context import SecurityContext


@pytest.fixture(autouse=True)
def clean_registry():
    clear_okf_registry()
    yield
    clear_okf_registry()


def _make_sample_bundle(tender_id: str = "bid_test_101") -> OKFBundle:
    pbg_node = OKFConceptNode(
        id="okf_financial_performance_security",
        canonical_ref_id="financial:pbg_3pct",
        category="FINANCIAL",
        title="Performance Security (PBG) Requirement",
        is_mandatory=True,
        status="VERIFIED",
        metrics={"percentage": 3.0, "deadline_days": 28},
        cross_references={"contract_data": ["contract_data:33.1"]},
        provenance={
            "sourceDocumentId": "doc_nhai_rfp",
            "sourceFileName": "NHAI_RFP_Highway.pdf",
            "pageNumber": 4,
            "clauseReference": "Clause 33.1",
            "confidenceScore": 0.99,
        },
        execution_rules={
            "stampPaperRequired": True,
            "stampPaperDenominationInr": 100,
            "notarizationRequired": True,
        },
        contradictions=[],
        description="The successful bidder must furnish 3% Performance Bank Guarantee within 28 days of LOA.",
        verbatim_quote="The contractor shall submit an irrevocable Performance Security equal to 3% of the contract value.",
    )

    emd_node = OKFConceptNode(
        id="okf_financial_earnest_money",
        canonical_ref_id="financial:emd_7cr",
        category="FINANCIAL",
        title="Earnest Money Deposit (EMD)",
        is_mandatory=True,
        status="VERIFIED",
        metrics={"monetary_amount": 7.18, "currency": "INR Crores"},
        cross_references={"nit": ["nit:1.1"]},
        provenance={
            "sourceDocumentId": "doc_nhai_rfp",
            "sourceFileName": "NHAI_RFP_Highway.pdf",
            "pageNumber": 12,
            "clauseReference": "Clause 14.1",
            "confidenceScore": 0.98,
        },
        execution_rules={
            "stampPaperRequired": False,
            "notarizationRequired": False,
        },
        contradictions=[],
        description="Bidder must submit an Earnest Money Deposit of Rs. 7.18 Crores in the form of Bank Guarantee.",
        verbatim_quote="The bidder shall furnish an Earnest Money Deposit (EMD) of Rs. 7.18 Crores.",
    )

    return OKFBundle(
        tender_id=tender_id,
        index_markdown="# Tender OKF Knowledge Graph\n- PBG Requirement\n- EMD Requirement",
        nodes={
            pbg_node.id: pbg_node,
            emd_node.id: emd_node,
        },
    )


def test_okf_registry_in_memory_storage():
    bundle = _make_sample_bundle("bid_alpha")

    # Initial state should be empty
    assert get_tender_okf("bid_alpha") is None
    assert get_tender_okf(None) is None
    assert get_tender_okf("") is None

    # Register and verify lookup
    register_tender_okf("bid_alpha", bundle)
    retrieved = get_tender_okf("bid_alpha")
    assert retrieved is not None
    assert retrieved.tender_id == "bid_alpha"
    assert len(retrieved.nodes) == 2
    assert "okf_financial_performance_security" in retrieved.nodes

    # Clear registry
    clear_okf_registry()
    assert get_tender_okf("bid_alpha") is None


def test_tool_calling_okf_concept_lookup_before_search():
    bundle = _make_sample_bundle("bid_test_101")
    register_tender_okf("bid_test_101", bundle)

    sec_ctx = SecurityContext(
        tenant_id="tenant_nhai",
        user_id="user_test",
        allowed_document_ids=["doc_nhai_rfp"],
        workflow_run_id="run_okf_01",
    )

    # 1. Query matching PBG should prioritize the PBG node from OKF
    state_pbg: ChatWorkflowState = {
        "query": "What is the PBG Performance Security requirement?",
        "bid_id": "bid_test_101",
        "company_id": "comp_01",
        "conversation_id": "conv_01",
        "tools_to_call": [],
        "tool_args": {},
        "security_context": sec_ctx,
        "context": {},
    }

    result = tool_calling_node(state_pbg)
    evidence = result.get("retrieved_evidence", [])
    assert len(evidence) >= 1

    okf_hits = [e for e in evidence if e.get("type") == "OKF_CONCEPT"]
    assert len(okf_hits) >= 1
    top_hit = okf_hits[0]
    assert top_hit["data"]["id"] == "okf_financial_performance_security"
    assert "3%" in top_hit["data"]["verbatim_quote"]
    assert top_hit["score"] > 0

    # 2. Query matching EMD should retrieve EMD OKF concept node
    state_emd: ChatWorkflowState = {
        "query": "How much Earnest Money Deposit is required for the bid?",
        "bid_id": "bid_test_101",
        "company_id": "comp_01",
        "conversation_id": "conv_02",
        "tools_to_call": [],
        "tool_args": {},
        "security_context": sec_ctx,
        "context": {},
    }

    result_emd = tool_calling_node(state_emd)
    okf_emd_hits = [
        e for e in result_emd.get("retrieved_evidence", []) if e.get("type") == "OKF_CONCEPT"
    ]
    assert len(okf_emd_hits) >= 1
    assert okf_emd_hits[0]["data"]["id"] == "okf_financial_earnest_money"
    assert "7.18 Crores" in okf_emd_hits[0]["data"]["verbatim_quote"]


def test_tool_calling_without_registered_okf():
    sec_ctx = SecurityContext(
        tenant_id="tenant_nhai",
        user_id="user_test",
        allowed_document_ids=["doc_none"],
        workflow_run_id="run_no_okf",
    )
    state: ChatWorkflowState = {
        "query": "What is the PBG requirement?",
        "bid_id": "bid_unregistered",
        "company_id": "comp_01",
        "conversation_id": "conv_03",
        "tools_to_call": [],
        "tool_args": {},
        "security_context": sec_ctx,
        "context": {},
    }
    result = tool_calling_node(state)
    assert result["retrieved_evidence"] == []


def test_dual_provenance_citations_in_workflow():
    state: ChatWorkflowState = {
        "query": "What are the PBG rules and our corporate credentials?",
        "bid_id": "bid_test_101",
        "retrieved_evidence": [
            {
                "type": "OKF_CONCEPT",
                "data": {
                    "id": "okf_financial_pbg",
                    "title": "Performance Security (PBG)",
                    "category": "FINANCIAL",
                    "verbatim_quote": "The contractor shall submit PBG of 3% within 28 days.",
                    "canonical_ref_id": "financial:pbg",
                    "provenance": {
                        "sourceDocumentId": "doc_tender_rfp",
                        "sourceFileName": "NHAI_RFP.pdf",
                        "pageNumber": 4,
                        "clauseReference": "Clause 33.1",
                        "confidenceScore": 0.99,
                    },
                },
            },
            {
                "type": "TENDER",
                "data": {
                    "documentId": "doc_tender_rfp",
                    "documentName": "NHAI_RFP.pdf",
                    "pageNumber": 5,
                    "clauseReference": "Clause 33.2",
                    "content": "Failure to provide PBG shall cause annulment of award.",
                    "confidenceScore": 0.98,
                },
            },
            {
                "type": "EVIDENCE",
                "data": {
                    "documentId": "doc_vault_ca",
                    "documentName": "Audited_Turnover_FY23.pdf",
                    "pageNumber": 1,
                    "evidenceType": "CA Certificate",
                    "content": "Audited Annual Turnover of ABC Infra Ltd is INR 62.5 Crores.",
                    "confidenceScore": 0.96,
                },
            },
        ],
    }

    result = citation_generation_node(state)
    citations = result.get("citations", [])
    assert len(citations) == 3

    # 1. OKF Concept Citation -> TENDER_DOCUMENT provenance
    cit_okf = next(c for c in citations if c.citation_id.startswith("cit-okf-"))
    assert cit_okf.source_type == CitationSourceType.TENDER_DOCUMENT
    assert cit_okf.document_name == "NHAI_RFP.pdf"
    assert cit_okf.page_number == 4
    assert cit_okf.clause_reference == "Clause 33.1"
    assert "PBG of 3%" in cit_okf.verbatim_quote

    # 2. Raw Tender Chunk Citation -> TENDER_DOCUMENT provenance
    cit_tender = next(c for c in citations if c.citation_id.startswith("cit-tender-"))
    assert cit_tender.source_type == CitationSourceType.TENDER_DOCUMENT
    assert cit_tender.document_name == "NHAI_RFP.pdf"
    assert cit_tender.page_number == 5
    assert cit_tender.clause_reference == "Clause 33.2"

    # 3. Company Vault Evidence Citation -> COMPANY_EVIDENCE provenance
    cit_ev = next(c for c in citations if c.citation_id.startswith("cit-evidence-"))
    assert cit_ev.source_type == CitationSourceType.COMPANY_EVIDENCE
    assert cit_ev.document_name == "Audited_Turnover_FY23.pdf"
    assert cit_ev.page_number == 1
    assert "62.5 Crores" in cit_ev.verbatim_quote


def test_deterministic_synthesis_renders_okf_concept_graph():
    state: ChatWorkflowState = {
        "query": "Explain the tender performance security requirement",
        "routed_intent": "TENDER_SPEC",
        "retrieved_evidence": [
            {
                "type": "OKF_CONCEPT",
                "data": {
                    "id": "okf_financial_pbg",
                    "title": "Performance Security Requirement",
                    "category": "FINANCIAL",
                    "description": "3% of contract value payable within 28 days of Letter of Acceptance.",
                    "verbatim_quote": "The contractor shall submit an irrevocable PBG equal to 3% of the contract value.",
                },
            }
        ],
    }

    content, _, followups, _ = _synthesize_deterministic_template(state)

    assert "### Verified Tender Knowledge Graph (OKF) & Grounded Response" in content
    assert "Based on the compiled Open Knowledge Format (OKF) tender concept graph:" in content
    assert "**FINANCIAL: Performance Security Requirement**" in content
    assert "3% of contract value payable within 28 days" in content
    assert (
        "The contractor shall submit an irrevocable PBG equal to 3% of the contract value."
        in content
    )
    assert len(followups) > 0
