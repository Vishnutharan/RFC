output "state_bucket_name" {
  value       = aws_s3_bucket.state.bucket
  description = "S3 bucket for Terraform remote state."
}

output "lock_table_name" {
  value       = aws_dynamodb_table.locks.name
  description = "DynamoDB lock table for Terraform remote state."
}

output "state_kms_key_arn" {
  value       = aws_kms_key.state.arn
  description = "KMS key used to encrypt Terraform remote state."
}
