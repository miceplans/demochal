output "api_alb_dns_name" { value = aws_lb.api.dns_name }
output "api_url" { value = "https://${var.api_domain_name}" }
output "cloudfront_public_content_domain" { value = aws_cloudfront_distribution.public.domain_name }
output "private_bucket_name" { value = aws_s3_bucket.private.id }
output "public_bucket_name" { value = aws_s3_bucket.public.id }
output "verifications_queue_url" { value = aws_sqs_queue.verifications.url }
output "emails_queue_url" { value = aws_sqs_queue.emails.url }
output "app_secret_arn" { value = aws_secretsmanager_secret.app.arn }
output "api_ecr_repository_url" { value = aws_ecr_repository.api.repository_url }
output "worker_ecr_repository_url" { value = aws_ecr_repository.worker.repository_url }
output "ecs_cluster_name" { value = aws_ecs_cluster.this.name }
output "migrate_task_definition_arn" { value = aws_ecs_task_definition.migrate.arn }
output "migrate_task_subnet_id" { value = aws_subnet.public["0"].id }
output "migrate_task_security_group_id" { value = aws_security_group.migrate_task.id }

output "grafana_cloudwatch_role_arn" {
  description = "IAM role ARN to register with the Grafana Cloud CloudWatch integration."
  value       = aws_iam_role.grafana_cloudwatch_integration.arn
  depends_on  = [time_sleep.wait_for_grafana_iam]
}
