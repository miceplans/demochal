resource "aws_db_subnet_group" "this" {
  name       = "${local.name_prefix}-database"
  subnet_ids = values(aws_subnet.private)[*].id
}

resource "aws_db_instance" "postgres" {
  identifier                   = "${local.name_prefix}-postgres"
  engine                       = "postgres"
  engine_version               = "16"
  instance_class               = "db.t4g.micro"
  allocated_storage            = 20
  storage_encrypted            = true
  db_name                      = var.db_name
  username                     = var.db_username
  manage_master_user_password  = true
  multi_az                     = false
  publicly_accessible          = false
  deletion_protection          = false
  skip_final_snapshot          = true
  backup_retention_period      = 1
  backup_window                = "18:00-18:30"
  maintenance_window           = "sun:19:00-sun:19:30"
  auto_minor_version_upgrade   = true
  db_subnet_group_name         = aws_db_subnet_group.this.name
  vpc_security_group_ids       = [aws_security_group.database.id]
  performance_insights_enabled = false
}

resource "aws_sqs_queue" "verifications_dlq" {
  name                      = "${local.name_prefix}-verifications-dlq"
  message_retention_seconds = 1209600
}

resource "aws_sqs_queue" "verifications" {
  name                       = "${local.name_prefix}-verifications"
  visibility_timeout_seconds = 120
  receive_wait_time_seconds  = 20
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.verifications_dlq.arn
    maxReceiveCount     = 5
  })
}

resource "aws_s3_bucket" "private" {
  bucket_prefix = "${local.name_prefix}-private-"
}

resource "aws_s3_bucket_public_access_block" "private" {
  bucket                  = aws_s3_bucket.private.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "private" {
  bucket = aws_s3_bucket.private.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

# requestUpload() returns a presigned PUT for this bucket that the browser calls
# directly from frontend_origin; without CORS the preflight for that cross-origin
# PUT has no Access-Control-Allow-Origin and the upload never happens.
resource "aws_s3_bucket_cors_configuration" "private" {
  bucket = aws_s3_bucket.private.id
  cors_rule {
    allowed_methods = ["PUT"]
    allowed_origins = [var.frontend_origin]
    allowed_headers = ["Content-Type", "Content-Length"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket" "public" {
  bucket_prefix = "${local.name_prefix}-public-"
}

resource "aws_s3_bucket_public_access_block" "public" {
  bucket                  = aws_s3_bucket.public.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "public" {
  bucket = aws_s3_bucket.public.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_cloudfront_origin_access_control" "public" {
  name                              = "${local.name_prefix}-public-content"
  description                       = "CloudFront-only access to public content bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "public" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "${local.name_prefix} public content"

  origin {
    domain_name              = aws_s3_bucket.public.bucket_regional_domain_name
    origin_id                = "public-content"
    origin_access_control_id = aws_cloudfront_origin_access_control.public.id
  }

  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "public-content"
    viewer_protocol_policy     = "redirect-to-https"
    compress                   = true
    response_headers_policy_id = aws_cloudfront_response_headers_policy.public.id

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate { cloudfront_default_certificate = true }
}

resource "aws_cloudfront_response_headers_policy" "public" {
  name = "${local.name_prefix}-public-content"
  security_headers_config {
    content_type_options { override = true }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      referrer_policy = "same-origin"
      override        = true
    }
  }
}

data "aws_iam_policy_document" "public_bucket" {
  statement {
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.public.arn}/*"]
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.public.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "public" {
  bucket = aws_s3_bucket.public.id
  policy = data.aws_iam_policy_document.public_bucket.json
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "${local.name_prefix}/app"
  description             = "Manual JSON secret for DATABASE_URL, JWT_SECRET and third-party credentials; Terraform never stores its value."
  recovery_window_in_days = 7
}
