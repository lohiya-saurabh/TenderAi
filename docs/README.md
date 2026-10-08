# Documentation Index

Welcome to the TenderPulse technical documentation. This directory contains the complete architecture specifications, domain models, implementation guides, and Architectural Decision Records (ADRs) for the TenderPulse platform.

---

## 1. Canonical Entry Points

- [STATUS.md](STATUS.md) — Active milestone tracker, implementation progress, and test verification record.
- [PRODUCT.md](PRODUCT.md) — Bidder-side product vision, target market, and feature specifications.
- [MVP.md](MVP.md) — MVP delivery scope, timelines, and release milestones.
- [ARCHITECTURE.md](ARCHITECTURE.md) — System architecture, two-tier service boundaries, and target design.
- [LLD.md](LLD.md) — Low-Level Design (LLD): Tender ingestion, worker dispatch, and compliance management.
- [DOMAIN.md](DOMAIN.md) — Procurement domain model, aggregates, entities, and business invariants.
- [SECURITY_MODEL.md](SECURITY_MODEL.md) — Platform security architecture, tenant isolation, and defense-in-depth.

---

## 2. Core Platform & Architecture Specifications

- [SERVICE_BOUNDARY.md](SERVICE_BOUNDARY.md) — Service responsibilities, contracts, and handoff boundaries.
- [ASYNC_DOCUMENT_HANDOFF.md](ASYNC_DOCUMENT_HANDOFF.md) — Authoritative asynchronous document ingestion, outbox pattern, worker execution, idempotency, and PostgreSQL persistence guide (Design B).
- [STORAGE_ARCHITECTURE.md](STORAGE_ARCHITECTURE.md) — Direct-to-storage upload, object integrity verification, and bucket policies.
- [DATABASE.md](DATABASE.md) — Relational schema, Drizzle ORM models, indexes, and audit logs.
- [EVENTS.md](EVENTS.md) — Domain events, message broker choreography, and event schemas.
- [CICD.md](CICD.md) — Continuous integration, automated test pipelines, and deployment flows.
- [HUMAN_REVIEW.md](HUMAN_REVIEW.md) — Human-in-the-loop review workflow, confidence tiers, and reviewer overrides.

---

## 3. AI Intelligence & Verification

- [AI.md](AI.md) — AI systems architecture, LangGraph state machine, and LLM orchestration.
- [AI_SECURITY.md](AI_SECURITY.md) — Multi-tenant isolation, prompt injection defense, and grounding checks.
- [AI_EVALUATION.md](AI_EVALUATION.md) — Evaluation harness, regression testing, and precision/recall benchmarks.
- [DCA_COMPREHENSIVE_CLAUSES.md](DCA_COMPREHENSIVE_CLAUSES.md) — Concession agreement clause taxonomy and extraction rules.
- [EXTRACTION_GAP_ANALYSIS.md](EXTRACTION_GAP_ANALYSIS.md) — Gap analysis across procurement documents and extraction coverage.
- [deep-research-report.md](deep-research-report.md) — Domain research on Indian public procurement and legal precedents.

---

## 4. Cloud Infrastructure & DevOps

- [AWS.md](AWS.md) — AWS production architecture (ECS, S3, SQS, RDS Aurora).
- [AWS_DEV_SETUP.md](AWS_DEV_SETUP.md) — Local development and emulation for AWS services (LocalStack).
- [GCP.md](GCP.md) — GCP production architecture (Cloud Run, GCS, Cloud Pub/Sub, Cloud SQL).
- [GCP_DEV_SETUP.md](GCP_DEV_SETUP.md) — Local development and emulation for GCP services.

---

## 5. Architectural Decision Records (ADRs)

All architectural decisions are documented in the [`adr/`](adr/) directory:

- [ADR 0001: Two-Tier Service Boundary](adr/0001-two-tier-service-boundary.md)
- [ADR 0002: PostgreSQL over DynamoDB](adr/0002-postgresql-over-dynamodb.md)
- [ADR 0003: SQS Asynchronous Pipeline](adr/0003-sqs-asynchronous-pipeline.md)
- [ADR 0004: LangGraph over LangChain](adr/0004-langgraph-over-langchain.md)
- [ADR 0005: Direct S3 Upload via Presigned URLs](adr/0005-s3-direct-upload-presigned-urls.md)
- [ADR 0006: Real-time Updates via SSE over AppSync](adr/0006-realtime-updates-sse-over-appsync.md)
- [ADR 0007: Redis Justification and Deferral](adr/0007-redis-justification-and-deferral.md)
- [ADR 0008: Domain-Driven Layered Architecture](adr/0008-domain-driven-layered-architecture.md)
- [ADR 0009: Bid State Machine and Optimistic Locking](adr/0009-bid-state-machine-and-optimistic-locking.md)
- [ADR 0010: Provenance Value Object Immutability](adr/0010-provenance-value-object-immutability.md)
- [ADR 0011: AI Security and Tenant Isolation](adr/0011-ai-security-and-tenant-isolation.md)
- [ADR 0012: Domain Events and EventBridge](adr/0012-domain-events-and-eventbridge.md)
- [ADR 0013: AI Security and RAG Isolation](adr/0013-ai-security-and-rag-isolation.md)
- [ADR 0014: Cloud-Agnostic Ports and GCP Implementation](adr/0014-cloud-agnostic-ports-and-gcp-implementation.md)
- [ADR 0015: Two-Phase Cascade Deletion Architecture](adr/0015-two-phase-cascade-deletion-architecture.md)
- [ADR 0016: Bidder-Side Pivot Aggregates](adr/0016-bidder-side-pivot-aggregates.md)
- [ADR 0017: Enforce Layered Boundary at HTTP](adr/0017-enforce-layered-boundary-at-http.md)
- [ADR 0018: Async-First Extraction and AI](adr/0018-async-first-extraction-and-ai.md)
- [ADR 0019: Deterministic Eligibility Matching Engine](adr/0019-deterministic-eligibility-matching-engine.md)
- [ADR 0020: External Data Connectors Enrichment Port](adr/0020-external-data-connectors-enrichment-port.md)
- [ADR 0021: Evidence-First Compliance Engine](adr/0021-evidence-first-compliance-engine.md)
- [ADR 0022: Durable Asynchronous Document Processing Runtime](adr/0022-durable-asynchronous-document-processing-runtime.md)

---

## 6. Learning & Reference Materials

Found in [`learning/`](learning/) and [`INTERVIEW_PREP.md`](INTERVIEW_PREP.md):
- [INTERVIEW_PREP.md](INTERVIEW_PREP.md) — Master technical interview preparation guide across AWS/GCP, LangGraph, LLM, RAG, React, NestJS, and FastAPI.
- [`learning/agents.md`](learning/agents.md) — Core principles of autonomous AI agents.
- [`learning/langgraph.md`](learning/langgraph.md) — Guide to LangGraph stateful cyclic graphs.

