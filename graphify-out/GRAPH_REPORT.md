# Graph Report - TenderAi  (2026-10-02)

## Corpus Check
- 244 files · ~106,792 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 6, .example 1, .lock 1)

## Summary
- 1741 nodes · 3292 edges · 103 communities (84 shown, 19 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 247 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Human-in-the-Loop Review System
- IUnitOfWork.ts Cluster
- Compliance & Provenance Domain
- Auth & Tenant Security Context
- React Frontend & UI Components
- main.py Cluster
- Bid & Tender Management
- Domain Events & Event Bus
- Compliance & Provenance Domain
- Compliance & Provenance Domain
- Bid & Tender Management
- AI Evaluation & Benchmarks
- Bid & Tender Management
- Bid & Tender Management
- Button.tsx Cluster
- .execute() Cluster
- Compliance & Provenance Domain
- Bid & Tender Management
- Bid & Tender Management
- AI Evaluation & Benchmarks
- Async SQS Ingestion Pipeline
- Auth & Tenant Security Context
- Auth & Tenant Security Context
- LangGraph Stateful AI Workflows
- DomainException.ts Cluster
- Async SQS Ingestion Pipeline
- Auth & Tenant Security Context
- Bid & Tender Management
- base.json Cluster
- Domain Events & Event Bus
- Bid & Tender Management
- Auth & Tenant Security Context
- LangGraph Stateful AI Workflows
- package.json Cluster
- Auth & Tenant Security Context
- AiDocumentExtractor.ts Cluster
- Bid & Tender Management
- Compliance & Provenance Domain
- Auth & Tenant Security Context
- Bid & Tender Management
- Bid & Tender Management
- AI Evaluation & Benchmarks
- Domain Events & Event Bus
- Bid & Tender Management
- Bid & Tender Management
- Compliance & Provenance Domain
- Bid & Tender Management
- Bid & Tender Management
- Bid & Tender Management
- Compliance & Provenance Domain
- Domain Events & Event Bus
- Bid & Tender Management
- AI Evaluation & Benchmarks
- AI Evaluation & Benchmarks
- Bid & Tender Management
- Compliance & Provenance Domain
- Architectural Decision Records
- Bid & Tender Management
- Compliance & Provenance Domain
- Compliance & Provenance Domain
- Compliance & Provenance Domain
- Bid & Tender Management
- Bid & Tender Management
- Auth & Tenant Security Context
- tsconfig.json Cluster
- LangGraph Stateful AI Workflows
- Async SQS Ingestion Pipeline
- Compliance & Provenance Domain
- tsconfig.json Cluster
- Domain Events & Event Bus
- AI Evaluation & Benchmarks
- package.json Cluster
- S3 Presigned Storage Architecture
- React Frontend & UI Components
- NestJS Application API
- AI Evaluation & Benchmarks
- Async SQS Ingestion Pipeline
- LangGraph Stateful AI Workflows
- S3 Presigned Storage Architecture
- Architectural Decision Records
- Architectural Decision Records
- Compliance & Provenance Domain
- Domain Events & Event Bus
- tsconfig.json Cluster
- tsconfig.json Cluster
- tsconfig.json Cluster
- LangGraph Stateful AI Workflows
- config.py Cluster
- LangGraph Stateful AI Workflows
- index.ts Cluster
- dev.sh Cluster
- check-all.sh Cluster
- dev-setup.sh Cluster
- seed.sh Cluster
- Ci Cd Cluster
- Bid & Tender Management
- React Frontend & UI Components
- Index Cluster
- Docker Compose Cluster
- Bid & Tender Management

## God Nodes (most connected - your core abstractions)
1. `AI Security Architecture, Multi-Tenant Isolation, and Defense-in-Depth` - 43 edges
2. `ValidationException` - 41 edges
3. `TenderDocument` - 38 edges
4. `react` - 38 edges
5. `ComplianceItem` - 37 edges
6. `CandidateComplianceItem` - 34 edges
7. `IngestionJob` - 33 edges
8. `AWS Cloud Architecture & Infrastructure Blueprint: TenderPulse AI` - 30 edges
9. `ComplianceWorkflowEvaluator` - 29 edges
10. `BidProject` - 29 edges

## Surprising Connections (you probably didn't know these)
- `test_authorized_document_succeeds()` --uses--> `WorkflowStatus`  [INFERRED]
  apps/ai/tests/test_compliance_workflow.py → apps/ai/src/tenderpulse_ai/domain/models.py
- `test_malicious_pdf_instructions_are_untrusted_data()` --uses--> `WorkflowStatus`  [INFERRED]
  apps/ai/tests/test_compliance_workflow.py → apps/ai/src/tenderpulse_ai/domain/models.py
- `test_unauthorized_document_fails()` --uses--> `WorkflowStatus`  [INFERRED]
  apps/ai/tests/test_compliance_workflow.py → apps/ai/src/tenderpulse_ai/domain/models.py
- `test_duplicate_review_submission_is_blocked()` --uses--> `WorkflowStatus`  [INFERRED]
  apps/ai/tests/test_human_review_workflow.py → apps/ai/src/tenderpulse_ai/domain/models.py
- `test_human_review_interrupt_and_approve()` --uses--> `WorkflowStatus`  [INFERRED]
  apps/ai/tests/test_human_review_workflow.py → apps/ai/src/tenderpulse_ai/domain/models.py

## Import Cycles
- None detected.

## Communities (103 total, 19 thin omitted)

### Community 0 - "Human-in-the-Loop Review System"
Cohesion: 0.11
Nodes (18): HumanReviewManager, CrossTenantReviewException, DuplicateReviewException, HumanReviewActionPayload, HumanReviewDecision, HumanReviewException, HumanReviewTask, HumanReviewTaskStatus (+10 more)

### Community 1 - "IUnitOfWork.ts Cluster"
Cohesion: 0.14
Nodes (19): DirectUnitOfWork, hasPermission(), Permission, Permissions, ROLE_PERMISSIONS, UserRole, TenantContext, TenantContextHolder (+11 more)

### Community 2 - "Compliance & Provenance Domain"
Cohesion: 0.09
Nodes (17): AuditEvent, CandidateComplianceItem, ExecutionRulesProps, ProvenanceProps, extractor(), ILLMClient, StructuredLLMClient, default_tender_extractor() (+9 more)

### Community 3 - "Auth & Tenant Security Context"
Cohesion: 0.05
Nodes (44): AI Security Architecture, Multi-Tenant Isolation, and Defense-in-Depth, 10. Model Provider Security, Privacy & Data Residency, 11. Secret Prevention Architecture, 12. Safe Observability & Audit Logging, 13. The 10 Security Attack Vectors & Test Suite, 1. Foundational Axioms, 2. The 13-Stage End-to-End Security & Data Path, 3. The Explicit SecurityContext Contract (+36 more)

### Community 4 - "React Frontend & UI Components"
Cohesion: 0.05
Nodes (37): dependencies, react, react-dom, react-router-dom, @tenderpulse/shared-types, @tenderpulse/ui, description, devDependencies (+29 more)

### Community 5 - "main.py Cluster"
Cohesion: 0.09
Nodes (12): extract_document(), health_check(), HealthResponse, root(), DocumentExtractionRequest, DocumentExtractionResponse, NormalizedPage, ProductionExtractionPipeline (+4 more)

### Community 6 - "Bid & Tender Management"
Cohesion: 0.05
Nodes (36): dependencies, @tenderpulse/shared-types, uuid, description, devDependencies, eslint, @tenderpulse/config, @types/node (+28 more)

### Community 7 - "Domain Events & Event Bus"
Cohesion: 0.10
Nodes (8): IUnitOfWork, IEventBus, AuditLog, IAuditRepository, InMemoryAuditRepository, GetDocumentDownloadUrlUseCase, IStorageService, IBidRepository

### Community 8 - "Compliance & Provenance Domain"
Cohesion: 0.13
Nodes (20): VerifiedComplianceItem, WorkflowStatus, build_compliance_workflow_graph(), route_verification_outcome(), create_audit_event(), make_deterministic_verification_node(), deterministic_verification_node(), make_escalate_human_review_node() (+12 more)

### Community 9 - "Compliance & Provenance Domain"
Cohesion: 0.08
Nodes (12): apiPatch(), ComplianceItem, getComplianceItem(), Provenance, reviewComplianceItem(), UpdateComplianceItemRequest, UpdateComplianceItemResponse, BidStatusBadgeProps (+4 more)

### Community 10 - "Bid & Tender Management"
Cohesion: 0.10
Nodes (4): ValidationException, BidProject, CreateBidProjectProps, Money

### Community 11 - "AI Evaluation & Benchmarks"
Cohesion: 0.06
Nodes (31): AWS Cloud Architecture & Infrastructure Blueprint: TenderPulse AI, 1. Executive Summary & Design Principles, 2. End-to-End AWS Architecture Map, 3. Technology Evaluation Matrix 17 AWS Services, 4.10 AWS EventBridge Domain Events & Scheduled Jobs, 4.11 Amazon DynamoDB, 4.12 AWS AppSync / WebSockets, 4.13 Amazon CloudWatch & Container Insights (+23 more)

### Community 12 - "Bid & Tender Management"
Cohesion: 0.12
Nodes (17): ConfirmDocumentUploadResult, CreateBidResult, GenerateUploadUrlCommand, GenerateUploadUrlResult, GetDocumentDownloadUrlResult, ALLOWED_MIME_TYPES, DocumentType, MAX_DOCUMENT_SIZE_BYTES (+9 more)

### Community 13 - "Bid & Tender Management"
Cohesion: 0.13
Nodes (18): BidDetail, BidSummary, getBid(), getDocumentDownloadUrl(), apiGet(), ExecutionRules, listComplianceItems(), BidCard() (+10 more)

### Community 14 - "Button.tsx Cluster"
Cohesion: 0.07
Nodes (12): ButtonProps, EmptyStateProps, ErrorBannerProps, InputProps, LoadingSkeletonProps, ModalProps, StatusBadgeProps, StatusVariant (+4 more)

### Community 15 - ".execute() Cluster"
Cohesion: 0.09
Nodes (5): ConcurrencyConflictException, EntityNotFoundException, InMemoryComplianceItemRepository, StoredComplianceRecord, ComplianceItem

### Community 16 - "Compliance & Provenance Domain"
Cohesion: 0.08
Nodes (8): UnauthorizedDocumentAccessException, base_security_context(), setup_node_context(), test_secrets_are_not_exposed(), test_tenant_a_cannot_retrieve_tenant_b_data(), test_unauthorized_document_fails(), test_workflow_scope_cannot_expand(), valid_sec_context()

### Community 17 - "Bid & Tender Management"
Cohesion: 0.12
Nodes (3): InMemoryTenderDocumentRepository, TenderDocument, ITenderDocumentRepository

### Community 18 - "Bid & Tender Management"
Cohesion: 0.07
Nodes (28): AI Systems Architecture & First Principles: TenderPulse AI, 1. Architectural Philosophy: The Separation of Intelligence & Authority, 2.10 AI Workflow vs. Autonomous Agent, 2.11 Stateless vs. Stateful AI, 2.12 Deterministic Code vs. Model Reasoning: The Hard Boundary, 2.1 Large Language Models LLMs, 2.2 Tokens and Context Windows, 2.3 System, User, and Tool Messages Role Framing (+20 more)

### Community 19 - "AI Evaluation & Benchmarks"
Cohesion: 0.18
Nodes (8): get_synthetic_evaluation_suite(), ComplianceWorkflowEvaluator, CaseEvaluationResult, EvaluationCaseType, EvaluationSuiteMetrics, ExpectedItem, SyntheticEvaluationCase, DocumentChunk

### Community 20 - "Async SQS Ingestion Pipeline"
Cohesion: 0.13
Nodes (6): InternalQueueItem, MockSqsJobQueue, DeadLetterMessage, IJobQueue, IngestionJobMessage, QueueMessage

### Community 21 - "Auth & Tenant Security Context"
Cohesion: 0.19
Nodes (21): AuthUser, login(), LoginResponse, logout(), RefreshResponse, refreshTokens(), apiDelete(), apiFetch() (+13 more)

### Community 22 - "Auth & Tenant Security Context"
Cohesion: 0.14
Nodes (13): ProtectedRoute(), ProtectedRouteProps, useAuth(), ReviewActions(), ReviewActionsProps, Header(), Sidebar(), usePermission() (+5 more)

### Community 23 - "LangGraph Stateful AI Workflows"
Cohesion: 0.08
Nodes (26): LangChain, LangGraph, and Stateful AI Workflows: First Principles, 10. Retries, 11. Interrupts, 12. Human Approval Human-in-the-Loop, 13. Resumability & Time Travel, 1. Architectural Foundation & First Principles, 1. LangChain, 1. Mandatory Graph State Security Context (+18 more)

### Community 24 - "DomainException.ts Cluster"
Cohesion: 0.20
Nodes (7): DomainException, InvalidExecutionRulesException, InvalidProvenanceException, CreateComplianceItemProps, ComplianceStatusEnum, ExecutionRules, Provenance

### Community 26 - "Auth & Tenant Security Context"
Cohesion: 0.08
Nodes (25): AI Security, Multi-Tenant Isolation, and Threat Mitigation, 10. Security Test Suite Specification, 1. Foundational Axiom, 2. The Complete Security & Data Path, 3.1 Vector & Embedding Storage, 3.2 LangGraph State & Checkpoint Isolation, 3.3 S3 Object Storage Isolation, 3. Tenant Isolation Architecture (+17 more)

### Community 27 - "Bid & Tender Management"
Cohesion: 0.08
Nodes (25): System Architecture: TenderPulse AI, 1. Architectural Philosophy: From Business Workflow to System Design, 2.10 AWS DynamoDB, 2.11 AWS AppSync / WebSockets, 2.12 LangChain Core Linear Chains, 2.1 React 18 TypeScript + Vite, 2.2 NestJS TypeScript / Node.js, 2.3 FastAPI Python 3.11+ (+17 more)

### Community 28 - "base.json Cluster"
Cohesion: 0.08
Nodes (24): compilerOptions, alwaysStrict, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution (+16 more)

### Community 29 - "Domain Events & Event Bus"
Cohesion: 0.12
Nodes (4): AggregateRoot, IDomainEvent, DomainEventHandler, InMemoryEventBus

### Community 30 - "Bid & Tender Management"
Cohesion: 0.09
Nodes (23): Database Design & PostgreSQL Data Architecture: TenderPulse AI, 1. Architectural Philosophy & Principles, 2. Entity-Relationship & Relational Schema Diagram, 3.1 organizations Tenant Root, 3.2 users Identity & RBAC, 3.3 bids Bid Project Aggregate Root, 3.4 tender_documents PDF & Artifact Registry, 3.5 compliance_items Extracted Checklist Requirements (+15 more)

### Community 31 - "Auth & Tenant Security Context"
Cohesion: 0.09
Nodes (23): Human-in-the-Loop (HITL) Architecture: Human Review, Authorization & State Machine Resumption, 1. Architectural Philosophy: The Need for Human-in-the-Loop, 1. Automatic Zero Risk, Deterministic Utilities, 1. Tenant-Scoped Reviewer Access, 2. Decision Classification Matrix, 2. Reviewer Authorization & RBAC, 2. Validated Automatic AI Extraction with Deterministic Grounding Proof, 3. Duplicate Approval Prevention Idempotency (+15 more)

### Community 32 - "LangGraph Stateful AI Workflows"
Cohesion: 0.09
Nodes (22): AI Systems Engineering: From First Principles to Stateful Workflows, 10. AI Workflow vs. Autonomous Agent, 11. Stateless vs. Stateful AI, 12. Deterministic Code vs. Model Reasoning: The Hard Boundary, 1. Large Language Models LLMs, 2. Tokens and Context Windows, 3. System, User, and Tool Messages Role Framing, 4. Structured Output Constrained Decoding (+14 more)

### Community 33 - "package.json Cluster"
Cohesion: 0.09
Nodes (21): devDependencies, prettier, typescript, vitest, typescript, vitest, name, private (+13 more)

### Community 34 - "Auth & Tenant Security Context"
Cohesion: 0.15
Nodes (7): AISecurityException, CrossTenantAccessException, SecretDetectedException, ToolRateLimitExceededException, UnrestrictedAccessBlockedException, NetworkEgressGuard, test_unrestricted_url_access_is_impossible()

### Community 35 - "AiDocumentExtractor.ts Cluster"
Cohesion: 0.16
Nodes (10): AiDocumentExtractor, AiExtractorConfig, AiServiceExtractResponse, RawExtractedItem, DocumentContentNormalizer, NormalizedDocumentPage, DefaultDocumentExtractor, ExtractedComplianceItem (+2 more)

### Community 36 - "Bid & Tender Management"
Cohesion: 0.15
Nodes (6): createBid(), listBids(), CreateBidPage(), DashboardPage(), LoginPage(), react-router-dom

### Community 37 - "Compliance & Provenance Domain"
Cohesion: 0.10
Nodes (20): Low-Level Design (LLD): Tender Ingestion & Bid Compliance Management, 1. Scope & Objective, 2. Package & Directory Structure Modular Monolith, 3. Domain Model: Entities & Value Objects, 4.1 Bid Project State Machine BidStatus, 4.2 Compliance Item State Machine ComplianceStatus, 4. State Machines & Invariant Transitions, 5.1 BidProject Aggregate Root (+12 more)

### Community 38 - "Auth & Tenant Security Context"
Cohesion: 0.20
Nodes (8): UnauthorizedTenantAccessException, InternalServiceGuard, BulkIngestComplianceResult, BulkIngestComplianceUseCase, ExtractedComplianceItemInput, BulkIngestComplianceDto, BulkIngestPayload, InternalWorkerController

### Community 39 - "Bid & Tender Management"
Cohesion: 0.11
Nodes (19): Domain Knowledge: Indian Government Public Procurement, 1. Legal and Regulatory Framework, 2. Institutional Procurement Portals, 3. Anatomy of a Tender Package, 4. The Two-Packet Bidding Lifecycle, 5. Domain Terminology Glossary, 6. The Three Pillars of Technical Qualification, 7. The Disqualification Graveyard: Realistic Case Studies (+11 more)

### Community 40 - "Bid & Tender Management"
Cohesion: 0.11
Nodes (18): Comprehensive Security Review & Threat Assessment: TenderPulse AI, 1. Executive Summary & Review Scope, 2. Security Findings Summary Matrix, 3.1 Authentication & Session Security, 3.2 Authorization, Multi-Tenancy & IDOR Defense, 3.3 API Security, Request Limits & Abuse Controls, 3.4 File Storage, S3 Handshakes & Malicious Documents, 3.5 AI Security, Prompt Injection & Privacy (+10 more)

### Community 41 - "AI Evaluation & Benchmarks"
Cohesion: 0.16
Nodes (7): test_full_evaluation_suite_meets_all_quality_and_security_gates(), test_regression_corrigendum_precedence_conflict_resolution(), test_regression_cross_tenant_access_blocked(), test_regression_misleading_specimen_draft_refusal(), test_regression_missing_information_anti_hallucination(), test_regression_prompt_injection_override_neutralized(), test_regression_unauthorized_document_blocked()

### Community 42 - "Domain Events & Event Bus"
Cohesion: 0.17
Nodes (7): DomainEvent, BidProjectCreatedEvent, BidProjectCreatedPayload, ComplianceIngestionCompletedEvent, ComplianceIngestionCompletedPayload, ComplianceItemReviewedEvent, ComplianceItemReviewedPayload

### Community 43 - "Bid & Tender Management"
Cohesion: 0.15
Nodes (4): InvalidStateTransitionException, BidStatus, BidStatusEnum, DocumentStatusEnum

### Community 44 - "Bid & Tender Management"
Cohesion: 0.12
Nodes (17): Domain Events Architecture & Event Catalog: TenderPulse AI, 1. Architectural Philosophy: Event-Driven Foundations, 2.1 Command vs. Event: The Fundamental Distinction, 2.2 Event vs. Queue: Notification vs. Work Distribution, 2.3 Producer vs. Consumer, 2.4 Delivery Semantics, 2.5 Replay & Event Sourcing Trade-Offs, 2.6 Idempotency & Deduplication (+9 more)

### Community 45 - "Compliance & Provenance Domain"
Cohesion: 0.12
Nodes (17): Minimum Viable Product (MVP) Specification: TenderPulse AI, 1. MVP Objective & Philosophy, 2. End-to-End User Journey MVP, 3. System Architecture & Boundaries: AI vs. Deterministic, 4. MVP Data Schema: Compliance Item Contract, 5. Scope: In-Scope vs. Explicit Anti-Scope for MVP, 6. Success Criteria & Acceptance Metrics, AI Engine Handles: (+9 more)

### Community 46 - "Bid & Tender Management"
Cohesion: 0.12
Nodes (17): Multi-Tenant Security & RBAC Model: TenderPulse AI, 1. Authentication Guard JwtAuthGuard / InternalApiKeyGuard:, 1. Core Security Principles, 2. Authentication vs. Authorization, 2. Tenant Context Middleware TenantContextMiddleware:, 3.1 Entities & Boundary Definitions:, 3. Multi-Tenant RBAC Domain Model, 3. Permission Guard RequirePermissionsGuard: (+9 more)

### Community 47 - "Bid & Tender Management"
Cohesion: 0.12
Nodes (16): description, devDependencies, @tenderpulse/config, typescript, @tenderpulse/config, typescript, main, name (+8 more)

### Community 48 - "Bid & Tender Management"
Cohesion: 0.12
Nodes (16): description, devDependencies, @tenderpulse/config, typescript, @tenderpulse/config, typescript, main, name (+8 more)

### Community 49 - "Compliance & Provenance Domain"
Cohesion: 0.22
Nodes (7): BulkIngestComplianceCommand, ComplianceItemViewDto, ListComplianceItemsQuery, ListComplianceItemsUseCase, IComplianceItemRepository, ExecutionRulesProps, ProvenanceProps

### Community 50 - "Domain Events & Event Bus"
Cohesion: 0.23
Nodes (10): AuditEvent, listAuditEvents(), ApiError, ApiResult, AuditTimeline(), AuditTimelineProps, useApi(), UseApiReturn (+2 more)

### Community 51 - "Bid & Tender Management"
Cohesion: 0.17
Nodes (12): BidDocument, confirmDocumentUpload(), ConfirmUploadRequest, ConfirmUploadResponse, CreateBidRequest, CreateBidResponse, DownloadUrlResponse, generateUploadUrl() (+4 more)

### Community 52 - "AI Evaluation & Benchmarks"
Cohesion: 0.13
Nodes (15): AI Evaluation, Groundedness Verification, and Regression Testing Architecture, 1. First Principles: Why Ordinary Unit Tests Are Insufficient for LLMs, 2. The 12 AI Evaluation Dimensions, 3. The 3-Tier Evaluation Architecture, 4. Synthetic Evaluation Dataset Taxonomy, 5. Empirical Measured Results & Baseline Scorecard, 6. Continuous Regression Gating in CI/CD, CI/CD Gate Policy: (+7 more)

### Community 53 - "AI Evaluation & Benchmarks"
Cohesion: 0.13
Nodes (15): CI/CD Pipeline & Continuous Deployment Architecture: TenderPulse AI, 1. Architectural Philosophy & Zero-Tolerance Gates, 2. End-to-End Pipeline Workflow, 3. The 10 Pipeline Stages Explained, 4.1 Prompt Regression Tests test_evaluation_regression.py, 4.2 AI Evaluation Scorecards test_compliance_workflow.py, 4.3 Security & Tenant Isolation Regressions, 4. AI-Specific CI/CD Quality Gates (+7 more)

### Community 54 - "Bid & Tender Management"
Cohesion: 0.13
Nodes (15): Secure Object Storage & Document Architecture: TenderPulse AI, 1. Architectural Philosophy: Decoupling Compute from Blob Storage, 2. End-to-End Secure Document Path, 3. S3 Key Hierarchical Namespace & Deterministic Isolation, 4. Metadata: PostgreSQL as the Source of Truth vs. S3 Object Metadata, 5.1 Insecure Direct Object References IDOR, 5.2 Path Traversal & S3 Key Injection, 5.3 Oversized Files & Denial of Wallet (+7 more)

### Community 55 - "Compliance & Provenance Domain"
Cohesion: 0.13
Nodes (11): BidStatusType, BidSummaryDto, CreateBidRequest, ComplianceCategoryType, ComplianceItemDto, ComplianceStatusType, ExecutionRulesDto, ProvenanceDto (+3 more)

### Community 56 - "Architectural Decision Records"
Cohesion: 0.14
Nodes (14): ADR 0013: Deterministic AI Security, RAG Isolation, and Zero-Trust Guardrails, 1. Mandatory 13-Stage Defensive Pipeline, 2. Immutable SecurityContext, 3. Hard Deterministic RAG Isolation, 4. Untrusted Input Framing, 5. Deterministic Grounding & Output Validation, 6. Narrow Tools & Deny-by-Default Network Egress, 7. Zero Data Retention ZDR & India Data Residency (+6 more)

### Community 57 - "Bid & Tender Management"
Cohesion: 0.14
Nodes (14): Product Strategy & Definition: TenderPulse AI, 1. Product Vision, 2.1 The Indian Public Procurement Ecosystem, 2.2 The Disqualification Epidemic, 2.3 Economic Loss per Rejected Bid, 2. Market Context & The Problem, 3.1 The Economic Buyer, 3.2 The Daily End User (+6 more)

### Community 58 - "Compliance & Provenance Domain"
Cohesion: 0.18
Nodes (10): AUDIT_EVENTS, BIDS, COMPLIANCE_ITEMS, DEMO_USERS, DemoAuditEvent, DemoComplianceItem, DemoUser, readJsonBody() (+2 more)

### Community 59 - "Compliance & Provenance Domain"
Cohesion: 0.29
Nodes (6): ReviewComplianceItemCommand, ReviewComplianceItemResult, ReviewComplianceItemUseCase, ComplianceController, UpdateComplianceItemDto, UpdateComplianceItemPayload

### Community 61 - "Compliance & Provenance Domain"
Cohesion: 0.18
Nodes (11): AI Architecture & Workflow Specification: TenderPulse AI, 1. Architectural Philosophy & The Core Rule, 2. The 4-Stage Evolution of our AI Integration, 3.1 Node-by-Node Specification, 3. The LangGraph Compliance Extraction DAG, 4. Pydantic Schemas FastAPI Engine, 5. Explicit System Boundaries: AI vs. Deterministic, Stage 1: The Raw LLM Call Naive (+3 more)

### Community 62 - "Bid & Tender Management"
Cohesion: 0.18
Nodes (11): Asynchronous Job Architecture & Resilience: TenderPulse AI, 1. Architectural Philosophy: Decoupled Asynchronous Processing, 2.1 At-Least-Once Delivery, 2.2 Visibility Timeout & Worker Leases, 2.3 Retries & Exponential Backoff, 2.4 Dead-Letter Queues DLQ & Poison Pills, 2. Core Distributed Queue Concepts, 3. The End-to-End Pipeline (+3 more)

### Community 64 - "Auth & Tenant Security Context"
Cohesion: 0.20
Nodes (10): ADR 0011: AI Security, Multi-Tenant Isolation, and Defense-in-Depth, 1. Hard Tenant & Document Scoping Never Rely on Prompt Instructions, 2. Network Egress: Deny by Default, 3. Untrusted Data Framing & Sanitization, 4. Zero Data Retention ZDR Model Providers, Consequences, Context, Decision (+2 more)

### Community 65 - "tsconfig.json Cluster"
Cohesion: 0.22
Nodes (8): compilerOptions, jsx, lib, noEmit, exclude, extends, include, ../../packages/config/typescript/base.json

### Community 66 - "LangGraph Stateful AI Workflows"
Cohesion: 0.25
Nodes (8): PROJECT AGENT INSTRUCTIONS, Architecture principles, Core rule, Learning modes, Quality bar, Repository memory, Security and tenant isolation, Two equal goals

### Community 67 - "Async SQS Ingestion Pipeline"
Cohesion: 0.32
Nodes (3): CreateIngestionJobProps, JobStatus, IIngestionJobRepository

### Community 69 - "tsconfig.json Cluster"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, rootDir, exclude, extends, include, ../../packages/config/typescript/base.json

### Community 71 - "Domain Events & Event Bus"
Cohesion: 0.32
Nodes (5): ExtractionProgress(), ExtractionProgressProps, SSEProgressEvent, useSSE(), UseSSEReturn

### Community 72 - "AI Evaluation & Benchmarks"
Cohesion: 0.25
Nodes (8): ADR 0006: Server-Sent Events (SSE) & Smart Polling for Job Progress (Rejecting AWS AppSync), Consequences, Context, Evaluation & Decision, Status, The Problem, Why Reject AWS AppSync?, Why Server-Sent Events SSE + Smart Polling?

### Community 73 - "package.json Cluster"
Cohesion: 0.25
Nodes (7): description, exports, ./eslint/base.mjs, ./typescript/base.json, name, private, version

### Community 75 - "React Frontend & UI Components"
Cohesion: 0.29
Nodes (7): Engineering & Git Conventions, 1. Commit Message Convention Conventional Commits, 2. Branch Naming Strategy, 3. Pull Request & Quality Gate Requirements, Allowed Scopes:, Allowed Types:, Examples:

### Community 76 - "NestJS Application API"
Cohesion: 0.29
Nodes (7): ADR 0001: Two-Tier Service Boundary (NestJS Application API + FastAPI AI Engine), Alternatives Considered, Consequences, Context, Decision, Status, The Problem

### Community 77 - "AI Evaluation & Benchmarks"
Cohesion: 0.29
Nodes (7): ADR 0002: PostgreSQL as Transactional Source of Truth (Rejecting DynamoDB), Consequences, Context, Evaluation & Decision, Status, The Problem, Why DynamoDB is Insufficient / Harmful for this Domain:

### Community 78 - "Async SQS Ingestion Pipeline"
Cohesion: 0.29
Nodes (7): ADR 0003: SQS + Dead Letter Queue for Asynchronous Document Processing, Alternatives Considered, Consequences, Context, Decision, Status, The Problem

### Community 79 - "LangGraph Stateful AI Workflows"
Cohesion: 0.29
Nodes (7): ADR 0004: LangGraph for Stateful Extraction Loops (Rejecting Generic LangChain Chains), Alternatives Considered, Consequences, Context, Decision, Status, The Problem

### Community 80 - "S3 Presigned Storage Architecture"
Cohesion: 0.29
Nodes (7): ADR 0005: Direct S3 Uploads via Presigned URLs, Alternatives Considered, Consequences, Context, Decision, Status, The Problem

### Community 81 - "Architectural Decision Records"
Cohesion: 0.29
Nodes (7): ADR 0008: Domain-Driven Layered Architecture for Modular Monolith, Alternatives Considered, Consequences, Context, Decision, Status, The Problem

### Community 82 - "Architectural Decision Records"
Cohesion: 0.29
Nodes (7): ADR 0009: Explicit State Machine and Optimistic Concurrency Control, Alternatives Considered, Consequences, Context, Decision, Status, The Problem

### Community 83 - "Compliance & Provenance Domain"
Cohesion: 0.29
Nodes (7): ADR 0010: Immutable Provenance Value Object for Zero-Ungrounded Compliance, Alternatives Considered, Consequences, Context, Decision, Status, The Problem

### Community 84 - "Domain Events & Event Bus"
Cohesion: 0.29
Nodes (7): ADR 0012: Domain Events & In-Process Event Bus with Deferred EventBridge, Alternatives Considered, Consequences, Context, Decision, Status, The Problem

### Community 85 - "tsconfig.json Cluster"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../config/typescript/base.json

### Community 86 - "tsconfig.json Cluster"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../config/typescript/base.json

### Community 87 - "tsconfig.json Cluster"
Cohesion: 0.29
Nodes (6): compilerOptions, noEmit, exclude, extends, include, ./packages/config/typescript/base.json

### Community 88 - "LangGraph Stateful AI Workflows"
Cohesion: 0.33
Nodes (6): ADR 0007: Scoping & Boundary Decision for Redis and EventBridge, Consequences, Context, Decisions, Rules from AGENTS.md:, Status

### Community 90 - "LangGraph Stateful AI Workflows"
Cohesion: 0.50
Nodes (4): Project Status & Milestone Tracker, Current Milestone: Production Document + AI Pipeline Milestone 20, Next Immediate Action, Roadmap Stop Points as defined in AGENTS.md

## Knowledge Gaps
- **769 isolated node(s):** `tenderpulse-ai`, `Config`, `name`, `version`, `private` (+764 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1025 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Button.tsx Cluster` to `React Frontend & UI Components`, `Bid & Tender Management`, `Domain Events & Event Bus`, `Compliance & Provenance Domain`, `Bid & Tender Management`, `Domain Events & Event Bus`, `Bid & Tender Management`, `Auth & Tenant Security Context`, `Auth & Tenant Security Context`, `Auth & Tenant Security Context`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `uuid` connect `IUnitOfWork.ts Cluster` to `AiDocumentExtractor.ts Cluster`, `Bid & Tender Management`, `Domain Events & Event Bus`, `Compliance & Provenance Domain`, `Async SQS Ingestion Pipeline`, `Compliance & Provenance Domain`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `TenderDocument` connect `Bid & Tender Management` to `IUnitOfWork.ts Cluster`, `AiDocumentExtractor.ts Cluster`, `Bid & Tender Management`, `Bid & Tender Management`, `Async SQS Ingestion Pipeline`, `Domain Events & Event Bus`, `Bid & Tender Management`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `tenderpulse-ai`, `Config`, `name` to the rest of the system?**
  _769 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Human-in-the-Loop Review System` be split into smaller, more focused modules?**
  _Cohesion score 0.10545790934320073 - nodes in this community are weakly interconnected._
- **Should `IUnitOfWork.ts Cluster` be split into smaller, more focused modules?**
  _Cohesion score 0.13598519888991675 - nodes in this community are weakly interconnected._
- **Should `Compliance & Provenance Domain` be split into smaller, more focused modules?**
  _Cohesion score 0.08686868686868687 - nodes in this community are weakly interconnected._