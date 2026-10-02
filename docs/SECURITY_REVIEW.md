# Comprehensive Security Review & Threat Assessment: TenderPulse AI

**Date**: October 2026  
**Target Scope**: `@tenderpulse/api`, `apps/ai`, `@tenderpulse/web`, `infrastructure/terraform/`, Data Architecture, Cloud & AI Boundaries  
**Security Standard**: Zero-Trust Multi-Tenancy, DPDP Act 2023 Compliance, OWASP Top 10, OWASP Top 10 for LLMs  

---

## 1. Executive Summary & Review Scope

This security audit performs an end-to-end vulnerability assessment of **TenderPulse AI** across all 8 core domains:
1. **Authentication & Session Security**
2. **Authorization, Multi-Tenancy & IDOR Defense**
3. **API Security, Request Limits & Abuse Controls**
4. **File Storage, S3 Handshakes & Malicious Document Handling**
5. **AI Security, Prompt Injection, RAG Isolation & Data Privacy**
6. **AWS Cloud Infrastructure, IAM Least Privilege & Network Topology**
7. **Database Architecture, SQL Injection, RLS & Migration Safety**
8. **Asynchronous Processing, SQS Queues & Worker Resilience**

Issues are classified under **CRITICAL**, **HIGH**, **MEDIUM**, and **LOW** severity.

---

## 2. Security Findings Summary Matrix

| ID | Domain | Vulnerability / Threat | Severity | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **AuthN / Secrets** | Non-constant-time string comparison in internal service authentication (`!==` and `!=`) | **HIGH** | **Remediated** |
| **SEC-02** | **AuthN / Secrets** | Hardcoded fallback secret in `InternalServiceGuard.ts` when env var is omitted | **HIGH** | **Remediated** |
| **SEC-03** | **API / Abuse** | Missing JSON request body size limit in HTTP request reader (`readJsonBody`) | **HIGH** | **Remediated** |
| **SEC-04** | **API / Pagination** | Unbounded list endpoints missing pagination limits (`limit`, `offset`), causing DoS risk | **MEDIUM** | **Remediated** |
| **SEC-05** | **AuthZ / IDOR** | Development server routes missing explicit tenant scoping on detail endpoints | **MEDIUM** | **Remediated** |
| **SEC-06** | **Files / Storage** | Presigned S3 upload MIME-type enforcement relies on client-provided Content-Type header | **MEDIUM** | **Documented & Guarded** |
| **SEC-07** | **AI / Exfiltration** | Lack of automated pre-prompt secret regex scrubbing on tool input strings | **MEDIUM** | **Remediated** |
| **SEC-08** | **AWS / IAM** | Broad foundation model wildcard in Bedrock IAM policy (`foundation-model/*`) | **LOW** | **Remediated** |
| **SEC-09** | **Database / RLS** | Connection poolers (PgBouncer) risk tenant variable leakage without transaction scoping | **HIGH** | **Architecturally Guarded** |
| **SEC-10** | **Async / Replay** | SQS message spoofing prevention via trusted DB authorization re-verification | **CRITICAL** | **Architecturally Verified** |

---

## 3. Deep-Dive Domain Reviews & Findings

### 3.1 Authentication & Session Security

#### Assessment:
- **Session & Token Architecture**:
  - Access tokens are asymmetric RS256 JWTs with a 15-minute lifespan containing `userId`, `organizationId`, and `role`.
  - Refresh tokens are high-entropy, opaque strings stored in PostgreSQL with 30-day expiration, support immediate revocation by `ADMIN`, and rotate upon every use.
  - Logout revokes the refresh token record in PostgreSQL and clears client storage.
- **Vulnerabilities Identified**:
  - **SEC-01 (HIGH)**: `InternalServiceGuard.ts` and `apps/ai/src/tenderpulse_ai/main.py` utilized standard equality operators (`!==` and `!=`) for comparing incoming `X-Internal-Service-Key` headers against secrets. This is susceptible to side-channel timing attacks where token characters can be deduced byte-by-byte.
  - **SEC-02 (HIGH)**: `InternalServiceGuard.ts` had a hardcoded default fallback string (`'tenderpulse-internal-secret-2026'`) if `process.env['INTERNAL_SERVICE_KEY']` was undefined in production.

#### Remediation:
- Updated `InternalServiceGuard.ts` to use `crypto.timingSafeEqual()` with length checks and throw an explicit error if `INTERNAL_SERVICE_KEY` environment variable is not defined.
- Updated `apps/ai/src/tenderpulse_ai/main.py` to use `secrets.compare_digest()` for constant-time secret comparison.

---

### 3.2 Authorization, Multi-Tenancy & IDOR Defense

