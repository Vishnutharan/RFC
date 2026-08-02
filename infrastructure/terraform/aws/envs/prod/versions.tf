terraform {
  required_version = ">= 1.8.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Copy backend.tf.example to backend.tf after running bootstrap-state.
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "rfc-watford"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
