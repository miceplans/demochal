locals {
  grafana_account_id = "008923505280"
}

data "aws_iam_policy_document" "trust_grafana" {
  statement {
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${local.grafana_account_id}:root"]
    }

    actions = ["sts:AssumeRole"]

    condition {
      test     = "StringEquals"
      variable = "sts:ExternalId"
      values   = [var.grafana_external_id]
    }
  }
}

resource "aws_iam_role" "grafana_cloudwatch_integration" {
  name               = var.grafana_iam_role_name
  description        = "Role used by Grafana CloudWatch integration."
  assume_role_policy = data.aws_iam_policy_document.trust_grafana.json
}

resource "aws_iam_role_policy" "grafana_cloudwatch_integration" {
  name = "GrafanaLabsCloudWatchIntegrationPolicy"
  role = aws_iam_role.grafana_cloudwatch_integration.id

  # Grafana Cloud uses these read-only APIs to discover and query AWS metrics.
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "tag:GetResources",
          "cloudwatch:GetMetricData",
          "cloudwatch:ListMetrics",
          "apigateway:GET",
          "aps:ListWorkspaces",
          "autoscaling:DescribeAutoScalingGroups",
          "dms:DescribeReplicationInstances",
          "dms:DescribeReplicationTasks",
          "ec2:DescribeTransitGatewayAttachments",
          "ec2:DescribeSpotFleetRequests",
          "shield:ListProtections",
          "storagegateway:ListGateways",
          "storagegateway:ListTagsForResource",
        ]
        Resource = "*"
      },
    ]
  })
}

# IAM is global and can take a short time to propagate before Grafana assumes it.
resource "time_sleep" "wait_for_grafana_iam" {
  depends_on = [
    aws_iam_role.grafana_cloudwatch_integration,
    aws_iam_role_policy.grafana_cloudwatch_integration,
  ]

  create_duration = "10s"
}
