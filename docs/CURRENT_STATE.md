# Current-State Engineering Audit — TenderPulse AI

**Audit date:** 2026-10-04
**Scope:** Full repository inspection (no code modified).
**Purpose:** Establish what actually exists vs. what is documented, classify each major area as KEEP / ADAPT / REPLACE / MISSING, and define the gap between the working repository and the production SaaS vision in `docs/PRODUCT.md` + `docs/MVP.md`.

> **Assumption:** "The new product" is interpreted as the production multi-tenant SaaS described in `docs/PRODUCT.md` / `docs/MVP.md` (TenderPulse AI: multi-tenant bid-compliance platform with eligibility engine, evidence matching, risk radar, and export). If the intended new product differs from that documented vision, the "missing capabilities" section must be re-scoped. This audit makes no implementation changes.

---

## 0. Executive Summary

The repository is **architecturally mature but operationally a demo**. The design documentation (15 ADRs, ~20 docs, DDD layered model, ports & adapters, threat models) is genuinely good and should not be discarded. However, the *running system* diverges from the documented security and deployment model in several places, three of which are **critical and exploitable today**:

1. **Authentication is fake.** Access tokens are unsigned base64-encoded JSON (`tp_demo_access_<base64>`). Nothing verifies a signature. `POST /api/v1/auth/refresh` is unauthenticated and returns a token for the *first user in the database*. Every HTTP endpoint is unguarded.
2. **Tenant isolation is hardcoded, not enforced.** Services write/query a literal `org_acme_infra_001`. `TenantContextHolder` (AsyncLocalStorage) is populated only in tests, never per HTTP request.
3. **The production persistence path is an embedded in-process database (PGlite)** with a local `data/postgres` directory, despite `docker-compose.yml` and Terraform defining a real PostgreSQL. `DATABASE_URL` is accepted by compose but never read by the app.

Everything else — domain model, RBAC permission matrix, async pipeline design, ports/adapters for S3/GCS and SQS/PubSub, deterministic grounding discipline, frontend SPA, AI security tooling, Terraform blueprints, CI quality gates — is real, tested, and worth keeping or adapting.

**Test inventory (as audited):** ~151 TypeScript test cases (`apps/api`, `apps/web`, `tests/`), 27 Python test cases (`apps/ai`).

---

## 1. Area-by-Area Classification

### 1. Product Capabilities — **ADAPT**

**Exists (working end-to-end, single tenant):**
- Create bid project → presigned upload → confirm → text extraction → compliance checklist generation → human review (READY/FLAGGED/WAIVED with optimistic concurrency) → immutable audit timeline.
- Real PDF text extraction (pdf-parse / pdfjs) with multi-zone page selection for 200+ page tenders.
- 16-domain Indian procurement taxonomy (EMD, PBG, turnover, PoA, JV/consortium, experience, personnel, plant, validity, LD, DLP, integrity pact, conflict of interest, Make-in-India, GSTIN/PAN).
- Verbatim provenance quotes with page references and clause-number regex extraction.

**Missing for the documented product:** eligibility / go-no-go engine (turnover, solvency, past-work thresholds vs. contractor profile), contractor evidence repository + gap/expiry analysis, commercial risk radar (LD%, DLP, PBG%), corrigendum/amendment handling, compliance-pack export (PDF/Excel), multi-bid portfolio view.

### 2. Domain Model — **KEEP**

Well-formed DDD: aggregates (`BidProject`, `TenderDocument`, `IngestionJob`, `ComplianceItem`, `AuditLog`), immutable value objects (`Provenance`, `ExecutionRules`, `Money`, `BidStatus`, `ComplianceStatus`, `DocumentStatus`), explicit state machines, optimistic `version` locking, domain events on `AggregateRoot`. **Caveat:** the HTTP services (`bids.service.ts`, `compliance.service.ts`, `documents.service.ts`) bypass this domain layer and do CRUD directly via Drizzle; the domain/application layer (`presentation/BidsController.ts`, use cases) is only partially wired in. Two parallel stacks exist.

### 3. Authentication — **REPLACE**

- `AuthService.login` returns `tp_demo_access_<base64(JSON)>` — **unsigned, forgeable by anyone**. No JWT signing, no verification middleware anywhere in the codebase (grep confirms zero token verification).
- `POST /api/v1/auth/refresh` takes **no credentials** and returns a token for `SELECT ... LIMIT 1` (first user). Complete account takeover.
- Password hashing with bcrypt cost-10 + dummy-hash timing defense is real and good.
- Docs (`SECURITY_MODEL.md`) claim signed JWTs, Argon2id, revocable refresh, session store — none of that exists. Docs are stale and must be reconciled.
- Demo credentials are printed to the console at boot (`main.ts`).

