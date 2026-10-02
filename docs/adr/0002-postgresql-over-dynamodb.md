# ADR 0002: PostgreSQL as Transactional Source of Truth (Rejecting DynamoDB)

## Status

Accepted

## Context

TenderPulse AI requires persistent storage for:

- Multi-tenant tenant accounts, organizations, users, and RBAC permissions.
- Bid projects and their lifecycle states (`DRAFT`, `INGESTING`, `PARSING`, `REVIEW_READY`, `FINALIZED`).
- Tender packages, document files, page metadata, and OCR status.
- Extracted compliance items (annexures, turnover thresholds, stamp paper denominations, signing ranks).
- Human review states, overrides, user assignments, notes, and immutable audit logs.

### The Problem

We need to evaluate whether to use a managed NoSQL database like **AWS DynamoDB** or a relational database like **PostgreSQL**.

## Evaluation & Decision

We select **PostgreSQL** (AWS RDS / Aurora PostgreSQL) as the single transactional source of truth and explicitly **reject DynamoDB**.

### Why DynamoDB is Insufficient / Harmful for this Domain:

1. **Relational Integrity is Core to Compliance**:
   A compliance item does not exist in a vacuum; it belongs to a `BidProject`, which belongs to an `Organization`, which has multiple `Users` with specific roles, linked to uploaded `DocumentFiles` and `EvidenceFiles`. Cascading deletes, foreign key integrity, and relational joins are natural and essential here.
2. **Access Patterns are Evolving**:
   DynamoDB requires upfront knowledge of single-table primary/sort keys (`PK`/`SK`) and Global Secondary Indexes (GSIs). In a growing product where bid managers need to filter compliance items by `status`, `category`, `stamp_paper_required`, `assigned_user`, or `due_date`, DynamoDB single-table design becomes an operational straightjacket leading to expensive table scans or index proliferation.
3. **Complex Filtering & Reporting**:
   Generating an executive compliance scorecard or auditing who approved which affidavit requires rich relational querying, aggregations (`COUNT`, `GROUP BY`), and transactional consistency.
4. **JSON Support in PostgreSQL**:
   PostgreSQL natively provides `JSONB` columns with GIN indexing. This gives us the best of both worlds: strict relational schemas for core entities (tenants, bids, users, compliance items) and flexible schemaless attributes for dynamic tender metadata (extracted parameters, vendor custom fields).

## Consequences

- **Positive**:
  - Full ACID transaction support ensures bid state transitions and audit logs are never corrupted.
  - Multi-tenant isolation is cleanly enforced via foreign keys and PostgreSQL Row-Level Security (RLS).
  - Rich querying, indexing, and migration tooling (Prisma / TypeORM / Alembic).
- **Negative / Trade-off**:
  - Requires connection pooling (e.g., PgBouncer / RDS Proxy) to prevent connection exhaustion under high worker concurrency.
  - Vertical scaling limits compared to DynamoDB's infinite horizontal partition scale (irrelevant for our dataset size: millions of rows are handled easily by a single PostgreSQL instance).
