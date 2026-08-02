output "cluster_name" {
  value       = module.eks.cluster_name
  description = "EKS cluster name."
}

output "cluster_endpoint" {
  value       = module.eks.cluster_endpoint
  description = "EKS API endpoint."
}

output "backend_ecr_repository_url" {
  value       = aws_ecr_repository.backend.repository_url
  description = "Backend ECR repository URL."
}

output "frontend_ecr_repository_url" {
  value       = aws_ecr_repository.frontend.repository_url
  description = "Frontend ECR repository URL."
}

output "app_secret_name" {
  value       = aws_secretsmanager_secret.app.name
  description = "AWS Secrets Manager secret read by External Secrets Operator for backend runtime config."
}

output "frontend_secret_name" {
  value       = aws_secretsmanager_secret.frontend.name
  description = "AWS Secrets Manager secret read by External Secrets Operator for frontend runtime config."
}

output "postgres_endpoint" {
  value       = aws_db_instance.postgres.address
  description = "Private PostgreSQL endpoint."
}

output "redis_primary_endpoint" {
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  description = "Private Redis primary endpoint."
}
