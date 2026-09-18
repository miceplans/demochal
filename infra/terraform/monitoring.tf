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
