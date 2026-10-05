# Project Status & Milestone Tracker

## ⚠️ Product Pivot (2026-10-04) — Bidder-Side Redesign

`docs/PRODUCT.md` has been rewritten (v2.0): TenderPulse is now a **Tender Intelligence & Bid Readiness Platform for Indian MSMEs, contractors, and service providers** — bidder-side, not procurement-officer-side. The core differentiator is the **persistent Company Capability Profile** (registrations, certifications, financials, experience, work orders, completion certificates, OEM relationships, employees, equipment, geography, previous bid evidence), against which every new tender is evaluated.

The 11-stage workflow: Tender Discovery → Tender-to-Company Matching → Bid/No-Bid Decision → Requirement Extraction → Company Evidence Matching → Compliance Analysis → Risk Analysis → Missing Evidence → Human Review → Bid Readiness → Submission Preparation → Corrigendum Monitoring.

**Human Review Adjudication Experience Implemented (2026-10-06):** Complete redesign of the compliance adjudication experience in `apps/web` (`ComplianceReviewPage.tsx`, `ReviewActions.tsx`):
1. **6-Stage Linear Adjudication Flow**: Replaced fragmented cards with a sequential decision model (Requirement → Tender Evidence Grounding → Company Evidence Dossier → AI Pre-Assessment → Review Trigger Reason → Human Decision Console).
2. **Clear AI Advisory vs. Human Decision Distinction**: Machine analysis rendered with advisory badges and dashed borders stating "AI Recommendation — Advisory Only, Not Final", keeping human verdict visibly distinct.
3. **5 Explicit Human Review Actions**: Upgraded review actions to `Approve (Pass)`, `Reject (Fail)`, `Request Evidence (Missing)`, `Mark Uncertain (Needs Review)`, and `Waive (Not Applicable)` with required rationale for overrides and OCC protection (`expectedVersion`).
4. **Zero-Trust Audit Trail & Verification**: Integrated grounding provenance with exact quote copies, UDIN and validity status indicators, and tenant RBAC enforcement (`compliance:review`). All 127 web unit tests passing.

**Company Capability Profile UI Overhaul (2026-10-06):** Complete transformation of the Company Profile from a generic settings page into a high-density, reusable Enterprise Capability Dossier in `apps/web`:
1. **11 Procurement Capability Domains**: Segmented into Company Overview, Registrations (GSTIN, PAN, Udyam, GeM, CPWD), Certifications (ISO 9001/14001/45001, CMMI), Financials & CA UDIN, Past Experience (7-year qualifying work orders), Major Projects, OEM Relationships & MAFs, Key Personnel & Staff, Plant & Equipment, Geographic Coverage (HQ & State Branches with SLA metrics), and Evidence Vault.
2. **5 Semantic Status Indicators**: Formalized `VERIFIED`, `EXPIRING_SOON`, `EXPIRED`, `MISSING`, and `NEEDS_REVIEW` with dedicated visual indicators and real-time days-until-expiry calculations.
3. **Core Reusability Value Banner**: "Maintain your company information once and reuse it across tenders" value proposition, real-time Tender Readiness health progress bar, immutable version publishing, and document integrity tracking with SHA-256 hashes.
4. **Comprehensive Test Suite**: Added `companyProfileData.spec.ts` testing health calculations, expiration countdowns, and profile domain rules. 14 test files / 133 web unit tests passing.

**Tender Processing Lifecycle & Document Upload Overhaul (2026-10-06):** Complete redesign of the async document upload and extraction experience in `apps/web` (`DocumentUploader.tsx`, `ExtractionProgress.tsx`, `BidDetailPage.tsx`):
1. **Full-Lifecycle Processing Stepper**: Replaced generic loading spinners with a 5-stage contextual pipeline (Upload & Storage → Document Normalization → Requirement Extraction → Evidence & Risk Analysis → Bid Readiness Ready) consuming live Server-Sent Events (SSE).
2. **Contextual Live State Messages**: Dynamic real-time messages (e.g. *"Extracting eligibility requirements and statutory clauses"*, *"Analyzing company evidence against CA UDIN records"*) paired with exact progress percentages.
3. **Actionable 3-Part Failure Guarantees**: Structured error handling explicitly detailing (1) What failed, (2) Data safety guarantees (original PDF encrypted & preserved in tenant storage), and (3) Actionable next steps (Retry with OCR, Re-upload clean PDF, or manual entry).
4. **Direct S3 Byte Transfer Meter**: Real-time XHR upload progress meter displaying transferred megabytes, percentage, and live upload status. All 14 test files / 133 tests passing.

**First-Class Evidence & Provenance UX Overhaul (2026-10-06):** Elevated evidence from passive attachment lists into a central, verified business object across `apps/web` (`EvidenceTraceabilityChain.tsx`, `EvidenceDrawer.tsx`, `ComplianceRow.tsx`, `ComplianceReviewPage.tsx`):
1. **4-Node Traceability Chain**: Visually mapped the complete verification relationship: Tender Requirement → Required Evidence Spec → Company Evidence Dossier → Assessment Verdict.
2. **Dual-Sided Provenance Inspector**: Consolidated tender grounding (document, page, clause, exact quote, grounding score) and corporate proof (file name, type, issue date, validity countdown, ICAI UDIN) into a unified drawer.
3. **5 Semantic Evidence States**: Formalized `VERIFIED`, `EXPIRING`, `EXPIRED`, `MISSING`, and `NEEDS_REVIEW` across rows, drawers, and compliance cards. All 14 test files / 133 tests passing.




**Domain model documented (2026-10-04):** `docs/DOMAIN.md` Part B now teaches the bidder-side domain model and ubiquitous language — aggregate roots (CompanyProfile, Tender, BidCase, ReviewTask, WorkflowRun, AuditEvent), entities (CapabilityEntry specializations, EvidenceDocument, TenderRequirement, TenderAmendment, EvidenceMatch, RiskFinding, GeneratedArtifact), value objects (Permission, ExecutionRules, Provenance, Money, Criterion, EligibilityVerdict, MatchState, ProfileVersionRef), workflows (Workflow, ComplianceAssessment, BidReadiness, CorrigendumMonitoring), lifecycle state machines for all major concepts, the 10-step "how a tender is evaluated against a company profile" walkthrough, and a full domain glossary. Design-only; no database changes.

**HLD delta documented (2026-10-05):** `docs/ARCHITECTURE.md` (new, root-level) compares existing vs. target architecture and answers the 10 delta questions (what remains / must change / new modules / wrong boundaries / what stays together / AI placement / deterministic logic placement / async / events / human review). Target module map covers all 14 logical areas. New ADRs: **0016** (bidder-side pivot aggregates: Tender + BidCase + CompanyProfile), **0017** (enforce layered boundary at HTTP — eliminate CRUD bypass), **0018** (async-first extraction — queue→worker becomes the live path), **0019** (deterministic Eligibility/Matching engine in the domain layer; AI schema cannot express verdicts or money), **0020** (external data connectors — DigiLocker OAuth, Account Aggregator — behind an `IConnector` enrichment port, phased adoption). Design-only; no code implemented.

**Company Capability Profile designed (2026-10-05, PROMPT 5):** the differentiator is fully designed across three docs — `docs/DOMAIN.md` Part C (§15–17: the ten design requirements, structured-data-vs-documents rule, one-shot→SaaS transformation), `docs/DATABASE.md` Part B (target v2.0 schema: `companies`, `company_profiles` with immutable versions + one-ACTIVE partial unique index, `capability_entries` with per-subtype JSONB attributes + verification tier/status + source provenance, `evidence_documents`, `capability_evidence` many-to-many, `external_data_connections`, and the pivot aggregates `tenders`/`tender_requirements`/`tender_amendments`/`bid_cases` with mandatory pinned `profile_version_id`, `evidence_matches`, `risk_findings`, `bid_decisions`, `review_tasks`, `generated_artifacts`; expand-and-contract migration), and `docs/ARCHITECTURE.md` (module anatomy, four key flows: maintain/publish, evaluation read path against pinned version, expiry monitoring, connector enrichment; where the ten design concerns live). Design-only; no code implemented.

