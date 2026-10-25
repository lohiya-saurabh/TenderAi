# TenderPulse AI

<p align="center">
  <strong>Enterprise Multi-Agent Platform for Autonomous Tender Ingestion, Risk Assessment & Compliance Matrix Generation</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/NestJS-10.x-ea2845?logo=nestjs" alt="NestJS" />
  <img src="https://img.shields.io/badge/React-18.x-61dafb?logo=react" alt="React 18" />
  <img src="https://img.shields.io/badge/Python-3.11-3776ab?logo=python" alt="Python 3.11" />
  <img src="https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/LangGraph-Stateful_Agents-orange?logo=langchain" alt="LangGraph" />
  <img src="https://img.shields.io/badge/PostgreSQL-Drizzle_ORM-336791?logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

---

## Executive Summary

**TenderPulse AI** is a production-grade, multi-tenant enterprise SaaS platform engineered to eliminate hundreds of manual engineering hours spent analyzing complex government and corporate procurement tenders (RFP/RFQ/NIT). 

Tender documents frequently span hundreds of pages of intricate legal clauses, technical specifications, and stringent qualification criteria. TenderPulse orchestrates a two-tier distributed system combining a **NestJS Orchestrator API** with a **FastAPI LangGraph AI State Machine** to autonomously ingest 100MB+ PDFs, parse qualification criteria, extract compliance requirements, evaluate bidder company documents, and construct an immutable, audited **Compliance Matrix**.

---

## System Architecture

TenderPulse is architected around a **Two-Tier Distributed Service Boundary** with strict domain-driven separation of concerns:

```
                                  ┌────────────────────────┐
                                  │   React 18 / Vite UI   │
                                  │   (Tailwind / Radix)   │
                                  └───────────┬────────────┘
                                              │
                      ┌───────────────────────┼────────────────────────┐
                      │ Authenticated REST /  │ Direct Presigned       │
                      │ Realtime Events (SSE) │ Binary PUT (<100MB)    │
                      ▼                       ▼                        ▼
         ┌─────────────────────────┐     ┌───────────────────────────────────┐
         │  NestJS Orchestration   │     │      Cloud Object Storage         │
         │  (Single-Writer DB /    │     │      (AWS S3 / GCP Cloud Storage) │
         │   Zero-Trust Auth /     │     └─────────────────┬─────────────────┘
         │   Transactional Outbox) │                       │
         └────────────┬────────────┘                       │
                      │                                    │ Presigned Read
                      │ Domain Events                      │ (No RAM bloat)
                      ▼ (SQS / PubSub)                     │
         ┌─────────────────────────┐                       │
         │   FastAPI AI Worker     │◄──────────────────────┘
         │   (LangGraph Cyclic     │
         │    Multi-Agent Engine)  │
         └────────────┬────────────┘
                      │
                      │ Validated Results & Provenance
                      ▼
         ┌─────────────────────────┐
         │  PostgreSQL (Drizzle)   │
         │  - Multi-Tenant Schema  │
         │  - Immutable Audit Log  │
         └─────────────────────────┘
```

### Architectural Pillars

1. **Two-Tier Orchestration vs. Worker Separation ([ADR 0001](docs/adr/0001-two-tier-service-boundary.md))**:
   - **NestJS Orchestrator**: Sole authority over user authentication, tenant scoping, database writes, and external API gateways.
   - **FastAPI AI Worker**: Headless, stateless worker dedicated strictly to high-throughput compute, vector chunking, and cyclic LangGraph state machine execution.

2. **Direct-to-Storage Presigned Uploads ([ADR 0005](docs/adr/0005-s3-direct-upload-presigned-urls.md))**:
   - Web clients request cryptographically signed URLs from the API and upload large PDF files directly to AWS S3 or Google Cloud Storage.
   - Eliminates in-memory buffer exhaustion and prevents Node.js event-loop starvation when processing multi-megabyte tender dossiers.

3. **Zero-Trust Multi-Tenant Isolation & Anti-IDOR Enforcement ([ADR 0011](docs/adr/0011-ai-security-and-tenant-isolation.md))**:
   - Caller tenant identity (`organizationId`) is anchored exclusively in verified JWT claims (`TenantContextHolder`).
   - Every database query and storage prefix operation enforces strict tenant boundary predicates (`WHERE organization_id = :orgId`), preventing Confused Deputy and Insecure Direct Object Reference (IDOR) attacks.

4. **Deterministic Compliance Engine with Immutable Provenance ([ADR 0010](docs/adr/0010-provenance-value-object-immutability.md), [ADR 0021](docs/adr/0021-evidence-first-compliance-engine.md))**:
   - Every compliance item links directly to verbatim tender text, source document ID, page number, and bounding box coordinates.
   - Provenance records are treated as immutable value objects to ensure auditability during legal procurement disputes.

5. **Cloud-Provider-Agnostic Ports & Adapters ([ADR 0014](docs/adr/0014-cloud-agnostic-ports-and-gcp-implementation.md))**:
   - Domain logic depends strictly on generic interfaces (`IStorageService`, `IJobQueue`, `IEventPublisher`).
   - Swappable infrastructure adapters provide first-class support for both **AWS** (S3, SQS, EventBridge) and **GCP** (GCS, Cloud Pub/Sub, Cloud Tasks), with in-memory mock adapters for zero-cloud local testing.

