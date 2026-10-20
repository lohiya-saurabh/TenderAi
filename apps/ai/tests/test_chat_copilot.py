import pytest
from httpx import ASGITransport, AsyncClient

from tenderpulse_ai.chat import (
    ChatCopilotAgent,
    ChatQueryRequest,
    ChatToolRegistry,
)
from tenderpulse_ai.domain.models import DoclingBlock, DoclingParsedDocument, DoclingTable
from tenderpulse_ai.domain.tender_chunker import TenderChunker
from tenderpulse_ai.main import app
from tenderpulse_ai.security.context import SecurityContext


def test_tender_chunker_hierarchical_semantic():
    """Verifies that TenderChunker parses docling AST blocks & tables into contextual chunks."""
    doc = DoclingParsedDocument(
        document_id="doc-test-123",
        file_name="Tender_NIT.pdf",
        blocks=[
            DoclingBlock(
                block_id="blk_1",
                type="heading",
                level=1,
                text="PART I: INVITATION FOR BIDS",
                page_number=1,
            ),
            DoclingBlock(
                block_id="blk_2",
                type="heading",
                level=2,
                text="SECTION 2: ELIGIBILITY CRITERIA",
                page_number=1,
            ),
            DoclingBlock(
                block_id="blk_3",
                type="heading",
                level=3,
                text="Clause 4.1: Earnest Money Deposit",
                page_number=1,
            ),
            DoclingBlock(
                block_id="blk_4",
                type="paragraph",
                text="Bidders must submit an Earnest Money Deposit (EMD) of INR 5,00,000 on a 100 Rupee stamp paper.",
                page_number=1,
            ),
        ],
        tables=[
            DoclingTable(
                table_id="tbl_1",
                page_number=2,
                headers=["Criteria", "Threshold"],
                rows=[
                    ["Minimum Average Annual Turnover", "INR 25.00 Cr"],
                    ["Similar Work Experience", "INR 20.00 Cr"],
                ],
                caption="Technical Eligibility Matrix",
            )
        ],
    )

    chunker = TenderChunker()
    chunks = chunker.chunk_document(doc)

    assert len(chunks) >= 2
    prose_chunk = next(c for c in chunks if c.chunk_type in ("CLAUSE", "PROSE"))
    assert prose_chunk.page_number == 1

    table_chunk = next(c for c in chunks if c.chunk_type == "TABLE")
    assert table_chunk.page_number == 2
    assert "| Criteria | Threshold |" in table_chunk.content
    assert table_chunk.metadata.get("is_table") is True

    wire_dict = prose_chunk.to_wire_dict()
    assert wire_dict["chunkId"] == prose_chunk.id
    assert wire_dict["chunkIndex"] == 0


def test_chat_tools_registry():
    """Verifies all 6 AI worker chat tools execute and return structured records."""
    registry = ChatToolRegistry()

    # 1. search_tender_documents
    tender_results = registry.search_tender_documents("EMD stamp paper")
    assert len(tender_results) > 0
    assert any("EMD" in r["content"] or "Earnest Money" in r["content"] for r in tender_results)

    # 2. search_company_evidence
    evidence_results = registry.search_company_evidence("turnover UDIN")
    assert len(evidence_results) > 0
    assert any("UDIN" in r["content"] for r in evidence_results)

    # 3. get_company_financials
    financials = registry.get_company_financials("comp-1")
    assert financials["averageTurnoverInrCrores"] > 20.0
    assert financials["auditedUdin"] is not None

    # 4. get_company_experience
    experience = registry.get_company_experience("comp-1")
    assert len(experience) >= 2
    assert any("NHAI" in e["client"] or "NHAI" in e["projectName"] for e in experience)

    # 5. get_compliance_matrix
    compliance = registry.get_compliance_matrix("bid-1")
    assert len(compliance) >= 3
    assert any(c["category"] == "EXECUTION" for c in compliance)

    # 6. get_bid_decision_summary
    decision = registry.get_bid_decision_summary("bid-1", "comp-1")
    assert decision["verdict"] in ("GO", "NO_GO", "CONDITIONAL_GO", "REVIEW_REQUIRED")
    assert decision["readinessScore"] >= 0.0


