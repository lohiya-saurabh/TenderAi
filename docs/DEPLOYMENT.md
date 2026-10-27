# Deployment

Production runs on AWS in `ap-south-1` (Mumbai). Infrastructure is Terraform under `infrastructure/terraform/`; delivery is GitHub Actions (`.github/workflows/`). The services and data flow are described in [ARCHITECTURE.md](ARCHITECTURE.md).

## 1. AWS topology

```
CloudFront ──► S3 (web SPA)
ALB (HTTP) ──► ECS Fargate: API service ──► RDS PostgreSQL 16 (isolated subnets, KMS)
                    │  ▲                 ──► S3 tenant vault (KMS, TLS-only, versioned)
                    ▼  │ SQS (KMS)
               ECS Fargate: AI worker service
```

| Terraform module | Creates                                                                                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vpc`            | VPC with public, private-app and isolated-db subnets; NAT gateway; S3 gateway endpoint; DB subnet group                                                        |
| `security`       | KMS keys (RDS, S3, SQS, Secrets Manager); `app_secrets` secret; security groups for ALB, API, AI worker and RDS; ECS execution role and per-service task roles |
| `rds`            | PostgreSQL 16.4 with a pg16 parameter group, a generated master password, and a `DATABASE_URL` secret                                                          |
| `s3`             | `tenant_vault` bucket (versioning, SSE-KMS, public access blocked, lifecycle, TLS-only policy) and `web_spa` bucket                                            |
| `sqs`            | Ingestion queue and its DLQ                                                                                                                                    |
| `ecs`            | Cluster, ALB, API target group and listener, CloudWatch log groups, task definitions and services                                                              |

**ECS sizing.** The API task gets 0.5 vCPU and 1 GB; the AI worker task gets 1 vCPU and 2 GB, for Docling and OCR.

| Environment (`environments/`) | RDS           | Multi-AZ | API / worker tasks                                                                             |
| ----------------------------- | ------------- | -------- | ---------------------------------------------------------------------------------------------- |
| `dev`                         | db.t4g.micro  | no       | 1 / 1                                                                                          |
| `staging`                     | db.t4g.small  | yes      | 2 / 2                                                                                          |
| `prod`                        | db.t4g.medium | yes      | 2 / 2                                                                                          |
| `local`                       | —             | —        | Only an S3 bucket, an SQS queue with DLQ and an IAM user, for running locally against real AWS |
| `gcp-local`                   | —             | —        | GCS bucket, Pub/Sub topics and subscriptions, service account (GCP adapters, see §4)           |

**Configuration in ECS.**

- The API task gets `NODE_ENV`, `PORT=3000`, `DATABASE_SSL=verify-full` and `DATABASE_SSL_CA_FILE=/app/certs/rds-global-bundle.pem`. The CA bundle is baked into `apps/api/Dockerfile`.
- `DATABASE_URL` and `APP_SECRETS` come from Secrets Manager.
- The AI worker gets `ENVIRONMENT`, `AWS_REGION` and `APP_SECRETS`.

```bash
cd infrastructure/terraform/environments/prod
terraform init
terraform plan
terraform apply
```

## 2. CI/CD

`.github/workflows/ci-cd.yml` runs on pushes and pull requests to `develop` and `main`:

| Stage             | What                                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| 0. Branch policy  | A PR into `main` must come from `develop`, and a push to `main` must be a merge from `develop`              |
| 1. Lint           | Prettier check, ESLint in every workspace, ruff                                                             |
| 2. Type-check     | Shared packages build, then `tsc --noEmit` in every workspace                                               |
| 3. Tests          | API, web and AI test suites                                                                                 |
| 4. AI regressions | AI evaluation and security regression tests                                                                 |
| 5. Security audit | Dependency audits and Gitleaks                                                                              |
| 6a / 6b           | Build the web SPA, and build and push Docker images (web Nginx, API, AI worker) to ECR. Push to `main` only |
| 7. Deploy         | Push to `main` only, through the `production` environment                                                   |

Stage 7 assumes an AWS role through GitHub OIDC (no static keys), then:

1. syncs the SPA to S3 and invalidates CloudFront;
2. updates the ECS services;
3. waits for them to stabilize;
4. runs smoke tests.

`playwright.yml` runs the browser tests and uploads the report. Branch protection and the OIDC role are set up with `scripts/setup-github-branch-rules.sh` and `scripts/setup-aws-github-oidc-role.sh`.

**Branching.** Work lands on `develop`; `main` is only ever a merge from `develop` (see [CONTRIBUTING.md](../CONTRIBUTING.md)).

## 3. Database in AWS

- **Migrations** run on API startup under an advisory lock, so a rolling deploy with several tasks is safe (see [DATABASE.md](DATABASE.md) §2).
- **Backups and multi-AZ** follow the RDS settings per environment.

## 4. GCP adapters

The API and the worker also ship Google Cloud adapters: GCS storage (`GcsStorageService`), Pub/Sub job queues (`GcpPubSubJobQueue`) and a Pub/Sub completion publisher. They are selected when `GCS_BUCKET_NAME` or the `GCP_PUBSUB_*` settings are present. `environments/gcp-local` provisions what a developer needs to run against GCP. No production GCP environment exists; [ADR 0014](adr/0014-cloud-agnostic-ports-and-gcp-implementation.md) records why the ports exist.

## 5. Before `develop` is promoted to `main`

The application has moved ahead of the infrastructure. These must be done, or explicitly accepted, before the next production deploy:

| Gap                                                      | Detail                                                                                                                                                                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `terraform apply` not run for the RDS/ECS changes        | The move from PGlite to RDS (Secrets Manager `DATABASE_URL`, `verify-full` TLS) exists only in code                                                                                                                                   |
| Completion queue missing from Terraform                  | The `sqs` module creates only the ingestion queue and its DLQ. The completion queue and its DLQ (`AWS_SQS_COMPLETION_QUEUE_URL`, `AWS_SQS_COMPLETION_DLQ_URL`) are needed by both services. Today only the hand-made dev queues exist |
| Queue, bucket and provider settings not wired into ECS   | The task definitions set no queue URLs, bucket name, `INTERNAL_SERVICE_KEY` or LLM provider keys as individual variables, and `APP_SECRETS` is passed as one opaque value                                                             |
| Production completion consumer and `QUEUE_PROVIDER=mock` | The production completion consumer does not honour `QUEUE_PROVIDER=mock`                                                                                                                                                              |
| CloudFront not in Terraform                              | The deploy job invalidates a distribution id taken from repository variables, but no Terraform module creates it                                                                                                                      |
| HTTP-only ALB listener                                   | No HTTPS listener or certificate is defined                                                                                                                                                                                           |
