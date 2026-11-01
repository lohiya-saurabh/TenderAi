"""Local dense embeddings: wiring, model isolation and graceful fallback."""

import os

import pytest

from tenderpulse_ai.decision.schemas import EvidenceChunkWire
from tenderpulse_ai.domain import evidence_extractor as evidence_module
from tenderpulse_ai.domain.evidence_extractor import CompanyEvidenceExtractor
from tenderpulse_ai.infrastructure import embeddings as embeddings_pkg
from tenderpulse_ai.infrastructure.embeddings import local_embedder
from tenderpulse_ai.security.context import SecurityContext
from tenderpulse_ai.tools.retrieval import (
    EMBEDDING_MODEL_METADATA_KEY,
    DocumentChunk,
    ScopedRetrievalTool,
)


class FakeEmbedder:
    """Deterministic embedder: one dimension per concept, so "late" and "delay" are close."""

    CONCEPTS = (("delay", "late"), ("canteen",), ("experience",))

    def __init__(self, model_name: str = "fake-model"):
        self.model_name = model_name
        self.query_calls = 0
        self.document_calls = 0

    def _vector(self, text: str) -> list[float]:
        lowered = text.lower()
        return [1.0 if any(w in lowered for w in c) else 0.0 for c in self.CONCEPTS] + [0.01]

    def embed_query(self, text: str) -> list[float]:
        self.query_calls += 1
        return self._vector(text)

    def embed_documents(self, texts):
        self.document_calls += 1
        return [self._vector(t) for t in texts]


@pytest.fixture
def sec_ctx():
    return SecurityContext(
        tenant_id="org_a",
        user_id="u1",
        workflow_run_id="run_embeddings",
        allowed_document_ids=["doc_1"],
    )


def _chunk(cid, text, embedding=None, metadata=None):
    return DocumentChunk(
        chunk_id=cid,
        tenant_id="org_a",
        document_id="doc_1",
        page_number=1,
        clause_reference="",
        text=text,
        embedding=embedding,
        metadata=metadata or {},
    )


def test_get_embedder_disabled_returns_none(monkeypatch):
    monkeypatch.setattr(local_embedder.settings, "embedding_provider", "none")
    local_embedder.reset_embedder_cache()
    assert embeddings_pkg.get_embedder() is None


def test_get_embedder_load_failure_falls_back_once(monkeypatch):
    attempts = []

    def broken(*args, **kwargs):
        attempts.append(1)
        raise RuntimeError("model download blocked")

    monkeypatch.setattr(local_embedder.settings, "embedding_provider", "local")
    monkeypatch.setattr(local_embedder, "LocalEmbedder", broken)
    local_embedder.reset_embedder_cache()
    try:
        assert local_embedder.get_embedder() is None
        assert local_embedder.get_embedder() is None
        assert len(attempts) == 1
    finally:
        local_embedder.reset_embedder_cache()


def test_seed_chunks_embeds_missing_vectors_and_tags_model(sec_ctx):
    embedder = FakeEmbedder()
    tool = ScopedRetrievalTool(embedder=embedder)
    preset = [9.0, 9.0, 9.0, 9.0]
    tool.seed_chunks(
        [
            _chunk("new", "Penalty for each week of delay."),
            _chunk("preset", "Existing vector.", embedding=preset),
        ]
    )

    stored = {c.chunk_id: c for c in tool._store["org_a:doc_1"]}
    assert embedder.document_calls == 1
    assert stored["new"].embedding is not None
    assert stored["new"].metadata[EMBEDDING_MODEL_METADATA_KEY] == "fake-model"
    assert stored["preset"].embedding == preset


def test_paraphrase_found_through_dense_ranking(sec_ctx):
    # "late" shares no keyword with the clause; only the dense vectors connect them.
    tool = ScopedRetrievalTool(embedder=FakeEmbedder(), enable_jev_rerank=False)
    tool.seed_chunks(
        [
            _chunk("canteen", "Canteen and uniforms are provided on site."),
            _chunk("ld", "The contractor pays 0.5% per week of delay."),
        ]
    )

    results = tool.retrieve(sec_ctx, "doc_1", "if the job finishes late", top_k=1)

    assert results[0].chunk_id == "ld"


def test_vectors_from_another_model_are_never_compared(sec_ctx):
    embedder = FakeEmbedder(model_name="model-b")
    tool = ScopedRetrievalTool(embedder=embedder)
    tool.seed_chunks(
        [
            _chunk(
                "old",
                "Liquidated damages clause.",
                embedding=[1.0, 0.0, 0.0, 0.0],
                metadata={EMBEDDING_MODEL_METADATA_KEY: "model-a"},
            )
        ]
    )

    results = tool.retrieve(sec_ctx, "doc_1", "liquidated damages", top_k=1)

    assert embedder.query_calls == 0  # nothing comparable, so dense ranking is skipped
    assert results[0].chunk_id == "old"  # BM25 still finds it


async def test_evidence_extraction_attaches_embeddings(monkeypatch):
    embedder = FakeEmbedder()
    monkeypatch.setattr(evidence_module, "get_embedder", lambda: embedder)

    chunks = CompanyEvidenceExtractor._embed_chunks(
        [
            EvidenceChunkWire(chunk_id="c1", document_id="ev1", content="Delay penalty"),
            EvidenceChunkWire(chunk_id="c2", document_id="ev1", content="Canteen"),
        ]
    )

    assert all(c.embedding for c in chunks)
    assert all(c.metadata[EMBEDDING_MODEL_METADATA_KEY] == "fake-model" for c in chunks)


async def test_evidence_extraction_without_embedder_leaves_chunks_unchanged(monkeypatch):
    monkeypatch.setattr(evidence_module, "get_embedder", lambda: None)
    chunk = EvidenceChunkWire(chunk_id="c1", document_id="ev1", content="Delay penalty")

    [result] = CompanyEvidenceExtractor._embed_chunks([chunk])

    assert result.embedding is None


@pytest.mark.skipif(
    os.environ.get("EMBEDDING_INTEGRATION") != "1",
    reason="Downloads and runs the real local model; set EMBEDDING_INTEGRATION=1 to run.",
)
def test_real_local_model_ranks_paraphrased_clause_first(sec_ctx):
    embedder = local_embedder.LocalEmbedder(
        "BAAI/bge-small-en-v1.5", os.environ.get("EMBEDDING_CACHE_DIR")
    )
    tool = ScopedRetrievalTool(embedder=embedder)
    tool.seed_chunks(
        [
            _chunk(
                "ld",
                "The contractor shall be penalised 0.5% of contract value for each week of "
                "delay, capped at 10%.",
            ),
            _chunk("canteen", "Canteen and staff uniforms will be provided on site."),
            _chunk(
                "experience",
                "Bidders must show completion of three similar works of at least 40% of the "
                "estimated cost.",
            ),
        ]
    )

    results = tool.retrieve(sec_ctx, "doc_1", "penalty for late completion", top_k=1)

    assert results[0].chunk_id == "ld"
