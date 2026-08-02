variable "aws_region" {
  type        = string
  description = "AWS region for production infrastructure."
  default     = "eu-west-2"
}

variable "environment" {
  type        = string
  description = "Environment name."
  default     = "prod"
}

variable "project_name" {
  type        = string
  description = "Project name used for resource naming."
  default     = "rfc-watford"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC."
  default     = "10.42.0.0/16"
}

variable "db_instance_class" {
  type        = string
  description = "RDS instance class."
  default     = "db.t4g.medium"
}

variable "db_allocated_storage_gb" {
  type        = number
  description = "Initial PostgreSQL storage in GB."
  default     = 50
}

variable "eks_node_instance_types" {
  type        = list(string)
  description = "EKS worker node instance types."
  default     = ["t3.large"]
}

variable "eks_min_nodes" {
  type        = number
  default     = 2
}

variable "eks_desired_nodes" {
  type        = number
  default     = 3
}

variable "eks_max_nodes" {
  type        = number
  default     = 8
}

variable "redis_node_type" {
  type        = string
  description = "ElastiCache Redis node type."
  default     = "cache.t4g.small"
}

variable "app_domain_name" {
  type        = string
  description = "Production domain served by Kubernetes ingress."
}

variable "cert_manager_email" {
  type        = string
  description = "Email used by Let's Encrypt ClusterIssuer."
}
