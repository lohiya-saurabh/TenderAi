# ADR 0018: Async-First Extraction and AI Invocation

## Status

Accepted (2026-10-05)

## Context

ADR 0003 mandated an asynchronous pipeline (S3 → SQS → worker → AI → deterministic grounding → PostgreSQL → events). The audit (`docs/CURRENT_STATE.md` §14) found the **live runtime violates it**: `DocumentsService.confirmUpload` executes extraction synchronously and inline — calling the AI engine directly inside the request path. The queue/worker path (`IngestionWorker`, `BulkIngestComplianceUseCase`, SQS/PubSub adapters, DLQ, leases) exists and is E2E-tested but is not what runs in production.

### The Problem

1. **HTTP timeouts**: 200-page tenders take 60–180s to parse and extract; inline execution risks 504s and blocks the event loop.
2. **Crash recovery is bypassed**: an inline failure loses all prior computation; the queue's visibility-timeout + lease + retry machinery is unused.
3. **AI boundary is porous**: the API service reaches into the AI engine directly instead of through the worker boundary, making the two-tier split (ADR 0001) nominal rather than real.
4. **Simulated SSE**: progress is a timer, not real job state, so readiness features cannot be built on it.

## Decision

1. **`confirmUpload` only records the document and enqueues a `WorkflowRun`** via `IJobQueue`; it returns immediately with `status: QUEUED`. Extraction, structuring, matching, and assessment run in the worker.
2. **The AI engine is reachable only from the worker path** (and from tests). No application service calls the AI engine inline.
3. **SSE streams real `WorkflowRun` state** (PENDING → PROCESSING → COMPLETED/FAILED/DEAD_LETTER) with step transitions (PARSING_PAGES → EXTRACTING_COMPLIANCE → MATCHING → VERIFYING_CITATIONS → COMPLETED/REVIEW_READY).
4. **The regex extractor remains the deterministic production baseline**; the LLM is an adapter behind `StructuredLLMClient` invoked by the worker with identical output contracts. Degradation path: LLM failure → regex baseline, never silence.
5. **Idempotency, leases, backoff, and DLQ** behavior is exactly as specified in `docs/ASYNC.md` — the tested design finally becomes the shipping design.

## Consequences

- **Positive**:
  - Request path is fast and bounded; heavy work is crash-recoverable and retriable.
  - The two-tier architecture (ADR 0001) becomes real; the AI boundary is enforceable and auditable.
  - Real job state enables the readiness features (corrigendum re-evaluation, artifact generation) on the same machinery.
- **Negative / Trade-offs**:
  - UX becomes eventually-consistent: users wait seconds-to-minutes for the compliance register; mitigated by SSE progress and optimistic UI.
  - Worker deployment is mandatory (no more "API-only" deployments); one more process to operate.
- **Failure modes**: queue backlog delays extraction — monitored via queue-depth metrics; poison pills land in the DLQ with alerts.

## References

ADR 0001 (two-tier boundary), ADR 0003 (SQS async pipeline), `docs/ASYNC.md`, `docs/CURRENT_STATE.md` §14.
