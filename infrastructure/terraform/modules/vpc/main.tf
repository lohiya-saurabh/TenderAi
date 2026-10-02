variable "project_name" { type = string }
variable "environment" { type = string }

# VPC Scaffolding with Private Subnets and VPC Endpoints for S3 & Bedrock
output "vpc_id" {
  value = "vpc-placeholder"
}
