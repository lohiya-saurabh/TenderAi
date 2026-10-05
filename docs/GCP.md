# Production Infrastructure Blueprint: Google Cloud Platform (GCP) Target

**Status:** APPROVED ARCHITECTURAL BLUEPRINT  
**Version:** 2.0  
**Target Region:** `asia-south1` (Mumbai, India — DPDP Act 2023 Compliance)  
**Deployment Tooling:** Terraform (`infrastructure/terraform/`)  
**Deployment Policy:** Design & Specification only. Zero active deployments until authorized.

---

## 1. Executive Summary & Design Philosophy

TenderPulse AI is an enterprise-grade Tender Intelligence and Bid Readiness SaaS platform for Indian MSMEs, EPC contractors, and service providers. This document specifies the production infrastructure architecture on **Google Cloud Platform (GCP)** while strictly enforcing the **Cloud-Agnostic Architecture Rule**:

> **Core Invariant:** The application layer (Domain models, Use Cases, Value Objects, and Application Services) must remain 100% cloud-provider agnostic. Under no circumstances may provider-specific SDKs, naming conventions, or concepts (e.g., `GCS`, `PubSub`, `CloudRun`, `S3`, `SQS`, `AWS_REGION`) leak into domain or application logic.

All infrastructure capabilities are consumed by the application via pure TypeScript/Python ports (interfaces). GCP-specific implementations exist exclusively within the `infrastructure/` adapter layer.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           APPLICATION & DOMAIN LAYER                             │
│                                                                                  │
│   [ObjectStorage]    [MessageQueue]    [EventPublisher]         [Cache]          │
│          ▲                  ▲                 ▲                    ▲             │
└──────────┼──────────────────┼─────────────────┼────────────────────┼─────────────┘
           │                  │                 │                    │
     (Implements)       (Implements)      (Implements)         (Implements)
┌──────────┼──────────────────┼─────────────────┼────────────────────┼─────────────┘
│          ▼                  ▼                 ▼                    ▼             │
│   GcpStorageAdapter  GcpPubSubAdapter  GcpEventsAdapter  Memory/RedisAdapter     │
│                                                                                  │
│                        GCP INFRASTRUCTURE ADAPTERS                               │
│                         (apps/api/src/infrastructure/)                           │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Conceptual Capabilities & Component Necessity Evaluation

In adherence to the engineering rule against resume-driven over-engineering, every candidate technology was evaluated for real architectural necessity.

| Conceptual Capability | Cloud-Agnostic Port | Candidate GCP Service | Decision | Architectural Rationale & Trade-off |
| :--- | :--- | :--- | :--- | :--- |
| **Object Storage** | `ObjectStorage` | Cloud Storage (GCS) | **ADOPT** | **Essential.** Binary tender documents (10MB–200MB PDFs) and company evidence must not live in PostgreSQL. Presigned V4 URLs enable direct client upload/download without choking API container memory. |
| **Relational Database** | `DocumentRepository`, `WorkflowStore`, Aggregate Repositories | Cloud SQL for PostgreSQL 16 | **ADOPT** | **Essential.** Acid transactions, relational integrity, JSONB semi-structured capability queries, and row-level multi-tenancy. Managed automated backups and point-in-time recovery (PITR) eliminate database operational toil. |
| **Container Compute** | Runtime Environment | Cloud Run (v2) | **ADOPT** | **Essential.** Serverless container execution. Scales down to zero during nighttime and scales up automatically during burst tender submission deadlines (typically 15:00 and 18:00 IST). Zero Kubernetes management overhead. |
| **Asynchronous Queue** | `MessageQueue` | Cloud Pub/Sub (Pull) | **ADOPT** | **Essential.** Long-running document parsing and AI extraction (60s–180s) must be decoupled from HTTP request cycles. Pull subscription allows worker instances to pull based on active CPU capacity. |
| **Secret Storage** | Configuration Ingestion | Secret Manager | **ADOPT** | **Essential.** Stores database credentials, JWT secrets, and API keys. Eliminates unencrypted environment variables and prevents secret leakage into git or container layers. |
| **Customer Encryption** | Storage/DB Encryption | Cloud KMS (CMEK) | **ADOPT** | **Essential.** Indian public procurement security guidelines and DPDP Act 2023 compliance require customer-managed cryptographic keys for tenant document vaults. |
| **Edge & Ingress** | HTTP Gateway / CDN | Cloud Load Balancing + Cloud Armor | **ADOPT** | **Essential.** Single global Anycast IP terminating TLS 1.3, routing `/api/*` to NestJS, and enforcing WAF rate limiting and SQL injection protection at the edge. |
| **Distributed Cache** | `Cache` | Memorystore (Redis) | **REJECT (MVP)** | **Premature.** A dedicated Memorystore Redis instance costs $35–50/month idle. For MVP, in-process LRU cache and PostgreSQL-backed distributed locks completely fulfill the need. Deferred to Phase 2. |
| **Global Database** | Database | Cloud Spanner | **REJECT** | **Over-engineered.** Spanner costs $600+/month minimum and is designed for multi-region active-active workloads. TenderPulse is bound to India (`asia-south1`) by legal data residency rules; standard PostgreSQL is superior. |
| **Container Orchestration** | Compute | Google Kubernetes Engine (GKE) | **REJECT** | **Over-engineered.** GKE incurs a continuous $74/month cluster management fee plus node pools, requiring ingress controller maintenance, cert-manager, and cluster upgrades for a two-tier modular monolith. |
| **Message Streaming** | Queue | Managed Kafka | **REJECT** | **Over-engineered.** Document processing is discrete, task-based queueing, not high-throughput distributed event streaming. Pub/Sub is serverless and zero-maintenance. |

