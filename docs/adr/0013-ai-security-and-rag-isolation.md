# ADR 0013: Deterministic AI Security, RAG Isolation, and Zero-Trust Guardrails

## Status

Accepted

## Context

TenderPulse AI processes confidential, legally binding, and commercially sensitive government procurement data:

- Pricing strategies, bill of quantities (BOQ) rates, and profit margin formulas.
- Joint venture agreements, consortium shares, and board resolutions.
- Sensitive compliance credentials (PAN, GSTIN, audited financials, CA UDIN certificates).
- Bid securities (EMDs) worth crores of rupees where a minor procedural error or data exposure can cause disqualification or criminal blacklisting under the Competition Act, 2002.

LLMs (Large Language Models) are **probabilistic text engines**. They possess:

1. No innate understanding of tenant boundaries.
2. No ability to act as an authorization gatekeeper.
3. Vulnerability to direct and indirect prompt injection (e.g. adversarial PDFs from public procurement portals).
4. Non-zero probability of hallucination and instruction drift.

Relying on system prompts such as _"Only answer questions for Tenant A"_ or _"Do not access other documents"_ is **security through wishful thinking** and represents an unacceptable liability.

## Decision

We enforce a **Zero-Trust AI Security Architecture** anchored in the foundational axiom:

> **"The deterministic application decides what data the model is allowed to see. The model never decides what data it is allowed to see."**

### 1. Mandatory 13-Stage Defensive Pipeline

All AI requests must pass sequentially through 13 discrete deterministic stages:
`User -> AuthN -> AuthZ -> Tenant Context -> AI Request -> Document AuthZ -> Scoped Retrieval -> Prompt Construction -> Model Inference -> Tool Execution -> Output Validation -> Persistence -> Audit`.

### 2. Immutable `SecurityContext`

Every AI workflow execution, asynchronous job, and tool invocation must carry an explicit, immutable `SecurityContext`:

- `tenant_id`: Immutable organization boundary.
- `user_id`: Authenticated user identity.
- `roles` & `permissions`: Granular capabilities.
- `workflow_run_id`: Unique execution identifier.
- `allowed_document_ids`: Whitelisted array of authorized document primary keys.
- `allowed_source_ids`: Whitelisted public procurement sources.
- `purpose`: Bounded business operation (`COMPLIANCE_EXTRACTION`, `CORRIGENDUM_ANALYSIS`, etc.).

### 3. Hard Deterministic RAG Isolation

Vector nearest-neighbor search (`pgvector`) must strictly enforce metadata pre-filtering:
`WHERE organization_id = :tenant_id AND document_id = ANY(:allowed_document_ids)`.
PostgreSQL Row-Level Security (RLS) is enabled as an architectural kernel safeguard.

### 4. Untrusted Input Framing

Document text chunks are framed in immutable XML delimiters: `<untrusted_document_data doc_id="...">`. System instructions explicitly direct the model to treat content within these tags as passive data, nullifying inline system override instructions.

### 5. Deterministic Grounding & Output Validation

Model output is constrained to strict JSON schemas via grammar-constrained decoding. Every extracted compliance rule must provide an exact string citation that is verified against the physical PDF page text using a deterministic Python substring matcher before relational persistence.

### 6. Narrow Tools & Deny-by-Default Network Egress

- Agents are denied unrestricted access to SQL, filesystems, browsers, or shells.
- Permitted tools are narrow, sandboxed, validated via Pydantic, rate-limited (max 15 calls), timeout-bounded (5.0s), and capped at 4,000 characters output.
- The AI Worker service resides in a private VPC subnet with **NO route to the public internet** (Deny-by-Default). All cloud traffic is restricted to AWS PrivateLink endpoints.

### 7. Zero Data Retention (ZDR) & India Data Residency

Inference traffic is routed to AWS Bedrock in `ap-south-1` (Mumbai) with Model Invocation Logging disabled and Zero Data Retention verified, ensuring compliance with the Indian Digital Personal Data Protection (DPDP) Act, 2023.

## Consequences

### Positive

- **Guaranteed Isolation**: Mathematically eliminates cross-tenant data bleed and unauthorized cross-document contamination.
- **Injection Resilience**: Indirect prompt injections in malicious PDFs cannot hijack system instructions or exfiltrate data over the internet.
- **Regulatory Compliance**: Satisfies Indian DPDP Act 2023 data localization and zero-retention mandates.
- **Zero Hallucination Persistence**: Ungrounded or fabricated claims are intercepted before reaching the database.

### Negative / Trade-offs

- **Context Overhead**: Every async message, LangGraph checkpoint, and tool call must serialize and validate the `SecurityContext`.
- **Infrastructure Overhead**: Running in private VPC subnets requires maintaining AWS PrivateLink VPC endpoints for Bedrock and S3.
- **Reduced Model Autonomy**: Agents cannot dynamically browse arbitrary URLs or execute exploratory SQL queries, requiring domain capabilities to be explicitly built as narrow tools.
