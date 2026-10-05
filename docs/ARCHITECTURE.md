# HLD Delta: Existing Architecture → Bidder-Side Target Architecture

**Date:** 2026-10-05
**Baseline:** `docs/architecture/ARCHITECTURE.md` (v1.0 HLD), `docs/architecture/LLD.md`, `docs/CURRENT_STATE.md` (audit), `docs/PRODUCT.md` v2.0 (pivot), `docs/DOMAIN.md` Part B (domain model).
**Status:** Design only — no implementation authorized by this document.

This is an **architecture delta**, not a redesign. The v1.0 architecture (two-tier boundary, modular monolith, ports & adapters, async pipeline) is fundamentally sound. The pivot changes **what the domain is**, not **how the system is built**.

## Target Conceptual Architecture (unchanged shape)

```
┌─────────────────────────────────────────────────────────────────┐
│ Frontend (React 18 SPA — KEEP, extend with Profile/Scorecard UI) │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS + JWT
┌──────────────────────────────▼──────────────────────────────────┐
│ Application/API Layer (NestJS modular monolith — KEEP)          │
│  Guards: JWT verify → Tenant resolve → Permission check         │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│ Domain/Application Services (NEW/ADAPTED module map, §3)        │
│  EligibilityEngine, MatchingEngine, ReadinessRollup (pure)      │
└───────┬──────────────────────────────────────────┬──────────────┘
        │ enqueue (IJobQueue)                      │ domain events
┌───────▼──────────────────────────┐   ┌───────────▼─────────────┐
│ AI Orchestration Boundary        │   │ EventBus → Audit,       │
│ (FastAPI worker — KEEP)          │   │ Notifications, SSE      │
│ extract / structure / classify   │   └─────────────────────────┘
└───────┬──────────────────────────┘
        │
┌───────▼─────────────────────────────────────────────────────────┐
│ Infrastructure Ports (IStorageService, IJobQueue, IRepo,        │
│  IEventBus, IConnector — KEEP + NEW IConnector)                 │
└───────┬─────────────────────────────────────────────────────────┘
        │
┌───────▼─────────────────────────────────────────────────────────┐
│ Infrastructure Adapters: GCS/S3 · PubSub/SQS · Postgres ·       │
│  EventBridge · DigiLocker OAuth · Account Aggregator (NEW)      │
└─────────────────────────────────────────────────────────────────┘
```

**Modular monolith retained.** The existing two-tier split (NestJS application + FastAPI AI engine) already gives the right boundary; there is no strong reason to introduce microservices (ADR 0001 stands).

---

## 1. What can remain (KEEP)

| Existing element | Disposition |
|:-----------------|:------------|
| Two-tier service boundary (NestJS + FastAPI), ADR 0001 | KEEP — Python ecosystem for document/AI, TypeScript for domain |
| Modular monolith + DDD layered structure, ADR 0008 | KEEP — module-per-bounded-context |
| React 18 + Vite SPA, design tokens, RBAC-aware UX | KEEP — extend with Profile, Scorecard, Readiness screens |
| PostgreSQL + Drizzle, JSONB for value objects | KEEP — schema evolves (new aggregates), same engine |
| Presigned upload + confirm handshake, `IStorageService` port, GCS/S3/Mock adapters | KEEP — now serves tender packages **and** the Evidence Vault |
| Async pipeline design: `IJobQueue`, SQS/PubSub adapters, DLQ, leases, backoff, idempotency, ADR 0003 | KEEP — becomes the **live** path (see §4) |
| Domain events + `AggregateRoot` + `IEventBus`, ADR 0012 | KEEP — event catalog expands |
| AI safety tooling (secret scrubber, injection neutralization, scoped retrieval, network guard, grounding verifier) | KEEP — unchanged |
| AI evaluation framework + regression gates in CI | KEEP — extends to matching determinism tests |
| RBAC permission matrix + `TenantContextHolder` (AsyncLocalStorage) | KEEP the model — wire into HTTP layer |
| Two-phase cascade deletion, ADR 0015 | KEEP — generalized to all tenant-owned aggregates |
| Append-only audit log | KEEP — attribution fixed to authenticated identity |
| Human-review lifecycle pattern (propose → validate → review → approve/reject/edit, optimistic concurrency) | KEEP — promoted from Python-only to a first-class module |
| Terraform modules (AWS + GCP), CI quality gates, docker-compose | KEEP — deploy stages must become real (audit finding) |
| 16-domain extraction taxonomy + verbatim provenance | KEEP — extended with structured eligibility criteria |

## 2. What must change (ADAPT / REPLACE)

