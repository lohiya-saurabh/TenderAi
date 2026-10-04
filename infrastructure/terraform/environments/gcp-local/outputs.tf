output "gcp_project_id" {
  description = "GCP Project ID"
  value       = var.gcp_project_id
}

output "gcp_region" {
  description = "GCP Region"
  value       = var.gcp_region
}

output "gcs_bucket_name" {
  description = "Name of the created GCS Tenant Document Vault bucket"
  value       = google_storage_bucket.tenant_vault.name
}

output "pubsub_ingestion_topic" {
  description = "Name of the Ingestion Pub/Sub Topic"
  value       = google_pubsub_topic.ingestion_jobs.name
}

output "pubsub_ingestion_subscription" {
  description = "Name of the Ingestion Pub/Sub Subscription"
  value       = google_pubsub_subscription.ingestion_jobs_sub.name
}

output "pubsub_dlq_topic" {
  description = "Name of the Dead-Letter Pub/Sub Topic"
  value       = google_pubsub_topic.ingestion_dlq.name
}

output "service_account_email" {
  description = "Email of the created developer service account"
  value       = var.create_service_account ? google_service_account.dev_sa[0].email : null
}

output "service_account_key_json" {
  description = "Base64 encoded JSON key for the developer service account"
  value       = var.create_service_account ? google_service_account_key.dev_sa_key[0].private_key : null
  sensitive   = true
}

output "env_config_snippet" {
  description = "Ready-to-copy environment configuration for .env.local"
  value       = <<-EOT
    # ==============================================================================
    # TenderPulse AI — Google Cloud Platform (GCP) Configuration
    # ==============================================================================
    STORAGE_PROVIDER=gcp
    QUEUE_PROVIDER=gcp
    AI_PROVIDER=vertex

    GCP_PROJECT_ID=${var.gcp_project_id}
    GCP_REGION=${var.gcp_region}

    # GCS Document Storage
    STORAGE_BUCKET_NAME=${google_storage_bucket.tenant_vault.name}

    # Cloud Pub/Sub
    INGESTION_QUEUE_TOPIC=${google_pubsub_topic.ingestion_jobs.name}
    INGESTION_QUEUE_SUBSCRIPTION=${google_pubsub_subscription.ingestion_jobs_sub.name}
    INGESTION_DLQ_TOPIC=${google_pubsub_topic.ingestion_dlq.name}

    # Vertex AI (Gemini 1.5 Pro)
    VERTEX_AI_MODEL=gemini-1.5-pro
    VERTEX_AI_LOCATION=${var.gcp_region}
  EOT
}
