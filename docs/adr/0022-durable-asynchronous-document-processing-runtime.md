# ADR: Durable Asynchronous Document Processing Runtime

**Status:** Accepted for the current implementation  
**Date:** 2026-10-03

## Context

Upload confirmation previously wrote document metadata and attempted a best-effort queue publish. There was no running queue consumer, no durable handoff record, and no production persistence/acknowledgement boundary. The intended destination architecture is NestJS for authenticated upload/job initiation and FastAPI for document processing, AI workflow execution, and persistence integration.

## Decision

Add a transactional outbox and a NestJS-hosted background runtime as an incremental reliability bridge:

1. `DocumentsService.confirmUpload()` verifies object existence and atomically writes document metadata, bid state, audit record, and a stable outbox message.
2. A runtime registered in `DocumentsModule` claims outbox entries under a lease, publishes through the existing provider-neutral `IJobQueue`, and polls the same queue.
3. Before processing, it resolves tenant, company, bid, and document from PostgreSQL and checks message claims and the exact persisted storage reference.
4. It invokes the existing `AiDocumentExtractor` port, validates returned items, persists deterministic document-scoped compliance rows and document/bid status in one transaction, then acknowledges.
5. Failures remain unacknowledged and are made visible through retries and the configured dead-letter path. A failed acknowledgement does not overwrite an already-committed completed state.

The consumer and its dependencies remain behind existing queue, storage, and database abstractions. The FastAPI API remains the extraction boundary, not an authorization system.

## Why

- A committed outbox removes the dual-write gap between metadata and queue publication.
- Stable event/job IDs and deterministic compliance IDs make publication retries and queue redelivery safe.
- Resolving authorization scope from persisted records prevents queue payload claims or model output from granting tenant/company access.
- Persist-before-ack provides at-least-once delivery with replay-safe effects, rather than claiming exactly-once delivery.

## Alternatives considered

- **Publish directly from the upload request:** rejected because a database commit and remote queue publish cannot be atomic; a crash between them can lose work or report success without a durable job.
- **Immediately implement a FastAPI cloud-queue consumer and object-storage adapter:** remains the target, but was not selected for this incremental slice because it would duplicate provider configuration and persistence responsibilities before the queue contract and durable result semantics were tested.
- **Keep the test-oriented in-memory `IngestionWorker` as production runtime:** rejected because its repositories and unit of work do not provide durable claims or PostgreSQL transactions.

## Trade-offs and limitations

- NestJS now performs asynchronous document processing work and may need independent capacity controls before production-scale use.
- PDF retrieval/normalization remains inside `AiDocumentExtractor` in NestJS; OCR, structured layout parsing, and worker-side cloud storage retrieval remain unimplemented.
- FastAPI still exposes extraction over HTTP and runs LangGraph for extraction; it does not consume the queue or persist results.
- The runtime uses a periodic poller in the API process. Production operations must monitor consumer health, outbox age, retry counts, and DLQ delivery. Running multiple replicas is supported through outbox claims and document leases, but cloud queue behavior still requires deployment verification.
- The outbox is durable, but it is not a distributed exactly-once mechanism. A successful publish followed by a database update failure can cause a duplicate publish; the consumer is designed to make that safe.

## Failure and security implications

- Storage absence fails confirmation before database changes.
- Queue publish failure leaves the outbox pending for retry; the request does not depend on a best-effort direct publish.
- Parse, extraction, validation, and persistence failures do not acknowledge the source message.
- A database outage during failure bookkeeping also leaves the message unacknowledged.
- Terminal routing fails explicitly if the configured manual DLQ destination is absent; the source message is not falsely acknowledged.
- Tenant/company/document ownership is re-derived from PostgreSQL, and storage references must exactly match the persisted document row. `tenant_id`/company context passed to FastAPI is scoped by the server and must never be interpreted as authorization decided by an LLM.
- Production startup requires an AI service URL and `INTERNAL_SERVICE_KEY`; the development-only shared key fallback is rejected in production.

## Follow-up

Move queue consumption, provider-neutral object retrieval, parsing/OCR, and the required persistence contract into a separately deployable FastAPI worker before describing the system as conforming to the target architecture.
