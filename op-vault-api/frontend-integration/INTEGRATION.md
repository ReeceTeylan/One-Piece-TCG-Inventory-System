# Frontend Integration Guide

The frontend stays the existing `op-vault-prototype.html`. You only swap the
**data layer**: replace the in-memory mock arrays and the functions that mutate
them with `API.*` calls from `api-client.js`. No UI/DOM/markup changes.

## Setup
1. Copy `api-client.js` next to the prototype.
2. Add before the prototype's `<script>`:
   ```html
   <script>window.OP_VAULT_API = 'http://localhost:4000';</script>
   <script src="api-client.js"></script>
   ```
3. Ensure the backend `CORS_ORIGIN` matches where you serve the HTML.

## Exact swaps (mock → real)

| Prototype mock | Replace with |
|---|---|
| `doLogin()` fake gate | `await API.login(email, password)` → then `renderNav(); render()` |
| `rawCards[]` array | `const { data } = await API.rawCards({ search, status, rarity, sortBy, sortOrder, page })` in `rawTable()` |
| `saveRaw()` duplicate check | `await API.createRawCard(dto)`; on `err.body.code === 'CARD_EXISTS'` show the existing dialog, then `API.addRawQuantity(err.body.cardId, qty)` |
| `restockCard()`/`doRestock()` | `API.restockRaw(id, { quantityAdded, buyCost, datePurchased })` |
| `slabs[]` + `saveSlab()` | `API.slabs(q)` / `API.createSlab(dto)` (handle `SLAB_EXISTS`) |
| `customers[]` + `checkExisting()` | `API.customers({ search })` / `API.customer(id)`; new customer via sale payload or `API.createCustomer` |
| `completeSale()` in-memory mutation | `API.completeSale({ customerId|customer, items:[{itemType,rawCardId|slabId,quantity,unitPrice}], discount, shippingFee, courier, amountPaid, paymentMethod })` |
| `sales[]` (history) | `API.sales({ range, status, search, page })` |
| `shipments[]` + `advanceShip()` | `API.shipments({ status })` / `API.updateShipment(id, { status, trackingNumber })` |
| `SERIES` dummy chart data | `API.trends({ granularity, points })` → feed `lineChart()`; the tooltip fields map 1:1 (date/revenue/profit/cardsSold/quantity→cardsSold) |
| dashboard stat cards | `API.dashboard()` (revenue/profit/orders by range + growth + inventory) |
| analytics page | `API.analyticsInventory()`, `API.analyticsCards()`, `API.analyticsSlabs()` |
| notifications bell | `API.notifications()`, `API.unreadCount()`, `API.markRead()`, `API.markAllRead()` |
| settings form | `API.settings()` to load, `API.updateSettings(dto)` to save |
| favorites/pins | `API.toggleFavorite(itemType,id)`, `API.pinCard(itemType,id,pinned)` |
| image upload placeholder | `API.uploadImage(fileInput.files[0], itemType, itemId)` → use returned `url`/`thumbnailUrl` |
| “Export PNG” button | `API.generateFacebookPost({ theme, showLogo, count })` (auto-downloads) |
| “Generate report” tiles | `API.downloadReport('inventory'|'sales'|'profit'|'shipping'|'customer'|'card-performance')` |

## Notes
- All list endpoints return `{ data, meta }` (meta = total/page/limit/totalPages) for pagination.
- Mutations return the created/updated entity; errors throw with `err.status` and `err.body.code`.
- Because the prototype re-renders from module-scoped arrays, the lightest migration is:
  keep the arrays as a cache, and on each page load call the matching `API.*`, assign the
  result into the array, then call the existing `render()`/`*Table()` function unchanged.
