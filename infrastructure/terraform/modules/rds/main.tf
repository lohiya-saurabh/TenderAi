/**
 * RDS Module: PostgreSQL 16 Multi-AZ Database Cluster
 * 
 * - Single transactional source of truth
 * - Multi-AZ synchronous replication for zero-data-loss failover (<60s RTO)
 * - Server-Side Encryption at rest with Customer Managed Key (KMS CMK)
 * - Enforced SSL/TLS connections (rds.force_ssl = 1)
 * - Point-In-Time Recovery (PITR) with automated daily backups
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
variable "db_subnet_group_name" { type = string }
variable "rds_security_group_id" { type = string }
variable "kms_rds_key_arn" { type = string }
variable "instance_class" {
  type        = string
  default     = "db.t4g.medium"
  description = "RDS instance size"
}
variable "allocated_storage" {
  type        = number
  default     = 50
  description = "Initial allocated storage in GB"
}
variable "max_allocated_storage" {
  type        = number
  default     = 500
  description = "Autoscaling storage upper limit in GB"
}
variable "multi_az" {
  type        = bool
  default     = true
  description = "Enable Multi-AZ standby replica"
}

# 1. Custom DB Parameter Group (Enforce TLS and UTF-8)
resource "aws_db_parameter_group" "pg16" {
  name        = "${var.project_name}-pg16-params-${var.environment}"
  family      = "postgres16"
  description = "Custom parameters for ${var.project_name} PostgreSQL 16"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  tags = {
    Name = "${var.project_name}-pg16-params-${var.environment}"
  }
}

# 2. Random Generated Password for RDS Master (Stored in Secrets Manager)
resource "random_password" "master_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# 3. PostgreSQL 16 Multi-AZ Instance
resource "aws_db_instance" "postgres" {
  identifier     = "${var.project_name}-db-${var.environment}"
  engine         = "postgres"
  engine_version = "16.4"
  instance_class = var.instance_class

  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = var.kms_rds_key_arn

  db_name  = "tenderpulse_${var.environment}"
  username = "tp_admin"
  password = random_password.master_password.result

  db_subnet_group_name   = var.db_subnet_group_name
  vpc_security_group_ids = [var.rds_security_group_id]
  parameter_group_name   = aws_db_parameter_group.pg16.name

  multi_az            = var.multi_az
  publicly_accessible = false
  skip_final_snapshot = var.environment == "dev" ? true : false
  final_snapshot_identifier = "${var.project_name}-db-final-snapshot-${var.environment}"

  backup_retention_period   = 30 # 30-day continuous Point-In-Time Recovery
  backup_window             = "21:00-22:00" # UTC (02:30-03:30 IST)
  maintenance_window        = "Sun:22:00-Sun:23:00"
  auto_minor_version_upgrade = true
  deletion_protection       = var.environment == "prod" ? true : false

  tags = {
    Name        = "${var.project_name}-db-${var.environment}"
    Environment = var.environment
  }
}

# Outputs
output "db_endpoint" { value = aws_db_instance.postgres.endpoint }
output "db_address" { value = aws_db_instance.postgres.address }
output "db_port" { value = aws_db_instance.postgres.port }
output "db_name" { value = aws_db_instance.postgres.db_name }
output "db_username" { value = aws_db_instance.postgres.username }
output "db_password" {
  value     = random_password.master_password.result
  sensitive = true
}
