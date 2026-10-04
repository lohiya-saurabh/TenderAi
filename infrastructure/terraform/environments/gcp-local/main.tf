terraform {
  required_version = ">= 1.7.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

# Unique suffix to prevent global GCS bucket name collisions
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# ==============================================================================
# 1. Google Cloud Storage (GCS): Tenant Document Vault (Zero KMS Cost, AES256)
# ==============================================================================
resource "google_storage_bucket" "tenant_vault" {
  name                        = "${var.project_name}-vault-${var.environment}-${random_id.bucket_suffix.hex}"
  location                    = var.gcp_region
  force_destroy               = true # Allows easy cleanup of test uploads on terraform destroy
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  dynamic "cors" {
    for_each = var.enable_cors_localhost ? [1] : []
    content {
      origin = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8080",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8080"
      ]
      method          = ["PUT", "GET", "HEAD", "OPTIONS"]
      response_header = ["*"]
      max_age_seconds = 3600
    }
  }

  lifecycle_rule {
    condition {
      age = 7
    }
    action {
      type = "Delete"
    }
  }

  labels = {
    project     = var.project_name
    environment = var.environment
    managed_by  = "terraform"
    cost_tier   = "ultralowcostdev"
  }
}

# Retrieve GCP project number for Google-managed service agent identities
data "google_project" "current" {
  project_id = var.gcp_project_id
}

# ==============================================================================
# 2. Google Cloud Pub/Sub: Ingestion Topic, Subscription & Dead-Letter (DLQ)
# ==============================================================================
resource "google_pubsub_topic" "ingestion_dlq" {
  name = "${var.project_name}-ingestion-dlq-${var.environment}"

  labels = {
    project     = var.project_name
    environment = var.environment
    purpose     = "dlq"
  }
}

resource "google_pubsub_subscription" "ingestion_dlq_sub" {
  name  = "${var.project_name}-ingestion-dlq-sub-${var.environment}"
  topic = google_pubsub_topic.ingestion_dlq.name

  ack_deadline_seconds       = 30
  message_retention_duration = "1209600s" # 14 days
}

resource "google_pubsub_topic" "ingestion_jobs" {
  name = "${var.project_name}-ingestion-jobs-${var.environment}"

  labels = {
    project     = var.project_name
    environment = var.environment
    purpose     = "ingestion"
  }
}

resource "google_pubsub_subscription" "ingestion_jobs_sub" {
  name  = "${var.project_name}-ingestion-sub-${var.environment}"
  topic = google_pubsub_topic.ingestion_jobs.name

  ack_deadline_seconds       = 300 # 5 minutes for AI extraction graph execution
  message_retention_duration = "345600s" # 4 days

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }
}

# ==============================================================================
# 3. Security: Dedicated Service Account for Local / Dev Testing (Least Privilege)
# ==============================================================================
resource "google_service_account" "dev_sa" {
  count        = var.create_service_account ? 1 : 0
  account_id   = "${var.project_name}-dev-sa"
  display_name = "TenderPulse AI Local Dev Service Account"
  description  = "Least-privilege service account for local testing and container development"
}

resource "google_storage_bucket_iam_member" "gcs_admin" {
  count  = var.create_service_account ? 1 : 0
  bucket = google_storage_bucket.tenant_vault.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.dev_sa[0].email}"
}

resource "google_pubsub_topic_iam_member" "pubsub_publisher" {
  count  = var.create_service_account ? 1 : 0
  topic  = google_pubsub_topic.ingestion_jobs.name
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:${google_service_account.dev_sa[0].email}"
}

resource "google_pubsub_subscription_iam_member" "pubsub_subscriber" {
  count        = var.create_service_account ? 1 : 0
  subscription = google_pubsub_subscription.ingestion_jobs_sub.name
  role         = "roles/pubsub.subscriber"
  member       = "serviceAccount:${google_service_account.dev_sa[0].email}"
}

resource "google_project_iam_member" "vertex_ai_user" {
  count   = var.create_service_account ? 1 : 0
  project = var.gcp_project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.dev_sa[0].email}"
}

resource "google_service_account_key" "dev_sa_key" {
  count              = var.create_service_account ? 1 : 0
  service_account_id = google_service_account.dev_sa[0].name
}