| Existing element | Change | Driver |
|:-----------------|:-------|:-------|
| Demo auth tokens (`tp_demo_access_`) | REPLACE with signed JWT + revocable refresh + verification middleware | Audit critical finding — exploitable today |
| Hardcoded `org_acme_infra_001` | REPLACE with per-request tenant resolution from authenticated identity | Audit critical finding; multi-tenancy is the product |
| PGlite embedded runtime | REPLACE with real PostgreSQL via `DATABASE_URL` + migration tool | Audit — PGlite is dev-only |
| `BidProject` aggregate | SPLIT into **Tender** + **BidCase** aggregates | Domain pivot — one entity conflated opportunity and pursuit |
| `ComplianceItem` aggregate | SPLIT into **TenderRequirement** (extraction) + **EvidenceMatch** (evaluation) | Requirement ≠ satisfaction of requirement |
| Dual controller stacks (dead DDD `presentation/` classes + live CRUD services) | CONSOLIDATE — wire DDD use cases into HTTP controllers; delete CRUD bypass | Audit — domain layer is bypassed at runtime |
| Synchronous extraction inside `confirmUpload` | ADAPT — queue→worker becomes the live path | ADR 0003 already mandated async; runtime violated it |
| Regex-only extractor as "the AI" | ADAPT — keep as deterministic baseline; add real LLM adapter behind `StructuredLLMClient` | Product needs semantic extraction; regex remains the safe fallback |
| Extraction output as prose | ADAPT — requirements carry structured **Criterion** objects (type/operator/threshold/unit/window) | Matching requires machine-testable criteria |
| Hardcoded audit identity (`usr_bid_mgr_01`) | REPLACE with authenticated userId/userName | Audit trail integrity |
| Simulated SSE progress | ADAPT — SSE reflects real `WorkflowRun` state | Readiness depends on real job state |
| No Evidence/Profile/Decision/Risk modules | NEW (§3) | Product pivot |

## 3. New modules required

Target module map for the 14 logical areas. **Classification:** KEEP = exists and fits; ADAPT = exists, must change; NEW = build.

| Logical area | Module | Aggregates | Classification | Notes |
|:-------------|:-------|:-----------|:---------------|:------|
| Identity & Access | `identity` | Tenant, User, Membership, Role (ref), Permission (ref) | ADAPT | Real JWT, per-request tenant resolution, org admin (invite/role) |
| Company Capability | `company-capability` | **CompanyProfile**, CapabilityEntry (11 specializations) | NEW | The differentiator; versioned; evidence-linked |
| Tender Management | `tender` | **Tender**, TenderRequirement, TenderAmendment | ADAPT (from `bids`) | Tender = opportunity + package; amendments supersede |
| Document Management | `document` | TenderDocument, **EvidenceDocument** | ADAPT | One upload handshake serves tenders and evidence |
| Requirement Analysis | `requirement-analysis` | (reads TenderRequirement) | NEW (extraction side ADAPTs) | Structures criteria from AI output; owns grounding verification |
| Evidence Management | `evidence` | EvidenceMatch | NEW | Vault + matching + expiry tracking |
| Compliance | `compliance` | (reads EvidenceMatch register) | ADAPT | Gap register re-centered on bidder needs |
| Risk | `risk` | **RiskFinding** | NEW | Commercial traps + EMD affordability |
| Bid Decision | `bid-decision` | **BidCase**, BidDecision, MatchScorecard | NEW | **EligibilityEngine + MatchingEngine** live here (deterministic) |
| Workflow | `workflow` | **WorkflowRun** | ADAPT (from `IngestionJob`) | Unchanged state machine; becomes live path |
| Human Review | `human-review` | **ReviewTask**, ReviewDecision | NEW (pattern ADAPTs from Python `HumanReviewManager`) | First-class module serving all aggregates |
| AI | `ai-engine` (FastAPI) | — | ADAPT | LLM adapter behind safety contract; regex baseline |
| Artifacts | `artifacts` | **GeneratedArtifact** | NEW | Packet-1 pack export (PDF/Excel) |
| Notifications | `notifications` | — | NEW | SSE (real job state) + queued email/in-app |
| Audit | `audit` | **AuditEvent** | ADAPT | Identity-attributed, cross-aggregate |

## 4. Which existing boundaries are wrong

1. **Presentation↔Domain boundary violated.** HTTP controllers call CRUD services that do domain work directly; the DDD use-case layer exists but is dead code. **Fix:** controllers delegate to application use cases; services become thin. (ADR 0017)
2. **Async boundary violated at runtime.** ADR 0003 mandates queue-based processing, but `confirmUpload` runs extraction inline. **Fix:** confirm records the document, enqueues a `WorkflowRun`, returns; SSE streams real job state. (ADR 0018)
3. **Tenant boundary is fictional.** Tenant context never established per request. **Fix:** JWT guard → `TenantContextHolder.run()` wraps the entire request. (ADR 0016)
4. **AI boundary violated.** The API service calls the AI engine inline (and the "engine" is regex). **Fix:** AI only reachable via the worker path; LLM adapter behind `StructuredLLMClient` with the regex extractor as deterministic baseline. (ADR 0018)
5. **Missing bounded contexts.** Evidence, Company Profile, Decision, Risk, Artifacts, Notifications have no module boundary at all. **Fix:** §3 module map.
6. **Extraction/evaluation conflation.** `ComplianceItem` mixes "what the tender demands" with "our state of satisfaction". **Fix:** split into TenderRequirement + EvidenceMatch.

## 5. Which services/modules should remain together

