# Upgrading

1. Read the release notes and check the supported Node/image version.
2. Create and verify a PostgreSQL backup.
3. Pin the new `FINANCE_VERSION` in the Compose environment.
4. Pull/recreate the image.
5. Run the one-shot `migrate` service exactly once.
6. Start/recreate `web` and wait for its healthcheck.
7. Verify sign-in and a few known financial records.

Keep the PostgreSQL named volume and the same Compose project. Do not use `drizzle-kit push` or delete the database volume as an upgrade step. If an upgrade fails, stop the web service and restore the verified backup before investigating.
