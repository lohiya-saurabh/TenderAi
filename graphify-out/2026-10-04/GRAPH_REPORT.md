# Graph Report - TenderAi  (2026-10-04)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2067 nodes · 4006 edges · 114 communities (91 shown, 23 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 257 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `16cb86ae`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- DomainException.ts
- BulkIngestComplianceUseCase.ts
- IngestionWorker.ts
- ValidationException
- nodes.py
- IngestionJobMessage
- IngestionJob
- CandidateComplianceItem
- AI Security Architecture, Multi-Tenant Isolation, and Defense-in-Depth
- evaluator.py
- web/package.json
- ScopedRetrievalTool
- TenderDocument
- IStorageService
- react
- documents.service.ts
- BidsController.ts
- AWS Cloud Architecture & Infrastructure Blueprint: TenderPulse AI
- useAuth
- BidDetailPage.tsx
- api/compliance.ts
- AI Systems Architecture & First Principles: TenderPulse AI
- NotFoundError
- DrizzleDb
- .processMessage
- client.ts
- LangChain, LangGraph, and Stateful AI Workflows: First Principles
- main.py
- AI Security, Multi-Tenant Isolation, and Threat Mitigation
- System Architecture: TenderPulse AI
- compilerOptions
- @nestjs/common
- pipeline.py
- test_compliance_workflow.py
- compliance.service.ts
- Database Design & PostgreSQL Data Architecture: TenderPulse AI
- Human-in-the-Loop (HITL) Architecture: Human Review, Authorization & State Machine Resumption
- DocumentsController
- AI Systems Engineering: From First Principles to Stateful Workflows
- BidsService
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
- DomainEvent
- generate_sample_tenders.py
- devDependencies
- AwsS3StorageService
- package.json
- AI Architecture & Workflow Specification: TenderPulse AI
- Asynchronous Job Architecture & Resilience: TenderPulse AI
- ADR 0011: AI Security, Multi-Tenant Isolation, and Defense-in-Depth
- scripts
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
- config.py
- Project Status & Milestone Tracker
- @typescript-eslint/eslint-plugin
- tokens.ts
- dev.sh
- check-all.sh
- dev-setup.sh
- seed.sh
- Ci Cd
- TenderPulse AI Engine
- Requirements
- Index
- Docker Compose
- tenderpulse-ai

## God Nodes (most connected - your core abstractions)
1. `AI Security Architecture, Multi-Tenant Isolation, and Defense-in-Depth` - 43 edges
2. `TenderDocument` - 41 edges
3. `ValidationException` - 41 edges
4. `BidProject` - 39 edges
5. `react` - 38 edges
6. `ComplianceItem` - 37 edges
7. `CandidateComplianceItem` - 34 edges
8. `IngestionJob` - 33 edges
9. `AWS Cloud Architecture & Infrastructure Blueprint: TenderPulse AI` - 30 edges
10. `ComplianceWorkflowEvaluator` - 29 edges

## Surprising Connections (you probably didn't know these)
- `test_workflow_scope_cannot_expand()` --uses--> `UnauthorizedDocumentAccessException`  [INFERRED]
  apps/ai/tests/test_compliance_workflow.py → apps/ai/src/tenderpulse_ai/security/exceptions.py
- `test_task_reassignment_updates_assignee_and_audit()` --calls--> `HumanReviewManager`  [INFERRED]
  apps/ai/tests/test_human_review_workflow.py → apps/ai/src/tenderpulse_ai/review/manager.py
- `ComplianceWorkflowEvaluator` --uses--> `UnauthorizedDocumentAccessException`  [INFERRED]
  apps/ai/src/tenderpulse_ai/evaluation/evaluator.py → apps/ai/src/tenderpulse_ai/security/exceptions.py
- `test_tenant_a_cannot_retrieve_tenant_b_data()` --uses--> `UnauthorizedDocumentAccessException`  [INFERRED]
  apps/ai/tests/test_compliance_workflow.py → apps/ai/src/tenderpulse_ai/security/exceptions.py
- `test_unauthorized_document_fails()` --uses--> `UnauthorizedDocumentAccessException`  [INFERRED]
  apps/ai/tests/test_compliance_workflow.py → apps/ai/src/tenderpulse_ai/security/exceptions.py

## Import Cycles
- None detected.

## Communities (114 total, 23 thin omitted)

### Community 0 - "DomainException.ts"
Cohesion: 0.06
Nodes (15): ConcurrencyConflictException, DomainException, InvalidExecutionRulesException, InvalidProvenanceException, InvalidStateTransitionException, InMemoryComplianceItemRepository, StoredComplianceRecord, DocumentStatusEnum (+7 more)

