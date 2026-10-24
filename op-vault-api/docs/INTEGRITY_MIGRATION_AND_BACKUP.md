# OP Vault release, backup and monitoring checklist

The schema migration that introduces printing variants, idempotent receipts, the English catalog, and sale-reference sequences **must be deployed before** releasing the new backend code. Do not merge the integrity PR until this is verified.

## Before a production migration
1. Create a timestamped PostgreSQL backup using the database provider's backup UI or a trusted workstation with PostgreSQL CLI installed. Use the **direct** database URL, not a pooled transaction URL.
2. Example in PowerShell (do not paste credentials into chat, command history, or logs):

```powershell
$env:PGPASSWORD = "<retrieve directly from your secure database manager>"
pg_dump --host <host> --username <user> --dbname <database> --format=custom --no-owner --no-acl --file="op-vault-before-migration.dump"
Remove-Item Env:PGPASSWORD
```

Alternatively configure a protected PostgreSQL service connection to avoid passwords in commands. Store the dump encrypted and separately from the production service.

3. Restore that dump to a **staging** database and confirm counts of `raw_cards`, `sales`, `sale_items`, and `inventory_logs`.
4. Run `npx prisma migrate deploy` in `op-vault-api` against staging. Check:
   - two source listings with one card number/set/rarity can exist as different variants
   - regular +Quantity and Quick Add change counts exactly once
   - retrying the same Quick Add requestId does not change quantity
   - two concurrent restocks never lose quantity
   - new sale references remain unique after an undo
   - old inventory, costs, and sales history remain intact
5. Schedule a short maintenance window. Back up production again, apply the reviewed migration, verify the tables/indexes, THEN release the compatible API. Have rollback and restore credentials available.
6. Keep backup retention based on your business needs; test a restore regularly.

## Monitoring
`.github/workflows/op-vault-uptime.yml` checks the Vercel frontend hourly. To enable API/database monitoring, create a repository Actions **variable** named `OP_VAULT_API_HEALTH_URL` containing your deployment's HTTPS `/api/health/db` address. Avoid including passwords or credentials in the URL. GitHub workflow failures can send notification emails depending on your notification settings.

Also consider database provider metrics/alerts for storage usage, failed connections, and backup age; the basic HTTP probe does not measure those. Treat third-party market-source changes as separate observability work.

## Dependency security
Dependabot prepares dependency update PRs weekly. CI must pass before merging; do not automatically apply breaking updates. The baseline Node install currently reports security advisories. Use `npm audit --omit=dev` separately in each application, review severity and execution reachability, and prioritize fixes for reachable server dependencies.

## Feature deployment constraints
- The English catalog import script is available, but the database is empty until a reviewed English JSON file is imported; it does not autonomously scrape official databases.
- Uptime monitoring does not include an API endpoint until `OP_VAULT_API_HEALTH_URL` is configured.
- Item-level Quick Add receipts prevent repeated submissions with the same requestId; older clients without an ID still use the legacy non-idempotent route.

## Optional scheduled encrypted backups

The GitHub Action `.github/workflows/op-vault-db-backup.yml` is configured for a daily UTC run, but is **not active** until all of the following repository secrets are set:

- `OP_VAULT_BACKUP_DATABASE_URL`: direct PostgreSQL URL for a backup-only DB role
- `OP_VAULT_BACKUP_S3_BUCKET`: bucket name for a private, restricted backup bucket
- `OP_VAULT_BACKUP_PASSPHRASE`: independently stored strong encryption passphrase
- `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`: least-privilege upload credentials

Optional GitHub repository variables: `OP_VAULT_BACKUP_AWS_REGION` (for AWS S3), `OP_VAULT_BACKUP_S3_ENDPOINT` (for compatible storage).
Ensure the GitHub runner has a compatible PostgreSQL client and AWS CLI version. Set a bucket retention policy and monitor workflow failures. Test one encrypted backup by downloading it securely, decrypting with the separately stored passphrase and restoring into a disposable staging database. Do not treat upload success as proof that a restore will work.