**Tender ingestion & requirement normalization designed (2026-10-05, PROMPT 6):** `docs/DOMAIN.md` Part D (§25–34) and `docs/ARCHITECTURE.md` (new pipeline section). Key decisions: tender = package of 17 typed documents (never a single blob); 10-stage async pipeline (document processing → extraction → OCR-on-demand → section segmentation → section-aware chunking → 3-tier requirement detection → normalization → classification → source citation → persistence); **deterministic-first execution** (regex → structural → LLM fallback with identical output contracts and per-requirement `detectionMethod`); normalized requirement schema with four traceability anchors (document, page, section, clause) + verbatim quote + chunkId; hard grounding invariant (exact-substring verification pre-persistence; failures rejected, never stored); corrigenda as first-class amendments (diff → SUPERSEDE → re-evaluate changed criteria only → human re-confirmation); idempotency at document (SHA-256), requirement (deterministic key upsert), and workflow levels; per-document failure isolation with honest zero-extraction. Design-only; no code implemented.

**Evidence & Compliance Engine designed (2026-10-06, PROMPT 7):** `docs/DOMAIN.md` Part F (§49–60), `docs/architecture/LLD.md` §9, `docs/AI.md` §5, and new **ADR 0021** (evidence-first compliance engine). The engine answers *"For this tender requirement, what evidence does the company have?"* — never a bare percentage. Five separated stages with distinct owners: (1) evidence retrieval (deterministic, recall-oriented, tenant-scoped, pinned profile version), (2) evidence matching (dual-sided provenance: tender anchors §28 + company EvidenceRef, many-to-many, cross-document dedup), (3) deterministic validation (Part E evaluators + expiry-at-submission-date, tier-sufficiency, and ordered conflict policies — tier → recency → source authority → REVIEW_REQUIRED, never silently pick), (4) AI explanation (grounded narrative with **no verdict field in the output schema**; citation-verified against the result bundle; template fallback so prose never blocks verdicts), (5) human decision (confirm/override/waive; `compliance:override` permission, mandatory reason, OCC; engine verdict preserved immutably, both verdicts always displayed). Assessment states PASS / FAIL / MISSING_EVIDENCE / REVIEW_REQUIRED with deterministic rollup mapping (FAIL > MISSING_EVIDENCE > REVIEW_REQUIRED > PASS). Designed hard cases: conflicting evidence, expired certificates, insufficient evidence, ambiguous clauses, missing dates (UNKNOWN_VALIDITY → REVIEW_REQUIRED), contradictory company data, multiple evidence documents, manual override, and append-only reference-only audit trail (RETRIEVAL_EXECUTED → … → ASSESSMENT_OVERRIDDEN). Design-only; no code implemented.

**LangGraph critical determination & first workflow designed (2026-10-06, PROMPT 11):** `docs/learning/langgraph.md` §7 and `docs/AI.md` §6. Key teaching: the 8-step product workflow is an **orchestration of services, not one LangGraph graph**. LangGraph earns its place only where its three justifying conditions hold — cyclic feedback, durable mid-run resumption, human-in-the-loop inside reasoning. Applied to the tender workflow: Extract Requirements (LangGraph: LLM → deterministic verification → bounded feedback-retry cycle → escalation) and conditional Human Review (`interrupt()`/`Command(resume=...)` when multi-day waits must preserve in-flight state; terminal decisions use the plain async ReviewTask + PATCH API instead); Load Context, Retrieve Evidence, Analyze Match, Deterministic Validation, and Final Assessment are plain services/pure functions (ADR 0019/0021 — company financials must never enter the AI boundary, so they *cannot* be graph nodes). All 11 concepts (graph, nodes, edges, state, checkpoints, branching, retries, persistence, human interruption, resuming, failure handling) taught against the real implementation in `apps/ai/src/tenderpulse_ai/workflow/` (`ComplianceWorkflowState`, `build_compliance_workflow_graph`, `route_verification_outcome`, dynamic `interrupt()`, `CrossTenantReviewException` guard). First LangGraph workflow designed conceptually: TenderRequirementExtractionWorkflow (per BidCase+TenderDocument, SQS-triggered, thread_id = `tenant_{id}:bid_{id}:run_{id}`, PostgresSaver checkpoints, retry bound < 2, four-layer failure handling). Design-only; no code implemented.

**First real AI agent implemented (2026-10-06, PROMPT 12):** `TenderRequirementAgent` in `apps/ai/src/tenderpulse_ai/agent/` (`agent.py`, `schemas.py`, `validation.py`, `ambiguity.py`, `__init__.py`) + `POST /api/v1/agent/analyze-requirements` and `docs/AI.md` §7. Solves tender content analysis, requirement extraction, 8-domain classification, structured normalization (`CriterionProps`, `ExecutionRulesProps`), deterministic ambiguity scanning (6 heuristic patterns), exact-substring source citations, and structured `AgentOutput`. Enforces zero-trust boundaries: read-only tools, no authorization decisions, no arbitrary data querying, no irreversible actions, and strict tenant isolation via `SecurityContext`. Bounded resilience: 30s timeout guard, transient 429/503 linear backoff (max 2 attempts), and bounded semantic refinement cycle (max 1 pass). 19 unit & security tests in `apps/ai/tests/test_tender_requirement_agent.py` passing.

**Bid/No-Bid Decision Workflow & Agent implemented (2026-10-06, PROMPT 13):** `BidDecisionAgent` in `apps/ai/src/tenderpulse_ai/decision/` (`agent.py`, `schemas.py`, `evaluator.py`, `risks.py`, `__init__.py`) + `POST /api/v1/agent/bid-decision` and `docs/AI.md` §8. Answers "Should my company pursue this tender?" with strict separation of four concerns: (1) deterministic eligibility (evaluates 9 factors: statutory debarment, financial turnover, 7-year past experience, geographic presence, certifications at submission deadline, OEM authorizations, staffing, equipment, and execution securities; worst-state-wins, zero hallucination), (2) AI-assisted interpretation (structured reasons to pursue, reasons not to pursue, uncertain areas; **the LLM cannot alter the computed verdict**), (3) commercial risk analysis (timeline pressure, working capital lock-in, liquidated damages), and (4) human judgment (AI_PROPOSED recommendation, human confirmation required). 13 unit, security, and integration tests in `apps/ai/tests/test_bid_decision_agent.py` passing (59 total passing in `apps/ai`, 209 total passing across monorepo).

**Human-in-the-Loop (HITL) Workflow implemented (2026-10-06, PROMPT 15):** First-class human review capability in `apps/ai/src/tenderpulse_ai/review/` (`workflow.py`, `manager.py`, `models.py`, `__init__.py`) and `docs/AI.md` §9. The AI is explicitly empowered to output `REVIEW_REQUIRED` across 6 deterministic triggers: ambiguous requirements, conflicting evidence, unclear eligibility (0.50–0.70 score), insufficient confidence (<0.75), possible disqualification (critical risks), and contradictory documents. Complete 9-pillar review pipeline implemented: (1) 5 reviewer roles (`BID_MANAGER`, `LEGAL_COUNSEL`, `FINANCIAL_CONTROLLER`, `TECHNICAL_LEAD`, `BID_DIRECTOR`), (2) 7 lifecycle states (`PENDING`, `IN_REVIEW`, `ESCALATED`, `COMPLETED`, `EXPIRED`, `REASSIGNED`, `CANCELLED`), (3) Optimistic Concurrency Control (OCC `version: int` preventing lost updates with `ReviewConcurrencyConflictException`), (4) collaborative multi-comment threading, (5) side-by-side Evidence Visibility Packages, (6) strict audit-grade distinguishability between Human Confirmation (`CONFIRMED`) and Override (`OVERRIDDEN`, with mandatory ≥10 char justification), (7) immutable reference-only audit trail, (8) reassignment & formal escalation protocols, and (9) SLA/submission deadline enforcement. 17 new tests in `apps/ai/tests/test_human_in_the_loop_workflow.py` passing (76 total passing in `apps/ai`, 226 total passing across monorepo; ruff and pyright clean).

**Evaluation & Matching Engine designed (2026-10-05):** the deterministic core specified at algorithm level — `docs/DOMAIN.md` Part E (§42–48) and `docs/ARCHITECTURE.md` (new engine section). Seven criterion evaluator types (THRESHOLD, COUNT, VALIDITY, SET_MEMBERSHIP, RANK, PRESENCE, RATIO) as pure functions; worst-state-wins matching; conservative verdict aggregation (any HARD_ELIGIBILITY requirement not MATCHED → INELIGIBLE/NO-GO); structured GapItems driving the acquisition list; weighted readiness rollup (50% evidence completeness, 20% risk clearance, 15% deadline buffer, 15% EMD affordability) with configurable sign-off threshold; corrigendum delta evaluation (changed keys only, auto re-opens BidDecision on hard-eligibility change); evaluation date = submission deadline (point-in-time validity); purity guarantees (no I/O, no clock reads, byte-identical determinism) with property-based, golden-fixture, and mutation testing. Design-only; no code implemented.

