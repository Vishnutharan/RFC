# RFC Watford AWS Foundation

This Terraform stack creates the production foundation for RFC Watford:

- encrypted remote Terraform state in S3 with DynamoDB locking
- VPC with public/private subnets across three availability zones
- EKS for rolling, self-healing Kubernetes deployments
- RDS PostgreSQL with encrypted storage, deletion protection, and 35-day PITR backup retention
- ElastiCache Redis for future distributed sessions, cache, and rate-limit counters
- ECR repositories for backend and frontend images
- AWS Secrets Manager entries consumed by Kubernetes External Secrets

## 1. Bootstrap Remote State

```powershell
cd infrastructure/terraform/aws/bootstrap-state
terraform init
terraform apply -var="state_bucket_name=<globally-unique-bucket-name>"
```

Copy the output bucket/table values into `envs/prod/backend.tf` from `backend.tf.example`.

## 2. Create Production Infrastructure

```powershell
cd ../envs/prod
Copy-Item backend.tf.example backend.tf
Copy-Item terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

After apply, update the two Secrets Manager entries with production values:

- `<project>-prod/app`
- `<project>-prod/frontend`

Do not put Stripe, Twilio, SendGrid, Google, or database credentials into images or Git.

## 3. Connect kubectl

```powershell
aws eks update-kubeconfig --region eu-west-2 --name rfc-watford-prod-eks
```

Then apply the Kubernetes manifests in `infrastructure/k8s`.
