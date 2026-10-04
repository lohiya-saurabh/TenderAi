# Google Cloud Platform (GCP) Setup & Hybrid Testing Guide

## 1. Overview & Architecture

When deploying on **Google Cloud Platform (GCP)**, TenderPulse AI uses native GCP managed services in `asia-south1` (Mumbai) while maintaining strict decoupling in application code via our **Ports and Adapters Architecture** ([ADR 0014](file:///Users/belikesaurabh/main/TenderAi/docs/adr/0014-cloud-agnostic-ports-and-gcp-implementation.md)):

| Service | GCP Implementation | Cloud-Neutral Domain Port | Cost in Dev Tier |
| :--- | :--- | :--- | :--- |
| **Document Vault** | Google Cloud Storage (GCS) | `IStorageService` (`storagePath`, V4 Signed URLs) | <$0.10 / month |
| **Async Message Pipeline** | Cloud Pub/Sub + Dead-Letter Topic | `IJobQueue` (`publishJob`, `pollJobs`) | Free tier / pennies |
| **AI Foundation Model** | Vertex AI Gemini 1.5 Pro (`asia-south1`) | `IAiDocumentExtractor` | Pay-per-token inference |
| **Database** | Local PostgreSQL 16 in Docker | `IUnitOfWork` / PostgreSQL Repository | $0 / month |
| **Compute** | Node.js API + React Vite SPA | Domain Application Services | $0 / month |

---

## 2. Prerequisites: Google Cloud CLI (`gcloud`)

### 1. Install Google Cloud SDK (if not already installed):
```bash
brew install --cask google-cloud-sdk
```

### 2. Authenticate with your Google Account:
```bash
# 1. Login to your Google Cloud account
gcloud auth login

# 2. Set your default application credentials
gcloud auth application-default login

# 3. Create or set your GCP project
gcloud config set project YOUR_GCP_PROJECT_ID
```

---

## 3. Step-by-Step Deployment Guide

### Step 1: Provision GCP Resources with Terraform

```bash
cd infrastructure/terraform/environments/gcp-local

# 1. Initialize Terraform Google Provider
terraform init

# 2. Review execution plan
terraform plan -var="gcp_project_id=YOUR_GCP_PROJECT_ID"

# 3. Apply infrastructure
terraform apply -auto-approve -var="gcp_project_id=YOUR_GCP_PROJECT_ID"
```

### Step 2: Retrieve Environment Configuration Snippet

After `terraform apply` completes successfully:

```bash
# Print ready-to-use .env configuration snippet:
terraform output env_config_snippet
```

Copy the generated configuration directly into your `.env.local` file at the root of the repository:

```bash
# In project root:
cp .env.local.example .env.local
# Add the GCP variables from terraform output
```

### Step 3: Start Local Database & Services

```bash
# 1. Start local PostgreSQL
docker compose up postgres -d

# 2. Start API server & React frontend
npm run dev
```

---

## 4. Validating the End-to-End GCP Flow

1. Open **http://localhost:5173** in your browser.
2. Log in with demo credentials (`bidmanager@acme.com` / `Password123!`).
3. Upload a PDF document:
   - `@tenderpulse/api` calls `GcsStorageService` to generate a Google Cloud Storage V4 signed upload PUT URL.
   - The browser streams the PDF directly into your regional GCS bucket (`asia-south1`).
   - The API confirms the upload via `GcsStorageService.headObject(storagePath)` and publishes an ingestion message to your Cloud Pub/Sub topic via `GcpPubSubJobQueue`.
4. The AI worker processes the document and generates grounded compliance clauses with verbatim provenance citations.

---

## 5. Teardown & Zero-Cost Guarantee

When testing is complete, destroy all cloud resources with one command:

```bash
cd infrastructure/terraform/environments/gcp-local
terraform destroy -auto-approve -var="gcp_project_id=YOUR_GCP_PROJECT_ID"
```

Because `force_destroy = true` is enabled on the GCS bucket, Terraform will clean up all uploaded test PDFs and remove the bucket, Pub/Sub topics, subscriptions, and dev service account completely.
