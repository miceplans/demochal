resource "aws_ecr_repository" "api" {
  name                 = "${local.name_prefix}-api"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration { scan_on_push = true }
}

resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name
  # A count-only "keep 2" rule over tagStatus=any can expire the immutable
  # digest an active or rollback ECS task definition still references. Only
  # disposable `test-`-tagged pushes get aggressively pruned; `deploy-`-tagged
  # release images (see infra/README.md's push instructions) keep a bounded
  # rollback set, and untagged manifests from failed pushes are swept
  # separately. Anything tagged outside these two prefixes is left alone.
  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire orphaned untagged images"
        selection    = { tagStatus = "untagged", countType = "imageCountMoreThan", countNumber = 1 }
        action       = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Expire disposable test- images beyond the 2 most recent"
        selection = {
          tagStatus     = "tagged",
          tagPrefixList = ["test-"],
          countType     = "imageCountMoreThan",
          countNumber   = 2
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 3
        description  = "Keep a bounded rollback set of deploy- release images"
        selection = {
          tagStatus     = "tagged",
          tagPrefixList = ["deploy-"],
          countType     = "imageCountMoreThan",
          countNumber   = 10
        }
        action = { type = "expire" }
      },
    ]
  })
}

resource "aws_ecr_repository" "worker" {
  name                 = "${local.name_prefix}-worker"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration { scan_on_push = true }
}

resource "aws_ecr_lifecycle_policy" "worker" {
  repository = aws_ecr_repository.worker.name
  # See aws_ecr_lifecycle_policy.api above for why this is split by tag prefix
  # instead of a single count-only rule.
  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire orphaned untagged images"
        selection    = { tagStatus = "untagged", countType = "imageCountMoreThan", countNumber = 1 }
        action       = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Expire disposable test- images beyond the 2 most recent"
        selection = {
          tagStatus     = "tagged",
          tagPrefixList = ["test-"],
          countType     = "imageCountMoreThan",
          countNumber   = 2
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 3
        description  = "Keep a bounded rollback set of deploy- release images"
        selection = {
          tagStatus     = "tagged",
          tagPrefixList = ["deploy-"],
          countType     = "imageCountMoreThan",
          countNumber   = 10
        }
        action = { type = "expire" }
      },
    ]
  })
}

resource "aws_ecs_cluster" "this" { name = local.name_prefix }

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${local.name_prefix}/api"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${local.name_prefix}/worker"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "migrate" {
  name              = "/ecs/${local.name_prefix}/migrate"
  retention_in_days = 7
}

data "aws_iam_policy_document" "task_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${local.name_prefix}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.task_assume_role.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "execution_secrets" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.app.arn]
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  name   = "read-app-secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_secrets.json
}

resource "aws_iam_role" "api_task" {
  name               = "${local.name_prefix}-api-task"
  assume_role_policy = data.aws_iam_policy_document.task_assume_role.json
}

