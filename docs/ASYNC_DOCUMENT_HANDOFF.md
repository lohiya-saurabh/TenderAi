# Async Document Handoff — Current Implementation

## Implementation update

`DocumentsService.confirmUpload()` now uses an outbox instead of a best-effort direct queue call:

1. It requires `headObject(storagePath)` to confirm a non-empty object.
2. One PostgreSQL transaction writes `tender_documents`, sets the bid to `QUEUED`, writes the upload audit record, and inserts `document_processing_outbox`.
3. The registered `DocumentProcessingRuntime` claims outbox entries with a five-minute recovery lease, publishes through `IJobQueue`, and retries failed publications with backoff.
4. The same NestJS runtime polls the queue, processes jobs, and ACKs only after the result transaction commits.

The queue payload is metadata only: `jobId`, organization/tenant ID, company ID, bid ID, document ID, stable workflow/correlation IDs, exact `storageReference`, document type, filename, and timestamp. No PDF bytes are sent. The consumer verifies those claims against PostgreSQL before using the object key.

Provider choice is still runtime configuration: SQS takes precedence, then Pub/Sub; local environments use `MockSqsJobQueue`. Production startup now fails if neither real provider is configured. `AWS_SQS_DLQ_URL` / `GCP_PUBSUB_DLQ_TOPIC` must be configured for the manual DLQ path to complete; missing DLQ configuration is an explicit error and does not ACK the source message.

**Boundary limitation:** the consumer currently lives in NestJS, not FastAPI. It retrieves/parses in NestJS and sends normalized page text to FastAPI; FastAPI remains an HTTP extraction service and does not consume the queue or persist PostgreSQL results.

This documents the implemented handoff from NestJS upload confirmation to a queue and the state of the consumer integration. It distinguishes configured adapters and test code from the production runtime path.

## Summary

| Item | Current implementation |
|---|---|
| **Producer** | `DocumentsController.confirmUpload()` → `DocumentsService.confirmUpload()` → transactional `document_processing_outbox` |
| **Queue provider** | `AwsSqsJobQueue`, `GcpPubSubJobQueue`, or `MockSqsJobQueue` for non-production; production requires SQS or Pub/Sub configuration. |
| **Topic/Queue** | Runtime environment values: `AWS_SQS_QUEUE_URL` (takes precedence) or `GCP_PUBSUB_TOPIC` plus `GCP_PUBSUB_SUBSCRIPTION`. Deployment-specific names are not determined by source code. |
| **Consumer** | Registered NestJS `DocumentProcessingRuntime`; FastAPI remains HTTP-only and does not subscribe/pull messages. |
| **Message schema** | JSON `IngestionJobMessage` with stable job ID and tenant/company/bid/document/workflow/correlation/storage context; no document bytes. |
| **Object reference** | Exact persisted `storagePath` carried as `storageReference`, such as `tenants/<organizationId>/bids/<bidId>/<documentId>/<fileName>`. |

## Historical pre-outbox audit

The following analysis describes the implementation before the outbox/runtime milestone and is retained for context.

The active controller route is `POST /api/v1/bids/:bidId/documents/confirm`. It calls `DocumentsService.confirmUpload()`; this is the runtime producer path, rather than `ConfirmDocumentUploadUseCase`.

`DocumentsService.confirmUpload()` resolves the tenant/bid and document metadata, makes two `headObject(storagePath)` calls when storage is available, writes the document row and audit record, then attempts to enqueue the job if the optional queue is injected. The browser uploads through the URL returned by `POST /api/v1/bids/:bidId/upload-url`; NestJS derives the storage key when generating that URL.

### Object-existence verification is not a publish gate

The current service logs a warning if `headObject` reports a missing/empty object or throws, but it continues to persist metadata and attempt queue publication. Thus the active controller path does **not** guarantee that an uploaded object exists before publishing.

There is a separate `ConfirmDocumentUploadUseCase.execute()` that calls `headObject` and throws if the object is absent or the size differs. However, the `DocumentsController.confirmUpload()` route above invokes `DocumentsService.confirmUpload()` directly; the stricter use case is not the guard for this endpoint.

Also note that `DocumentsService.confirmUpload()` catches queue publication errors and logs a warning before returning success. The API response can therefore report upload confirmation even when no durable queue handoff occurred.

## Provider selection and configuration

`QueueModule` registers `QUEUE_TOKEN` globally and chooses its adapter in this order:

1. `AWS_SQS_QUEUE_URL` set → `AwsSqsJobQueue`; optional `AWS_SQS_DLQ_URL`, `AWS_REGION` (default `ap-south-1`), and `SQS_ENDPOINT`.
2. Otherwise, all of `GCP_PROJECT_ID`, `GCP_PUBSUB_TOPIC`, and `GCP_PUBSUB_SUBSCRIPTION` set → `GcpPubSubJobQueue`; optional `GCP_PUBSUB_DLQ_TOPIC`, credentials via `GOOGLE_APPLICATION_CREDENTIALS`, and emulator endpoint via `PUBSUB_EMULATOR_HOST`.
3. Otherwise → `MockSqsJobQueue` (in-memory).

When both provider configurations are present, SQS wins because its check runs first.