### 4. RBAC — **ADAPT**

- **KEEP the model:** atomic permissions (`bids:create`, `compliance:review`, …), 5 roles, deny-by-default matrix in `common/security/permissions.ts`, `TenantContextHolder.requirePermission()` enforced in 4 application use cases (`CreateBidUseCase`, `GenerateUploadUrlUseCase`, `ConfirmDocumentUploadUseCase`, `GetDocumentDownloadUrlUseCase`).
- **REPLACE the wiring:** no NestJS Guard/Interceptor; HTTP controllers (`bids.controller.ts`, `documents.controller.ts`, `compliance.controller.ts`, `audit.controller.ts`) never populate `TenantContextHolder` and never check permissions. Frontend `ProtectedRoute` is UX-only (correctly documented as such).

### 5. Tenant Isolation — **ADAPT**

- Schema carries `organization_id` on every table; use-case-level scoped queries exist and are E2E-tested *with manually injected context*.
- **But:** `BidsService.createBid`, `DocumentsService.generateUploadUrl/confirmUpload`, storage paths all hardcode `org_acme_infra_001`. No `organizations`, `organization_memberships`, `roles`, `permissions` tables (the ERD in `SECURITY_MODEL.md` is aspirational). No per-request tenant resolution. A second tenant cannot exist.
- Cross-tenant IDOR tests pass only because the test harness injects the context the HTTP layer never establishes.

### 6. Tender Ingestion — **ADAPT**

- Presigned upload URL generation (GCS V4 / S3), confirm handshake with `headObject` size verification, download URLs, two-phase delete (bid + document cascade with storage prefix pruning) — all implemented and tested.
- **Weaknesses:** `pendingUploads` is an in-memory `Map` (lost on restart; mitigated by DB/prefix fallback lookups but fragile); no SHA-256 checksum verification end-to-end despite DTO support; no file-type/magic-byte validation beyond client-declared MIME; no OCR for scanned PDFs (docs claim Tesseract/Textract fallback — not implemented); no corrigendum versioning; `submission_deadline` stored as TEXT.

### 7. Document Processing — **ADAPT**

- `DocumentContentNormalizer` (pdfjs-based, page blocks, form-feed parsing) and `AiDocumentExtractor` (multi-zone candidate page selection, up to 60 pages) are real and handle large tenders.
- Missing: OCR, layout/section segmentation (BDS/GCC/SCC), table extraction, duplicate-document detection, virus/malware scanning of uploads.

### 8. Requirement Extraction — **ADAPT**

- Production path (`ProductionExtractionPipeline` + `default_tender_extractor`) is **deterministic regex/keyword matching**, not LLM inference. It is reliable and fully grounded (every quote is a verified substring), which is architecturally the right default for compliance — but it is not the "AI extraction" the docs describe.
- LangGraph workflow (`workflow/graph.py`, `nodes.py`, `state.py`), grounding verifier, human-in-the-loop `interrupt()/resume`, and `HumanReviewManager` exist and are tested in Python, but are **not the production HTTP path**.
- Rule fusion / multi-page deduplication is implemented (merges `(category, normalized_title)`, most-restrictive rules).

### 9. Compliance Checking — **ADAPT**

- Checklist generation, status lifecycle, review notes, optimistic concurrency (`expectedVersion`), metric rollups (`totalRequirements`/`flagged`/`approved`), bid status transitions — all working.
- Missing: deterministic eligibility arithmetic (tender threshold vs. contractor profile — the "zero AI financial math" promise is unimplemented because there is no contractor profile), evidence gap analysis, deadline tracking.

### 10. Evidence Handling — **MISSING**

No contractor document repository, no association of stored master documents (CA certificate, GST cert, ISO, work-order completion certificates) to checklist items, no expiry-date checking, no "your certificate expires next week" alerting. This is a core MVP value prop (PRODUCT.md §4 workflow step 3) with zero implementation.

### 11. AI/LLM Usage — **REPLACE (the integration); KEEP (the safety tooling)**

- **No real LLM is ever called.** `StructuredLLMClient` is a shim around a local Python function; `extractor_fn` defaults to regex. There is no Bedrock/Vertex/gateway client code, no API-key plumbing, no token/cost accounting, no provider failover.
- **KEEP the security layer:** `SecretSanitizer` (pre-invocation scrub), `SecurityContext` immutable contract, scoped retrieval with tenant filtering, network egress guard, prompt-injection neutralization via XML structural tags — all real and tested (27 Python tests).
- AI evaluation framework (12-dimension matrix, synthetic dataset, regression scorecard) is real and wired into CI.

