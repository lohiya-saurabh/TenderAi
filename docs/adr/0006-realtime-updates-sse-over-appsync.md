# ADR 0006: Server-Sent Events (SSE) & Smart Polling for Job Progress (Rejecting AWS AppSync)

## Status
Accepted

## Context
When a user uploads a 150-page tender package, background parsing and extraction takes between 60 and 180 seconds. The web UI needs to reflect progress updates:
`QUEUED` $\rightarrow$ `EXTRACTING_TEXT` $\rightarrow$ `RUNNING_OCR` $\rightarrow$ `PARSING_CLAUSES` $\rightarrow$ `READY`.

### The Problem
We need to communicate asynchronous job progress from the server to the browser without:
- Overwhelming the client or server with aggressive tight polling.
- Introducing heavy, unnecessary real-time cloud infrastructure like AWS AppSync.

## Evaluation & Decision
We select **Server-Sent Events (SSE)** with a **Smart Polling Fallback**, and explicitly **reject AWS AppSync**:

### Why Reject AWS AppSync?
1. **Unjustified Architectural Weight**: AWS AppSync is a managed GraphQL service designed for multi-client collaborative editing, real-time subscriptions, and mobile offline sync. Our application only needs one-way, coarse-grained status updates (once every 10–20 seconds).
2. **Vendor Lock-in & Complexity**: AppSync requires maintaining GraphQL schemas, resolvers (often Velocity Template Language - VTL or JavaScript), and IAM authorization mappings, creating an expensive parallel stack alongside our REST API.
3. **Cost**: AppSync charges per million query/mutation operations and per million minutes of active WebSocket connections.

### Why Server-Sent Events (SSE) + Smart Polling?
1. **Unidirectional Simplicity**: The communication is strictly server-to-client (the browser does not send high-frequency streams back to the server). SSE is native to HTTP/1.1 and HTTP/2 and supported natively by all modern browsers via `EventSource`.
2. **Zero Extra Infrastructure**: NestJS natively supports SSE out-of-the-box using standard RxJS Observables (`@Sse('bids/:id/progress')`).
3. **Smart Polling Fallback**: If an SSE connection drops or is blocked by restrictive corporate enterprise proxies, the React frontend seamlessly falls back to exponential backoff polling (`GET /api/v1/bids/:id/status` every 5s $\rightarrow$ 10s $\rightarrow$ 15s) until status reaches `READY` or `FAILED`.

## Consequences
- **Positive**:
  - Extremely simple to implement, test, and debug in standard HTTP logs.
  - Native browser reconnection handling in `EventSource`.
  - Zero AWS infrastructure dependencies for real-time status.
- **Negative / Trade-off**:
  - SSE connections are held open; with thousands of concurrent active connections on HTTP/1.1, connection limits apply (mitigated by HTTP/2 multiplexing and the fact that connections close as soon as the bid status reaches `READY`).
