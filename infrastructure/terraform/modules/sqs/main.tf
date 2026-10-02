variable "project_name" { type = string }
variable "environment" { type = string }

# SQS Document Ingestion Queue with Dead Letter Queue (DLQ)
output "queue_url" {
  value = "https://sqs.ap-south-1.amazonaws.com/123456789012/${var.project_name}-${var.environment}-ingestion"
}

output "dlq_url" {
  value = "https://sqs.ap-south-1.amazonaws.com/123456789012/${var.project_name}-${var.environment}-ingestion-dlq"
}
