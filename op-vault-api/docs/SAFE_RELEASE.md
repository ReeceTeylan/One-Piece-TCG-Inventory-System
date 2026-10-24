# Safer OP Vault releases

The live Render service builds from `main` using a command that calls `npx prisma db push`, which can modify the production database **before the backend starts**.

**Do not merge the inventory schema migration PR until:**
- a successful, encrypted production database backup exists;
- the backup has been restored into staging and the complete inventory/sales counts agree;
- Render's build command is switched from `prisma db push && prisma db seed` to a reviewed migration deployment (`prisma migrate deploy`) with explicit validation;
- the release is tested against a copy of the production database.

The older GitHub Action `.github/workflows/db-backup.yml` requires `SUPABASE_DB_URL`. Its recent runs failed because that secret was missing. A separate encrypted storage-based backup workflow has also been added, but still needs secrets. Until backup is configured, neither is a validated recovery mechanism.

This release protects owner-editable store Settings and disables predictable demo-user creation by the seed script. Production users should rotate passwords for any seeded `owner@opvault.ph` or `staff@opvault.ph` accounts immediately if they still exist. This change does **not** delete existing accounts.

The Render /api/health/db URL is a public readiness-only probe returning up/down, not private database content.
