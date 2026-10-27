# Service Boundary — NestJS vs FastAPI

## Implementation Architecture (Design B)

Responsibilities across the two-tier boundary are:

| Concern                                                                  | Location       | Implementation Component                                          |
| ------------------------------------------------------------------------ | -------------- | ----------------------------------------------------------------- |
| Upload authorization, tenant isolation, and presigned URL signing        | NestJS API     | `DocumentsController.generateUploadUrl()` via `IStorageService`   |
| Direct client upload to cloud storage (bypassing server memory)          | S3 / GCS       | Direct client `PUT` request with SHA-256 integrity validation     |
| Upload confirmation, object existence verification, transactional outbox | NestJS API     | `DocumentsService.confirmUpload()` & `document_processing_outbox` |
| Asynchronous queue dispatch & lease-locking                              | NestJS API     | `DocumentProcessingRuntime` via `IJobQueue`                       |
| Direct PDF download & streaming parse (C++ PDFium / Docling)             | FastAPI Worker | `tenderpulse_ai.domain.pdf_resolver.resolve_pdf_to_pages()`       |
| Stateful AI extraction & grounding verification (LangGraph)              | FastAPI Worker | `ProductionExtractionPipeline` / 12-node LangGraph workflow       |
| Asynchronous completion event publication                                | FastAPI Worker | `CompletionPublisher` (`DocumentExtractionCompletedEvent`)        |
| Invariant checking, tenant re-verification & deduplication               | NestJS API     | `DocumentCompletionService.processExtractionCompleted()`          |
| Exclusive, atomic PostgreSQL persistence (**Single-Writer Principle**)   | NestJS API     | PostgreSQL transaction in `DocumentCompletionService`             |
| Queue message acknowledgment / DLQ routing                               | NestJS API     | `DocumentProcessingRuntime` (Persist-Before-Ack pattern)          |

## Overview

This document maps every document‑processing operation to its current implementation location and indicates whether it should remain in NestJS or be moved to the FastAPI worker. The analysis is based on the current codebase (as of the `DOCUMENT_PROCESSING_CURRENT_FLOW.md` trace) and the intended architecture outlined in the design notes.

---

## Historical pre-runtime operation mapping

The table and answers below describe the baseline audited before `DocumentProcessingRuntime` was introduced. Use the implementation update at the top for current ownership.

| Operation                                                   | Current Service                    | Method / Location                                                                     | Should Run There?               | Rationale                                                                                                                                                |
| ----------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PDF parsing (text extraction)**                           | NestJS                             | `DocumentContentNormalizer.normalize` / `normalizeSync` (uses `pdf-parse`)            | **No**                          | Blocks the NestJS event loop; couples parsing to HTTP request latency.                                                                                   |
| **PDF fallback parsing (form‑feed / page‑marker handling)** | NestJS                             | `DocumentContentNormalizer.normalizeSync`                                             | **No**                          | Same latency & blocking concerns as above.                                                                                                               |
| **OCR (optical character recognition)**                     | Neither (not implemented)          | —                                                                                     | **FastAPI** (when OCR is added) | Scanned PDFs require OCR; this is a compute‑intensive task better isolated in the worker.                                                                |
| **Layout extraction (headings, tables, section hierarchy)** | Neither (not implemented)          | —                                                                                     | **FastAPI**                     | Structural analysis is part of the extraction pipeline, not authentication or metadata creation.                                                         |
| **Chunking (semantic page or section chunking)**            | Neither (not implemented)          | —                                                                                     | **FastAPI**                     | Chunking is a preprocessing step for the AI workflow and should be worker‑local.                                                                         |
| **Embeddings generation**                                   | Neither (not implemented)          | —                                                                                     | **FastAPI**                     | Embedding models are heavyweight; they belong in the dedicated worker process.                                                                           |
| **LLM calls (semantic extraction / verification)**          | NestJS (client) → FastAPI (server) | `AiDocumentExtractor.extract` → `fetch` to `/api/v1/extract`                          | **FastAPI** (server side)       | The LLM inference should be performed inside the worker; NestJS should only act as a thin HTTP client.                                                   |
| **Requirement extraction (primary)**                        | FastAPI (worker)                   | `ProductionExtractionPipeline.execute` → `default_tender_extractor`                   | **Yes** (stay in FastAPI)       | This is the core AI‑driven extraction logic; it must run in the worker to avoid coupling to request latency.                                             |
| **Requirement extraction (fallback regex)**                 | NestJS                             | `DocumentsService.extractLocallyFromPages` (used when FastAPI fails)                  | **No**                          | Duplicate logic; should be removed once the worker path is reliable.                                                                                     |
| **Compliance item generation**                              | NestJS                             | `markExtractionComplete` → Drizzle INSERT `compliance_items`                          | **No**                          | Generation of compliance candidates belongs to the extraction pipeline; persistence can stay in NestJS but creation logic should be moved to the worker. |
| **Compliance consolidation / deduplication**                | NestJS                             | `consolidateExtractedItems` in `DocumentsService`                                     | **No**                          | Part of the extraction workflow; should be performed by the worker before persisting.                                                                    |
| **Bid status / metrics update**                             | NestJS                             | `markExtractionComplete` → UPDATE `bids` table                                        | **Yes**                         | This is domain‑specific state that belongs to the NestJS bid aggregate.                                                                                  |
| **Audit logging**                                           | NestJS                             | `markExtractionComplete` → INSERT `audit_logs`                                        | **Yes**                         | Audit events are part of the request‑scoped transaction and must remain in NestJS.                                                                       |
| **Upload URL generation**                                   | NestJS                             | `DocumentsController.generateUploadUrl` → `StorageService.generatePresignedUploadUrl` | **Yes**                         | Authentication, tenant scoping, and URL signing are API‑layer concerns.                                                                                  |
| **Document metadata CRUD**                                  | NestJS                             | `DocumentsService` CRUD methods                                                       | **Yes**                         | Metadata persistence is part of the API contract.                                                                                                        |
| **Queue enqueue (job submission)**                          | NestJS                             | `DocumentsService.confirmUpload` → `IJobQueue.enqueue`                                | **Yes**                         | Job submission is an API operation; the worker only consumes.                                                                                            |
| **Download URL generation**                                 | NestJS                             | `DocumentsController.downloadUrl` → `StorageService.generatePresignedDownloadUrl`     | **Yes**                         | Tenant‑scoped signed URLs are API responsibilities.                                                                                                      |
| **SSE progress streaming**                                  | NestJS (fake)                      | `DocumentsController.streamExtractionProgress`                                        | **REDESIGN**                    | Real streaming must be driven by worker events; current fake implementation should be replaced.                                                          |