- **Identity & Access + Audit** — cross-cutting; stay in `common/` + `audit` module. Auth guards and audit interceptors are request lifecycle concerns.
- **Company Capability + Evidence Management** — the profile is only valuable because it is evidence-backed; capability entries and evidence documents share validity-window logic and expiry detection. Keep in one module (`company-capability`) or tightly coupled modules sharing the same database transaction boundary.
- **Tender Management + Document Management** — a tender is its package; upload/confirm/delete flows are one workflow.
- **Bid Decision + Compliance + Risk + Evidence Matching** — all are projections of the **BidCase** aggregate; one module (`bid-decision`) owning the assessment transaction. Splitting them across modules would force distributed consistency for what is one evaluation.
- **Requirement Analysis + AI boundary** — extraction contracts (Pydantic ↔ TypeScript DTOs) must version together.
- **Workflow + Notifications** — job state changes drive progress events; co-locate the SSE emitter with the workflow lifecycle.
- **Human Review** — standalone module, consumed by BidCase, TenderRequirement, and Profile (review of profile edits).

## 6. Where AI belongs

**Inside the AI Orchestration Boundary (FastAPI), reached only through the async worker path.**

| AI does | AI never does |
|:--------|:--------------|
| Parse/segment documents (layout, sections) | Eligibility arithmetic (turnover, counts, shortfalls) |
| Extract requirements → structured Criteria | Verdicts (GO/NO-GO) |
| Surface/classify commercial risk clauses | Authorization or tenant resolution |
| Suggest corrigendum requirement diffs | Storing or accessing tenant data directly (zero ambient authority) |
| Semantic matching *suggestions* (Phase 3+) | Financial math of any kind |

The deterministic regex extractor remains the **production baseline**; the LLM is an opt-in adapter behind `StructuredLLMClient` with identical output contracts and the existing safety tooling (scrubber, grounding verifier, network guard). This is deliberate: when the LLM hallucinates, the system degrades to the deterministic path, not to silence.

## 7. Where deterministic business logic belongs

**Domain/Application layer of the NestJS modular monolith** — pure, testable functions, no framework dependencies:

- **EligibilityEngine** — criterion evaluation (thresholds, lookback windows, rank hierarchies, validity windows) → `EligibilityVerdict` with structured shortfalls.
- **MatchingEngine** — requirement ↔ capability/evidence resolution → `MatchState`.
- **ReadinessRollup** — completeness %, open-risk severity, deadline pressure → `ReadinessScore`.
- **ExecutionRules validation** (stamp paper, notarization, UDIN, signing rank), **EMD affordability**, **state machines**, **optimistic concurrency**.
- **Zero AI financial math** (product principle) is enforced *architecturally*: the AI service output schema has no field capable of expressing a verdict or a monetary computation.

## 8. Where asynchronous processing is used

| Workflow | Why async |
|:---------|:----------|
| Tender package ingestion → parsing → extraction | 60–180s workloads; HTTP timeouts; crash recovery (ADR 0003 rationale stands) |
| Matching + assessment + scorecard generation after extraction completes | Chained CPU/IO work; retriable; idempotent via `WorkflowRun` |
| Corrigendum re-evaluation | Re-runs only changed criteria; long-running diff + re-match |
| Artifact (PDF/Excel) generation | Rendering is slow and bursty |
| Notifications (email/in-app) | Side effect, not request-critical |
| External connector syncs (Phase 2: DigiLocker/AA fetches) | Third-party latency and consent round-trips |

**Not async:** login, profile CRUD, review actions, decision confirmation, readiness queries — all request/response with transactional consistency.

## 9. Where events are used

**Domain events (in-process, `IEventBus` → Audit + Notifications + SSE):**

- `TenderRegistered`, `TenderDocumentUploaded`, `TenderAmendmentApplied`
- `RequirementsExtracted` (with requirement IDs — reference-only payloads, never raw text)
- `CompanyProfileVersionCreated`, `EvidenceDocumentVerified/Expired/Revoked`
- `MatchCompleted` (BidCaseId, verdict summary — no sensitive payloads)
- `BidDecisionProposed`, `BidDecisionConfirmed`
- `RiskIdentified`, `ReadinessChanged`, `ReviewTaskResolved`, `ArtifactGenerated`

**EventBridge (deferred, ADR 0007/0012 stand):** scheduled corrigendum-monitoring cron (where legally permissible), nightly profile-expiry digests, cross-service fan-out if the system ever splits.

**Idempotency:** every event carries `eventId`; subscribers dedupe (existing pattern).

## 10. Where human review occurs

Four gates — **AI proposes, human confirms** — implemented by the `human-review` module (`ReviewTask` aggregate, `compliance:review` permission, optimistic concurrency, expiry, reassignment):

| Gate | Trigger | Human action |
|:-----|:--------|:-------------|
| **Requirement confirmation** | Requirements extracted (PENDING) | Confirm / reject / edit each requirement & its criteria |
| **Evidence exception review** | MatchState = PARTIAL or EXPIRED | Accept the gap, attach better evidence, or waive with note |
| **Bid decision confirmation** | EligibilityEngine proposes GO / CONDITIONAL-GO / NO-GO | Confirm, override with rationale (recorded) |
| **Readiness sign-off** | ReadinessScore ≥ threshold | Sign off `READY_TO_SUBMIT`; artifact export unlocks |

Profile edits to verified capabilities may also require review for regulated sections (financials) — configurable per tenant.

