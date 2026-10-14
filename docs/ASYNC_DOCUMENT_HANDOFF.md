# Asynchronous Document Ingestion & Compliance Persistence Architecture (Design B)

## 1. Executive Summary & Architectural Overview

TenderPulse uses a **decoupled, two-tier asynchronous architecture** for tender document ingestion and AI-driven compliance extraction, conforming to **Design B (Asynchronous Event Choreography)**.

In Indian public procurement, tender documents typically span 50 to 500+ pages of dense, multi-schedule legal conditions. Synchronous HTTP extraction causes reverse proxy timeouts (HTTP 504), Node.js event-loop starvation, and complete loss of progress on transient network or model failures.

To solve this, TenderPulse separates responsibilities across two services using cloud-agnostic ports and adapters:

- **Application & Ingestion Tier (`apps/api` - NestJS / TypeScript)**: Manages authenticated client uploads, enforces multi-tenant boundaries, writes durable outbox records, publishes to the Ingestion Queue, polls the dedicated Completion Queue, and serves as the **exclusive, atomic single-writer to PostgreSQL**.
- **AI Extraction & Intelligence Worker Tier (`apps/ai` - FastAPI / Python)**: Executes as a direct queue consumer worker (`DocumentQueueConsumerWorker`), maintaining visibility heartbeats during extraction, parsing PDF layout structures (Docling AST), executing LangGraph compliance workflows, and publishing completion events to the dedicated Completion Queue before acknowledging the ingestion message.

```mermaid
sequenceDiagram
    autonumber
    actor User as Bid Manager
    participant Web as Web Client (React)
    participant S3 as Object Storage (S3 / GCS)
    participant API as API Server (NestJS)
    participant DB as PostgreSQL (Drizzle ORM)
    participant IngestQ as Ingestion Queue (SQS / PubSub)
    participant AI as AI Worker (Python Consumer)
    participant CompQ as Completion Queue (SQS / PubSub)

    User->>API: 1. POST /api/v1/bids/:id/upload-url
    API-->>User: Presigned PUT URL + storagePath
    User->>S3: 2. Direct PUT document.pdf (bytes)
    User->>API: 3. POST /api/v1/bids/:id/documents/confirm
    API->>S3: 4. headObject(storagePath) verify
    API->>DB: 5. Atomic Tx: tender_documents + Outbox record + Bid=QUEUED
    API-->>User: 200 OK { documentId, status: "QUEUED" }

    Note over API,IngestQ: Outbox Poller & Ingestion Queue Dispatch
    API->>DB: 6. Claim Outbox (5-min lease)
    API->>IngestQ: 7. Enqueue IngestionJobMessage (metadata only)
    API->>DB: 8. Mark Outbox record PUBLISHED

    Note over IngestQ,AI: Direct Python Ingestion Queue Worker
    AI->>IngestQ: 9. Long-poll Ingestion Queue message
    AI->>IngestQ: 10. Background heartbeat (Visibility extension every 60s)
    AI->>S3: 11. Fetch PDF / Parse via Docling Layout AST
    AI->>AI: 12. Run LangGraph Workflow (Extract -> AST Grounding)
    AI->>CompQ: 13. Publish DocumentExtractionCompletedEvent
    AI->>IngestQ: 14. Acknowledge / Delete Ingestion Queue Message

    Note over CompQ,DB: NestJS Completion Consumer & Atomic Single-Writer Persistence
    API->>CompQ: 15. Poll DocumentExtractionCompletedEvent
    API->>DB: 16. Atomic Tx: Verify tenant -> Purge stale doc items -> Insert compliance_items -> Update Bid status -> Update doc=COMPLETED -> Write audit log
    API->>CompQ: 17. Acknowledge / Delete Completion Queue Message
```

---

## 2. Ingestion & Outbox Stage (NestJS)

### 2.1 Direct-to-Storage Upload Handshake

1. The client requests a presigned upload URL via `POST /api/v1/bids/:id/upload-url`.
2. The API derives a tenant-isolated storage path: `tenants/{organizationId}/bids/{bidId}/{documentId}/{fileName}`.
3. The client uploads raw PDF bytes directly to object storage via HTTP PUT. Raw document bytes never traverse the API process memory.

