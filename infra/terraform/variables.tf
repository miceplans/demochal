variable "aws_region" {
  description = "AWS region for the staging environment."
  type        = string
  default     = "ap-northeast-2"
}

variable "environment" {
  description = "Environment name; this module is designed for staging only."
  type        = string
  default     = "staging"

  validation {
    condition     = var.environment == "staging"
    error_message = "This configuration is intentionally limited to the staging environment."
  }
}

variable "project" {
  description = "Prefix used for AWS resource names."
  type        = string
  default     = "semochal"
}

variable "vpc_cidr" {
  type    = string
  default = "10.42.0.0/16"
}

variable "db_name" {
  type    = string
  default = "semochal"
}

variable "db_username" {
  type    = string
  default = "semochal_admin"
}

variable "api_image" {
  description = "Immutable API image URI pushed to the ECR repository before apply."
  type        = string
}

variable "worker_image" {
  description = "Immutable worker image URI pushed to the ECR repository before apply."
  type        = string
}

variable "frontend_origin" {
  description = "HTTPS browser origin allowed to send credentialed requests to the API."
  type        = string
}

variable "api_domain_name" {
  description = "HTTPS API hostname, for example api-staging.example.com."
  type        = string
}

variable "hosted_zone_id" {
  description = "Route 53 hosted zone ID for api_domain_name."
  type        = string
}

variable "alarm_email" {
  description = "Optional email recipient for staging alarm notifications."
  type        = string
  default     = ""
}

variable "worker_desired_count" {
  description = "Keep the SQS worker stopped by default; enable one task only while testing queue processing."
  type        = number
  default     = 0
  validation {
    condition     = var.worker_desired_count >= 0 && var.worker_desired_count <= 1
    error_message = "Test staging supports only zero or one worker task."
  }
}
