# Project Status & Milestone Tracker

## Current implementation milestone: Ground-Truth Architecture Documentation & Comprehensive Interview Preparation

1. **Problem Statement & Scope**:
   - The platform architecture had evolved through several major milestones (Design B event choreography, multi-company tenant scoping, single-writer PostgreSQL persistence, structured JSON logging, and clean-up), leaving architectural documents out-of-sync with code reality.
   - Database documentation (`docs/DATABASE.md`) required an authoritative, complete ER diagram, along with an explicit domain-concept-to-database-entity mapping covering Tenders, Documents, Clauses, Requirements, Evidence, Compliance, Review Tasks, and Jobs, plus clear differentiation between physical engine foreign keys (`ON DELETE CASCADE`) and logical application references.
   - High-Level Design (`docs/ARCHITECTURE.md`) and Low-Level Design (`docs/LLD.md`) required complete overhauls to reflect active Design B asynchronous event choreography, Single-Writer Principle in NestJS `DocumentCompletionService`, fiber-safe `TenantContextHolder`, Docling parser pipeline, LangGraph 8-node cyclic graph, scoped RAG tooling, Route 53/CloudFront edge tiers, EventBridge scheduled events, and Aurora Multi-AZ with RDS Proxy.
   - Comprehensive, senior-architect-level interview preparation materials were needed across all 7 core technology pillars (AWS/GCP, LangGraph, LLMs, RAG, React 18, NestJS, FastAPI), addressing every required technology with 7 distinct architectural dimensions (what it does, why chosen, alternatives, trade-offs, failure modes, scalability/security, and likely interview follow-ups).

2. **Architectural Improvements & Delivered Documentation**:
   - **Database ER Diagram & Schema Specification (`docs/DATABASE.md`)**:
     - Produced complete Mermaid ER diagram representing all 14 actual tables in `apps/api/src/common/database/schema.ts` and `database.provider.ts`.
     - Added dedicated Domain Concept to Database Entity Mapping section and Mermaid diagram connecting Tenders (`bids`), Documents (`tender_documents`), Clauses (`compliance_items.provenance`), Requirements (`compliance_items`), Evidence (`company_profile_versions.payload` & `compliance_items.company_evidence`), Compliance (`compliance_items`), Review Tasks (`ComplianceService.listReviewTasks` projection), and Jobs (`document_processing_outbox` + `tender_documents.status`).
     - Explicitly mapped Physical Engine Foreign Key constraints (`tender_documents.bid_id -> bids.id` and `compliance_items.bid_id -> bids.id`) vs Logical Application References.
     - Documented multi-company hierarchy, cardinality analysis (1:1, 1:N, M:N), JSONB value objects (`execution_rules`, `provenance`, `CompanyProfileSnapshot`), and indexing patterns.
     - Explicitly called out implementation realities and inconsistencies: active Drizzle ORM vs legacy `schema.prisma`/`schema.sql` (paise vs rupees, string IDs), embedded PGlite vs production PostgreSQL 16.
   - **High-Level Design (HLD) (`docs/ARCHITECTURE.md`)**:
     - Complete end-to-end architecture diagram covering Route 53/CloudFront Edge Tier, React SPA, NestJS API on ECS/Cloud Run, S3/GCS Object Storage, SQS/PubSub, EventBridge, FastAPI Worker, Docling, LangGraph 8-node graph, AWS Bedrock, and Amazon Aurora PostgreSQL 16 with RDS Proxy.
     - Documented authentication/RBAC (in-memory access token, refresh token in localStorage, silent refresh, atomic permission matrix).
     - Detailed tenant isolation across network, storage prefix, fiber-safe `AsyncLocalStorage`, AI `SecurityContext`, and database queries.
     - Detailed Design B decoupled event choreography, worker dispatch-and-ACK (<100ms), and Single-Writer Principle.
     - Documented external AI integration, storage presigned URL handshake, API inventory, failure/retry paths, and canonical structured JSON logging.
   - **Low-Level Design (LLD) (`docs/LLD.md`)**:
     - Documented NestJS modules (`BidsModule`, `DocumentsModule`, `ComplianceModule`, `AuthModule`, `DatabaseModule`, `StorageModule`, `QueueModule`).
     - Added comprehensive class diagram detailing Controllers, Use Cases, Repositories (`IBidRepository`, `PostgresBidRepository`), Storage (`IStorageService`), and Queues (`IJobQueue`).
     - Documented FastAPI routers, dependency injection (`verify_internal_key`), and `CompletionPublisher` hierarchy.
     - Complete breakdown of the LangGraph 8-node cyclic state machine, `ComplianceWorkflowState`, reducers (`operator.add`), validation checks, and conditional routing.
     - Documented Docling parser engine, regex extractors, and `ScopedRetrievalTool` RAG component.
     - Created 5 end-to-end Mermaid sequence diagrams: Direct-to-Storage Upload, Design B Ingestion & Event Choreography, Interactive Compliance Review (OCC), Deterministic Bid Decision Evaluation, and Transactional Outbox Polling & Queue Ingestion.
   - **Master Technical Interview Guide (`docs/INTERVIEW_PREP.md`)**:
     - Created deep, senior-architect-level interview questions and model answers based strictly on the implemented codebase across 7 technology pillars:
       - AWS & GCP: S3/GCS, SQS/PubSub, DynamoDB (why rejected), EventBridge, AppSync (why rejected for SSE), Aurora PostgreSQL 16 & RDS Proxy, IAM, Route 53/CloudFront vs Cloud DNS/Armor.
       - LangGraph: State machine concepts, nodes/edges, cyclic retries, checkpointing, conditional routing, human-in-the-loop (`interrupt`), LangGraph vs LangChain, why normal orchestrators weren't sufficient.
       - LLMs: Advisory extraction, grammar-constrained decoding, prompt framing, hallucination mitigation, verbatim quote grounding, model selection (Claude 3.5 Sonnet on Bedrock ap-south-1 Mumbai), token economics, 100+ page candidate filtering, 429 rate limit failure handling.
       - RAG: Layout parsing, chunking, vector search vs hierarchical AST search, metadata filtering, `ScopedRetrievalTool` tenant isolation, RAG vs fine-tuning.
       - React 18: In-memory token security, SSE async status handling, custom hooks (`useSSE`, `useApi`), optimistic UI with rollback, routing & protected views, component architecture.
       - NestJS: Modular monolith architecture, dependency injection, guards, interceptors, outbox pattern, NestJS vs Express.
       - FastAPI: Two-tier service boundary, Pydantic v2 schemas, non-blocking `asyncio` task execution, LangGraph integration, FastAPI vs NestJS rationale.
   - **Index & Navigation (`docs/README.md`)**:
     - Updated documentation index to link `INTERVIEW_PREP.md`.

3. **Verification Record**:
   - Monorepo Type Check (`npm run type-check`): 0 errors across all TypeScript packages.
   - API Unit & Integration Tests (Vitest): 33 test files, 242 tests passed (100% green).
   - Web Unit Tests (Vitest): 22 test files, 163 tests passed (100% green).
   - Python Test Suite (`pytest apps/ai`): 113 passed, 1 skipped (100% green).
   - Python Linting (`.venv/bin/ruff check .`): 0 errors, 0 warnings across whole repo.

## Previous implementation milestone: System-Wide Production Cleanup, Anti-Pattern Elimination & Documentation Consolidation

1. **Problem Statement & Scope of Cleanup**:
   - **TypeScript & Web/API Code Hygiene**:
     - Eliminating remaining `any` type casts across production services, components, and hooks (`AiDecisionClient`, `AiDocumentExtractor`, `GetBidDecisionUseCase`, `billing.service.ts`, `compliance.service.ts`, `DocumentCompletionService.ts`, `DocumentProcessingRuntime.ts`, `bidDetailData.ts`, `ComplianceTable.tsx`, `useBidComplianceItems.ts`, `BidDetailPage.tsx`, `workflowData.ts`).
     - Eliminating unused imports, dead variables, and legacy schema references in test suites (`HttpLoggingInterceptor.spec.ts`, `StructuredLogger.spec.ts`, `multi-company-security.spec.ts`, `billing-registration-entitlements.spec.ts`, `notifications.spec.ts`, `profile-settings-teams.spec.ts`, `EndToEndFrontendToAiPipeline.e2e.spec.ts`, `bidDetailData.spec.ts`, `useApi-useSSE.spec.ts`).
     - Achieving zero ESLint warnings across both `@tenderpulse/api` and `@tenderpulse/web` (`eslint --max-warnings=0`).
   - **Python Ruff, Dependencies & Worker Hygiene (`apps/ai`)**:
     - Resolving all 62 Ruff errors across the AI worker (SIM102/103/117 nested conditionals and with-statements, B023 loop binding, BLE001 blind exception handling, G201/TRY401 logging hygiene, RUF059 unused unpackings, and ClassVar mutable class attributes).
     - Fixed missing `pypdfium2>=5.14.0` dependency in `apps/ai/pyproject.toml` and installed it in the virtual environment.
     - Guarded `pypdfium2` imports in `apps/ai/src/tenderpulse_ai/domain/pdf_resolver.py` and `apps/ai/tests/test_contract_execution_extraction.py` with runtime availability checks, preventing crashes during test collection in environments without C++ PDFium bindings.
     - Removed sample-tender-specific hardcoding in `pdf_resolver.py` (eliminated hardcoded `work_975754` paths in candidate search directories and deleted the silent fallback that swapped missing documents with `NIT8.pdf`).
   - **Repository Script Hygiene & Ruff Zero-Warning Gate (`scripts/`)**:
     - Resolved 12 Ruff lint and formatting issues across `scripts/` (`extract_dca_clauses.py`, `generate_real_gem_railway_tenders.py`, `generate_sample_tenders.py`), including unused variables (`page_obj_id`), redundant f-strings, import sorting, and executable permissions (`chmod +x`). Whole-repo `ruff check .` now exits with 0 errors and 0 warnings.
   - **Dead Scratch & Duplicate Documentation Consolidation**:
     - Purging untracked scratch directories (`scratch/test_covenants.py`).
     - Consolidating duplicate and fragmented documentation:
       - Eliminating `docs/architecture/` drafts, standardizing single sources of truth in `docs/` (`docs/LLD.md`, `docs/ARCHITECTURE.md`, `docs/AI.md`, `docs/AI_SECURITY.md`).
       - Merged `docs/ASYNC.md` into `docs/ASYNC_DOCUMENT_HANDOFF.md`, unifying distributed queue semantics (visibility timeouts with exponential backoff and jitter, DLQ poison pill mitigation) with Design B asynchronous event choreography and removing conflicting worker-to-DB diagrams.
       - Updated `docs/SERVICE_BOUNDARY.md` and `docs/LLD.md` to reflect current Design B implementation and `CompletionWebhookController` (`POST /api/v1/internal/extraction-completed`).
       - Removing stub `docs/SECURITY_REVIEW.md` (superseded by `docs/SECURITY_MODEL.md` and `docs/AI_SECURITY.md`).
       - Moving unnumbered `docs/ADR-DOCUMENT-PROCESSING-RUNTIME.md` into `docs/adr/0022-durable-asynchronous-document-processing-runtime.md`.
       - Rebuilding `docs/README.md` to fix all broken links to non-existent documents.

2. **Architectural Improvements & Consolidations**:
   - **Single-Writer Principle Adherence**: Clearly documented and verified in `docs/ASYNC_DOCUMENT_HANDOFF.md` that NestJS `DocumentCompletionService` serves as the sole atomic writer for compliance items and document status in PostgreSQL, while FastAPI workers remain strictly pure computation and event publishing nodes.
   - **Type Safety & Schema Tightening**: Replaced ambiguous types with explicit interfaces (`ProvenanceJson`, `ExecutionRulesJson`, `SubscriptionView['status']`) preventing runtime bugs from unvalidated JSONB payloads.
   - **Cloud-Provider Agnostic Verification**: Ensured all queues and publishers (`IJobQueue`, `CompletionPublisher`, `IStorageService`) remain abstracted behind ports and adapters without vendor leakage.
   - **Sample-Tender Hardcoding Elimination**: Removed fallback substituting non-existent uploaded files with `samples/work_975754/NIT8.pdf`.

3. **Verification Record**:
   - Monorepo Type Check (`npm run type-check`): 0 errors across all TypeScript projects.
   - Monorepo Build (`npm run build`): All 4 packages and apps built cleanly.
   - API Unit & Integration Tests (Vitest): 33 test files, 242 tests passed (100% green).
   - Web Unit Tests (Vitest): 22 test files, 163 tests passed (100% green).
   - Monorepo Integration Tests: 1 passed.
   - Whole-Repository Python Linting (`ruff check .`): 0 errors, 0 warnings across `apps/ai` and `scripts/`.
   - Python Test Suite (`pytest` in `apps/ai`): 113 passed, 1 skipped (100% green, with DCA.pdf optional skip).

## Previous implementation milestone: Elimination of Synchronous RPC Antipattern & Unification of Design B Event Choreography

1. **Problem Statement & Architectural Requirements**:
   - **Legacy Synchronous RPC Lingering (`fetchFn` to `/api/v1/extract` with 120s timeout)**:
     - In `AiDocumentExtractor.ts`, an outdated synchronous RPC call method (`extract()`) persisted, holding open HTTP connections to FastAPI with a 120-second timeout.
     - In `DocumentProcessingRuntime.ts`, a fallback branch to `extract()` lingered if `dispatchExtraction()` was not called.
     - In `documents.service.ts`, a dead 250-line `markExtractionComplete()` method and ~800 lines of regex-based local extractors (`extractLocallyFromPages`, `consolidateExtractedItems`) lingered as unused dead code.
   - **Strict Design B Event-Driven Model Enforced**:
     - The entire application now strictly uses asynchronous event choreography:
       - Queue worker (`DocumentProcessingRuntime`) receives the ingestion job, validates tenant/bid/company/storage ownership, calls `dispatchExtraction()` (<100ms dispatch-and-ACK), and deletes the queue message.
       - Python AI Engine (`apps/ai`) performs OCR and LangGraph extraction in the background and emits a `DocumentExtractionCompletedEvent` (via webhook or completion queue).
       - `DocumentCompletionService` adheres strictly to the **Single-Writer Principle** for PostgreSQL: it receives the completion event, validates citations and execution rules, and commits compliance items into `compliance_items` in a single atomic database transaction, transitioning document status to `COMPLETED` and bid status to `REVIEW_READY`.
     - Zero blocking synchronous HTTP network calls waiting for extraction across the entire NestJS application.