---

## Sequence: the new evaluation flow (target)

```
SPA ──POST /tenders──> API (JWT guard, tenant ctx) ──> CreateTenderUseCase ──> Tender aggregate
SPA ──POST /tenders/:id/upload-url──> presigned URL (IStorageService)
SPA ──PUT (direct to storage) + POST /confirm──> ConfirmUploadUseCase
        ├─> TenderDocument persisted (UPLOADED)
        └─> WorkflowRun enqueued (IJobQueue)            ──async──> Worker
                 │                                          ├─> parse + normalize pages
                 │                                          ├─> AI boundary: extract + structure criteria
                 │                                          ├─> Grounding verification (deterministic)
                 │                                          ├─> TenderRequirement persisted (PROPOSED)
                 │                                          ├─> EligibilityEngine + MatchingEngine
                 │                                          │     (against pinned CompanyProfile@vN)
                 │                                          ├─> EvidenceMatch + RiskFinding persisted
                 │                                          ├─> BidDecision proposed (AI_PROPOSED)
                 │                                          └─> Events: RequirementsExtracted,
                 │                                              MatchCompleted, DecisionProposed
                 └─<── WorkflowRun COMPLETED ───────────────┘
SPA ←──SSE: progress + completion──
SPA ──POST /bid-cases/:id/decision/confirm──> Human gate 3 ──> BidDecision CONFIRMED
SPA ──POST /bid-cases/:id/readiness/sign-off──> Human gate 4 ──> READY_TO_SUBMIT + ArtifactGenerated
```

## ADRs issued with this delta

- **ADR 0016** — Bidder-Side Pivot: Company Profile, Tender, and BidCase aggregates
- **ADR 0017** — Enforce the Layered Boundary at HTTP (eliminate CRUD bypass)
- **ADR 0018** — Async-First Extraction and AI Invocation (queue→worker as the live path)
- **ADR 0019** — Deterministic Eligibility & Matching Engine (placement and LLM exclusion)
- **ADR 0020** — External Data Connectors behind an Enrichment Port (DigiLocker OAuth, Account Aggregator)

---

## Company Capability Profile — Module Architecture (PROMPT 5)

The differentiator is a **first-class module** in the modular monolith, not a feature bolted onto the tender flow. Design rationale: the profile is the system of record; everything else (matching, decisions, readiness) reads from it.

### Module Anatomy

```
apps/api/src/modules/company-capability/
├── domain/
│   ├── entities/
│   │   ├── Company.ts                    # Legal entity (distinct from Tenant)
│   │   ├── CompanyProfile.ts             # Aggregate root (versioned)
│   │   ├── CapabilityEntry.ts            # 11 section specializations
│   │   └── EvidenceDocument.ts           # Small aggregate (proof blobs)
│   ├── value-objects/
│   │   ├── ValidityWindow.ts             # validFrom/validTo, isValidAt(date)
│   │   ├── VerificationTier.ts           # AUTHORITY > ISSUER > SELF > UNVERIFIED
│   │   ├── SourceRecord.ts               # {sourceType, operator, consent, externalRef}
│   │   └── CapabilityAttributes.ts       # Per-subtype JSON Schema validation
│   ├── exceptions/
│   └── repositories/
│       ├── ICompanyProfileRepository.ts
│       ├── ICapabilityEntryRepository.ts
│       └── IEvidenceRepository.ts
├── application/
│   ├── use-cases/
│   │   ├── CreateProfileUseCase.ts
│   │   ├── AddCapabilityUseCase.ts       # + attach evidence, one transaction
│   │   ├── UpdateCapabilityUseCase.ts    # drafts a new version
│   │   ├── PublishProfileVersionUseCase.ts  # mints immutable version, swaps ACTIVE
│   │   ├── VerifyCapabilityUseCase.ts    # REVIEWER gate
│   │   ├── AttachEvidenceUseCase.ts
│   │   ├── ImportFromConnectorUseCase.ts # DigiLocker/AA enrichment (IConnector)
│   │   └── GetProfileForEvaluationUseCase.ts  # read pinned version (matching)
│   └── queries/
│       ├── ProfileCompletenessQuery.ts   # derived per-section scores
│       └── ExpiringEvidenceQuery.ts      # 30/15/7-day horizon
├── infrastructure/
│   ├── persistence/                      # Drizzle repositories (Part B schema)
│   ├── connectors/                       # IConnector adapters (ADR 0020)
│   │   ├── DigiLockerConnector.ts
│   │   ├── AccountAggregatorConnector.ts
│   │   └── MockConnector.ts
│   └── expiry/                           # Scheduled scan → events
└── presentation/
    ├── CompanyProfileController.ts       # HTTP: profile CRUD, publish, verify
    ├── EvidenceController.ts             # HTTP: upload, attach, detach
    └── dto/
```

### Key Flows

**Flow 1 — Maintain the profile (write path, request/response):**

