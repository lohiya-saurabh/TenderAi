# ADR 0009: Explicit State Machine and Optimistic Concurrency Control

## Status
Accepted

## Context
A government tender bid progresses through critical lifecycle states:
`DRAFT` $\rightarrow$ `QUEUED` $\rightarrow$ `PROCESSING` $\rightarrow$ `REVIEW_READY` $\rightarrow$ `FINALIZED` (or `FAILED`).

Similarly, extracted compliance items have distinct review states:
`PENDING` $\rightarrow$ `READY` | `FLAGGED` | `WAIVED`.

### The Problem
1. **Invalid State Jumps**: If state transitions are represented by plain database string columns without invariant checks, any service or developer can accidentally execute an invalid jump (e.g. updating directly from `DRAFT` to `FINALIZED` without processing, or writing compliance items into a `FINALIZED` bid).
2. **Race Conditions / Lost Updates**: 
   - A background worker writes 30 newly extracted compliance items.
   - At the exact same second, a Bid Manager on the web dashboard updates the bid title or adds an internal note.
   - If updates are naive SQL `UPDATE bids SET ...`, the second write can overwrite the first, causing lost state or inconsistent status flags.

## Decision
1. **Explicit Domain State Machine**:
   - `BidStatus` and `ComplianceStatus` are modeled as domain Value Objects encapsulating a strict transition matrix.
   - Any attempt to execute an illegal state transition throws a `DomainInvalidStateTransitionException` at the domain layer before database queries are executed.
2. **Optimistic Concurrency Control (OCC)**:
   - The `BidProject` and `ComplianceItem` database tables include an integer `version` column.
   - Every mutation checks and increments the version:
     `UPDATE bids SET ..., version = version + 1 WHERE id = :id AND version = :expectedVersion;`
   - If `rows_affected == 0`, the transaction fails with a `ConcurrencyConflictException (HTTP 409)`, protecting against lost updates without expensive pessimistic database row locks.

## Alternatives Considered
1. **Pessimistic Locking (`SELECT FOR UPDATE`)**: Rejected because locking rows across asynchronous network boundaries or user think-time degrades database connection pools.
2. **String Constants without State Machine**: Rejected because it leads to scattered `if (status === ...)` checks throughout services, resulting in invariant leakage.

## Consequences
- **Positive**:
  - Deterministic lifecycle enforcement: illegal state jumps are impossible.
  - Zero lost updates during concurrent worker ingestion and user edits.
- **Negative / Trade-off**:
  - Frontend must handle HTTP 409 Concurrency Conflict and prompt the user to refresh their view if a conflicting edit occurred.
