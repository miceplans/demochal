locals {
  email_inbox_key_prefix = "inbound/"
  email_inbound_enabled  = local.ses_enabled && var.ses_support_from_email != ""
}

resource "aws_s3_bucket" "email_inbox" {
  count         = local.email_inbound_enabled ? 1 : 0
  bucket_prefix = "${local.name_prefix}-email-inbox-"
}

resource "aws_s3_bucket_public_access_block" "email_inbox" {
  count                   = local.email_inbound_enabled ? 1 : 0
  bucket                  = aws_s3_bucket.email_inbox[0].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "email_inbox" {
  count  = local.email_inbound_enabled ? 1 : 0
  bucket = aws_s3_bucket.email_inbox[0].id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

data "aws_iam_policy_document" "email_inbox_bucket" {
  count = local.email_inbound_enabled ? 1 : 0
  statement {
    sid       = "AllowSesReceiptRuleObjectWrite"
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.email_inbox[0].arn}/${local.email_inbox_key_prefix}*"]
    principals {
      type        = "Service"
      identifiers = ["ses.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_s3_bucket_policy" "email_inbox" {
  count  = local.email_inbound_enabled ? 1 : 0
  bucket = aws_s3_bucket.email_inbox[0].id
  policy = data.aws_iam_policy_document.email_inbox_bucket[0].json
}

resource "aws_cloudwatch_log_group" "email_processor" {
  count             = local.email_inbound_enabled ? 1 : 0
  name              = "/aws/lambda/${local.name_prefix}-email-processor"
  retention_in_days = 7
}

data "aws_iam_policy_document" "email_processor_assume_role" {
  count = local.email_inbound_enabled ? 1 : 0
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "email_processor" {
  count              = local.email_inbound_enabled ? 1 : 0
  name               = "${local.name_prefix}-email-processor"
  assume_role_policy = data.aws_iam_policy_document.email_processor_assume_role[0].json
}

data "aws_iam_policy_document" "email_processor" {
  count = local.email_inbound_enabled ? 1 : 0
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.email_inbox[0].arn}/${local.email_inbox_key_prefix}*"]
  }
  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.email_processor[0].arn}:*"]
  }
  statement {
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.inbound_emails.arn]
  }
}

resource "aws_iam_role_policy" "email_processor" {
  count  = local.email_inbound_enabled ? 1 : 0
  name   = "read-inbound-email-and-write-logs"
  role   = aws_iam_role.email_processor[0].id
  policy = data.aws_iam_policy_document.email_processor[0].json
}

data "archive_file" "email_processor" {
  count       = local.email_inbound_enabled ? 1 : 0
  type        = "zip"
  source_file = "${path.module}/lambda/email-processor.mjs"
  output_path = "${path.module}/lambda/email-processor.zip"
}

resource "aws_lambda_function" "email_processor" {
  count            = local.email_inbound_enabled ? 1 : 0
  function_name    = "${local.name_prefix}-email-processor"
  role             = aws_iam_role.email_processor[0].arn
  handler          = "email-processor.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.email_processor[0].output_path
  source_code_hash = data.archive_file.email_processor[0].output_base64sha256
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      INBOX_BUCKET      = aws_s3_bucket.email_inbox[0].id
      INBOUND_QUEUE_URL = aws_sqs_queue.inbound_emails.url
    }
  }

  depends_on = [aws_cloudwatch_log_group.email_processor]
}

resource "aws_ses_receipt_rule_set" "email_inbound" {
  count         = local.email_inbound_enabled ? 1 : 0
  rule_set_name = "${local.name_prefix}-email-inbound"
}

resource "aws_ses_receipt_rule" "help" {
  count         = local.email_inbound_enabled ? 1 : 0
  name          = "${local.name_prefix}-help"
  rule_set_name = aws_ses_receipt_rule_set.email_inbound[0].rule_set_name
  recipients    = [var.ses_support_from_email]
  enabled       = true
  scan_enabled  = true
  tls_policy    = "Optional"

  s3_action {
    bucket_name       = aws_s3_bucket.email_inbox[0].id
    object_key_prefix = local.email_inbox_key_prefix
    position          = 1
  }

  lambda_action {
    function_arn    = aws_lambda_function.email_processor[0].arn
    invocation_type = "Event"
    position        = 2
  }
}

resource "aws_ses_active_receipt_rule_set" "email_inbound" {
  count         = local.email_inbound_enabled ? 1 : 0
  rule_set_name = aws_ses_receipt_rule_set.email_inbound[0].rule_set_name
}

resource "aws_lambda_permission" "ses_email_processor" {
  count          = local.email_inbound_enabled ? 1 : 0
  statement_id   = "AllowSesReceiptRuleInvoke"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.email_processor[0].function_name
  principal      = "ses.amazonaws.com"
  source_account = data.aws_caller_identity.current.account_id
}