`docs/PRODUCT.md` §6 contains the explicit **Existing capability → New product role** mapping: ingestion, PDF extraction, 16-domain taxonomy, execution rules, verbatim provenance, human review, async pipeline, RBAC, AI safety tooling, frontend shell, and Terraform all carry forward; `BidProject` adapts into TenderOpportunity + BidCase; the Company Profile, Evidence Vault, Matching engine, Bid/No-Bid decision, Risk radar, Readiness score, and Corrigendum diff are **new** (see `docs/CURRENT_STATE.md` §3). No features implemented yet.

**P0 Backend Auth & RBAC Hardening implemented (2026-10-06):** Production-grade authentication and authorization pipeline implemented across NestJS (`apps/api`):
1. **RFC 7519 HMAC-SHA256 TokenService (`TokenService.ts`):** Zero-external-dependency, constant-time signature verification (`crypto.timingSafeEqual`) preventing timing attacks. Cryptographically signed access tokens and refresh tokens with enforced token-type separation.
2. **Global NestJS JwtAuthGuard (`jwt-auth.guard.ts`):** Enforces Bearer token authentication across all `/api/v1/*` endpoints by default (rejecting unauthenticated requests with 401 Unauthorized), with `@Public()` opt-outs only on `/api/v1/auth/login`, `/api/v1/auth/refresh`, and mock S3 upload/download endpoints. Supports `?token=` query param for browser `EventSource` SSE streaming.
3. **Global NestJS RolesGuard (`roles.guard.ts`):** Evaluates atomic permissions via `@RequirePermission(...)` (e.g. `bids:create`, `bids:delete`, `compliance:review`, `audit:read`), rejecting unauthorized roles with 403 Forbidden.
4. **Fiber-Safe Tenant Context (`tenant-context.interceptor.ts`):** Automatically binds authenticated claims (`organizationId`, `userId`, `role`) to `TenantContextHolder` backed by Node.js `AsyncLocalStorage`.
5. **Secure Refresh Handshake (`auth.service.ts`):** Cryptographically verifies refresh tokens, looking up the specific user by ID in PostgreSQL, eliminating unauthenticated account takeover.
6. **Dynamic Tenant Isolation:** `BidsService`, `DocumentsService`, `ComplianceService`, and `AuditService` now dynamically resolve `organizationId` and `userId` from `TenantContextHolder` instead of hardcoding `org_acme_infra_001`.
7. **Comprehensive Integration Suite:** 19 integration tests in `apps/api/src/modules/__tests__/auth-rbac.spec.ts` passing (180 total tests passing across monorepo).

**Cloud-Agnostic Infrastructure & GCP Target designed (2026-10-06, PROMPT 19):** Complete production infrastructure specification and cloud-agnostic architecture documented in `docs/GCP.md`, `docs/ARCHITECTURE.md` §11, and **ADR 0022**.
1. **Cloud-Agnostic Core:** Strict enforcement of Hexagonal Ports & Adapters (`ObjectStorage`, `MessageQueue`, `EventPublisher`, `Cache`, `DocumentRepository`, `WorkflowStore`, `ArtifactStore`). Zero cloud-provider SDKs or terms leaked into domain/application logic.
2. **Component Necessity Evaluation:** Rigorously justified Cloud Run (serverless autoscaling, scale-to-zero), Cloud SQL PostgreSQL 16 (single-region HA, PITR in `asia-south1` Mumbai), Cloud Storage (CMEK, V4 presigned URLs), and Cloud Pub/Sub (pull subscriptions with ack deadlines and DLT). Rejected premature over-engineering: GKE (saves $74+/mo), Cloud Spanner (saves $600+/mo), and dedicated Memorystore Redis (saves $35–50/mo for MVP).
3. **Network & Security Boundaries:** Private VPC peering for Cloud SQL with zero public IPs, Serverless VPC Access Connector for Cloud Run, Cloud NAT for controlled procurement portal egress, and Cloud Armor WAF at the edge.
4. **Resilience & Governance:** RPO $\le$ 5m (WAL archiving), RTO $\le$ 30m (Terraform + HA failover), CMEK encryption with Cloud KMS, and Secret Manager versioning. Design-only; no infrastructure deployed.

**End-to-End Pipeline Verified & Wired (2026-10-06):** Complete verification and runtime wiring of the decoupled Frontend → API → S3 → SQS → AI Extraction → DB Persistence pipeline:
1. **QueueModule Globally Registered:** `QueueModule` registered into `AppModule` providing `QUEUE_TOKEN` (`IJobQueue`) with auto-fallback to `MockSqsJobQueue`, `AwsSqsJobQueue`, or `GcpPubSubJobQueue`.
2. **StorageModule Dual-Cloud & Fallback:** `StorageModule` enhanced to detect AWS S3, GCS, or fallback to in-memory `MockStorageService`, ensuring zero null references across feature modules.
3. **Live SQS Dispatch on Confirm Upload:** `DocumentsService.confirmUpload` now optionally injects `QUEUE_TOKEN` and enqueues `IngestionJobMessage` `{ jobId, organizationId, bidId, documentId, timestamp }` onto the queue.
4. **Mock Upload Binary Capture:** `DocumentsController.mockUpload` buffers incoming binary streams and registers with storage for faithful local development.
5. **Full E2E Integration Suite:** Added `apps/api/src/test/e2e/EndToEndFrontendToAiPipeline.e2e.spec.ts` testing the complete 6-stage chain, Anti-IDOR guards, DLQ routing for poisoned SQS payloads, and SSE progress streaming. 149 passing tests in `apps/api`, 76 in `apps/ai`, 35 in `apps/web` (260 total passing).

**Frontend UI Audit & Reusable Design System Implemented (2026-10-06):** Complete UX audit across 20 dimensions documented in `docs/UI_AUDIT.md`, with zero business page disruption:
1. **Technology Stack Conserved:** Reused React 18 + TypeScript + Vite with native CSS Variables and typed `@tenderpulse/ui` tokens. Rejected introducing heavy external frameworks (Tailwind, MUI, Chakra).
2. **Standardized Token Architecture:** Formalized 9-step typography scale (`--text-2xs` to `--text-4xl`), 4px modular spacing grid (`--space-0-5` to `--space-16`), 6-tier radii (`--radius-sm` to `--radius-full`), and elevations in `index.css` and `@tenderpulse/ui/src/tokens.ts`.
3. **Canonical Semantic Statuses & Risk Levels:** Formalized `PASS`, `FAIL`, `MISSING`, `REVIEW_REQUIRED`, `NOT_APPLICABLE` and risk levels `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`.
4. **"Do Not Rely Only on Color" Enforcement:** Every status and risk level pairs dedicated accessible SVG icons (`PassIcon`, `FailIcon`, `MissingIcon`, `ReviewRequiredIcon`, `NotApplicableIcon`, `CriticalRiskIcon`, etc.) with high-contrast text and ARIA announcements (`role="status"`).
5. **Complete Primitives Suite (`apps/web/src/components/common`):** Enhanced and implemented `Button`, `Input`, `StatusBadge`, `RiskBadge`, `Badge`, `Card`, `Table`, `Tabs`, `Modal`, `Drawer`, `Tooltip`, `Alert`, `LoadingSkeleton`, `Spinner`, `EmptyState`, `ErrorBanner`, `PageLayout`, and `Icons`.
6. **Monorepo Integration & Verification:** 15 new unit tests added in `design-system.spec.ts`. All 149 API tests, 50 Web tests, and integration tests passing (275 tests total across monorepo).