### 2.2 Upload Confirmation & Transactional Outbox

1. The client confirms the upload via `POST /api/v1/bids/:id/documents/confirm`.
2. The server verifies physical object presence and non-zero size via `IStorageService.headObject(storagePath)`.
3. An atomic PostgreSQL transaction performs four operations:
   - Inserts the `tender_documents` row (`status = 'PENDING'`).
   - Updates `bids.status = 'QUEUED'`.
   - Inserts an audit event `DOCUMENT_UPLOADED`.
   - Inserts an outbox record into `document_processing_outbox`.

### 2.3 Outbox Record Schema

```typescript
{
  id: string; // UUID
  organizationId: string;
  companyId: string;
  bidId: string;
  documentId: string;
  payload: IngestionJobMessage;
  status: 'PENDING' | 'CLAIMED' | 'PUBLISHED' | 'FAILED';
  leaseExpiresAt?: Date;
  retryCount: number;
  lastError?: string;
  createdAt: Date;
}
```

---

## 3. Queue Dispatch & Consumer Runtime (NestJS)

### 3.1 Outbox Poller & Durable Ingestion Dispatch

`DocumentProcessingRuntime` runs in the API application and handles durable handoff:

- Queries `document_processing_outbox` for `PENDING` records or expired leases (`leaseExpiresAt < NOW()`).
- Claims records using optimistic concurrency (`UPDATE ... WHERE status = 'PENDING'`).
- Dispatches the payload to the configured Ingestion Queue (`INGESTION_QUEUE_TOKEN`).
- Marks the outbox row as `PUBLISHED`.
- **Zero Ingestion Consumption by NestJS**: NestJS strictly operates as the **producer** of the Ingestion Queue and never polls or consumes it. Python's `DocumentQueueConsumerWorker` is the exclusive consumer of the Ingestion Queue.
- **Dedicated Completion Consumption**: NestJS strictly operates as the **consumer** of the Completion Queue (`COMPLETION_QUEUE_TOKEN`), receiving `DocumentExtractionCompletedEvent` messages to perform single-writer PostgreSQL persistence.

### 3.2 Dedicated Two-Queue Architecture (`IJobQueue`)

To prevent message multiplexing, eliminate premature message deletion, and isolate traffic channels, the system provisions two independent queues:

1. **Ingestion Queue (`INGESTION_QUEUE_TOKEN`)**:
   - **Publisher**: NestJS Outbox Poller (`DocumentProcessingRuntime`).
   - **Consumer**: Python AI Worker (`DocumentQueueConsumerWorker`).
   - **Payload**: `IngestionJobMessage` (metadata, tenant context, storage pointer).
   - **Adapters**: AWS SQS (`AWS_INGESTION_QUEUE_URL`), GCP Pub/Sub (`GCP_INGESTION_SUBSCRIPTION`), or Mock.

2. **Completion Queue (`COMPLETION_QUEUE_TOKEN`)**:
   - **Publisher**: Python AI Worker (`CompletionPublisher`).
   - **Consumer**: NestJS Completion Poller (`DocumentProcessingRuntime`).
   - **Payload**: `DocumentExtractionCompletedEvent` (extracted compliance items, provenance, confidence scores).
   - **Adapters**: AWS SQS (`COMPLETION_QUEUE_URL`), GCP Pub/Sub (`COMPLETION_PUBSUB_TOPIC`), or Mock.

### 3.3 Message Payload Contract (`IngestionJobMessage`)

The ingestion message carries metadata only; raw PDF bytes are never placed in message queues:

```json
{
  "jobId": "job-550e8400-e29b-41d4-a716-446655440000",
  "organizationId": "org-tenant-alpha",
  "companyId": "comp-12345",
  "bidId": "bid-98765",
  "documentId": "doc-54321",
  "workflowRunId": "wf-112233",
  "correlationId": "corr-445566",
  "storageReference": "tenants/org-tenant-alpha/bids/bid-98765/doc-54321/nit_volume_1.pdf",
  "documentType": "TENDER_NOTICE",
  "fileName": "nit_volume_1.pdf",
  "timestamp": "2026-10-08T02:00:00.000Z"
}
```

---