---

## 3. Network Architecture & Security Boundaries

All stateful resources (Cloud SQL, Private Service Connect endpoints) are strictly quarantined inside a private Virtual Private Cloud (VPC) with **zero public IP access**.

```
                                  INTERNET
                                     │
                                     │ HTTPS (TLS 1.3)
                                     ▼
                     ┌───────────────────────────────┐
                     │   Cloud DNS: app.tenderpulse.in │
                     └───────────────┬───────────────┘
                                     │
                                     ▼
                     ┌───────────────────────────────┐
                     │ Cloud Load Balancer + Armor   │
                     │  (WAF: Rate Limit, OWASP Top10)│
                     └───────┬───────────────┬───────┘
                             │               │
        path: /* (Static SPA)│               │ path: /api/*
                             ▼               ▼
                 ┌────────────────┐      ┌─────────────────────────┐
                 │ Cloud Storage  │      │ Cloud Run: Web API      │
                 │ (Public Bucket)│      │ (NestJS Modular Monolith)│
                 └────────────────┘      └───────────┬─────────────┘
                                                     │
                             Serverless VPC Access   │ (VPC Connector)
                             Connector               │
                                                     ▼
═══════════════════════════════════════════════════════════════════════════════════
VPC: tp-prod-vpc (10.0.0.0/16) — Region: asia-south1 (Mumbai)
───────────────────────────────────────────────────────────────────────────────────
  Subnet: tp-app-subnet (10.0.1.0/24)
    ├── Cloud Run Jobs (Ingestion & AI Extraction Workers)
    └── Internal Cloud Run Services (FastAPI AI Engine)
  
  Subnet: tp-db-subnet (10.0.2.0/24) [Private Service Access - No Public IPs]
    └── Cloud SQL for PostgreSQL 16 (Primary + Standby HA)
         (Port 5432 accessible ONLY from VPC Connector via IAM DB Auth)

  Egress Infrastructure:
    └── Cloud NAT Gateway (Provides static outbound IP for DigiLocker/GeM APIs)
═══════════════════════════════════════════════════════════════════════════════════
```

### 3.1 Network Isolation Rules
1. **Zero Public Database Exposure**: Cloud SQL has `ipv4_enabled = false`. Access is strictly through Google Private Service Access peering within the VPC.
2. **Serverless VPC Access**: Cloud Run instances communicate with Cloud SQL via a Serverless VPC Access Connector (`10.0.8.0/28`).
3. **Internal-Only AI Engine**: The FastAPI AI service is deployed with ingress control set to `internal-and-cloud-load-balancing`. It cannot be invoked directly from the public internet.
4. **Controlled External Egress**: Outbound connections to external procurement portals (GeM, CPPP) and identity providers (DigiLocker) route through a Cloud NAT gateway with reserved static egress IPs for IP whitelisting.

---

## 4. Detailed Component Blueprints

### 4.1 Relational Database: Cloud SQL for PostgreSQL 16

- **Instance Tier**: `db-custom-2-7680` (2 vCPU, 7.5 GB RAM) for production baseline; scalable with zero downtime.
- **High Availability (HA)**: Regional High Availability enabled with automatic synchronous replication across dual zones (`asia-south1-a` primary, `asia-south1-b` standby). Automatic failover occurs in <60 seconds.
- **Storage Engine**: SSD persistent disk with automatic storage increase enabled.
- **Connection Management**:
  - Connection pooling via NestJS built-in pool (`max: 20` per container instance).
  - Cloud SQL Auth Proxy sidecar / native Unix domain socket in Cloud Run ensuring mutual TLS (mTLS) with ephemeral client certificates.