### Community 1 - "BulkIngestComplianceUseCase.ts"
Cohesion: 0.08
Nodes (26): InternalServiceGuard, AuditLog, CreateAuditLogProps, IAuditRepository, InMemoryAuditRepository, GetDocumentDownloadUrlCommand, BulkIngestComplianceCommand, BulkIngestComplianceResult (+18 more)

### Community 2 - "IngestionWorker.ts"
Cohesion: 0.11
Nodes (24): DirectUnitOfWork, IUnitOfWork, IEventBus, hasPermission(), Permission, Permissions, ROLE_PERMISSIONS, UserRole (+16 more)

### Community 3 - "ValidationException"
Cohesion: 0.07
Nodes (8): ValidationException, InMemoryBidRepository, PostgresBidRepository, BidProject, CreateBidProjectProps, BidStatus, BidStatusEnum, Money

### Community 4 - "nodes.py"
Cohesion: 0.11
Nodes (33): VerifiedComplianceItem, WorkflowStatus, StructuredLLMClient, HumanReviewActionPayload, SecurityContext, build_compliance_workflow_graph(), route_verification_outcome(), create_audit_event() (+25 more)

### Community 5 - "IngestionJobMessage"
Cohesion: 0.07
Nodes (17): AwsSqsConfig, AwsSqsJobQueue, GcpPubSubConfig, GcpPubSubJobQueue, mockAcknowledge, mockModifyAckDeadline, mockPublishMessage, mockPull (+9 more)

### Community 6 - "IngestionJob"
Cohesion: 0.05
Nodes (7): AggregateRoot, IDomainEvent, DomainEventHandler, InMemoryEventBus, InMemoryIngestionJobRepository, IngestionJob, IIngestionJobRepository

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
Cohesion: 0.07
Nodes (6): InMemoryTenderDocumentRepository, DefaultDocumentExtractor, IDocumentExtractor, CreateTenderDocumentProps, TenderDocument, DocumentStatus

### Community 13 - "IStorageService"
Cohesion: 0.07
Nodes (10): GcsStorageConfig, GcsStorageService, mockBucket, mockDownload, mockFile, mockGetMetadata, mockGetSignedUrl, MockStorageService (+2 more)

### Community 14 - "react"
Cohesion: 0.06
Nodes (13): BidStatusBadgeProps, ButtonProps, EmptyStateProps, ErrorBannerProps, InputProps, LoadingSkeletonProps, ModalProps, StatusBadgeProps (+5 more)

### Community 15 - "documents.service.ts"
Cohesion: 0.11
Nodes (12): AiDocumentExtractor, AiExtractorConfig, AiServiceExtractResponse, RawExtractedItem, DocumentContentNormalizer, NormalizedDocumentPage, ExtractedComplianceItem, ConfirmUploadResult (+4 more)

### Community 16 - "BidsController.ts"
Cohesion: 0.12
Nodes (17): ConfirmDocumentUploadResult, CreateBidResult, GenerateUploadUrlCommand, GenerateUploadUrlResult, GetDocumentDownloadUrlResult, ALLOWED_MIME_TYPES, DocumentType, MAX_DOCUMENT_SIZE_BYTES (+9 more)

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

### Community 23 - "DrizzleDb"
Cohesion: 0.12
Nodes (5): createDrizzle(), DrizzleDb, AuditController, AuditService, DemoAuditEvent

### Community 25 - "client.ts"
Cohesion: 0.19
Nodes (21): AuthUser, login(), LoginResponse, logout(), RefreshResponse, refreshTokens(), apiFetch(), apiPost() (+13 more)

### Community 26 - "LangChain, LangGraph, and Stateful AI Workflows: First Principles"
Cohesion: 0.08
Nodes (26): LangChain, LangGraph, and Stateful AI Workflows: First Principles, 10. Retries, 11. Interrupts, 12. Human Approval Human-in-the-Loop, 13. Resumability & Time Travel, 1. Architectural Foundation & First Principles, 1. LangChain, 1. Mandatory Graph State Security Context (+18 more)

### Community 27 - "main.py"
Cohesion: 0.11
Nodes (9): extract_document(), health_check(), HealthResponse, root(), DocumentExtractionRequest, DocumentExtractionResponse, NormalizedPage, ProductionExtractionPipeline (+1 more)

### Community 28 - "AI Security, Multi-Tenant Isolation, and Threat Mitigation"
Cohesion: 0.08
Nodes (25): AI Security, Multi-Tenant Isolation, and Threat Mitigation, 10. Security Test Suite Specification, 1. Foundational Axiom, 2. The Complete Security & Data Path, 3.1 Vector & Embedding Storage, 3.2 LangGraph State & Checkpoint Isolation, 3.3 S3 Object Storage Isolation, 3. Tenant Isolation Architecture (+17 more)

