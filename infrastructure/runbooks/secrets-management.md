# Secrets Management Runbook

Production secrets live in AWS Secrets Manager and are projected into Kubernetes with External Secrets Operator.

Do not store these in Git, Docker images, Kubernetes manifests, or `.env` files:

- `ConnectionStrings__RfcDatabase`
- `Stripe__SecretKey`
- `Stripe__WebhookSecret`
- `Twilio__AccountSid`
- `Twilio__AuthToken`
- `Twilio__FromPhone`
- `SendGrid__ApiKey`
- `SendGrid__FromEmail`
- `GoogleMaps__ApiKey`
- seed staff credentials

## Secret Paths

- dev: `rfc-watford-dev/app`
- staging: `rfc-watford-staging/app`
- prod: `rfc-watford-prod/app`

## Rotation Procedure

1. Rotate the upstream credential in the provider console.
2. Update the relevant AWS Secrets Manager JSON value.
3. Wait for External Secrets Operator refresh or force it:

```powershell
kubectl annotate externalsecret rfc-backend-secrets -n rfc-prod force-sync=$(Get-Date -Format o) --overwrite
```

4. Restart backend pods if the value is read only at process startup:

```powershell
kubectl rollout restart deployment/rfc-backend -n rfc-prod
kubectl rollout status deployment/rfc-backend -n rfc-prod
```

5. Verify `/health/ready` and complete a checkout smoke test.

## Leak Response

Use the full [credential incident response runbook](credential-incident-response.md). Rotation and containment come before any Git history rewrite.