#### Assessment:
- **Tenant Isolation**:
  - Node.js runtime leverages `AsyncLocalStorage` (`TenantContextHolder`) to maintain fiber-safe tenant context per request, eliminating concurrency bleed between simultaneous HTTP requests.
  - Atomic permissions matrix (`Permissions.DOCUMENTS_UPLOAD`, `Permissions.COMPLIANCE_REVIEW`) prevents role explosion.
- **Anti-IDOR Implementation**:
  - All repository lookups require `(id, organizationId)`. When an entity is not found within the authenticated tenant boundary, the application returns `404 Not Found` (never `403 Forbidden`) to prevent competitive resource enumeration.
- **Findings**:
  - **SEC-05 (MEDIUM)**: Standalone development server in `apps/api/src/server.ts` permitted looking up `/api/v1/bids/:id` without matching against user's authenticated `organizationId`.

---

### 3.3 API Security, Request Limits & Abuse Controls

#### Assessment:
- **Validation**:
  - Domain entities validate all incoming parameters (MIME type whitelist, SHA-256 regex, non-negative monetary amounts).
- **Request Body Limits & Abuse**:
  - **SEC-03 (HIGH)**: `readJsonBody()` in `server.ts` read unconstrained data chunks into memory without a byte length cap. An attacker could transmit a 100MB malicious JSON payload causing Node.js event loop starvation or Out-of-Memory (OOM) crashes.
- **Pagination**:
  - **SEC-04 (MEDIUM)**: Bids and compliance lists were returned without max page boundaries. For organizations with thousands of requirements, this consumes excessive bandwidth and database memory.

#### Remediation:
- Added a 1MB hard body size limit in `readJsonBody()`: requests exceeding `1,048,576` bytes are immediately rejected with HTTP `413 Payload Too Large`.
- Added pagination parameters (`limit`, `offset`) with a default of 50 and maximum cap of 100 items per request.

---

### 3.4 File Storage, S3 Handshakes & Malicious Documents

#### Assessment:
- **Presigned Upload Workflow**:
  1. Client sends file metadata (`fileName`, `sizeBytes`, `mimeType`, `checksumSha256`).
  2. NestJS validates tenant boundaries and generates an isolated S3 key: `tenants/{orgId}/bids/{bidId}/{docId}/{sanitizedFileName}`.
  3. Presigned URL is generated with 15-minute expiration (`expiresInSeconds: 900`).
  4. Client uploads directly to S3 without traversing the API gateway.
  5. Client calls `/confirm`, where the backend runs an out-of-transaction S3 `HeadObject` checking that file size and SHA-256 match.
- **Path Traversal & Filename Sanitization**:
  - `path.basename()` combined with alphanumeric regex `baseName.replace(/[^a-zA-Z0-9._-]/g, '_')` eliminates `../` directory traversal attacks.
- **Malicious Documents & PDF Exploits**:
  - Ingestion parser extracts raw text streams via PyMuPDF/pdfplumber with JavaScript, embedded binaries, and macro execution disabled by default.

---

### 3.5 AI Security, Prompt Injection & Privacy

#### Assessment:
- **Prompt Injection & Delimiter Hijacking**:
  - Untrusted PDF text is framed within XML boundaries: `<untrusted_document_data doc_id="..." page="...">`.
  - Closing tag collisions (`</untrusted_document_data>`) are automatically escaped by `SecretSanitizer.wrap_untrusted_data`.
  - System instructions explicitly reinforce that content inside `<untrusted_document_data>` is passive data and cannot issue execution commands.
- **Verbatim Substring Grounding**:
  - LLM outputs cannot fabricate compliance requirements. Every extracted item is checked against physical page text via deterministic Python verification:
    ```python
    def verify_claim_grounding(page_text: str, source_quote: str) -> bool:
        clean_page = " ".join(page_text.lower().split())
        clean_quote = " ".join(source_quote.lower().split())
        return clean_quote in clean_page
    ```
- **RAG & Vector Retrieval Isolation**:
  - Vector search on pgvector strictly applies SQL pre-filtering: `WHERE organization_id = :tenant_id AND document_id = ANY(:allowed_document_ids)`.
- **Model Provider Privacy (DPDP Act 2023)**:
  - AWS Bedrock in `ap-south-1` (Mumbai) operates with Zero Data Retention (ZDR) and zero training on enterprise inputs.
- **Pre-Invocation Secret Scrubbing**:
  - `SecretSanitizer` intercepts AWS keys, Bearer tokens, PostgreSQL connection URIs, and private RSA keys before prompts are sent to Bedrock.

---

### 3.6 AWS Cloud Infrastructure & IAM Least Privilege

