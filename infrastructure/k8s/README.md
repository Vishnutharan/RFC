# RFC Watford Kubernetes Deployment

This folder moves production deployment away from single-host Docker Compose and into Kubernetes.

## Cluster Add-ons

Install these once per cluster before applying app manifests:

```powershell
kubectl apply -f namespaces.yaml

helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo add jetstack https://charts.jetstack.io
helm repo add external-secrets https://charts.external-secrets.io
helm repo update

helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx `
  --namespace ingress-nginx --create-namespace

helm upgrade --install cert-manager jetstack/cert-manager `
  --namespace cert-manager --create-namespace `
  --set crds.enabled=true

$externalSecretsRoleArn = terraform -chdir=../terraform/aws/envs/prod output -raw external_secrets_role_arn
if ($LASTEXITCODE -ne 0 -or $externalSecretsRoleArn -notmatch '^arn:aws[a-z-]*:iam::[0-9]{12}:role/.+') {
  throw "Terraform did not return a valid External Secrets IRSA role ARN."
}

helm upgrade --install external-secrets external-secrets/external-secrets `
  --namespace external-secrets --create-namespace `
  --set serviceAccount.create=true `
  --set serviceAccount.name=external-secrets `
  --set-string "serviceAccount.annotations.eks\.amazonaws\.com/role-arn=$externalSecretsRoleArn"

kubectl apply -f cluster/cluster-issuer.yaml
kubectl apply -f cluster/cluster-secret-store.yaml

$installedRoleArn = kubectl get serviceaccount external-secrets -n external-secrets `
  -o jsonpath="{.metadata.annotations.eks\.amazonaws\.com/role-arn}"
if ($LASTEXITCODE -ne 0 -or $installedRoleArn -ne $externalSecretsRoleArn) {
  throw "External Secrets service account is missing the expected IRSA annotation."
}

kubectl wait --for=condition=Ready clustersecretstore/aws-secretsmanager --timeout=2m
if ($LASTEXITCODE -ne 0) { throw "ClusterSecretStore is not ready; application release is blocked." }
```

Update `cluster/cluster-issuer.yaml` with the production operations email before applying.

## Deploy Environments

```powershell
kubectl apply -k overlays/dev
kubectl apply -k overlays/staging
```

Production does not run schema migrations during web-process startup. Apply the production platform resources during initial provisioning, then run the out-of-band migration Job below before promoting each backend image:

```powershell
# One-time bootstrap only. For upgrades, keep the current backend running and
# do not apply a manifest containing the new image before its migration succeeds.
# kubectl apply -k overlays/prod

$backendDigest = "REPLACE_WITH_APPROVED_BACKEND_64_CHARACTER_DIGEST"
$frontendDigest = "REPLACE_WITH_APPROVED_FRONTEND_64_CHARACTER_DIGEST"
if ($backendDigest -notmatch '^[a-f0-9]{64}$') { throw "A lowercase backend SHA-256 digest is required." }
if ($frontendDigest -notmatch '^[a-f0-9]{64}$') { throw "A lowercase frontend SHA-256 digest is required." }

$jobTemplate = Get-Content -Raw operations/prod-database-migration-job.yaml
$jobManifest = $jobTemplate.Replace("REPLACE_WITH_APPROVED_64_CHARACTER_DIGEST", $backendDigest)
$jobResource = $jobManifest | kubectl create -f - -o name
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($jobResource)) { throw "Migration Job creation failed." }

kubectl wait --for=condition=complete --timeout=15m $jobResource -n rfc-prod
if ($LASTEXITCODE -ne 0) {
  kubectl logs $jobResource -n rfc-prod
  throw "Database migration failed; backend promotion is blocked."
}
kubectl logs $jobResource -n rfc-prod

kubectl set image deployment/rfc-backend `
  api="ghcr.io/rfc-watford/rfc-backend@sha256:$backendDigest" `
  -n rfc-prod
kubectl set image deployment/rfc-frontend `
  web="ghcr.io/rfc-watford/rfc-frontend@sha256:$frontendDigest" `
  -n rfc-prod
kubectl rollout status deployment/rfc-backend -n rfc-prod --timeout=10m
kubectl rollout status deployment/rfc-frontend -n rfc-prod --timeout=10m
```

The Job uses `generateName`, so every execution is a distinct auditable resource and avoids immutable Job update failures. It is deliberately outside `base` and every environment overlay. If the Job fails, inspect its logs and stop the rollout; do not promote the web deployment until the migration completes successfully. In a GitOps deployment, replace both digest placeholders in `overlays/prod/kustomization.yaml` in an approved release commit and apply it only after the Job succeeds, instead of using `kubectl set image`. Unreplaced placeholders intentionally make a production apply fail closed.

Each overlay uses its own namespace and AWS Secrets Manager path:

- `rfc-watford-dev/app`
- `rfc-watford-staging/app`
- `rfc-watford-prod/app`

The External Secrets IAM policy permits only those application-secret name patterns. Create the dev/staging entries before deploying those overlays. After applying an overlay, treat secret synchronization as a release gate:

```powershell
kubectl wait --for=condition=Ready externalsecret/rfc-backend-secrets -n rfc-prod --timeout=2m
if ($LASTEXITCODE -ne 0) { throw "Backend ExternalSecret is not ready; release is blocked." }
kubectl get secret rfc-backend-secrets -n rfc-prod -o name
```

Do not start the backend or migration Job until the `ClusterSecretStore`, `ExternalSecret`, and generated Kubernetes Secret are all present and Ready.

## Runtime Probes

Kubernetes uses:

- `/health/live` for liveness
- `/health/ready` for readiness

Readiness checks PostgreSQL connectivity. If the database is unavailable, the pod stays out of service while the process remains alive.

## TLS

Ingress uses cert-manager with Let's Encrypt and NGINX annotations to enforce HTTPS and TLS 1.3.

## Image Promotion

Development and staging use environment tags for convenience. Production accepts only registry digests through the guarded workflow above. For staging, CI/CD can patch image tags with the Git SHA:

```powershell
kubectl set image deployment/rfc-backend api=<registry>/rfc-backend:<sha> -n rfc-staging
kubectl set image deployment/rfc-frontend web=<registry>/rfc-frontend:<sha> -n rfc-staging
```