## 4. AI Worker & Extraction Pipeline (FastAPI)

### 4.1 Direct Queue Consumer Worker (`DocumentQueueConsumerWorker`)

The AI worker runs an asynchronous daemon consumer in its application lifecycle (`apps/ai/src/tenderpulse_ai/infrastructure/queue/worker.py`):

1. **Long-Polling**: Continuously polls the Ingestion Queue with configurable `visibility_timeout` (default 300s) and `poll_interval` (default 2s).
2. **Heartbeat Visibility Extension**: Spawns a background task that extends message visibility every 60 seconds (`change_message_visibility`) to ensure long-running 100+ page extractions are not reclaimed by peer workers.
3. **Execution Pipeline**: Downloads PDF directly from ObjectStorage using `storageReference`, parses document layout AST via Docling, and executes the LangGraph compliance extraction graph.
4. **Publish-Before-Ack Guarantee**: Publishes `DocumentExtractionCompletedEvent` to the Completion Queue, and ONLY THEN calls `ack()` on the Ingestion Queue message. If extraction or publish fails, the message is not acked and will be redelivered or routed to DLQ upon reaching max retries.
5. **HTTP Fallback Endpoint**: Still supports `POST /api/v1/extract` and `POST /api/v1/worker/process-message` protected by `X-Internal-Service-Key` for synchronous debugging and test suites.
- **Security Context**: Tenant and company context are passed directly in the verified request, establishing an immutable `SecurityContext`.

### 4.2 Document Parsing, AST Hierarchy & Precomputation Hoisting

1. **Blocks vs. Nodes Abstraction**:
   - **`DoclingBlock`**: Represents physical layout blocks on each page (paragraphs, headings, lists) preserving visual bounding box coordinates (`bbox: [x0, y0, x1, y1]`) and verbatim text.
   - **`SectionNode`**: Represents the hierarchical legal outline constructed by `DocumentStructureBuilder` (`PART > SECTION > CLAUSE`), maintaining parent-child tree lineage and owning lists of physical `block_ids`.
   - **`DoclingTable`**: Multimodal table AST parser with Markdown serialization (`to_markdown()`) and cell coordinate querying (`to_dict_records()`).
2. **Hoisted Document Precomputation**:
   - In multi-page tender processing, `DoclingParserEngine`, `DocumentStructureBuilder`, `CandidateDetector`, and `ContextAssembler` execute once at the document level before page parallelization.
   - When each page's LangGraph pipeline initializes, `docling_parse_node` and `build_structure_node` detect pre-computed structures in state and short-circuit in 0ms, eliminating $O(N^2)$ PDF parsing and redundant pre-processing.
3. **Table of Contents (TOC) & Boilerplate Filtering**:
   - Cross-page repeating boilerplate algorithm identifies identical running headers and footers appearing across $\ge 3$ distinct pages, stripping noise while preserving short operative instructions occurring on 1 or 2 pages.

### 4.3 Stateful LangGraph Extraction Workflow (Two-Tier Architecture)

The extraction engine executes a stateful, cyclic LangGraph state machine implementing **High-Recall Candidate Scoring & Two-Tier Triage (ADR 0028)**:

1. **`docling_parse` & `build_structure`**: Ingests physical `DoclingBlock`s and constructs the `DocumentStructureTree` AST.
2. **`candidate_detection`**:
   - Runs rule matching across 20+ statutory procurement categories.
   - Performs **Context Fusion**: evaluates candidate rules against `f"{section_title} - {block_text}"` so un-keyworded clauses inside requirement sections are recognized.
   - Assigns normalized priority scores ($0.0 - 1.0$) based on category severity (EMD, PBG, debarment, stamp paper, turnover).
   - Partitions passages into Tier-1 `PRIMARY` candidates and Tier-2 `unselected` passages.
