from pydantic import BaseModel

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
    clause_reference: str


class ScopedRetrievalTool:
    """
    Deterministic scoped retrieval tool.
    Enforces hard tenant isolation and document whitelist checking before any data access.
    """
    def __init__(self, max_calls_per_run: int = 15):
        self.max_calls_per_run = max_calls_per_run
        # In-memory document chunks store partitioned by (tenant_id, document_id)
        self._store: dict[str, list[DocumentChunk]] = {}
        self._call_counts: dict[str, int] = {}

    def seed_chunks(self, chunks: list[DocumentChunk]):
        """Helper to seed chunks for tests or local execution."""
        for chunk in chunks:
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
    ) -> list[DocumentChunk]:
        """
        Executes tenant-scoped retrieval.
        Guarantees:
        1. Rate limits per workflow run.
        2. target_document_id is strictly within security_context.allowed_document_ids.
        3. Only chunks belonging to security_context.tenant_id are returned.
        """
        # 1. Rate Limit Check
        run_id = security_context.workflow_run_id
        current_calls = self._call_counts.get(run_id, 0) + 1
        if current_calls > self.max_calls_per_run:
            raise ToolRateLimitExceededException(
                f"Rate limit exceeded: Max {self.max_calls_per_run} retrieval calls allowed per run."
            )
        self._call_counts[run_id] = current_calls

        # 2. Strict Whitelist Check (Anti-IDOR)
        if target_document_id not in security_context.allowed_document_ids:
            raise UnauthorizedDocumentAccessException(
                f"Document '{target_document_id}' is not in allowed document scope: {security_context.allowed_document_ids}"
            )

        # 3. Deterministic Scoped Query
        key = f"{security_context.tenant_id}:{target_document_id}"
        tenant_chunks = self._store.get(key, [])

        # Filter strictly by tenant and document
        scoped_results = [
            c for c in tenant_chunks
            if c.tenant_id == security_context.tenant_id and c.document_id == target_document_id
        ]

        # Simple semantic/keyword match for simulation or top_k
        query_words = set(query.lower().split())
        if query_words:
            def score(chunk: DocumentChunk) -> int:
                chunk_words = set(chunk.text.lower().split())
                return len(query_words.intersection(chunk_words))
            scoped_results.sort(key=score, reverse=True)

        return scoped_results[:top_k]
