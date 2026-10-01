# ADR 0003: SQS + Dead Letter Queue for Asynchronous Document Processing

## Status
Accepted

## Context
When a user uploads a 150-page government tender package (NIT + SBD + SCC), the pipeline must:
1. Extract text and detect scanned vs. digital pages.
2. Run OCR on scanned sections.
3. Segment document into sections (Eligibility, General Conditions, Special Conditions, Annexures).
4. Run structured extraction via LangGraph with LLMs.
5. Validate citations and store compliance rows.

This processing pipeline takes **60 to 180 seconds** per tender package.

### The Problem
- **Synchronous HTTP is impossible**: Web browsers, API gateways (AWS ALB/API Gateway), and reverse proxies (Nginx/Cloudflare) have strict HTTP timeout limits (30–60 seconds). A synchronous request will terminate with a 504 Gateway Timeout.
- **Node.js Thread Starvation**: Performing document parsing or long-running worker loops inside the API thread pool blocks client requests.
- **Failure & Crash Recovery**: If a worker crashes on page 87 of a 150-page document or gets rate-limited by an LLM provider, an in-memory queue drops the entire task.

## Decision
We introduce an **Asynchronous Job Pipeline backed by AWS SQS (Simple Queue Service) and a Dead Letter Queue (DLQ)**:
1. When a document upload is confirmed, NestJS commits a `BidJob` record (`status: QUEUED`) and enqueues a message to `tender-processing-queue.fifo` (or standard SQS with deduplication).
2. The FastAPI Worker service long-polls SQS, claims the message with a visibility timeout, and processes the document.
3. If processing fails due to transient network or LLM rate limits, SQS automatically retries up to $N$ times with exponential backoff.
4. If a job fails permanently after maximum retries, SQS routes the poison pill message to `tender-processing-dlq`, triggering an alert and marking the bid job as `FAILED` in the database.

## Alternatives Considered
1. **Synchronous HTTP Call (NestJS $\rightarrow$ FastAPI)**: Rejected due to timeouts and lack of backpressure management.
2. **In-Memory Queue (BullMQ / Celery over Redis)**: Viable alternative, but adds operational maintenance for Redis persistence (AOF/RDB configuration, Redis failover clusters, memory sizing for large payloads). AWS SQS is a fully managed, serverless, durable queue with zero maintenance, built-in DLQ, and pay-per-use economics.
3. **AWS EventBridge**: Suitable for cross-account enterprise event choreography, but unnecessary and more expensive for a point-to-point worker queue where queue backpressure, visibility timeouts, and worker pull semantics are specifically required.

## Consequences
- **Positive**:
  - Total decoupling between API gateway and heavy compute workers.
  - Resilience: Zero dropped jobs even if all worker instances restart.
  - Built-in rate limiting and backpressure: Workers pull messages at their own processing capacity.
- **Negative / Trade-off**:
  - End-to-end user experience is asynchronous; frontend requires polling or Server-Sent Events (SSE) to update the UI when processing completes.
