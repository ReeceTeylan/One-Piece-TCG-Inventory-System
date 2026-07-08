# OP-Vault API — Backend (NestJS + Prisma + PostgreSQL)

Production backend for the OP-Vault One Piece TCG system. Converts the prototype's
in-memory data into a real, persistent, authenticated API.

## Quick start

```bash
# 1. Install deps
npm install

# 2. Configure env (edit secrets!)
cp .env.example .env

# 3. Start Postgres (Docker) OR point DATABASE_URL at your own
docker compose up -d db

# 4. Generate client, run migrations, seed
npm run prisma:generate
npm run prisma:migrate      # creates tables + indexes + FKs
npm run prisma:seed         # owner/staff users, settings, demo cards

# 5. Run
npm run start:dev
# API:  http://localhost:4000/api
# Docs: http://localhost:4000/api/docs   (Swagger)
```

Seeded logins: `owner@opvault.ph / Owner@123`  ·  `staff@opvault.ph / Staff@123`

Full stack in one command: `docker compose up --build`

## Implemented in this delivery (runnable)

- **Scaffolding**: package.json, tsconfig, nest-cli, Docker, docker-compose, .env
- **Prisma schema**: all 16 models, enums, indexes, FKs, unique constraints, migrations-ready
- **Config + bootstrap**: ConfigModule, Swagger, Helmet, global ValidationPipe,
  CORS w/ credentials, global exception filter, logging + transform interceptors
- **Prisma module/service** (global)
- **Cross-cutting**: `@Public` `@Roles` `@CurrentUser`, JwtAuthGuard, RolesGuard,
  AllExceptionsFilter (maps Prisma P2002/P2025), Throttler rate limiting, PaginationDto
- **Auth module**: login, refresh (rotating, hashed refresh token in DB), logout, `me`,
  JWT strategy, bcrypt, brute-force throttle on login
- **Users module**: owner-only create/list, password + refresh-token sanitisation
- **Raw-cards module** (repository pattern): CRUD, **duplicate detection → 409 CARD_EXISTS**,
  add-quantity, restock (+RestockLog +InventoryLog), price-history tracking,
  status auto-compute, search/filter/sort/paginate, owner-only delete
- **Slabs module**: CRUD, **unique cert → 409 SLAB_EXISTS**, immutable slabNumber,
  search/filter(grade,company)/sort/paginate, owner-only delete

## API surface (live now)

```
POST   /api/auth/login            {email,password} -> {accessToken,refreshToken,user}
POST   /api/auth/refresh          {refreshToken}
POST   /api/auth/logout           (bearer)
GET    /api/auth/me               (bearer)
GET    /api/users                 (owner)
POST   /api/users                 (owner)
GET    /api/raw-cards             ?page&limit&search&status&rarity&sortBy&sortOrder
POST   /api/raw-cards             -> 409 {code:CARD_EXISTS,cardId,currentQuantity} on dup
GET    /api/raw-cards/:id
PATCH  /api/raw-cards/:id
POST   /api/raw-cards/:id/add-quantity   {quantity}   (confirm dialog path)
POST   /api/raw-cards/:id/restock        {quantityAdded,buyCost,datePurchased?}
DELETE /api/raw-cards/:id         (owner)
GET    /api/slabs                 ?page&limit&search&status&grade&gradingCompany&sortBy&sortOrder
POST   /api/slabs                 -> 409 {code:SLAB_EXISTS} on dup cert
GET    /api/slabs/:id  · PATCH /api/slabs/:id · DELETE /api/slabs/:id (owner)
```

=== CONTINUE FROM HERE ===

## Session 2 — Core business logic (DONE)

New tables (additive migration required): **Payment**, **ShipmentEvent**, plus
`Sale.payments`, `Sale.refundedAt`, `Shipment.events`, `PaymentMethod` enum.
Run: `npm run prisma:migrate` (creates `payments`, `shipment_events`).

