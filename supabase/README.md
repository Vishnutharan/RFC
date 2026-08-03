# Supabase database deployment

The EF model and migrations under `backend/Migrations` are the canonical application schema. `schema.sql` is a Supabase bootstrap mirror and must be updated in the same change whenever an EF migration changes columns, indexes, or tables. It treats Supabase as PostgreSQL storage behind the ASP.NET Core API: the browser must not query these tables through PostgREST. RLS is forced, all Data API roles (including `service_role`) are revoked, and the only RLS policy path is a direct database login named `rfc_backend`.

## Required dedicated role

The schema intentionally does not create a login or embed a password. Before starting the API or its migration Job, a database administrator must create `rfc_backend` through an approved administrative connection and store a randomly generated password directly in the environment secret manager. Do not use the Supabase `postgres` login or service-role key as an application credential.

Create the role without cluster-wide privilege:

```sql
create role rfc_backend
    login
    inherit
    nosuperuser
    nocreatedb
    nocreaterole
    noreplication
    nobypassrls;

grant connect on database postgres to rfc_backend;
grant usage, create on schema public to rfc_backend;
```

Set the password interactively with the approved database client (for example, `\password rfc_backend` in `psql`) so it never appears in SQL history, source control, process arguments, or deployment logs.

The current migration Job deliberately uses the same database secret as the API. Therefore this role must own only the RFC application tables so EF can alter them, while remaining unable to administer roles, databases, Supabase system schemas, or bypass RLS:

```sql
alter table public.menu_categories owner to rfc_backend;
alter table public.menu_items owner to rfc_backend;
alter table public.vouchers owner to rfc_backend;
alter table public.orders owner to rfc_backend;
alter table public.reviews owner to rfc_backend;
alter table public.customers owner to rfc_backend;
alter table public.staff_users owner to rfc_backend;
alter table public.login_attempts owner to rfc_backend;
alter table public.audit_logs owner to rfc_backend;
alter table public.store_settings owner to rfc_backend;
alter table public.payment_webhook_events owner to rfc_backend;
alter table public.voucher_redemptions owner to rfc_backend;

alter default privileges for role rfc_backend in schema public
    revoke all privileges on tables from anon, authenticated, service_role, public;
alter default privileges for role rfc_backend in schema public
    revoke all privileges on sequences from anon, authenticated, service_role, public;
alter default privileges for role rfc_backend in schema public
    revoke all privileges on functions from anon, authenticated, service_role, public;
```

If `public."__EFMigrationsHistory"` already exists, transfer that table to `rfc_backend` as well. On a new database, EF creates it using the dedicated role. Update `ConnectionStrings__RfcDatabase` to use `Username=rfc_backend`, retain certificate verification, and then execute the out-of-band migration Job.

For stronger separation later, introduce a second migration-only secret and remove `CREATE` plus table ownership from the long-running runtime role. Until the application supports separate connection strings, the scoped table-owner role above is the minimum privilege that supports both runtime DML and the same-secret migration Job.

## Verification gates

- Query `pg_roles` and confirm `rfc_backend` has `rolsuper = false`, `rolcreatedb = false`, `rolcreaterole = false`, and `rolbypassrls = false`.
- Connect as `rfc_backend` and verify application CRUD plus the migration Job.
- Connect through PostgREST as `anon`, `authenticated`, and `service_role`; every RFC table must remain inaccessible.
- Confirm no frontend build or browser network request contains a database password or Supabase service-role key.