3. **`context_assembly`**: Constructs isolated prompt context envelopes ($\le 24,000$ chars) containing preceding/following clauses and statutory definitions inside `<untrusted_document_data>` tags.
4. **`llm_extraction` (Tier 1 Primary)**: Structured-output LLM generates `CandidateComplianceItem` list from high-priority candidates.
5. **`rescue_pass` (Tier 2 Node 5B)**: Dedicated safety-net node sweeping Tier-2 `unselected` passages in compact batches to catch un-keyworded or split clauses, tagging them with `extraction_tier="RESCUE"`.
6. **`validation`**: Pure Python deterministic substring verification asserting that every extracted `verbatim_quote` exists character-for-character within the source text.
7. **`confidence_routing` & Bounded Refinement**:
   - If `len(unverified) > 0 and retry_count < 2`: routes to `targeted_refine` with error feedback.
   - If `len(unverified) == 0 and confidence_score < 0.80`: routes directly to human review without wasting LLM calls on futile retries.
   - If `len(unverified) == 0 and confidence_score >= 0.80`: routes to completion.
8. **`human_review` & Single-Writer Persistence**:
   - Calls LangGraph's native `interrupt()`, snapshotting state to PostgreSQL.
   - Emits `DocumentExtractionCompletedEvent` to the Completion Queue for single-writer PostgreSQL persistence.

---

## 5. Asynchronous Completion Event Dispatch (FastAPI)

Upon workflow completion, the AI worker publishes a `DocumentExtractionCompletedEvent` via `CompletionPublisher`:

### 5.1 Event Contract Schema

```json
{
  "eventId": "evt-778899",
  "eventType": "DocumentExtractionCompleted",
  "documentId": "doc-54321",
  "bidId": "bid-98765",
  "organizationId": "org-tenant-alpha",
  "companyId": "comp-12345",
  "status": "SUCCESS",
  "extractedCount": 18,
  "extractedItems": [
    {
      "title": "Earnest Money Deposit (EMD)",
      "category": "FINANCIAL",
      "description": "Bidder shall submit an Earnest Money Deposit of INR 50,00,000 in the form of Bank Guarantee.",
      "executionRules": {
        "isMandatory": true,
        "penalties": "Forfeiture of bid security",
        "gracePeriodDays": 0
      },
      "provenance": {
        "documentId": "doc-54321",
        "documentName": "nit_volume_1.pdf",
        "pageNumber": 14,
        "clauseReference": "Clause 4.2.1",
        "verbatimQuote": "The Bidder shall furnish, as part of its Bid, a Bid Security amounting to INR 50,00,000...",
        "confidenceScore": 0.98
      },
      "isVerified": true,
      "confidenceScore": 0.98
    }
  ],
  "workflowRunId": "wf-112233",
  "traceId": "trace-998877",
  "correlationId": "corr-445566",
  "timestamp": "2026-10-08T02:05:00.000Z"
}
```

### 5.2 Completion Publisher Adapters

- **GCP Pub/Sub (`GcpPubSubCompletionPublisher`)**: Publishes to configured topic.
- **AWS SQS (`AwsSqsCompletionPublisher`)**: Sends message to configured completion queue.
- **Mock Publisher (`MockCompletionPublisher`)**: Records events in memory during test execution.

---

## 6. Atomic Single-Writer PostgreSQL Persistence (NestJS)

To maintain absolute data integrity and prevent race conditions, **the AI worker never writes directly to PostgreSQL**. NestJS `DocumentCompletionService` acts as the **exclusive single writer**.

### 6.1 Database Schema (`compliance_items`)

