variable "aws_region" {
  type        = string
  description = "AWS region for deployment (e.g. ap-south-1 Mumbai)"
  default     = "ap-south-1"
}

variable "project_name" {
  type        = string
  description = "Project name prefix for AWS resources"
  default     = "tenderpulse"
}

variable "environment" {
  type        = string
  description = "Deployment environment name"
  default     = "local"
}

variable "enable_cors_localhost" {
  type        = bool
  description = "Whether to configure CORS for localhost browser direct S3 presigned PUT uploads"
  default     = true
}

variable "create_iam_dev_user" {
  type        = bool
  description = "Whether to create a dedicated IAM user with programmatic keys for local developer testing"
  default     = true
}
