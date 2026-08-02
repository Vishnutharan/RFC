variable "aws_region" {
  type        = string
  description = "AWS region for the Terraform state bucket and lock table."
  default     = "eu-west-2"
}

variable "environment" {
  type        = string
  description = "Environment name used in tags."
  default     = "shared"
}

variable "state_bucket_name" {
  type        = string
  description = "Globally unique S3 bucket name for Terraform remote state."
}

variable "lock_table_name" {
  type        = string
  description = "DynamoDB table name for Terraform state locking."
  default     = "rfc-watford-terraform-locks"
}
