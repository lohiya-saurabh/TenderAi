variable "project_name" { type = string }
variable "environment" { type = string }

# S3 Bucket with KMS Encryption and 24h Lifecycle Cleanup for unconfirmed uploads
output "bucket_name" {
  value = "${var.project_name}-${var.environment}-vault"
}
