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

  # Production S3 Remote Backend with DynamoDB State Locking
  # backend "s3" {
  #   bucket         = "tenderpulse-terraform-state-prod"
  #   key            = "environments/prod/terraform.tfstate"
  #   region         = "ap-south-1"
  #   dynamodb_table = "tenderpulse-terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = "prod"
      ManagedBy   = "Terraform"
      Compliance  = "DPDP-Act-2023"
    }
  }
}

# 1. Network: 3-Tier Multi-AZ VPC (ap-south-1a & ap-south-1b)
module "vpc" {
  source             = "../../modules/vpc"
  project_name       = var.project_name
  environment        = "prod"
  single_nat_gateway = false
}

# 2. Storage: S3 Document Vault & SPA
module "s3" {
  source         = "../../modules/s3"
  project_name   = var.project_name
  environment    = "prod"
  kms_s3_key_arn = module.security.kms_s3_arn
}

# 3. Queues: SQS Ingestion Queue & DLQ
module "sqs" {
  source          = "../../modules/sqs"
  project_name    = var.project_name
  environment     = "prod"
  kms_sqs_key_arn = module.security.kms_sqs_arn
}

# 4. Security: KMS CMKs, IAM Least Privilege, Secrets Manager, Security Groups
module "security" {
  source              = "../../modules/security"
  project_name        = var.project_name
  environment         = "prod"
  vpc_id              = module.vpc.vpc_id
  s3_vault_bucket_arn = module.s3.tenant_vault_bucket_arn
  sqs_queue_arn       = module.sqs.ingestion_queue_arn
}

# 5. Database: Amazon RDS PostgreSQL 16 Multi-AZ with 100GB gp3
module "rds" {
  source                = "../../modules/rds"
  project_name          = var.project_name
  environment           = "prod"
  db_subnet_group_name  = module.vpc.db_subnet_group_name
  rds_security_group_id = module.security.rds_security_group_id
  kms_rds_key_arn       = module.security.kms_rds_arn
  instance_class        = "db.t4g.medium"
  allocated_storage     = 100
  max_allocated_storage = 1000
  multi_az              = true
}

# 6. Compute: ECS Fargate Cluster, ALB, NestJS API & FastAPI AI Worker
module "ecs" {
  source                      = "../../modules/ecs"
  project_name                = var.project_name
  environment                 = "prod"
  vpc_id                      = module.vpc.vpc_id
  public_subnet_ids           = module.vpc.public_subnet_ids
  private_app_subnet_ids      = module.vpc.private_app_subnet_ids
  alb_security_group_id       = module.security.alb_security_group_id
  api_security_group_id       = module.security.api_security_group_id
  ai_worker_security_group_id = module.security.ai_worker_security_group_id
  ecs_execution_role_arn      = module.security.ecs_execution_role_arn
  api_task_role_arn           = module.security.api_task_role_arn
  ai_worker_task_role_arn     = module.security.ai_worker_task_role_arn
  api_image_uri               = var.api_image_uri
  ai_worker_image_uri         = var.ai_worker_image_uri
  app_secrets_arn             = module.security.app_secrets_arn
  database_url_secret_arn     = module.rds.database_url_secret_arn
  api_desired_count           = 2
  ai_worker_desired_count     = 2
}
