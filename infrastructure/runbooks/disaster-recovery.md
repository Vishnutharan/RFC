# Disaster Recovery Runbook

Target objectives:

- RPO: 5 minutes
- RTO: 30 minutes

The production Terraform stack enables RDS automated backups with 35-day point-in-time recovery retention and deletion protection.

## Monthly Restore Test

1. Choose a timestamp from the last 24 hours.
2. Restore production RDS to a temporary instance using point-in-time recovery.
3. Connect the staging backend to the temporary restored endpoint.
4. Verify:
   - `/health/ready` returns healthy
   - menu items load
   - order history queries work
   - staff login works with staging credentials
5. Destroy the temporary restored instance after verification.
6. Record the measured restore time and any issues.

## AWS CLI Restore Example

```powershell
aws rds restore-db-instance-to-point-in-time `
  --source-db-instance-identifier rfc-watford-prod-postgres `
  --target-db-instance-identifier rfc-watford-prod-restore-test `
  --restore-time 2026-08-02T12:00:00Z
```

## Failover Procedure

1. Freeze deployments.
2. Identify the latest safe restore timestamp.
3. Restore RDS to a new instance.
4. Update the `ConnectionStrings__RfcDatabase` value in AWS Secrets Manager.
5. Restart backend pods:

```powershell
kubectl rollout restart deployment/rfc-backend -n rfc-prod
kubectl rollout status deployment/rfc-backend -n rfc-prod
```

6. Verify `/health/ready`.
7. Run a staff-only smoke test.
8. Unfreeze deployments.

## Backup Monitoring

Alert if:

- RDS automated backup retention is below 7 days
- latest restorable time is older than 5 minutes
- a monthly restore test has not been recorded
- deletion protection is disabled on production RDS

Backups that have not been restored in a test are not considered valid.
