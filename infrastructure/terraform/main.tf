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
    }
  }
}

# 1. VPC Network
module "vpc" {
  source       = "./modules/vpc"
  project_name = var.project_name
  environment  = var.environment
}

# 2. S3 Storage
module "s3" {
  source         = "./modules/s3"
  project_name   = var.project_name
  environment    = var.environment
  kms_s3_key_arn = module.security.kms_s3_arn
}

# 3. SQS Queues
module "sqs" {
  source          = "./modules/sqs"
  project_name    = var.project_name
  environment     = var.environment
  kms_sqs_key_arn = module.security.kms_sqs_arn
}

# 4. Security (KMS, IAM Roles, Security Groups, Secrets Manager)
module "security" {
  source              = "./modules/security"
  project_name        = var.project_name
  environment         = var.environment
  vpc_id              = module.vpc.vpc_id
  s3_vault_bucket_arn = module.s3.tenant_vault_bucket_arn
  sqs_queue_arn       = module.sqs.ingestion_queue_arn
}

# 5. RDS PostgreSQL 16
module "rds" {
  source                = "./modules/rds"
  project_name          = var.project_name
  environment           = var.environment
  db_subnet_group_name  = module.vpc.db_subnet_group_name
  rds_security_group_id = module.security.rds_security_group_id
  kms_rds_key_arn       = module.security.kms_rds_arn
}