```
SPA ──POST /companies/{id}/capabilities──> AddCapabilityUseCase
        ├─ Validate attributes against subtype JSON Schema (domain)
        ├─ Attach EvidenceDocument (presigned upload happened earlier)
        ├─ INSERT capability_entries + capability_evidence (one transaction)
        ├─ AuditEvent: CAPABILITY_ADDED {before, after}
        └─ Profile remains DRAFT until publish
SPA ──POST /companies/{id}/profiles/publish──> PublishProfileVersionUseCase
        └─ INSERT new company_profiles row (version=N+1)
           + atomically flip ACTIVE (partial unique index enforces one ACTIVE)
           + AuditEvent: PROFILE_VERSION_PUBLISHED
```

**Flow 2 — Evaluation read path (inside the worker, ADR 0018):**

```
MatchingEngine (deterministic, ADR 0019)
   └─ GetProfileForEvaluationUseCase.execute(bidCase.profileVersionId)
        └─ SELECT capability_entries WHERE profile_id = :pinnedVersion
             (never the ACTIVE version — reproducibility over freshness)
   └─ For each extracted Criterion → pure function evaluation
        └─ ValidityWindow.isValidAt(submissionDate)  ← point-in-time validity
   └─ EvidenceMatch + RiskFinding persisted on the BidCase
```

**Flow 3 — Expiry monitoring (scheduled workflow, EventBridge/cron):**

```
Cron (daily) ──> ExpiryScanWorkflowRun
   └─ ExpiringEvidenceQuery (30/15/7-day horizons)
        └─ Emit EvidenceExpiring / EvidenceExpired domain events
             └─ Notifications module → email + in-app digest
             └─ Open BidCases referencing expired evidence → re-flag
```

**Flow 4 — Connector enrichment (Phase 2+, ADR 0020):**

```
SPA ──GET /connectors/digilocker/authorize──> 302 to DigiLocker OAuth (PKCE)
DigiLocker ──callback──> ImportFromConnectorUseCase
   └─ Exchange code server-side; store encrypted tokens (external_data_connections)
   └─ Fetch documents → create EvidenceDocument (verification_tier=AUTHORITY_VERIFIED)
   └─ Map to capability entries → DRAFT profile version → human publish
```

### Where the Ten Design Concerns Live

| Concern | Location |
|:--------|:---------|
| 1. Company profile | `company-capability` module — `CompanyProfile` aggregate |
| 2. Capability representation | `CapabilityEntry` + per-subtype JSON Schema in domain |
| 3. Evidence attachment | `AttachEvidenceUseCase` + `capability_evidence` join table |
| 4. Validity/expiry | `ValidityWindow` VO (point-in-time) + scheduled `ExpiryScanWorkflowRun` |
| 5. Source provenance | `SourceRecord` VO on every entry and evidence document |
| 6. Verification status | `VerificationTier` + `verification_status` lifecycle; `VerifyCapabilityUseCase` (REVIEWER) |
| 7. Reusability | Pinned `profileVersionId` on every BidCase; previous-bid feedback loop |
| 8. Versioning | Immutable `company_profiles` rows; partial unique index for one ACTIVE |
| 9. Authorization/isolation | `organization_id` leading column + RLS; `profile:manage`/`profile:verify` permissions |
| 10. Auditability | Domain events → append-only `audit_logs` with `{before, after}` diffs |

### Architectural Rules for This Module

1. **The profile never enters the AI boundary.** Matching reads structured `capability_entries` in the application layer (ADR 0019). The AI service sees extracted criteria only.
2. **No network I/O inside transactions** (existing principle): connector fetches and presigned-URL generation happen before `BEGIN` or after `COMMIT`.
3. **Publish is atomic**: the version insert and the ACTIVE flip commit in one transaction; the partial unique index makes "two ACTIVE versions" impossible at the database level.
4. **Point-in-time validity**: evaluations test validity against the **bid submission date**, so a certificate that expires before submission is correctly flagged as expiring evidence — not as currently-valid.
5. **Documents are proof, not data**: extraction populates structured fields once at ingest; the engine evaluates fields, never PDFs.

---

---

## Tender Ingestion & Requirement Normalization Pipeline (PROMPT 6)

**Principle:** a tender is a **package of typed documents** (17 types: NIT, RFP, technical specs, eligibility, financial, experience, certification, OEM, geographic, staffing, equipment, EMD/PBG, declarations, commercial conditions, BOQ, annexures, corrigenda) — never a single PDF blob. **Do not use an LLM where deterministic parsing is enough.**

### Pipeline Overview

```
┌──────────────┐   presigned    ┌───────────────────────────────────────────┐
│ Frontend     │ ──direct PUT──> │ Object Storage (IStorageService)          │
└──────┬───────┘                 └───────────────────────────────────────────┘
       │ POST /tenders/:id/documents/confirm
       ▼
┌──────────────┐  records TenderDocument (typed)   ┌───────────────────────┐
│ API (NestJS) │ ──enqueue────────────────────────> │ IJobQueue (SQS/PubSub) │
└──────────────┘                                   └──────────┬────────────┘
                                                              │ async (ADR 0018)
                                                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Worker / AI Orchestration Boundary (FastAPI)                             │
│                                                                          │
│ 1. Document processing   format/text-layer detection, page count, dedup  │
│ 2. Extraction            native text (pdf-parse/pdfjs)                   │
│ 3. OCR (only if needed)  text-layer density heuristic → Tesseract/Textract│
│ 4. Section segmentation  TOC + heading + numbering detection             │
│ 5. Chunking              section-aware, page-aligned chunk registry      │
│ 6. Requirement detection TIER 1 regex → TIER 2 structural → TIER 3 LLM   │
│ 7. Normalization         canonical schema, dedup, most-restrictive fusion│
│ 8. Classification        category / kind / criticality                   │
│ 9. Source citation       Provenance VO + deterministic grounding verify  │
│ 10. Persistence          TenderRequirement rows (PROPOSED) + domain events│
└──────────────────────────────────────────────────────────────────────────┘
```