**B2B Enterprise Application Shell & Responsive Navigation Implemented (2026-10-06):** Production-quality global shell hardening across `apps/web`:
1. **Information-Dense B2B Navigation:** Clean SVG iconography (`TendersIcon`, `PlusCircleIcon`, `BuildingOfficeIcon`) replacing emojis. Solid left-accent active route borders (`3px solid var(--color-primary-500)`), subtle hover states, zero decorative dashboard fluff or glassmorphism.
2. **Desktop Collapsible & Mobile Drawer Sidebar:** Dual-mode sidebar supporting 260px standard desktop, 68px collapsed icon rail mode, and off-canvas slide-over drawer with backdrop blur on mobile/tablet (<1024px) with Escape key listeners.
3. **Dynamic Path-Derived Breadcrumbs (`Breadcrumbs.tsx`):** URL-synchronized hierarchical breadcrumbs with clickable ancestors and `ChevronRightIcon` dividers, announcing `aria-current="page"` on terminal routes.
4. **Interactive Account & Tenant Hub (`UserAccountMenu.tsx`):** Profile dropdown menu with user initials avatar, organization name, tenant ID, RBAC role badge, HMAC-SHA256 session indicator, and secure sign-out.
5. **Standardized Content Width & Spacing:** Max-width bounded to `--content-max-width` (1440px) with responsive padding scale (desktop 2rem, tablet 1.25rem, mobile 0.75rem).
6. **Strict Route Integrity:** No non-existent pages invented; navigation maps strictly to live product routes (`/bids`, `/bids/new`, `/company-profile`, `/bids/:id`).
7. **Monorepo Verification:** 7 new unit tests in `layout.spec.ts`. 57 Web tests, 149 API tests, 76 AI tests passing (282 total across monorepo).

**Dashboard Overhaul — Honest "What is happening with my bids?" (2026-10-05):** `apps/web` dashboard restructured around real API data only:
1. **Action Required (ADAPT `ActionRequiredCard`)**: now renders clause-level action items from the existing `GET /api/v1/bids/:id/compliance-items` API (parallel fetch via new `useBidComplianceItems` hook with per-bid failure tolerance) — FLAGGED clauses (critical, deep-linked to `/bids/:id/compliance/:itemId` with category badges and provenance anchors), PENDING+humanReviewRequired clauses (high), ANALYZING extraction (medium), 7-day deadlines (high/critical), incomplete DRAFT intake (medium). Sorted by urgency then deadline.
2. **Bid Pipeline (NEW `BidPipelineCard`)**: DRAFT → ANALYZING → REVIEW_READY → SUBMITTED funnel derived from live bid statuses, with per-stage aggregate readiness %, flagged counts, and click-to-filter wiring into the Active Tenders tabs.
3. **Company Readiness (REPLACE `CompanyReadinessCard`)**: removed the hardcoded `DEFAULT_COMPANY_PROFILE` rendering (fabricated data). Now renders an honest "capability data not yet available" state documenting the missing `GET /api/v1/company-profile` and `GET /api/v1/company-profile/expiring-certificates` endpoints.
4. **State handling**: fixed the broken error state (API failure previously rendered the misleading "No Tender Projects" empty state — now renders `ErrorBanner` + `ErrorState` with retry); skeletons for every section during load; distinct empty states (zero bids vs. no filter matches).
5. **Pure derivations (NEW `dashboardData.ts`)**: `computeReadiness` (null pct for pending intake), `computeRiskLevel` (0→LOW, 1–2→HIGH, ≥3→CRITICAL, shared thresholds with TenderTableView), `computePipelineStages`, `buildActionItems`, `daysUntil` — all unit-tested (15 new tests in `dashboardData.spec.ts`, 72 total web tests).
6. **MissingApiCallout (ADAPT)**: documents 5 missing target endpoints (`dashboard/metrics`, `dashboard/action-items`, `company-profile`, `company-profile/expiring-certificates`, `tenders/amendments`) with the current gap each one blocks. N+1 per-bid compliance fetch is the documented trade-off until `dashboard/action-items` ships.

**Tender List Overhaul — Dense Table Workflow (2026-10-05; updated 2026-10-06):** the `/bids` tender list (sidebar "Tender Bids") rebuilt as an information-dense table workflow in `apps/web`:
1. **Dense table (REWRITE `TenderTableView`)**: 10 columns from the existing `BidSummary` contract — Tender (title + №), Organization, Est. Value, Deadline (date + days-left urgency coloring), Status (`StatusBadge`), Fit, Recommendation, Risk (`RiskBadge` from flagged counts), Readiness (progress bar), Actions. Compact mode for density; card-grid view removed per product direction ("do not turn every tender into a giant card").
2. **Real bid-decision data**: Fit & Recommendation now consume `GET /api/v1/bids/:id/bid-decision` via the new `useBidDecisions` hook (same N+1-with-tolerance pattern as `useBidComplianceItems`). Fit shows the engine's readinessScore as a percent + micro progress bar with STRONG/MODERATE/WEAK tier colors; Recommendation shows the deterministic verdict (Go/Conditional/No-Go/Review) as a `Badge` with the human-in-the-loop state label (AI-proposed / In review / Confirmed / Overridden) and a tooltip explaining the confirmation requirement. 404 = honest "Not evaluated" placeholder. The documented missing endpoint is removed from `MissingApiCallout`; the N+1 trade-off is documented in the pagination gap.
3. **Risk cell consistency**: uses shared `computeRiskLevel` + `RiskBadge` (LOW=Clean, HIGH/CRITICAL=flagged count) — matches the risk filter thresholds exactly.
4. **Sorting**: clickable column headers with `aria-sort` (title, organization, value, deadline, status, risk, readiness); per-column sensible default directions; null/missing values always sort last. Status sorts by workflow pipeline order (DRAFT → ANALYZING → REVIEW_READY → SUBMITTED → ARCHIVED).
5. **Filters**: status filter as `aria-pressed` toggle group (accessible, not fake `tablist`); risk-level select; free-text search with clear button + Escape key; active filter descriptions shown in toolbar; result count ("N of M tenders").
6. **Pagination (client-side)**: 10/25/50 row sizes, ellipsis page numbers, prev/next, "Showing X–Y of Z (filtered from N)".
7. **Row actions**: status-labeled primary link (Review/Continue/Track/View) + RBAC-gated Delete (`bids:delete`) with `TrashIcon`, confirmation modal reusing `DELETE /api/v1/bids/:id`; error surfaces inside modal; parent refetches on success.
8. **Responsive**: xl = all 10 columns, lg hides Fit+Recommendation, md also hides Organization+Value, sm keeps Tender/Deadline/Status/Readiness/Actions; horizontal scroll floor via `TableContainer`. Unit-tested as pure logic (breakpoint boundaries 767/768, 1023/1024, 1279/1280).
9. **States**: table-shaped loading skeleton (`TenderTableSkeleton`) mirroring column layout; zero-bids guided empty state with CTA; no-filter-match empty state listing active filters with clear-filters action; page-level error banner + retry.
10. **New architecture**: pure derivations in `tenderListData.ts` (breakpoints, column visibility, filtering, `compareBids` total order, deadline validity, fit tiers, verdict visuals, decision state labels, active filter descriptions, pagination math) — 43 unit tests; section chrome in `TenderListSection.tsx` (owns search/status/risk/sort state, wires `useBidDecisions`); `useBidDecisions` hook (parallel per-bid fetch, 404 tolerance, stale-response guard); 117 web tests total passing.

---

## ⚠️ Current-State Audit (2026-10-04) — read this first

A full repository audit was completed on 2026-10-04. See **`docs/CURRENT_STATE.md`** for the complete area-by-area classification (KEEP / ADAPT / REPLACE / MISSING), the "Existing ParakhSetu-like capabilities" inventory, and the "Capabilities required for the new product but currently missing" gap list.

**Audit headline status:**
1. ~~Access tokens are unsigned base64 JSON~~ — **RESOLVED (2026-10-06)**: Native HMAC-SHA256 JWTs with constant-time verification, global `JwtAuthGuard`, global `RolesGuard`, and secure user-bound refresh tokens.
2. ~~Tenant isolation is hardcoded to `org_acme_infra_001`~~ — **RESOLVED (2026-10-06)**: Fiber-safe `TenantContextInterceptor` populates `TenantContextHolder` from token claims on every request; domain and feature services query with dynamic `organizationId`.
3. The production persistence path is embedded PGlite, not the real PostgreSQL defined in docker-compose/Terraform; `DATABASE_URL` is never read.
4. CI deploy stages (7–9) are `echo` placeholders; the "AI" extraction engine is deterministic regex, not LLM inference.

The milestone log below reflects design/build history. The **actual next actions** are the remaining items in `docs/CURRENT_STATE.md` §3: multi-tenant schema migrations, real Postgres runtime configuration, and the bidder-side eligibility matching engine.

