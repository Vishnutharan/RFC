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

helm upgrade --install external-secrets external-secrets/external-secrets `
  --namespace external-secrets --create-namespace

kubectl apply -f cluster/cluster-issuer.yaml
kubectl apply -f cluster/cluster-secret-store.yaml
```

Update `cluster/cluster-issuer.yaml` with the production operations email before applying.

## Deploy Environments

```powershell
kubectl apply -k overlays/dev
kubectl apply -k overlays/staging
kubectl apply -k overlays/prod
```

Each overlay uses its own namespace and AWS Secrets Manager path:

- `rfc-watford-dev/app`
- `rfc-watford-staging/app`
- `rfc-watford-prod/app`

## Runtime Probes

Kubernetes uses:

- `/health/live` for liveness
- `/health/ready` for readiness

Readiness checks PostgreSQL connectivity. If the database is unavailable, the pod stays out of service while the process remains alive.

## TLS

Ingress uses cert-manager with Let's Encrypt and NGINX annotations to enforce HTTPS and TLS 1.3.

## Image Promotion

The overlays use immutable image tags by environment. In CI/CD, patch image tags with the Git SHA:

```powershell
kubectl set image deployment/rfc-backend api=<registry>/rfc-backend:<sha> -n rfc-staging
kubectl set image deployment/rfc-frontend web=<registry>/rfc-frontend:<sha> -n rfc-staging
```
