# OP-Vault Web (frontend)

React + Vite + TypeScript + Tailwind + TanStack Query + Recharts frontend for the
OP-Vault One Piece TCG backend.

## Run
```bash
npm install
cp .env.example .env      # VITE_API_URL=/api (uses the Vite dev proxy)
npm run dev               # http://localhost:5173
```
The backend must be running on http://localhost:4000. The Vite dev server proxies
`/api` to it (see vite.config.ts), so no CORS setup is needed in development.

Login with the seeded owner account: owner@opvault.ph / Owner@123

## Implemented in this delivery
- Full scaffolding, API layer (axios + token refresh), auth (persistent + protected routes + role nav)
- App shell: collapsible sidebar, topbar, global search, notifications & profile dropdowns, breadcrumbs
- UI kit (button/card/input/table/dialog/dropdown/badge/skeleton/switch/slider/etc.)
- All typed services for every backend module
- Pages fully built: **Login**, **Dashboard** (real analytics + line chart w/ hover tooltip),
  **Raw Cards** (CRUD, duplicate detection, restock, filters, sorting, pagination)

## Continue (next pass)
Slabs, Customers, Sales (4-step), Payments, Shipments, Analytics, Reports, Settings,
Favorites, Notifications, Activity Logs, Facebook Post Generator.