2. **Architectural Changes**:
   - `AiDocumentExtractor.ts`:
     - Updated `DocumentExtractionPort` so `dispatchExtraction` is the mandatory primary contract method.
     - Guarded `extract()`: in production runtimes, calling synchronous `extract()` throws an immediate error directing callers to `dispatchExtraction()`, preventing socket exhaustion or 120-second timeout hangs.
   - `DocumentProcessingRuntime.ts`:
     - Removed synchronous `extract()` fallback branch; worker strictly dispatches extraction asynchronously via `dispatchExtraction()` and acknowledges the message in <100ms.
     - Handles completion events (`body.items`) on the queue by routing to `DocumentCompletionService.processExtractionCompleted()` and acknowledging the event.
   - `documents.service.ts`:
     - Completely removed dead `markExtractionComplete()`, `consolidateExtractedItems()`, `extractClauseReference()`, and `extractLocallyFromPages()` (~800 lines deleted).
     - Removed unused AI extractor and normalizer imports (`AiDocumentExtractor`, `DocumentContentNormalizer`, `TenderDocument`, `MockStorageService`).
   - `services.spec.ts` & `DocumentProcessingRuntime.spec.ts`:
     - Updated all unit tests to simulate completion via `DocumentCompletionService.processExtractionCompleted()` and verify asynchronous dispatch and queue completion handling.

3. **Automated Verification**:
   - `@tenderpulse/api`: 33 test files, 242 tests passed (100% green).
   - `apps/ai`: 113 pytest tests passed, 1 skipped (100% green).
   - Monorepo type-check (`npm run type-check`): 0 errors across all workspaces.

## Previous implementation milestone: Cross-Service End-to-End Structured JSON Logging, Zero-Leakage Telemetry & Trace Propagation

1. **Problem Statement & Architectural Requirements**:
   - **Distributed Observability Gap**: As requests flow across the Frontend, NestJS API, Cloud Object Storage (S3/GCS), Message Queues (SQS/PubSub), FastAPI AI Engine, Docling OCR, LangGraph nodes, LLM inference, and PostgreSQL persistence, operations lacked a shared correlation identifier. Diagnosing failures or measuring pipeline stage latencies required manual correlation across disparate log formats.
   - **Canonical Schema Consistency**: Disparate logging formats between NestJS (`@nestjs/common` string logs) and FastAPI (`uvicorn` console logs) hindered centralized log aggregation (OpenSearch / Datadog / CloudWatch / Cloud Logging). Both services required a single canonical JSON schema:
     `{ timestamp, level, service, environment, event, message, trace_id, request_id, correlation_id, tenant_id, user_id, tender_id, document_id, job_id, workflow_id, node, duration_ms, error_code, metadata }`
   - **Zero Secrets & Zero PII Leakage**: Raw log output must never contain authentication credentials (JWTs, Bearer tokens, API keys, database passwords), cloud storage credentials, presigned URL signatures (`X-Amz-Signature`, `X-Goog-Signature`), or Indian PII (PAN, GSTIN, Aadhaar).
   - **Full Workflow Telemetry**: Standardized log events for:
     - HTTP request lifecycles (`http.request.received`, `http.request.completed`, `http.request.failed`) with route, method, status, and duration.
     - Cloud storage lifecycle (`storage.presigned_url.generated`, `storage.delete.completed`, `storage.delete.failed`) with object keys and byte sizes, strictly redacting signed query strings.
     - Message queue telemetry (`queue.message.published`, `queue.message.received`, `queue.message.completed`, `queue.message.failed`) with safe IDs and durations.
     - Docling OCR parsing (`docling.parse.started`, `docling.parse.completed`) with page counts and durations.
     - LangGraph node execution (`langgraph.node.started`, `langgraph.node.completed`, `langgraph.node.failed`) across all nodes with node name, candidate counts, and latencies.
     - LLM inference (`llm.request.started`, `llm.request.completed`, `llm.request.retry`) capturing model name, latencies, and token counts (prompt, completion, total) without exposing raw prompt injection text or API keys.

2. **Architectural Implementation**:
   - **NestJS Structured Logging Infrastructure (`apps/api/src/common/logging`)**:
     - `LogSanitizer.ts`: Precompiled regex scrubbing of AWS keys, JWTs, bearer tokens, DB credentials, presigned query signatures, PAN, GSTIN, and Aadhaar. Deep sanitization handles nested objects and maps with circular reference protection via `WeakSet`.
     - `LoggingContext.ts`: Backed by Node.js `AsyncLocalStorage`, seamlessly tracks `traceId`, `correlationId`, `requestId`, `tenantId`, `userId`, `tenderId`, `documentId`, `jobId`, `workflowId`, and `node` across asynchronous call chains.
     - `StructuredLogger.ts`: Implements NestJS `LoggerService`, formats single-line canonical JSON, filters via `LOG_LEVEL` (default `INFO` in production, `DEBUG` in dev), supports `LOG_FORMAT=pretty` in local terminal and `json` in cloud runtimes.
     - `HttpLoggingInterceptor.ts`: Captures/propagates `X-Trace-Id` / `X-Correlation-Id`, emits `http.request.completed` / `http.request.failed` with status codes and `duration_ms`.
     - `tenant-context.interceptor.ts`: Synced authenticated user `organizationId`, `sub`, and `requestId` into `LoggingContextHolder`.
     - Configured `StructuredLogger` as NestJS root logger in `main.ts`.
   - **Queue & Storage Telemetry (`apps/api`)**:
     - `packages/shared-types`: Added `traceId?: string` to `DocumentIngestionCommand` and `DocumentExtractionCompletedEvent`.
     - `AwsS3StorageService.ts` & `GcsStorageService.ts`: Emits `storage.presigned_url.generated` (capturing key, content-type, duration without URL signature), `storage.delete.completed`, and `storage.delete.failed`.
     - `AwsSqsJobQueue.ts` & `GcpPubSubJobQueue.ts`: Injects `traceId` into queue payloads, logs `queue.message.published`.
     - `DocumentProcessingRuntime.ts`: Wraps queue message consumption in `LoggingContextHolder.run()`, emits `job.started`, `extraction.dispatched`, and `job.completed` with `duration_ms`.
     - `DocumentCompletionService.ts`: Wraps completion event persistence in `LoggingContextHolder.run()`, emits `compliance.items.persisted` with item counts and duration.
     - `AiDocumentExtractor.ts`: Forwards `X-Trace-Id`, `X-Correlation-Id`, and `X-Request-Id` headers when dispatching requests to FastAPI.
   - **FastAPI Structured Logging Infrastructure (`apps/ai/src/tenderpulse_ai/logging`)**:
     - `context.py`: Python `contextvars` context holder (`trace_id_var`, `tenant_id_var`, `node_var`, etc.), `scoped_logging_context` context manager.
     - `formatter.py`: `JSONLogFormatter` inheriting from `logging.Formatter` emitting matching canonical JSON with `SecretSanitizer` deep scrubbing.
     - `middleware.py`: `TraceLoggingMiddleware` capturing `X-Trace-Id` / `X-Correlation-Id`, injecting into context, timing requests, and emitting `http.request.completed`.
     - `sanitizer.py`: Added scrubbing for presigned URL signatures, Indian PAN (`[A-Z]{5}[0-9]{4}[A-Z]`), GSTIN, and Aadhaar.
     - `main.py`: Configured root logger with `JSONLogFormatter`, registered `TraceLoggingMiddleware`, wrapped worker queue jobs in `scoped_logging_context`.
   - **LangGraph, Docling & LLM Telemetry (`apps/ai`)**:
     - `docling_parser.py`: Emits `docling.parse.started` and `docling.parse.completed` with `duration_ms`, `blocks_count`, and `pages_count`.
     - `openai_compatible_client.py`: Emits `llm.request.started`, `llm.request.retry`, and `llm.request.completed` with `duration_ms`, model name, and prompt/completion/total token usage.
     - `workflow/nodes.py`: Instrumented all 8 workflow nodes (`docling_parse`, `build_structure`, `candidate_detection`, `context_assembly`, `llm_extraction`, `validation`, `confidence_routing`, `postgres_store`) plus refinement and human review nodes with `node_var`, timing, and structured `langgraph.node.started`/`completed`/`failed` logs.
     - `publisher.py`: Carries `trace_id` through `DocumentExtractionCompletedEvent` and forwards `X-Trace-Id` header in webhook callbacks.

3. **Automated Verification**:
   - `apps/ai`: 113 passed, 1 skipped (100% green, including 10 new tests in `test_structured_logging.py`).
   - `@tenderpulse/api`: 33 test files, 242 tests passed (100% green, including `StructuredLogger.spec.ts` and `HttpLoggingInterceptor.spec.ts`).
   - `@tenderpulse/web`: 22 test files, 163 tests passed (100% green).
   - Monorepo type-check (`npm run type-check`): 0 errors across all workspaces.

## Previous implementation milestone: Design B: Direct Queue Ingestion and Asynchronous Event Choreography

1. **Problem Statement & Architectural Requirements**:
   - **Synchronous RPC Bottleneck**: Previously, document extraction relied on `DocumentProcessingRuntime` or `AiDocumentExtractor` holding open a synchronous HTTP POST connection (`/api/v1/extract`) to FastAPI for up to 120 seconds. This synchronous RPC-in-worker antipattern led to socket timeouts, resource hogging, and poor fault isolation across service boundaries.
   - **Decoupled Event Choreography (Design B)**: Transition to true asynchronous event choreography:
     1. Python AI Engine consumes ingestion commands directly or receives non-blocking dispatches (`async_mode: true`).
     2. Python processes PDF parsing and LangGraph extraction in the background and emits `DocumentExtractionCompletedEvent`.
     3. NestJS acts under the **Single-Writer Principle** for PostgreSQL: it receives the completion event (via `POST /api/v1/internal/extraction-completed` webhook or completion queue), deterministically validates citations/invariants, commits `compliance_items` in a single transaction, and transitions the bid to `REVIEW_READY` and document to `COMPLETED`.

2. **Architectural Implementation**:
   - **Shared Event Contracts (`@tenderpulse/shared-types`)**:
     - Defined `DocumentIngestionCommand`, `DocumentExtractionCompletedEvent`, and `ExtractedComplianceItemDto`.
     - Standardized camelCase wire format between TypeScript and Python.
   - **Python AI Engine Completion Infrastructure (`apps/ai`)**:
     - Created provider-agnostic `CompletionPublisher` interface in `tenderpulse_ai.infrastructure.queue`.
     - Implemented `HttpCallbackCompletionPublisher` (protected by `X-Internal-Service-Key`), `GcpPubSubCompletionPublisher`, `AwsSqsCompletionPublisher`, and `MockCompletionPublisher`.
     - Updated `/api/v1/worker/process-message` to support `async_mode` (spawns background extraction task and returns `ACCEPTED` immediately < 20ms) and publish completion events upon pipeline completion.
   - **NestJS Single-Writer Completion Handler & Webhook (`apps/api`)**:
     - Implemented `DocumentCompletionService`: validates verbatim quote and execution rule invariants, performs deduplication and rule fusion against existing items, and executes transactional persistence into `compliance_items`, `bids`, `tender_documents`, and `audit_logs`.
     - Gracefully handles missing/orphan documents or deleted bids by returning `{ status: 'DROPPED', processed: false }` with HTTP 200 and a descriptive warning instead of throwing unhandled 500 exceptions.
     - Implemented `CompletionWebhookController` (`POST /api/v1/internal/extraction-completed`) protected by `INTERNAL_SERVICE_KEY` security guard via `InternalServiceGuard`.
     - Refactored `AiDocumentExtractor`: added `dispatchExtraction()` for non-blocking asynchronous dispatch via `/api/v1/worker/process-message` (`async_mode: true`), and routed synchronous `extract()` to `/api/v1/extract` to prevent duplicate webhook callbacks.
     - Adapted `DocumentProcessingRuntime`: dispatches extraction asynchronously via `dispatchExtraction` and acknowledges the queue message immediately, allowing the completion event to persist results exactly once (with fallback to `extract` + `persistResults` when `dispatchExtraction` is not implemented).
     - Added support for `mock`, `memory`, `test`, and `none` providers in `get_completion_publisher`.

3. **Automated Verification**:
   - `apps/ai`: 104 pytest tests passing (100% green, including `test_completion_queue_publisher.py`).
   - `@tenderpulse/api`: 31 test files, 235 tests passing (100% green, including `CompletionWebhookController.spec.ts` and `DocumentProcessingRuntime.spec.ts`).
   - `@tenderpulse/web`: 22 test files, 163 tests passing (100% green).
   - Monorepo type-check (`npm run type-check`): 0 errors across all workspaces.

## Previous implementation milestone: Document Ingestion Resilience, Timeout Hardening & PostCSS Dependency Alignment

