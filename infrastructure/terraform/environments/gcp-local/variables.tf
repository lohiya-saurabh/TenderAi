variable "gcp_project_id" {
  description = "Google Cloud Platform Project ID"
  type        = string
  default     = "tenderpulse-dev"
}

variable "gcp_region" {
  description = "Google Cloud primary region (Mumbai by default for data residency)"
  type        = string
  default     = "asia-south1"
}

variable "project_name" {
  description = "Project name prefix for resources"
  type        = string
  default     = "tenderpulse"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "local"
}

variable "enable_cors_localhost" {
  description = "Whether to configure CORS for local development ports"
  type        = bool
  default     = true
}

variable "create_service_account" {
  description = "Whether to create a dedicated local dev service account with keys"
  type        = bool
  default     = true
}
