output "vpc_id" {
  value       = module.vpc.vpc_id
  description = "VPC ID"
}

output "alb_dns_name" {
  value       = module.ecs.alb_dns_name
  description = "Application Load Balancer DNS Name"
}

output "s3_tenant_vault_bucket" {
  value       = module.s3.tenant_vault_bucket_name
  description = "Encrypted Tenant Vault S3 Bucket"
}

output "rds_endpoint" {
  value       = module.rds.db_endpoint
  description = "RDS PostgreSQL Endpoint"
}

output "sqs_queue_url" {
  value       = module.sqs.ingestion_queue_id
  description = "SQS Ingestion Queue URL"
}

output "secrets_manager_arn" {
  value       = module.security.app_secrets_arn
  description = "Secrets Manager App Secrets ARN"
}
