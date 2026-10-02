output "vpc_id" { value = module.vpc.vpc_id }
output "alb_dns_name" { value = module.ecs.alb_dns_name }
output "s3_tenant_vault_bucket" { value = module.s3.tenant_vault_bucket_name }
output "rds_endpoint" { value = module.rds.db_endpoint }
output "sqs_queue_url" { value = module.sqs.ingestion_queue_id }
output "secrets_manager_arn" { value = module.security.app_secrets_arn }
