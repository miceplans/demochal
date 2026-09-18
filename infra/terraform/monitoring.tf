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
  count               = local.has_alarm_email && var.enable_runtime ? 1 : 0
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
  alarm_actions       = [aws_sns_topic.alarms[0].arn]
  dimensions = {
    LoadBalancer = aws_lb.api.arn_suffix
    TargetGroup  = aws_lb_target_group.api.arn_suffix
  }
}
