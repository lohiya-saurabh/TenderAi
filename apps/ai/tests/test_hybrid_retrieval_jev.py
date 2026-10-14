import pytest

from tenderpulse_ai.security.context import SecurityContext
from tenderpulse_ai.tools.retrieval import (
    DocumentChunk,
    JevCalibratedReranker,
    ScopedRetrievalTool,
    compute_cosine_similarity,
    reciprocal_rank_fusion,
)


@pytest.fixture
def sample_security_context():
    return SecurityContext(
        tenant_id="org_alpha",
        user_id="user_test",
        workflow_run_id="run_123",
        allowed_document_ids=["doc_nit_01", "doc_gcc_02"],
    )


def test_cosine_similarity_computation():
    # Identical vectors
    vec_a = [1.0, 0.0, 0.0]
    vec_b = [1.0, 0.0, 0.0]
    assert compute_cosine_similarity(vec_a, vec_b) == 1.0

    # Orthogonal vectors
    vec_c = [0.0, 1.0, 0.0]
    assert compute_cosine_similarity(vec_a, vec_c) == 0.0

    # Mismatched lengths or empty
    assert compute_cosine_similarity([1.0], [1.0, 2.0]) == 0.0
    assert compute_cosine_similarity([], []) == 0.0


def test_reciprocal_rank_fusion():
    dense_ranks = {"c1": 1, "c2": 2, "c3": 3}
    sparse_ranks = {"c2": 1, "c1": 2, "c4": 3}

    scores = reciprocal_rank_fusion(dense_ranks, sparse_ranks, k=60)

    # c1 and c2 should have higher scores than c3 and c4
    assert scores["c1"] > scores["c3"]
    assert scores["c2"] > scores["c4"]
    # c1 = 1/(60+1) + 1/(60+2) = 1/61 + 1/62 = 0.01639 + 0.01612 = 0.0325
    # c2 = 1/(60+2) + 1/(60+1) = identical
    assert pytest.approx(scores["c1"], 0.0001) == scores["c2"]


def test_jev_calibrated_reranker_statutory_and_identifier_boost():
    reranker = JevCalibratedReranker()
    query = "EMD and Bid Security requirement for NHAI/TECH/2026/04"

    chunk_with_id_and_statutory = DocumentChunk(
        chunk_id="c_high",
        tenant_id="org_alpha",
        document_id="doc_nit_01",
        page_number=4,
        clause_reference="Clause 12.1",
        text="Tender NHAI/TECH/2026/04 mandates an EMD deposit of INR 50,00,000 via Bank Guarantee.",
    )

    chunk_without_boost = DocumentChunk(
        chunk_id="c_low",
        tenant_id="org_alpha",
        document_id="doc_nit_01",
        page_number=10,
        clause_reference="Clause 2.1",
        text="General instructions regarding cafeteria and staff uniforms.",
    )

    score_high = reranker.score_chunk(query, chunk_with_id_and_statutory)
    score_low = reranker.score_chunk(query, chunk_without_boost)

    assert score_high.is_statutory is True
    assert score_high.has_exact_identifier is True
    assert score_high.final_score > score_low.final_score
    assert 0.0 <= score_high.final_score <= 1.0


def test_scoped_retrieval_tool_hybrid_execution(sample_security_context):
    tool = ScopedRetrievalTool(enable_jev_rerank=True)

    chunks = [
        DocumentChunk(
            chunk_id="c1",
            tenant_id="org_alpha",
            document_id="doc_nit_01",
            page_number=1,
            clause_reference="Clause 1.1",
            text="General guidelines for online registration on GeM portal.",
            embedding=[0.1, 0.2, 0.3],
        ),
        DocumentChunk(
            chunk_id="c2",
            tenant_id="org_alpha",
            document_id="doc_nit_01",
            page_number=14,
            clause_reference="Clause 4.1",
            text="Statutory Turnover criteria: Bidder must have minimum INR 45 Crores turnover in last 3 financial years verified with CA UDIN.",
            embedding=[0.9, 0.8, 0.7],
        ),
        DocumentChunk(
            chunk_id="c3",
            tenant_id="org_alpha",
            document_id="doc_nit_01",
            page_number=20,
            clause_reference="Clause 7.2",
            text="Liquidated damages shall be levied at 0.5% per week subject to maximum 10% of contract value.",
            embedding=[0.5, 0.5, 0.5],
        ),
    ]
    tool.seed_chunks(chunks)

    results = tool.retrieve(
        security_context=sample_security_context,
        target_document_id="doc_nit_01",
        query="CA turnover criteria with UDIN",
        top_k=1,
        query_embedding=[0.9, 0.8, 0.7],
    )

    assert len(results) == 1
    assert results[0].chunk_id == "c2"
    assert "Turnover" in results[0].text
