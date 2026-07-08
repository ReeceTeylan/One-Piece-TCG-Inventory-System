/* ============================================================
   OP-Vault API client — complete data layer for the existing
   HTML prototype. Replaces the in-memory mock arrays/actions
   with real backend calls. The UI/DOM code stays untouched:
   only the data source changes.

   Usage: include this <script> BEFORE the prototype script,
   then swap the mock functions per the mapping in
   frontend-integration/INTEGRATION.md.
   ============================================================ */
const API = (() => {
  const BASE = (window.OP_VAULT_API || 'http://localhost:4000') + '/api';
  let accessToken = sessionStorage.getItem('op_access') || null;
  let refreshToken = localStorage.getItem('op_refresh') || null;

  const setTokens = (a, r) => {
    accessToken = a; refreshToken = r;
    if (a) sessionStorage.setItem('op_access', a);
    if (r) localStorage.setItem('op_refresh', r);
  };
  const clearTokens = () => {
    accessToken = refreshToken = null;
    sessionStorage.removeItem('op_access'); localStorage.removeItem('op_refresh');
  };

  async function refresh() {
    if (!refreshToken) return false;
    try {
      const r = await fetch(BASE + '/auth/refresh', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!r.ok) { clearTokens(); return false; }
      const { data } = await r.json();
      setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch { clearTokens(); return false; }
  }

  // Core JSON request with automatic 401 refresh + retry.
  async function req(path, opts = {}, retry = true) {
    const res = await fetch(BASE + path, {
      ...opts,
      headers: {
        ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(opts.headers || {}),
      },
    });
    if (res.status === 401 && retry && (await refresh())) return req(path, opts, false);
    if (res.status === 204) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      if (!res.ok) throw Object.assign(new Error('Request failed'), { status: res.status });
      return res; // binary (PDF/PNG) — caller handles blob
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(body.message || 'Request failed'), { status: res.status, body });
    // Paginated responses are { data, meta }; wrapped responses are { success, data }.
    if (body && body.meta && body.data !== undefined) return body;      // keep {data, meta}
    return body.data !== undefined ? body.data : body;                  // unwrap
  }

  const qs = (o = {}) => {
    const p = new URLSearchParams();
    Object.entries(o).forEach(([k, v]) => v !== undefined && v !== '' && v !== null && p.append(k, v));
    const s = p.toString(); return s ? `?${s}` : '';
  };
  const jbody = (o) => JSON.stringify(o);

  return {
    // ---------- auth ----------
    async login(email, password) {
      const d = await req('/auth/login', { method: 'POST', body: jbody({ email, password }) });
      setTokens(d.accessToken, d.refreshToken); return d.user;
    },
    async logout() { try { await req('/auth/logout', { method: 'POST' }); } finally { clearTokens(); } },
    me: () => req('/auth/me'),
    isAuthed: () => !!accessToken,

    // ---------- raw cards ----------
    rawCards: (q) => req('/raw-cards' + qs(q)),                                   // {data, meta}
    rawCard: (id) => req('/raw-cards/' + id),
    createRawCard: (dto) => req('/raw-cards', { method: 'POST', body: jbody(dto) }), // 409 CARD_EXISTS
    addRawQuantity: (id, quantity) => req(`/raw-cards/${id}/add-quantity`, { method: 'POST', body: jbody({ quantity }) }),
    restockRaw: (id, dto) => req(`/raw-cards/${id}/restock`, { method: 'POST', body: jbody(dto) }),
    updateRawCard: (id, dto) => req(`/raw-cards/${id}`, { method: 'PATCH', body: jbody(dto) }),
    deleteRawCard: (id) => req(`/raw-cards/${id}`, { method: 'DELETE' }),

    // ---------- slabs ----------
    slabs: (q) => req('/slabs' + qs(q)),
    createSlab: (dto) => req('/slabs', { method: 'POST', body: jbody(dto) }),        // 409 SLAB_EXISTS
    updateSlab: (id, dto) => req(`/slabs/${id}`, { method: 'PATCH', body: jbody(dto) }),
    deleteSlab: (id) => req(`/slabs/${id}`, { method: 'DELETE' }),

    // ---------- customers ----------
    customers: (q) => req('/customers' + qs(q)),
    customer: (id) => req('/customers/' + id),
    createCustomer: (dto) => req('/customers', { method: 'POST', body: jbody(dto) }),
    updateCustomer: (id, dto) => req(`/customers/${id}`, { method: 'PATCH', body: jbody(dto) }),
    deleteCustomer: (id) => req(`/customers/${id}`, { method: 'DELETE' }),
    customerPurchases: (id) => req(`/customers/${id}/purchases`),
    customerStats: (id) => req(`/customers/${id}/statistics`),

    // ---------- sales ----------
    sales: (q) => req('/sales' + qs(q)),
    sale: (id) => req('/sales/' + id),
    completeSale: (dto) => req('/sales', { method: 'POST', body: jbody(dto) }),
    cancelSale: (id, reason) => req(`/sales/${id}/cancel`, { method: 'POST', body: jbody({ reason }) }),
    refundSale: (id, reason) => req(`/sales/${id}/refund`, { method: 'POST', body: jbody({ reason }) }),
    undoSale: (id) => req(`/sales/${id}/undo`, { method: 'POST' }),

    // ---------- payments ----------
    payments: (saleId) => req(`/sales/${saleId}/payments`),
    addPayment: (saleId, dto) => req(`/sales/${saleId}/payments`, { method: 'POST', body: jbody(dto) }),

    // ---------- shipments ----------
    shipments: (q) => req('/shipments' + qs(q)),
    shipment: (id) => req('/shipments/' + id),
    shipmentTimeline: (id) => req(`/shipments/${id}/timeline`),
    updateShipment: (id, dto) => req(`/shipments/${id}`, { method: 'PATCH', body: jbody(dto) }),

    // ---------- analytics (replaces SERIES + dashboard mock stats) ----------
    dashboard: () => req('/analytics/dashboard'),
    trends: (q) => req('/analytics/trends' + qs(q)),          // [{date, revenue, profit, cardsSold, orders}]
    analyticsInventory: () => req('/analytics/inventory'),
    analyticsCards: (q) => req('/analytics/cards' + qs(q)),
    analyticsSlabs: () => req('/analytics/slabs'),
    analyticsCustomers: (q) => req('/analytics/customers' + qs(q)),

    // ---------- notifications ----------
    notifications: (q) => req('/notifications' + qs(q)),
    unreadCount: () => req('/notifications/unread-count'),
    markRead: (id) => req(`/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () => req('/notifications/read-all', { method: 'PATCH' }),
    dismissNotification: (id) => req(`/notifications/${id}`, { method: 'DELETE' }),

    // ---------- settings ----------
    settings: () => req('/settings'),
    updateSettings: (dto) => req('/settings', { method: 'PATCH', body: jbody(dto) }),

    // ---------- favorites ----------
    favorites: () => req('/favorites'),
    pinnedCards: () => req('/favorites/pinned'),
    toggleFavorite: (itemType, itemId) => req('/favorites/toggle', { method: 'POST', body: jbody({ itemType, itemId }) }),
    pinCard: (itemType, itemId, pinned = true) => req('/favorites/pin', { method: 'POST', body: jbody({ itemType, itemId, pinned }) }),

    // ---------- images ----------
    uploadImage: (file, itemType, itemId) => {
      const fd = new FormData();
      fd.append('file', file); fd.append('itemType', itemType); fd.append('itemId', itemId);
      return req('/images', { method: 'POST', body: fd });
    },
    deleteImage: (id) => req(`/images/${id}`, { method: 'DELETE' }),

    // ---------- reports & FB generator (binary → triggers download) ----------
    async downloadReport(type) {
      const res = await req(`/reports/${type}/pdf`);
      const blob = await res.blob(); triggerDownload(blob, `${type}-report.pdf`);
    },
    async generateFacebookPost(opts) {
      const res = await req('/facebook/generate', { method: 'POST', body: jbody(opts) });
      const blob = await res.blob(); triggerDownload(blob, 'op-vault-post.png'); return blob;
    },
  };

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    a.remove(); URL.revokeObjectURL(url);
  }
})();
window.API = API;
