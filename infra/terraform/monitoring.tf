resource "aws_sns_topic" "alarms" {
  count = local.has_alarm_email ? 1 : 0
  name  = "${local.name_prefix}-alarms"
}
resource "aws_sns_topic_subscription" "alarm_email" {
  count     = local.has_alarm_email ? 1 : 0
  topic_arn = aws_sns_topic.alarms[0].arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

resource "aws_cloudwatch_metric_alarm" "alb_unhealthy" {
  alarm_name          = "${local.name_prefix}-alb-unhealthy"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "The staging API has no healthy ALB targets."
  alarm_actions       = local.has_alarm_email ? [aws_sns_topic.alarms[0].arn] : []
  dimensions = {
    LoadBalancer = aws_lb.api.arn_suffix
    TargetGroup  = aws_lb_target_group.api.arn_suffix
  }
}

# UnHealthyHostCount only reports while a target is registered. If the sole API
# task never starts (or is deregistered), the target group has zero targets and
# emits no unhealthy-host data, so that alarm alone never fires during an outage.
# Scoped to enable_runtime: with runtime disabled, zero healthy hosts is expected
# and would otherwise breach permanently.
resource "aws_cloudwatch_metric_alarm" "alb_no_healthy_hosts" {
  # Only enable_runtime gates existence — matching alb_unhealthy above, the
  # alarm itself should exist (and be visible in the console / to other
  # tooling) whether or not an email subscriber is configured; has_alarm_email
  # only controls whether it has an SNS action attached.
  count               = var.enable_runtime ? 1 : 0
  alarm_name          = "${local.name_prefix}-alb-no-healthy-hosts"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Minimum"
  threshold           = 1
  treat_missing_data  = "breaching"
  alarm_description   = "The staging API has zero healthy ALB targets registered."
  alarm_actions       = local.has_alarm_email ? [aws_sns_topic.alarms[0].arn] : []
  dimensions = {
    LoadBalancer = aws_lb.api.arn_suffix
    TargetGroup  = aws_lb_target_group.api.arn_suffix
  }
}

# Staging overview dashboard: ECS CPU/Memory, ALB traffic, RDS health, and recent
# API/Worker error logs on one screen. Every target is a Terraform reference so the
# dashboard follows renames without hardcoded ARNs.
# https://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/CloudWatch-Dashboard-Body-Structure.html
locals {
  dashboard_region = var.aws_region
  api_error_log_query = join(" | ", [
    "SOURCE '${aws_cloudwatch_log_group.api.name}'",
    "fields @timestamp, @message",
    "filter @message like /(?i)(error|exception|fatal)/",
    "sort @timestamp desc",
    "limit 50",
  ])
  worker_error_log_query = join(" | ", [
    "SOURCE '${aws_cloudwatch_log_group.worker.name}'",
    "fields @timestamp, @message",
    "filter @message like /(?i)(error|exception|fatal|failed)/",
    "sort @timestamp desc",
    "limit 50",
  ])
}

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${local.name_prefix}-overview"
  dashboard_body = jsonencode({
    widgets = [
      # Row 1: ECS services
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "API CPU / Memory"
          region = local.dashboard_region
          view   = "timeSeries"
          stat   = "Average"
          period = 300
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", aws_ecs_cluster.this.name, "ServiceName", aws_ecs_service.api.name],
            ["AWS/ECS", "MemoryUtilization", "ClusterName", aws_ecs_cluster.this.name, "ServiceName", aws_ecs_service.api.name],
          ]
          yAxis = { left = { min = 0, max = 100 } }
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "Worker CPU / Memory"
          region = local.dashboard_region
          view   = "timeSeries"
          stat   = "Average"
          period = 300
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", aws_ecs_cluster.this.name, "ServiceName", aws_ecs_service.worker.name],
            ["AWS/ECS", "MemoryUtilization", "ClusterName", aws_ecs_cluster.this.name, "ServiceName", aws_ecs_service.worker.name],
          ]
          yAxis = { left = { min = 0, max = 100 } }
        }
      },
      # Row 2: ALB
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "Requests / 5XX"
          region = local.dashboard_region
          view   = "timeSeries"
          stat   = "Sum"
          period = 300
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", aws_lb.api.arn_suffix],
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", aws_lb.api.arn_suffix],
            ["AWS/ApplicationELB", "HTTPCode_ELB_5XX_Count", "LoadBalancer", aws_lb.api.arn_suffix],
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 6
        height = 6
        properties = {
          title  = "Response Time"
          region = local.dashboard_region
          view   = "timeSeries"
          period = 300
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", aws_lb.api.arn_suffix, { stat = "Average" }],
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", aws_lb.api.arn_suffix, { stat = "p95" }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 18
        y      = 6
        width  = 6
        height = 6
        properties = {
          title  = "Healthy Hosts"
          region = local.dashboard_region
          view   = "timeSeries"
          period = 60
          metrics = [
            ["AWS/ApplicationELB", "HealthyHostCount", "LoadBalancer", aws_lb.api.arn_suffix, "TargetGroup", aws_lb_target_group.api.arn_suffix, { stat = "Minimum" }],
            ["AWS/ApplicationELB", "UnHealthyHostCount", "LoadBalancer", aws_lb.api.arn_suffix, "TargetGroup", aws_lb_target_group.api.arn_suffix, { stat = "Maximum" }],
          ]
        }
      },
      # Row 3: RDS
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 8
        height = 8
        properties = {
          title   = "RDS CPU"
          region  = local.dashboard_region
          view    = "timeSeries"
          stat    = "Average"
          period  = 300
          metrics = [["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", aws_db_instance.postgres.identifier]]
          yAxis   = { left = { min = 0, max = 100 } }
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 12
        width  = 8
        height = 8
        properties = {
          title   = "RDS Connections"
          region  = local.dashboard_region
          view    = "timeSeries"
          stat    = "Maximum"
          period  = 300
          metrics = [["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", aws_db_instance.postgres.identifier]]
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 12
        width  = 8
        height = 8
        properties = {
          title   = "RDS Free Storage"
          region  = local.dashboard_region
          view    = "timeSeries"
          stat    = "Minimum"
          period  = 300
          metrics = [["AWS/RDS", "FreeStorageSpace", "DBInstanceIdentifier", aws_db_instance.postgres.identifier]]
        }
      },
      # Row 4: recent error logs
      {
        type   = "log"
        x      = 0
        y      = 20
        width  = 12
        height = 8
        properties = {
          title  = "API Recent Errors"
          region = local.dashboard_region
          view   = "table"
          query  = local.api_error_log_query
        }
      },
      {
        type   = "log"
        x      = 12
        y      = 20
        width  = 12
        height = 8
        properties = {
          title  = "Worker Recent Errors"
          region = local.dashboard_region
          view   = "table"
          query  = local.worker_error_log_query
        }
      },
    ]
  })
}
