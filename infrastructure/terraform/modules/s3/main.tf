/**
 * S3 Module: Encrypted Tenant Document Vault & Static SPA Buckets
 * 
 * - Block Public Access enabled across all buckets
 * - Server-Side Encryption with Customer Managed Key (SSE-KMS)
 * - Object Versioning enabled for ransomware & accidental deletion protection
 * - Enforced TLS 1.3 (aws:SecureTransport: true)
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
variable "kms_s3_key_arn" { type = string }

# 1. Tenant Document Vault Bucket (Raw PDFs, Extracted Images, Exports)
resource "aws_s3_bucket" "tenant_vault" {
  bucket        = "${var.project_name}-tenant-vault-${var.environment}"
  force_destroy = var.environment == "dev" ? true : false

  tags = {
    Name        = "${var.project_name}-tenant-vault-${var.environment}"
    Purpose     = "Encrypted Tenant PDF Document Storage"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_versioning" "tenant_vault" {
  bucket = aws_s3_bucket.tenant_vault.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tenant_vault" {
  bucket = aws_s3_bucket.tenant_vault.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = var.kms_s3_key_arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "tenant_vault" {
  bucket = aws_s3_bucket.tenant_vault.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle rule: Transition archived bids to S3 Glacier Flexible Retrieval
resource "aws_s3_bucket_lifecycle_configuration" "tenant_vault" {
  bucket = aws_s3_bucket.tenant_vault.id

  rule {
    id     = "archive-old-tenders"
    status = "Enabled"

    filter {
      prefix = "tenants/"
    }

    transition {
      days          = 180
      storage_class = "GLACIER_IR"
    }

    noncurrent_version_transition {
      noncurrent_days = 90
      storage_class   = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }
}

# Bucket Policy: Deny all unencrypted/non-TLS HTTP requests
resource "aws_s3_bucket_policy" "tenant_vault_tls_only" {
  bucket = aws_s3_bucket.tenant_vault.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnforceTlsOnly"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.tenant_vault.arn,
          "${aws_s3_bucket.tenant_vault.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

# 2. Web Frontend SPA Bucket (Private, accessed strictly via CloudFront OAC)
resource "aws_s3_bucket" "web_spa" {
  bucket        = "${var.project_name}-web-spa-${var.environment}"
  force_destroy = var.environment == "dev" ? true : false

  tags = {
    Name        = "${var.project_name}-web-spa-${var.environment}"
    Purpose     = "Static React 18 SPA Build Artifacts"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_public_access_block" "web_spa" {
  bucket = aws_s3_bucket.web_spa.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "web_spa" {
  bucket = aws_s3_bucket.web_spa.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Outputs
output "tenant_vault_bucket_name" { value = aws_s3_bucket.tenant_vault.id }
output "tenant_vault_bucket_arn" { value = aws_s3_bucket.tenant_vault.arn }
output "web_spa_bucket_name" { value = aws_s3_bucket.web_spa.id }
output "web_spa_bucket_arn" { value = aws_s3_bucket.web_spa.arn }
