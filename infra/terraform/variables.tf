variable "aws_region" {
  description = "AWS region for the staging environment."
  type        = string
  default     = "ap-northeast-2"
}

variable "environment" {
  description = "Environment name used in resource names (staging or production)."
  type        = string
  default     = "staging"

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}

variable "manage_shared_resources" {
  description = "Create the account-level resources that only one stack per AWS account/region can own: the GitHub Actions OIDC provider, the SES domain identity with its DNS records, and the SES inbound receipt rule set. Set false on a second stack (for example production while staging still owns them) so it references the existing ones instead."
  type        = bool
  default     = true
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_multi_az" {
  type    = bool
  default = false
}

variable "db_backup_retention_days" {
  description = "Automated backup retention in days."
  type        = number
  default     = 1
  validation {
    condition     = var.db_backup_retention_days >= 1 && var.db_backup_retention_days <= 35
    error_message = "db_backup_retention_days must be between 1 and 35."
  }
}

variable "db_deletion_protection" {
  type    = bool
  default = false
}

variable "api_alternate_domain_name" {
  description = "Existing API hostname (for example server.semochall.com, still served by another stack) that this stack should take over. Setting it issues and attaches a TLS certificate for the name ahead of time; it does not move traffic."
  type        = string
  default     = ""
}

variable "api_alternate_domain_cutover" {
  description = "Point api_alternate_domain_name at this stack's load balancer (the traffic cutover). Requires api_alternate_domain_name. The other stack must drop its own record from state first (tofu state rm) so it does not point the name back."
  type        = bool
  default     = false
  validation {
    condition     = !var.api_alternate_domain_cutover || var.api_alternate_domain_name != ""
    error_message = "api_alternate_domain_cutover requires api_alternate_domain_name."
  }
}

variable "db_snapshot_identifier" {
  description = "Restore the DB instance from this snapshot (for example a manual copy of the staging database) when it is created. Changing it replaces the instance, so apply it only while db_deletion_protection is false and the instance holds no data you need."
  type        = string
  default     = null
}

variable "db_skip_final_snapshot" {
  description = "Skip the final snapshot when the DB instance is destroyed. Keep false for production."
  type        = bool
  default     = true
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
  default     = ""
}

variable "worker_image" {
  description = "Immutable worker image URI pushed to the ECR repository before apply."
  type        = string
  default     = ""
}

variable "frontend_origin" {
  description = "HTTPS browser origin(s) allowed to call the API and PUT to the S3 upload bucket. Comma-separate multiple origins."
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

variable "grafana_external_id" {
  description = "Grafana Cloud-provided external ID used to secure its cross-account CloudWatch integration."
  type        = string
  sensitive   = true

  validation {
    condition     = length(trimspace(var.grafana_external_id)) > 0
    error_message = "Grafana external ID is required."
  }
}

variable "grafana_iam_role_name" {
  description = "Name of the IAM role Grafana Cloud assumes for the CloudWatch integration."
  type        = string
  default     = "GrafanaLabsCloudWatchIntegration"
}

variable "worker_desired_count" {
  description = "SQS worker task count. The default of 0 is for bringing up a fresh environment; the live staging stack runs one worker continuously for queue processing and periodic scans."
  type        = number
  default     = 0
  validation {
    condition     = var.worker_desired_count >= 0 && var.worker_desired_count <= 1
    error_message = "Test staging supports only zero or one worker task."
  }
}

variable "toss_payments_enabled" {
  description = "Temporarily open Toss one-off payment confirmation while PAYMENTS_ENABLED stays off."
  type        = bool
  default     = false
}

variable "enable_runtime" {
  description = "Enable ECS services only after images and the app secret JSON have been provisioned."
  type        = bool
  default     = false
}

variable "api_desired_count" {
  type    = number
  default = 1
  validation {
    condition     = var.api_desired_count >= 0 && var.api_desired_count <= 1
    error_message = "Test staging supports zero or one API task."
  }
}

variable "ses_domain" {
  description = "Domain to create as the SES sending identity (Easy DKIM, custom MAIL FROM, DMARC records in hosted_zone_id), e.g. semochall.com. Empty creates no SES identity."
  type        = string
  default     = ""
  validation {
    condition     = var.ses_domain == "" || can(regex("^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$", var.ses_domain))
    error_message = "ses_domain must be empty or a lowercase domain name."
  }
}

variable "ses_dmarc_policy" {
  description = "DMARC policy published for ses_domain. Start with none and tighten after reviewing delivery."
  type        = string
  default     = "none"
  validation {
    condition     = contains(["none", "quarantine", "reject"], var.ses_dmarc_policy)
    error_message = "ses_dmarc_policy must be none, quarantine or reject."
  }
}

variable "ses_configuration_set_name" {
  description = "Existing SES configuration set attached to the sending domain identity; leave empty only when none exists."
  type        = string
  default     = "my-first-configuration-set"
}

variable "ses_from_email" {
  description = "SES sender for automatic service emails at ses_domain (e.g. noreply@semochall.com). Set only after the identity is verified and the account has production access. Empty disables automatic email delivery and grants no SES permission."
  type        = string
  default     = ""
  validation {
    condition     = var.ses_from_email == "" || can(regex("^[^@\\s]+@[^@\\s]+$", var.ses_from_email))
    error_message = "ses_from_email must be empty or a single email address."
  }
}

variable "ses_support_from_email" {
  description = "Support mailbox used for SES inbound receiving and future support replies. Empty disables inbound receiving."
  type        = string
  default     = ""
  validation {
    condition     = var.ses_support_from_email == "" || can(regex("^[^@\\s]+@[^@\\s]+$", var.ses_support_from_email))
    error_message = "ses_support_from_email must be empty or a single email address."
  }
}

variable "enable_db_admin" {
  description = "Create the on-demand db-admin task and the NAT gateway it needs. The NAT gateway bills hourly, so keep this false and enable it only while DB access is needed."
  type        = bool
  default     = false
}

variable "business_document_retention_days" {
  description = "Days a business document (사업자등록증) is kept after its verification is decided; the worker retention scan deletes it afterwards."
  type        = number
  default     = 30
  validation {
    condition     = var.business_document_retention_days >= 1
    error_message = "business_document_retention_days must be at least 1."
  }
}

variable "business_document_max_retention_days" {
  description = "Hard cap in days from submission for a business document: the private bucket lifecycle rule expires tagged documents and the worker scan deletes any older one."
  type        = number
  default     = 90
  validation {
    condition     = var.business_document_max_retention_days >= 1
    error_message = "business_document_max_retention_days must be at least 1."
  }
}