### 12. Database — **ADAPT**

- Drizzle schema (`schema.ts`) is clean and type-safe; PKs, FKs with `ON DELETE CASCADE`, JSONB for `execution_rules`/`provenance`.
- **REPLACE the runtime:** PGlite embedded in-process is a dev convenience, not a production database (single process, local disk, no concurrent-writer safety, no backup/PITR). `docker-compose.yml` provisions real Postgres 16 and passes `DATABASE_URL`, but the app never reads it — the compose file is currently decorative.
- No migration tool (raw `CREATE TABLE IF NOT EXISTS` at boot — dangerous for production evolution); no indexes beyond PK/unique; no RLS (documented as present in `AWS.md` — it is not).

### 13. APIs — **ADAPT**

- REST endpoints under `/api/v1` for auth, bids, documents (upload-url, confirm, download-url, delete, SSE progress), compliance (list, get, review), audit. Working.
- **Gaps:** no authentication middleware (see §3); no OpenAPI/contract spec; two parallel controller stacks (DDD `presentation/` classes are dead code — not routed); no pagination on list endpoints; SSE progress is simulated (interval timer), not wired to real job state; `X-Internal-Service-Key` guard exists for M2M but only in the unused `InternalWorkerController` class.

### 14. Async Processing — **ADAPT**

- **KEEP the design:** `IJobQueue` port with AWS SQS and GCP Pub/Sub adapters (both with tests), DLQ/redrive, lease locks (`lockedUntil`), exponential backoff, idempotent delivery, `IngestionJob` state machine, `IngestionWorker`.
- **REPLACE the live path:** the production HTTP flow runs extraction **synchronously inside `confirmUpload`** (calls the AI engine inline). The queue/worker path exists in code and E2E tests but is not what the app does at runtime. Choose one path; today there are two, and the tested one isn't shipping.

### 15. Event Architecture — **ADAPT**

- `AggregateRoot.addDomainEvent/pullDomainEvents`, `IEventBus` with `InMemoryEventBus`, 4 event types, idempotent subscription by `eventId`, reference-only payload policy — all real and tested.
- EventBridge adapter (ADR 0012) is documented but not implemented; audit is the only subscriber in production; SSE "realtime" is simulated.

### 16. Frontend — **KEEP (minor ADAPT)**

React 18 + Vite SPA: login, dashboard, bid detail, compliance review, audit timeline; design tokens; RBAC-aware conditional rendering; in-memory access token (no localStorage for access token — good); presigned PUT uploader with XHR progress; SSE progress bar; format utilities. ~24 web tests. Will need rework only when real JWT/refresh lands (client already sends `Authorization: Bearer`).

### 17. Tests — **KEEP**

Good pyramid: domain unit tests, use-case specs, E2E vertical slices (core workflow, async pipeline, domain events, production AI pipeline), AI security/eval suites. **Blind spot:** all API tests run against in-process PGlite with manually injected `TenantContextHolder`, so the HTTP auth/tenant gaps in §3/§5 are invisible to the suite. Add HTTP-level auth tests.

### 18. Security — **REPLACE (critical items); KEEP (hardening patterns)**

Critical (exploitable today):
- Forgeable access tokens; unauthenticated refresh endpoint; zero endpoint guards; all tenant data readable/writable by anyone who can reach the port.
- Hardcoded audit identity (`usr_bid_mgr_01` / "Vikramaditya Sharma") — audit trail attribution is fiction, defeating the product's core "immutable audit" promise.
- `CORS: origin: '*'`; no rate limiting; no request-size limit on SSE route; refresh token in localStorage (XSS exposure).

Good (keep): bcrypt + dummy-hash timing defense, `timingSafeEqual`/`compare_digest` for internal keys, 1MB body cap, prod-fails-if-missing `INTERNAL_SERVICE_KEY`, AI secret scrubber, untrusted-input XML tagging.

Also present on disk (gitignored, not committed): `gcp-key.json`, `.env.local` — verify they never enter CI artifacts or container images.

### 19. Infrastructure — **ADAPT**

Terraform is comprehensive: AWS (VPC, ECS, RDS, S3, SQS, KMS, IAM) and GCP (GCS, Pub/Sub) environments,模块化 modules, least-privilege roles. **But:** CI deploy stages are `echo` placeholders (see §21); `docker-compose.yml` Postgres is unused by the app; no Dockerfiles validated in CI beyond dry-run build; no secrets rotation; no backup/restore runbook tested.

