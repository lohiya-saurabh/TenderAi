/**
 * Security Module: KMS Customer Managed Keys, Secrets Manager,
 * Chained Security Groups, and Least-Privilege IAM Roles
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
variable "vpc_id" { type = string }
variable "s3_vault_bucket_arn" { type = string }
variable "sqs_queue_arn" { type = string }

# 1. KMS Customer Managed Keys (CMK) with Automatic Annual Rotation

resource "aws_kms_key" "rds" {
  description             = "KMS Key for ${var.project_name} RDS PostgreSQL (${var.environment})"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name = "${var.project_name}-kms-rds-${var.environment}"
  }
}

resource "aws_kms_alias" "rds" {
  name          = "alias/${var.project_name}-rds-${var.environment}"
  target_key_id = aws_kms_key.rds.key_id
}

resource "aws_kms_key" "s3" {
  description             = "KMS Key for ${var.project_name} S3 Document Vault (${var.environment})"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name = "${var.project_name}-kms-s3-${var.environment}"
  }
}

resource "aws_kms_alias" "s3" {
  name          = "alias/${var.project_name}-s3-${var.environment}"
  target_key_id = aws_kms_key.s3.key_id
}

resource "aws_kms_key" "sqs" {
  description             = "KMS Key for ${var.project_name} SQS Queues (${var.environment})"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name = "${var.project_name}-kms-sqs-${var.environment}"
  }
}

resource "aws_kms_alias" "sqs" {
  name          = "alias/${var.project_name}-sqs-${var.environment}"
  target_key_id = aws_kms_key.sqs.key_id
}

resource "aws_kms_key" "secrets" {
  description             = "KMS Key for ${var.project_name} Secrets Manager (${var.environment})"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name = "${var.project_name}-kms-secrets-${var.environment}"
  }
}

resource "aws_kms_alias" "secrets" {
  name          = "alias/${var.project_name}-secrets-${var.environment}"
  target_key_id = aws_kms_key.secrets.key_id
}

# 2. AWS Secrets Manager Secret Scaffolding (No Hardcoded Plaintext Secrets in Code)
resource "aws_secretsmanager_secret" "app_secrets" {
  name                    = "${var.project_name}/${var.environment}/app-secrets"
  kms_key_id              = aws_kms_key.secrets.arn
  recovery_window_in_days = 7

  tags = {
    Name = "${var.project_name}-app-secrets-${var.environment}"
  }
}

# 3. Chained Security Groups

# ALB Security Group
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb-sg-${var.environment}"
  description = "Controls ingress traffic to Application Load Balancer"
  vpc_id      = var.vpc_id

  ingress {
    description = "Allow HTTPS from anywhere (filtered by WAF/CloudFront)"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Allow HTTP for redirect to HTTPS"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound to private subnets"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-alb-sg-${var.environment}"
  }
}

# API Container Security Group
resource "aws_security_group" "api" {
  name        = "${var.project_name}-api-sg-${var.environment}"
  description = "Controls ingress to NestJS API tasks"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Allow port 3000 ONLY from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-api-sg-${var.environment}"
  }
}

# AI Worker Security Group
resource "aws_security_group" "ai_worker" {
  name        = "${var.project_name}-ai-worker-sg-${var.environment}"
  description = "Controls ingress/egress for FastAPI AI worker tasks"
  vpc_id      = var.vpc_id

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-ai-worker-sg-${var.environment}"
  }
}

# RDS Database Security Group
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg-${var.environment}"
  description = "Controls access to PostgreSQL database cluster"
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL from API tasks"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id, aws_security_group.ai_worker.id]
  }

  tags = {
    Name = "${var.project_name}-rds-sg-${var.environment}"
  }
}

# 4. IAM Roles: Task Execution Role (Infrastructure) vs Task Role (Runtime)

# ECS Task Execution Role (Pull from ECR, write logs, read secrets)
resource "aws_iam_role" "ecs_execution_role" {
  name = "${var.project_name}-ecs-exec-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_standard" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_policy" "ecs_secrets_access" {
  name        = "${var.project_name}-secrets-access-policy-${var.environment}"
  description = "Allows ECS agent to retrieve app secrets and decrypt with KMS"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = aws_secretsmanager_secret.app_secrets.arn
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = aws_kms_key.secrets.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_secrets_attach" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = aws_iam_policy.ecs_secrets_access.arn
}

# NestJS API Task Role (Runtime Permissions)
resource "aws_iam_role" "api_task_role" {
  name = "${var.project_name}-api-task-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_policy" "api_task_policy" {
  name        = "${var.project_name}-api-task-policy-${var.environment}"
  description = "Runtime permissions for NestJS API (SQS send, S3 presign, KMS sign)"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AllowSqsSendMessage"
        Effect   = "Allow"
        Action   = ["sqs:SendMessage", "sqs:GetQueueAttributes", "sqs:GetQueueUrl"]
        Resource = var.sqs_queue_arn
      },
      {
        Sid      = "AllowS3PresignedUrlSigning"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject"]
        Resource = "${var.s3_vault_bucket_arn}/*"
      },
      {
        Sid      = "AllowKmsForS3"
        Effect   = "Allow"
        Action   = ["kms:Decrypt", "kms:GenerateDataKey"]
        Resource = aws_kms_key.s3.arn
      },
      {
        Sid      = "AllowKmsForSqs"
        Effect   = "Allow"
        Action   = ["kms:Decrypt", "kms:GenerateDataKey"]
        Resource = aws_kms_key.sqs.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "api_task_policy_attach" {
  role       = aws_iam_role.api_task_role.name
  policy_arn = aws_iam_policy.api_task_policy.arn
}

# FastAPI AI Worker Task Role (Runtime Permissions)
resource "aws_iam_role" "ai_worker_task_role" {
  name = "${var.project_name}-ai-worker-task-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_policy" "ai_worker_task_policy" {
  name        = "${var.project_name}-ai-worker-task-policy-${var.environment}"
  description = "Runtime permissions for FastAPI AI Worker (SQS receive/delete, Bedrock in ap-south-1, S3 read)"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSqsProcessing"
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:ChangeMessageVisibility"
        ]
        Resource = var.sqs_queue_arn
      },
      {
        Sid      = "AllowBedrockInference"
        Effect   = "Allow"
        Action   = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"]
        Resource = "arn:aws:bedrock:ap-south-1::foundation-model/*"
      },
      {
        Sid      = "AllowS3ReadRawPdfs"
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${var.s3_vault_bucket_arn}/*"
      },
      {
        Sid      = "AllowKmsForS3AndSqs"
        Effect   = "Allow"
        Action   = ["kms:Decrypt", "kms:GenerateDataKey"]
        Resource = [aws_kms_key.s3.arn, aws_kms_key.sqs.arn]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ai_worker_task_policy_attach" {
  role       = aws_iam_role.ai_worker_task_role.name
  policy_arn = aws_iam_policy.ai_worker_task_policy.arn
}

# Outputs
output "kms_rds_arn" { value = aws_kms_key.rds.arn }
output "kms_s3_arn" { value = aws_kms_key.s3.arn }
output "kms_sqs_arn" { value = aws_kms_key.sqs.arn }
output "kms_secrets_arn" { value = aws_kms_key.secrets.arn }
output "app_secrets_arn" { value = aws_secretsmanager_secret.app_secrets.arn }
output "alb_security_group_id" { value = aws_security_group.alb.id }
output "api_security_group_id" { value = aws_security_group.api.id }
output "ai_worker_security_group_id" { value = aws_security_group.ai_worker.id }
output "rds_security_group_id" { value = aws_security_group.rds.id }
output "ecs_execution_role_arn" { value = aws_iam_role.ecs_execution_role.arn }
output "api_task_role_arn" { value = aws_iam_role.api_task_role.arn }
output "ai_worker_task_role_arn" { value = aws_iam_role.ai_worker_task_role.arn }