### Where Each Stage Runs (Boundary Discipline)

| Stage | Runtime | Why |
|:------|:--------|:----|
| Upload handshake, confirm, type confirmation | **API** (request/response) | Fast, transactional, presigned URL issuance |
| Stages 1–5, 7–10 | **Worker** (async) | 60–180s workloads; crash recovery; ADR 0018 |
| Tier 3 (LLM) detection | **AI boundary**, invoked by worker only | Zero ambient authority; safety tooling applies |
| Grounding verification | **Worker**, deterministic, pre-persistence | Hard invariant — unverifiable requirements are rejected, never stored |

### The Ten Design Concerns

1. **Ingestion** — presigned direct upload (existing handshake); confirm verifies `headObject` size/MIME; `TenderDocument` record with auto-classified + user-confirmed `documentType`; `WorkflowRun` enqueued after `COMMIT` (no network I/O inside transactions).
2. **Extraction** — native text layer first (pdf-parse/pdfjs); multi-zone page selector for 200+ page packages (existing) bounds work.
3. **OCR where required** — only when text-layer density falls below heuristic threshold; Tesseract (local) or Textract (cloud) behind a port; `ocrQualityScore` recorded; low-quality OCR routes to human review; OCR failure marks the document `OCR_FAILED` (never silently zero-extracted).
4. **Chunking** — section-aware, page-aligned, 1,500–3,000 char target, overlap only at section boundaries; every chunk registered with `(chunkId, documentId, pageRange, sectionPath, charOffset)` — the unit the LLM tier sees and the anchor for verbatim verification.
5. **Metadata** — per-document registry (type, pageCount, hasTextLayer, language, checksum, size, MIME, uploader, per-stage status, OCR quality, section map); per-tender NIT metadata mined deterministically (authority, number, value, deadline, EMD, fee).
6. **Requirement schema** — normalized `TenderRequirement` (see `docs/DOMAIN.md` §27): four traceability anchors (document, page, section, clause), category/kind/criticality, `executionRules`, structured `criteria[]` with `minimumVerificationTier`, `requiredDocuments[]`, `detectionMethod`, status state machine.
7. **Source provenance** — Provenance VO: `{sourceDocumentId, sourceFileName, pageNumber, sectionPath, clauseReference, verbatimQuote, chunkId, extractionMethod, confidenceScore}`. **Grounding invariant:** `verbatimQuote` must be an exact substring of page text — deterministically verified before persistence; failures are rejected and surfaced, never stored.
8. **Amendment handling** — corrigenda ingested as CORRIGENDUM documents → same pipeline → deterministic diff (ADDED/CHANGED/REMOVED; LLM suggests ambiguous cases) → base requirements transition SUPERSEDED (immutable history) → affected BidCases re-enter MATCHING (changed criteria only) → BidDecision flagged for human re-confirmation.
9. **Idempotency** — document-level SHA-256 dedup (`UNIQUE (organization_id, checksum_sha256)`); requirement-level deterministic key `hash(category, normalizedTitle, documentId, clauseReference)` with upsert-by-key; idempotent `WorkflowRun` completion (at-least-once delivery, existing pattern); corrigendum re-apply diffs to an empty change set.
10. **Failure handling** — per-document isolation (one bad PDF fails only itself); `WorkflowRun` state machine + exponential backoff + DLQ; LLM failure degrades to the regex baseline (ADR 0018); grounding failures rejected pre-persistence; honest-extraction invariant (0 items means 0 items — no fabricated mock data).

### Deterministic-First Execution Order

```
Tier 1  REGEX      keyword/pattern detection (existing 16-domain extractor)
Tier 2  STRUCTURAL TOC/heading/numbering/numeric-threshold/column extraction
Tier 3  LLM        only sections tiers 1–2 could not confidently parse
                     → same normalization + dedup + grounding verification as tiers 1–2
                     → detectionMethod recorded per requirement (per-tier quality measurement)
```

The LLM is a **fallback tier with identical output contracts**, not the primary extractor. This preserves the product's core property: deterministic, grounded, reproducible requirements — with semantic depth where it is genuinely needed (scope-of-work normalization, ambiguous phrasing, cross-document near-duplicate clustering, corrigendum diff suggestions).

### Module Mapping (extends §3 module map)

