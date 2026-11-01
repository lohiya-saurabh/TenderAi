"""
Local dense embeddings for hybrid retrieval.

Runs a small ONNX embedding model in-process via fastembed (no PyTorch, no
network calls once the model is cached). Retrieval degrades to BM25-only when
embeddings are disabled or the model cannot be loaded, so extraction never
fails because of the embedder.
"""

import logging
import threading
from collections.abc import Sequence

from tenderpulse_ai.config import settings

logger = logging.getLogger("tenderpulse_ai.infrastructure.embeddings")


class LocalEmbedder:
    """QueryEmbedder backed by a local fastembed model."""

    def __init__(self, model_name: str, cache_dir: str | None = None):
        from fastembed import TextEmbedding

        self.model_name = model_name
        self._model = TextEmbedding(model_name=model_name, cache_dir=cache_dir)
        # fastembed models are not documented as thread-safe; serialize inference.
        self._lock = threading.Lock()

    def embed_query(self, text: str) -> list[float]:
        with self._lock:
            vector = next(iter(self._model.query_embed([text])))
        return [float(x) for x in vector]

    def embed_documents(self, texts: Sequence[str]) -> list[list[float]]:
        if not texts:
            return []
        with self._lock:
            vectors = list(self._model.embed(list(texts)))
        return [[float(x) for x in v] for v in vectors]


_embedder: LocalEmbedder | None = None
_load_attempted = False
_load_lock = threading.Lock()


def get_embedder() -> LocalEmbedder | None:
    """
    Process-wide embedder, loaded on first use. Returns None when
    EMBEDDING_PROVIDER is not "local" or the model fails to load (logged once).
    """
    global _embedder, _load_attempted
    if settings.embedding_provider.lower() != "local":
        return None
    if _load_attempted:
        return _embedder
    with _load_lock:
        if not _load_attempted:
            try:
                _embedder = LocalEmbedder(settings.embedding_model, settings.embedding_cache_dir)
                logger.info(
                    "Loaded local embedding model %s",
                    settings.embedding_model,
                    extra={"event": "embeddings.model.loaded"},
                )
            except Exception as err:
                _embedder = None
                logger.warning(
                    "Local embedding model %s unavailable (%s); retrieval falls back to BM25 only.",
                    settings.embedding_model,
                    err,
                    extra={"event": "embeddings.model.unavailable"},
                )
            _load_attempted = True
    return _embedder


def reset_embedder_cache() -> None:
    """Forget the loaded model (tests and settings changes)."""
    global _embedder, _load_attempted
    with _load_lock:
        _embedder = None
        _load_attempted = False