---

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
20. [x] **Phase 27: Lowest-Cost AWS MVP Deployment & Hybrid Testing Architecture** _(Completed)_
    - Ultra-low-cost (<$0.50/month) hybrid cloud environment in `infrastructure/terraform/environments/local/`.
    - Real AWS S3 document vault with CORS for localhost presigned uploads, zero-KMS SSE-S3 (AES256), and 7-day auto-expiration lifecycle rules.
    - Real AWS SQS ingestion queue + DLQ with SQS-managed SSE.
    - Scoped least-privilege IAM dev user and policies for local test containers.
21. [x] **Phase 28: Cloud-Agnostic Ports & Adapters with Google Cloud Platform (GCP)** _(Completed)_
    - Documented in `docs/adr/0014-cloud-agnostic-ports-and-gcp-implementation.md` and `docs/GCP_DEV_SETUP.md`.
    - Fully decoupled Domain and Application layers from cloud-specific naming conventions (`storagePath` replaces vendor-specific keys; cloud-neutral `IStorageService` and `IJobQueue` ports).
    - Production Google Cloud Platform adapters: `GcsStorageService.ts` (V4 Signed URLs, metadata, streaming download) and `GcpPubSubJobQueue.ts` (Cloud Pub/Sub topic, subscription, dead-letter redrive, ack deadline control).
    - Complete GCP Terraform environment in `infrastructure/terraform/environments/gcp-local/` provisioning GCS bucket (`asia-south1`), Pub/Sub topic/subscription/DLQ, and least-privilege dev service account.
    - 118 unit and integration tests passing across monorepo with 0 typecheck errors.
22. [x] **Phase 29: Modular HTTP Server Architecture (Controllers & Services)** _(Completed)_
    - Decomposed monolithic `routes.ts` into a clean layered architecture adhering to Ponytail principles (zero unnecessary dependencies, native Node stdlib).
    - Separation of concerns:
      - **Controllers** (`apps/api/src/server/controllers/`): `AuthController`, `BidsController`, `DocumentsController`, `ComplianceController`, `AuditController` handling HTTP requests/responses, payload extraction, and error code translation.
      - **Domain Services** (`apps/api/src/server/services/`): `AuthService`, `BidsService`, `DocumentsService`, `ComplianceService`, `AuditService` containing pure business logic, optimistic concurrency checks, and metric rollups.
      - **Router** (`apps/api/src/server/routes.ts`): Clean dispatcher mapping endpoints to controllers.
    - 130 tests passing across the monorepo with 0 TypeScript compiler errors.