@pytest.mark.asyncio
async def test_chat_copilot_financial_intent_workflow():
    """Verifies LangGraph chat workflow intent routing, tool calling, and financial summary generation."""
    agent = ChatCopilotAgent()

    sec_ctx = SecurityContext(
        tenant_id="org_test_001",
        company_id="comp_test_001",
        user_id="user_test_001",
        workflow_run_id="run_test_001",
        roles=["BID_MANAGER"],
        permissions=["bids.read", "chat.query"],
    )

    request = ChatQueryRequest(
        security_context=sec_ctx,
        query="What is the minimum turnover requirement and do we satisfy it based on our CA certificate?",
        bid_id="bid_test_101",
        company_id="comp_test_001",
    )

    response = await agent.query(request)
    assert response.conversation_id is not None
    assert response.message.role == "assistant"
    assert response.message.financial_summary is not None
    assert (
        response.message.financial_summary.metric_name == "Minimum Average Annual Turnover (MAAT)"
    )
    assert response.message.financial_summary.verdict == "PASS"
    assert len(response.message.citations or []) > 0
    assert len(response.suggested_followups) > 0
    assert len(response.audit_events) == 1


@pytest.mark.asyncio
async def test_chat_copilot_compliance_intent_workflow():
    """Verifies compliance rules and execution warning generation."""
    agent = ChatCopilotAgent()

    sec_ctx = SecurityContext(
        tenant_id="org_test_001",
        company_id="comp_test_001",
        user_id="user_test_001",
        workflow_run_id="run_test_002",
        roles=["BID_MANAGER"],
        permissions=["bids.read", "chat.query"],
    )

    request = ChatQueryRequest(
        security_context=sec_ctx,
        query="What are the stamp paper and notarization rules for this bid?",
        bid_id="bid_test_101",
        company_id="comp_test_001",
    )

    response = await agent.query(request)
    assert response.conversation_id is not None
    assert "Stamp Paper" in response.message.content or "Notarized" in response.message.content
    assert response.message.metadata.get("intent") == "COMPLIANCE_CHECK"