#### Assessment:
- **IAM Role Separation**:
  - **Task Execution Role**: Infrastructure tasks only (`ecr:GetAuthorizationToken`, `ecr:BatchGetImage`, `logs:PutLogEvents`, `secretsmanager:GetSecretValue`).
  - **API Task Role**: Runtime tasks (`sqs:SendMessage`, `s3:GetObject`, `s3:PutObject`, `kms:GenerateDataKey`). Zero Bedrock access.
  - **AI Worker Task Role**: Runtime tasks (`sqs:ReceiveMessage`, `sqs:DeleteMessage`, `bedrock:InvokeModel`, `s3:GetObject`). Zero public exposure.
- **KMS Customer Managed Keys (CMKs)**:
  - Separate CMKs created for RDS, S3, SQS, Secrets Manager, and Logs with annual auto-rotation enabled (`enable_key_rotation = true`).
- **Network Boundaries & Security Groups**:
  - Compute runs in private subnets across 2 AZs (`ap-south-1a`, `ap-south-1b`).
  - Security groups form a strict chain: ALB $\rightarrow$ API Tasks $\rightarrow$ RDS (port 5432).
  - AI Worker and Database have zero public internet routes; all AWS API calls traverse private VPC Endpoints (PrivateLink).

---

### 3.7 Database Architecture, SQL Injection & RLS

#### Assessment:
- **SQL Injection Prevention**:
  - Prisma ORM and parameterized SQL queries ensure user input is never concatenated directly into query strings.
- **Row-Level Security (RLS)**:
  - Multi-tenant tables have RLS enabled (`FORCE ROW LEVEL SECURITY`).
  - To prevent connection pooling leaks across PgBouncer / RDS Proxy, tenant context is set transactionally via `SET LOCAL app.current_tenant_id = :tenant_id` inside explicit database transactions (`BEGIN ... COMMIT`).
- **Optimistic Concurrency Control (OCC)**:
  - `version INT NOT NULL DEFAULT 1` prevents concurrent AI background worker updates from overwriting human reviewer modifications (Lost Update defense).

---

### 3.8 Asynchronous SQS Processing & Queue Resilience

#### Assessment:
- **Message Forgery & Zero-Trust Payloads**:
  - SQS messages contain reference-only pointers: `{ organizationId, bidId, documentId }`.
  - The worker ignores any authorization context from the queue and re-derives permissions directly from trusted PostgreSQL state.
- **Duplicate Delivery & Idempotency**:
  - Worker queries `IngestionJob` aggregate state. If the job is already `COMPLETED` or `PROCESSING` under an active lease lock (`lockedUntil`), duplicate deliveries are safely acknowledged and discarded without duplicate database mutations.
- **Poison Pill Isolation**:
  - SQS Redrive Policy automatically routes malformed documents crashing the worker to `tenderpulse-ingestion-dlq` after 3 failed attempts, triggering CloudWatch alerts.

---

## 4. Remediation Plan & Implemented Code Fixes

### 4.1 Fix 1: Timing-Safe Secret Validation in NestJS API (`InternalServiceGuard.ts`)
Replaced `incomingKey !== this.internalApiKey` with `crypto.timingSafeEqual()` with matching buffer lengths.

### 4.2 Fix 2: Timing-Safe Secret Validation in FastAPI AI Worker (`main.py`)
Replaced `x_internal_service_key != settings.internal_service_key` with Python's `secrets.compare_digest()`.

### 4.3 Fix 3: Request Body Buffer Size Limiting in Development API Server (`server.ts`)
Added `MAX_BODY_SIZE = 1_048_576` (1MB limit) in `readJsonBody()` to eliminate denial-of-service memory exhaustion.

### 4.4 Fix 4: Scoped IAM Foundation Model ARN in Terraform
Restricted Bedrock IAM permissions in `infrastructure/terraform/modules/security/main.tf` from wildcard `foundation-model/*` to explicit Anthropic Claude 3.5 Sonnet model ARNs in `ap-south-1`.

---

## 5. Security Invariants Verification Summary

```
[+] Authentication: RS256 Asymmetric Tokens + Revocable DB Refresh Tokens
[+] Authorization: Fiber-Safe AsyncLocalStorage + Anti-IDOR 404 Returns
[+] API: 1MB Body Cap + Parameterized DTO Validation
[+] Storage: Deterministic Tenant Partitioning + 15-min Presigned URLs
[+] AI Ingestion: XML Framing + Deterministic Substring Grounding (100%)
[+] Network: Zero Public Compute + PrivateLink Endpoints (ap-south-1)
[+] Database: Parameterized Queries + PostgreSQL RLS + SET LOCAL
[+] Queue: Reference-Only Payloads + Idempotent Aggregate State Machine
```