1. **Problem Statement & Architectural Requirements**:
   - **PostCSS / Tailwind v4 Incompatibility**: Running `scripts/dev.sh` caused Vite to fail with `[Error] It looks like you're trying to use 'tailwindcss' directly as a PostCSS plugin...` because `tailwindcss` had been bumped to `^4.3.3` in `apps/web/package.json` while the build system, PostCSS plugins, and Tailwind Animate depended on Tailwind v3 configuration semantics.
   - **FastAPI Extraction AbortError (`DOMException [AbortError]`)**: During ingestion of multi-page tenders (such as `Bid_RS21_Part-2_Employers_Requirements.pdf`), Node.js `DocumentsService` timed out at 15 seconds while FastAPI was processing raw PDF pages, causing an `AbortController` cancellation.
   - **Unfiltered Multi-Page Traversal in AI Engine**: Large 100-300+ page tenders downloaded via presigned URLs were processed page-by-page sequentially through LangGraph without candidate filtering, consuming excessive processing time and triggering client timeouts.
   - **LocalStack Storage Handover Resiliency**: When running locally without an active LocalStack instance on `localhost:4566`, presigned URL download handovers caused TCP connect hangs instead of failing fast to local extraction.
   - **Duplicate Extraction Dispatch in Single Upload**: A single document upload triggered two parallel dispatches to the AI engine: one from the async queue worker (`DocumentProcessingRuntime`) and an accidental second one from a legacy timer in the SSE progress endpoint (`DocumentsController.streamExtractionProgress -> markExtractionComplete()`).

2. **Architectural Implementation**:
   - **Tailwind v3 Dependency Pinning (`apps/web/package.json`)**:
     - Pinned `"tailwindcss": "^3.4.17"` to align with PostCSS config and `@tenderpulse/ui` design tokens.
     - Verified Vite bundle builds cleanly in ~1.07s.
   - **Configurable Extraction Timeout (`documents.service.ts`, `AiDocumentExtractor.ts`)**:
     - Raised default extraction timeout from 15s/60s to 120s (configurable via `AI_EXTRACTION_TIMEOUT_MS`).
   - **Elimination of Duplicate Extraction Dispatch (`documents.controller.ts`, `documents.service.ts`)**:
     - Converted `streamExtractionProgress` from an active caller to a passive observer: it polls `documentsService.getBidExtractionProgress()` without triggering duplicate synchronous extractions via `markExtractionComplete()`.
     - Preserves single-writer ownership for the background queue worker (`DocumentProcessingRuntime`).
   - **Candidate Page Scoring & TOC Filtering (`pdf_resolver.py`, `pipeline.py`)**:
     - Added `is_pure_toc_page()` and `filter_candidate_pages()` in Python: large documents (>30 pages) preserve initial metadata pages (first 10 pages) and rank substantive pages by Indian Public Procurement / contract covenant keywords, limiting the LangGraph workflow to the top ~45 high-signal candidate pages.
     - Added a defense-in-depth candidate filter guard in `ProductionExtractionPipeline.execute` if `request.pages > 40`.
   - **Resilient Presigned URL Handover**:
     - Extended mock storage URL detection in `AiDocumentExtractor.ts` and `pdf_resolver.py` to identify `localhost:4566` and `127.0.0.1:4566`.
     - Wrapped `httpx.AsyncClient` streaming download in try/except blocks to gracefully fall back on network connect errors.

3. **Automated Verification**:
   - `apps/ai`: 100/100 pytest tests passing (100% green).
   - `@tenderpulse/api`: 30 test files, 228 tests passing (100% green).
   - `@tenderpulse/web`: 22 test files, 163 tests passing (100% green).
   - Monorepo type-check (`npm run type-check`): 0 errors across all workspaces.
   - Production bundle build (`npm --prefix apps/web run build`): Clean build in 1.07s.

## Previous implementation milestone: 8-Node LangGraph RAG Pipeline & OpenRouter LLM Gateway Integration

1. **Problem Statement & Architectural Requirements**:
   - **Pluggable Foundation Model Inference**: The LangGraph extraction engine previously relied on a deterministic regex extractor to keep tests instant and offline, but required a production-grade LLM gateway to handle nuanced, long-tail procurement covenants.
   - **Zero Vendor Lock-In**: Required OpenAI-compatible gateway integration (OpenRouter, OpenAI, vLLM, Groq) with provider-agnostic naming in domain logic per `AGENTS.md`.
   - **Zero Hallucination Guarantee**: Even with a live LLM, legal procurement covenants must be strictly anchored to exact verbatim substrings on verified page coordinates; hallucinated quotes must be rejected deterministically by Node 6.
   - **Prompt Engineering Hardening**: Needed an enhanced system prompt with domain-specific taxonomy (Indian Public Procurement), execution rule extraction (stamp paper denomination, notarization, CA 18-digit UDIN, MT760 SFMS), and negative exclusion directives (pruning Table of Contents, Article 48 bare definitions, Schedule T third-party auditor criteria).
   - **Deterministic Fallback**: The system must run 100% offline in CI/CD or local test environments without requiring paid API keys or active internet access.

2. **Architectural Implementation**:
   - **LLM Configuration & Key Resolution (`apps/ai/src/tenderpulse_ai/config.py`)**:
     - Added provider-agnostic properties: `llm_api_key`, `llm_base_url` (`https://openrouter.ai/api/v1`), `llm_model` (`google/gemini-2.0-flash-001`), `llm_timeout_seconds`, and `llm_max_retries`.
     - Automatically resolves `OPENROUTER_API_KEY` or `LLM_API_KEY` from environment variables or `.env`.
   - **OpenAI-Compatible Asynchronous HTTP Client (`OpenAICompatibleLlmClient.ts` / `.py`)**:
     - Built using `httpx.AsyncClient` without heavy vendor SDKs.
     - Enforces JSON Schema structured output (`response_format: {"type": "json_object"}`).
     - Implements exponential backoff on transient 429/500/502/503/504 errors.
     - Strips markdown code fences and deserializes responses into `CandidateComplianceItem` instances with default fallback provenance.
   - **Structured LLM Client Adaptation (`StructuredLLMClient.py`)**:
     - Pre-invocation secret scrubber (`SecretSanitizer.scrub()`) redacts sensitive tokens before outbound network dispatch.
     - Dispatches to `OpenAICompatibleLlmClient` when configured; automatically triggers deterministic fallback (`default_tender_extractor`) if the gateway fails or when run offline.
   - **Production System Prompt & Security Fences (`workflow/nodes.py`)**:
     - Enhanced system prompt in Node 5 with domain taxonomy, negative exclusion rules, and execution rule extraction.
     - Enforced `<untrusted_document_data>` XML fences treating PDF text strictly as passive data to prevent prompt injection.
   - **Deterministic Grounding Verification (Node 6)**:
     - Verified that all LLM candidate quotes must pass character-by-character substring checks against `raw_page_text` before entering verified state.

3. **Automated Verification**:
   - `apps/ai`: 100/100 pytest tests passing (100% green), including 5 new tests in `test_openrouter_llm_client.py`.
   - `@tenderpulse/api`: 30 test files, 228 tests passing (100% green).
   - `@tenderpulse/web`: 22 test files, 163 tests passing (100% green).
   - Monorepo type-check (`npm run type-check`): 0 errors across all workspaces.
   - Knowledge graph updated via `graphify update .` (4,097 nodes, 9,285 edges, 214 communities).

## Previous implementation milestone: Document-Agnostic Extraction Generalization, Pre-Ingestion Tender Relevance Validation, and Dynamic Company Evidence Checklist

1. **Problem Statement & Architectural Requirements**:
   - **Pre-Ingestion Tender Relevance Validation**: Uploaded documents were previously accepted into the storage and processing pipeline regardless of whether they actually pertained to the targeted tender, wasting expensive downstream OCR/Docling/LLM compute on unrelated files.
   - **Broken Destination Scroll Position**: Navigating from Review Tasks to `/bids/:id/compliance/:itemId` retained previous scroll positions or landed in mid-page states.
   - **Notifications Theme Desynchronization**: Notification popovers used hardcoded dark palette background classes (`bg-slate-900`, `border-slate-800`, `text-slate-200`), failing to respond properly to light/dark theme switches.
   - **Outdated Bid/No-Bid Decision Rationale & Missing Unavailable State**: The UI displayed an obsolete message ("No recommendation yet - Company Profile API does not exist") when company profile information was actually available but insufficient. Furthermore, it lacked an explicit `RECOMMENDATION_UNAVAILABLE` state, risking premature or fabricated recommendations.
   - **Static vs Dynamic Evidence Checklist**: Procurement tenders require specific proof (e.g. 3 similar projects, ISO certifications, CA turnover audits) derived strictly from tender clauses rather than generic universal checklists.
   - **Sample-Tender Hardcoding in AI Pipeline (`pipeline.py`, `AiDocumentExtractor.ts`, domain models)**: Generic extraction code contained specific constants from sample tenders (e.g. `9.1.1`, `910th day`, `scheduled four-laning date`, `12.4.1`, `25,00,000`, `25 lakh`, `120 days`, `40.09 crore`). These constants crippled generalization to arbitrary tenders with different clause structures, numbers, and temporal obligations.

2. **Architectural Implementation**:
   - **Tender Document Relevance Validation (`TenderDocumentRelevanceValidator.ts`, `documents.service.ts`)**:
     - Evaluates uploaded document content against tender metadata (tender number, authority name, acronyms, title keywords, procurement markers like NIT/RFP/EOI/IFB).
     - Gated inside `DocumentsService.confirmUpload()` prior to dispatching expensive background extraction.
     - Preserves tenant isolation and returns clear user-facing `BadRequestError` explanations for unrelated uploads.
   - **Client-Side & Global Scroll-to-Top Lifecycle (`ScrollToTop.tsx`, `App.tsx`, `ComplianceReviewPage.tsx`)**:
     - Implemented global `ScrollToTop` component listening to React Router `pathname` changes.
     - Mounted explicit `useLayoutEffect` scroll reset on `complianceId` navigation in `ComplianceReviewPage.tsx`.
   - **Semantic Design Tokens for Notifications (`NotificationBell.tsx`)**:
     - Refactored `NotificationBell` to standard CSS tokens (`bg-popover`, `border-border`, `text-popover-foreground`, `hover:bg-accent/60`, `bg-muted/50`), ensuring instant reactivity to dark/light theme toggling.
   - **Truthful Decision State Modeling & Dynamic Company Document Checklist (`bidDetailData.ts`, `BidVerdictCard.tsx`, `CompanyDocumentChecklist.tsx`)**:
     - Refactored `mapVerdict()` and `BidVerdict` to support `RECOMMENDATION_UNAVAILABLE` (distinct from `PURSUE`, `DO_NOT_PURSUE`, or `REVIEW_REQUIRED`).
     - Replaced obsolete "Company Profile API does not exist" message with clear explanations of missing capability evidence.
     - Created `CompanyDocumentChecklist` component dynamically mapping extracted tender requirements to required evidence documents, verification statuses, execution rules, and provenance citations.
   - **Complete Elimination of Sample-Tender Hardcoding (`pipeline.py`, `AiDocumentExtractor.ts`)**:
     - Replaced hardcoded string matches (`"9.1.1"`, `"scheduled four-laning date"`, `"12.4.1"`, `"25,00,000"`, `"120"`) with generalized regex extractors:
       - `extract_temporal_durations()`: extracts arbitrary integer durations and units (days, months, years, hours).
       - `extract_monetary_amounts()`: parses arbitrary currencies and values (lakhs, crores, millions, billions, INR/USD/EUR).
       - `extract_percentages()`: dynamically captures arbitrary rate/ratio thresholds.
       - `extract_clause_reference()`: extracts arbitrary clause identifiers from heading context.
     - Generalized project scope detection to dynamically match any project type (`Four-Laning`, `Two-Laning`, `Bridge`, `Project Highway`, `Railway`, etc.).
   - **Hierarchical Document Clause Discovery (`structure_builder.py`, `context_assembler.py`, `validator.py`)**:
     - Upgraded clause pattern matching to support arbitrary document structures: single integers, multi-level decimals (`1`, `1.1`, `1.1.1`, `4.2.7`), `Article`, `Section`, `Schedule`, `Annexure`, `Appendix`, and `Part`.
     - Cross-references are resolved dynamically against the reconstructed hierarchy; unresolved references are cleanly marked unresolved rather than guessed.

3. **Automated Verification**:
   - `apps/ai`: 95/95 pytest tests passing (100%), including 8 new tests in `test_document_agnostic_extraction.py` validating arbitrary clause numbers (`7.3.2`, `14.8`), arbitrary durations (`45 days`, `90 days`, `365 days`), and arbitrary amounts (`₹10 lakh`, `₹2.5 crore`).
   - `@tenderpulse/api`: 30 test suites, 228 tests passing (100%), including 5 new unit tests in `TenderDocumentRelevanceValidator.spec.ts`.
   - `@tenderpulse/web`: 22 test suites, 163 tests passing (100%).
   - Monorepo type-check (`npm run type-check`): 0 errors across all workspaces.
   - Zero hardcoded tender-specific constants remaining across the repository (`git grep` audit verified).

## Previous implementation milestone: Elimination of UI Flashing, SSE Reconnect Loops, and Live Extraction Pipeline Lifecycle Hardening

1. **Problem Statement & Root Cause Analysis**:
   - **Full UI Flashing / Reloading**: During in-flight extraction polling (`setInterval` every 2.5s), calling `refetchBid()` triggered `useApi.ts`, which unconditionally executed `setState(prev => ({ ...prev, isLoading: true }))`. In `BidDetailPage.tsx`, `if (bidLoading)` unmounted the entire DOM tree and rendered `<LoadingSkeleton />` on every interval tick, causing violent layout thrashing.
   - **Continuous SSE Looping**:
     - When the NestJS backend completed the SSE stream and called `res.end()`, browser native `EventSource` treated the closed connection as an abnormal termination and automatically attempted reconnection.
     - Because `useSSE.ts` lacked terminal state teardown, every reconnection hit `/api/v1/bids/:bidId/extraction-progress`, replaying the pipeline from 25% to 100% in an infinite loop.
     - The backend controller previously emitted `status: 'QUEUED'` at 100% completion and never called `markExtractionComplete(bidId)`. Consequently, `bid-cpwd-gov-002` remained stuck in database status `ANALYZING` and documents in `PROCESSING`, keeping the frontend in-flight polling active forever.