- **Point-in-Time Recovery (PITR)**: Write-Ahead Logging (WAL) archived to GCS continuously, allowing restoration to any specific second within the last 7 days.
- **Automated Backups**: Nightly snapshot at 02:00 IST with 30-day retention across separate failure domains.

### 4.2 Object Storage: Cloud Storage (GCS)

- **Bucket Strategy**: Single multi-tenant production bucket `tp-prod-documents-asia-south1` with strictly enforced logical path partitioning:
  ```
  tenants/{organizationId}/bids/{bidId}/{documentId}/{fileName}
  tenants/{organizationId}/evidence/{evidenceId}/{fileName}
  tenants/{organizationId}/artifacts/{bidCaseId}/{artifactFileName}
  ```
- **Access Control**: Uniform Bucket-Level Access enabled (ACLs disabled). Object access is granted exclusively through short-lived presigned URLs or explicit Workload Identity IAM.
- **Presigned URL Security**:
  - Upload URLs: Restrict `Content-Type: application/pdf`, `Content-Length <= 100MB`, TTL 900 seconds (15 minutes).
  - Download URLs: Response content-disposition set to `attachment; filename="..."`, TTL 3600 seconds (1 hour).
- **Object Versioning**: Enabled to defend against accidental deletion or ransomware overwrites.
- **Lifecycle Management**: Automatically transitions unaccessed tender documents to `NEARLINE` storage after 90 days and `COLDLINE` after 365 days, cutting storage costs by 60%.
- **Encryption**: Customer-Managed Encryption Keys (CMEK) via Cloud KMS.

### 4.3 Asynchronous Queue: Cloud Pub/Sub

- **Decoupled Architecture**: Replaces inline HTTP extraction with background queue consumption.
- **Topic Configuration**:
  - Main Topic: `tp-prod-document-ingestion-topic`
  - Dead-Letter Topic (DLT): `tp-prod-document-ingestion-dlt`
- **Subscription Configuration**:
  - Subscription: `tp-prod-document-ingestion-sub` (Pull type).
  - Acknowledgment Deadline: 300 seconds (5 minutes) to accommodate large 100-page tender OCR and normalization.
  - Lease Extension: Worker calls `modifyAckDeadline` periodically while actively processing.
  - Retry Policy: Exponential backoff (initial delay: 10s, max delay: 300s).
  - Dead-Letter Redrive: Automatically routes to DLT after 5 consecutive failed processing attempts.
- **Monitoring & Alerting**: Cloud Monitoring alert triggers immediately if DLT message count exceeds zero.

### 4.4 Container Compute: Cloud Run (v2)

Two discrete execution environments deployed from distroless container images:

#### Service A: NestJS Modular Monolith (`tp-prod-api`)
- **Responsibility**: HTTP API, Authentication, Tenant Resolution, RBAC, Domain Evaluation Engines, SSE Progress.
- **CPU/Memory**: 1 vCPU, 1024 MiB RAM.
- **Scaling Limits**: Min instances: 1 (eliminates cold starts during business hours), Max instances: 10.
- **Concurrency**: 80 concurrent requests per container instance.
- **VPC Egress**: Route private IP ranges (`10.0.0.0/16`) through the Serverless VPC Connector.

#### Service B: FastAPI AI Engine & Extraction Worker (`tp-prod-ai-worker`)
- **Responsibility**: Document OCR, Chunking, Deterministic Clause Extraction, LangGraph Workflows, Grounding Verification.
- **CPU/Memory**: 2 vCPU, 4096 MiB RAM (sized for PDF text parsing and embeddings).
- **Execution Mode**: Cloud Run Worker / Job listening to the Pub/Sub pull subscription.
- **Scaling Limits**: Min instances: 0 (scales to zero when queue is empty), Max instances: 5.
- **Concurrency**: 1 concurrent message per worker instance (CPU-bound deterministic and AI extraction isolation).

### 4.5 Secret Management: Secret Manager

- **Zero Plaintext Secrets**: Database credentials, HMAC-SHA256 JWT keys, internal service keys, and third-party API tokens are stored as versioned secrets.
- **Runtime Access**: Cloud Run service accounts are granted the narrow `roles/secretmanager.secretAccessor` permission on specific secret resources.
- **Secret Mounting**: Secrets are mounted as in-memory files at `/secrets/` or resolved as environment variables at container startup.
- **Rotation**: Supported via automatic version tracking without container rebuilds.