data "aws_iam_policy_document" "api_task" {
  statement {
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.private.arn}/*"]
  }
  statement {
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.public.arn}/*"]
  }
  statement {
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.verifications.arn]
  }
}

resource "aws_iam_role_policy" "api_task" {
  name   = "api-s3-send-verifications"
  role   = aws_iam_role.api_task.id
  policy = data.aws_iam_policy_document.api_task.json
}

resource "aws_iam_role" "worker_task" {
  name               = "${local.name_prefix}-worker-task"
  assume_role_policy = data.aws_iam_policy_document.task_assume_role.json
}

data "aws_iam_policy_document" "worker_task" {
  statement {
    actions   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
    resources = [aws_sqs_queue.verifications.arn]
  }
  statement {
    # Presigns a short-lived GET for the submitted document so the OCR
    # provider can fetch it; the signature only works if this role can read it.
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.private.arn}/*"]
  }
}

resource "aws_iam_role_policy" "worker_task" {
  name   = "worker-sqs-private-files"
  role   = aws_iam_role.worker_task.id
  policy = data.aws_iam_policy_document.worker_task.json
}

# One-off migration task role: no AWS API calls happen inside the container
# (Drizzle connects to Postgres over the network using DATABASE_URL), so this
# role carries no inline policy beyond the assume-role trust relationship.
resource "aws_iam_role" "migrate_task" {
  name               = "${local.name_prefix}-migrate-task"
  assume_role_policy = data.aws_iam_policy_document.task_assume_role.json
}

resource "aws_lb" "api" {
  name               = "${local.name_prefix}-api"
  load_balancer_type = "application"
  internal           = false
  security_groups    = [aws_security_group.alb.id]
  subnets            = values(aws_subnet.public)[*].id
}

resource "aws_lb_target_group" "api" {
  name        = "${local.name_prefix}-api"
  port        = 3001
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.this.id
  health_check {
    path    = "/health"
    matcher = "200"
  }
}

resource "aws_acm_certificate" "api" {
  domain_name       = var.api_domain_name
  validation_method = "DNS"
}

resource "aws_route53_record" "certificate" {
  for_each = { for dvo in aws_acm_certificate.api.domain_validation_options : dvo.domain_name => dvo }
  zone_id  = var.hosted_zone_id
  name     = each.value.resource_record_name
  type     = each.value.resource_record_type
  records  = [each.value.resource_record_value]
  ttl      = 60
}

resource "aws_route53_record" "api" {
  zone_id = var.hosted_zone_id
  name    = var.api_domain_name
  type    = "A"
  alias {
    name                   = aws_lb.api.dns_name
    zone_id                = aws_lb.api.zone_id
    evaluate_target_health = true
  }
}

resource "aws_acm_certificate_validation" "api" {
  certificate_arn         = aws_acm_certificate.api.arn
  validation_record_fqdns = values(aws_route53_record.certificate)[*].fqdn
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = aws_acm_certificate_validation.api.certificate_arn
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

locals {
  secret_keys = ["DATABASE_URL", "JWT_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI", "TOSS_SECRET_KEY", "CLOVA_OCR_API_URL", "CLOVA_OCR_SECRET_KEY", "NTS_API_KEY"]
  app_secrets = [for key in local.secret_keys : { name = key, valueFrom = "${aws_secretsmanager_secret.app.arn}:${key}::" }]
  common_environment = [
    { name = "NODE_ENV", value = "production" }, { name = "AWS_REGION", value = var.aws_region },
    { name = "DATABASE_SSL_CA_PATH", value = "/app/certs/global-bundle.pem" },
    { name = "S3_PUBLIC_BUCKET", value = aws_s3_bucket.public.id }, { name = "S3_PRIVATE_BUCKET", value = aws_s3_bucket.private.id },
    { name = "SQS_VERIFICATIONS_QUEUE_URL", value = aws_sqs_queue.verifications.url }, { name = "FRONTEND_ORIGIN", value = var.frontend_origin },
    { name = "API_PUBLIC_URL", value = "https://${var.api_domain_name}" },
    { name = "PUBLIC_ASSETS_BASE_URL", value = "https://${aws_cloudfront_distribution.public.domain_name}" }
  ]
  # The migration task only needs DB credentials, not the full application
  # secret set (Toss/OCR/OAuth keys are irrelevant to `drizzle-orm` migrate).
  migrate_secrets = [for s in local.app_secrets : s if s.name == "DATABASE_URL"]
}

resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name_prefix}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.api_task.arn
  container_definitions    = jsonencode([{ name = "api", image = var.api_image != "" ? var.api_image : "public.ecr.aws/docker/library/busybox:latest", essential = true, portMappings = [{ containerPort = 3001 }], environment = local.common_environment, secrets = local.app_secrets, logConfiguration = { logDriver = "awslogs", options = { awslogs-group = aws_cloudwatch_log_group.api.name, awslogs-region = var.aws_region, awslogs-stream-prefix = "api" } } }])
}

resource "aws_ecs_task_definition" "worker" {
  family                   = "${local.name_prefix}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.worker_task.arn
  container_definitions    = jsonencode([{ name = "worker", image = var.worker_image != "" ? var.worker_image : "public.ecr.aws/docker/library/busybox:latest", essential = true, environment = local.common_environment, secrets = local.app_secrets, logConfiguration = { logDriver = "awslogs", options = { awslogs-group = aws_cloudwatch_log_group.worker.name, awslogs-region = var.aws_region, awslogs-stream-prefix = "worker" } } }])
}

# One-off DB migration task. Reuses the API image (same server/ source,
# server/src/migrate.ts is built into the same dist/) with the CMD overridden
# to apply pending Drizzle migrations and exit. Never run as an
# aws_ecs_service — operators launch it on demand with `aws ecs run-task`
# after pushing api_image and before enable_runtime=true (infra/README.md
# step 5) so the schema exists before API/worker queries hit it.
resource "aws_ecs_task_definition" "migrate" {
  family                   = "${local.name_prefix}-migrate"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.migrate_task.arn
  container_definitions = jsonencode([{
    name        = "migrate"
    image       = var.api_image != "" ? var.api_image : "public.ecr.aws/docker/library/busybox:latest"
    essential   = true
    command     = ["node", "dist/migrate.js"]
    environment = [{ name = "NODE_ENV", value = "production" }, { name = "DATABASE_SSL_CA_PATH", value = "/app/certs/global-bundle.pem" }]
    secrets     = local.migrate_secrets
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.migrate.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "migrate"
      }
    }
  }])
}

resource "aws_ecs_service" "api" {
  name            = "api"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.enable_runtime ? var.api_desired_count : 0
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = [aws_subnet.public["0"].id]
    security_groups  = [aws_security_group.api_task.id]
    assign_public_ip = true
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3001
  }
  depends_on = [aws_lb_listener.https]
  lifecycle {
    precondition {
      condition     = !var.enable_runtime || var.api_desired_count == 0 || can(regex("@sha256:[0-9a-f]{64}$", var.api_image))
      error_message = "When the API runtime is enabled, api_image must be an immutable ECR digest."
    }
  }
}

resource "aws_ecs_service" "worker" {
  name            = "worker"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.enable_runtime ? var.worker_desired_count : 0
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = [aws_subnet.public["0"].id]
    security_groups  = [aws_security_group.worker_task.id]
    assign_public_ip = true
  }
  lifecycle {
    precondition {
      condition     = !var.enable_runtime || var.worker_desired_count == 0 || can(regex("@sha256:[0-9a-f]{64}$", var.worker_image))
      error_message = "When the worker runtime is enabled, worker_image must be an immutable ECR digest."
    }
  }
}
