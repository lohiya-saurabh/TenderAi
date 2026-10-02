variable "aws_region" {
  type        = string
  default     = "ap-south-1"
  description = "AWS Region (Mumbai for Indian data residency)"
}

variable "project_name" {
  type        = string
  default     = "tenderpulse"
  description = "Project name prefix"
}

variable "environment" {
  type        = string
  default     = "dev"
  description = "Target deployment environment"
}

variable "api_image_uri" {
  type        = string
  default     = "123456789012.dkr.ecr.ap-south-1.amazonaws.com/tenderpulse/api:latest"
  description = "ECR image URI for NestJS API service"
}

variable "ai_worker_image_uri" {
  type        = string
  default     = "123456789012.dkr.ecr.ap-south-1.amazonaws.com/tenderpulse/ai-worker:latest"
  description = "ECR image URI for FastAPI AI Worker service"
}
