# Lowest-Cost AWS MVP Deployment & Testing Guide

## 1. Overview & Architectural Rationale

When testing a production-ready SaaS like **TenderPulse AI**, deploying the entire enterprise AWS architecture (Multi-AZ RDS, Multi-AZ ECS Fargate, NAT Gateways, KMS CMKs, PrivateLink VPC Endpoints) costs **~$320–$420/month** (as outlined in [AWS.md](file:///Users/belikesaurabh/main/TenderAi/docs/AWS.md)).

For testing, evaluation, and MVP demonstrations, you can run a **Hybrid Architecture** that exercises real AWS cloud services (S3 and SQS) while running compute and database containers locally on your laptop:

| Resource                   | Full AWS Production ($350+/mo)             | Hybrid Testing Setup (<$0.50/mo)                            |
| :------------------------- | :----------------------------------------- | :---------------------------------------------------------- |
| **Document Storage**       | AWS S3 + KMS CMK ($1/key + storage)        | **Real AWS S3** (AES-256 SSE, $0 KMS fee)                   |
| **Async Message Queue**    | AWS SQS + DLQ + KMS CMK                    | **Real AWS SQS + DLQ** (Managed SSE, $0 KMS fee)            |
| **Direct Browser Uploads** | Real S3 Presigned PUT URLs                 | **Real S3 Presigned PUT URLs** (CORS enabled for localhost) |
| **AI Inference**           | AWS Bedrock Claude 3.5 Sonnet              | **AWS Bedrock** (Pay-per-token inference)                   |
| **Database**               | Multi-AZ Amazon RDS PostgreSQL 16 ($78/mo) | **Local PostgreSQL 16** in Docker ($0/mo)                   |
| **NAT Gateways**           | 1–2 NAT Gateways ($35–$70/mo)              | **Zero** (Local network) ($0/mo)                            |
| **Compute Containers**     | ECS Fargate Tasks ($73/mo)                 | **Local Docker / Node.js & Python** ($0/mo)                 |
| **Load Balancer**          | AWS ALB ($22/mo)                           | **Vite Dev Server / Direct Port 3000** ($0/mo)              |
| **TOTAL ESTIMATED COST**   | **~$320 – $420 / month**                   | **<$0.50 / month** (Storage & Queue pennies)                |

---

## 2. Infrastructure as Code: Terraform Local Environment

We provide a dedicated, minimal Terraform environment located at [infrastructure/terraform/environments/local/](file:///Users/belikesaurabh/main/TenderAi/infrastructure/terraform/environments/local/).

### What It Provisions:

1. **Amazon S3 Document Vault**:
   - Bucket: `tenderpulse-vault-local-{random_suffix}`
   - Encryption: AWS-managed `AES256` ($0 KMS key cost).
   - CORS: Configured for `http://localhost:5173`, `http://localhost:3000`, `http://localhost:8080`.
   - Lifecycle: Automatically deletes test uploads after 7 days.
2. **Amazon SQS Ingestion Queue + DLQ**:
   - `tenderpulse-ingestion-queue-local` & `tenderpulse-ingestion-dlq-local`
   - Redrive policy: Max receive count = 3.
   - Visibility timeout: 300 seconds.
   - Encryption: SQS-managed SSE ($0 KMS fee).
3. **Dedicated IAM Developer User**:
   - Least-privilege IAM policy scoped strictly to the created bucket, queues, and Bedrock inference in `ap-south-1`.

---

## 3. Step-by-Step Setup Guide

### Step 1: Deploy AWS Resources via Terraform

```bash
cd infrastructure/terraform/environments/local

# 1. Initialize Terraform
terraform init

# 2. Review execution plan
terraform plan

# 3. Apply infrastructure
terraform apply -auto-approve
```

### Step 2: Retrieve Environment Configuration

After `terraform apply` succeeds, run:

```bash
# Print ready-to-use .env configuration snippet:
terraform output env_config_snippet

# Print IAM credentials (if generated):
echo "AWS_ACCESS_KEY_ID=$(terraform output -raw aws_access_key_id)"
echo "AWS_SECRET_ACCESS_KEY=$(terraform output -raw aws_secret_access_key)"
```

Copy these values into your `.env.local` file at the root of the project:

```bash
cp .env.local.example .env.local
# Edit .env.local with your bucket name, queue URLs, and AWS credentials
```

### Step 3: Start Local Database & Services

```bash
# 1. Start PostgreSQL in Docker
docker compose up postgres -d

# 2. Install dependencies & build packages
npm install
npm run build

# 3. Start API server & React frontend
./scripts/dev.sh
```

If testing the AI Python engine alongside the API:

```bash
# In a separate terminal tab:
cd apps/ai
uv run uvicorn tenderpulse_ai.main:app --host 0.0.0.0 --port 8000
```

---

## 4. Validating the End-to-End Flow

1. Open **http://localhost:5173** in your browser.
2. Log in with demo credentials: `bidmanager@acme.com` / `Password123!`.
3. Create a new Bid Project (e.g. NHAI or CPWD Tender).
4. Upload a PDF document:
   - The browser requests a presigned PUT URL from `@tenderpulse/api`.
   - The document is directly streamed to your real **AWS S3 bucket**.
   - The API confirms the upload via S3 `HeadObject` and dispatches an ingestion job to your real **AWS SQS queue**.
5. The AI worker processes the document from SQS and streams real-time extraction progress via Server-Sent Events (SSE).
6. Review, flag, or approve extracted compliance clauses with grounded verbatim provenance cards.

---

## 5. Teardown & Zero-Cost Guarantee

When you are done testing, destroy the AWS resources with one command to ensure zero ongoing charges:

```bash
cd infrastructure/terraform/environments/local
terraform destroy -auto-approve
```

Because `force_destroy = true` is enabled on the dev S3 bucket, Terraform will clean up all uploaded test PDFs and remove the S3 bucket, SQS queues, and IAM dev user completely.
