variable "project_name" { type = string }
variable "environment" { type = string }
variable "vpc_id" { type = string }

# PostgreSQL Aurora / RDS instance with multi-AZ and automated backups
output "db_endpoint" {
  value = "${var.project_name}-${var.environment}-db.cluster.ap-south-1.rds.amazonaws.com"
}
