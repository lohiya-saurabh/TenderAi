# ADR 0014: Cloud-Agnostic Ports & Adapters with Google Cloud Platform (GCP) Implementation

## Status

Accepted

## Context

In earlier milestones, cloud infrastructure definitions were created primarily targeting AWS (S3 for object storage, SQS for asynchronous queue processing, Bedrock for AI foundation models, ECS for compute, and RDS for PostgreSQL).

### The Problem

1. **Vendor Coupling**: Code in application use cases and domain entities directly referenced AWS-specific terminology (e.g. `s3Key`, `AwsS3StorageService`, `AwsSqsJobQueue`), creating an implicit dependency on AWS semantics.
2. **Access & Sign-in Blockers**: When developers or enterprises cannot authenticate with AWS or are mandated by internal compliance to run on Google Cloud Platform (GCP), the application must support GCP seamlessly without rewriting core business workflows.
3. **Architectural Purity**: Clean Architecture, Hexagonal Architecture, and the Dependency Inversion Principle (DIP) dictate that high-level business rules must never depend on low-level cloud provider SDKs or vendor-specific conventions.

## Decision

We adopt a **Cloud-Agnostic Port-and-Adapter Architecture** and deliver full **Google Cloud Platform (GCP)** infrastructure and adapter implementations.

### 1. Cloud-Agnostic Domain & Application Ports

- **Storage Port (`IStorageService`)**:
  - Uses generic parameter `storagePath` (e.g., `tenants/{orgId}/bids/{bidId}/{docId}/{fileName}`).
  - Methods: `generatePresignedUploadUrl`, `generatePresignedDownloadUrl`, `headObject`, `getObject`.
  - Zero AWS or GCP SDK dependencies in the interface.
- **Queue Port (`IJobQueue`)**:
  - Uses generic payload `IngestionJobMessage` and envelope `QueueMessage<T>`.
  - Methods: `enqueue`, `receiveMessages`, `deleteMessage`, `changeMessageVisibility`, `moveToDeadLetter`.
- **Domain Entity (`TenderDocument`)**:
  - Property `storagePath` represents the tenant-scoped object locator.
  - Retains backward-compatible getter/property `s3Key` as an alias to prevent breaking existing integrations.

### 2. Infrastructure Adapters

We maintain pluggable adapters selectable via environment variables (`STORAGE_PROVIDER`, `QUEUE_PROVIDER`):

| Cloud Provider   | Storage Adapter (`IStorageService`)                | Queue Adapter (`IJobQueue`)                       | AI Model Provider                        |
| :--------------- | :------------------------------------------------- | :------------------------------------------------ | :--------------------------------------- |
| **GCP**          | `GcsStorageService` (Cloud Storage V4 Signed URLs) | `GcpPubSubJobQueue` (Cloud Pub/Sub + Dead Letter) | Vertex AI Gemini 1.5 Pro (`asia-south1`) |
| **AWS**          | `AwsS3StorageService` (S3 Presigned URLs)          | `AwsSqsJobQueue` (SQS + DLQ Redrive)              | Bedrock Claude 3.5 Sonnet (`ap-south-1`) |
| **Local / Test** | `MockStorageService` / In-Memory                   | `MockJobQueue` / In-Memory                        | Local In-Memory Mock Extractor           |

### 3. Google Cloud Platform (GCP) Infrastructure

A dedicated Terraform environment is created at `infrastructure/terraform/environments/gcp-local/`:

1. **Google Cloud Storage (GCS)**:
   - Regional bucket in `asia-south1` (Mumbai).
   - Uniform bucket-level access enabled.
   - CORS configured for `http://localhost:5173`, `http://localhost:3000`, `http://localhost:8080`.
   - 7-day auto-deletion lifecycle rule for development uploads.
2. **Cloud Pub/Sub**:
   - Topic: `tenderpulse-ingestion-jobs-local`
   - Dead-Letter Topic: `tenderpulse-ingestion-dlq-local`
   - Subscription: `tenderpulse-ingestion-sub-local` with `ack_deadline_seconds = 300` and `max_delivery_attempts = 3`.
3. **IAM Service Account**:
   - Dedicated service account `tenderpulse-dev-sa` with scoped roles (`roles/storage.objectAdmin`, `roles/pubsub.editor`, `roles/aiplatform.user`).

## Consequences

- **Positive**:
  - Full freedom to deploy to either GCP or AWS without changing domain entities or application use cases.
  - Zero vendor lock-in; code communicates using the ubiquitous language of the procurement domain (`storagePath`, `uploadUrl`, `jobPayload`).
  - Enables ultra-low-cost hybrid cloud testing on GCP.
- **Negative / Trade-offs**:
  - Maintaining multiple cloud adapter implementations and their respective unit test suites requires ongoing maintenance.