### 20. Observability — **MISSING**

`console.log`/`console.warn` only. No structured logging, no request IDs, no metrics (Prometheus/OTel), no tracing, no alerting, no dashboards, no health endpoint on the API (only the AI service has `/health`). SRE posture is absent.

### 21. CI/CD — **ADAPT**

Real and valuable: lint, typecheck, unit/integration tests, AI evaluation scorecard gates, security regression tests, gitleaks, docker dry-run builds, OIDC permissions scaffolding. **Not real:** stages 7–9 (staging deploy, smoke tests, production deploy) are `echo` commands — the pipeline reports success without deploying anything. `format:check` runs with `|| true` (non-blocking). No migration step actually executes.

---

## 2. Existing ParakhSetu-like Capabilities

These are the tender-compliance capabilities that already work and map directly to the incumbent/ParakhSetu-style problem space:

| Capability | Status |
|---|---|
| Tender project registration (NIT number, authority, est. value, deadline) | Working |
| Multi-document upload via presigned URLs (GCS/S3) with confirm handshake | Working |
| PDF text extraction (digital, multi-zone page selection, 200+ pages) | Working |
| Compliance requirement extraction across 16 Indian procurement domains | Working (deterministic regex) |
| Execution rules (stamp paper ₹, notarization, UDIN, signing authority) | Working |
| Verbatim provenance quotes + page + clause references | Working, verified substring grounding |
| Multi-page dedup + most-restrictive rule fusion | Working |
| Human review lifecycle (READY/FLAGGED/WAIVED, notes, optimistic locking) | Working |
| Immutable audit event log (per bid, per document, per review) | Working (attribution hardcoded) |
| RBAC permission matrix + AsyncLocalStorage tenant context (use-case level) | Working in tests |
| Two-phase cascade deletion (DB + storage prefix) | Working |
| Cloud-agnostic ports (IStorageService, IJobQueue) with S3/GCS/SQS/PubSub adapters | Working |
| Async pipeline design with DLQ, leases, retries, idempotency | Designed + E2E tested, not the live path |
| AI safety tooling (secret scrub, injection tagging, scoped retrieval, grounding verifier) | Working in AI service tests |
| React SPA with role-aware UI, SSE progress, audit timeline | Working |
| Terraform IaC for AWS + GCP environments | Written, not applied in CI |

## 3. Capabilities Required for the New Product but Currently Missing

Relative to the documented production SaaS vision (`docs/PRODUCT.md`, `docs/MVP.md`):

**P0 — product cannot ship without:**
1. Real authentication: signed JWT access + revocable refresh tokens, verification middleware, logout/revocation, session management.
2. Per-request tenant resolution from authenticated identity; `organizations` + `organization_memberships` tables; multi-tenant seeding; removal of all `org_acme_infra_001` literals.
3. HTTP-layer guards wiring RBAC into every controller (anti-IDOR scoped queries on every lookup).
4. Real PostgreSQL as the runtime database (honor `DATABASE_URL`), migration tooling (Drizzle Kit/Prisma Migrate), indexes, RLS or equivalent enforcement.
5. Eligibility / Go-No-Go engine: contractor master profile (turnover, solvency, past work, certifications) + deterministic threshold evaluation.
6. Evidence repository + document-to-checklist matching with expiry detection.

**P1 — competitive differentiation:**
7. Commercial risk radar (LD%, DLP, PBG%, payment terms) surfacing.
8. Corrigendum/amendment ingestion and re-extraction diffing.
9. Compliance-pack export (PDF/Excel) with citations.
10. OCR for scanned tenders; section/layout segmentation.
11. Real LLM integration behind `StructuredLLMClient` (provider adapter, key management, cost/token accounting, fallback) with the existing safety tooling — regex path retained as deterministic baseline.
12. Async worker as the live extraction path (queue → worker → bulk ingest), SSE wired to real job state.

**P2 — operational maturity:**
13. Observability stack (structured logs, request IDs, metrics, tracing, alerting, API health endpoint).
14. Real CI/CD deploy stages (ECS/GCS deploys, migrations, smoke tests) replacing echo placeholders.
15. Rate limiting, CORS lockdown, request validation hardening, security headers.
16. Multi-tenant vector/artifact isolation for RAG (designed in ADR 0013, unimplemented).
17. Organization admin: user invite, role management, API keys, billing hooks.

---

## 4. A–E Summary

