# Graph Report - TenderAi  (2026-10-05)

## Corpus Check
- 302 files · ~155,550 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 6, .example 1, .lock 1)

## Summary
- 2231 nodes · 4266 edges · 134 communities (108 shown, 26 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 365 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `16cb86ae`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- DomainException.ts
- BulkIngestComplianceUseCase.ts
- IngestionWorker.ts
- BidProject
- nodes.py
- IngestionJobMessage
- IngestionJob
- CandidateComplianceItem
- AI Security Architecture, Multi-Tenant Isolation, and Defense-in-Depth
- evaluator.py
- web/package.json
- ScopedRetrievalTool
- TenderDocument
- documents.service.ts
- react
- PostgresBidRepository.ts
- CoreBusinessWorkflowWithoutAi.e2e.spec.ts
- AWS Cloud Architecture & Infrastructure Blueprint: TenderPulse AI
- useAuth
- BidDetailPage.tsx
- api/compliance.ts
- AI Systems Architecture & First Principles: TenderPulse AI
- NotFoundError
- @nestjs/common
- AuditLog
- client.ts
- LangChain, LangGraph, and Stateful AI Workflows: First Principles
- pipeline.py
- AI Security, Multi-Tenant Isolation, and Threat Mitigation
- System Architecture: TenderPulse AI
- compilerOptions
- ValidationException
- ExecutionRulesProps
- test_compliance_workflow.py
- compliance.service.ts
- Database Design & PostgreSQL Data Architecture: TenderPulse AI
- Human-in-the-Loop (HITL) Architecture: Human Review, Authorization & State Machine Resumption
- DocumentsController
- AI Systems Engineering: From First Principles to Stateful Workflows
- bids.module.ts
- BidCard.tsx
- Low-Level Design (LLD): Tender Ingestion & Bid Compliance Management
- dependencies
- bids.service.ts
- Domain Knowledge: Indian Government Public Procurement
- api/package.json
- Comprehensive Security Review & Threat Assessment: TenderPulse AI
- Domain Events Architecture & Event Catalog: TenderPulse AI
- Minimum Viable Product (MVP) Specification: TenderPulse AI
- Multi-Tenant Security & RBAC Model: TenderPulse AI
- shared-types/package.json
- ui/package.json
- schema.ts
- api/tsconfig.json
- react-router-dom
- AuthService
- AI Evaluation, Groundedness Verification, and Regression Testing Architecture
- CI/CD Pipeline & Continuous Deployment Architecture: TenderPulse AI
- Secure Object Storage & Document Architecture: TenderPulse AI
- src/compliance.ts
- useApi.ts
- ADR 0013: Deterministic AI Security, RAG Isolation, and Zero-Trust Guardrails
- Product Strategy & Definition: TenderPulse AI
- llm_client.py
- BidProjectCreatedEvent
- generate_sample_tenders.py
- devDependencies
- AwsS3StorageService
- scripts
- AI Architecture & Workflow Specification: TenderPulse AI
- Asynchronous Job Architecture & Resilience: TenderPulse AI
- ADR 0011: AI Security, Multi-Tenant Isolation, and Defense-in-Depth
- HLD Delta: Existing Architecture → Bidder-Side Target Architecture
- scripts
- web/tsconfig.json
- PROJECT AGENT INSTRUCTIONS
- useSSE.ts
- ADR 0006: Server-Sent Events (SSE) & Smart Polling for Job Progress (Rejecting AWS AppSync)
- config/package.json
- Engineering & Git Conventions
- ADR 0001: Two-Tier Service Boundary (NestJS Application API + FastAPI AI Engine)
- ADR 0002: PostgreSQL as Transactional Source of Truth (Rejecting DynamoDB)
- ADR 0003: SQS + Dead Letter Queue for Asynchronous Document Processing
- ADR 0004: LangGraph for Stateful Extraction Loops (Rejecting Generic LangChain Chains)
- ADR 0005: Direct S3 Uploads via Presigned URLs
- ADR 0008: Domain-Driven Layered Architecture for Modular Monolith
- ADR 0009: Explicit State Machine and Optimistic Concurrency Control
- ADR 0010: Immutable Provenance Value Object for Zero-Ungrounded Compliance
- ADR 0012: Domain Events & In-Process Event Bus with Deferred EventBridge
- shared-types/tsconfig.json
- ui/tsconfig.json
- DocumentUploader.tsx
- ADR 0007: Scoping & Boundary Decision for Redis and EventBridge
- DocumentStatus
- config.py
- Project Status & Milestone Tracker
- @typescript-eslint/eslint-plugin
- tokens.ts
- AggregateRoot
- dev.sh
- check-all.sh
- dev-setup.sh
- seed.sh
- Ci Cd
- TenderPulse AI Engine
- Requirements
- Index
- Docker Compose
- TenantContext.ts
- tenderpulse-ai
- 1. Area-by-Area Classification
- InMemoryEventBus
- BidStatus
- GcpPubSubJobQueue
- IJobQueue
- 1. Storage Port Pruning Methods (`IStorageService`)
- Lowest-Cost AWS MVP Deployment & Testing Guide
- Google Cloud Platform (GCP) Setup & Hybrid Testing Guide
- AwsSqsJobQueue
- ADR 0016: Bidder-Side Pivot — Company Profile, Tender, and BidCase Aggregates
- MockStorageService
- ADR 0017: Enforce the Layered Boundary at HTTP (Eliminate the CRUD Bypass)
- ADR 0018: Async-First Extraction and AI Invocation
- GcpPubSubJobQueue.spec.ts
- tsconfig.json
- ADR 0019: Deterministic Eligibility & Matching Engine
- ADR 0020: External Data Connectors behind an Enrichment Port
- ADR 0021: Evidence-First Compliance Engine (Five-Stage Separation)
- 4. A–E Summary
- Current-State Engineering Audit — TenderPulse AI

## God Nodes (most connected - your core abstractions)
1. `BidProject` - 45 edges
2. `AI Security Architecture, Multi-Tenant Isolation, and Defense-in-Depth` - 43 edges
3. `ValidationException` - 41 edges
4. `TenderDocument` - 41 edges
5. `react` - 38 edges
6. `ComplianceItem` - 37 edges
7. `IngestionJob` - 36 edges
8. `CandidateComplianceItem` - 34 edges
9. `StructuredLLMClient` - 32 edges
10. `IStorageService` - 32 edges

## Surprising Connections (you probably didn't know these)
- `6. Where AI belongs` --references--> `StructuredLLMClient`  [INFERRED]
  docs/ARCHITECTURE.md → apps/ai/src/tenderpulse_ai/models/llm_client.py
- `Module Mapping (extends §3 module map)` --references--> `StructuredLLMClient`  [INFERRED]
  docs/ARCHITECTURE.md → apps/ai/src/tenderpulse_ai/models/llm_client.py
- `3. Capabilities Required for the New Product but Currently Missing` --references--> `StructuredLLMClient`  [INFERRED]
  docs/CURRENT_STATE.md → apps/ai/src/tenderpulse_ai/models/llm_client.py
- `D. What we should build next (recommended order)` --references--> `StructuredLLMClient`  [INFERRED]
  docs/CURRENT_STATE.md → apps/ai/src/tenderpulse_ai/models/llm_client.py
- `9. Where events are used` --references--> `IEventBus`  [INFERRED]
  docs/ARCHITECTURE.md → apps/api/src/common/events/IEventBus.ts

## Import Cycles
- None detected.

## Communities (134 total, 26 thin omitted)

### Community 0 - "DomainException.ts"
Cohesion: 0.07
Nodes (12): DomainException, EntityNotFoundException, InvalidExecutionRulesException, InvalidProvenanceException, InMemoryComplianceItemRepository, StoredComplianceRecord, ComplianceItem, CreateComplianceItemProps (+4 more)

### Community 1 - "BulkIngestComplianceUseCase.ts"
Cohesion: 0.10
Nodes (22): ConcurrencyConflictException, InternalServiceGuard, BulkIngestComplianceCommand, BulkIngestComplianceResult, BulkIngestComplianceUseCase, ExtractedComplianceItemInput, ComplianceItemViewDto, ListComplianceItemsQuery (+14 more)

### Community 2 - "IngestionWorker.ts"
Cohesion: 0.09
Nodes (25): DirectUnitOfWork, IUnitOfWork, DomainEvent, IEventBus, Permissions, InMemoryBidRepository, CreateAuditLogProps, IAuditRepository (+17 more)

### Community 4 - "nodes.py"
Cohesion: 0.09
Nodes (34): VerifiedComplianceItem, WorkflowStatus, StructuredLLMClient, HumanReviewActionPayload, SecurityContext, build_compliance_workflow_graph(), route_verification_outcome(), create_audit_event() (+26 more)

### Community 5 - "IngestionJobMessage"
Cohesion: 0.19
Nodes (6): GcpPubSubConfig, InternalQueueItem, MockSqsJobQueue, DeadLetterMessage, IngestionJobMessage, QueueMessage

### Community 6 - "IngestionJob"
Cohesion: 0.10
Nodes (3): InMemoryIngestionJobRepository, IngestionJob, IIngestionJobRepository

### Community 7 - "CandidateComplianceItem"
Cohesion: 0.09
Nodes (11): CandidateComplianceItem, ILLMClient, HumanReviewManager, CrossTenantReviewException, DuplicateReviewException, HumanReviewDecision, HumanReviewException, HumanReviewTask (+3 more)

### Community 8 - "AI Security Architecture, Multi-Tenant Isolation, and Defense-in-Depth"
Cohesion: 0.05
Nodes (44): AI Security Architecture, Multi-Tenant Isolation, and Defense-in-Depth, 10. Model Provider Security, Privacy & Data Residency, 11. Secret Prevention Architecture, 12. Safe Observability & Audit Logging, 13. The 10 Security Attack Vectors & Test Suite, 1. Foundational Axioms, 2. The 13-Stage End-to-End Security & Data Path, 3. The Explicit SecurityContext Contract (+36 more)

### Community 9 - "evaluator.py"
Cohesion: 0.11
Nodes (15): get_synthetic_evaluation_suite(), ComplianceWorkflowEvaluator, CaseEvaluationResult, EvaluationCaseType, EvaluationSuiteMetrics, ExpectedItem, SyntheticEvaluationCase, DocumentChunk (+7 more)

### Community 10 - "web/package.json"
Cohesion: 0.05
Nodes (37): dependencies, react, react-dom, react-router-dom, @tenderpulse/shared-types, @tenderpulse/ui, description, devDependencies (+29 more)

### Community 11 - "ScopedRetrievalTool"
Cohesion: 0.08
Nodes (10): AISecurityException, CrossTenantAccessException, SecretDetectedException, ToolRateLimitExceededException, UnauthorizedDocumentAccessException, UnrestrictedAccessBlockedException, NetworkEgressGuard, PageTextTool (+2 more)

### Community 12 - "TenderDocument"
Cohesion: 0.06
Nodes (11): InMemoryTenderDocumentRepository, AiDocumentExtractor, AiExtractorConfig, AiServiceExtractResponse, RawExtractedItem, DocumentContentNormalizer, DefaultDocumentExtractor, ExtractedComplianceItem (+3 more)

### Community 13 - "documents.service.ts"
Cohesion: 0.07
Nodes (14): GcsStorageConfig, GcsStorageService, mockBucket, mockDownload, mockFile, mockGetMetadata, mockGetSignedUrl, STORAGE_TOKEN (+6 more)

### Community 14 - "react"
Cohesion: 0.06
Nodes (13): BidStatusBadgeProps, ButtonProps, EmptyStateProps, ErrorBannerProps, InputProps, LoadingSkeletonProps, ModalProps, StatusBadgeProps (+5 more)

### Community 15 - "PostgresBidRepository.ts"
Cohesion: 0.24
Nodes (3): CreateBidProjectProps, BidStatusEnum, Money

### Community 16 - "CoreBusinessWorkflowWithoutAi.e2e.spec.ts"
Cohesion: 0.19
Nodes (13): ConfirmDocumentUploadResult, ConfirmDocumentUploadUseCase, CreateBidResult, CreateBidUseCase, GenerateUploadUrlUseCase, GetDocumentDownloadUrlResult, GetDocumentDownloadUrlUseCase, BidsController (+5 more)

### Community 17 - "AWS Cloud Architecture & Infrastructure Blueprint: TenderPulse AI"
Cohesion: 0.06
Nodes (31): AWS Cloud Architecture & Infrastructure Blueprint: TenderPulse AI, 1. Executive Summary & Design Principles, 2. End-to-End AWS Architecture Map, 3. Technology Evaluation Matrix 17 AWS Services, 4.10 AWS EventBridge Domain Events & Scheduled Jobs, 4.11 Amazon DynamoDB, 4.12 AWS AppSync / WebSockets, 4.13 Amazon CloudWatch & Container Insights (+23 more)

### Community 18 - "useAuth"
Cohesion: 0.13
Nodes (15): listBids(), ProtectedRoute(), ProtectedRouteProps, useAuth(), ReviewActions(), ReviewActionsProps, Header(), Sidebar() (+7 more)

### Community 19 - "BidDetailPage.tsx"
Cohesion: 0.11
Nodes (19): BidDocument, ConfirmUploadRequest, ConfirmUploadResponse, CreateBidRequest, CreateBidResponse, deleteBid(), DeleteBidResponse, deleteDocument() (+11 more)

### Community 20 - "api/compliance.ts"
Cohesion: 0.10
Nodes (11): apiPatch(), ComplianceItem, getComplianceItem(), Provenance, reviewComplianceItem(), UpdateComplianceItemRequest, UpdateComplianceItemResponse, ComplianceRowProps (+3 more)

### Community 21 - "AI Systems Architecture & First Principles: TenderPulse AI"
Cohesion: 0.07
Nodes (28): AI Systems Architecture & First Principles: TenderPulse AI, 1. Architectural Philosophy: The Separation of Intelligence & Authority, 2.10 AI Workflow vs. Autonomous Agent, 2.11 Stateless vs. Stateful AI, 2.12 Deterministic Code vs. Model Reasoning: The Hard Boundary, 2.1 Large Language Models LLMs, 2.2 Tokens and Context Windows, 2.3 System, User, and Tool Messages Role Framing (+20 more)

### Community 22 - "NotFoundError"
Cohesion: 0.10
Nodes (11): AppModule, BadRequestError, ConflictError, HttpError, NotFoundError, UnauthorizedError, AllExceptionsFilter, bootstrap() (+3 more)

### Community 23 - "@nestjs/common"
Cohesion: 0.09
Nodes (10): DatabaseModule, StorageModule, AuditController, AuditModule, AuditService, BidsModule, ComplianceModule, DocumentsModule (+2 more)

### Community 25 - "client.ts"
Cohesion: 0.19
Nodes (21): AuthUser, login(), LoginResponse, logout(), RefreshResponse, refreshTokens(), apiFetch(), apiPost() (+13 more)

### Community 26 - "LangChain, LangGraph, and Stateful AI Workflows: First Principles"
Cohesion: 0.08
Nodes (26): LangChain, LangGraph, and Stateful AI Workflows: First Principles, 10. Retries, 11. Interrupts, 12. Human Approval Human-in-the-Loop, 13. Resumability & Time Travel, 1. Architectural Foundation & First Principles, 1. LangChain, 1. Mandatory Graph State Security Context (+18 more)

### Community 27 - "pipeline.py"
Cohesion: 0.10
Nodes (16): extract_document(), health_check(), HealthResponse, root(), default_tender_extractor(), get_quote(), DocumentExtractionRequest, DocumentExtractionResponse (+8 more)

### Community 28 - "AI Security, Multi-Tenant Isolation, and Threat Mitigation"
Cohesion: 0.08
Nodes (25): AI Security, Multi-Tenant Isolation, and Threat Mitigation, 10. Security Test Suite Specification, 1. Foundational Axiom, 2. The Complete Security & Data Path, 3.1 Vector & Embedding Storage, 3.2 LangGraph State & Checkpoint Isolation, 3.3 S3 Object Storage Isolation, 3. Tenant Isolation Architecture (+17 more)

### Community 29 - "System Architecture: TenderPulse AI"
Cohesion: 0.08
Nodes (25): System Architecture: TenderPulse AI, 1. Architectural Philosophy: From Business Workflow to System Design, 2.10 AWS DynamoDB, 2.11 AWS AppSync / WebSockets, 2.12 LangChain Core Linear Chains, 2.1 React 18 TypeScript + Vite, 2.2 NestJS TypeScript / Node.js, 2.3 FastAPI Python 3.11+ (+17 more)

### Community 30 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, alwaysStrict, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution (+16 more)

### Community 31 - "ValidationException"
Cohesion: 0.12
Nodes (11): ValidationException, GenerateUploadUrlCommand, GenerateUploadUrlResult, ALLOWED_MIME_TYPES, DocumentType, MAX_DOCUMENT_SIZE_BYTES, TenderDocumentUploadedEvent, TenderDocumentUploadedPayload (+3 more)

### Community 32 - "ExecutionRulesProps"
Cohesion: 0.24
Nodes (10): AuditEvent, ExecutionRulesProps, ProvenanceProps, extractor(), mock_extractor(), test_malicious_pdf_instructions_are_untrusted_data(), tricked_extractor(), test_model_failure_recovers_safely() (+2 more)

### Community 33 - "test_compliance_workflow.py"
Cohesion: 0.12
Nodes (6): base_security_context(), setup_node_context(), test_tenant_a_cannot_retrieve_tenant_b_data(), test_workflow_scope_cannot_expand(), test_task_reassignment_updates_assignee_and_audit(), valid_sec_context()

### Community 34 - "compliance.service.ts"
Cohesion: 0.19
Nodes (5): ComplianceController, ComplianceService, ReviewComplianceDto, ReviewComplianceResult, DemoComplianceItem

### Community 35 - "Database Design & PostgreSQL Data Architecture: TenderPulse AI"
Cohesion: 0.09
Nodes (23): Database Design & PostgreSQL Data Architecture: TenderPulse AI, 1. Architectural Philosophy & Principles, 2. Entity-Relationship & Relational Schema Diagram, 3.1 organizations Tenant Root, 3.2 users Identity & RBAC, 3.3 bids Bid Project Aggregate Root, 3.4 tender_documents PDF & Artifact Registry, 3.5 compliance_items Extracted Checklist Requirements (+15 more)

### Community 36 - "Human-in-the-Loop (HITL) Architecture: Human Review, Authorization & State Machine Resumption"
Cohesion: 0.09
Nodes (23): Human-in-the-Loop (HITL) Architecture: Human Review, Authorization & State Machine Resumption, 1. Architectural Philosophy: The Need for Human-in-the-Loop, 1. Automatic Zero Risk, Deterministic Utilities, 1. Tenant-Scoped Reviewer Access, 2. Decision Classification Matrix, 2. Reviewer Authorization & RBAC, 2. Validated Automatic AI Extraction with Deterministic Grounding Proof, 3. Duplicate Approval Prevention Idempotency (+15 more)

### Community 38 - "AI Systems Engineering: From First Principles to Stateful Workflows"
Cohesion: 0.09
Nodes (22): AI Systems Engineering: From First Principles to Stateful Workflows, 10. AI Workflow vs. Autonomous Agent, 11. Stateless vs. Stateful AI, 12. Deterministic Code vs. Model Reasoning: The Hard Boundary, 1. Large Language Models LLMs, 2. Tokens and Context Windows, 3. System, User, and Tool Messages Role Framing, 4. Structured Output Constrained Decoding (+14 more)

### Community 39 - "bids.module.ts"
Cohesion: 0.13
Nodes (5): DATABASE_TOKEN, BidsController, BidsService, BID_REPOSITORY_TOKEN, DemoBid

### Community 40 - "BidCard.tsx"
Cohesion: 0.18
Nodes (13): BidDetail, BidSummary, ExecutionRules, BidCard(), BidCardProps, ExecutionRulesCard(), ExecutionRulesCardProps, formatCurrency (+5 more)

### Community 41 - "Low-Level Design (LLD): Tender Ingestion & Bid Compliance Management"
Cohesion: 0.10
Nodes (20): Low-Level Design (LLD): Tender Ingestion & Bid Compliance Management, 1. Scope & Objective, 2. Package & Directory Structure Modular Monolith, 3. Domain Model: Entities & Value Objects, 4.1 Bid Project State Machine BidStatus, 4.2 Compliance Item State Machine ComplianceStatus, 4. State Machines & Invariant Transitions, 5.1 BidProject Aggregate Root (+12 more)

### Community 42 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, @aws-sdk/client-s3, @aws-sdk/client-sqs, @aws-sdk/s3-request-presigner, bcrypt, drizzle-orm, @electric-sql/pglite, express (+11 more)

### Community 43 - "bids.service.ts"
Cohesion: 0.13
Nodes (15): createDrizzle(), DRIZZLE_TOKEN, DrizzleDb, getDatabase(), initDatabase(), AuthResult, CreateBidDto, DeleteBidResult (+7 more)

### Community 44 - "Domain Knowledge: Indian Government Public Procurement"
Cohesion: 0.11
Nodes (19): Domain Knowledge: Indian Government Public Procurement, 1. Legal and Regulatory Framework, 2. Institutional Procurement Portals, 3. Anatomy of a Tender Package, 4. The Two-Packet Bidding Lifecycle, 5. Domain Terminology Glossary, 6. The Three Pillars of Technical Qualification, 7. The Disqualification Graveyard: Realistic Case Studies (+11 more)

### Community 45 - "api/package.json"
Cohesion: 0.09
Nodes (21): description, @tenderpulse/config, @tenderpulse/shared-types, typescript, vitest, main, name, private (+13 more)

### Community 46 - "Comprehensive Security Review & Threat Assessment: TenderPulse AI"
Cohesion: 0.11
Nodes (18): Comprehensive Security Review & Threat Assessment: TenderPulse AI, 1. Executive Summary & Review Scope, 2. Security Findings Summary Matrix, 3.1 Authentication & Session Security, 3.2 Authorization, Multi-Tenancy & IDOR Defense, 3.3 API Security, Request Limits & Abuse Controls, 3.4 File Storage, S3 Handshakes & Malicious Documents, 3.5 AI Security, Prompt Injection & Privacy (+10 more)

### Community 47 - "Domain Events Architecture & Event Catalog: TenderPulse AI"
Cohesion: 0.12
Nodes (17): Domain Events Architecture & Event Catalog: TenderPulse AI, 1. Architectural Philosophy: Event-Driven Foundations, 2.1 Command vs. Event: The Fundamental Distinction, 2.2 Event vs. Queue: Notification vs. Work Distribution, 2.3 Producer vs. Consumer, 2.4 Delivery Semantics, 2.5 Replay & Event Sourcing Trade-Offs, 2.6 Idempotency & Deduplication (+9 more)

### Community 48 - "Minimum Viable Product (MVP) Specification: TenderPulse AI"
Cohesion: 0.12
Nodes (17): Minimum Viable Product (MVP) Specification: TenderPulse AI, 1. MVP Objective & Philosophy, 2. End-to-End User Journey MVP, 3. System Architecture & Boundaries: AI vs. Deterministic, 4. MVP Data Schema: Compliance Item Contract, 5. Scope: In-Scope vs. Explicit Anti-Scope for MVP, 6. Success Criteria & Acceptance Metrics, AI Engine Handles: (+9 more)

### Community 49 - "Multi-Tenant Security & RBAC Model: TenderPulse AI"
Cohesion: 0.12
Nodes (17): Multi-Tenant Security & RBAC Model: TenderPulse AI, 1. Authentication Guard JwtAuthGuard / InternalApiKeyGuard:, 1. Core Security Principles, 2. Authentication vs. Authorization, 2. Tenant Context Middleware TenantContextMiddleware:, 3.1 Entities & Boundary Definitions:, 3. Multi-Tenant RBAC Domain Model, 3. Permission Guard RequirePermissionsGuard: (+9 more)

### Community 50 - "shared-types/package.json"
Cohesion: 0.12
Nodes (16): description, devDependencies, @tenderpulse/config, typescript, @tenderpulse/config, typescript, main, name (+8 more)

### Community 51 - "ui/package.json"
Cohesion: 0.12
Nodes (16): description, devDependencies, @tenderpulse/config, typescript, @tenderpulse/config, typescript, main, name (+8 more)

### Community 52 - "schema.ts"
Cohesion: 0.12
Nodes (15): AuditLog, auditLogs, Bid, bids, ComplianceItem, complianceItems, NewAuditLog, NewBid (+7 more)

### Community 53 - "api/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, emitDecoratorMetadata, experimentalDecorators, outDir, rootDir, exclude, extends, include (+1 more)

### Community 54 - "react-router-dom"
Cohesion: 0.17
Nodes (4): createBid(), CreateBidPage(), LoginPage(), react-router-dom

### Community 55 - "AuthService"
Cohesion: 0.19
Nodes (3): AuthController, AuthModule, AuthService

### Community 56 - "AI Evaluation, Groundedness Verification, and Regression Testing Architecture"
Cohesion: 0.13
Nodes (15): AI Evaluation, Groundedness Verification, and Regression Testing Architecture, 1. First Principles: Why Ordinary Unit Tests Are Insufficient for LLMs, 2. The 12 AI Evaluation Dimensions, 3. The 3-Tier Evaluation Architecture, 4. Synthetic Evaluation Dataset Taxonomy, 5. Empirical Measured Results & Baseline Scorecard, 6. Continuous Regression Gating in CI/CD, CI/CD Gate Policy: (+7 more)

### Community 57 - "CI/CD Pipeline & Continuous Deployment Architecture: TenderPulse AI"
Cohesion: 0.13
Nodes (15): CI/CD Pipeline & Continuous Deployment Architecture: TenderPulse AI, 1. Architectural Philosophy & Zero-Tolerance Gates, 2. End-to-End Pipeline Workflow, 3. The 10 Pipeline Stages Explained, 4.1 Prompt Regression Tests test_evaluation_regression.py, 4.2 AI Evaluation Scorecards test_compliance_workflow.py, 4.3 Security & Tenant Isolation Regressions, 4. AI-Specific CI/CD Quality Gates (+7 more)

### Community 58 - "Secure Object Storage & Document Architecture: TenderPulse AI"
Cohesion: 0.13
Nodes (15): Secure Object Storage & Document Architecture: TenderPulse AI, 1. Architectural Philosophy: Decoupling Compute from Blob Storage, 2. End-to-End Secure Document Path, 3. S3 Key Hierarchical Namespace & Deterministic Isolation, 4. Metadata: PostgreSQL as the Source of Truth vs. S3 Object Metadata, 5.1 Insecure Direct Object References IDOR, 5.2 Path Traversal & S3 Key Injection, 5.3 Oversized Files & Denial of Wallet (+7 more)

### Community 59 - "src/compliance.ts"
Cohesion: 0.13
Nodes (11): BidStatusType, BidSummaryDto, CreateBidRequest, ComplianceCategoryType, ComplianceItemDto, ComplianceStatusType, ExecutionRulesDto, ProvenanceDto (+3 more)

### Community 60 - "useApi.ts"
Cohesion: 0.24
Nodes (9): AuditEvent, listAuditEvents(), ApiError, AuditTimeline(), AuditTimelineProps, useApi(), UseApiReturn, UseApiState (+1 more)

### Community 61 - "ADR 0013: Deterministic AI Security, RAG Isolation, and Zero-Trust Guardrails"
Cohesion: 0.14
Nodes (14): ADR 0013: Deterministic AI Security, RAG Isolation, and Zero-Trust Guardrails, 1. Mandatory 13-Stage Defensive Pipeline, 2. Immutable SecurityContext, 3. Hard Deterministic RAG Isolation, 4. Untrusted Input Framing, 5. Deterministic Grounding & Output Validation, 6. Narrow Tools & Deny-by-Default Network Egress, 7. Zero Data Retention ZDR & India Data Residency (+6 more)

### Community 62 - "Product Strategy & Definition: TenderPulse AI"
Cohesion: 0.14
Nodes (14): Product Strategy & Definition: TenderPulse AI, 1. Product Vision, 2.1 The Indian Public Procurement Ecosystem, 2.2 The Disqualification Epidemic, 2.3 Economic Loss per Rejected Bid, 2. Market Context & The Problem, 3.1 The Economic Buyer, 3.2 The Daily End User (+6 more)

### Community 65 - "generate_sample_tenders.py"
Cohesion: 0.21
Nodes (6): build_pdf_stream(), generate_pdf(), main(), build_pdf_stream(), generate_pdf(), main()

### Community 66 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, eslint, @nestjs/testing, @tenderpulse/config, @types/express, @types/node, @types/pdf-parse, @types/uuid (+4 more)

### Community 67 - "AwsS3StorageService"
Cohesion: 0.15
Nodes (5): AwsS3StorageConfig, AwsS3StorageService, HeadObjectResult, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner

### Community 68 - "scripts"
Cohesion: 0.09
Nodes (21): devDependencies, prettier, typescript, vitest, typescript, vitest, name, private (+13 more)

### Community 70 - "AI Architecture & Workflow Specification: TenderPulse AI"
Cohesion: 0.18
Nodes (11): AI Architecture & Workflow Specification: TenderPulse AI, 1. Architectural Philosophy & The Core Rule, 2. The 4-Stage Evolution of our AI Integration, 3.1 Node-by-Node Specification, 3. The LangGraph Compliance Extraction DAG, 4. Pydantic Schemas FastAPI Engine, 5. Explicit System Boundaries: AI vs. Deterministic, Stage 1: The Raw LLM Call Naive (+3 more)

### Community 71 - "Asynchronous Job Architecture & Resilience: TenderPulse AI"
Cohesion: 0.18
Nodes (11): Asynchronous Job Architecture & Resilience: TenderPulse AI, 1. Architectural Philosophy: Decoupled Asynchronous Processing, 2.1 At-Least-Once Delivery, 2.2 Visibility Timeout & Worker Leases, 2.3 Retries & Exponential Backoff, 2.4 Dead-Letter Queues DLQ & Poison Pills, 2. Core Distributed Queue Concepts, 3. The End-to-End Pipeline (+3 more)

### Community 72 - "ADR 0011: AI Security, Multi-Tenant Isolation, and Defense-in-Depth"
Cohesion: 0.20
Nodes (10): ADR 0011: AI Security, Multi-Tenant Isolation, and Defense-in-Depth, 1. Hard Tenant & Document Scoping Never Rely on Prompt Instructions, 2. Network Egress: Deny by Default, 3. Untrusted Data Framing & Sanitization, 4. Zero Data Retention ZDR Model Providers, Consequences, Context, Decision (+2 more)

### Community 73 - "HLD Delta: Existing Architecture → Bidder-Side Target Architecture"
Cohesion: 0.06
Nodes (31): 10. Where human review occurs, 2. What must change (ADAPT / REPLACE), 3. New modules required, 4. Which existing boundaries are wrong, 5. Which services/modules should remain together, 6. Where AI belongs, 7. Where deterministic business logic belongs, 8. Where asynchronous processing is used (+23 more)

### Community 74 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, clean, dev, lint, start, test, test:watch (+1 more)

### Community 75 - "web/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, jsx, lib, noEmit, exclude, extends, include, ../../packages/config/typescript/base.json

### Community 76 - "PROJECT AGENT INSTRUCTIONS"
Cohesion: 0.25
Nodes (8): PROJECT AGENT INSTRUCTIONS, Architecture principles, Core rule, Learning modes, Quality bar, Repository memory, Security and tenant isolation, Two equal goals

### Community 77 - "useSSE.ts"
Cohesion: 0.32
Nodes (5): ExtractionProgress(), ExtractionProgressProps, SSEProgressEvent, useSSE(), UseSSEReturn

### Community 78 - "ADR 0006: Server-Sent Events (SSE) & Smart Polling for Job Progress (Rejecting AWS AppSync)"
Cohesion: 0.25
Nodes (8): ADR 0006: Server-Sent Events (SSE) & Smart Polling for Job Progress (Rejecting AWS AppSync), Consequences, Context, Evaluation & Decision, Status, The Problem, Why Reject AWS AppSync?, Why Server-Sent Events SSE + Smart Polling?

### Community 79 - "config/package.json"
Cohesion: 0.25
Nodes (7): description, exports, ./eslint/base.mjs, ./typescript/base.json, name, private, version

### Community 80 - "Engineering & Git Conventions"
Cohesion: 0.29
Nodes (7): Engineering & Git Conventions, 1. Commit Message Convention Conventional Commits, 2. Branch Naming Strategy, 3. Pull Request & Quality Gate Requirements, Allowed Scopes:, Allowed Types:, Examples:

### Community 81 - "ADR 0001: Two-Tier Service Boundary (NestJS Application API + FastAPI AI Engine)"
Cohesion: 0.29
Nodes (7): ADR 0001: Two-Tier Service Boundary (NestJS Application API + FastAPI AI Engine), Alternatives Considered, Consequences, Context, Decision, Status, The Problem

### Community 82 - "ADR 0002: PostgreSQL as Transactional Source of Truth (Rejecting DynamoDB)"
Cohesion: 0.29
Nodes (7): ADR 0002: PostgreSQL as Transactional Source of Truth (Rejecting DynamoDB), Consequences, Context, Evaluation & Decision, Status, The Problem, Why DynamoDB is Insufficient / Harmful for this Domain:

### Community 83 - "ADR 0003: SQS + Dead Letter Queue for Asynchronous Document Processing"
Cohesion: 0.29
Nodes (7): ADR 0003: SQS + Dead Letter Queue for Asynchronous Document Processing, Alternatives Considered, Consequences, Context, Decision, Status, The Problem

### Community 84 - "ADR 0004: LangGraph for Stateful Extraction Loops (Rejecting Generic LangChain Chains)"
Cohesion: 0.29
Nodes (7): ADR 0004: LangGraph for Stateful Extraction Loops (Rejecting Generic LangChain Chains), Alternatives Considered, Consequences, Context, Decision, Status, The Problem

### Community 85 - "ADR 0005: Direct S3 Uploads via Presigned URLs"
Cohesion: 0.29
Nodes (7): ADR 0005: Direct S3 Uploads via Presigned URLs, Alternatives Considered, Consequences, Context, Decision, Status, The Problem

### Community 86 - "ADR 0008: Domain-Driven Layered Architecture for Modular Monolith"
Cohesion: 0.29
Nodes (7): ADR 0008: Domain-Driven Layered Architecture for Modular Monolith, Alternatives Considered, Consequences, Context, Decision, Status, The Problem

### Community 87 - "ADR 0009: Explicit State Machine and Optimistic Concurrency Control"
Cohesion: 0.29
Nodes (7): ADR 0009: Explicit State Machine and Optimistic Concurrency Control, Alternatives Considered, Consequences, Context, Decision, Status, The Problem

### Community 88 - "ADR 0010: Immutable Provenance Value Object for Zero-Ungrounded Compliance"
Cohesion: 0.29
Nodes (7): ADR 0010: Immutable Provenance Value Object for Zero-Ungrounded Compliance, Alternatives Considered, Consequences, Context, Decision, Status, The Problem

### Community 89 - "ADR 0012: Domain Events & In-Process Event Bus with Deferred EventBridge"
Cohesion: 0.29
Nodes (7): ADR 0012: Domain Events & In-Process Event Bus with Deferred EventBridge, Alternatives Considered, Consequences, Context, Decision, Status, The Problem

### Community 90 - "shared-types/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../config/typescript/base.json

### Community 91 - "ui/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../config/typescript/base.json

### Community 92 - "DocumentUploader.tsx"
Cohesion: 0.47
Nodes (4): confirmDocumentUpload(), generateUploadUrl(), DocumentUploader(), DocumentUploaderProps

### Community 93 - "ADR 0007: Scoping & Boundary Decision for Redis and EventBridge"
Cohesion: 0.33
Nodes (6): ADR 0007: Scoping & Boundary Decision for Redis and EventBridge, Consequences, Context, Decisions, Rules from AGENTS.md:, Status

### Community 94 - "DocumentStatus"
Cohesion: 0.15
Nodes (4): InvalidStateTransitionException, CreateTenderDocumentProps, DocumentStatus, 2. Domain Model — **KEEP**

### Community 96 - "Project Status & Milestone Tracker"
Cohesion: 0.50
Nodes (4): Project Status & Milestone Tracker, Current Milestone: Production Document + AI Pipeline Milestone 20, Next Immediate Action, Roadmap Stop Points as defined in AGENTS.md

### Community 110 - "TenantContext.ts"
Cohesion: 0.24
Nodes (7): UnauthorizedTenantAccessException, hasPermission(), Permission, ROLE_PERMISSIONS, UserRole, TenantContext, TenantContextHolder

### Community 112 - "1. Area-by-Area Classification"
Cohesion: 0.12
Nodes (15): 10. Evidence Handling — **MISSING**, 12. Database — **ADAPT**, 14. Async Processing — **ADAPT**, 16. Frontend — **KEEP (minor ADAPT)**, 17. Tests — **KEEP**, 18. Security — **REPLACE (critical items); KEEP (hardening patterns)**, 19. Infrastructure — **ADAPT**, 1. Area-by-Area Classification (+7 more)

### Community 114 - "InMemoryEventBus"
Cohesion: 0.27
Nodes (3): DomainEventHandler, InMemoryEventBus, 15. Event Architecture — **ADAPT**

### Community 117 - "IJobQueue"
Cohesion: 0.12
Nodes (11): IJobQueue, 1. Cloud-Agnostic Domain & Application Ports, 2. Infrastructure Adapters, 3. Google Cloud Platform (GCP) Infrastructure, ADR 0014: Cloud-Agnostic Ports & Adapters with Google Cloud Platform (GCP) Implementation, Consequences, Context, Decision (+3 more)

### Community 118 - "1. Storage Port Pruning Methods (`IStorageService`)"
Cohesion: 0.17
Nodes (11): 1. Storage Port Pruning Methods (`IStorageService`), 2. Deletion Sequence & Invariants, 3. Rationale for Database First, Storage Second, ADR 0015: Two-Phase Cascade Deletion Across Relational State and Object Storage, Consequences, Context, Decision, Positive (+3 more)

### Community 119 - "Lowest-Cost AWS MVP Deployment & Testing Guide"
Cohesion: 0.18
Nodes (10): 1. Overview & Architectural Rationale, 2. Infrastructure as Code: Terraform Local Environment, 3. Step-by-Step Setup Guide, 4. Validating the End-to-End Flow, 5. Teardown & Zero-Cost Guarantee, Lowest-Cost AWS MVP Deployment & Testing Guide, Step 1: Deploy AWS Resources via Terraform, Step 2: Retrieve Environment Configuration (+2 more)

### Community 120 - "Google Cloud Platform (GCP) Setup & Hybrid Testing Guide"
Cohesion: 0.18
Nodes (10): 1. Install Google Cloud SDK (if not already installed):, 2. Authenticate with your Google Account:, 2. Prerequisites: Google Cloud CLI (`gcloud`), 3. Step-by-Step Deployment Guide, 4. Validating the End-to-End GCP Flow, 5. Teardown & Zero-Cost Guarantee, Google Cloud Platform (GCP) Setup & Hybrid Testing Guide, Step 1: Provision GCP Resources with Terraform (+2 more)

### Community 121 - "AwsSqsJobQueue"
Cohesion: 0.20
Nodes (3): AwsSqsConfig, AwsSqsJobQueue, @aws-sdk/client-sqs

### Community 122 - "ADR 0016: Bidder-Side Pivot — Company Profile, Tender, and BidCase Aggregates"
Cohesion: 0.25
Nodes (7): ADR 0016: Bidder-Side Pivot — Company Profile, Tender, and BidCase Aggregates, Consequences, Context, Decision, References, Status, The Problem

### Community 124 - "ADR 0017: Enforce the Layered Boundary at HTTP (Eliminate the CRUD Bypass)"
Cohesion: 0.25
Nodes (7): ADR 0017: Enforce the Layered Boundary at HTTP (Eliminate the CRUD Bypass), Consequences, Context, Decision, References, Status, The Problem

### Community 125 - "ADR 0018: Async-First Extraction and AI Invocation"
Cohesion: 0.25
Nodes (7): ADR 0018: Async-First Extraction and AI Invocation, Consequences, Context, Decision, References, Status, The Problem

### Community 126 - "GcpPubSubJobQueue.spec.ts"
Cohesion: 0.29
Nodes (6): mockAcknowledge, mockModifyAckDeadline, mockPublishMessage, mockPull, mockSubscriptionPath, mockTopic

### Community 127 - "tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, noEmit, exclude, extends, include, ./packages/config/typescript/base.json

### Community 129 - "ADR 0019: Deterministic Eligibility & Matching Engine"
Cohesion: 0.25
Nodes (7): ADR 0019: Deterministic Eligibility & Matching Engine, Consequences, Context, Decision, References, Status, The Problem

### Community 130 - "ADR 0020: External Data Connectors behind an Enrichment Port"
Cohesion: 0.25
Nodes (7): ADR 0020: External Data Connectors behind an Enrichment Port, Consequences, Context, Decision, References, Status, The Problem

### Community 131 - "ADR 0021: Evidence-First Compliance Engine (Five-Stage Separation)"
Cohesion: 0.29
Nodes (6): ADR 0021: Evidence-First Compliance Engine (Five-Stage Separation), Consequences, Context, Decision, References, Status

### Community 132 - "4. A–E Summary"
Cohesion: 0.33
Nodes (6): 4. A–E Summary, A. What we already built well, B. What should not be thrown away, C. What needs architectural changes, D. What we should build next (recommended order), E. Technical debt that could become dangerous later

### Community 133 - "Current-State Engineering Audit — TenderPulse AI"
Cohesion: 0.40
Nodes (4): 0. Executive Summary, 2. Existing ParakhSetu-like Capabilities, 3. Capabilities Required for the New Product but Currently Missing, Current-State Engineering Audit — TenderPulse AI

## Knowledge Gaps
- **903 isolated node(s):** `tenderpulse-ai`, `Config`, `name`, `version`, `private` (+898 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1245 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **26 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `StructuredLLMClient` connect `nodes.py` to `ExecutionRulesProps`, `4. A–E Summary`, `Current-State Engineering Audit — TenderPulse AI`, `CandidateComplianceItem`, `evaluator.py`, `HLD Delta: Existing Architecture → Bidder-Side Target Architecture`, `ScopedRetrievalTool`, `pipeline.py`, `ADR 0018: Async-First Extraction and AI Invocation`, `llm_client.py`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Why does `1. Area-by-Area Classification` connect `1. Area-by-Area Classification` to `BulkIngestComplianceUseCase.ts`, `nodes.py`, `Current-State Engineering Audit — TenderPulse AI`, `TenderDocument`, `CoreBusinessWorkflowWithoutAi.e2e.spec.ts`, `InMemoryEventBus`, `pipeline.py`, `DocumentStatus`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `BidProject` connect `BidProject` to `BidProjectCreatedEvent`, `BulkIngestComplianceUseCase.ts`, `IngestionWorker.ts`, `AggregateRoot`, `HLD Delta: Existing Architecture → Bidder-Side Target Architecture`, `PostgresBidRepository.ts`, `BidStatus`, `1. Storage Port Pruning Methods (`IStorageService`)`, `AuditLog`, `ADR 0016: Bidder-Side Pivot — Company Profile, Tender, and BidCase Aggregates`, `DocumentStatus`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `BidProject` (e.g. with `Context` and `Consequences`) actually correct?**
  _`BidProject` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `tenderpulse-ai`, `Config`, `name` to the rest of the system?**
  _903 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DomainException.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07337526205450734 - nodes in this community are weakly interconnected._
- **Should `BulkIngestComplianceUseCase.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09608843537414966 - nodes in this community are weakly interconnected._