/**
 * SQS Module: Asynchronous Job Ingestion Queue & Dead-Letter Queue (DLQ)
 * 
 * - Decouples long-running AI extraction (60-180s) from synchronous HTTP API
 * - Visibility Timeout: 300 seconds
 * - Automatic retry with Dead-Letter Queue isolation after 3 failed attempts
 * - Server-Side Encryption with Customer Managed Key (SSE-KMS)
 */

terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "project_name" { type = string }
variable "environment" { type = string }
variable "kms_sqs_key_arn" { type = string }

# 1. Dead-Letter Queue (Poison Pill Isolation)
resource "aws_sqs_queue" "ingestion_dlq" {
  name                      = "${var.project_name}-ingestion-dlq-${var.environment}"
  message_retention_seconds = 1209600 # 14 days
  kms_master_key_id         = var.kms_sqs_key_arn

  tags = {
    Name        = "${var.project_name}-ingestion-dlq-${var.environment}"
    Purpose     = "Poison Pill & Failed Extraction Job Isolation"
    Environment = var.environment
  }
}

# 2. Main Ingestion Queue
resource "aws_sqs_queue" "ingestion_queue" {
  name                       = "${var.project_name}-ingestion-queue-${var.environment}"
  visibility_timeout_seconds = 300 # 5 minutes for heavy PDF & LangGraph reasoning
  message_retention_seconds  = 345600 # 4 days
  receive_wait_time_seconds  = 20 # Long polling enabled
  kms_master_key_id          = var.kms_sqs_key_arn

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.ingestion_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "${var.project_name}-ingestion-queue-${var.environment}"
    Purpose     = "Asynchronous Document Extraction Job Queue"
    Environment = var.environment
  }
}

# Outputs
output "ingestion_queue_id" { value = aws_sqs_queue.ingestion_queue.id }
output "ingestion_queue_arn" { value = aws_sqs_queue.ingestion_queue.arn }
output "ingestion_dlq_id" { value = aws_sqs_queue.ingestion_dlq.id }
output "ingestion_dlq_arn" { value = aws_sqs_queue.ingestion_dlq.arn }