---

## Answers to Validation Questions

### 1. Is NestJS currently acting as a synchronous document‑processing engine?

**Yes.** The method `DocumentContentNormalizer.normalize` (and its synchronous fallback) runs `pdf-parse` synchronously inside the NestJS process, blocking the event loop. This occurs during the `markExtractionComplete` flow, which is invoked immediately after the HTTP request completes. Consequently, NestJS is currently performing PDF parsing, text extraction, and even rudimentary layout handling synchronously, which is not aligned with the intended asynchronous worker model.

### 2. What should remain in NestJS?

The following responsibilities belong in NestJS because they are tightly coupled to the request/response lifecycle, tenant scoping, and domain aggregates:

- Authentication & Authorization (JWT validation, RBAC)
- Upload URL generation and signed URL signing
- Document metadata CRUD (tender_documents table)
- Queue job submission (`IJobQueue.enqueue`)
- Bid aggregate updates (status, counters)
- Audit logging (immutable audit trail)
- Download URL generation
- Tenant context propagation (`TenantContextHolder`)

These operations must stay in the API layer to preserve security, idempotency, and proper request‑scoped transaction boundaries.

### 3. What should move to FastAPI?

All heavyweight, compute‑intensive, or asynchronous processing steps should be moved to the FastAPI worker:

- PDF parsing and OCR (including fallback parsing)
- Layout extraction and page segmentation
- Chunking and semantic normalization
- Embeddings generation
- Primary requirement extraction (the AI‑driven workflow)
- Compliance candidate generation (move logic out of `markExtractionComplete`)
- Compliance consolidation / deduplication
- Any deterministic fallback extraction currently residing in NestJS (remove after migration)

Moving these steps to FastAPI decouples the API from long‑running document processing, enables independent scaling of the worker, and allows proper retry, checkpoint, and observability mechanisms.

---

## Production Implementation Status

The service boundary separation is fully realized in production:
- Asynchronous queue choreography is mediated via `IJobQueue` (`AwsSqsJobQueue` / `GcpPubSubJobQueue`) and transactional outbox.
- FastAPI AI worker runs Docling Parser Engine, 3-tier Structural RAG, and the 12-node LangGraph extraction pipeline.
- Single-Writer Principle is enforced: NestJS `DocumentCompletionService` atomically persists verified compliance items, updates bid status, and writes immutable audit logs.
- Deterministic evaluation and eligibility analysis are mediated via `AiDecisionClient` and `compliance-item.mapper.ts`.

_This file captures the current service boundary analysis and is version‑controlled alongside the related architectural documentation._
