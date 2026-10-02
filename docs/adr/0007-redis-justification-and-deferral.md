# ADR 0007: Scoping & Boundary Decision for Redis and EventBridge

## Status

Accepted

## Context

We evaluated whether **Redis** and **AWS EventBridge** should be part of the Day-1 MVP architecture or deferred/restricted to specific justified use cases.

### Rules from AGENTS.md:

- _"Redis only for a justified caching/coordination use case."_
- _"EventBridge for appropriate events/schedules."_
- _"Do not add technology just for resume value. Prefer simple architecture."_

## Decisions

### 1. Redis: Deferred for Day-1 MVP; Scoped for Phase 6+ (Rate Limiting & Distributed Locking)

- **Evaluation**:
  - _Caching database reads?_ Not needed in MVP. Tender compliance data is read when the user loads the bid dashboard; volume is low (dozens of tenders per organization, not millions of QPS). PostgreSQL handles read queries easily.
  - _Session storage?_ Stateless JWT tokens with RS256/HS256 signing eliminate server-side session lookup.
  - _Job queueing?_ AWS SQS handles durable message queues, retries, and DLQ without requiring Redis or BullMQ.
- **Decision**: We do **NOT** deploy Redis on Day 1. We introduce Redis in Phase 6/7 only when specific coordination needs arise:
  1. Distributed rate-limiting across scaled NestJS API instances (preventing abuse of presigned URLs or LLM endpoints).
  2. Distributed locking (`Redlock`) if two workers attempt concurrent mutations on the same tender version.

### 2. EventBridge: Deferred for Day-1 MVP; Retained for Scheduled Crons & Multi-System Webhooks

- **Evaluation**:
  - _Internal messaging between NestJS and Python Worker?_ A point-to-point queue (AWS SQS) with worker pull semantics is vastly simpler, cheaper, and more reliable than EventBridge event routing.
  - _When is EventBridge actually justified?_
    1. Scheduled jobs (e.g., nightly tender expiry checks, document expiration reminders) via EventBridge Scheduler.
    2. Future integrations with external enterprise webhooks or multi-account AWS architectures.
- **Decision**: Day-1 MVP uses direct SQS queues for the asynchronous document pipeline. EventBridge is introduced only for scheduled cron events (Phase 7/11).

## Consequences

- **Positive**:
  - Dramatically lowers Day-1 operational complexity: two fewer infrastructure services to provision, secure, monitor, and pay for in staging and local development.
  - Keeps local development running with simple Docker Compose (PostgreSQL + NestJS + FastAPI + LocalStack/MinIO/Mock SQS).
- **Negative / Trade-off**:
  - None for MVP scale. Rate limiting can initially run in-memory within single-instance API servers.
