# Project Status & Milestone Tracker

## Current Milestone: Production Document + AI Pipeline (Milestone 20)

**Status**: COMPLETED (Decoupled asynchronous architecture S3 → SQS → IngestionWorker → Normalized Content → AI Workflow → Deterministic Grounding → PostgreSQL → Notification/Review, AiDocumentExtractor, DocumentContentNormalizer, FastAPI /api/v1/extract endpoint, trusted database security scope derivation, worker crash recovery via SQS visibility timeout and lease locks, exponential backoff retries, dead-letter queue isolation, strict deterministic invariant verification, 7 passing E2E tests in `ProductionDocumentAiPipeline.e2e.spec.ts` and 27 passing tests in Python `apps/ai`).

---

## Roadmap Stop Points (as defined in AGENTS.md)

1. [x] **Phase 1: Domain Understanding** _(Completed)_
   - Customer personas, buyer vs user, unit economics, current manual workflows.
   - Indian public procurement ecosystem (GeM, CPPP, State Portals, PSUs, Railways, Defence).
   - Domain terminology (NIT, EMD, PBG, BOQ, Corrigendum, Two-Cover System, UDIN, Stamp Paper, PPP-MII).
   - Disqualification taxonomy & risk points.
   - AI boundary definitions (Where AI helps vs Where deterministic code governs).
   - MVP scope & Anti-scope definition.
2. [x] **Phase 2: High-Level Design (HLD)** _(Completed)_
   - Translating business workflow into software architecture.
   - Evaluation of 12 candidate technologies (React 18, NestJS, FastAPI, PostgreSQL, Redis, S3, SQS, EventBridge, DynamoDB, AppSync, LangChain, LangGraph).
   - System boundaries: Two-Tier Service Boundary (NestJS Application API + FastAPI AI Engine).
   - Asynchronous decoupled processing via AWS S3 Presigned URLs + AWS SQS + DLQ.
   - Rejection of premature/inappropriate tech (DynamoDB, AppSync, LangChain linear chains).
   - ADRs: ADR 0001 through ADR 0007 created.
   - Complete C4 Level 1 & Level 2 Mermaid diagrams and sequence flows.
3. [x] **Phase 3: Domain Model & Low-Level Design (LLD)** _(Completed)_
   - Modular monolith directory structure (Domain, Application, Infrastructure, Presentation).
   - Entities (`BidProject`, `ComplianceItem`, `AuditLog`, `TenderDocument`, `IngestionJob`).
   - Value Objects (`Provenance`, `ExecutionRules`, `BidStatus`, `ComplianceStatus`, `Money`, `DocumentStatus`).
   - Application Services (`CreateBidUseCase`, `BulkIngestComplianceUseCase`, `ReviewComplianceItemUseCase`, `ListComplianceItemsUseCase`, `GenerateUploadUrlUseCase`, `ConfirmDocumentUploadUseCase`, `GetDocumentDownloadUrlUseCase`).
   - Interfaces (`IBidRepository`, `IComplianceItemRepository`, `IAuditRepository`, `IUnitOfWork`, `IStorageService`, `ITenderDocumentRepository`, `IIngestionJobRepository`, `IJobQueue`, `IEventBus`).
   - Explicit State Machines & Transition Matrices for `BidStatus`, `ComplianceStatus`, and `DocumentStatus`.
   - Optimistic Concurrency Control (`version` column).
   - Production PostgreSQL DDL (`schema.sql`) & Prisma schema (`schema.prisma`).
   - ADRs: ADR 0008 (DDD Layered Architecture), ADR 0009 (State Machine & Optimistic Locking), ADR 0010 (Immutable Provenance Value Object).
4. [x] **Phase 4: Monorepo & Project Foundations** _(Completed)_
   - Modular Monorepo structure: `apps/` (`web`, `api`, `ai`), `packages/` (`shared-types`, `config`, `ui`), `infrastructure/terraform/`, `docs/` (`architecture`, `adr`, `learning`), `tests/`, `scripts/`.
   - Tooling & Quality Gates: Prettier, ESLint flat config, TypeScript strict project references, Vitest monorepo runner, Pytest + Ruff for AI worker.
   - Environment & Local Setup: `.env.example`, `docker-compose.yml` (PostgreSQL 16, LocalStack S3/SQS), Dockerfiles for API, Web, and AI.
   - Automated scripts: `scripts/dev-setup.sh`, `scripts/check-all.sh`, `scripts/seed.sh`.