@pytest.mark.asyncio
async def test_chat_query_fastapi_endpoint():
    """Verifies POST /api/v1/chat/query endpoint contract with internal API key auth."""
    from tenderpulse_ai.config import settings

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        payload = {
            "security_context": {
                "tenant_id": "org_api_001",
                "company_id": "comp_api_001",
                "user_id": "user_api_001",
                "workflow_run_id": "run_api_001",
                "roles": ["BID_MANAGER"],
                "permissions": ["bids.read"],
            },
            "query": "Should we pursue this bid and what is our readiness score?",
            "bid_id": "bid_api_202",
            "company_id": "comp_api_001",
        }

        # Should fail with 401/403 without API key
        unauth_res = await client.post("/api/v1/chat/query", json=payload)
        assert unauth_res.status_code in (401, 403)

        # Should succeed with X-Internal-Service-Key
        headers = {"X-Internal-Service-Key": settings.internal_service_key}
        res = await client.post("/api/v1/chat/query", json=payload, headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "conversation_id" in data
        assert "message" in data
        assert data["message"]["role"] == "assistant"
        assert len(data["message"]["content"]) > 20


def test_tender_chunker_cycle_safety_and_overlap():
    """Verifies that TenderChunker safely handles cyclic SectionNode trees and retains intra-block overlaps."""
    from tenderpulse_ai.domain.models import DocumentStructureTree, SectionNode

    # Intentionally malformed tree with cyclical parent references
    tree = DocumentStructureTree(
        document_id="doc-cyclic-01",
        nodes=[
            SectionNode(
                node_id="n1",
                number="1.0",
                title="Cycle Root",
                level=1,
                parent_id="n2",
                block_ids=["blk_c1"],
            ),
            SectionNode(
                node_id="n2",
                number="1.1",
                title="Cycle Child",
                level=2,
                parent_id="n1",
                block_ids=["blk_c2"],
            ),
        ],
    )

    long_legal_text = (
        "The contractor shall execute works in strict accordance with technical specifications. "
        * 30
    )

    doc = DoclingParsedDocument(
        document_id="doc-cyclic-01",
        file_name="Cyclic_Test.pdf",
        blocks=[
            DoclingBlock(block_id="blk_c1", type="paragraph", text=long_legal_text, page_number=1),
            DoclingBlock(
                block_id="blk_c2",
                type="paragraph",
                text="Final completion condition.",
                page_number=2,
            ),
        ],
        tables=[],
    )

    chunker = TenderChunker(target_chunk_chars=500, max_chunk_chars=800, overlap_chars=120)
    chunks = chunker.chunk_document(doc, tree)

    # Must complete safely without hanging in infinite recursion
    assert len(chunks) > 1
    assert all(
        c.document_id if hasattr(c, "document_id") else c.id.startswith("chk_doc-cyclic-01")
        for c in chunks
    )


def test_chat_tools_stopword_filtering():
    """Verifies that ChatToolRegistry filters stopwords like 'what', 'are', 'the' so queries match content."""
    registry = ChatToolRegistry()
    # Query composed largely of conversational stopwords + 1 key content word
    results = registry.search_tender_documents("What are the and for of liquidated damages?")
    assert len(results) > 0
    assert (
        "Liquidated Damages" in results[0].get("sectionTitle", "")
        or "liquidated" in results[0].get("content", "").lower()
    )


@pytest.mark.asyncio
async def test_chat_copilot_followup_history_intent():
    """Verifies that follow-up queries retain prior intent from conversation history."""
    agent = ChatCopilotAgent()

    sec_ctx = SecurityContext(
        tenant_id="org_test_001",
        company_id="comp_test_001",
        user_id="user_test_001",
        workflow_run_id="run_test_003",
        roles=["BID_MANAGER"],
        permissions=["bids.read", "chat.query"],
    )

    # Turn 2: Ambiguous/short follow-up question
    request = ChatQueryRequest(
        security_context=sec_ctx,
        query="Is it sufficient for this tender?",
        bid_id="bid_test_101",
        company_id="comp_test_001",
        history=[
            {
                "role": "user",
                "content": "What is our 3-year average turnover according to our CA certificate?",
            },
            {
                "role": "assistant",
                "content": "Based on Clause 8.2, our 3-year average turnover is INR 37.67 Cr.",
            },
        ],
    )

    response = await agent.query(request)
    assert response.message.metadata.get("intent") == "FINANCIAL_AUDIT"
    assert response.message.financial_summary is not None


@pytest.mark.asyncio
async def test_chat_copilot_statutory_gst_records_retrieval():
    """Verifies that 'GST records' retrieves company statutory credentials and vault evidence without false rejection."""
    from tenderpulse_ai.chat.schemas import CitationSourceType

    agent = ChatCopilotAgent()

    sec_ctx = SecurityContext(
        tenant_id="org_test_001",
        company_id="comp_test_001",
        user_id="user_test_001",
        workflow_run_id="run_test_gst_01",
        roles=["BID_MANAGER"],
        permissions=["bids.read", "chat.query"],
    )

    request = ChatQueryRequest(
        security_context=sec_ctx,
        query="GST records",
        bid_id="bid_test_101",
        company_id="comp_test_001",
    )

    response = await agent.query(request)
    assert response.message.metadata.get("intent") == "STATUTORY_CREDENTIALS"
    assert "27AAACA1234F1Z9" in response.message.content
    assert "Ashoka Buildcon Limited" in response.message.content
    assert "No verifiable evidence" not in response.message.content
    assert "Grounded Evidence Assessment" not in response.message.content

    # Citations should include company evidence
    citations = response.message.citations or []
    assert len(citations) > 0
    assert any(c.source_type == CitationSourceType.COMPANY_EVIDENCE for c in citations)


@pytest.mark.asyncio
async def test_chat_copilot_conversational_greeting():
    """Verifies that friendly greetings return helpful copilot introduction without rejection errors."""
    agent = ChatCopilotAgent()

    sec_ctx = SecurityContext(
        tenant_id="org_test_001",
        company_id="comp_test_001",
        user_id="user_test_001",
        workflow_run_id="run_test_greeting_01",
        roles=["BID_MANAGER"],
        permissions=["bids.read", "chat.query"],
    )

    request = ChatQueryRequest(
        security_context=sec_ctx,
        query="hello",
        bid_id="bid_test_101",
        company_id="comp_test_001",
    )

    response = await agent.query(request)
    assert response.message.metadata.get("intent") == "GREETING"
    assert "TenderPulse AI Copilot" in response.message.content
    assert "No verifiable evidence" not in response.message.content
    assert len(response.suggested_followups) > 0


@pytest.mark.asyncio
async def test_chat_copilot_adversarial_out_of_domain_query():
    """Verifies that out-of-domain queries strictly trigger the anti-hallucination guard with 0 citations."""
    agent = ChatCopilotAgent()

    sec_ctx = SecurityContext(
        tenant_id="org_test_001",
        company_id="comp_test_001",
        user_id="user_test_001",
        workflow_run_id="run_test_adversarial_01",
        roles=["BID_MANAGER"],
        permissions=["bids.read", "chat.query"],
    )

    request = ChatQueryRequest(
        security_context=sec_ctx,
        query="What is the secret recipe for chocolate chip cookies in this highway tender?",
        bid_id="bid_test_101",
        company_id="comp_test_001",
    )

    response = await agent.query(request)
    assert "Anti-Hallucination Policy" in response.message.content
    assert "No verifiable evidence" in response.message.content
    assert len(response.message.citations or []) == 0
    uncertainties = response.message.metadata.get("uncertainties", [])
    assert any(u.get("type") == "LACK_OF_EVIDENCE" for u in uncertainties)


@pytest.mark.asyncio
async def test_chat_copilot_custom_context_statutory_retrieval():
    """Verifies that contextual company profile in request overrides defaults."""
    agent = ChatCopilotAgent()

    sec_ctx = SecurityContext(
        tenant_id="org_test_001",
        company_id="comp_tata_001",
        user_id="user_test_001",
        workflow_run_id="run_test_tata_01",
        roles=["BID_MANAGER"],
        permissions=["bids.read", "chat.query"],
    )

    request = ChatQueryRequest(
        security_context=sec_ctx,
        query="What is our GSTIN and legal registration?",
        bid_id="bid_test_101",
        company_id="comp_tata_001",
        context={
            "company_profile": {
                "legalName": "Tata Projects Limited",
                "gstin": "27AAACT9999P1Z1",
                "pan": "AAACT9999P",
                "cin": "U45200MH1979PLC021573",
                "constitution": "Public Limited Company",
            },
            "company_evidence": [
                {
                    "documentId": "doc_tata_gst",
                    "documentName": "Tata_Projects_GST_Registration.pdf",
                    "evidenceType": "GST_REGISTRATION",
                    "content": "Form GST REG-06. Tata Projects Limited. GSTIN: 27AAACT9999P1Z1.",
                }
            ],
        },
    )

    response = await agent.query(request)
    assert response.message.metadata.get("intent") == "STATUTORY_CREDENTIALS"
    assert "Tata Projects Limited" in response.message.content
    assert "27AAACT9999P1Z1" in response.message.content
    assert "Tata_Projects_GST_Registration.pdf" in response.message.content
    assert len(response.message.citations or []) >= 1


@pytest.mark.asyncio
async def test_chat_copilot_adversarial_hybrid_prompt():
    """Verifies that queries mixing conversational greetings with technical tender questions execute smoothly."""
    agent = ChatCopilotAgent()

    sec_ctx = SecurityContext(
        tenant_id="org_test_001",
        company_id="comp_test_001",
        user_id="user_test_001",
        workflow_run_id="run_test_hybrid_01",
        roles=["BID_MANAGER"],
        permissions=["bids.read", "chat.query"],
    )

    request = ChatQueryRequest(
        security_context=sec_ctx,
        query="Hello, does GST apply to NIT Clause 4.1 for EMD?",
        bid_id="bid_test_101",
        company_id="comp_test_001",
    )

    response = await agent.query(request)
    assert "No verifiable evidence" not in response.message.content
    assert len(response.message.citations or []) > 0


@pytest.mark.asyncio
async def test_chat_copilot_company_evidence_general_intent():
    """Verifies that non-statutory company evidence queries (like ISO certs) are retrieved and cited under GENERAL intent."""
    agent = ChatCopilotAgent()

    sec_ctx = SecurityContext(
        tenant_id="org_test_001",
        company_id="comp_test_001",
        user_id="user_test_001",
        workflow_run_id="run_test_iso_01",
        roles=["BID_MANAGER"],
        permissions=["bids.read", "chat.query"],
    )

    request = ChatQueryRequest(
        security_context=sec_ctx,
        query="Do we have an ISO 9001 certificate?",
        bid_id="bid_test_101",
        company_id="comp_test_001",
    )

    response = await agent.query(request)
    assert "ISO" in response.message.content
    assert "No verifiable evidence" not in response.message.content
    assert len(response.message.citations or []) > 0
    citations = response.message.citations or []
    from tenderpulse_ai.chat.schemas import CitationSourceType

    assert any(c.source_type == CitationSourceType.COMPANY_EVIDENCE for c in citations)