```sql
CREATE TABLE compliance_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    company_id UUID REFERENCES companies(id),
    bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'EXTRACTED',
    human_review_required BOOLEAN NOT NULL DEFAULT FALSE,
    execution_rules JSONB DEFAULT '{}'::jsonb,
    provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
    workflow_run_id VARCHAR(100),
    correlation_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 6.2 Transactional Persistence Flow

When `DocumentCompletionService.handleExtractionCompleted(event)` receives the event:

1. **Authorization & Tenant Re-Derivation**:
   - Re-queries `bids` and `tender_documents` from PostgreSQL using `organization_id`.
   - If `bid.organization_id !== event.organizationId` or `doc.bid_id !== event.bidId`, aborts immediately with `ForbiddenException`.
2. **PostgreSQL Transaction Acquisition**:
   - Acquires row-level locks on `bids` and `tender_documents`.
3. **Idempotent Document Clean-up**:
   - Deletes any existing `compliance_items` associated with `event.documentId` in `provenance->>'documentId'`. This ensures safe retries and prevents duplicate entries.
4. **Deterministic Batch Insert**:
   - Generates deterministic UUIDs (`UUIDv5` based on `bidId + documentId + clauseReference + index`).
   - Inserts all extracted items in a single SQL `INSERT INTO compliance_items VALUES (...)` batch.
5. **Bid Status & Counters Recalculation**:
   - Computes total requirements count and high-risk requirement counts.
   - Updates `bids.status = 'IN_PROGRESS'` (or `'ACTIVE'`).
   - Updates `tender_documents.status = 'COMPLETED'`.
6. **Audit Trail Recording**:
   - Inserts an `audit_logs` record with event `AI_INGESTION_COMPLETED`.
7. **Queue Message Acknowledgment**:
   - The queue message is deleted/acknowledged **only after the PostgreSQL transaction successfully commits**.

---

## 7. Reliability, Retries & Dead Letter Queues (DLQ)

### 7.1 Distributed Delivery & Idempotency

- **At-Least-Once Delivery Guarantee**: Distributed brokers (AWS SQS, GCP Pub/Sub) guarantee that every message is delivered at least once. Duplicate deliveries occur during network partitions or acknowledgment latency.
- **Strict Idempotency**: All consumers and database persisters are idempotent. Existing document extraction items are purged within the database transaction prior to inserting newly extracted items with deterministic UUIDs.

### 7.2 Visibility Timeout, Heartbeats & Exponential Backoff

- **Visibility Timeout (Leases)**: When a worker receives a message, the broker starts a visibility timeout clock (default: 300 seconds). During this window, the message is hidden from peer workers.
- **Heartbeat Renewal**: For long-running extractions, `DocumentProcessingRuntime` periodically renews visibility via a background heartbeat interval (`changeMessageVisibility`).
- **Exponential Backoff with Jitter**: Transient errors (e.g. rate limits or brief network partitions) trigger exponential retry backoff:
  $$\text{Timeout} = \min(\text{InitialTimeout} \times 2^{\text{attempt}}, \text{MaxTimeout}) + \text{jitter}$$

### 7.3 Dead Letter Queues (DLQ) & Poison Pill Mitigation

- **Poison Pills**: Malformed or unparseable payloads (corrupted binaries or malformed schemas) fail every processing attempt.
- **Max Receive Limit**: If a message fails `maxReceiveCount` times (default: 3 attempts), the message broker routes it directly to a dedicated Dead-Letter Queue (DLQ).
- **Terminal State**: NestJS transitions the document state to `DEAD_LETTER`, records `last_processing_error`, and emits a critical operational alert without infinitely looping.

### 7.4 Failure Matrix & Recovery Mechanisms

| Failure Scenario                              | Recovery Mechanism                                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Storage unavailable during confirmation**   | `headObject` fails before database write; returns HTTP 400/404; no orphaned DB row.                                            |
| **Outbox publication failure**                | Outbox record remains `PENDING`; retry poller picks it up with exponential backoff.                                            |
| **AI Worker process crash during extraction** | Visibility timeout expires on message queue; message is redelivered to available worker.                                       |
| **Persistence transaction rollback**          | Queue message remains unacknowledged; will be retried up to `maxReceiveCount`.                                                 |
| **Exceeded max retries (Poison message)**     | Queue provider routes message to configured Dead Letter Queue (`AWS_SQS_DLQ_URL` / `GCP_PUBSUB_DLQ_TOPIC`).                    |
| **Replay / Redelivery**                       | Safe and idempotent: document rows are cleaned up inside the transaction before re-inserting new items with deterministic IDs. |

---

## 8. Summary of Architectural Decisions & Invariants

1. **Cloud-Provider Agnostic**: All queues, object storage, and event publishers use ports and adapters. Swapping AWS and GCP requires zero business logic changes.
2. **Never Trust the LLM for Authorization**: Tenant isolation and ownership are verified from trusted PostgreSQL rows, never from LLM outputs or untrusted client headers.
3. **Single Writer Principle**: Only the NestJS API writes to PostgreSQL. The AI worker is a pure computational service that receives inputs and emits events.
4. **Persist-Before-Ack**: A message is acknowledged if and only if its persistent side effects have successfully committed to the database.