5. [x] **Phase 5: AI Architecture & Security Foundations** _(Completed)_
   - Deep dive: LLMs, Structured Output, Tools, RAG Retrieval, AI Workflows vs. Autonomous Agents.
   - Zero-Trust AI Security: "Application decides what data the model is allowed to see."
   - Multi-tenant isolation across vector storage, LangGraph state, checkpoints, artifacts, and logs.
   - Defense against direct/indirect prompt injection, poisoned retrieval, and data exfiltration.
   - Model provider privacy & data residency (AWS Bedrock ap-south-1 Mumbai, DPDP Act 2023).
   - Deliverables: `docs/learning/agents.md`, `docs/learning/langgraph.md`, `docs/architecture/AI.md`, `docs/architecture/AI_SECURITY.md`, `docs/adr/0011-ai-security-and-tenant-isolation.md`.
6. [x] **Phase 6: Database Architecture & Multi-Tenancy (PostgreSQL Migrations & RLS)** _(Completed)_
   - Documented in `docs/DATABASE.md`.
   - Composite keys, tenant isolation guarantees, audit trails, and concurrency protections.
7. [x] **Phase 7: Auth & RBAC (Tenant & User Security Context)** _(Completed)_
   - Documented in `docs/SECURITY_MODEL.md`.
   - Fiber-safe `TenantContextHolder` backed by Node.js `AsyncLocalStorage`.
   - Strict resource-level anti-IDOR checks and role privilege enforcement.
8. [x] **Phase 8: Document Storage Architecture & Presigned S3 Handshake** _(Completed)_
   - Documented in `docs/STORAGE_ARCHITECTURE.md`.
   - Direct S3 upload via time-limited presigned PUT URLs with SHA-256 integrity and MIME validation.
   - Atomic upload verification handshake (`ConfirmDocumentUploadUseCase`) with out-of-transaction S3 HeadObject checks.
9. [x] **Phase 9: Asynchronous Processing, SQS & Worker Resilience** _(Completed)_
   - Documented in `docs/ASYNC.md`.
   - `IngestionJob` aggregate root with state machine (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `DEAD_LETTER`).
   - Zero-trust message payload: authorization strictly resolved from trusted backend database state.
   - Idempotent duplicate delivery handling.
   - Worker crash recovery via SQS visibility timeout expiration and DB lease locks (`lockedUntil`).
   - Exponential backoff retry logic and automatic Dead-Letter Queue (DLQ) routing for poison pills.
   - 7 E2E resilience tests in `AsyncIngestionPipeline.e2e.spec.ts`.
10. [x] **Phase 10: Domain Events & Event-Driven Architecture** _(Completed)_
    - Documented in `docs/EVENTS.md` and `docs/adr/0012-domain-events-and-eventbridge.md`.
    - Pure DDD event recording on `AggregateRoot` (`addDomainEvent`, `pullDomainEvents`).
    - Decoupled side effects (Audit, ActivityFeed, Realtime SSE notifications).
    - Event catalog: `BidProjectCreatedEvent`, `TenderDocumentUploadedEvent`, `ComplianceIngestionCompletedEvent`, `ComplianceItemReviewedEvent`.
    - Reference-only payload security policy: strict prohibition of dumping raw PDF binaries or sensitive legal text into event streams.
    - Idempotent event subscription via `eventId` deduplication.
    - 6 E2E tests in `DomainEvents.e2e.spec.ts`.
11. [x] **Phase 11: Stateful AI Workflows (LangGraph compliance engine implementation)** _(Completed)_
    - Documented in `docs/learning/langgraph.md`, `docs/AI.md`, and `docs/AI_SECURITY.md`.
    - `SecurityContext` immutable contract in Python and TypeScript.
    - Scoped retrieval with hard tenant filtering (`ScopedRetrievalTool`).
    - Verbatim substring grounding verifier rejecting ungrounded or hallucinated claims.
    - Neutralization of prompt injection via structural XML tags.
    - Pre-invocation secret scrubber removing AWS keys, JWTs, and DB credentials.
    - Deny-by-default network egress guard blocking arbitrary external URLs.
    - 8 security and correctness proofs verified in `test_compliance_workflow.py`.