### 4.6 Encryption & Key Management: Cloud KMS

- **Key Ring**: `tp-prod-keyring` located in `asia-south1`.
- **CryptoKey Purpose**: `ENCRYPT_DECRYPT` (Symmetric AES-256).
- **Key Hierarchy**:
  - `tp-db-cmek`: Encrypts Cloud SQL persistent storage and automated snapshots.
  - `tp-storage-cmek`: Encrypts Cloud Storage bucket data and backups.
  - `tp-tokens-key`: Used for signing and verifying system-level authentication claims.
- **Key Rotation**: Automated 90-day rotation period. Previous versions remain available for decryption of historical archives.

---

## 5. High Availability, Backups & Disaster Recovery

| Metric | Target | Realization Strategy |
| :--- | :--- | :--- |
| **RPO (Recovery Point Objective)** | **$\le$ 5 minutes** | Cloud SQL continuous WAL archiving to Cloud Storage. Every committed transaction is protected. |
| **RTO (Recovery Time Objective)** | **$\le$ 30 minutes** | Infrastructure as Code (Terraform) automated provisioning + Cloud SQL regional HA automatic failover (<60s). |
| **High Availability (HA)** | **99.95%** | Multi-zone deployment across `asia-south1-a` and `asia-south1-b`. Cloud Run automatically spans zones. |

### Disaster Recovery Runbook (Summary)
1. **Zonal Outage (e.g., `asia-south1-a` down)**: Cloud SQL initiates automatic regional failover to `asia-south1-b`. Cloud Run distributes incoming traffic to healthy instances in remaining zones. Zero human intervention required.
2. **Accidental Database Corruption/Deletion**: Execute Cloud SQL point-in-time recovery to a clone instance at timestamp $T - 5\text{ minutes}$. Re-point Serverless VPC Access Connector.
3. **Catastrophic Cloud Storage Deletion**: Bucket object versioning allows automated rollback of deleted markers via `gsutil` / Terraform lifecycle scripts.

---

## 6. Observability, Telemetry & Auditability

1. **Structured JSON Logging**:
   - Both NestJS and FastAPI write structured JSON to `stdout`.
   - Fields: `severity`, `timestamp`, `traceId`, `tenantId`, `userId`, `message`, `context`.
   - Native Cloud Logging integration automatically groups logs by Cloud Run request traces.
2. **Distributed Tracing**:
   - `traceparent` (W3C standard) propagated across Frontend $\rightarrow$ NestJS $\rightarrow$ Pub/Sub $\rightarrow$ AI Worker.
   - Traces visualized end-to-end in Cloud Trace.
3. **Alerting Policies**:
   - **P0 Alert**: Cloud Run 5xx error rate $> 1\%$ over a 5-minute window $\rightarrow$ PagerDuty / On-Call.
   - **P0 Alert**: Pub/Sub Dead-Letter Topic message count $> 0$ $\rightarrow$ Immediate notification.
   - **P1 Alert**: Cloud SQL CPU utilization $> 80\%$ for 15 minutes $\rightarrow$ Slack `#eng-alerts`.
   - **P1 Alert**: Cloud Storage presigned upload failure count $> 5$ in 10 minutes.

---

## 7. Cost Modeling & Budget Guardrails (Target: Initial MSME SaaS Phase)

| Infrastructure Component | Sizing & Configuration | Estimated Monthly Cost (USD) |
| :--- | :--- | :--- |
| **Cloud Run (API & Worker)** | 1-2 vCPU, scale-to-zero when idle, 1 warm instance | $25 – $40 |
| **Cloud SQL for PostgreSQL** | 2 vCPU, 7.5 GB RAM, 50 GB SSD Storage (Regional HA) | $110 – $140 |
| **Cloud Storage** | 200 GB active data + 500 GB nearline/coldline | $6 – $12 |
| **Cloud Pub/Sub** | 100,000 document processing messages/month | $0 (Free Tier covers up to 10GB) |
| **Cloud Load Balancing & Armor** | 1 Forwarding Rule + WAF basic rules | $20 – $28 |
| **Secret Manager & KMS** | 10 active secrets + 3 KMS keys with crypto operations | $4 – $8 |
| **Cloud NAT Gateway** | Egress traffic for external APIs | $8 – $15 |
| **Total Estimated Run Rate** | **Production High-Availability Baseline** | **$173 – $243 / month** |

*Budget Alert configured at $250/month with automated email notifications at 50%, 80%, and 100% thresholds.*