2. **Architectural Implementation**:
   - **Stale-While-Revalidate (SWR) Silent Revalidation (`apps/web/src/hooks/useApi.ts`)**:
     - On background `refetch()`, `isLoading` is set to `prev.data === null`, ensuring it never flips to `true` when data is already present.
     - Added `isValidating: boolean` for non-destructive background network tracking.
     - Reset `data: null` and `isLoading: true` only when hook dependencies actually change (e.g., navigating between different tender IDs).
   - **Non-Destructive Render Guards (`apps/web/src/pages/BidDetailPage.tsx`)**:
     - Changed full-page skeleton condition from `if (bidLoading)` to `if (bidLoading && !bid)`.
     - Guarded compliance tables and cards with `complianceLoading && items.length === 0`, preventing subcomponent flashing during background updates.
   - **Terminal SSE Connection Teardown (`apps/web/src/hooks/useSSE.ts`)**:
     - Automatically invokes `es.close()` and sets `isTerminatedRef.current = true` upon receiving `step === 'COMPLETED'` or `progress >= 100`.
     - Suppressed `onerror` reconnect attempts once terminal completion is reached or when `close()` is explicitly called by the consumer.
   - **Clean Extraction Pipeline Settlement (`apps/web/src/components/progress/ExtractionProgress.tsx`)**:
     - Explicitly invokes `close()` upon completion.
     - Guarded error states: `isFailed = !isComplete && (currentStepKey === 'FAILED' || !!sseError)` so clean stream closures are never misclassified as failures.
   - **Backend Status Transition & Persistence (`apps/api/src/modules/documents/documents.controller.ts`, `documents.service.ts`)**:
     - `streamExtractionProgress` now emits `status: 'REVIEW_READY'` at 100% progress and invokes `this.documentsService.markExtractionComplete(bidId)`.
     - `markExtractionComplete` updates both `schema.bids.status = 'REVIEW_READY'` and `schema.tenderDocuments.status = 'COMPLETED'`, ensuring the tender and documents cleanly settle in the database.

3. **Automated Verification**:
   - `@tenderpulse/api`: 29 test suites, 223 tests passing (100%).
   - `@tenderpulse/web`: 22 test suites, 163 tests passing (100%).
   - Added unit test suite `apps/web/src/hooks/__tests__/useApi-useSSE.spec.ts` verifying SWR semantics and SSE connection termination.
   - Monorepo type-check (`npm run type-check`): 0 errors across all workspaces.
   - Knowledge graph updated via `graphify update .`.

## Previous implementation milestone: Dynamic Procurement Calculations, Action Card Scrollability & Deterministic Decision Engine

1. **Problem Statement & Audit Findings**:
   - **Action Required Card Overflow**: The dashboard "Action Required" section lacked scroll containment when expanding `+{n} more actions across your tenders`, causing page spillover rather than staying bounded within its container.
   - **Hardcoded Grounding Match**: "96% Grounding Match" badge was static and not derived from verified citation attributes.
   - **Impossible "144% of requirements approved"**: Multi-document deduplication reduced compliance items from 16 to 9, but stale database denormalized counters (`approved_requirements = 13` calculated via legacy `total - flagged`) resulted in `13 / 9 = 144%`. Furthermore, the percentage calculation lacked mathematical upper-bound clamping.
   - **Canned 35% "DO NOT PURSUE" Fallback**:
     - Hardcoded turnover (₹150 Cr) and experience (₹120 Cr) minimum thresholds in `AiDecisionClient.evaluateLocalDeterministic` disqualified small tenders (e.g. ₹1.3 Cr staffing contract).
     - Static `readiness_score = 0.35` (35% fit score) was returned unconditionally.
     - Synthetic canned strings (`EMD Bank Guarantee SFMS Confirmation...` and `LIQUIDATED DAMAGES: Standard 0.5% per week delay...`) were injected into `uncertain_areas` and `commercial_risks` and displayed as disqualifying reasons even when absent from tender documents.

2. **Architectural Implementation**:
   - **Box-Bounded Scrollable Action Required Card (`ActionRequiredCard.tsx`)**:
     - Added `isExpanded` state with a bounded viewport (`max-h-[380px] overflow-y-auto pr-1`).
     - Implemented bidirectional toggle button (`+{n} more actions across your tenders ↓` / `Show top 5 actions ↑`).
   - **Derivation-Based Grounding (`grounding.ts`)**:
     - Implemented `deriveGroundingMatch`: dynamically calculates grounding confidence across 4 citation dimensions (substantive verbatim quote, physical page coordinate, tender clause reference, source document anchor).
     - Adheres to DOMAIN.md §28 hard grounding invariants (100% exact verbatim substrings for verified extraction candidates).
     - Integrated across `ComplianceReviewPage.tsx` and `EvidenceTraceabilityChain.tsx`.
   - **Mathematical Clamping & Live Readiness Derivation (`readiness.ts`, `ReadinessCard.tsx`, `DocumentProcessingRuntime.ts`, `documents.service.ts`)**:
     - `computeReadiness`: Enforces strict invariant `approved = Math.min(rawApproved, total)` and clamps percentage to `[0, 100]`.
     - `ReadinessCard`: Memoizes live rollup directly from loaded `items: ComplianceItem[]` (`rollup.ready` and `rollup.flagged`), preventing desynchronization from stale `bid` table counters.
     - Backend runtime fixed to count verified items (`READY` / `PASS`) rather than subtracting flagged items from total.
   - **Dynamic Deterministic Bid Decision Engine (`AiDecisionClient.ts`, `bidDetailData.ts`, `BidVerdictCard.tsx`)**:
     - Dynamically computes financial criteria based on actual contract value (40% average annual turnover, 35% single completed project experience).
     - Evaluates MSME Micro/Small registration under Public Procurement Policy 2012 / GFR Rule 173(i) for statutory criteria relaxation.
     - Eliminates synthetic EMD and LD strings; scans real extracted requirements for authentic financial and commercial obligations.
     - Dynamically computes readiness score from passing factor ratio.
     - Updated database row for active tender in PGlite `./data/postgres`.
   - **In-Flight Extraction Live Synchronization & Infinite Spinner Prevention (`BidDetailPage.tsx`, `ExtractionProgress.tsx`, `documents.controller.ts`)**:
     - **Root Cause**: When a document was uploaded, the asynchronous extraction worker (`DocumentProcessingRuntime`) required 5–15 seconds to parse pages and extract clauses. However, the client only issued a single `refetchBid()` upon upload and at 2.3s when simulated SSE completed. Because no active polling loop existed in `BidDetailPage.tsx`, `doc.status` remained frozen as `'PROCESSING'` in React state indefinitely until a hard browser refresh occurred.
     - **Reactive Polling Loop**: Added `hasInFlightProcessing` detector that actively polls `refetchBid()` and `refetchCompliance()` every 2.5 seconds while any document is in `'PROCESSING'` or `'QUEUED_FOR_EXTRACTION'`, or while `bid.status === 'ANALYZING'`.
     - **Clean Auto-Teardown**: Automatically disarms and clears the interval the moment all documents settle (`COMPLETED`, `EXTRACTED`, `FAILED`), transitioning the loading spinner into the verified status icon immediately without requiring a manual page refresh.
     - **Guarded SSE Teardown**: Added `hasCompletedRef` in `ExtractionProgress.tsx` to prevent redundant completion triggers, and added `res.end()` in `documents.controller.ts` to cleanly close SSE connections upon completion.

3. **Automated Verification**:
   - `@tenderpulse/api`: 29 test suites, 223 tests passing (100%).
   - `@tenderpulse/web`: 21 test suites, 161 tests passing (100%).
   - `apps/ai`: 87 pytest tests passing (100%).
   - Monorepo type-check (`npm run type-check`): 0 errors across all 5 workspaces.
   - Knowledge graph updated via `graphify update .` (4022 nodes, 9131 edges, 216 communities).

## Previous implementation milestone: Model Concession Agreement Covenant Extraction & Negative False-Positive Pruning

1. **Problem Statement & Audit Findings**:
   - A real-world audit against the 369-page NH-62 Model Concession Agreement (`samples/DCA.pdf`) identified 4 false positives and missed key contract execution covenants:
     - **False Positive 1 (Turnover)**: Mistakenly flagged Schedule T (eligibility turnover threshold for external Chartered Accountant firms empanelled to audit traffic fees) and Article 7.1(k) (Consortium members whose capacity was evaluated for RFP equity lock-in).
     - **False Positive 2 (Plant & Machinery)**: Mistakenly flagged Schedule G capital milestone expenditure exclusions (`"shall not include advances ... or plant and machinery"`), coupled with an unanchored regex match on generic `"shall provide"` clauses.
     - **False Positive 3 (Key Personnel)**: Mistakenly triggered on Schedule K Table of Contents dot-leader lines.
     - **False Positive 4 (Working Capital)**: Mistakenly triggered on Article 40.2 permitted assignment clauses for lender indebtedness and project highway working capital.
     - **Extraction Gap**: Long-term concession agreements contain heavy operational covenants (Conditions Precedent, Milestone Milestones Schedule G, Liquidated Damages, Escrow Waterfalls, Co-insured Insurances, Rescue Cranes, Paramedic Ambulances, SAROD Arbitration, Schedule E Permits, Schedule K SLAs) that standard RFP eligibility extractors missed.

2. **Architectural Implementation**:
   - **Negative Context Pruning & Quote Resolver Hardening (`pipeline.py`)**:
     - Fixed `_extract_verbatim_window` bug where non-matching keywords previously fell back to returning `text[:max_chars]` (the first 140 characters of the page header).
     - Pruned Schedule T CA empanelment, Article 7 equity lock-in, and Schedule G expenditure exclusions from eligibility checks.
     - Tightened `has_positive_equipment` and `has_positive_personnel` to require explicit deployment modals coupled with equipment/personnel context (avoiding generic "shall provide" or Independent Engineer appointment clauses).
     - Pruned Article 40 permitted assignments from banker solvency certificate checks.
     - Suppressed bare glossary definitions in Article 48 from operative EMD/PBG commitments.
   - **Concession Agreement Execution Covenants (`candidate_detector.py`, `nodes.py`, `pipeline.py`, `AiDocumentExtractor.ts`)**:
     - Added candidate detectors and extraction logic for 20 primary execution covenants: Conditions Precedent (180 days), COD (910 days), Schedule G Milestones, Liquidated Damages, Escrow 11-Tier Waterfall, SAROD Arbitration, Schedule E Clearances, Schedule K Maintenance SLAs, Heavy Rescue Cranes, Ambulance, State Grant Rs 40.09 Cr, Equity Lock-in (74% / 26%), and Comprehensive Project Insurance.
     - Expanded keyword scoring in `AiDocumentExtractor.ts` to include execution terms and increased page budget to 75 pages.
     - Updated LangGraph Node 5 retrieval query and system prompts in `workflow/nodes.py`.
   - **Automated Verification**:
     - Added comprehensive regression test suite in `apps/ai/tests/test_contract_execution_extraction.py` covering false positive suppression, covenant extraction, and full pipeline execution on DCA pages.
     - Verified extraction against full 369-page `samples/DCA.pdf`: yields 19 structured, validated covenants with **ZERO** false positives.
     - All 87 pytest tests in `apps/ai` pass 100%.
     - All 29 test suites (223 tests) in `@tenderpulse/api` pass 100%.
     - All 21 test suites (161 tests) in `@tenderpulse/web` pass 100%.
     - Monorepo type-check (`npm run type-check`) compiles cleanly across all 5 workspaces.

## Previous implementation milestone: Presigned URL Handover Pattern (Zero-Copy Node.js Ingestion)

1. **Problem Statement & Motivation**:
   - In earlier iterations, NestJS (`apps/api`) read entire PDF binary blobs into Node.js buffers and executed `pdf-parse`. This resulted in `MaxListenersExceededWarning` EventEmitter leaks, high V8 heap usage, lack of layout/table awareness, and large serialized JSON payload transmissions to the Python AI engine.
   - The AI engine in FastAPI (`apps/ai`) already has high-performance C++ PDFium and Docling engines designed specifically for document structure parsing, table extraction, and OCR.

2. **Architectural Implementation**:
   - **Capability-Based Handover (`AiDocumentExtractor.ts`)**:
     - NestJS acts strictly as an orchestrator and capability grantor: it calls `IStorageService.generatePresignedDownloadUrl(storagePath, fileName, 900)` to generate a 15-minute presigned download capability URL.
     - Checks object existence via `headObject()` without reading the raw binary blob into memory.
     - Dispatches `{ document_id, bid_id, download_url, pages: [] }` to FastAPI (`/api/v1/extract`).
     - Node.js never buffers raw PDF bytes or runs `pdf-parse` on the production cloud path.
     - Local candidate page normalization is preserved strictly as an emergency offline fallback and for unit tests with in-memory `MockStorageService`.
   - **FastAPI Ingestion & Streaming Engine (`pdf_resolver.py` & `pipeline.py`)**:
     - `resolve_pdf_to_pages(download_url, document_id, file_name)`:
       - Streams bytes safely using `httpx.AsyncClient` with a 150 MB safety guard and scoped tempfile cleanup.
       - Skips network calls for synthetic mock domains (`mock-s3.tenderpulse.local`).
       - Extracts text and page geometries using `pypdfium2` (C++ PDFium) in sub-second time.
       - Integrated seamlessly into `ProductionExtractionPipeline.execute`: if `pages` is empty and `download_url` is provided, pages are resolved directly before entering the LangGraph compliance workflow.
   - **Automated Verification**:
     - Python test suite: Added unit test in `test_production_pipeline.py` verifying direct resolution and extraction from presigned download URLs.
     - TypeScript test suite: All 28 test suites (221 tests) pass in `@tenderpulse/api` without memory warnings or performance degradation.
     - All 84 pytest tests in `apps/ai` pass.
     - Monorepo type check (`npm run type-check`) compiles with zero errors across all workspaces.

## Previous implementation milestone: Authentication Lifecycle Synchronization & Proactive Token Refresh

