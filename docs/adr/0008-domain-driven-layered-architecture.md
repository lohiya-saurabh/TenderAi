# ADR 0008: Domain-Driven Layered Architecture for Modular Monolith

## Status

Accepted

## Context

In Phase 2, we decided that NestJS serves as the domain and API boundary for the SaaS platform. We now need to decide on the internal code organization pattern within the NestJS backend.

### The Problem

- **The "Anemic Controller-Service-DAO" Trap**: In many Node.js backends, controllers parse requests, services contain a mix of business logic, database queries, and third-party API calls, and entities are just dumb data bags without methods. As business rules expand (e.g. valid bid state transitions, multi-tenant checks, stamp paper validation rules, audit logging), services balloon into 2,000-line "god classes" that are untestable, tightly coupled, and impossible to reason about.
- **Microservices Over-Engineering**: Splitting each business concept (Bid Service, Document Service, Compliance Service, Audit Service) into separate deployable microservices introduces distributed transactions, network latency, docker swarm/K8s operational overhead, and complex contract synchronization for an early-stage SaaS.

## Decision

We adopt a **Domain-Driven Layered Modular Monolith** inside NestJS.
Each business domain is an encapsulated NestJS module structured into four clean layers:

1. **Domain Layer**:
   - Pure, framework-agnostic TypeScript.
   - Contains **Entities**, **Value Objects**, **Domain Exceptions**, and **Repository Interfaces**.
   - Contains zero NestJS decorators, zero database imports (Prisma/TypeORM), and zero AWS SDK dependencies.
   - Encapsulates invariant rules (e.g., a Bid cannot transition from `DRAFT` to `PROCESSING` without at least one uploaded document).
2. **Application Layer**:
   - Contains **Use Cases / Application Services**, **Commands**, and **Queries**.
   - Orchestrates workflows: calls repositories, dispatches queue jobs, triggers audit logs.
3. **Infrastructure Layer**:
   - Implements repository interfaces using Prisma/PostgreSQL.
   - Implements storage interfaces using AWS S3 SDK.
   - Implements queue interfaces using AWS SQS SDK.
4. **Interface / Presentation Layer**:
   - NestJS **Controllers**, **Guards**, **Interceptors**, and **DTOs** (Data Transfer Objects with `class-validator`).

## Alternatives Considered

1. **Flat CRUD Controller-Service Pattern**: Rejected because business rules (e.g. state transitions and compliance validation) leak across services, leading to duplicate authorization and state mutation bugs.
2. **Independent Microservices**: Rejected as premature over-engineering.

## Consequences

- **Positive**:
  - High cohesion, low coupling: Domain rules can be unit-tested in isolation without mocking databases or AWS SDKs.
  - Clear boundaries: Switching from Prisma to TypeORM or mock storage to real S3 requires changing only the infrastructure adapter, leaving business logic untouched.
- **Negative / Trade-off**:
  - Requires more boilerplate files (Interface + Implementation, DTO + Entity mapper) compared to direct database access inside controllers.
