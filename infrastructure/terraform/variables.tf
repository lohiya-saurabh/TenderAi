variable "aws_region" {
  description = "AWS deployment region (Mandatory ap-south-1 Mumbai for DPDP Act 2023 compliance)"
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Deployment environment (staging, production)"
  type        = string
  default     = "staging"
}

variable "project_name" {
  description = "Project identifier"
  type        = string
  default     = "tenderpulse"
}