The checked-in templates and Compose wiring use different names: `.env.example`/`docker-compose.yml` refer to `SQS_INGESTION_QUEUE_URL`, `INGESTION_QUEUE_TOPIC`, and `INGESTION_QUEUE_SUBSCRIPTION`; `.env.gcp.example` also uses `INGESTION_QUEUE_TOPIC` and `INGESTION_QUEUE_SUBSCRIPTION`. `QueueModule` does not read these names. The sample GCP file sets `GCP_PROJECT_ID`, but does not set the `GCP_PUBSUB_TOPIC` and `GCP_PUBSUB_SUBSCRIPTION` variables needed to select Pub/Sub. Consequently, those samples alone select the mock queue, not SQS or Pub/Sub.

The source defines adapter behavior but does not establish the actual production topic/queue name. Terraform/ADR and adapter tests contain example names; they are not proof that the running service is configured to use those names.

## Message schema

`IJobQueue.enqueue()` accepts `IngestionJobMessage`; the SQS and Pub/Sub adapters serialize the object as JSON. The active `DocumentsService.confirmUpload()` producer supplies:

| JSON field | Type in interface | Supplied by producer? | Meaning |
|---|---|---:|---|
| `jobId` | `string` | Yes | Generated ingestion job identifier |
| `organizationId` | `string` | Yes | Tenant/organization context; field is not named `tenant_id` |
| `companyId` | `string?` | Yes, possibly `undefined` | Company context |
| `bidId` | `string` | Yes | Bid identifier; there is no separate `tenderId` field |
| `documentId` | `string` | Yes | Uploaded document identifier |
| `workflowRunId` | `string?` | Yes | Workflow correlation context |
| `correlationId` | `string?` | Yes | Request/job correlation context |
| `storageReference` | `string?` | Yes | Object key (`storagePath`); not PDF bytes |
| `documentType` | `string?` | Yes | Document type |
| `fileName` | `string?` | Yes | Original file name |
| `timestamp` | `string` | Yes | ISO timestamp |

There is no `eventType` or `DocumentProcessingRequested` discriminator in the interface/payload; the message is represented as an `IngestionJobMessage`. Optional fields whose runtime value is `undefined` may be omitted when JSON is serialized.

The message contains a storage reference and workflow identifiers rather than the PDF binary, matching the desired small-message handoff.

## Consumer status: queue and FastAPI are not connected

There are two separate pieces of implementation, but they do not form an end-to-end production consumer:

- `apps/api/src/modules/bids/application/IngestionWorker.ts` has `pollAndProcess()`, which calls the `IJobQueue.receiveMessages()` port and processes a message. Repository references show its construction/use in E2E tests; it is not registered as a NestJS provider or started by the application module.
- FastAPI exposes `POST /api/v1/worker/process-message` in `apps/ai/src/tenderpulse_ai/main.py`. It is an HTTP endpoint, not a queue listener: it accepts a posted request and does not pull from SQS/Pub/Sub.
- No production code was found that forwards the queue message from an actual queue poller to that FastAPI endpoint. Nor is the NestJS `IngestionWorker` wired to call this FastAPI route; its extractor is an injected interface and its default implementation returns fixed sample items.

Therefore the demonstrated implementation is **NestJS upload confirmation → configured queue adapter (or mock)**. The next arrow, **MessageQueue → FastAPI Worker**, is not wired in the production runtime. The FastAPI endpoint is available for an HTTP caller, but it is not itself the consumer.

The endpoint's `StorageDocumentResolver` is also not a production object-storage adapter: it resolves a hard-coded fixture, reads a local path, or constructs fallback text. It does not use the NestJS object-storage provider to fetch the object. This does not establish real object retrieval from GCS/S3.

## Actual call chain

```text
POST /api/v1/bids/:bidId/upload-url
  → DocumentsController.generateUploadUrl()
  → DocumentsService.generateUploadUrl()
  → IStorageService.generatePresignedUploadUrl(storagePath, ...)

Browser uploads PDF bytes to returned URL

POST /api/v1/bids/:bidId/documents/confirm
  → DocumentsController.confirmUpload()
  → DocumentsService.confirmUpload()
      → best-effort IStorageService.headObject(storagePath)
      → persist tender_documents metadata and audit log
      → optional IJobQueue.enqueue(IngestionJobMessage)
          → AwsSqsJobQueue, GcpPubSubJobQueue, or MockSqsJobQueue

No production queue-consumer connection found:
  MessageQueue  -/-> IngestionWorker (NestJS class is exercised in tests)
  MessageQueue  -/-> FastAPI POST /api/v1/worker/process-message
```

## Findings against the intended handoff

- **Keep:** a small message containing document identity, tenant/workflow context, and a storage key; the PDF bytes are not put on the queue.
- **Mismatch:** the active service logs and proceeds on a failed/missing-object check instead of refusing to publish.
- **Mismatch:** configured provider variable names differ from the names in the checked-in examples and Compose file, so the examples do not select the advertised cloud adapters.
- **Gap:** no active queue consumer is wired to FastAPI.
- **Gap:** the queue message is not explicitly named `DocumentProcessingRequested`, and tenant/tender fields use `organizationId`/`bidId` names rather than `tenant_id`/`tender_id`.
- **Gap:** queue publication failure is swallowed by `DocumentsService.confirmUpload()` after warning; the caller can still receive a success-shaped confirmation.

No implementation changes are included in this document.
