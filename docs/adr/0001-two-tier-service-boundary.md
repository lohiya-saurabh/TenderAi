# ADR 0001: Two-Tier Service Boundary (NestJS Application API + FastAPI AI Engine)

## Status

Accepted

## Context

TenderPulse AI requires two fundamentally different types of computation:

1. **Core Business & Domain Management**: User authentication, multi-tenant isolation, organization roles (RBAC), bid lifecycle state machine, document metadata, audit logs, and compliance checklist CRUD.
2. **AI & Heavy Document Ingestion**: Parsing large (50MB–200MB) unstructured Indian government PDFs, layout analysis, OCR processing on scanned notices, vector chunking, and multi-step LLM extraction workflows.

### The Problem

- If we build everything in **Node.js (NestJS)**: The Python ecosystem is decades ahead in PDF parsing (PyMuPDF, pdfminer), computer vision/OCR (Tesseract, PaddleOCR), and AI agent orchestration (LangGraph). Node.js wrappers for PDF parsing frequently suffer from native memory leaks, lack deep font/layout extraction, and AI agent frameworks in JS/TS lag significantly behind Python.
- If we build everything in **Python (FastAPI)**: FastAPI is excellent for data science and AI APIs, but building enterprise multi-tenant SaaS with robust DDD (Domain-Driven Design), enterprise auth guards, modular dependency injection, migration pipelines, and strict relational transaction boundaries is significantly more mature, organized, and maintainable in TypeScript with NestJS.
- If we build a **Distributed Microservices Mesh**: Overkill for early-stage SaaS; adds network latency, distributed transaction complexity, service discovery overhead, and massive operational cost.

## Decision

We adopt a **Two-Tier Specialized Service Architecture**:

1. **NestJS (TypeScript)** serves as the **Primary Domain & API Boundary**:
   - Front-facing API gateway for the React SPA.
   - Enforces authentication, authorization, multi-tenancy, and audit logging.
   - Owns the primary transactional PostgreSQL database.
   - Issues S3 presigned upload URLs.
   - Dispatches document processing jobs to AWS SQS.
2. **FastAPI (Python 3.11+)** serves as the **AI & Document Intelligence Boundary**:
   - Operates behind the internal network (not exposed directly to the public internet).
   - Runs asynchronous workers consuming jobs from AWS SQS.
   - Leverages PyMuPDF, OCR engines, and LangGraph for structured compliance extraction.
   - Writes extraction results back to the database or posts them via internal webhook/queue.

## Alternatives Considered

1. **Single Monolith in NestJS**: Rejected due to poor PDF/OCR/AI ecosystem in Node.js.
2. **Single Monolith in FastAPI**: Rejected because building complex enterprise domain boundaries, multi-tenant RBAC, and business logic is less structured than NestJS's modular architecture.
3. **Full Microservices (Auth Service, Tender Service, Billing Service, AI Service, OCR Service)**: Rejected as severe premature over-engineering.

## Consequences

- **Positive**:
  - Leverages TypeScript's compile-time safety and NestJS's enterprise modularity for core SaaS business rules.
  - Leverages Python's native ecosystem for high-performance PDF manipulation, OCR, and AI state graphs.
  - Independent resource scaling: AI workers can scale horizontally on compute-heavy nodes (GPU/high-CPU) without scaling the web API tier.
- **Negative / Trade-off**:
  - Two languages (TypeScript + Python) in the repository.
  - Requires maintaining shared data contracts (JSON Schema / OpenAPI) between the two services.