### A. What we already built well
- Domain model, value objects, state machines, optimistic concurrency (DDD design is interview-grade).
- Ports & adapters: cloud-neutral `IStorageService`/`IJobQueue` with production S3, GCS, SQS, Pub/Sub adapters.
- Deterministic grounding discipline: every compliance claim carries a verified verbatim quote — the single most important property of this product.
- Async pipeline resilience design: DLQ, leases, backoff, idempotency, crash recovery — all E2E tested.
- AI security tooling: secret scrubbing, injection neutralization, scoped retrieval, network egress guard.
- Frontend SPA quality: tokens in memory, role-aware UX, presigned upload with progress, audit timeline.
- Documentation depth: 15 ADRs with explicit WHY/trade-offs; threat models; evaluation framework.
- CI quality gates: typecheck, lint, tests, AI scorecards, gitleaks.

### B. What should not be thrown away
- The entire `docs/` corpus and ADR set (fix stale claims, don't discard).
- Domain/application layer (entities, VOs, use cases, repositories ports) — wire it into HTTP instead of bypassing it.
- `permissions.ts` / `TenantContext.ts` / `InternalServiceGuard.ts` security primitives.
- Infrastructure adapters (`AwsS3StorageService`, `GcsStorageService`, `AwsSqsJobQueue`, `GcpPubSubJobQueue`) and their specs.
- `apps/ai` security modules, evaluation framework, and LangGraph workflow code.
- Frontend structure and component library; `packages/shared-types`.
- Terraform modules and environment definitions.

### C. What needs architectural changes
- **Authentication stack** (REPLACE): signed tokens, verification middleware, revocation. Everything downstream depends on it.
- **Tenant resolution** (REPLACE the hardcoded literals): identity → organization per request; membership tables.
- **Persistence runtime** (REPLACE PGlite-as-production): real Postgres + migrations; keep Drizzle schema.
- **Extraction path** (ADAPT to one path): make the queue→worker pipeline the live path or delete the synchronous inline path; eliminate the dual-stack controller duplication.
- **LLM integration** (REPLACE the shim): real provider client behind the existing safety contract.
- **Audit attribution** (FIX): derive `userId`/`userName` from authenticated context, never hardcode.

### D. What we should build next (recommended order)
1. Real auth (JWT sign/verify, refresh rotation, logout) + HTTP auth middleware + per-request TenantContext. **This unblocks everything and closes the critical hole.**
2. Multi-tenant schema (organizations, memberships) + remove `org_acme_infra_001` literals + tenant-scoped queries at HTTP layer + cross-tenant tests.
3. Real Postgres runtime via `DATABASE_URL` + migration tooling + indexes.
4. Contractor profile + eligibility engine (deterministic threshold math) — the P0 product differentiator.
5. Evidence repository + matching + expiry alerts.
6. Risk radar + corrigendum handling + export.
7. Observability (health endpoint, structured logs, request IDs, metrics).
8. Real LLM adapter behind `StructuredLLMClient` with regex fallback.
9. Real CI deploy stages; then production hardening (rate limits, CORS, security headers).

### E. Technical debt that could become dangerous later
1. **Forgeable tokens + unauthenticated `/auth/refresh`** — total account takeover; must be fixed before any deployment beyond localhost.
2. **Zero endpoint guards** — every endpoint currently trusts the caller; RBAC exists only in unused use-case paths.
3. **Hardcoded tenant and audit identity** — silently corrupts the audit trail the product sells on; becomes fraudulent evidence at scale.
4. **PGlite in the production path** — data loss/corruption risk under concurrency; `data/postgres` on disk is not a backup story.
5. **Stale docs vs. code** (`SECURITY_MODEL.md`, `AWS.md` claim JWT/Argon2/RLS that don't exist) — creates false confidence in reviews, interviews, and audits; doc-code drift will compound.
6. **Two parallel controller/service stacks** (DDD classes vs. NestJS HTTP services) — future features will be built on the wrong one; consolidation debt grows.
7. **In-memory `pendingUploads` and `InMemoryEventBus`** as runtime paths — state evaporates on restart/deploy.
8. **CI deploy stages are echoes** — green pipeline ≠ deployed system; false deployment confidence.
9. **No migrations** — boot-time `CREATE TABLE IF NOT EXISTS` will break on schema evolution with real data.
10. **Regex extractor labeled "AI"** — product/marketing claims outrun the engine; keyword drift on new tender formats will silently degrade extraction quality with no monitoring to detect it.

---

*Stop point reached: audit only. No code was modified, per PROMPT 0.*
