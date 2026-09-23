data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

data "tls_certificate" "github_actions" {
  url = "https://token.actions.githubusercontent.com"
}

locals {
  ecs_service_arn_prefix = "arn:${data.aws_partition.current.partition}:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:service/${aws_ecs_cluster.this.name}"
  api_service_arn        = "${local.ecs_service_arn_prefix}/${aws_ecs_service.api.name}"
  worker_service_arn     = "${local.ecs_service_arn_prefix}/${aws_ecs_service.worker.name}"
}

resource "aws_iam_openid_connect_provider" "github_actions" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github_actions.certificates[0].sha1_fingerprint]
}

data "aws_iam_policy_document" "github_actions_assume_role" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github_actions.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    # The production GitHub Environment must be restricted to main. Its
    # The existing GitHub Environment is named `Production`; the standard OIDC
    # subject is environment-scoped rather than ref-scoped and is case-sensitive.
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:miceplans/demochal:environment:Production"]
    }
  }
}

resource "aws_iam_role" "github_actions_deploy" {
  name               = "${local.name_prefix}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_actions_assume_role.json
}

data "aws_iam_policy_document" "github_actions_deploy" {
  statement {
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:CompleteLayerUpload",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
    resources = [aws_ecr_repository.api.arn, aws_ecr_repository.worker.arn]
  }
  statement {
    actions   = ["ecr:BatchGetImage", "ecr:DescribeImages"]
    resources = [aws_ecr_repository.api.arn, aws_ecr_repository.worker.arn]
  }
  statement {
    actions   = ["ecs:DescribeServices", "ecs:DescribeTaskDefinition", "ecs:DescribeTasks"]
    resources = ["*"]
  }
  statement {
    actions   = ["ecs:RegisterTaskDefinition"]
    resources = ["*"]
  }
  statement {
    actions = ["iam:PassRole"]
    resources = [
      aws_iam_role.execution.arn,
      aws_iam_role.api_task.arn,
      aws_iam_role.worker_task.arn,
      aws_iam_role.migrate_task.arn,
    ]
    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }
  statement {
    actions   = ["ecs:UpdateService"]
    resources = [local.api_service_arn, local.worker_service_arn]
  }
  statement {
    actions   = ["ecs:RunTask"]
    resources = ["arn:${data.aws_partition.current.partition}:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:task-definition/${aws_ecs_task_definition.migrate.family}:*"]
  }
}

resource "aws_iam_role_policy" "github_actions_deploy" {
  name   = "deploy-api-worker"
  role   = aws_iam_role.github_actions_deploy.id
  policy = data.aws_iam_policy_document.github_actions_deploy.json
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
  runtime          = "nodejs20.x"
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
