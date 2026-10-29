# Database

PostgreSQL 16 is the system of record. Only the NestJS API writes to it; the AI worker never connects. Source of truth: the Drizzle schema in `apps/api/src/common/database/schema/` and the migrations next to it. When either changes, update this file in the same commit.

## 1. Engine and clients

| Where             | Engine                                   | How                                                                                    |
| ----------------- | ---------------------------------------- | -------------------------------------------------------------------------------------- |
| Local development | PostgreSQL 16 (Homebrew `postgresql@16`) | `DATABASE_URL`; setup in [DEVELOPMENT.md](DEVELOPMENT.md)                              |
| AWS               | RDS PostgreSQL 16.4                      | `DATABASE_URL` from Secrets Manager, `DATABASE_SSL=verify-full` with the RDS CA bundle |
| Tests             | PGlite (in-memory Postgres)              | `PGLITE_DATA_DIR=memory://`; no server needed                                          |

- **Clients.** `common/database/client.ts` creates a node-postgres pool (`DATABASE_POOL_MAX`) or a PGlite instance. The API refuses to start without `DATABASE_URL`.
- **TLS.** `DATABASE_SSL` is `disable` (local), `require` or `verify-full` (with `DATABASE_SSL_CA_FILE`).

## 2. Migrations

- **Location.** Migrations are TypeScript files in `common/database/migrations/` (`0001_baseline.ts`, `0002_notifications_recipient_fk.ts`, `0003_user_invites.ts`, …), listed in `migrations/index.ts`.
- **How they run.** On startup the migrator applies pending migrations in order, each in its own transaction, and records each in `schema_migrations` with a checksum.
- **Concurrency.** A Postgres advisory lock makes several API instances, such as ECS tasks starting together, wait instead of racing.
- **Never edit an applied migration.** The checksum check refuses to start if one changed.

To change the schema, edit the Drizzle schema and add the next `NNNN_description.ts` with the matching SQL. Real-Postgres tests (`apps/api/src/test/postgres/`, enabled by `TEST_DATABASE_URL`) cover the driver, migrations, demo seed and outbox claiming.

## 3. Tables

All tenant data carries `organization_id`, and every query filters by it (see [SECURITY.md](SECURITY.md) §3). Ids are text. `created_at` and `updated_at` are timestamps with time zone.

**Tenancy and access**

| Table                            | Purpose                                                                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `organizations`                  | Tenant (name, slug, domain, logo)                                                                                                      |
| `tenant_settings`                | Default company, notification preferences                                                                                              |
| `subscriptions`, `usage_records` | Plan tier, billing period, metered usage                                                                                               |
| `users`                          | Login (bcrypt password), role, permissions; `invite_token_hash` + `invite_expires_at` while a one-time invite is open (migration 0003) |
| `refresh_tokens`                 | SHA-256 token hash, `revoked_at`, `expires_at`                                                                                         |

**Companies and evidence**

| Table                                          | Purpose                                                                                                               |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `companies`                                    | Legal identity (GSTIN, PAN, Udyam, CIN) with verification snapshots, onboarding preferences                           |
| `company_profiles`, `company_profile_versions` | Versioned capability profile; `active_version_id` points at the current one                                           |
| `company_evidence_documents`                   | Uploaded or imported certificates and financials, validity window, SHA-256, verification status, extracted attributes |
| `evidence_verification_history`                | Every verification status change                                                                                      |
| `company_evidence_chunks`                      | Chunks of evidence documents, with an optional embedding                                                              |

**Bids and tenders**

| Table                    | Purpose                                                                                                                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bids`                   | A tender being bid on: authority, value, deadline, status, requirement counters, `version` for optimistic locking                                                                                   |
| `tender_documents`       | Uploaded files: storage path, status (`QUEUED_FOR_EXTRACTION` → `PROCESSING` when the job is handed to the worker → `COMPLETED` / `FAILED`; `UPLOADED` is the column default), attempts, last error |
| `tender_document_chunks` | 3-tier chunks from the worker: page, section, clause reference, bounding box, `embedding` (JSONB vector plus model tag in `metadata`)                                                               |
| `bid_decisions`          | Bid-or-no-bid result per profile version: verdict, readiness score, full response                                                                                                                   |

**Clauses**

| Table                 | Purpose                                                                                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compliance_items`    | One row per extracted clause (below)                                                                                                                                                |
| `clause_conflicts`    | Contradicting values across clauses (`topic`, `attribute`, `conflict_values`), with `resolution` (`UNRESOLVED`, `ACCEPTED_VALUE`, `RESOLVED_BY_CORRIGENDUM`, …) and who resolved it |
| `extraction_coverage` | Per document: page count, `failed_pages` (`[{page, reason}]`), `status` `COMPLETE` / `PARTIAL`                                                                                      |