12. [x] **Phase 12: AI Evaluation & Regression Testing (Milestone 18)** _(Completed)_
    - Documented in `docs/AI_EVALUATION.md`.
    - First principles: Why ordinary unit tests are insufficient for probabilistic LLMs.
    - 12-dimensional evaluation matrix (Extraction, Classification, Groundedness, Citation, Schema, Hallucination, Instruction, Refusal, Security, Tenant Isolation, Document Isolation, Regression).
    - 3-tier evaluation framework: Zero-Tolerance Deterministic Invariants, Deterministic Groundedness Engine, Statistical Quality.
    - Synthetic evaluation dataset (`dataset.py`) covering Railways, NHAI, CPWD, State PWD, GeM.
    - 7 adversarial failure modes tested: Malicious PDFs, prompt injection, misleading specimen drafts, missing information, conflicting documents, malformed OCR, unauthorized documents.
    - Repeatable regression test suite (`test_evaluation_regression.py`) with empirical scorecard and hard CI/CD assertions.
13. [x] **Phase 13: Human-in-the-Loop & Auditability (Milestone 19)** _(Completed)_
    - Documented in `docs/HUMAN_REVIEW.md`.
    - 4-Tier decision matrix (Automatic, Validated Automatic, Human Approval Required, Deterministic Only).
    - End-to-end review lifecycle: AI proposal $\rightarrow$ validation $\rightarrow$ human review $\rightarrow$ approve/reject/edit $\rightarrow$ final state.
    - Native LangGraph dynamic `interrupt(payload)` and `Command(resume=...)` resumption.
    - `HumanReviewManager` handling task creation, tenant-scoped access, reviewer RBAC (`compliance:review`), expiry, reassignment, and duplicate approval prevention.
    - Reference-only audit events (`HUMAN_REVIEW_APPROVE`, `HUMAN_REVIEW_REJECT`, `HUMAN_REVIEW_EDIT`, `HUMAN_REVIEW_TASK_REASSIGNED`).
    - 8 automated tests passing in `test_human_review_workflow.py`.
14. [x] **Phase 14: Production Document + AI Pipeline (Milestone 20)** _(Completed)_
    - Decoupled asynchronous document extraction architecture (S3 $\rightarrow$ SQS $\rightarrow$ IngestionWorker $\rightarrow$ Normalized Content $\rightarrow$ LangGraph AI $\rightarrow$ Deterministic Grounding $\rightarrow$ PostgreSQL $\rightarrow$ EventBus).
    - `AiDocumentExtractor` with timeout, circuit breaker, and deterministic response structure validation.
    - `DocumentContentNormalizer` parsing form-feed (`\f`) and structured page blocks.
    - FastAPI `/api/v1/extract` internal endpoint with `X-Internal-Service-Key` authorization.
    - Zero-trust security context: async worker strictly resolves permissions and tenant boundary from trusted PostgreSQL records.
    - SQS at-least-once idempotency: duplicate deliveries acknowledged and deleted without duplicate database rows.
    - Crash recovery via SQS visibility timeout expiration and database lease locks (`lockedUntil`).
    - Exponential backoff retry logic and Dead-Letter Queue (DLQ) poison-pill isolation.
    - Deterministic verification engine rejecting invalid math or missing verbatim quotes before database commits.
    - 7 comprehensive E2E tests in `ProductionDocumentAiPipeline.e2e.spec.ts`.
15. [x] **Phase 22: Frontend Architecture & Implementation (React 18 MVP)** _(Completed)_
    - React 18 + Vite + React Router v6 SPA with design tokens and dark mode palette.
    - Centralized API client with JWT in-memory lifecycle, automatic 401 silent token refresh retry, and error normalization.
    - Frontend security invariants: tenant_id, role, and document_id are NEVER trusted from browser; backend remains authoritative; RBAC used strictly for conditional UX rendering.
    - Direct S3 presigned PUT uploader with XMLHttpRequest progress tracking and confirmation handshake.
    - Real-time Server-Sent Events (SSE) extraction progress bar and step indicator.
    - Domain compliance matrix with expandable rows, Indian execution & statutory rules (stamp paper, notary, UDIN, signing rank), and plain-text grounded verbatim provenance cards.
    - Optimistic concurrency human review lifecycle (Approve, Flag, Waive) with review notes modal and `expectedVersion` check.
    - Immutable audit trail timeline page (`/bids/:id/audit`).
    - 20 passing unit/integration tests in `apps/web`.
