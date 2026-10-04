terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
      CostTier    = "UltraLowCostDev"
    }
  }
}

# Unique suffix to prevent global S3 bucket name collisions
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# ==============================================================================
# 1. AWS S3: Tenant Document Vault (Zero KMS Cost, AES-256 SSE)
# ==============================================================================
resource "aws_s3_bucket" "tenant_vault" {
  bucket        = "${var.project_name}-vault-${var.environment}-${random_id.bucket_suffix.hex}"
  force_destroy = true # Allows easy cleanup of test uploads on terraform destroy

  tags = {
    Name        = "${var.project_name}-vault-${var.environment}"
    Purpose     = "Tenant PDF Document Storage for Local / Dev Testing"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_versioning" "tenant_vault" {
  bucket = aws_s3_bucket.tenant_vault.id

  versioning_configuration {
    status = "Enabled"
  }
}

# AWS-Managed AES256 Encryption (Free tier / Zero KMS CMK fee)
resource "aws_s3_bucket_server_side_encryption_configuration" "tenant_vault" {
  bucket = aws_s3_bucket.tenant_vault.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = false
  }
}

resource "aws_s3_bucket_public_access_block" "tenant_vault" {
  bucket = aws_s3_bucket.tenant_vault.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CORS Configuration for direct browser Presigned PUT upload from localhost
resource "aws_s3_bucket_cors_configuration" "tenant_vault" {
  count  = var.enable_cors_localhost ? 1 : 0
  bucket = aws_s3_bucket.tenant_vault.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "GET", "HEAD"]
    allowed_origins = [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:8080",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:8080"
    ]
    expose_headers  = ["ETag", "x-amz-server-side-encryption"]
    max_age_seconds = 3600
  }
}

# Lifecycle rule to auto-expire test uploads after 7 days to keep storage costs negligible
resource "aws_s3_bucket_lifecycle_configuration" "tenant_vault" {
  bucket = aws_s3_bucket.tenant_vault.id

  rule {
    id     = "auto-cleanup-dev-uploads"
    status = "Enabled"

    filter {
      prefix = "tenants/"
    }

    expiration {
      days = 7
    }

    noncurrent_version_expiration {
      noncurrent_days = 3
    }
  }
}

# ==============================================================================
# 2. AWS SQS: Ingestion Queue & Dead-Letter Queue (DLQ)
# ==============================================================================
resource "aws_sqs_queue" "ingestion_dlq" {
  name                      = "${var.project_name}-ingestion-dlq-${var.environment}"
  message_retention_seconds = 1209600 # 14 days
  sqs_managed_sse_enabled   = true    # AWS-managed SSE (Free / Zero KMS CMK fee)

  tags = {
    Name        = "${var.project_name}-ingestion-dlq-${var.environment}"
    Purpose     = "Poison Pill Isolation for Dev Testing"
    Environment = var.environment
  }
}

resource "aws_sqs_queue" "ingestion_queue" {
  name                       = "${var.project_name}-ingestion-queue-${var.environment}"
  visibility_timeout_seconds = 300 # 5 minutes
  message_retention_seconds  = 345600 # 4 days
  receive_wait_time_seconds  = 20 # Long polling enabled
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.ingestion_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "${var.project_name}-ingestion-queue-${var.environment}"
    Purpose     = "Asynchronous Document Extraction Job Queue for Dev Testing"
    Environment = var.environment
  }
}

# ==============================================================================
# 3. Security: Dedicated IAM User for Local Development (Least Privilege)
# ==============================================================================
resource "aws_iam_user" "dev_user" {
  count = var.create_iam_dev_user ? 1 : 0
  name  = "${var.project_name}-dev-user-${var.environment}"

  tags = {
    Name        = "${var.project_name}-dev-user-${var.environment}"
    Purpose     = "Programmatic Access for Local Development Containers"
    Environment = var.environment
  }
}

resource "aws_iam_access_key" "dev_user" {
  count = var.create_iam_dev_user ? 1 : 0
  user  = aws_iam_user.dev_user[0].name
}

resource "aws_iam_user_policy" "dev_policy" {
  count = var.create_iam_dev_user ? 1 : 0
  name  = "${var.project_name}-dev-policy-${var.environment}"
  user  = aws_iam_user.dev_user[0].name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowS3DocumentVaultAccess"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:HeadObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.tenant_vault.arn,
          "${aws_s3_bucket.tenant_vault.arn}/*"
        ]
      },
      {
        Sid    = "AllowSqsIngestionQueueAccess"
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:ChangeMessageVisibility",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl"
        ]
        Resource = [
          aws_sqs_queue.ingestion_queue.arn,
          aws_sqs_queue.ingestion_dlq.arn
        ]
      },
      {
        Sid    = "AllowBedrockInferenceIfEnabled"
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = [
          "arn:aws:bedrock:${var.aws_region}::foundation-model/*"
        ]
      }
    ]
  })
}