**System**

| Table                                 | Purpose                                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `document_processing_outbox`          | Pending ingestion jobs: `payload`, `status` (`PENDING` → `PUBLISHING` → `PUBLISHED`, or `FAILED`), attempts, `next_attempt_at`, `locked_at`, last error |
| `audit_logs`                          | Append-only trail: event type, aggregate, user, payload                                                                                                 |
| `notifications`                       | In-app notifications; `recipient_user_id` NULL means everyone in the organization (foreign key to `users` since migration 0002)                         |
| `chat_conversations`, `chat_messages` | Tender chat with tool calls and citations                                                                                                               |
| `schema_migrations`                   | Applied migrations and checksums                                                                                                                        |

## 4. `compliance_items`

The clause contract is shared end to end: `packages/shared-types/src/clause.ts` plus `schema/extraction-completed.schema.json`, with a golden fixture in the AI tests.

| Column(s)                                                                        | Meaning                                                                                                                                                              |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `item_key`                                                                       | Location key from `(document_id, page, quote)`. The row id is derived from organization, bid and `item_key`, so re-extraction updates the same row.                  |
| `category`                                                                       | One of FINANCIAL, TECHNICAL, STATUTORY, LEGAL, OPERATIONAL, COMMERCIAL, EXECUTION                                                                                    |
| `title`, `description`                                                           | Plain-language summary from the model                                                                                                                                |
| `provenance` (JSONB)                                                             | `documentId`, `documentName`, `pageNumber`, `clauseReference`, `verbatimQuote`, `confidenceScore`                                                                    |
| `primary_page`, `supporting_pages`, `clause_ref`, `source_block_id`, `doc_order` | Location fields used for sorting and showing the source                                                                                                              |
| `quote_check`                                                                    | The API's own re-check of the quote against stored page text: `EXACT`, `NORMALISED`, `NOT_FOUND`, `NO_PAGE_TEXT`                                                     |
| `attributes` (JSONB)                                                             | Grounded attributes: obligation type, action, stage, parties, mandatory, disqualifying, deadline, amount, form reference. `null` when the quote does not state them. |
| `execution_rules` (JSONB)                                                        | Formalities: stamp paper, notarization, UDIN, apostille and so on                                                                                                    |
| `flags`                                                                          | `CONFLICT`, `QUOTE_NOT_FOUND`, `NEAR_FAILED_PAGE`, `MISSING_FIELDS`, `AMENDED`, `BUYER_ADDED`                                                                        |
| `review_status`                                                                  | `UNREVIEWED` → `NEEDS_REVIEW` / `CONFIRMED` / `CORRECTED` / `NOT_A_REQUIREMENT`, with `reviewed_by`, `reviewed_by_name`, `reviewed_at`, `review_notes`               |
| `fulfilment_status`, `fulfilment_owner_id`                                       | Bid-prep progress: `NOT_STARTED`, `IN_PROGRESS`, `EVIDENCE_ATTACHED`, `DONE`, `AT_RISK`, `NOT_APPLICABLE`                                                            |
| `status`, `human_review_required`, `company_evidence`, `risk`, `rationale`       | Older checklist fields, kept for the checklist page                                                                                                                  |
| `workflow_run_id`, `correlation_id`, `version`                                   | Tracing and optimistic locking                                                                                                                                       |

**Re-extraction rules** (`DocumentsRepository`, completion transaction):

- An existing row at the same location gets its AI fields refreshed and keeps its review.
- A new location is inserted as `UNREVIEWED`.
- A row the new extraction no longer contains is deleted only if it is still `UNREVIEWED`.

## 5. Indexes

The baseline migration indexes every tenant-scoped lookup. Examples:

- `bids(organization_id)`, `tender_documents(bid_id, organization_id)`;
- `compliance_items(bid_id, organization_id)` and `(document_id)`;
- `clause_conflicts`, `extraction_coverage` and `bid_decisions` on `(bid_id, organization_id)`;
- the chunk tables by document, bid and organization;
- `refresh_tokens(token_hash)` and `(user_id)`;
- the chat tables by organization, bid, user and conversation.

## 6. Commands

| Command                       | What it does                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------- |
| `npm run db:status`           | Row counts and summaries of users, organizations, bids, documents and clauses |
| `npm run db:query "SELECT …"` | Ad-hoc query against `DATABASE_URL`                                           |
| `npm run db:seed`             | Load demo data                                                                |
| `npm run db:wipe -- --local`  | Drop everything; refuses non-local hosts unless `--allow-remote`              |
