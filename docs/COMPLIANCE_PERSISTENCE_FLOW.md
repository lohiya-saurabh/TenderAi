# Compliance Persistence Flow — Current Implementation

## Implementation update

The production NestJS queue runtime now has a third persistence path; the earlier statements below about active upload processing describe the pre-runtime system.

`DocumentProcessingRuntime.persistResults()` validates the tenant/bid/company/document association under transaction locks, replaces only rows attributed to the source document, inserts deterministic `compliance_items` IDs with `company_id`, workflow/correlation IDs, and provenance, recalculates bid counters/status, marks the document `COMPLETED`, and writes the processing audit record in one Drizzle/PostgreSQL transaction. Queue acknowledgement happens only after that transaction resolves.

The legacy `DocumentsService.markExtractionComplete()` and test-oriented in-memory `IngestionWorker` still exist, but the upload-confirm route does not call the legacy method and the registered production runtime does not use the in-memory worker repository. PGlite tests verify the runtime transaction/result boundary; cloud PostgreSQL deployment behavior remains to be verified.

This is a persistence trace of the existing schema and callers. It does not add a new table or change the schema.

## Summary answers

| Question | Current answer |
|---|---|
| **Which table stores requirements?** | `compliance_items` stores extracted requirement-like items as `title`, `description`, `category`, and `execution_rules`. There is no separate tender-requirement table in the Drizzle schema. |
| **Which table stores compliance assessments?** | The same `compliance_items` row stores item-level review state (`status`, `human_review_required`, notes/reviewer/timestamp), company evidence, risk, and rationale as columns/JSONB. `bid_decisions` stores a separate bid-level decision/verdict and response; it is not the item requirement table. |
| **Which table connects them to the tender?** | `compliance_items.bid_id` identifies the bid/tender aggregate (`bids.id`). `tender_documents.bid_id` similarly connects source documents to that bid. |
| **Which table connects them to the company?** | `bids.company_id` connects the tender/bid to `companies.id`. `compliance_items.company_id` exists but is nullable and has no declared FK in this schema. The current legacy extraction writer does not populate it. |
| **Where is document source stored?** | `tender_documents.storage_path` stores the object key. Each legacy-extracted compliance item's `provenance` JSONB stores `documentId` and `documentName` (no relational FK to `tender_documents`). |
| **Where are page/source citations stored?** | `compliance_items.provenance` JSONB: `pageNumber`, `sectionOrClause`, `verbatimQuote`, and `confidenceScore`. The domain `Provenance` also models source document/file name, page, clause, quote, and confidence. |
| **Are writes transactional?** | The active legacy `DocumentsService.markExtractionComplete()` writes row-by-row and updates bid/audit separately, without an explicit transaction. The present `DirectUnitOfWork` is a pass-through and does not open a database transaction. |
| **What if persistence fails halfway?** | Already completed statements may remain committed: some inserted items (or a prior delete) can persist while later items, bid counters/status, and audit do not. There is no rollback boundary in that path. |

## Data model

The schema lives in `apps/api/src/common/database/schema.ts`:

```text
companies
  ↑ bids.company_id
bids (tender/bid aggregate)
  ├─ tender_documents.bid_id
  └─ compliance_items.bid_id
       ├─ organization_id
       ├─ company_id?                 nullable
       ├─ title / description / category
       ├─ status / human_review_required / review fields
       ├─ execution_rules              JSONB
       ├─ provenance                   JSONB
       ├─ company_evidence / risk / rationale  JSONB
       └─ workflow_run_id? / correlation_id?   nullable

bid_decisions (separate bid-level verdict/readiness assessment)
```

`compliance_items.bid_id` has an FK to `bids.id`. `tender_documents.bid_id` does as well. The source document ID on a compliance item is only embedded in JSONB provenance in the direct writer; it is not declared as a foreign-key column. The schema has no distinct `tender_requirements`, `requirement_assessments`, or `compliance_assessments` table.

## Actual persistence paths

### A. Legacy NestJS direct-to-Drizzle path

`DocumentsService.markExtractionComplete(bidId, specificDocId?)`:

1. Selects the tender document metadata and storage reference.
2. Calls `AiDocumentExtractor.extract()`; if that throws, attempts an in-process fallback.
3. Consolidates output in memory.
4. If reprocessing a specific document, deletes prior `compliance_items` whose provenance JSON contains that document ID.
5. Inserts each extracted item separately into `compliance_items`.
6. Updates `bids.status` and requirement counters in a separate statement.
7. Inserts an `AI_INGESTION_COMPLETED` row into `audit_logs` separately.

The inserted `compliance_items` values include `bidId`, `organizationId`, category/title/description, execution rules, and JSONB provenance. They do not set `companyId`, `workflowRunId`, or `correlationId`, even though those columns exist.

The method remains present and tests invoke it directly, but `DocumentsController.confirmUpload()` calls `DocumentsService.confirmUpload()` instead. No call site was found connecting the controller upload-confirm path to `markExtractionComplete()`. Therefore this direct persistence route is not the queue worker's result-persistence path.