| Logical area | Pipeline responsibility |
|:-------------|:--------------------------|
| `tender` | Tender aggregate, TenderDocument records, amendment supersession |
| `document` | Upload handshake, storage paths, checksum dedup, per-document processing status |
| `requirement-analysis` | Stages 1–10 orchestration, chunk registry, normalization, classification, grounding verification |
| `workflow` | `WorkflowRun` lifecycle, retries, DLQ, per-document isolation |
| `ai-engine` | Tier-3 detection only (behind `StructuredLLMClient` + safety tooling) |
| `human-review` | Document-type confirmation, OCR exceptions, grounding exceptions, corrigendum diff confirmation |

---

## Evaluation & Matching Engine — Detailed Architecture

**The deterministic core of the product** (ADR 0019; algorithms specified in `docs/DOMAIN.md` Part E, §42–48). Answers *"Should I pursue this tender?"* with pure functions — no I/O, no clock reads, no LLM, no tenant data beyond the pinned profile version.

### Module Anatomy (inside `bid-decision`)

```
apps/api/src/modules/bid-decision/
├── domain/
│   ├── engine/
│   │   ├── EligibilityEngine.ts        # criterion evaluators (7 types, registry-based)
│   │   ├── MatchingEngine.ts         # requirement ↔ profile resolution
│   │   ├── VerdictAggregator.ts      # hard-fail logic → GO / CONDITIONAL-GO / NO-GO
│   │   ├── GapComputer.ts            # structured GapItems (acquisition list)
│   │   └── ReadinessRollup.ts        # weighted score + gate
│   ├── value-objects/
│   │   ├── Criterion.ts              # {type, operator, threshold, unit, window, minimumVerificationTier}
│   │   ├── CriterionResult.ts        # {state, actual, expected, delta, evidenceRef, tierSufficient}
│   │   ├── EligibilityVerdict.ts     # ELIGIBLE / CONDITIONALLY_ELIGIBLE / INELIGIBLE
│   │   └── GapItem.ts
│   └── services/
│       └── EvaluateBidCaseService.ts # orchestrates: load pinned profile → run engines → persist
├── application/
│   ├── use-cases/
│   │   ├── EvaluateBidCaseUseCase.ts      # full evaluation (post-extraction, in worker)
│   │   ├── ReevaluateOnCorrigendumUseCase.ts  # delta evaluation (changed keys only)
│   │   └── ConfirmBidDecisionUseCase.ts   # human gate 3 (optimistic concurrency)
│   └── queries/
│       └── GetMatchScorecardQuery.ts
├── infrastructure/
│   └── persistence/                  # Drizzle repositories (bid_cases, evidence_matches, …)
└── presentation/
    └── BidCaseController.ts          # scorecard, decision confirm, readiness sign-off
```

### Execution Contract

```
EvaluateBidCaseService.execute(bidCaseId):
  1. Load TenderRequirements (CONFIRMED) for the tender
  2. Load CompanyProfile @ pinned version (BidCase.profileVersionId)
  3. evaluationDate = tender.submissionDeadline (point-in-time validity)
  4. MatchingEngine.match(requirements, profile, evaluationDate)   // pure
  5. VerdictAggregator.aggregate(matches)                        // pure
  6. GapComputer.compute(matches)                                // pure
  7. Persist EvidenceMatch + RiskFinding + proposed BidDecision (AI_PROPOSED)
  8. Emit MatchCompleted + BidDecisionProposed events
```

Steps 4–6 are **pure functions** — testable without database, HTTP, or framework. Step 7 is the only transactional boundary (one transaction: matches + proposed decision + audit events).

### Criterion-Type Registry (Extensible)

The seven evaluators (THRESHOLD, COUNT, VALIDITY, SET_MEMBERSHIP, RANK, PRESENCE, RATIO) register in a typed registry keyed by `criterion.type`. A new tender pattern that introduces a new criterion shape adds one pure evaluator — no engine changes. Scope matching for COUNT uses declared work-type tags (conservative: non-intersecting tags never count as "similar work").

### Where It Runs

- **Worker, post-extraction** (ADR 0018): evaluation is a WorkflowRun step after requirements are CONFIRMED.
- **Never in the AI boundary**: the engine reads only structured `capability_entries` and `criteria`. Tenant profile data never flows to the LLM (ADR 0019).
- **Re-evaluation**: corrigendum application triggers delta evaluation (changed requirement keys only); a changed HARD_ELIGIBILITY result re-opens the BidDecision to UNDER_REVIEW automatically.

### Testing Strategy

| Test type | Target |
|:----------|:-------|
| Property-based | evaluators total + deterministic (never throw, always return a state) |
| Golden fixtures | CPWD works, GeM services, Railways, State PWD archetypes with hand-verified verdicts |
| Mutation | threshold perturbation (₹4.5 Cr → ₹4.4 Cr) must flip the verdict |
| Integration | full pipeline: fixture tender + fixture profile → expected scorecard, byte-identical across runs |
| Security | cross-tenant profile injection attempts return 404 (Anti-IDOR) |

### Key Architectural Rules

1. **Evaluation date = submission deadline**, not "today" — a certificate expiring before submission is correctly EXPIRED.
2. **Worst-state-wins** per requirement: any MISSING criterion → requirement MISSING; ambiguity never upgrades to MATCHED.
3. **Conservative verdict**: any HARD_ELIGIBILITY requirement not MATCHED → INELIGIBLE/NO-GO. The worst error is a false GO.
4. **Tier gating**: evidence below `criterion.minimumVerificationTier` is tier-insufficient (SHORTFALL), never silently accepted.
5. **Reproducibility**: pinned profile version + parameterized evaluation date → any past verdict is re-computable exactly.

