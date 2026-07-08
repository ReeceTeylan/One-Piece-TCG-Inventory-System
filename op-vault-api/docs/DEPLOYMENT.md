# Deployment Guide

## Prerequisites
- Node.js 20+, PostgreSQL 16, (optional) Docker + Docker Compose.

## A. Docker (fastest)
```bash
cp .env.production.example .env      # fill in real values
docker compose up --build -d
```
Compose starts Postgres, waits for health, runs `prisma db push` (creates tables from the
schema — no migration files needed), seeds the owner/staff/settings, then boots the API.
API: http://localhost:4000/api  ·  Swagger: /api/docs

## B. Manual / VM
```bash
npm ci
npm run prisma:generate
# First deploy — choose ONE:
npm run prisma:migrate -- --name init   # generates a versioned migration (recommended for prod)
#   ...or, for a quick non-versioned setup:
npm run prisma:push                      # pushes schema straight to the DB
npm run prisma:seed
npm run build
node dist/main                           # or use pm2 / systemd
```

## Migrations vs. push
- **`prisma migrate`** creates versioned SQL in `prisma/migrations/` — use this for production
  so schema changes are auditable and repeatable (`prisma migrate deploy` on each release).
  No migration is committed in this repo yet; run `prisma migrate dev --name init` once locally,
  commit the generated folder, and CI/CD can then run `prisma migrate deploy`.
- **`prisma db push`** syncs the schema without migration history — fine for first boot / staging,
  not ideal for a team production flow.

## Reverse proxy
Terminate TLS at nginx/Caddy/ALB and forward to the API port. Ensure `CORS_ORIGIN` and
`PUBLIC_URL` are the HTTPS origins. Serve `/uploads` through the API (already wired) or map the
uploads volume into your CDN.

## Health & ops
- Logs: structured via Nest Logger (stdout) — ship to your log aggregator.
- Rate limiting is on (120 req/min global, 5/min on login).
- Scale horizontally behind the proxy; the app is stateless (JWT + DB + shared uploads volume).