### Community 29 - "System Architecture: TenderPulse AI"
Cohesion: 0.08
Nodes (25): System Architecture: TenderPulse AI, 1. Architectural Philosophy: From Business Workflow to System Design, 2.10 AWS DynamoDB, 2.11 AWS AppSync / WebSockets, 2.12 LangChain Core Linear Chains, 2.1 React 18 TypeScript + Vite, 2.2 NestJS TypeScript / Node.js, 2.3 FastAPI Python 3.11+ (+17 more)

### Community 30 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, alwaysStrict, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution (+16 more)

### Community 31 - "@nestjs/common"
Cohesion: 0.12
Nodes (9): DATABASE_TOKEN, DatabaseModule, STORAGE_TOKEN, StorageModule, AuditModule, BidsModule, BID_REPOSITORY_TOKEN, DocumentsModule (+1 more)

### Community 32 - "pipeline.py"
Cohesion: 0.15
Nodes (16): AuditEvent, ExecutionRulesProps, ProvenanceProps, extractor(), default_tender_extractor(), get_quote(), _extract_clause_reference(), _extract_sentence() (+8 more)

### Community 33 - "test_compliance_workflow.py"
Cohesion: 0.12
Nodes (6): base_security_context(), setup_node_context(), test_tenant_a_cannot_retrieve_tenant_b_data(), test_workflow_scope_cannot_expand(), test_task_reassignment_updates_assignee_and_audit(), valid_sec_context()

### Community 34 - "compliance.service.ts"
Cohesion: 0.16
Nodes (6): ComplianceController, ComplianceModule, ComplianceService, ReviewComplianceDto, ReviewComplianceResult, DemoComplianceItem

### Community 35 - "Database Design & PostgreSQL Data Architecture: TenderPulse AI"
Cohesion: 0.09
Nodes (23): Database Design & PostgreSQL Data Architecture: TenderPulse AI, 1. Architectural Philosophy & Principles, 2. Entity-Relationship & Relational Schema Diagram, 3.1 organizations Tenant Root, 3.2 users Identity & RBAC, 3.3 bids Bid Project Aggregate Root, 3.4 tender_documents PDF & Artifact Registry, 3.5 compliance_items Extracted Checklist Requirements (+15 more)

### Community 36 - "Human-in-the-Loop (HITL) Architecture: Human Review, Authorization & State Machine Resumption"
Cohesion: 0.09
Nodes (23): Human-in-the-Loop (HITL) Architecture: Human Review, Authorization & State Machine Resumption, 1. Architectural Philosophy: The Need for Human-in-the-Loop, 1. Automatic Zero Risk, Deterministic Utilities, 1. Tenant-Scoped Reviewer Access, 2. Decision Classification Matrix, 2. Reviewer Authorization & RBAC, 2. Validated Automatic AI Extraction with Deterministic Grounding Proof, 3. Duplicate Approval Prevention Idempotency (+15 more)

### Community 38 - "AI Systems Engineering: From First Principles to Stateful Workflows"
Cohesion: 0.09
Nodes (22): AI Systems Engineering: From First Principles to Stateful Workflows, 10. AI Workflow vs. Autonomous Agent, 11. Stateless vs. Stateful AI, 12. Deterministic Code vs. Model Reasoning: The Hard Boundary, 1. Large Language Models LLMs, 2. Tokens and Context Windows, 3. System, User, and Tool Messages Role Framing, 4. Structured Output Constrained Decoding (+14 more)

### Community 39 - "BidsService"
Cohesion: 0.15
Nodes (3): BidsController, BidsService, DemoBid

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
Cohesion: 0.22
Nodes (13): DRIZZLE_TOKEN, getDatabase(), initDatabase(), AuthResult, CreateBidDto, DeleteBidResult, BIDS, DEMO_USERS (+5 more)

### Community 44 - "Domain Knowledge: Indian Government Public Procurement"
Cohesion: 0.11
Nodes (19): Domain Knowledge: Indian Government Public Procurement, 1. Legal and Regulatory Framework, 2. Institutional Procurement Portals, 3. Anatomy of a Tender Package, 4. The Two-Packet Bidding Lifecycle, 5. Domain Terminology Glossary, 6. The Three Pillars of Technical Qualification, 7. The Disqualification Graveyard: Realistic Case Studies (+11 more)

### Community 45 - "api/package.json"
Cohesion: 0.11
Nodes (17): description, main, name, private, type, version, eslint, @google-cloud/pubsub (+9 more)

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
Cohesion: 0.12
Nodes (14): compilerOptions, emitDecoratorMetadata, experimentalDecorators, outDir, rootDir, exclude, extends, include (+6 more)

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