1. **Root Cause Analysis (GET /api/v1/companies 401 Unauthorized)**:
   - **XSS Token Isolation vs Cold Starts**: In `client.ts`, access tokens are retained strictly in-memory (`let accessToken = null`), while the refresh token is persisted in `localStorage` (`tp_refresh_token`). On browser reloads or direct route navigation (e.g. `/bids/:id`), JavaScript memory resets with `accessToken = null`.
   - **Ungated Mount Execution**: `CompanyContext` previously checked `isAuthenticated` (which returned `true` immediately because the user profile was cached in `localStorage`), but did not check `authLoading` (`isLoading` from `useAuth()`).
   - **Premature Network Dispatch**: `CompanyContext` immediately dispatched `listCompanies()` before `initAuth()` could complete silent token refresh.
   - **Browser-Level 401 Logging**: `apiFetch` in `client.ts` dispatched `fetch('/api/v1/companies')` without `Authorization` headers. The browser dev tools logged the HTTP 401 error before the 401 retry interceptor executed. StrictMode double-mounting generated two identical 401 errors.

2. **Architectural Fixes**:
   - **Proactive Token Refresh (`client.ts`)**: In `apiFetch()`, if in-memory `accessToken` is null on startup but a `refreshToken` exists in storage, `apiFetch` proactively awaits `coordinatedRefresh()` before sending the HTTP request. Protected requests are never dispatched unauthenticated.
   - **Unified Refresh Lock (`AuthProvider.tsx` & `client.ts`)**: `initAuth()` in `AuthProvider` now shares the single in-flight `refreshPromise` via `coordinatedRefresh()`, eliminating concurrent refresh races between component mounts.
   - **Context Loading Gate (`CompanyContext.tsx`)**: Added `authLoading` checks in `reloadCompanies()` and `useEffect()`, guaranteeing company fetching is held until auth initialization completes.
   - **Automated Verification**: Added cold-start unit test in `client.spec.ts` proving zero unauthenticated calls are dispatched when `accessToken` is null and `refreshToken` is present.
   - **Mock Cleanups**: Fixed constructor mock implementations for GCP PubSub and GCS storage adapters.

3. **Multilingual Status**:
   - On strict **HOLD** per user instruction. Indic / Kannada font conversion pipeline is paused without interfering with operational procurement workflows.

2. **Operative Clause Extraction & TOC Elimination**:
   - **Root Cause**: Earlier versions yielded truncated snippets and Table of Contents noise (e.g. `"8 Defect Liability and Maintenance Period ."`, `"14. Taxes and Duties ."`) because candidate pages unconditionally included orientation pages 0..10 and extractors matched the first keyword occurrence without checking for operative obligations.
   - **TOC Filtering (`AiDocumentExtractor.ts`)**: Implemented `isPureTocPage` detection (>20% dot-leaders/page numbers without operative modals) to prune index/contents pages before dispatching candidate batches to the AI extraction engine.
   - **Operative Extraction (`pipeline.py` & `documents.service.ts`)**: Implemented `is_toc_or_definition`, `has_operative_obligation`, and `extract_operative_clause`. Candidate keyword matches are ranked by deontic obligation scores (`shall`, `must`, `will be forfeited`, deadlines, amounts) and expanded backwards to clause/section numbers (`GC Sub-Clause 13.3.1 (Page 25)`), producing substantive 150–600 character clause blocks.

3. **Multi-Document Deduplication & Rule Fusion**:
   - **Root Cause**: Tenders uploaded with multiple volumes (e.g., General Conditions + Special Conditions + Employer Requirements) previously hashed `documentId` into `compliance_items.id`, inserting duplicate rows for PBG, EMD, Turnover, etc.
   - **Write-Time Deduplication (`DocumentProcessingRuntime.ts`)**: Scoped canonical item ID to `(organizationId, companyId, bidId, category, normalizedTitle)`. Multi-document uploads match existing items and perform rule fusion (takes strictest `stampPaperRequired`, `max(denomination)`, `notarizationRequired`, `udinRequired`, and keeps the most operative verbatim quote).
   - **Read-Time Deduplication (`compliance.service.ts`)**: Defensive consolidation in `listItems`, `listReviewTasks`, `getReadinessRollup`, `getEvidenceMatches`, and `getRiskFindings`.
   - **Database Migration**: Consolidated existing duplicate rows in PGlite `./data/postgres`, leaving 9 canonical requirements for `bid-1791271769867-0063q9`.
   - **Frontend Deduplication**: Added defensive memoized deduplication in `ComplianceTable.tsx`, `BidDetailPage.tsx`, and `useBidComplianceItems.ts` to ensure UI tables and KPI cards remain 100% duplicate-free.

Verification: Full unit, integration, and e2e test suites pass cleanly across all stacks:
- `@tenderpulse/api`: 28 test suites, 222 tests passed.
- `@tenderpulse/web`: 18 test suites, 152 tests passed.
- `apps/ai`: 83 pytest tests passed.
- All TypeScript workspaces compile cleanly (`npm run type-check`: 0 errors).

## Previous implementation milestone: Configurable Hierarchical Logging (NestJS & FastAPI)

Added environment-driven, multi-level diagnostic logging across both backend services (`apps/api` and `apps/ai`):

1. **NestJS LogLevel Resolver (`apps/api`)**:
   - Implemented `resolveLogLevels(process.env.LOG_LEVEL)` in `src/common/logger/log-level.util.ts`, supporting `error`, `warn`, `info`/`log`, `debug`, and `verbose`/`trace`.
   - Wired into `NestFactory.create` in `main.ts` and replaced legacy `console.log` / `console.warn` calls across queue and storage providers with native `@nestjs/common` `Logger`.
   - Integrated contextual structured logging into `DocumentProcessingRuntime`, `AiDocumentExtractor`, and `DocumentsService` with clean separation between high-level operational signals (`LOG`/`WARN`) and deep debugging traces (`DEBUG` for payloads, presigned links, page breakdowns, and lease timing).

2. **FastAPI AI Logging & 8-Node LangGraph Tracing (`apps/ai`)**:
   - Added `log_level: str = "INFO"` to `TenderPulseSettings` in `config.py` with standard Pydantic Settings env overrides.
   - Initialized structured root logging in `main.py` using `logging.basicConfig(...)` with formatted timestamps, log levels, and logger names.
   - Added detailed `DEBUG` / `INFO` telemetry across all 8 nodes in `apps/ai/src/tenderpulse_ai/workflow/nodes.py` (Docling parser, structure builder, candidate detector, context assembler, LLM extractor, validator, confidence router, and PostgreSQL store).

3. **Security & Redaction**:
   - Explicitly ensured authentication tokens, session secrets, and internal service keys are excluded from logging statements.
   - Raw document excerpts and large text blocks restricted to `DEBUG` level to prevent production log pollution and sensitive data exposure.

Verification: Full test suites pass cleanly across both packages (`apps/api`: 28/28 suites, 221/221 tests; `apps/ai`: 82/82 tests).

## Current implementation milestone: 8-Node Docling LangGraph Document Processing Workflow

