import logging
import math
import re
from collections import Counter
from typing import Any, Protocol

from pydantic import BaseModel, Field

from tenderpulse_ai.security.context import SecurityContext
from tenderpulse_ai.security.exceptions import (
    ToolRateLimitExceededException,
    UnauthorizedDocumentAccessException,
)


class DocumentChunk(BaseModel):
    chunk_id: str
    tenant_id: str
    document_id: str
    page_number: int
    text: str
    clause_reference: str | None = None
    embedding: list[float] | None = None
    parent_id: str | None = None
    tier: str = "TIER2_PARENT"  # TIER1_SKELETON, TIER2_PARENT, TIER3_CHILD
    canonical_ref_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


logger = logging.getLogger("tenderpulse_ai.tools.retrieval")

# Chunk metadata key naming the model that produced chunk.embedding.
EMBEDDING_MODEL_METADATA_KEY = "embedding_model"


class QueryEmbedder(Protocol):
    """Port for a dense embedding model. Chunk embeddings must come from the same model."""

    def embed_query(self, text: str) -> list[float]: ...


def embed_missing_chunks(chunks: list["DocumentChunk"], embedder: Any) -> list["DocumentChunk"]:
    """
    Returns chunks with embeddings filled in for any that lack one, tagged with the
    embedder's model name. Needs an embedder with embed_documents(); on any failure
    the chunks are returned unchanged and retrieval stays BM25-only.
    """
    embed_documents = getattr(embedder, "embed_documents", None)
    missing = [c for c in chunks if c.embedding is None and c.text.strip()]
    if embed_documents is None or not missing:
        return chunks
    try:
        vectors = embed_documents([c.text for c in missing])
    except Exception as err:
        logger.warning("Chunk embedding failed (%s); continuing with BM25 only.", err)
        return chunks
    model_name = getattr(embedder, "model_name", None)
    filled: dict[str, DocumentChunk] = {}
    for chunk, vector in zip(missing, vectors):
        metadata = dict(chunk.metadata)
        if model_name:
            metadata[EMBEDDING_MODEL_METADATA_KEY] = model_name
        filled[chunk.chunk_id] = chunk.model_copy(
            update={"embedding": vector, "metadata": metadata}
        )
    return [filled.get(c.chunk_id, c) for c in chunks]


# Equivalent procurement terms. Tenders mix acronyms and spelled-out forms
# ("EMD" vs "Earnest Money Deposit"), which pure keyword overlap misses.
PROCUREMENT_SYNONYM_GROUPS: tuple[tuple[str, ...], ...] = (
    ("emd", "earnest money deposit", "earnest money", "bid security"),
    ("pbg", "performance bank guarantee", "performance security", "performance guarantee"),
    ("turnover", "revenue", "annual sales"),
    ("net worth", "networth"),
    ("ld", "liquidated damages"),
    ("dlp", "defect liability period", "defects liability period"),
    ("gstin", "gst registration", "goods and services tax"),
    ("udin", "unique document identification number"),
    ("msme", "udyam", "micro small and medium enterprises"),
    ("mii", "make in india"),
    ("poa", "power of attorney"),
    ("boq", "bill of quantities"),
    ("nit", "notice inviting tender"),
    ("cod", "commercial operation date", "scheduled completion date"),
    ("jv", "joint venture", "consortium"),
    ("oem", "original equipment manufacturer", "manufacturer authorization"),
    ("blacklisting", "debarment", "debarred", "blacklisted"),
    ("similar work", "past experience", "work experience", "completed works"),
)

# Expanded synonym terms count for less than terms the caller actually asked for.
SYNONYM_TERM_WEIGHT = 0.6

_TOKEN_RE = re.compile(r"\w+")


def tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


def _contains_phrase(tokens: list[str], phrase: str) -> bool:
    words = phrase.split()
    n = len(words)
    return any(tokens[i : i + n] == words for i in range(len(tokens) - n + 1))


def _matching_groups(tokens: list[str]) -> list[tuple[str, ...]]:
    return [
        group
        for group in PROCUREMENT_SYNONYM_GROUPS
        if any(_contains_phrase(tokens, phrase) for phrase in group)
    ]


