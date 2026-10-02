variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "project_name" {
  type    = string
  default = "tenderpulse"
}

variable "api_image_uri" {
  type        = string
  description = "Production ECR image URI for NestJS API service"
}

variable "ai_worker_image_uri" {
  type        = string
  description = "Production ECR image URI for FastAPI AI Worker service"
}