---

## Core Capabilities

- **Automated Tender Document Intake**: Upload Notice Inviting Tender (NIT), General Conditions of Contract (GCC), Special Conditions of Contract (SCC), and Bill of Quantities (BOQ).
- **LangGraph Clause Extraction**: Deconstructs dense procurement legalese into classified clauses (Eligibility, Technical Specs, Financial Covenants, Penalties, Payment Milestones).
- **Bid / No-Bid Decision Matrix**: Evaluates tender requirements against company profile (turnover, technical experience, blacklisting status) to compute an objective suitability score.
- **Evidence-First Compliance Matching**: Cross-references company documentation against mandatory tender clauses, classifying each requirement as `Compliant`, `Non-Compliant`, or `Ambiguous`.
- **Human-in-the-Loop Review Console**: High-confidence assessments (>=90%) can be auto-approved, while marginal or ambiguous clauses are flagged for human legal team verification.
- **Enterprise Notification System**: Real-time server-sent events (SSE) and notification preferences notify procurement officers of deadline changes, extraction progress, and high-risk clause findings.

---

## Technology Stack

| Domain | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Radix UI Primitives, Lucide Icons, TanStack Table |
| **Backend API** | NestJS 10, Node.js 20+, TypeScript, Drizzle ORM, PGlite (Embedded) / PostgreSQL 15+ |
| **AI & Orchestration** | Python 3.11+, FastAPI, LangGraph, Pydantic v2, Docling Parser Engine, 3-Tier Structural RAG |
| **Storage & Cloud** | AWS S3 / Google Cloud Storage (Presigned URLs), AWS SQS / GCP Cloud Pub/Sub |
| **Architecture Patterns** | Domain-Driven Design (DDD), Ports & Adapters (Hexagonal), Transactional Outbox, CQRS |
| **Quality & Tooling** | Vitest, Pytest, Playwright (E2E), ESLint, Prettier, Docker & Docker Compose |

---

## Repository Structure

```
.
├── apps/
│   ├── api/             # NestJS enterprise backend (Auth, Bids, Documents, Compliance)
│   ├── ai/              # FastAPI Python service (LangGraph 12-node workflow, Docling, RAG)
│   └── web/             # React 18 Single-Page Application (Procurement dashboard & tables)
├── packages/
│   ├── shared-types/    # Domain DTOs, interfaces, and cross-boundary type definitions
│   └── ui/              # Reusable React component library & design tokens
├── docs/                # Comprehensive technical documentation & 28 Architectural Decision Records
│   ├── adr/             # Architecture Decision Records (0001 - 0028)
│   ├── ARCHITECTURE.md  # Detailed system architecture and service boundaries
│   ├── DATABASE.md      # Relational schema, Drizzle definitions, and indexing strategies
│   └── SECURITY_MODEL.md# Multi-tenant isolation and security controls
├── infrastructure/      # Terraform configurations and cloud provisioning templates
├── scripts/             # Local development runners, DB seeders, and supervisor scripts
└── docker-compose.yml   # Multi-container local orchestration
```

---

## Quickstart & Local Development

### Prerequisites

- **Node.js**: v20+ with `npm` v10+
- **Python**: v3.11+
- **Docker & Docker Compose** (Optional, for containerized services)

### 1. Installation

Clone the repository and install all monorepo dependencies:

```bash
git clone https://github.com/lohiya-saurabh/TenderAi.git
cd TenderAi

# Install Node monorepo dependencies
npm install

# Setup Python AI service virtual environment
cd apps/ai
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ../..
```

### 2. Environment Configuration

Copy the sample environment variables:

```bash
cp .env.example .env
```

The application runs out of the box in **Zero-Cloud Mode** using embedded `@electric-sql/pglite` and in-memory storage/queue adapters, requiring no external AWS or GCP credentials for local development.

### 3. Launch Development Environment

Run the unified development script to start all services simultaneously:

```bash
./scripts/dev.sh
```

This launches:
- **FastAPI AI Worker**: `http://localhost:8000` (Swagger docs at `/docs`)
- **NestJS API Gateway**: `http://localhost:3000`
- **React Frontend**: `http://localhost:5173`

---

## Verification & Test Suite

The codebase maintains strict quality gates and comprehensive automated test coverage across all layers:

```bash
# Monorepo TypeScript type checking (0 errors across all workspaces)
npm run type-check

# Run NestJS API unit and integration tests (245 tests)
npm --workspace=apps/api run test

# Run React Web UI unit tests (163 tests)
npm --workspace=apps/web run test

# Run Python AI worker test suite (113 tests)
cd apps/ai && pytest
```

---

## Documentation

Comprehensive architecture guides and ADRs are available in the [`docs/`](docs/) directory:

- [System Architecture](docs/ARCHITECTURE.md) — Two-tier service boundary and target topology.
- [Product Specifications](docs/PRODUCT.md) — Bidder workflows and domain aggregate model.
- [Database Schema & Indexes](docs/DATABASE.md) — Relational schema, multi-tenant tables, and audit logs.
- [Security & Tenant Isolation](docs/SECURITY_MODEL.md) — Defense-in-depth, JWT verification, and data isolation.
- [Architectural Decision Records (ADRs)](docs/adr/) — 22 formal ADRs documenting key trade-offs and decisions.

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
