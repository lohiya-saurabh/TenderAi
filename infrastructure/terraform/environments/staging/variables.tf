variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "project_name" {
  type    = string
  default = "tenderpulse"
}

variable "environment" {
  type    = string
  default = "staging"
}

variable "api_image_uri" {
  type    = string
  default = "123456789012.dkr.ecr.ap-south-1.amazonaws.com/tenderpulse/api:staging-latest"
}

variable "ai_worker_image_uri" {
  type    = string
  default = "123456789012.dkr.ecr.ap-south-1.amazonaws.com/tenderpulse/ai-worker:staging-latest"
}