Modules completed this session:
- **activity-logs** (global, transaction-aware audit; owner-only list)
- **customers** (CRUD, duplicate detection, search, pagination, purchase history, statistics)
- **shipments** (list/get, guarded status transitions, timeline events, tracking, courier)
- **payments** (add payment, history, remaining balance, sale-status re-derivation)
- **sales** — the heart:
  - `POST /sales` completeSale in ONE Serializable transaction: validate customer,
    stock, slab availability & prices → compute subtotal/discount/shipping/total/profit
    → create Sale + SaleItems → deduct raw qty / mark slab SOLD → create Shipment +
    ShipmentItems + opening ShipmentEvent → initial Payment → InventoryLogs →
    Notification → ActivityLog. Any failure rolls back everything.
  - `POST /sales/:id/cancel` — restore inventory, cancel shipment, mark CANCELLED
  - `POST /sales/:id/refund` (owner) — restore inventory, mark REFUNDED
  - `POST /sales/:id/undo` (owner) — restore inventory, hard-delete (cascade)

New endpoints:
```
GET  /customers ?page&limit&search&sortBy&sortOrder
POST /customers            (409 CUSTOMER_EXISTS on name+contact dup)
GET  /customers/:id  ·  PATCH /customers/:id  ·  DELETE /customers/:id (owner)
GET  /customers/:id/purchases       (full purchase history)
GET  /customers/:id/statistics      (spend, orders, profit, last purchase)
POST /sales                         (atomic checkout)
GET  /sales ?range=today|week|month|year&status&customerId&search
GET  /sales/:id
POST /sales/:id/cancel  ·  /refund (owner)  ·  /undo (owner)
GET  /sales/:id/payments  ·  POST /sales/:id/payments   (additional payment)
GET  /shipments ?status&courier&search  ·  GET /shipments/:id  ·  /:id/timeline
PATCH /shipments/:id                (status/tracking/courier + timeline event)
GET  /activity-logs ?action&entityType&userId   (owner)
```

Tests added: `sales.service.spec.ts` (totals/profit/stock-rollback/slab-sold),
`payments.service.spec.ts` (status derivation + overpayment), `customers.service.spec.ts`
(duplicate detection), `test/app.e2e-spec.ts` (auth + dup + auth-guard). Run `npm test`.

## Session 3 — remaining modules complete + hardening (DONE)

Dependencies added: `@nestjs/serve-static`, `pdfkit`, `@types/pdfkit`, `@types/multer`
(removed unused `pdfmake`). Static uploads served at `/uploads`.

Modules completed:
- **settings** (@Global) — get all (defaults backfilled), owner-only patch; used by analytics/reports/fb
- **notifications** (@Global) — list/unread-count/mark-read/mark-all/dismiss; auto-emit on
  completed sale, low/out stock (inside sale tx), shipment delivered, new customer, failed login
- **favorites** — per-user toggle, global pin (dashboard), list, pinned
- **analytics** — real SQL aggregates (Prisma + $queryRaw): dashboard (revenue/profit/orders
  by today/week/month/year + growth %), trends (date_trunc daily/monthly/yearly), inventory
  (value/avg cost/avg price/margin/low/dead), cards (best sellers, most valuable, highest
  profit, top rarities, fastest/slowest, dead/low), slabs, top customers
- **reports** — 6 production PDFs via pdfkit: inventory, sales, profit, shipping, customer,
  card-performance (streamed as application/pdf)
- **images** — Multer(memory) + Sharp 1:1 (1000²) + 300² thumbnail, webp compression,
  5MB + mime validation, StorageProvider abstraction (LocalStorageProvider now; swap S3/
  Cloudinary via DI token), delete removes files + row
- **facebook-generator** — server-side 5×4 square-card PNG via SVG→Sharp, light/dark, logo,
  high-res, automatic spacing

New endpoints:
```
GET   /analytics/dashboard | /trends | /inventory | /cards | /slabs | /customers
GET   /reports/{inventory|sales|profit|shipping|customer|card-performance}/pdf
GET   /settings            PATCH /settings (owner)
GET   /notifications ?type&isRead   GET /notifications/unread-count
PATCH /notifications/read-all | /:id/read    DELETE /notifications/:id
GET   /favorites | /favorites/pinned   POST /favorites/toggle | /favorites/pin
POST  /images (multipart)   DELETE /images/:id
POST  /facebook/generate    (returns image/png)
GET   /uploads/*            (static)
```

Hardening/fixes: removed unused `SaleStatus` import in sales.service; added notification
dependency + updated `customers.service.spec`; low-stock notification emitted inside the
sale transaction. Tests added: analytics, notifications unit specs; e2e authz (STAFF 403 on
settings) + analytics read + sale insufficient-stock rollback (no-persist) assertions.

**ALL 13 feature modules implemented.** Backend feature-complete.