### B. Queue-oriented NestJS `IngestionWorker` path

The worker validates its job/document/bid using repositories, calls an `IDocumentExtractor`, constructs `ComplianceItem` domain entities, updates the bid/job, saves a batch and audit event inside `unitOfWork.withTransaction()`, then deletes the queue message.

Important runtime limitation: the checked-in `IComplianceItemRepository` has only an `InMemoryComplianceItemRepository` implementation. `IngestionWorker` is constructed in E2E tests with in-memory repositories; it is not registered as a production consumer/provider, and the verified test's unit of work is `DirectUnitOfWork`. Its apparent transaction is therefore neither a PostgreSQL transaction nor a durable SQL save in that test path.

The `ComplianceItem` entity and repository interface are valid domain abstractions, but do not themselves prove Postgres persistence. No Postgres implementation of `IComplianceItemRepository` was found.

### C. Bulk ingest use case

`BulkIngestComplianceUseCase` converts input to `ComplianceItem` entities, calls `saveBatch`, advances bid status, and records an audit event inside `unitOfWork.execute()`. It copies `companyId`, `workflowRunId`, and `correlationId` from input/command where available.

This is a separate application path. `ComplianceModule` currently registers `ComplianceController` and `ComplianceService` only; it does not register this use case, the `InternalWorkerController`, or a PostgreSQL compliance repository. The use-case tests use in-memory repositories and `DirectUnitOfWork`, so its “atomic” comment is not evidence of SQL transaction behavior in production.

## Context preservation

| Context | Schema capability | Legacy direct Drizzle writer | Queue-oriented worker entity/repository path | Bulk ingest use case |
|---|---|---|---|---|
| `tenant_id` | `organization_id` on compliance/document/bid rows | Writes `organizationId` | Sets `organizationId` from trusted bid record | Sets `organizationId` from trusted bid record |
| `company_id` | Required on `bids`; optional on `compliance_items` | **Not written** to item | **Not passed** into new `ComplianceItem` in current worker code | Copied from item or bid |
| `tender_id` | Represented by `bid_id` → `bids.id` | Writes `bidId` | Writes `bidId` | Writes `bidId` |
| `document_id` | JSONB provenance only; no item FK | Writes `provenance.documentId` | Writes `Provenance.sourceDocumentId` in the domain entity | Requires `provenance.sourceDocumentId` in the value object |
| `workflow_run_id` | Nullable `workflow_run_id` column | **Not written** | A worker run ID is built for `SecurityContext`, but **not supplied** to the `ComplianceItem` constructor | Written to entity from item/command |
| `correlation_id` | Nullable `correlation_id` column | **Not written** | **Not supplied** to `ComplianceItem` constructor | Written from item/command |

The FastAPI LangGraph pipeline returns formatted extraction items and its graph persistence node appends to `WorkflowNodeContext.persisted_records` (in memory). It does not write PostgreSQL. The HTTP worker-shaped route does not call `BulkIngestComplianceUseCase` or another persistence API.

## Transaction and failure behavior

### Active direct Drizzle writer

There is no encompassing SQL transaction around deletion/inserts/status/audit. Statements before a failure can remain durable. A failure during the insert loop can leave a subset of items, and a reprocess can first delete old document items and then fail before the replacement set is complete. Bid counters and status are only updated after the insert loop; audit is after that. `.onConflictDoNothing()` can also skip a colliding ID without surfacing that row as an error.

### `DirectUnitOfWork`

`apps/api/src/common/database/IUnitOfWork.ts` implements both `execute()` and `withTransaction()` as direct calls to the callback; it does not call Drizzle's transaction API. Thus callers using this implementation have no rollback guarantee for multiple operations.

## Frontend read path

The NestJS read route is:

```text
GET /api/v1/bids/:bidId/compliance-items
  → ComplianceController.list()
  → ComplianceService.listItems()
  → SELECT compliance_items
       WHERE bid_id = :bidId AND organization_id = resolved tenant
```

`ComplianceService.mapComplianceRecord()` maps persisted rows to the DTO shape, including `requirement` from `title`, `executionRules`, and `provenance`. The frontend `listComplianceItems(bidId)` calls that endpoint, and `BidDetailPage` uses it to load the compliance matrix. Existing service tests verify that direct-path persisted items can be listed from PGlite.

This proves a database-backed API read path exists; it does **not** prove the queue-oriented worker's extracted items reach it. The end-to-end test below instead confirms that the worker test writes only to its in-memory repository.

There is also a DTO-contract mismatch worth noting: the frontend type declares `isMandatory` and `sourceCitation` as required fields, while the current server mapper does not populate those fields. Do not infer those values from the TypeScript interface alone.

## Conclusion

The existing `compliance_items` table is the right current domain object for both extracted requirements and their item-level assessment/review state; no new table is needed merely because the product calls these rows “compliance items.” However, the queue-oriented FastAPI → result → Postgres persistence connection is absent. The legacy NestJS direct writer can populate Postgres but is not connected to the confirmed upload queue path, is non-transactional, and omits company/workflow/correlation context.

No schema or implementation changes were made.
