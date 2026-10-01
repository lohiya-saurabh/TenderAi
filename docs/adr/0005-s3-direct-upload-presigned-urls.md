# ADR 0005: Direct S3 Uploads via Presigned URLs

## Status
Accepted

## Context
Government tender packages (NITs, RFPs, Technical Specifications) and contractor master evidence files (Audited Balance Sheets, Work Completion Portfolios) range in size from **10MB to 100MB+**. Multiple users may upload large PDF packages simultaneously.

### The Problem
If files are uploaded directly through the API server:
- `Browser` $\rightarrow$ `POST /api/v1/bids/:id/documents` (50MB multipart body) $\rightarrow$ `NestJS Server` $\rightarrow$ `S3`
- **Bandwidth & CPU Waste**: The API server pays double bandwidth (ingress from client + egress to S3).
- **Node.js Buffer Bloat**: Streaming or buffering multi-part 50MB–100MB payloads ties up Node.js memory buffers and network sockets, degrading API response times for standard CRUD requests.
- **Gateway Limits**: API Gateways and load balancers typically enforce hard payload limits (e.g., AWS API Gateway has a 10MB payload limit; AWS ALB defaults to 1MB or requires explicit tuning).

## Decision
We implement **Direct-to-S3 Uploads using S3 Presigned URLs**:
1. Client requests an upload token: `POST /api/v1/bids/:id/upload-url` with `{ fileName, fileSizeBytes, mimeType }`.
2. NestJS validates tenant permissions, quota, and file extension (strictly `.pdf`).
3. NestJS generates an AWS S3 Presigned `PUT` URL with a short expiration (e.g., 15 minutes) and a deterministic key: `tenants/{tenantId}/bids/{bidId}/raw/{documentId}.pdf`.
4. Browser uploads the binary file **directly to S3** via `HTTP PUT`.
5. Upon successful upload (HTTP 200 from S3), Browser calls `POST /api/v1/bids/:id/documents/confirm` with `{ documentId }`.
6. NestJS verifies object existence in S3 via `headObject`, updates database record to `UPLOADED`, and dispatches the SQS processing job.

## Alternatives Considered
1. **Multipart Upload through NestJS API**: Rejected due to memory consumption, gateway payload caps, and double network hops.
2. **Local Disk Storage**: Rejected as containers are ephemeral and cannot share state across scaled instances.

## Consequences
- **Positive**:
  - API server handles only lightweight JSON metadata requests (< 1KB).
  - Maximum upload speed: Direct client-to-S3 bandwidth over AWS global edge network.
  - Zero risk of Node.js memory exhaustion from file uploads.
- **Negative / Trade-off**:
  - Two-step client handshake (request presigned URL $\rightarrow$ upload to S3 $\rightarrow$ confirm upload).
