output "aws_region" {
  description = "AWS Region"
  value       = var.aws_region
}

output "s3_bucket_name" {
  description = "S3 Tenant Document Vault Bucket Name"
  value       = aws_s3_bucket.tenant_vault.id
}

output "s3_bucket_arn" {
  description = "S3 Tenant Document Vault Bucket ARN"
  value       = aws_s3_bucket.tenant_vault.arn
}

output "sqs_queue_url" {
  description = "SQS Main Ingestion Queue URL"
  value       = aws_sqs_queue.ingestion_queue.url
}

output "sqs_queue_arn" {
  description = "SQS Main Ingestion Queue ARN"
  value       = aws_sqs_queue.ingestion_queue.arn
}

output "sqs_dlq_url" {
  description = "SQS Dead-Letter Queue URL"
  value       = aws_sqs_queue.ingestion_dlq.url
}

output "sqs_dlq_arn" {
  description = "SQS Dead-Letter Queue ARN"
  value       = aws_sqs_queue.ingestion_dlq.arn
}

output "aws_access_key_id" {
  description = "AWS Access Key ID for local development user"
  value       = length(aws_iam_access_key.dev_user) > 0 ? aws_iam_access_key.dev_user[0].id : ""
  sensitive   = true
}

output "aws_secret_access_key" {
  description = "AWS Secret Access Key for local development user"
  value       = length(aws_iam_access_key.dev_user) > 0 ? aws_iam_access_key.dev_user[0].secret : ""
  sensitive   = true
}

output "env_config_snippet" {
  description = "Ready-to-use environment variable snippet for .env.local"
  value       = <<-EOT
# TenderPulse AI — AWS Cloud Minimal Dev Configuration
AWS_REGION=${var.aws_region}
S3_BUCKET_NAME=${aws_s3_bucket.tenant_vault.id}
SQS_INGESTION_QUEUE_URL=${aws_sqs_queue.ingestion_queue.url}
SQS_DLQ_URL=${aws_sqs_queue.ingestion_dlq.url}
STORAGE_PROVIDER=s3
QUEUE_PROVIDER=sqs
EOT
}
