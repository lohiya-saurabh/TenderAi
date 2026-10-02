output "s3_vault_bucket" {
  description = "Encrypted S3 tenant vault bucket name"
  value       = module.s3.tenant_vault_bucket_name
}

output "sqs_queue_url" {
  description = "SQS ingestion job queue URL"
  value       = module.sqs.ingestion_queue_id
}

output "sqs_dlq_url" {
  description = "SQS dead letter queue URL"
  value       = module.sqs.ingestion_dlq_id
}
