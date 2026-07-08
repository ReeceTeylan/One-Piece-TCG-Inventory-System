# Database, Migration, Backup & Restore

## Schema
18 models (see `prisma/schema.prisma`). Key integrity rules:
- `raw_cards` unique `(cardNumber, setName, rarity)` — duplicate detection.
- `slab_cards.slabNumber` unique — certification numbers can't collide.
- `sale_items` snapshot `unitCost`/`lineProfit` so historical profit is immutable.
- Cascade deletes: SaleItem/Shipment/Payment on Sale; ShipmentItem/ShipmentEvent on Shipment;
  CardImage/Favorite on their card. Reversal (cancel/refund/undo) is transactional.
- Indexes on hot paths: status, quantity, rarity, createdAt, customerId, saleId, shipment status.

## Migrations
```bash
# create a new migration after editing schema.prisma
npx prisma migrate dev --name <change>
# apply in production
npx prisma migrate deploy
```

## Backup strategy
- **Automated daily** logical dump + retention:
  ```bash
  pg_dump "$DATABASE_URL" -Fc -f /backups/opvault_$(date +%F_%H%M).dump
  find /backups -name 'opvault_*.dump' -mtime +30 -delete   # 30-day retention
  ```
  Schedule via cron (`0 2 * * *`) or a managed-DB automated-backup feature.
- **Uploads**: back up the `UPLOAD_DIR` volume alongside the DB (rsync/object-store sync)
  so images and rows stay consistent.
- Store backups off-host (S3/GCS) and test them (see restore).

## Restore strategy
```bash
# 1. stop the API
# 2. recreate/point at a clean database, then:
pg_restore --clean --if-exists -d "$DATABASE_URL" /backups/opvault_YYYY-MM-DD_HHMM.dump
# 3. restore the uploads directory from its backup
# 4. start the API; verify: login, GET /api/analytics/dashboard, open an image URL
```
Practice a restore into a scratch DB quarterly — an untested backup is not a backup.
