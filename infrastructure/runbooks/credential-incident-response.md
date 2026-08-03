# Credential Incident Response

Use this runbook whenever a password, API key, connection string, session key, or private token reaches Git, a container layer, CI output, an application log, or an unapproved workstation.

The repository review found a staff seed credential in Git history at commit `db4b6160074f3d013ba25adff2a2254b2e82e437`. It also found 1,136 tracked files from an Edge browser profile under `screenshots/` in public repository history, including cookie, login, history, and local-storage databases. Do not copy leaked values into tickets, chat, commands, or this repository. Treat every affected credential and session as compromised even if the commit is later rewritten.

## 1. Contain and preserve evidence

1. Open a restricted incident record and appoint an incident commander and scribe.
2. Record discovery time, affected environments, credential owner, repositories, registries, logs, and known consumers. Do not record the secret value.
3. Preserve relevant audit events and provider logs in access-controlled storage before deleting artifacts.
4. Freeze non-incident deployments and repository writes if a history rewrite is likely.
5. Disable the affected account or key when that is faster than rotation.

## 2. Rotate and invalidate

Rotate at the source of truth first, then update AWS Secrets Manager and force an External Secrets refresh as described in `secrets-management.md`.

- Staff or seed credential: disable the exposed account, set a new unique password through the approved admin workflow, require a reset at next sign-in, and remove `SeedAdmin__Password` after bootstrap.
- Database credential: rotate the database user password, terminate existing sessions for that user, update Secrets Manager, and restart every backend replica.
- Payment, messaging, maps, or email key: create a replacement, deploy it, verify the integration, then revoke the old key.
- Authentication or Data Protection key: revoke or replace the shared key ring and force reauthentication across every replica. A rolling restart alone is not a reliable revocation mechanism.
- Browser-profile exposure: terminate sessions for every account used by that profile, rotate saved passwords and API credentials, review account recovery methods, and replace the local browser profile after evidence is preserved. Include Git hosting, cloud, database, Supabase, Stripe, email, messaging, and administrative accounts.
- Application sessions and tracking links: rotate all staff and customer `security_stamp` values through an approved database change and invalidate active guest order-access hashes where exposure is possible. Plan customer support before invalidating live tracking links.

After rotation, inspect database, cloud, payment-provider, messaging-provider, ingress, and application audit logs from the earliest possible exposure time. Escalate any unexplained use as a confirmed compromise.

## 3. Purge derived artifacts

Assume the credential may exist outside the current checkout.

- Delete affected container tags and registry caches after replacement images have been built from a clean context.
- Invalidate CI caches and remove secret-bearing logs or artifacts according to the platform retention procedure.
- Check forks, pull-request refs, release archives, backups, developer clones, issue attachments, and chat uploads.
- Keep any required evidence encrypted and access controlled under the incident retention policy.

The `backend/.dockerignore` file prevents dotenv files from entering future backend build contexts. It does not remove data from an existing image layer or registry cache.

## 4. Rewrite Git history only after rotation

History rewriting is destructive coordination work, not a substitute for revocation. Perform it from a new restricted mirror clone, with an encrypted backup and an approved maintenance window.

1. Install the current `git-filter-repo` release from its official source.
2. Prepare a replacement file outside the repository. Put the exact leaked value in that file, never in a command line, shell history, or CI variable. Restrict the file permissions to the incident operator.
3. Rewrite every branch and tag:

```powershell
git filter-repo --sensitive-data-removal --replace-text C:\restricted\replacements.txt
```

Remove the tracked browser profile from every ref in the same restricted rewrite process:

```powershell
git filter-repo --sensitive-data-removal --path screenshots --invert-paths
```

Test the combined rewrite procedure on a disposable mirror first. Depending on the approved tool version, combining path removal and text replacement in one invocation can be preferable to sequential rewrites.

4. Review the rewritten object database with an approved full-history scanner such as Gitleaks. Confirm the exposed value is absent before publishing.
5. Force-push all rewritten branches and tags only after repository-owner approval:

```powershell
git push --force --mirror origin
```

6. Ask the Git hosting provider to expire cached views and pull-request references that cannot be removed by the mirror push.
7. Require every collaborator to delete old clones and re-clone. Merging an old branch can reintroduce the leaked objects.
8. Securely dispose of the replacements file and encrypted rewrite backup when incident-retention requirements allow.

## 5. Recover and prevent recurrence

1. Deploy clean images and verify readiness, sign-in, checkout, payment, and notification paths.
2. Confirm the old credential fails and all previously issued sessions are rejected.
3. Enable repository secret scanning and push protection, including full-history and pull-request scans.
4. Prohibit real bootstrap credentials in source and require one-time, expiring provisioning credentials.
5. Record root cause, exposure window, affected data, customer or regulator notification decision, and follow-up owners.
6. Close the incident only after rotations, artifact cleanup, monitoring, and preventive actions have evidence attached.