def expand_query_terms(query: str) -> dict[str, float]:
    """
    Query term -> weight. Original terms weigh 1.0; terms pulled in from a matching
    synonym group weigh SYNONYM_TERM_WEIGHT, so "EMD" also finds "earnest money deposit".
    """
    tokens = tokenize(query)
    weights: dict[str, float] = {t: 1.0 for t in tokens}
    for group in _matching_groups(tokens):
        for phrase in group:
            for term in phrase.split():
                weights.setdefault(term, SYNONYM_TERM_WEIGHT)
    return weights


class Bm25Index:
    """Okapi BM25 over a small, already tenant-scoped chunk set."""

    def __init__(self, chunks: list["DocumentChunk"], k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self._term_freqs = {c.chunk_id: Counter(tokenize(c.text)) for c in chunks}
        self._lengths = {cid: sum(tf.values()) for cid, tf in self._term_freqs.items()}
        self._avg_length = (sum(self._lengths.values()) / len(chunks)) if chunks else 0.0
        doc_freq: Counter[str] = Counter()
        for tf in self._term_freqs.values():
            doc_freq.update(tf.keys())
        n = len(chunks)
        self._idf = {
            term: math.log(1.0 + (n - df + 0.5) / (df + 0.5)) for term, df in doc_freq.items()
        }

    def score(self, chunk_id: str, query_weights: dict[str, float]) -> float:
        tf = self._term_freqs.get(chunk_id)
        if not tf or self._avg_length == 0:
            return 0.0
        norm = self.k1 * (1 - self.b + self.b * self._lengths[chunk_id] / self._avg_length)
        total = 0.0
        for term, weight in query_weights.items():
            freq = tf.get(term, 0)
            if freq:
                total += weight * self._idf.get(term, 0.0) * freq * (self.k1 + 1) / (freq + norm)
        return total


class JevRerankScore(BaseModel):
    chunk_id: str
    relevance_score: float
    is_statutory: bool
    has_exact_identifier: bool
    final_score: float


class JevCalibratedReranker:
    """
    TypeSafe System One Calibrated Decision Reranker.

    Provides sub-10ms deterministic, typed scoring evaluating:
    1. Exact statutory & tender identifier presence (Tender #, UDIN, GSTIN, Act sections)
    2. Procurement domain keyword density (EMD, PBG, turnover, ISO, liquidated damages)
    3. Query coverage and semantic term density
    4. Calibrated probabilistic relevance ranking in [0.0, 1.0]
    """

    STATUTORY_KEYWORDS: set[str] = {
        "emd",
        "earnest",
        "pbg",
        "turnover",
        "solvency",
        "udin",
        "gstin",
        "pan",
        "stamp",
        "notary",
        "notarized",
        "debarment",
        "blacklisting",
        "iso",
        "liquidated",
        "damages",
        "dlp",
        "defect",
        "corrigendum",
        "affidavit",
        "undertaking",
        "annexure",
        "consortium",
        "subcontracting",
    }

    IDENTIFIER_REGEX: re.Pattern = re.compile(
        r"(?:[a-z]{2,10}(?:/[a-z0-9.-]+){2,}|clause\s+\d+(?:\.\d+)*|section\s+\d+|inr\s*[\d,]+|rs\.?\s*[\d,]+)",  # reference codes (GEM/2024/B/1, ORG/DIV/12/..)
        re.IGNORECASE,
    )

    def score_chunk(self, query: str, chunk: DocumentChunk) -> JevRerankScore:
        query_terms = [t for t in tokenize(query) if len(t) > 2]
        chunk_tokens = tokenize(chunk.text)
        chunk_words = set(chunk_tokens)

        # 1. Term Coverage Ratio (a term also counts as covered when the chunk
        # uses an equivalent procurement term, e.g. "EMD" vs "earnest money deposit")
        chunk_groups = _matching_groups(chunk_tokens)
        matched_terms = [
            t
            for t in query_terms
            if t in chunk_words or any(t in " ".join(g).split() for g in chunk_groups)
        ]
        term_coverage = len(matched_terms) / max(len(query_terms), 1)

        # 2. Statutory Procurement Term Presence
        matched_statutory = [k for k in self.STATUTORY_KEYWORDS if k in chunk_words]
        is_statutory = len(matched_statutory) > 0
        statutory_boost = min(len(matched_statutory) * 0.12, 0.36)

        # 3. Exact Alphanumeric Identifier Match
        has_exact_identifier = bool(self.IDENTIFIER_REGEX.search(chunk.text))
        identifier_boost = 0.25 if has_exact_identifier else 0.0

        # 4. Calibrated Probability via Sigmoid
        # Raw logit combines term coverage, statutory boost, and identifier boost
        raw_logit = (term_coverage * 2.5) + statutory_boost + identifier_boost - 1.2
        calibrated_prob = 1.0 / (1.0 + math.exp(-raw_logit))

        final_score = round(calibrated_prob, 4)

        return JevRerankScore(
            chunk_id=chunk.chunk_id,
            relevance_score=round(term_coverage, 4),
            is_statutory=is_statutory,
            has_exact_identifier=has_exact_identifier,
            final_score=final_score,
        )

    def rerank(
        self,
        query: str,
        candidates: list[DocumentChunk],
        top_k: int = 5,
    ) -> list[DocumentChunk]:
        if not candidates:
            return []

        scored: list[tuple[float, DocumentChunk]] = []
        for candidate in candidates:
            score_meta = self.score_chunk(query, candidate)
            scored.append((score_meta.final_score, candidate))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [c for _, c in scored[:top_k]]


def compute_cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """Computes cosine similarity between two dense embedding vectors."""
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0
    dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot_product / (norm_a * norm_b)


def _competition_ranks(scored: list[tuple[float, "DocumentChunk"]]) -> dict[str, int]:
    """
    Ranks a score-sorted list so equal scores share a rank ("1224"). Positional ranks
    would hand an arbitrary advantage to whichever tied chunk happened to come first.
    """
    ranks: dict[str, int] = {}
    previous: float | None = None
    rank = 0
    for position, (score, chunk) in enumerate(scored, start=1):
        if previous is None or score != previous:
            rank = position
            previous = score
        ranks[chunk.chunk_id] = rank
    return ranks


def reciprocal_rank_fusion(
    dense_ranks: dict[str, int],
    sparse_ranks: dict[str, int],
    k: int = 60,
) -> dict[str, float]:
    """
    Fuses rankings from dense vector search and sparse lexical search using Reciprocal Rank Fusion (RRF).
    Formula: RRF(d) = 1 / (k + rank_dense) + 1 / (k + rank_sparse)
    """
    fused_scores: dict[str, float] = {}
    all_chunk_ids = set(dense_ranks.keys()).union(sparse_ranks.keys())

    for chunk_id in all_chunk_ids:
        score = 0.0
        if chunk_id in dense_ranks:
            score += 1.0 / (k + dense_ranks[chunk_id])
        if chunk_id in sparse_ranks:
            score += 1.0 / (k + sparse_ranks[chunk_id])
        fused_scores[chunk_id] = score

    return fused_scores


class ScopedRetrievalTool:
    """
    Deterministic scoped retrieval tool with Hybrid Dense+Sparse RAG and JEV Reranking.
    Enforces hard tenant isolation and document whitelist checking before any data access.

    Sparse ranking is Okapi BM25 with procurement synonym expansion. Dense ranking runs
    only when real vectors exist: the caller passes query_embedding, or an embedder is
    configured and the chunks carry embeddings from the same model.
    """

    def __init__(
        self,
        max_calls_per_run: int = 15,
        enable_jev_rerank: bool = True,
        rerank_top_n: int = 20,
        embedder: QueryEmbedder | None = None,
    ):
        self.max_calls_per_run = max_calls_per_run
        self.enable_jev_rerank = enable_jev_rerank
        self.rerank_top_n = rerank_top_n
        self.embedder = embedder
        self.reranker = JevCalibratedReranker()
        # In-memory document chunks store partitioned by (tenant_id, document_id)
        self._store: dict[str, list[DocumentChunk]] = {}
        self._chunks_by_id: dict[str, DocumentChunk] = {}
        self._call_counts: dict[str, int] = {}

    def seed_chunks(self, chunks: list[DocumentChunk]):
        """Seeds chunks, embedding any that lack a vector when an embedder is configured."""
        if self.embedder is not None:
            chunks = embed_missing_chunks(chunks, self.embedder)
        for chunk in chunks:
            self._chunks_by_id[chunk.chunk_id] = chunk
            key = f"{chunk.tenant_id}:{chunk.document_id}"
            if key not in self._store:
                self._store[key] = []
            self._store[key].append(chunk)

    def retrieve(
        self,
        security_context: SecurityContext,
        target_document_id: str,
        query: str,
        top_k: int = 5,
        query_embedding: list[float] | None = None,
        expand_to_parent: bool = True,
    ) -> list[DocumentChunk]:
        """
        Executes tenant-scoped hybrid retrieval:
        1. Enforces rate limits per workflow run.
        2. Validates target_document_id against security_context.allowed_document_ids (anti-IDOR).
        3. Isolates chunks by security_context.tenant_id.
        4. Ranks by BM25 (with synonym expansion) and, when vectors exist, dense cosine similarity.
        5. Fuses candidates via Reciprocal Rank Fusion (RRF).
        6. Runs JEV Calibrated System One Reranker for high-precision top_k selection.
        7. If expand_to_parent is True, expands TIER3_CHILD chunks to their enclosing TIER2_PARENT chunks.
        """
        self._check_rate_limit(security_context)

        # Strict Whitelist Check (Anti-IDOR)
        if target_document_id not in security_context.allowed_document_ids:
            raise UnauthorizedDocumentAccessException(
                f"Document '{target_document_id}' is not in allowed document scope: {security_context.allowed_document_ids}"
            )

        # Deterministic Scoped Query
        key = f"{security_context.tenant_id}:{target_document_id}"
        scoped_chunks = [
            c
            for c in self._store.get(key, [])
            if c.tenant_id == security_context.tenant_id and c.document_id == target_document_id
        ]
        ranked = self._hybrid_rank(
            query,
            scoped_chunks,
            top_k=max(top_k * 3, self.rerank_top_n),
            query_embedding=query_embedding,
            pool_size=max(top_k * 2, self.rerank_top_n),
            prefer_children=not expand_to_parent,
        )

        if not expand_to_parent:
            # Ensure fine-grained child chunk hits are not shadowed or demoted by parent table chunks.
            # When child chunks match and are present in ranked, demote their parent chunks behind them.
            parent_ids_with_child_hits = {
                c.parent_id for c in ranked if c.tier == "TIER3_CHILD" and c.parent_id
            }
            if parent_ids_with_child_hits:
                non_parent_chunks: list[DocumentChunk] = []
                parent_chunks: list[DocumentChunk] = []
                for c in ranked:
                    if c.chunk_id in parent_ids_with_child_hits:
                        parent_chunks.append(c)
                    else:
                        non_parent_chunks.append(c)
                ranked = non_parent_chunks + parent_chunks
            return ranked[:top_k]

        # Small-to-Big parent expansion
        expanded: list[DocumentChunk] = []
        seen_ids: set[str] = set()
        for c in ranked:
            target = c
            if c.tier == "TIER3_CHILD" and c.parent_id and c.parent_id in self._chunks_by_id:
                parent = self._chunks_by_id[c.parent_id]
                parent.metadata["child_hit"] = {"chunk_id": c.chunk_id, "text": c.text}
                target = parent
            if target.chunk_id not in seen_ids:
                seen_ids.add(target.chunk_id)
                expanded.append(target)
            if len(expanded) >= top_k:
                break

        return expanded[:top_k]

    def retrieve_evidence_vault(
        self,
        security_context: SecurityContext,
        query: str,
        top_k: int = 5,
        query_embedding: list[float] | None = None,
        category: str | None = None,
    ) -> list[DocumentChunk]:
        """
        Executes tenant-scoped hybrid retrieval across all evidence vault chunks:
        1. Rate limit check.
        2. Strict tenant isolation (all chunks must belong to security_context.tenant_id).
        3. BM25 + optional dense ranking + Reciprocal Rank Fusion.
        4. JEV Calibrated Cross-Encoder Reranking.
        """
        self._check_rate_limit(security_context)

        scoped_chunks: list[DocumentChunk] = []
        for key, chunks in self._store.items():
            if key.startswith(f"{security_context.tenant_id}:"):
                scoped_chunks.extend(
                    [c for c in chunks if c.tenant_id == security_context.tenant_id]
                )

        if not scoped_chunks:
            return []

        if category:
            cat_lower = category.lower()
            cat_filtered = [
                c
                for c in scoped_chunks
                if str(c.metadata.get("category", "")).lower() == cat_lower
                or str(c.metadata.get("evidence_type", "")).lower() == cat_lower
                or (
                    cat_lower == "financial"
                    and any(
                        k in c.text.lower()
                        for k in ("turnover", "financial", "balance sheet", "ca_cert", "udin")
                    )
                )
                or (
                    cat_lower == "technical"
                    and any(
                        k in c.text.lower()
                        for k in ("completion", "work order", "experience", "contract")
                    )
                )
                or (
                    cat_lower in ("statutory", "quality")
                    and any(
                        k in c.text.lower() for k in ("iso", "cmmi", "gstin", "pan", "certificate")
                    )
                )
            ]
            if cat_filtered:
                scoped_chunks = cat_filtered

        return self._hybrid_rank(query, scoped_chunks, top_k, query_embedding)

    def _check_rate_limit(self, security_context: SecurityContext) -> None:
        run_id = security_context.workflow_run_id
        current_calls = self._call_counts.get(run_id, 0) + 1
        if current_calls > self.max_calls_per_run:
            raise ToolRateLimitExceededException(
                f"Rate limit exceeded: Max {self.max_calls_per_run} retrieval calls allowed per run."
            )
        self._call_counts[run_id] = current_calls

    def _hybrid_rank(
        self,
        query: str,
        scoped_chunks: list[DocumentChunk],
        top_k: int,
        query_embedding: list[float] | None,
        pool_size: int | None = None,
        prefer_children: bool = False,
    ) -> list[DocumentChunk]:
        if not scoped_chunks:
            return []

        # Sparse: BM25 over the scoped set with synonym-expanded query terms.
        bm25 = Bm25Index(scoped_chunks)
        query_weights = expand_query_terms(query)
        # When parents are not expanded, matching child chunks get a slight (5%) edge so
        # fine-grained hits are not shadowed by the larger parent text they sit in.
        child_factor = 1.05 if prefer_children else 1.0
        sparse_scored = sorted(
            (
                (
                    bm25.score(c.chunk_id, query_weights)
                    * (child_factor if c.tier == "TIER3_CHILD" else 1.0),
                    c,
                )
                for c in scoped_chunks
            ),
            key=lambda x: x[0],
            reverse=True,
        )
        sparse_ranks = _competition_ranks(sparse_scored)

        # Dense: only with real vectors. No proxy, so RRF never double-counts BM25.
        embedded = [c for c in scoped_chunks if c.embedding is not None]
        if query_embedding is None and self.embedder is not None:
            # Vectors from a different model live in a different space: never mix them.
            model_name = getattr(self.embedder, "model_name", None)
            if model_name:
                embedded = [
                    c
                    for c in embedded
                    if c.metadata.get(EMBEDDING_MODEL_METADATA_KEY, model_name) == model_name
                ]
            if embedded:
                try:
                    query_embedding = self.embedder.embed_query(query)
                except Exception as err:
                    logger.warning("Query embedding failed (%s); using BM25 only.", err)
        dense_ranks: dict[str, int] = {}
        if query_embedding is not None and embedded:
            dense_scored = sorted(
                (
                    (compute_cosine_similarity(query_embedding, c.embedding or []), c)
                    for c in embedded
                ),
                key=lambda x: x[0],
                reverse=True,
            )
            dense_ranks = _competition_ranks(dense_scored)

        # Reciprocal Rank Fusion (RRF)
        fused_scores = reciprocal_rank_fusion(dense_ranks, sparse_ranks, k=60)
        chunk_map = {c.chunk_id: c for c in scoped_chunks}
        # Ties are broken by dense rank, then BM25 rank, then id, so the order never
        # depends on set iteration order and repeated runs return the same chunks.
        unranked = len(scoped_chunks) + 1
        fused_sorted = sorted(
            fused_scores.items(),
            key=lambda x: (
                -x[1],
                dense_ranks.get(x[0], unranked),
                sparse_ranks.get(x[0], unranked),
                x[0],
            ),
        )

        # Take candidate pool for reranking
        candidate_pool = [
            chunk_map[cid] for cid, _ in fused_sorted[: pool_size or self.rerank_top_n]
        ]

        # JEV Calibrated System One Reranking
        if self.enable_jev_rerank and self.reranker:
            return self.reranker.rerank(query=query, candidates=candidate_pool, top_k=top_k)

        return candidate_pool[:top_k]