### Community 64 - "DomainEvent"
Cohesion: 0.21
Nodes (5): DomainEvent, BidProjectCreatedEvent, BidProjectCreatedPayload, ComplianceItemReviewedEvent, ComplianceItemReviewedPayload

### Community 65 - "generate_sample_tenders.py"
Cohesion: 0.21
Nodes (6): build_pdf_stream(), generate_pdf(), main(), build_pdf_stream(), generate_pdf(), main()

### Community 66 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, eslint, @nestjs/testing, @tenderpulse/config, @types/express, @types/node, @types/pdf-parse, @types/uuid (+4 more)

### Community 67 - "AwsS3StorageService"
Cohesion: 0.20
Nodes (4): AwsS3StorageConfig, AwsS3StorageService, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner

### Community 68 - "package.json"
Cohesion: 0.17
Nodes (11): devDependencies, prettier, typescript, vitest, typescript, vitest, name, private (+3 more)

### Community 70 - "AI Architecture & Workflow Specification: TenderPulse AI"
Cohesion: 0.18
Nodes (11): AI Architecture & Workflow Specification: TenderPulse AI, 1. Architectural Philosophy & The Core Rule, 2. The 4-Stage Evolution of our AI Integration, 3.1 Node-by-Node Specification, 3. The LangGraph Compliance Extraction DAG, 4. Pydantic Schemas FastAPI Engine, 5. Explicit System Boundaries: AI vs. Deterministic, Stage 1: The Raw LLM Call Naive (+3 more)

### Community 71 - "Asynchronous Job Architecture & Resilience: TenderPulse AI"
Cohesion: 0.18
Nodes (11): Asynchronous Job Architecture & Resilience: TenderPulse AI, 1. Architectural Philosophy: Decoupled Asynchronous Processing, 2.1 At-Least-Once Delivery, 2.2 Visibility Timeout & Worker Leases, 2.3 Retries & Exponential Backoff, 2.4 Dead-Letter Queues DLQ & Poison Pills, 2. Core Distributed Queue Concepts, 3. The End-to-End Pipeline (+3 more)

### Community 72 - "ADR 0011: AI Security, Multi-Tenant Isolation, and Defense-in-Depth"
Cohesion: 0.20
Nodes (10): ADR 0011: AI Security, Multi-Tenant Isolation, and Defense-in-Depth, 1. Hard Tenant & Document Scoping Never Rely on Prompt Instructions, 2. Network Egress: Deny by Default, 3. Untrusted Data Framing & Sanitization, 4. Zero Data Retention ZDR Model Providers, Consequences, Context, Decision (+2 more)

### Community 73 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, dev, dev:api, dev:web, format, format:check, lint (+2 more)

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

### Community 96 - "Project Status & Milestone Tracker"
Cohesion: 0.50
Nodes (4): Project Status & Milestone Tracker, Current Milestone: Production Document + AI Pipeline Milestone 20, Next Immediate Action, Roadmap Stop Points as defined in AGENTS.md

## Knowledge Gaps
- **818 isolated node(s):** `DocumentStatusEnum`, `ComplianceStatusEnum`, `BulkIngestComplianceCommand`, `ListComplianceItemsQuery`, `ReviewComplianceItemCommand` (+813 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1153 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `DomainException.ts` to `BulkIngestComplianceUseCase.ts`, `IngestionWorker.ts`, `AwsS3StorageService`, `ValidationException`, `IngestionJobMessage`, `BidCard.tsx`, `web/package.json`, `bids.service.ts`, `IStorageService`, `api/package.json`, `useAuth`, `BidDetailPage.tsx`, `client.ts`, `integration.spec.ts`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **Why does `TenderDocument` connect `TenderDocument` to `DomainException.ts`, `IngestionWorker.ts`, `IngestionJob`, `documents.service.ts`, `BidsController.ts`, `.processMessage`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `App.tsx`, `BidCard.tsx`, `web/package.json`, `useSSE.ts`, `DocumentUploader.tsx`, `useAuth`, `BidDetailPage.tsx`, `api/compliance.ts`, `react-router-dom`, `client.ts`, `useApi.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `DocumentStatusEnum`, `ComplianceStatusEnum`, `BulkIngestComplianceCommand` to the rest of the system?**
  _818 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DomainException.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06498015873015874 - nodes in this community are weakly interconnected._
- **Should `BulkIngestComplianceUseCase.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07782898105478751 - nodes in this community are weakly interconnected._
- **Should `IngestionWorker.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10601092896174863 - nodes in this community are weakly interconnected._