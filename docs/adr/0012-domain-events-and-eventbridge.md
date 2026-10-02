# ADR 0012: Domain Events & In-Process Event Bus with Deferred EventBridge

## Status

Accepted

## Context

In our modular monolith architecture ([ADR 0008](file:///Users/belikesaurabh/main/TenderAi/docs/adr/0008-domain-driven-layered-architecture.md)), several cross-cutting concerns must react to core business state transitions:

1. **Audit Logging**: Every critical state transition must be recorded in an immutable audit trail.
2. **Realtime Notifications (SSE)**: When a document finishes OCR and AI compliance extraction, the browser UI must be notified immediately.
3. **Collaboration & Activity Feeds**: When a teammate marks a compliance clause as `COMPLIANT` or `FLAGGED`, other collaborators viewing the bid must see the updated status.
4. **Metrics & Accounting**: Tracking tenant storage consumption and extraction volumes.

### The Problem

If application use cases directly invoke every side-effect service synchronously:

```
ConfirmDocumentUploadUseCase:
  1. Update Document in DB
  2. Update Bid in DB
  3. Send Audit Log HTTP/SQL call
  4. Send Slack/Email Notification
  5. Send Server-Sent Event (SSE) to connected browsers
  6. Call Analytics Service
```

- **Tight Coupling**: The use case becomes bloated with secondary responsibilities, violating Single Responsibility Principle (SRP).
- **Fragile Transactions**: If the notification service or SSE broadcaster fails, should the entire document upload transaction roll back? No! Business data must be protected from secondary failure cascades.
- **Performance Drag**: Synchronous execution of multiple side effects increases API latency for end users.

## Decision

We introduce an **In-Process Domain Event Bus** backed by standard Domain-Driven Design (DDD) aggregate event recording:

1. **Aggregates Record Facts**: When state changes, aggregate roots record strongly-typed, immutable `DomainEvent` objects in an internal buffer (`addDomainEvent()`).
2. **Transaction-Bound Dispatch**: When the application use case successfully commits its Unit of Work, it pulls recorded domain events from the aggregate and dispatches them to the `IEventBus`.
3. **Zero Sensitive Document Dumps**: Event payloads carry **only reference IDs, tenant scope, and lightweight metadata** (`organizationId`, `bidId`, `documentId`, `status`, `version`, `timestamp`). No raw tender text or PDF binaries are broadcast.
4. **Deferred Cloud EventBridge**: We defer external message brokers (AWS EventBridge / Kafka) until cross-account microservice or multi-region choreography genuinely justifies them.

## Alternatives Considered

1. **Direct Synchronous Service Calls**: Rejected due to high coupling and risk of rollback cascades from non-critical side effects.
2. **AWS EventBridge Immediately**: Rejected for Phase 9/10. EventBridge adds network latency (50-200ms), external AWS API costs, and cloud dependency for side-effects that execute entirely within the same monolithic process. Retained for future cross-account event routing.
3. **Kafka / RabbitMQ**: Massively over-engineered for our current scale. Introduces cluster management, partition balancing, and significant infrastructure operational overhead.
4. **Event Sourcing (replacing PostgreSQL relational state entirely)**: Rejected. Full Event Sourcing introduces extreme complexity for querying, schema migrations, and relational integrity. We use **Domain Events for notification and decoupling**, while maintaining PostgreSQL tables as the relational source of truth.

## Consequences

- **Positive**:
  - Clean architectural separation: Aggregates emit facts; subscribers react independently.
  - Zero side-effect coupling: Adding a new subscriber (e.g. webhook dispatcher) requires zero changes to core use cases.
  - Testable: Domain events can be asserted in unit and integration tests without mocking external message brokers.
  - Security by design: Sensitive tender document contents are strictly excluded from event payloads.
- **Negative / Trade-off**:
  - In-process event dispatching runs in memory; if the process crashes between database commit and event subscriber execution, an event could be lost. When high-value guarantees are required for external systems, we will introduce the **Transactional Outbox Pattern** with PostgreSQL.