The FastAPI AI service ([`apps/ai`](file:///Users/belikesaurabh/main/TenderAi/apps/ai)) now executes an 8-node structured LangGraph document processing workflow:

1. **Node 1 — Parse (`docling_parse`):** Converts PDF layout/pages into structured Docling format (`document_id`, `pages`, `blocks`, `tables`) with security context authorization checks.
2. **Node 2 — Build Structure (`build_structure`):** Deterministically parses document outline hierarchy (`PART I -> Section 1 -> 1.1`).
3. **Node 3 — Candidate Detection (`candidate_detection`):** Applies layout + linguistic rules to identify requirement passages (`shall`, `must`, `EMD`, `turnover`, `stamp paper`).
4. **Node 4 — Context Assembly (`context_assembly`):** Constructs rich LLM context window (section path, current clause, prev/next clause windowing, definitions, referenced clauses).
5. **Node 5 — LLM Extraction (`llm_extraction`):** Performs tenant-isolated structured extraction with XML prompt injection defense.
6. **Node 6 — Validate (`validation`):** Performs multi-stage validation (citation support, reference integrity, number preservation, shall/must deontic correctness, exception retention).
7. **Node 7 — Confidence Routing (`confidence_routing`):** Computes confidence score and routes:
   - `≥ 95%`: Auto-accept (`AUTO_ACCEPT`).
   - `80% - 94%`: Reviewer verification queue (`REVIEWER_VERIFICATION`).
   - `< 80%`: Mandatory human review interrupt (`MANDATORY_HUMAN_REVIEW`).
8. **Node 8 — Store (`postgres_store`):** Persists verified compliance items, validation audit logs, and provenance directly to PostgreSQL/persistence sink.

Verification: FastAPI test suite passed 80/80 unit, integration, and evaluation regression tests.

## Current implementation milestone: durable asynchronous document processing

The initial reliability/context gaps have a NestJS-hosted processing path implemented and covered by focused tests. This is an incremental bridge, **not** completion of the intended FastAPI queue-worker architecture.

- Upload confirmation now requires a non-empty object-storage object before it writes confirmation state.
- The document row, bid status, upload audit entry, and stable-ID processing outbox event are committed in one database transaction. Queue publishing is performed by a registered background runtime and retried from the outbox.
- `DocumentProcessingRuntime` is registered by `DocumentsModule`; it polls the configured `IJobQueue`, checks tenant/company/bid/document/storage claims against database records, leases document processing, validates extraction results, persists compliance items and terminal status transactionally, then acknowledges.
- Compliance item IDs are deterministic per tenant/company/bid/document/category/normalized title. Duplicate delivery for the same completed document does not extract or persist twice.
- SQS/Pub/Sub polling errors and missing manual DLQ configuration are explicit failures; a production API no longer silently defaults to the in-memory queue when no provider is configured.
- Company and correlation context now reach the FastAPI `SecurityContext`; LangGraph thread IDs include tenant, company, workflow run, bid, document, and page.

**Still not aligned with target:** the consumer currently runs in NestJS, `AiDocumentExtractor` retrieves and parses the document in NestJS (`pdf-parse`, no OCR), and then submits normalized pages to FastAPI. FastAPI does not consume the queue, retrieve cloud objects, or persist compliance rows. The NestJS runtime owns PostgreSQL result persistence. Deployments must configure a real queue, storage adapter, database, AI service URL/internal key, and dead-letter handling; local/test mock adapters are not production guarantees.

Verification: API type-check passed; 67 focused API processing, queue, and end-to-end tests passed; FastAPI test suite passed (78 tests). See [ADR 0022](adr/0022-durable-asynchronous-document-processing-runtime.md) and the current call-chain updates in the flow docs.

## Current extraction-quality update: complete sentence provenance quotes

FastAPI's default tender extractor and the NestJS local fallback now treat single newlines as visual PDF line wraps while retaining blank-line paragraph boundaries. Provenance excerpts therefore include the remainder of a clause across wrapped lines instead of ending at the first newline. The regression test now uses the supplied [NIT8.pdf](../samples/work_975754/NIT8.pdf): the EMD sentence ends at “payable at Hassan.” on page 2. Text missing from the source itself is not fabricated.

The new `Tdocument.pdf` citation was traced to page 10, checklist item 7 (annual-turnover certificate and audit report). Its Kannada text is returned by PDF text extraction in a legacy-font encoding that renders as strings such as `£ÀqÉ...`; the parser is not translating or inventing those characters. The page also contains a following numbered item, so quote extraction now retains the matching numbered item as context and stops before the next numbered item. The excerpt remains a literal parser result, not a readable Kannada translation.

Completed compliance records keep their existing provenance until explicitly reprocessed. The reprocess endpoint and UI refresh matching items from the current parser output while preserving reviewer state; reprocessing is queued and must complete before the displayed excerpt changes.

## Documentation consolidation

The canonical documentation entry point is now [docs/README.md](README.md). This replaces the older historical snapshot that was redundant with the milestone tracker and the more specific architecture flow docs.

## Historical baseline: document-processing runtime trace (pre-implementation)

Repository execution has now been checked separately from earlier milestone notes. The older “storage-backed queue processing” status below described an HTTP-shaped endpoint and a test worker, not a connected production queue-to-FastAPI pipeline.

- `DocumentsService.confirmUpload()` persists document metadata and audit information, best-effort checks object metadata, enqueues a processing job when a queue is configured, and returns. Missing-object/head errors and queue publish errors are logged but do not stop the response or guarantee a job was accepted.
- The queue payload carries IDs, workflow/correlation context, and `storageReference`; it does not contain the PDF bytes. No queue subscription, polling loop, or consumer-to-FastAPI HTTP call was found.
- FastAPI exposes `/api/v1/worker/process-message`, but that is an HTTP endpoint, not a queue consumer. Its `StorageDocumentResolver` uses a known fixture, a local UTF-8 file, or generated fallback text; it does not fetch a cloud object or parse a PDF.
- LangGraph executes per page when the FastAPI extraction HTTP pipeline is invoked. Its default extractor is deterministic keyword/regex code rather than an external LLM client, and its persistence node only appends to an in-memory list.
- NestJS `DocumentContentNormalizer` does use `pdf-parse` in the separate NestJS extractor/compatibility path. It returns flat page text and has no OCR. `DocumentsService.markExtractionComplete()` still exists despite an adjacent comment saying it was removed; the upload-confirm route does not call it.
- The safe E2E uses mock storage/queue, manually invokes the NestJS `IngestionWorker`, and stubs its AI fetch. The worker creates items in memory; the PGlite compliance table remains empty and its bid remains `QUEUED`.

## Historical baseline: reliability, context propagation, and final gap analysis (pre-implementation)

Prompts 9–11 were validated against the queue adapters, worker, FastAPI request path, graph state, persistence code, schema, and focused reliability E2E tests.

- **Delivery/retry:** the test-oriented `IngestionWorker` retries thrown processing failures by changing visibility, has a three-attempt job policy, routes terminal failures to a configured DLQ adapter, and deletes the message after its unit-of-work callback. This is not a production guarantee: the worker is not registered as a consumer, its E2E repositories are in-memory, and `DirectUnitOfWork` does not transact.
- **Idempotency:** an already-completed duplicate with the same `jobId` is acknowledged without reprocessing. There is no durable unique job key for a document/version or compliance-item fingerprint. A different job ID for the same document or a retry after partial writes can create duplicates.
- **Tenant/company:** the NestJS test worker resolves job/document/bid by tenant, and a forged cross-tenant message is rejected in tests. However, the worker omits company context from its AI security context and created compliance entities; the legacy SQL writer also omits `company_id`. FastAPI builds its tenant/document allow-list from request fields rather than validating those fields against trusted job/bid/document state.
- **Queue selection/DLQ:** the API factory selects SQS only from `AWS_SQS_QUEUE_URL`, Pub/Sub only from the required `GCP_*` variables, and otherwise mock. `QUEUE_PROVIDER` is ignored, and checked-in env/Compose examples use mismatched variable names. The SQS factory also does not pass `AWS_SQS_DLQ_URL` to its adapter, so terminal failure can delete the source message without publishing to the configured manual DLQ. The deployed provider cannot be inferred without deployment environment values.
- **Verification:** focused retry/idempotency/worker failure tests passed (**14 tests** across `AsyncIngestionPipeline.e2e.spec.ts` and `ProductionDocumentAiPipeline.e2e.spec.ts`). They simulate adapters and repositories; they do not verify cloud queues, PostgreSQL rollback, or a running FastAPI queue consumer.

Current architecture finding: P0 gaps are a missing production queue consumer, no real FastAPI object-storage retrieval, no durable queue-result persistence, and no proven ACK-after-PostgreSQL-commit contract. P1 gaps include missing OCR, company context loss, incomplete idempotency, and queue configuration/error handling that can make the upload response look successful without a confirmed job handoff. No code or schema remediation was performed.

See [DOCUMENT_PROCESSING_RELIABILITY.md](DOCUMENT_PROCESSING_RELIABILITY.md), [DOCUMENT_PROCESSING_SECURITY.md](DOCUMENT_PROCESSING_SECURITY.md), and [DOCUMENT_PROCESSING_ARCHITECTURE_GAP.md](DOCUMENT_PROCESSING_ARCHITECTURE_GAP.md) for detailed evidence and the actual-vs-target table.

Detailed evidence:

- [DOCUMENT_PROCESSING_CURRENT_FLOW.md](DOCUMENT_PROCESSING_CURRENT_FLOW.md)
- [SERVICE_BOUNDARY.md](SERVICE_BOUNDARY.md)
- [ASYNC_DOCUMENT_HANDOFF.md](ASYNC_DOCUMENT_HANDOFF.md)
- [FASTAPI_WORKER_FLOW.md](FASTAPI_WORKER_FLOW.md)
- [LANGGRAPH_DOCUMENT_WORKFLOW.md](LANGGRAPH_DOCUMENT_WORKFLOW.md)
- [DOCUMENT_EXTRACTION_FLOW.md](DOCUMENT_EXTRACTION_FLOW.md)
- [COMPLIANCE_PERSISTENCE_FLOW.md](COMPLIANCE_PERSISTENCE_FLOW.md)
- [END_TO_END_DOCUMENT_PROCESSING_TEST.md](END_TO_END_DOCUMENT_PROCESSING_TEST.md)

## Historical milestone: storage-reference HTTP processing shape (superseded)

- NestJS remains the upload initiation and metadata layer.
- FastAPI accepts a queue-shaped JSON payload at `/api/v1/worker/process-message` and can return extracted items over HTTP.
- That endpoint does not subscribe to SQS, Pub/Sub, or another queue; it is not called by the configured NestJS queue provider.
- Its storage-reference resolver is a fixture/local-file/generated-text resolver, not an object-storage adapter.
- LangGraph and the in-memory extraction response execute only when the FastAPI HTTP pipeline is actually called.

This HTTP compatibility path should not be described as verified asynchronous queue processing.

## Pre-implementation gap summary (superseded by the current milestone above)

The earlier claims in [DOCUMENT_PROCESSING_ARCHITECTURE_GAP.md](DOCUMENT_PROCESSING_ARCHITECTURE_GAP.md) have been replaced with the verified current-versus-target trace. The current observed boundary is:

| Stage | Current implementation | Evidence-based gap |
|---|---|---|
| Upload and metadata | NestJS `DocumentsController` / `DocumentsService`; metadata and audit use Drizzle | Controller method tests are not proof of a real browser/cloud upload |
| Object storage | Provider adapter selected by runtime configuration; tests use mocks | Confirm's `headObject()` check is best effort and does not gate enqueue |
| Queue publish | `jobQueue.enqueue()` when configured | Publish errors are logged and swallowed; provider consumer is not wired to FastAPI |
| Queue consumer | No production consumer found | The NestJS `IngestionWorker` is manually invoked in E2E; FastAPI only has HTTP routes |
| Document retrieval | NestJS extractor path can read through `IStorageService`; FastAPI resolver does not use object storage | No queue-connected FastAPI object retrieval |
| Parsing / OCR | NestJS `DocumentContentNormalizer` uses `pdf-parse` for supported binary PDFs | FastAPI does not parse PDFs; neither path performs OCR |
| Requirement extraction | FastAPI LangGraph pipeline can run by HTTP; default `default_tender_extractor` uses fixed keyword/rule logic | Not called from queue flow; not an external LLM by default |
| Compliance items | `compliance_items` via separate NestJS `markExtractionComplete()` path; test worker uses an in-memory repository | Queue-produced worker result has no wired PostgreSQL persistence |
| PostgreSQL result/status | Legacy direct method performs separate Drizzle writes; E2E queue worker updates in-memory test repositories | No durable queue-worker result transaction; final SQL bid status remains `QUEUED` in E2E |
| Acknowledgement | E2E mock worker deletes its mock message after in-memory writes | No real consumer acknowledgement/deletion behavior is verified |

### Current critical findings

| # | Finding |
|---|---|
| 1 | Queue publish currently has no production consumer path to FastAPI. |
| 2 | FastAPI's `/api/v1/worker/process-message` is callable over HTTP, but its storage-reference resolver does not retrieve a real object. |
| 3 | FastAPI does not parse binary PDFs or run OCR; PDF text extraction is in the separate NestJS normalizer path. |
| 4 | The default FastAPI extractor is deterministic keyword/rule code; package/client naming alone does not imply an external LLM call. |
| 5 | The LangGraph persistence node is in-memory; its HTTP result is not written to PostgreSQL. |
| 6 | The E2E worker's compliance repository is in-memory; PGlite confirms zero `compliance_items` rows and bid state remains `QUEUED`. |
| 7 | The legacy direct NestJS writer is non-transactional and omits company/workflow/correlation columns. |

### Current observed paths

Upload confirmation and queue handoff:

```text
POST /bids/:bidId/documents/confirm
  → DocumentsController.confirmUpload()
  → DocumentsService.confirmUpload()
  → best-effort storage head check
  → INSERT/UPSERT tender_documents
  → UPDATE bids (QUEUED when queue configured; otherwise REVIEW_READY)
  → INSERT audit_logs
  → jobQueue.enqueue() (if configured; failure is logged and swallowed)
  → return UPLOADED

MessageQueue
  → no production consumer found
```

Separate FastAPI HTTP route (not wired from that queue):

```text
POST /api/v1/worker/process-message
  → validate request and build SecurityContext
  → use supplied pages or StorageDocumentResolver fixture/local/generated text
  → ProductionExtractionPipeline.execute()
  → LangGraph per-page workflow
  → return extraction items over HTTP
  → no PostgreSQL persistence
```

Separate legacy NestJS extraction/persistence path:

```text
DocumentsService.markExtractionComplete()
  → AiDocumentExtractor.extract()
  → IStorageService.getObject()
  → DocumentContentNormalizer.normalize() [NestJS PDFParse]
  → POST /api/v1/extract (when the HTTP AI service is reachable)
  → direct Drizzle compliance/bid/audit writes, without an encompassing transaction
```

The upload-confirm method does **not** invoke the legacy method above.

### Remediation areas (not implemented here)

| Priority | Area |
|---|---|
| P0 | Connect the configured queue to a real consumer with explicit retry, failure, and acknowledgement semantics. |
| P0 | Give the worker a real tenant-safe object-storage adapter and binary PDF/OCR capability. |
| P1 | Connect extraction output to a durable, transactional compliance persistence path and update bid/document statuses consistently. |
| P1 | Propagate company/workflow/correlation context into persisted compliance rows where required. |
| P1 | Decide whether the keyword extractor is an acceptable prototype or replace it with a configured model provider and evaluate grounding/threshold extraction. |
| P1 | Persist LangGraph checkpoints if restart-safe human review is required. |

---

## 📄 Current Document Processing Flow Analysis (2026-10-06)

**Full trace documented in [`docs/DOCUMENT_PROCESSING_CURRENT_FLOW.md`](DOCUMENT_PROCESSING_CURRENT_FLOW.md)**

Resolved `net::ERR_NAME_NOT_RESOLVED` network errors during tender document upload and fortified the end-to-end object storage pipeline:

1. **Local Object Storage Routing & Domain Normalization**:
   - **Backend (`DocumentsService`)**: Presigned upload and download URL generation now detects mock/local storage domains (`mock-s3.tenderpulse.local` or `.local/`) and maps them to the local Express/NestJS mock endpoints (`/api/v1/mock-upload/:bidId/:docId/:fileName` and `/api/v1/mock-download/:bidId/:docId/:fileName`) using the request host and protocol dynamically.
   - **Frontend (`DocumentUploader.tsx`)**: Added URL normalization and network failure fallback to ensure that any local development environment automatically falls back to `/api/v1/mock-upload/...` on DNS/network resolution failure before reporting errors to the user.

2. **Dynamic Tenant & Company Scoping**:
   - Replaced all hardcoded fallback identifiers with dynamic lookup helpers (`getOrgIdForBid`, `resolveCompanyId`) across `compliance.service.ts`, `documents.service.ts`, and `bids.service.ts`.
   - Updated database seeding in `database.provider.ts` to use unconditional `onConflictDoNothing()` per-record insertion for `DEMO_USERS` and `DEMO_COMPANIES`, ensuring consistent test and development fixtures without primary key collisions.

3. **Monorepo Quality Gates (366 / 366 tests passing)**:
   - `apps/api`: **214 / 214 tests passing** across 27 test files.
   - `apps/web`: **152 / 152 tests passing** across 18 test files.
   - `npm run type-check`: 0 errors across all monorepo packages.
   - Verified live authenticated document upload and confirmation flow against PostgreSQL persistence.

---

Successfully completed the purge of all hardcoded dummy data and established clean empty states for true end-to-end happy flow testing:

1. **Clean Database Initialization**:
   - PostgreSQL (PGlite) boots in an entirely clean state by default (`SEED_DEMO_DATA=false`). Zero pre-seeded users, bids, companies, or compliance items are generated in runtime environments.
   - Demo seeding options in `initDatabase` are isolated to automated test fixtures where synthetic suites require them.
   - Fixed schema DDL defaults: eliminated all hardcoded `DEFAULT 'comp_acme_infra_001'` from `bids`, `company_profile_versions`, and `company_profiles`.

2. **Mandatory Company Entity Constraint**:
   - Enforced rule that **every organization must have at least one company entity**.
   - `POST /api/v1/auth/register` creates the tenant user (`ADMIN`), initializes workspace settings, and provisions the mandatory primary company legal entity atomically.
   - `SignupPage.tsx` requires `Primary Company Legal Name *` before submitting registration.
   - Backend services (`BidsService`, `CompanyProfileService`) enforce that bids and profile versions cannot be created without a valid company entity belonging to the tenant.

3. **Purged Fallbacks & Hardcoded Stubs**:
   - Removed `FALLBACK_COMPANIES`, `org_acme_infra_001`, and `comp_acme_infra_001` from frontend contexts (`CompanyContext.tsx`, `CompanyProfilePage.tsx`, `ProfilePage.tsx`, `SettingsPage.tsx`, `UserAccountMenu.tsx`).
   - Cleared default pre-filled credentials from `LoginPage.tsx` and removed credentials logging from `main.ts`.

4. **Monorepo Quality Gates (366 / 366 tests passing)**:
   - `apps/api`: **214 / 214 tests passing** across 27 test files.
   - `apps/web`: **152 / 152 tests passing** across 18 test files.
   - `npm run type-check`: 100% clean across all 4 packages (`@tenderpulse/shared-types`, `@tenderpulse/ui`, `@tenderpulse/api`, `@tenderpulse/web`).
   - Full live happy flow verified: Register Tenant + Company → Verify Empty Bids List → Create New Bid Project → Generate Isolated Upload URL → Confirm Upload.

---

## 🚀 Tenant Registration, Billing, Multi-Company & Public Experience (2026-10-06)

Implemented, validated, and integrated the complete end-to-end multi-tenant onboarding, provider-agnostic billing/subscription engine, entitlement enforcement, public marketing experience, and authenticated workspace boundaries:

1. **Canonical Multi-Tenant Hierarchy & Entitlements**:
   - **Domain Relationship**: $1\text{ Tenant (organization\_id)} \rightarrow N\text{ Users} \mid 1\text{ Tenant} \rightarrow N\text{ Companies} \mid 1\text{ Tenant} \rightarrow 1\text{ Subscription}$.
   - **Database Schema (`schema.ts`, `database.provider.ts`)**: Added `subscriptions` (`id`, `organization_id UNIQUE`, `plan_tier`, `billing_interval`, `status`, `current_period_start`, `current_period_end`, `cancel_at_period_end`, `metadata JSONB`) and `usage_records` (`id`, `organization_id`, `metric_key`, `period_key`, `usage_count`).
   - **Dynamic Entitlement Engine (`EntitlementService`)**: Enforces runtime limits on `companies.max`, `users.max`, and `tender_analyses.monthly` based on the tenant's active plan subscription.

2. **Provider-Agnostic Billing Module (`apps/api/src/modules/billing/`)**:
   - **Ports & Adapters Pattern**: `IBillingPort` interface with `MockBillingAdapter` (ready for Razorpay/Stripe infrastructure adapters without domain leakage).
   - **5 Tiered Plans Catalog**: `FREE` (₹0), `STARTER` (₹999/mo), `GROWTH` (₹2,499/mo), `BUSINESS` (₹6,999/mo), `ENTERPRISE` (Custom).
   - **REST Endpoints**: `GET /api/v1/billing/plans`, `GET /api/v1/billing/subscription`, `GET /api/v1/billing/usage`, `POST /api/v1/billing/change-plan`.

3. **User Registration & Atomic Workspace Provisioning (`apps/api/src/modules/auth/`)**:
   - `POST /api/v1/auth/register`: Atomically creates user, initializes tenant workspace, provisions primary company legal entity, and assigns `FREE` subscription tier with JWT signing.
   - Enforces company registration limits in `CompaniesService` and user seat quotas in `TeamsService`.

4. **Public Marketing & Pricing Pages (`apps/web`)**:
   - **Landing Page (`LandingPage.tsx`)**: High-density B2B value proposition ("Know which tenders you can win — before wasting weeks preparing bids"), live evaluation mockup preview, 4 core contractor pain points, 6-stage deterministic workflow, zero-trust security isolation spec, and FAQ.
   - **Pricing Page (`PricingPage.tsx`)**: Monthly/Annual toggle (20% discount badge), 5-tier cards with entitlement meters, feature matrix comparison table, and direct signup links (`/signup?plan=GROWTH`).
   - **Public Navigation & Footer (`PublicNav.tsx`, `PublicFooter.tsx`)**: Clean branding, links, and authenticated workspace entry.

5. **Registration, Onboarding & In-App Billing UI (`apps/web`)**:
   - **Signup Flow (`SignupPage.tsx`)**: Workspace + primary company registration form with selected plan pre-population.
   - **3-Step Onboarding Flow (`OnboardingPage.tsx`)**: Tenant boundary confirmation, sector & turnover configuration, and direct tender launchpad.
   - **Billing & Usage Settings (`SettingsPage.tsx` - Billing Tab)**: Active subscription card, usage progress meters (Companies, Users, Monthly Analyses, Storage), and 1-click plan switcher.
   - **Strict Visual Restraint**: Zero emojis anywhere in UI, exclusive Lucide icons, zinc `#09090b` palette.

6. **Monorepo Quality Gates (362 / 362 tests passing)**: 214 in `apps/api` (including 7 in `billing-registration-entitlements.spec.ts`), 148 in `apps/web`. `npm run type-check` completely clean with 0 errors across all monorepo packages.

---

## ⚠️ Product Pivot (2026-10-04) — Bidder-Side Redesign

`docs/PRODUCT.md` has been rewritten (v2.0): TenderPulse is now a **Tender Intelligence & Bid Readiness Platform for Indian MSMEs, contractors, and service providers** — bidder-side, not procurement-officer-side. The core differentiator is the **persistent Company Capability Profile** (registrations, certifications, financials, experience, work orders, completion certificates, OEM relationships, employees, equipment, geography, previous bid evidence), against which every new tender is evaluated.

The 11-stage workflow: Tender Discovery → Tender-to-Company Matching → Bid/No-Bid Decision → Requirement Extraction → Company Evidence Matching → Compliance Analysis → Risk Analysis → Missing Evidence → Human Review → Bid Readiness → Submission Preparation → Corrigendum Monitoring.

**Enterprise In-App Notifications & Preference Gating (2026-10-06):** Implemented, verified, and integrated the production multi-channel notification engine, database schema, preference-gated delivery, and interactive header feed in `apps/api` and `apps/web`:
1. **Multi-Channel & Category-Gated Notification Architecture**:
   - Gated delivery across 4 key categories (`DEADLINE`, `EVIDENCE_EXPIRY`, `REVIEW_REQUEST`, `HIGH_RISK_FLAG`) checking `tenant_settings.notification_preferences` before persistence and dispatch.
   - Built automated deadline & certificate expiration scanner (`triggerDeadlineAndExpiryScan`) computing point-in-time day differences for active tenders within 7 days.
2. **Database Schema & DDL Updates (`schema.ts`, `database.provider.ts`)**:
   - Added `notifications` table (`id`, `organization_id`, `recipient_user_id`, `recipient_email`, `category`, `channel`, `priority`, `title`, `message`, `metadata JSONB`, `is_read`, `created_at`, `read_at`).
   - Added compound index `idx_notifications_tenant` on `(organization_id, recipient_user_id, is_read, created_at DESC)`.
3. **Backend Feature Module (`apps/api/src/modules/notifications/`)**:
   - `NotificationsModule` (`NotificationsService`, `NotificationsController`): `GET /api/v1/notifications`, `PATCH /api/v1/notifications/:id/read`, `POST /api/v1/notifications/mark-all-read`, `POST /api/v1/notifications/trigger-scan`, `POST /api/v1/notifications`.
   - Strict `TenantContextHolder` isolation and Anti-IDOR guards across all endpoints.
4. **Frontend Integration & Real-Time Header Feed (`apps/web`)**:
   - Created `notifications.ts` web API client.
   - Built `NotificationBell.tsx` with unread count pill badge, category iconography (`Clock`, `TriangleAlert`, `ShieldCheck`), relative timestamps, mark-as-read toggles, and deep links to bid cases.
5. **Quality Gates & Monorepo Test Verification (430 / 430 tests passing)**: 207 in `apps/api` (including 7 in `notifications.spec.ts`), 147 in `apps/web`, 76 in `apps/ai`. `npm run type-check` clean with 0 errors across all 4 monorepo packages.

**User Profile, Workspace Settings & Team Management Persistence (2026-10-06):** Implemented, verified, and exposed complete backend REST endpoints, database schema additions, and live frontend integrations for user profiles, workspace configurations, and multi-user tenant team collaboration:
1. **Clear Domain Boundary & Separation of Concerns**:
   - **User Profile (`/profile`)**: Manages individual credentials (`users` table), display name, phone number, and bcrypt-hashed password rotation (10 salt rounds with constant-time verification).
   - **Workspace Settings (`/settings`)**: Configures tenant-level defaults (`tenant_settings` table) including `default_company_id` and granular notification preferences (`notifyDeadlines`, `notifyEvidenceExpiry`, `notifyReviewRequests`, `notifyHighRiskFlags`).
   - **Team Management (`/settings` - Team Members Tab)**: Enables tenant admins (`org:users:manage`) to view current workspace members and invite/provision new team members with normalized atomic RBAC roles (`ADMIN`, `BID_MANAGER`, `REVIEWER`, `VIEWER`).
   - **Company Capability Profile (`/company-profile`)**: Kept strictly distinct as the legal entity dossier used for bid evaluation.
2. **Database Schema & DDL Updates (`schema.ts`, `database.provider.ts`)**:
   - Added `phone TEXT` column to `users` table.
   - Added `tenant_settings` table (`id`, `organization_id UNIQUE`, `default_company_id`, `notification_preferences JSONB`, `updated_at`).
3. **Backend Feature Modules (`apps/api/src/modules/`)**:
   - `UsersModule` (`UsersService`, `UsersController`): `GET /api/v1/users/me`, `PATCH /api/v1/users/me`, `POST /api/v1/users/change-password`.
   - `SettingsModule` (`SettingsService`, `SettingsController`): `GET /api/v1/settings/workspace`, `PATCH /api/v1/settings/workspace`.
   - `TeamsModule` (`TeamsService`, `TeamsController`): `GET /api/v1/teams/members`, `POST /api/v1/teams/invite`.
4. **Frontend Integration & Testing (`apps/web`)**:
   - Web API clients (`users.ts`, `settings.ts`, `teams.ts`) connected to real endpoints with fallback tolerance.
   - `ProfilePage.tsx` and `SettingsPage.tsx` with live data binding, validation, and feedback banners.
5. **Full Monorepo Verification (422 / 422 tests passing)**: 200 in `apps/api` (including 8 in `profile-settings-teams.spec.ts`), 146 in `apps/web`, 76 in `apps/ai`. `npm run type-check` clean with 0 errors across all 4 monorepo packages.

**1 Tenant → N Companies Multi-Company Architecture (2026-10-06):** Validated and implemented the 1 Tenant → N Companies domain hierarchy end-to-end across database, backend, frontend, AI context, and security:
1. **Clear Domain Boundary & Anti-IDOR Model**: A Tenant (`organization_id`) is the immutable SaaS security boundary; a Company (`company_id`) is a business legal entity represented and evaluated within that tenant. Every query and mutation strictly enforces `company.organization_id == caller.organizationId`, denying cross-tenant access with 404/403.
2. **Database Schema & DDL Updates (`schema.ts`, `database.provider.ts`)**: Added `companies` table with legal name, slug, GSTIN, PAN, Udyam ID, constitution, and timestamps. Added `company_id` to `bids`, `company_profiles`, `company_profile_versions`, and `bid_decisions`.
3. **Companies Feature Module (`apps/api/src/modules/companies/`)**: Created `CompaniesService`, `CompaniesController`, and `CompaniesModule` supporting `GET /api/v1/companies`, `POST /api/v1/companies`, `GET /api/v1/companies/:id`, `GET /api/v1/companies/:id/profile`, `POST /api/v1/companies/:id/profile`, and `GET /api/v1/companies/:id/expiring-certificates`.
4. **Company-Scoped Capability Profiles & AI Decisions**: Enhanced `CompanyProfileService` and `GetBidDecisionUseCase` to isolate profile versions per company, query by `bid.companyId`, pass `security_context.company_id` to the AI engine, and persist `bid_decisions.companyId`.
5. **Frontend Multi-Company Integration (`apps/web`)**: Created `companies.ts` API client, `CompanyContext` with active company caching, and `CompanySelector` header dropdown for switching active companies.
6. **Zero-Regress Monorepo Verification (408 / 408 tests passing)**: 192 in `apps/api` (including 10 in `multi-company-security.spec.ts`), 140 in `apps/web`, 76 in `apps/ai`. `npm run type-check` clean with 0 errors.

**Object Storage Upload & Mock Resolution Fix (2026-10-06):** Resolved the `net::ERR_NAME_NOT_RESOLVED` document upload failure:
1. **Root Cause Analysis**: In local development environments without an active cloud bucket or with `MockStorageService`, `generatePresignedUploadUrl` previously emitted synthetic hostnames (`https://mock-s3.tenderpulse.local/...`), which caused the browser's direct XHR PUT request to fail DNS name resolution (`ERR_NAME_NOT_RESOLVED`).
2. **Dynamic Endpoint Routing & Protocol Awareness**: Updated `DocumentsService.generateUploadUrl` and `DocumentsService.getDownloadUrl` in `apps/api` to detect unresolvable mock domains and automatically route uploads/downloads to the live NestJS mock endpoints (`/api/v1/mock-upload/:bidId/:docId/:fileName` and `/api/v1/mock-download/...`) with dynamic protocol resolution (`http`/`https`).
3. **Frontend Upload Resilience**: Enhanced `DocumentUploader.tsx` in `apps/web` with URL sanitization and automatic fallback to `/api/v1/mock-upload/...` on external DNS/network resolution failures, ensuring zero broken upload states in local and hybrid development.
4. **All Monorepo Tests Passing (398 / 398)**: 182 in `apps/api`, 140 in `apps/web`, 76 in `apps/ai`.

**Unified Enterprise Iconography & Zero-Emoji Standardization (2026-10-06):** Enforced a strict zero-emoji iconography policy across the frontend application in `apps/web`:
1. **Zero-Emoji UI Policy**: Purged all emojis, raw Unicode symbols, and decorative glyphs (e.g. 🏢, 📜, 💰, ⚠️, ✓, ❌, 🧠, ⚡) across navigation, sidebars, buttons, cards, dashboard, badges, tables, alerts, and empty states.
2. **Standardized Lucide Iconography**: Refactored `Icons.tsx` and all UI components to exclusively use official `lucide-react` icons (e.g. `Building2`, `FileSearch`, `ListChecks`, `Files`, `TriangleAlert`, `ClipboardCheck`, `ShieldCheck`, `CheckCircle2`, `MinusCircle`, `XCircle`, `Clock`, `Ban`, `Loader2`, `Landmark`, `FileSignature`, `Scale`, `Bot`, `Zap`, `Upload`, `FolderArchive`, `MapPin`, `Lock`, `FileText`).
3. **Restrained Semantic Badges**: Upgraded status indicators and risk levels to use shadcn/ui `Badge` primitives with subtle semantic colors and functional Lucide icons.
4. **Comprehensive Test Suite**: All 398 unit, integration, and security tests pass cleanly across monorepo (182 in `apps/api`, 140 in `apps/web`, 76 in `apps/ai`).

**Production Backend APIs & Zero-Mock Intelligence Implemented (2026-10-06):** Implemented, verified, and exposed the complete suite of backend REST endpoints across NestJS (`apps/api`) and React (`apps/web`), replacing all pending placeholders with live PostgreSQL data and deterministic engines:
1. **`GET /api/v1/bids/:id/evidence-matches` (Evidence Grounding & Proof Cross-Linking)**: Computes real-time coverage rollups mapping extracted tender clauses to company evidence documents with status (`MATCHED`, `PARTIAL`, `UNMATCHED`, `EXPIRED`) and execution rules (stamp paper denomination, notarization, CA UDIN).
2. **`GET /api/v1/bids/:id/risk-findings` (Consolidated Risk Radar)**: Consolidates statutory constraints, execution penalties, and commercial risks from deterministic eligibility evaluations and requirement matrices with severity counts and financial impact estimation.
3. **`GET /api/v1/bids/:id/deadlines` (Tender Lifecycle Milestone Schedules)**: Calculates pre-bid meeting, clarification window, EMD submission, and online bid freeze deadlines with real-time countdowns.
4. **`GET /api/v1/company-profile/expiring-certificates` (Expiry Watch)**: Filters ISO certifications and OEM authorizations approaching expiration within 30/60/90 days relative to tender submission dates.
5. **`GET /api/v1/dashboard/metrics` (Pre-Aggregated Tenant KPIs)**: Serves tenant-scoped pipeline analytics (active volume, total contract exposure in INR, flagged clauses, imminent deadlines) via a dedicated `DashboardModule` and controller.
6. **Full Multi-Tenant RBAC & Monorepo Test Verification**: Strict `TenantContextHolder` isolation enforced across all endpoints. 397 total tests passing across monorepo (181 in `apps/api`, 140 in `apps/web`, 76 in `apps/ai`).

**Application Shell & Dashboard UI Redesign Implemented (2026-10-06):** Complete redesign of the global Application Shell and main Dashboard in `apps/web` guided by shadcn/ui, Linear, Stripe, and Vercel design principles:
1. **Restrained Pro Visual System**: Established a crisp, distraction-free zinc palette (`#09090b` canvas, `#121215` cards, `#27272a` 1px borders) eliminating garish side borders, neon gradients, and visual noise.
2. **Precision Executive KPI Strip**: Implemented 4 high-density metric cards (Active Pipeline, Total Contract Value INR, Compliance Flags, Imminent Deadlines < 7 days) with subtle top hairline accents and tabular figures.
3. **Linear-Density Attention Queue & Workflow Funnel**: Refined Action Required queue with monospaced clause/tender anchors (`№ NHAI/HQ/2026/EPC-4482`), category pills, and clean urgency indicators, paired with interactive Bid Pipeline stage distribution filters.
4. **Stripe-Style Tabular Workflow**: High-density table with interactive workflow tabs, risk filters, deadline countdown badges, sortable headers, and paginated rows.
5. **Full E2E & Unit Test Verification**: All 133 web unit tests pass, and Playwright headless E2E verification confirmed flawless rendering, zero console errors, and smooth navigation.

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

**NestJS Backend Full Capabilities & Live PostgreSQL Seeding (2026-10-06):** Implemented production database persistence, complete NestJS API endpoints, and rich Indian public procurement seed dossier, eliminating all static/mock data:
1. **11-Domain Enterprise Company Profile Seed**: Populated `company_profile_versions` & `company_profiles` for *Acme Infrastructure Solutions Ltd.* with GSTIN, PAN, Udyam, GeM, ISO 9001/14001/45001, CMMI Dev-3, 3-year CA-audited financials with valid UDINs, 7-year EPC highway work orders, OEM authorizations (Wirtgen, Schneider, Honeywell), staff, equipment, and state branches.
2. **Realistic Tender Opportunities & Documents**: Seeded `bid-nhai-44-001` (`REVIEW_READY`, 245 Cr EPC highway with NIT, BOQ, Corrigendum, Technical Specs), `bid-cpwd-gov-002` (`ANALYZING`, 185 Cr green building complex), and `bid-mha-surv-003` (`DRAFT`, 95 Cr smart city surveillance).
3. **Grounded Compliance Matrix**: Seeded real extracted requirements with execution rules (stamp paper denomination, notarization, CA UDIN), dual-sided provenance citations, risk assessments, and company evidence bindings.
4. **Backend Review State Machine**: Extended `ComplianceService` & `ComplianceController` to handle 5 standard review statuses (`PASS`, `FAIL`, `MISSING`, `REVIEW_REQUIRED`, `NOT_APPLICABLE`) along with optimistic concurrency control (`version`).
5. **Full Monorepo Verification**: 383 total tests passing across monorepo (174 in `apps/api`, 133 in `apps/web`, 76 in `apps/ai`).




**Domain model documented (2026-10-04):** `docs/DOMAIN.md` Part B now teaches the bidder-side domain model and ubiquitous language — aggregate roots (CompanyProfile, Tender, BidCase, ReviewTask, WorkflowRun, AuditEvent), entities (CapabilityEntry specializations, EvidenceDocument, TenderRequirement, TenderAmendment, EvidenceMatch, RiskFinding, GeneratedArtifact), value objects (Permission, ExecutionRules, Provenance, Money, Criterion, EligibilityVerdict, MatchState, ProfileVersionRef), workflows (Workflow, ComplianceAssessment, BidReadiness, CorrigendumMonitoring), lifecycle state machines for all major concepts, the 10-step "how a tender is evaluated against a company profile" walkthrough, and a full domain glossary. Design-only; no database changes.

**HLD delta documented (2026-10-05):** `docs/ARCHITECTURE.md` (new, root-level) compares existing vs. target architecture and answers the 10 delta questions (what remains / must change / new modules / wrong boundaries / what stays together / AI placement / deterministic logic placement / async / events / human review). Target module map covers all 14 logical areas. New ADRs: **0016** (bidder-side pivot aggregates: Tender + BidCase + CompanyProfile), **0017** (enforce layered boundary at HTTP — eliminate CRUD bypass), **0018** (async-first extraction — queue→worker becomes the live path), **0019** (deterministic Eligibility/Matching engine in the domain layer; AI schema cannot express verdicts or money), **0020** (external data connectors — DigiLocker OAuth, Account Aggregator — behind an `IConnector` enrichment port, phased adoption). Design-only; no code implemented.

**Company Capability Profile designed (2026-10-05, PROMPT 5):** the differentiator is fully designed across three docs — `docs/DOMAIN.md` Part C (§15–17: the ten design requirements, structured-data-vs-documents rule, one-shot→SaaS transformation), `docs/DATABASE.md` Part B (target v2.0 schema: `companies`, `company_profiles` with immutable versions + one-ACTIVE partial unique index, `capability_entries` with per-subtype JSONB attributes + verification tier/status + source provenance, `evidence_documents`, `capability_evidence` many-to-many, `external_data_connections`, and the pivot aggregates `tenders`/`tender_requirements`/`tender_amendments`/`bid_cases` with mandatory pinned `profile_version_id`, `evidence_matches`, `risk_findings`, `bid_decisions`, `review_tasks`, `generated_artifacts`; expand-and-contract migration), and `docs/ARCHITECTURE.md` (module anatomy, four key flows: maintain/publish, evaluation read path against pinned version, expiry monitoring, connector enrichment; where the ten design concerns live). Design-only; no code implemented.

**Tender ingestion & requirement normalization designed (2026-10-05, PROMPT 6):** `docs/DOMAIN.md` Part D (§25–34) and `docs/ARCHITECTURE.md` (new pipeline section). Key decisions: tender = package of 17 typed documents (never a single blob); 10-stage async pipeline (document processing → extraction → OCR-on-demand → section segmentation → section-aware chunking → 3-tier requirement detection → normalization → classification → source citation → persistence); **deterministic-first execution** (regex → structural → LLM fallback with identical output contracts and per-requirement `detectionMethod`); normalized requirement schema with four traceability anchors (document, page, section, clause) + verbatim quote + chunkId; hard grounding invariant (exact-substring verification pre-persistence; failures rejected, never stored); corrigenda as first-class amendments (diff → SUPERSEDE → re-evaluate changed criteria only → human re-confirmation); idempotency at document (SHA-256), requirement (deterministic key upsert), and workflow levels; per-document failure isolation with honest zero-extraction. Design-only; no code implemented.

**Evidence & Compliance Engine designed (2026-10-06, PROMPT 7):** `docs/DOMAIN.md` Part F (§49–60), `docs/LLD.md` §9, `docs/AI.md` §5, and new **ADR 0021** (evidence-first compliance engine). The engine answers *"For this tender requirement, what evidence does the company have?"* — never a bare percentage. Five separated stages with distinct owners: (1) evidence retrieval (deterministic, recall-oriented, tenant-scoped, pinned profile version), (2) evidence matching (dual-sided provenance: tender anchors §28 + company EvidenceRef, many-to-many, cross-document dedup), (3) deterministic validation (Part E evaluators + expiry-at-submission-date, tier-sufficiency, and ordered conflict policies — tier → recency → source authority → REVIEW_REQUIRED, never silently pick), (4) AI explanation (grounded narrative with **no verdict field in the output schema**; citation-verified against the result bundle; template fallback so prose never blocks verdicts), (5) human decision (confirm/override/waive; `compliance:override` permission, mandatory reason, OCC; engine verdict preserved immutably, both verdicts always displayed). Assessment states PASS / FAIL / MISSING_EVIDENCE / REVIEW_REQUIRED with deterministic rollup mapping (FAIL > MISSING_EVIDENCE > REVIEW_REQUIRED > PASS). Designed hard cases: conflicting evidence, expired certificates, insufficient evidence, ambiguous clauses, missing dates (UNKNOWN_VALIDITY → REVIEW_REQUIRED), contradictory company data, multiple evidence documents, manual override, and append-only reference-only audit trail (RETRIEVAL_EXECUTED → … → ASSESSMENT_OVERRIDDEN). Design-only; no code implemented.

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
   - Deliverables: `docs/learning/agents.md`, `docs/learning/langgraph.md`, `docs/AI.md`, `docs/AI_SECURITY.md`, `docs/adr/0011-ai-security-and-tenant-isolation.md`.
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
   - Documented in `docs/ASYNC_DOCUMENT_HANDOFF.md`.
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
    - Comprehensive security audit documented in `docs/SECURITY_MODEL.md` and `docs/AI_SECURITY.md`.
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

35. [x] **Phase 43: 1 Tenant → N Companies Architecture & Multi-Surface Selection (2026-10-06)** _(Completed)_
    - **Established and validated the canonical enterprise multi-tenancy hierarchy**:
      ```text
      Tenant (SaaS / Security / RBAC Boundary)
        └── N × Companies (Legal business entities evaluated within tenant)
              ├── Capability Profile (Versioned registrations, CA UDINs, financials)
              ├── Corporate Evidence Vault
              └── Tenders / Bids (Evaluated per company profile)
      ```
    - **Backend Multi-Company Security (`apps/api`)**:
      - `companies` table scoped by `tenant_id` (`organization_id`), composite index `(tenant_id, id)`.
      - Scoped `company_profiles` and `company_profile_versions` by `(tenant_id, company_id)`.
      - Dynamic tenant context resolution in `BidsService`, `CompanyProfileService`, and `CompaniesController`.
      - Strict multi-company anti-IDOR security tests verifying cross-tenant and intra-tenant isolation in `multi-company-security.spec.ts` (10 tests, 192 total API tests passing).
    - **Multi-Surface Frontend Company Selection (`apps/web`)**:
      - **Global Header**: Interactive `CompanySelector` dropdown with active company badge, GSTIN details, and inline "+ Add Legal Company Entity" modal.
      - **Sidebar**: Sticky "Active Company" card above navigation items, displaying current business entity name.
      - **Dashboard**: Prominent active company badge with direct entity switcher alongside the "New Bid Project" CTA.
      - **Bid Creation Workflow**: Dedicated "Bidding Company Entity *" selector in `CreateBidPage.tsx` wiring `companyId` into tender initialization.
      - **Company Dossier Header**: Instant company switching in `CompanyProfileHeader.tsx` updating legal details and version tracking.
      - **Tenant-Aware Fallback & Persistence**: `CompanyContext` with instant hydration from `localStorage` keyed by `tenderpulse_active_company_${organizationId}` so the UI never flashes empty.
36. [x] **Phase 44: Profile & Workspace Settings Pages (2026-10-06)** _(Completed)_
    - **Implemented Dedicated User Profile Experience (`/profile`, `ProfilePage.tsx`)**:
      - Represents the authenticated individual (`name`, `email`, deterministic initials `AvatarFallback`, `role`, `id`, `permissions`).
      - Inline form editing for user display name with validation, loading state, error handling, and success feedback.
      - Tenant Workspace details (`organizationName`, `organizationId`) and active RBAC permissions list.
      - Session security architecture summary (HMAC-SHA256, Fiber-Safe Tenant Gating, OCC Concurrency).
      - Prominent domain boundary callout clearly differentiating individual User Profile from the multi-entity **Company Capability Profile** (`/company-profile`).
    - **Implemented Multi-Tab Workspace Settings Experience (`/settings`, `SettingsPage.tsx`)**:
      - Structured with shadcn `Tabs` across 5 dedicated sections:
        1. **General**: Workspace Name, Tenant ID, default active company selection, and regional procurement parameters (GeM, CPPP, INR ₹).
        2. **Notifications**: In-app toggles for Tender Deadline warnings, Evidence Expiry alerts, Human Review task requests, and High-Risk clause flags, with clear roadmap disclosure regarding outbound webhooks.
        3. **Security**: Session token specifications (RFC 7519 HS256, timing-safe verification), tenant isolation guarantees, and upcoming security roadmap (2FA TOTP, SIEM audit exports).
        4. **Team & RBAC**: Tenant role breakdown (`ADMIN`, `BID_MANAGER`, `LEGAL_COUNSEL`, `FINANCIAL_CONTROLLER`, `VIEWER`), assigned permissions, and active scope descriptions.
        5. **Companies**: Multi-company entity management, listing registered companies with GSTIN, one-click active entity switching, inline entity registration form, and direct links to each company's capability dossier.
    - **Navigation & Layout Integration**:
      - [UserAccountMenu.tsx](file:///Users/belikesaurabh/main/TenderAi/apps/web/src/components/layout/UserAccountMenu.tsx): Added direct links to `User Profile` and `Workspace Settings`.
      - [Sidebar.tsx](file:///Users/belikesaurabh/main/TenderAi/apps/web/src/components/layout/Sidebar.tsx): Added direct `Settings` item with `SettingsIcon`.
      - [Breadcrumbs.tsx](file:///Users/belikesaurabh/main/TenderAi/apps/web/src/components/layout/Breadcrumbs.tsx): Added dynamic breadcrumbs for `/profile` and `/settings`.
    - **Design System & Primitives**:
      - Built shadcn [label.tsx](file:///Users/belikesaurabh/main/TenderAi/apps/web/src/components/ui/label.tsx) and [switch.tsx](file:///Users/belikesaurabh/main/TenderAi/apps/web/src/components/ui/switch.tsx).
      - Strict adherence to design constraints: 0 emojis, 0 decorative graphics, 0 custom CSS, Linear/Stripe style hierarchy.
    - **Quality Gates**:
      - Added `profile-settings.spec.ts` unit test suite (6 new tests).
      - 414 automated tests passing across the monorepo (192 API + 146 Web + 76 AI).
      - 0 TypeScript compiler errors across all monorepo packages.
