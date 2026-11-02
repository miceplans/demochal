data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name_prefix = "${var.project}-${var.environment}"
  # AWS requires at least two AZ subnets for both ALB and an RDS subnet group.
  # Workloads and the RDS primary remain in the first AZ for cost-first Single-AZ staging.
  azs             = slice(data.aws_availability_zones.available.names, 0, 2)
  primary_az      = local.azs[0]
  has_alarm_email = var.alarm_email != ""
}
