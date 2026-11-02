# Distributed rate-limit storage shared by every ECS task. Without it the
# ThrottlerGuard ceiling multiplies by the task count (issue #569). Single-AZ
# staging-grade cache: the data is throwaway counters, so no replica, no
# snapshots, in-transit + at-rest encryption on, reachable only from the API
# task security group inside the VPC.
resource "aws_elasticache_subnet_group" "rate_limit" {
  name       = "${local.name_prefix}-rate-limit"
  subnet_ids = values(aws_subnet.private)[*].id
}

resource "aws_security_group" "rate_limit_redis" {
  name        = "${local.name_prefix}-rate-limit-redis"
  description = "Rate-limit Redis; API tasks only, no public ingress"
  vpc_id      = aws_vpc.this.id

  ingress {
    description     = "Redis from API tasks"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.api_task.id]
  }
}

resource "aws_elasticache_replication_group" "rate_limit" {
  replication_group_id       = "${local.name_prefix}-rate-limit"
  description                = "Distributed rate-limit storage for the API"
  engine                     = "redis"
  engine_version             = "7.1"
  node_type                  = "cache.t4g.micro"
  num_cache_clusters         = 1
  port                       = 6379
  subnet_group_name          = aws_elasticache_subnet_group.rate_limit.name
  security_group_ids         = [aws_security_group.rate_limit_redis.id]
  automatic_failover_enabled = false
  multi_az_enabled           = false
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  snapshot_retention_limit   = 0
}