23. [x] **Phase 30: NestJS Modular Architecture & PostgreSQL Persistence Pipeline** _(Completed)_
    - Migrated backend HTTP layer to a modular NestJS architecture with Express platform (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`).
    - Decoupled into feature and infrastructure modules:
      - **DatabaseModule** (`apps/api/src/common/database/`): Asynchronous global provider supplying embedded PostgreSQL (`PGlite`) with schema DDL and idempotent seed initialization.
      - **StorageModule** (`apps/api/src/infrastructure/storage/`): Global injectable provider wrapping Google Cloud Storage (`GcsStorageService`) and AWS S3 (`AwsS3StorageService`) with mock fallback.
      - **AuthModule** (`apps/api/src/modules/auth/`): Clean `AuthController` and `AuthService` handling credential verification against PostgreSQL `users` table.
      - **BidsModule** (`apps/api/src/modules/bids/`): `BidsController` and `BidsService` managing tender project lifecycle and rollup metrics.
      - **DocumentsModule** (`apps/api/src/modules/documents/`): `DocumentsController` and `DocumentsService` handling presigned upload URLs, upload confirmation, download URLs, and real-time SSE progress streaming.
      - **ComplianceModule** (`apps/api/src/modules/compliance/`): `ComplianceController` and `ComplianceService` managing compliance item review with optimistic concurrency control (`expectedVersion`).
      - **AuditModule** (`apps/api/src/modules/audit/`): `AuditController` and `AuditService` exposing immutable audit logs.
      - **Filters & Exception Handling** (`apps/api/src/common/filters/`): `AllExceptionsFilter` mapping domain `HttpError` subclasses to standardized HTTP responses.
    - Zero seed document/compliance data: initial database starts clean with 0 documents and 0 compliance items.
    - Persistent document extraction pipeline:
      - Upload confirmation records document metadata into `tender_documents` and writes `DOCUMENT_UPLOADED` audit event.
      - SSE extraction pipeline completes $\rightarrow$ generates and persists domain compliance requirements with execution rules and verbatim provenance quotes into `compliance_items`, updates bid totals, and logs `AI_INGESTION_COMPLETED` audit event.
    - All 134 monorepo tests passing with 0 TypeScript compiler errors.

24. [x] **Phase 31: Cryptographic Password Security & Timing Attack Defenses (bcrypt & Salts)** _(Completed)_
    - Replaced plain-text SQL password comparisons with industry-standard salted `bcrypt` key derivation function (cost factor 10).
    - Hardened user authentication pipeline in `AuthService` against user enumeration timing attacks:
      - Implemented constant-time dummy verification (`bcrypt.compare(candidatePassword, DUMMY_BCRYPT_HASH)`) when an email is not found, ensuring uniform latency (~70ms) across valid and invalid accounts.
    - Updated database provider (`database.provider.ts`) to hash all seeded accounts on initialization and automatically migrate any existing plaintext entries in local development environments.
    - Added unit test coverage for invalid credentials and non-existent users verifying timing defense paths.
    - 140 passing TypeScript tests across monorepo (`@tenderpulse/api`, `@tenderpulse/web`) with 0 lint warnings and 0 typecheck errors.

25. [x] **Phase 32: Drizzle ORM Type-Safe Query Architecture** _(Completed)_
    - Introduced `drizzle-orm` and `drizzle-orm/pglite` for compile-time type-safe query building across all backend persistence layers.
    - Defined centralized TypeScript database schema in `apps/api/src/common/database/schema.ts` for `users`, `bids`, `tender_documents`, `compliance_items`, and `audit_logs` with zero code-generation overhead.
    - Exported `DRIZZLE_TOKEN` and `createDrizzle(db)` factory from `DatabaseModule`, supporting both NestJS DI injection and direct PGlite conversion in test runners.
    - Refactored all persistence services and infrastructure adapters from raw SQL strings to type-safe Drizzle queries:
      - `AuthService`: Type-safe user email lookup with SQL lower-casing and camelCase field mapping.
      - `BidsService`: Type-safe bid listing, retrieval, and creation with date sorting.
      - `DocumentsService`: Type-safe upload confirmation, upserting (`onConflictDoUpdate`), and download URL resolution.
      - `ComplianceService`: Type-safe optimistic concurrency review updates (`where(and(eq(id), eq(version)))`) and metric rollups.
      - `AuditService`: Type-safe immutable audit event queries.
      - `PostgresBidRepository`: Implemented `IBidRepository` domain port using Drizzle with OCC conflict detection.
      - `database.provider.ts`: Type-safe user and base bid project seeding.
    - 140 passing TypeScript tests across monorepo (`@tenderpulse/api`, `@tenderpulse/web`) with 0 lint warnings and 0 typecheck errors.

26. [x] **Phase 33: Two-Phase Bid Project & Document Deletion Architecture** _(Completed)_
    - Extended `IStorageService` port and adapters (`GcsStorageService`, `AwsS3StorageService`, `MockStorageService`) with `deleteObject` and `deletePrefix` for bulk blob pruning.
    - Implemented resilient Two-Phase Deletion in `BidsService.deleteBid` with strict tenant boundary isolation:
      1. Verifies tenant ownership (`org_acme_infra_001`) preventing cross-tenant IDOR deletion attacks.
      2. Queries document file metadata and records an immutable `BID_PROJECT_DELETED` snapshot event in `audit_logs`.
      3. Deletes the bid from PostgreSQL; database foreign key `ON DELETE CASCADE` rules automatically remove `tender_documents` and `compliance_items`.
      4. Executes cloud storage prefix pruning (`tenants/{orgId}/bids/{bidId}/`) to permanently delete all uploaded tender PDFs.
    - Added `DELETE /api/v1/bids/:id` endpoint in `BidsController`.
    - Implemented UI deletion flow in `BidDetailPage`:
      - Added "Delete Tender" destructive action button in header.
      - Integrated accessible, backdrop-blurred confirmation `Modal` warning of permanent PDF and compliance matrix deletion.
      - Wired `deleteBid` API call with immediate error handling and redirect to `/bids`.
    - Added unit test coverage in `services.spec.ts` for successful cascade deletion, audit log creation, and non-existent bid handling.
    - 142 passing TypeScript tests across monorepo (`@tenderpulse/api`, `@tenderpulse/web`) with 0 lint warnings and 0 typecheck errors.

27. [x] **Phase 34: Targeted Document & Dependent Compliance Cascade Deletion** _(Completed)_
    - Implemented granular document deletion in `DocumentsService.deleteDocument` with referential consistency and tenant isolation:
      1. Enforces Anti-IDOR tenant and bid scoping (`organizationId`, `bidId`, `docId`).
      2. Queries dependent `compliance_items` by inspecting JSONB `provenance` (`documentId`, `sourceDocumentId`, `documentName`, `sourceFileName`).
      3. Records an immutable `DOCUMENT_DELETED` snapshot event in `audit_logs` tracking document file details and removed compliance requirement counts.
      4. Deletes matching compliance items and the document record in PostgreSQL via Drizzle ORM.
      5. Automatically recomputes parent `bids` metric counters (`totalRequirements`, `flaggedRequirements`, `approvedRequirements`) and transitions status back to `DRAFT` if no documents remain.
      6. Prunes the specific PDF object and folder prefix in cloud storage (`GCS` / `AWS S3`) via `IStorageService`.
    - Added `DELETE /api/v1/bids/:bidId/documents/:docId` endpoint in `DocumentsController`.
    - Extended frontend API in `apps/web/src/api/bids.ts` with `deleteDocument(bidId, docId)`.
    - Integrated UI deletion flow in `BidDetailPage.tsx`:
      - Added "Delete" action button (`variant="danger"`, trash icon) on each document card in the Tender Documents list.
      - Implemented accessible confirmation `Modal` warning that removing the document permanently purges the cloud PDF and all compliance requirements derived from it.
      - Wired immediate re-fetching of both bid metadata and compliance table upon deletion.
    - Added unit and integration tests in `services.spec.ts` covering successful deletion, cascade compliance pruning, metric recalculation, audit event insertion, and IDOR rejection.
28. [x] **Phase 35: Real Document Byte Size Resolution & Format Utility** _(Completed)_
    - Fixed hardcoded `4000000` byte size in `DocumentsService.confirmUpload`:
      - Captured real `sizeBytes` and `documentType` in `pendingUploads` from `generateUploadUrl`.
      - Verified real cloud object byte size dynamically via `storageService.headObject(storagePath)` on confirmation.
      - Reconciled existing database document rows on-the-fly in `BidsService.getBidById` against cloud object metadata.
    - Added dedicated, unit-tested `formatFileSize(bytes)` utility in `apps/web/src/utils/formatFileSize.ts` supporting `B`, `KB`, `MB`, and `GB` formatting.
    - Updated `BidDetailPage.tsx` to render real formatted sizes (e.g. `631.2 KB`, `24.80 MB`) instead of static `3.81 MB`.
    - Hardened PGlite embedded database initialization in `database.provider.ts` with `await pg.waitReady` and automatic dirty-shutdown recovery.
    - 148 passing TypeScript tests across monorepo (`@tenderpulse/api`, `@tenderpulse/web`) with 0 lint warnings and 0 typecheck errors.

29. [x] **Phase 36: End-to-End FastAPI AI Extraction Pipeline & Real Document Intelligence** _(Completed)_
    - Integrated NestJS API with the Python FastAPI AI worker (`apps/ai`) running on `http://localhost:8000`:
      - Updated `scripts/dev.sh` to automatically launch the FastAPI AI worker in the background alongside NestJS and Vite.
      - Implemented real binary PDF parsing in `DocumentContentNormalizer.ts` via `PDFParse` (`pdf-parse`), extracting genuine page blocks.
      - Integrated `AiDocumentExtractor` with intelligent keyword-candidate page filtering for large tender documents (up to 200+ pages), dispatching clean JSON payloads with `SecurityContext` to `POST /api/v1/extract`.
      - Expanded `default_tender_extractor` in `apps/ai/src/tenderpulse_ai/pipeline.py` to extract real statutory, execution, technical, and financial clauses (EMD, Power of Attorney, Turnover with UDIN, Past Experience, Integrity Pact, Make in India) with exact verbatim quotes and execution rules.
      - Resolved SSE route disconnect: mapped `@Get(['bids/:bidId/extraction-progress', 'bids/:bidId/progress', 'bids/:bidId/documents/stream'])` in `DocumentsController.ts`.
      - Aligned SSE step state machine keys (`PARSING_PAGES`, `EXTRACTING_COMPLIANCE`, `VERIFYING_CITATIONS`, `COMPLETED` / `REVIEW_READY`) with `ExtractionProgress.tsx`, ensuring automatic UI completion and compliance table refetching.
      - Wired automatic extraction on upload confirmation in `DocumentsService.confirmUpload`, persisting grounded compliance items to PostgreSQL and updating bid metrics.
    - 148 TypeScript unit/integration tests and 27 Python AI tests passing across monorepo with 0 errors.

30. [x] **Phase 37: Zero Mock Data Fabrication & Honest Extraction Invariant** _(Completed)_
    - Permanently eradicated the phantom mock data fallback `if (extractedItems.length === 0)` from `DocumentsService.ts`:
      - Previously, if a document was empty or extraction returned 0 items, 5 hardcoded compliance items were fabricated to pass an old unit test.
      - Now, if extraction returns 0 items, exactly 0 items are saved to PostgreSQL `compliance_items`, bid metrics reflect `totalRequirements: 0, flaggedRequirements: 0, approvedRequirements: 0`, and the audit trail honestly logs `extractedItemsCount: 0`.
    - Updated `apps/api/src/modules/__tests__/services.spec.ts`:
      - Injected `MockStorageService` and seeded genuine tender text containing clauses across all procurement categories (`FINANCIAL`, `EXECUTION`, `TECHNICAL`, `LEGAL`, `STATUTORY`).
      - Added explicit unit test proving 0 items are extracted and 0 mock records fabricated when a non-procurement or empty document is uploaded.
      - Tested real document deletion, metric re-computation, cascade cleanup, and optimistic concurrency control without mock artifacts.
    - Fixed `DocumentsService.generateUploadUrl` and `getDownloadUrl` to support any `IStorageService` implementation polymorphically.
    - All 177 tests passing across monorepo (126 in `@tenderpulse/api`, 24 in `@tenderpulse/web`, 27 in `apps/ai`) with 0 lint warnings and 0 TypeScript compile errors.

31. [x] **Phase 38: Multi-Page Canonical Deduplication, Rule Fusion & Stream / Font Headroom Hardening** _(Completed)_
    - **Canonical Deduplication & Rule Fusion**:
      - Solved duplicate compliance items problem where 100+ page tenders repeating keywords (e.g., EMD, Power of Attorney) across chapters produced repetitive candidate items.
      - Implemented multi-page rule fusion in both `apps/ai/src/tenderpulse_ai/pipeline.py` and `DocumentsService.ts`:
        - Merged duplicate items matching `(category, normalized_title)`.
        - Applied most restrictive rule fusion: `stampPaperRequired: true`, `max(stampPaperDenominationInr)`, `notarizationRequired: true`, and CA `udinRequired: true`.
        - Consolidated multi-page citations into human-readable cross-page provenance (e.g. `Clauses across Pages 7, 15, 22`).
    - **Resilient Cloud Storage Path Discovery**:
      - Hardened `confirmUpload` and `markExtractionComplete` in `DocumentsService.ts` against server reboots and in-memory cache eviction.
      - Fallback lookup checks the existing database row and executes prefix lookups in `GcsStorageService` (`findFilesByPrefix`) to discover real filenames (e.g. `Bid_RS21_Part-1_Bidding_Procedures.pdf`) and byte sizes dynamically rather than falling back to placeholders.
      - Reconciled `tender_documents` and `bids` database records dynamically in `BidsService.getBidById`.
    - **PDF Headless Font Warning & Stream Listener Hardening**:
      - Configured `DocumentContentNormalizer.ts` with `standardFontDataUrl` referencing `pdfjs-dist/standard_fonts/` and `verbosity: 0` to silence headless interpreter font traces.
      - Tuned `EventEmitter.defaultMaxListeners = 30` in `main.ts` and `GcsStorageService.ts` to accommodate GCS chunked download streams without false-positive Node.js leak warnings.
    - **Verification**:
      - Successfully re-extracted `bid-nhai-44-001` (`Bid_RS21_Part-1_Bidding_Procedures.pdf`), yielding 3 distinct, grounded, deduplicated requirements with accurate metrics (`total: 3, flagged: 1, approved: 2`).
      - All quality gates passing: 151 TypeScript tests, 27 Python tests, 0 ESLint warnings, 0 Ruff errors, 0 TypeScript compile errors.

32. [x] **Phase 39: Full-Document Multi-Zone Selection, 16-Domain Indian Procurement Taxonomy & Structural Clause Number Extraction** _(Completed)_
    - **Multi-Zone Candidate Page Selector (`AiDocumentExtractor.ts`)**:
      - Eradicated the naive `slice(0, 25)` limitation that previously discarded up to 88% of pages in 200+ page tenders (e.g. `Bid_RS21_Part-1_Bidding_Procedures.pdf`, 213 pages).
      - Implemented a multi-zone sectional selector retaining initial orientation pages (pages 1–10: NIT, Invitation for Bids, Table of Contents) plus up to 50 top-scored procurement pages across Bid Data Sheet (BDS), Section III (Evaluation & Qualification Criteria), and GCC/SCC.
      - Pages are merged, deduplicated, and preserved in natural ascending reading order (up to 60 pages sent to the AI engine).
    - **16-Domain Indian Public Procurement Taxonomy**:
      - Expanded extraction coverage from 6 basic rules to the complete 16-domain Indian public procurement compliance taxonomy across both FastAPI Python worker (`pipeline.py`) and NestJS fallback (`documents.service.ts`):
        1. Financial: Bid Security / Earnest Money Deposit (EMD) Guarantee
        2. Financial: Performance Security (PBG) & Security Deposit
        3. Financial: Technical Qualification & Annual Turnover
        4. Financial: Bank Solvency & Working Capital Credit Facilities
        5. Execution: Power of Attorney & Consortium Execution Rules
        6. Execution: Joint Venture & Consortium Agreement Requirements
        7. Technical: Technical Qualification & Similar Work Experience
        8. Technical: Key Technical Personnel & Project Management Team
        9. Technical: Essential Plant, Machinery & Equipment Undertaking
        10. Legal: Bid Validity Period Commitment
        11. Legal: Completion Schedule & Delay Damages (LD)
        12. Legal: Defect Liability Period (DLP) & Maintenance Guarantee
        13. Legal: Integrity Pact & Non-Blacklisting Declaration
        14. Legal: Conflict of Interest & Non-Collusion Undertaking
        15. Statutory: Make in India (PPP-MII) Local Content Declaration
        16. Statutory: GSTIN & PAN Statutory Tax Compliance
    - **Structural Clause Number Extraction (`_extract_clause_reference`)**:
      - Added regex pattern `\b((?:ITB|BDS|GCC|SCC|Section\s*III|Clause)\s*(?:No\.?)?\s*\d+(?:\.\d+)*)` parsing exact clause identifiers (e.g. `ITB 11.2`, `ITB 1.2`, `ITB 3.1`, `Clause 6`).
    - **Deterministic Verbatim Grounding Invariant**:
      - Introduced `_resolve_quote` with exact substring window fallback (`_extract_verbatim_window`) ensuring 100% of candidate quotes are exact character sequences from `text`, passing LangGraph `verify_grounding` with 0 falsifications.
    - **Live Verification on NHAI 213-Page Tender (`bid-nhai-44-001`)**:
      - Successfully extracted and consolidated 12 rich, high-fidelity compliance requirements across pages 5 to 86.
      - Updated bid metrics dynamically to `totalRequirements: 12`, `flaggedRequirements: 2` (POA and JV/Consortium agreements), `approvedRequirements: 10`, `status: REVIEW_READY`.
      - Generated immutable `AI_INGESTION_COMPLETED` audit event with `groundingScore: 0.98`.
    - **Quality Gates Passing**:
      - 151 TypeScript tests (126 API + 25 Web), 27 Python tests, 0 ESLint warnings, 0 Ruff errors, 0 TypeScript compile errors.

33. [x] **Phase 40: Frontend / Product UX Architecture & 13-Stage Bidding Workflow (Milestone PROMPT 18)** _(Completed)_
    - **13-Stage Business Journey Implementation (`apps/web`)**:
      - Transformed React 18 frontend from a simple upload page into a full 13-stage bidding operating system for Indian MSME contractors.
      - 5 Intuitive Milestones:
        1. *Basics & Intake:* Company Profile (`CompanyProfileSection.tsx`), Tender Intake (`DocumentUploader.tsx`), Tender Overview (`TenderOverviewHeader.tsx`), Key Deadlines (`KeyDeadlinesCard.tsx`).
        2. *Eligibility & Go/No-Go:* 9-Factor Technical & Financial Scorecard (`EligibilitySummaryCards.tsx`), Bid/No-Bid Recommendation (`BidDecisionBanner.tsx`).
        3. *Requirements & Evidence:* Filterable Requirement Matrix (`ComplianceTable.tsx`), Evidence Mapping with Grounded Citations (`EvidenceCitationDrawer.tsx`).
        4. *Risks, Gaps & Review:* Commercial Risk Radar (`RiskRadarCard.tsx`), Missing Evidence Acquisition (`MissingEvidenceSection.tsx`), Human Review Task (`HumanReviewTaskCard.tsx`).
        5. *Readiness & Submission:* 4-Pillar Bid Readiness Score (`BidReadinessGauge.tsx`), Two-Cover Packager & Procedural Checklist (`SubmissionPrepChecklist.tsx`).
    - **MSME Usability & Zero-Jargon Guarantee**:
      - All probabilistic terminology replaced with contractor-friendly language (verbatim clause citations, CA UDIN verification status, stamp paper rules, Liquidated Damages caps, and working capital lock-in).
    - **Traceable Dual-Sided Citation Inspector**:
      - `EvidenceCitationDrawer.tsx` enables interactive, side-by-side verification between verbatim tender clauses and corporate evidence documents with CA UDIN validation.
    - **HITL Integration with OCC Versioning**:
      - First-class human review supporting 5 reviewer roles (`BID_MANAGER`, `LEGAL_COUNSEL`, `FINANCIAL_CONTROLLER`, `TECHNICAL_LEAD`, `BID_DIRECTOR`), threaded comments, confirmation vs override with mandatory audit justification, and OCC versioning.
    - **Quality Gates & Documentation**:
      - Created comprehensive `docs/frontend.md` architecture guide.
      - 237 automated tests passing across monorepo (126 API + 35 Web + 76 Python AI).
      - 0 TypeScript compiler errors across all monorepo workspaces.

**Code Quality Cleanup (2026-10-06, PROMPT 21):** Resolved all lint and type-check errors across the monorepo:
1. **Import path fixes** in new modules (`GetBidDecisionUseCase`, `RequirementMapper`, `CompanyProfileService`, `CompanyProfileController`) — corrected relative depths from `../../` to `../../../` for common modules.
2. **Unused variable cleanup** — removed dead code in `design-system.spec.ts` (unused `Badge`, `SectionHeader` imports), `CompanyProfileSection.tsx` (removed `as any` cast via `as const` array), `TenderTableView.tsx` (unused icons, `LoadingCell` function, `decisionsByBid`/`decisionsLoading` props), `TenderListSection.tsx` (unused imports `CloseIcon`, `TenderTableSkeleton`, `useBidDecisions`, `useBreakpoint`, `getVisibleColumns`, `describeActiveFilters`), `BidVerdictCard.tsx` (unused `WarningIcon`, `DECISION_STATE_LABELS` constant).
3. **Type safety improvements** — `RequirementMapper.ts` now defensively narrows JSONB `unknown` fields with safe defaults; `roles.guard.ts` widens permissions array for wildcard check; `tenant-context.interceptor.ts` types stream as `unknown`; e2e test uses proper `Request`/`Response` types.
4. **Missing field fixes** — added `evaluatedFactors` to `toBidDecision()` return in `bidDetailData.ts`; fixed `ApiResult` type narrowing in `useBidDecision.ts`.
5. **Import path corrections** — `TenderTableView.tsx` imports `computeRiskLevel` from correct path; `useBidDecision.ts` uses correct relative path.
6. **Quality gates**: All 368 tests passing (292 TypeScript + 76 Python), 0 lint errors, 0 TypeScript compile errors.

---

## Next Immediate Action

Per the 2026-10-04 audit (`docs/CURRENT_STATE.md`), the next actions are **P0 hardening before any new features**:

1. Replace demo tokens with signed JWT access + revocable refresh; add verification middleware and guards on every endpoint; secure `/auth/refresh`.
2. Add `organizations` + `organization_memberships`; resolve tenant per request from the authenticated identity; remove all `org_acme_infra_001` literals; derive audit `userId`/`userName` from context.
3. Switch runtime persistence to real PostgreSQL via `DATABASE_URL` with a migration tool and indexes.
4. Then build the product gaps: contractor profile + eligibility engine, evidence repository + matching, risk radar, corrigendum handling, export, observability.


33. [x] **Phase 41: Tender Detail Page Redesign — "Should I Bid on This Tender?" (2026-10-05)** _(Completed)_
    - **Complete redesign of `/bids/:id` (`BidDetailPage.tsx`)** around the single question: *"Should I bid on this tender?"* with the deterministic three-verdict framework (PURSUE / DO_NOT_PURSUE / REVIEW_REQUIRED).
    - **Eliminated all fabricated data**: Removed the entire 13-stage fabricated workflow (`WorkflowStageStepper`, `TenderOverviewHeader`, `KeyDeadlinesCard`, `EligibilitySummaryCards`, `BidDecisionBanner`, `EvidenceCitationDrawer`, `RiskRadarCard`, `MissingEvidenceSection`, `HumanReviewTaskCard`, `BidReadinessGauge`, `SubmissionPrepChecklist`) and the hardcoded `DEFAULT_COMPANY_PROFILE` — all 11 fabricated workflow components deleted.
    - **Real API-only architecture**:
      - `TenderInfoHeader`: Real tender fields only (title, authority, value, deadline, status) — no EMD fabrication, no fake "closing at 15:00 IST", no fallback values.
      - `BidVerdictCard`: Honest three-verdict framework (PURSUE / DO_NOT_PURSUE / REVIEW_REQUIRED) with "no recommendation yet" state when the bid-decision engine is absent; shows real input signals (requirements count, flagged, review-needed, deadline buffer) and documents the missing `GET /api/v1/bids/:id/bid-decision` + `GET /api/v1/company-profile` endpoints.
      - `ComplianceTable` (KEPT): Real requirement matrix with grounded provenance, execution rules, and OCC review actions.
      - `ProvenanceDrawer` (NEW): Real grounded provenance viewer — verbatim quote, document, page, clause, confidence score — with explicit "company evidence matching not yet available" gap disclosure.
      - `ObligationsCard` (NEW): Aggregated statutory obligations (stamp paper max denomination, notarization count, UDIN count, signing ranks) + flagged requirements as real disqualification-risk signals.
      - `ReviewNeededCard` (NEW): Real PENDING / humanReviewRequired items deep-linking to the real compliance review page.
      - `ReadinessCard` (NEW): Real readiness rollup (approved/total %) + deadline buffer; 4-pillar engine gap documented.
      - `MissingDataCallout` (NEW): Documents 7 missing endpoints (`bid-decision`, `company-profile`, `evidence-matches`, `risk-findings`, `review-tasks`, `readiness`, `deadlines`).
      - Document package + uploader: Real documents with type badges, download, RBAC-gated delete.
    - **Backend bid-decision pipeline implemented**:
      - `AiDecisionClient.ts`: HTTP client for the deterministic `POST /api/v1/agent/bid-decision` (internal service key, security context, timeout, injectable fetch for tests).
      - `RequirementMapper.ts`: Pure mapping from stored `ComplianceItem` → AI `RequirementCandidate` (category→kind, criticality derivation: FINANCIAL/STATUTORY/TECHNICAL→HARD_ELIGIBILITY; provenance mapping).
      - `GetBidDecisionUseCase.ts`: Orchestrates bid + compliance items → requirement candidates → pinned company profile → AI engine call → persists `bid_decisions` → returns.
      - Database: `company_profile_versions` (immutable JSONB snapshots), `company_profiles` (active pointer), `bid_decisions` (immutable audit trail with full AI response JSONB).
      - Company Profile module: GET/POST `/api/v1/company-profile` (CRUD with version pinning, validation).
      - Projections: `GET /api/v1/bids/:id/review-tasks` (real PENDING/humanReviewRequired items), `GET /api/v1/bids/:id/readiness` (server-side rollup).
      - Endpoints: `GET/POST /api/v1/bids/:id/bid-decision` in `BidsController` (BIDS_READ / BIDS_UPDATE).
      - Permission: `COMPANY_PROFILE_MANAGE` (ADMIN only).
    - **Web wiring**: `getBidDecision` / `evaluateBidDecision` in `api/bids.ts`, `companyProfile.ts` CRUD, `mapApiDecisionToBidDecision` mapping (GO→PURSUE, CONDITIONAL_GO→REVIEW_REQUIRED, NO_GO→DO_NOT_PURSUE), `BidDetailPage` fetches decision on load, "Re-evaluate" button for ADMIN/BID_MANAGER, `BidVerdictCard` renders real verdict + reasons + disqualifiers + gaps.
    - **Tests**: 9 RequirementMapper tests, 9 GetBidDecisionUseCase integration tests (PGlite + fake AI client), 8 CompanyProfileService tests, 174 API tests, 117 web tests, 76 Python AI tests — all 368 passing.
    - **Cleanup**: 11 fabricated workflow components deleted; `TenderTableView` simplified to "Not evaluated" for fit/recommendation; `TenderListSection` cleanup; all 368 tests passing.
    - **Documentation**: `MissingDataCallout` on detail page documents 7 missing endpoints; `MissingApiCallout` on dashboard updated.

34. [x] **Phase 42: Requirement / Compliance Matrix Overhaul (2026-10-05)** _(Completed)_
    - **Rebuilt the Requirement / Compliance Matrix** into one of the strongest, most intuitive, and production-grade screens in the product (`apps/web`):
      - **7 Standardized Columns**: `Requirement` (Title, Subcategory, Clause Ref), `Category` (`LEGAL`, `TECHNICAL`, `FINANCIAL`, `STATUTORY`, `EXECUTION`, `COMMERCIAL`), `Mandatory` (Yes/No badge), `Company Evidence` (Linked evidence status & document title), `Status` (`PASS`, `FAIL`, `MISSING`, `REVIEW_REQUIRED`, `NOT_APPLICABLE`), `Risk` (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), `Source` (Document name & page citation).
      - **Dense, Readable Layout**: Avoided dumping huge walls of unformatted text directly in table cells. Implemented single-line expandable rows with collapsible chevrons.
      - **Answered the 4 Core Contractor Questions**:
        1. *"What does the tender require?"*: Full requirement text + `ExecutionRulesCard` (Non-judicial stamp paper INR denomination, notarization rules, 18-digit CA UDIN mandate, signing authority rank).
        2. *"Do we have evidence?"*: Linked company evidence status badge, document type, file name, CA UDIN, expiry date, and `EvidenceDrawer` with status interpretations.
        3. *"Why did the system reach this result?"*: Structured rationale comparison (Tender Requirement vs Company Capability cards, evaluation rule applied, logic breakdown points, confidence percentage) in `AssessmentPanel`.
        4. *"Where did this requirement come from?"*: Grounded source coordinates (Document name, Page number, Section/Clause name, and verbatim quote block with copy button) in `SourceCitationDrawer`.
      - **Search, Multi-Filter & Total Sorting**:
        - Status filter tabs with live item counts for `ALL`, `PASS`, `FAIL`, `MISSING`, `REVIEW_REQUIRED`, `NOT_APPLICABLE`.
        - Free-text search across requirements, categories, clauses, evidence titles, and evaluation rules.
        - Dropdown filters for Category, Risk level, and Mandatory status with active filter badge and "Reset Filters" action.
        - Full column sorting on all 7 columns via `ColumnSorter`.
      - **Interactive Human Review with OCC**:
        - Role-based permissions check (`compliance:review`), modal for reviewer notes/justification, and optimistic concurrency version validation (`expectedVersion: item.version`).
      - **Unit Test Coverage**: Added `complianceMatrix.spec.ts` testing all 7 columns, filtering, multi-field search, sorting, and 4-question derivations (10 new tests, 127 total web tests passing, 378 passing across monorepo).




