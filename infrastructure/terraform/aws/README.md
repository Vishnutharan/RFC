# RFC Watford AWS Foundation

This Terraform stack creates the production foundation for RFC Watford:

- encrypted remote Terraform state in S3 with DynamoDB locking
- VPC with public/private subnets across three availability zones
- private-endpoint EKS with control-plane audit logging and AL2023 workers
- Multi-AZ RDS PostgreSQL with encrypted storage, forced TLS, deletion protection, and 35-day PITR backup retention
- Multi-AZ ElastiCache Redis with TLS and AUTH for distributed sessions, cache, and rate-limit counters
- ECR repositories for backend and frontend images
- an AWS Secrets Manager application entry consumed through least-privilege IRSA

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

After apply, update the application Secrets Manager entry with production values:

- `<project>-prod/app`

Do not put Stripe, Twilio, SendGrid, Google, or database credentials into images or Git.
`Stripe__PublishableKey` is public configuration, but it is kept in the backend application object so `/api/config/public` can expose it at runtime; there is no frontend runtime secret.

The generated RDS connection initially uses the RDS master account so the first schema migration can run. This is a bootstrap credential, not an approved steady-state application identity. Before go-live, provision a dedicated RFC table-owner role with no `rds_superuser`, `CREATEDB`, `CREATEROLE`, or unrelated-schema grants, update the application secret, verify the migration Job, and rotate away from the master password. A future split between migration-owner and runtime-DML roles is recommended; until separate connection strings exist, retaining the RDS master account in the backend is a release blocker.

## 3. Connect kubectl

The Kubernetes API endpoint is private. Establish approved private connectivity to the VPC first (for example, corporate VPN, Direct Connect, or an SSM-managed administration host); do not re-enable a world-accessible public endpoint for convenience.

```powershell
aws eks update-kubeconfig --region eu-west-2 --name rfc-watford-prod-eks
```

Then apply the Kubernetes manifests in `infrastructure/k8s`. The production overlay mounts the reviewed eu-west-2 RDS root CA and the generated connection string uses `SSL Mode=VerifyFull`; keep the Terraform CA identifier, vendored root, and deployment mount in sync during CA changes.
