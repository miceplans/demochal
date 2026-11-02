data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

locals {
  ecs_service_arn_prefix = "arn:${data.aws_partition.current.partition}:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:service/${aws_ecs_cluster.this.name}"
  api_service_arn        = "${local.ecs_service_arn_prefix}/${aws_ecs_service.api.name}"
  worker_service_arn     = "${local.ecs_service_arn_prefix}/${aws_ecs_service.worker.name}"
}

resource "aws_cloudwatch_log_group" "secret_redeploy" {
  name              = "/aws/lambda/${local.name_prefix}-secret-redeploy"
  retention_in_days = 7
}

data "aws_iam_policy_document" "secret_redeploy_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "secret_redeploy" {
  name               = "${local.name_prefix}-secret-redeploy"
  assume_role_policy = data.aws_iam_policy_document.secret_redeploy_assume_role.json
}

data "aws_iam_policy_document" "secret_redeploy" {
  statement {
    actions   = ["ecs:UpdateService"]
    resources = [local.api_service_arn, local.worker_service_arn]
  }
  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.secret_redeploy.arn}:*"]
  }
}

resource "aws_iam_role_policy" "secret_redeploy" {
  name   = "force-new-deployment"
  role   = aws_iam_role.secret_redeploy.id
  policy = data.aws_iam_policy_document.secret_redeploy.json
}

data "archive_file" "secret_redeploy" {
  type        = "zip"
  source_file = "${path.module}/lambda/secret-redeploy.mjs"
  output_path = "${path.module}/lambda/secret-redeploy.zip"
}

resource "aws_lambda_function" "secret_redeploy" {
  function_name    = "${local.name_prefix}-secret-redeploy"
  role             = aws_iam_role.secret_redeploy.arn
  handler          = "secret-redeploy.handler"
  runtime          = "nodejs24.x"
  filename         = data.archive_file.secret_redeploy.output_path
  source_code_hash = data.archive_file.secret_redeploy.output_base64sha256
  timeout          = 30

  environment {
    variables = {
      ECS_CLUSTER     = aws_ecs_cluster.this.name
      API_SERVICE     = aws_ecs_service.api.name
      WORKER_SERVICE  = aws_ecs_service.worker.name
      APP_SECRET_ARN  = aws_secretsmanager_secret.app.arn
      APP_SECRET_NAME = aws_secretsmanager_secret.app.name
    }
  }

  depends_on = [aws_cloudwatch_log_group.secret_redeploy]
}

resource "aws_cloudwatch_event_rule" "app_secret_value_changed" {
  name        = "${local.name_prefix}-app-secret-value-changed"
  description = "Restart API and worker when the active app secret value changes."
  event_pattern = jsonencode({
    source        = ["aws.secretsmanager"]
    "detail-type" = ["Secret Label Updated"]
    resources     = [aws_secretsmanager_secret.app.arn]
    detail = {
      name         = [aws_secretsmanager_secret.app.name]
      labelUpdated = ["AWSCURRENT"]
    }
  })
}

resource "aws_cloudwatch_event_target" "app_secret_value_changed" {
  rule = aws_cloudwatch_event_rule.app_secret_value_changed.name
  arn  = aws_lambda_function.secret_redeploy.arn
}

resource "aws_lambda_permission" "allow_eventbridge_secret_redeploy" {
  statement_id  = "AllowEventBridgeSecretValueChange"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.secret_redeploy.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.app_secret_value_changed.arn
}