16. [x] **Phase 23: Cloud Infrastructure (AWS Architecture & Terraform Blueprint)** _(Architecture Approved & Documented in docs/AWS.md)_
    - 3-tier VPC topology in `ap-south-1` (Mumbai) across 2 Availability Zones.
    - Containerized runtime on AWS ECS Fargate for NestJS API (auto-scaled on CPU/requests) and FastAPI AI Worker (auto-scaled on SQS queue depth).
    - Multi-AZ Amazon RDS PostgreSQL 16 with KMS CMK encryption, Point-in-Time Recovery (PITR), and Row-Level Security (RLS).
    - Decoupled asynchronous extraction pipeline via AWS SQS + DLQ.
    - Zero-internet PrivateLink VPC Endpoints for S3, SQS, Bedrock, Secrets Manager, and ECR.
    - Strict IAM least-privilege separation between Task Execution Role and Task Runtime Role.
    - Rejection of premature/inappropriate tech: API Gateway (29s timeout breaks SSE/PDF extraction), DynamoDB (lacks relational integrity/RLS), AppSync (overkill; replaced by SSE).
    - Complete evaluation matrix for 17 AWS services in `docs/AWS.md`.
17. [x] **Phase 24: Terraform Modules & Infrastructure as Code** _(Completed)_
    - Modular Terraform structure in `infrastructure/terraform/modules/` (`vpc`, `security`, `s3`, `sqs`, `rds`, `ecs`).
    - Environment separation in `infrastructure/terraform/environments/` (`dev`, `staging`, `prod`).
    - Least-privilege IAM separation: Task Execution Role (ECR pull, logs, secrets) vs Task Roles (scoped SQS, S3, KMS, Bedrock in `ap-south-1`).
    - Encrypted data stores: KMS Customer Managed Keys (CMKs) with auto-rotation for RDS, S3, SQS, Secrets Manager.
    - Zero-hardcoded secrets: Secret metadata generated via AWS Secrets Manager and dynamic Random Provider.
    - 3-tier VPC network topology across 2 AZs (`ap-south-1a`, `ap-south-1b`) with isolated database subnets and VPC Endpoints.

18. [x] **Phase 25: CI/CD Pipelines & Zero-Downtime Deployment** _(Completed)_
    - GitHub Actions 10-stage pipeline in `.github/workflows/ci-cd.yml` (Lint → Typecheck → Unit/Integration Tests → AI Evaluation Scorecards → Security Leaks → Docker Build → Staging Deploy → Smoke Tests → Production Gate).
    - AI CI quality gates: Prompt regression tests (`test_evaluation_regression.py`), AI evaluation scorecards (grounding = 1.0, schema = 1.0), and security regression tests (prompt injection defense, tenant isolation).
    - Zero static AWS keys: AWS OIDC federated role assumption for CI/CD runners.
    - Zero-downtime database migrations: Expand-and-contract lifecycle.
    - Rollback resilience: ECS deployment circuit breakers and CloudWatch alarm rollbacks.
    - Documented in `docs/CICD.md`.
19. [x] **Phase 26: Full Security Review & Threat Assessment** _(Completed)_
    - Comprehensive security audit documented in `docs/SECURITY_REVIEW.md`.
    - Evaluated 8 domains: Authentication, Authorization & Anti-IDOR, API limits & abuse, File uploads & S3, AI injection & privacy, AWS IAM & VPC network, Database RLS & transactions, Async queue resilience.
    - Classified and remediated critical/high vulnerabilities: constant-time secret comparison (`crypto.timingSafeEqual` and `secrets.compare_digest`), hardcoded secret fallback elimination in production, 1MB JSON body size capping in HTTP readers.
    - 71 TypeScript unit/integration tests and 27 Python AI security tests passing cleanly.

---

## Next Immediate Action

Awaiting user `Continue` approval on Security Review & Hardening. Ready for next phase.