---

## 11. Cloud-Agnostic Infrastructure & GCP Target (PROMPT 19)

### The Core Invariant: Cloud-Provider Agnostic Core

The application code (Domain Entities, Value Objects, Use Cases, Application Services) must remain **100% agnostic** of any specific cloud provider. Provider-specific terms, SDKs, or conventions (`S3Service`, `GcsService`, `SQSService`, `PubSubService`, `AWS_BUCKET`, `GCP_PROJECT`) are strictly banned from domain and application packages.

All infrastructure services are consumed through explicit, capability-oriented interfaces (Ports) defined in the application layer:

| Conceptual Capability | Generic Port (Application Layer) | GCP Adapter (`infrastructure/`) | AWS Adapter (`infrastructure/`) | Local/Dev Adapter |
|:----------------------|:---------------------------------|:--------------------------------|:--------------------------------|:------------------|
| **Object Storage** | `ObjectStorage` | `GcpCloudStorageAdapter` | `AwsS3StorageAdapter` | `LocalStorageAdapter` / `MockStorage` |
| **Asynchronous Queue** | `MessageQueue` | `GcpPubSubQueueAdapter` | `AwsSqsQueueAdapter` | `InMemoryQueueAdapter` |
| **Domain Events** | `EventPublisher` | `GcpPubSubEventsAdapter` | `AwsEventBridgeAdapter` | `InMemoryEventBus` |
| **Transient Cache & Locks**| `Cache` | In-process LRU / `RedisCacheAdapter` | `RedisCacheAdapter` | `InMemoryCacheAdapter` |
| **Document Storage** | `DocumentRepository` | `PostgresDocumentRepository` | `PostgresDocumentRepository` | `PostgresDocumentRepository` (PGlite) |
| **Workflow Execution**| `WorkflowStore` | `PostgresWorkflowStore` | `PostgresWorkflowStore` | `PostgresWorkflowStore` (PGlite) |
| **Generated Packets** | `ArtifactStore` | `PostgresArtifactStore` | `PostgresArtifactStore` | `PostgresArtifactStore` (PGlite) |

### Component Necessity Evaluation

In adherence to the "Zero Unnecessary Technology" rule, every infrastructure component is evaluated for direct business necessity:

1. **Cloud Run over GKE**: Serverless containers provide automatic scale-to-zero when idle and burst scaling during 15:00/18:00 IST submission deadlines, saving $74+/mo in static Kubernetes cluster control-plane and node-pool overhead.
2. **Cloud SQL for PostgreSQL 16 over Spanner**: Single-region (`asia-south1` Mumbai) compliance under DPDP Act 2023. Spanner’s multi-region distributed sharding ($600+/mo) is grossly premature for Indian tender workloads that fit comfortably on a relational instance.
3. **Cloud Storage over Filestore**: Presigned V4 URLs allow direct client upload/download without streaming multi-megabyte PDFs through the Node.js API container memory.
4. **Pub/Sub Pull Subscriptions over Cloud Tasks**: Pull subscriptions allow the Ingestion Worker to pull messages only when it has CPU capacity to process large PDFs, preventing memory exhaustion.
5. **Reject Dedicated Redis for MVP**: An idle Memorystore Redis instance costs $35–50/month. For MVP, in-process LRU caching and PostgreSQL-backed distributed locks fulfill all concurrency and caching needs.

### ADR 0022 — Cloud-Agnostic Infrastructure Model & Initial GCP Deployment

- **Context:** Production deployment requires cloud hosting in India (`asia-south1` Mumbai) for DPDP Act 2023 compliance. The team must avoid cloud vendor lock-in while leveraging managed services.
- **Decision:** 
  1. Standardize all application/domain interfaces around conceptual capabilities (`ObjectStorage`, `MessageQueue`, `EventPublisher`, `Cache`, `DocumentRepository`, `WorkflowStore`, `ArtifactStore`).
  2. Target Google Cloud Platform (GCP) for initial production deployment using Cloud Run, Cloud SQL (PostgreSQL 16), Cloud Storage, Cloud Pub/Sub, Secret Manager, Cloud KMS, and Cloud Load Balancing.
  3. Confine all provider-specific SDKs (`@google-cloud/*`, `@aws-sdk/*`) to `apps/api/src/infrastructure/`.
- **Consequences:** 
  - *Positive:* 100% cloud portability. Switching from GCP to AWS or bare metal requires altering only infrastructure adapters and Terraform manifests, with zero edits to business logic.
  - *Positive:* Zero Kubernetes ops overhead; estimated initial infrastructure cost is kept lean ($170–$240/month).
  - *Trade-off:* Writing adapter wrappers requires strict discipline and CI lint checks to prevent leaking cloud SDK types into use cases.

Detailed GCP specifications, network topology, security boundaries, and disaster recovery runbooks are documented in **`docs/GCP.md`**.

---

*Stop point reached: Infrastructure design and ADRs completed. No deployment authorized, per PROMPT 19.*
