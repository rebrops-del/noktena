(() => {
  'use strict';

  const cfg = window.NOKTENA_ADMIN_CONFIG || {};
  const configured = () => Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
  const CACHE_KEY = 'noktena-catalog-overrides-v2';
  const MAX_INITIAL_WAIT_MS = 900;
  let rowsPromise = null;

  const headers = () => ({
  apikey: cfg.supabaseAnonKey,
  Accept: 'application/json'
});

  const productKey = (kind, product) => kind === 'furniture'
    ? `furniture:${product?.id || ''}`
    : `mattress:${product?.model || ''}`;

  function readCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      return Array.isArray(parsed?.rows) ? parsed.rows : [];
    } catch (_) {
      return [];
    }
  }

  function writeCache(rows) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ rows, savedAt: Date.now() }));
    } catch (_) {}
  }

  async function fetchRows() {
    if (!configured()) return [];
    if (!rowsPromise) {
      const cached = readCache();
      const url = `${cfg.supabaseUrl.replace(/\/$/, '')}/rest/v1/catalog_overrides?select=product_key,kind,payload,hidden,is_custom,updated_at`;

      const network = fetch(url, { headers: headers(), cache: 'no-store' })
        .then(async r => {
          if (!r.ok) throw new Error(`Supabase catalog HTTP ${r.status}`);
          const rows = await r.json();
          writeCache(rows);
          return rows;
        })
        .catch(err => {
          console.warn('NOKTENA catalog overrides unavailable; using cached/base catalog.', err);
          return cached;
        });

      // If we already have previous overrides, render immediately and refresh them in background.
      if (cached.length) {
        network.catch(() => {});
        rowsPromise = Promise.resolve(cached);
      } else {
        // First visit: never let a slow/cold backend hold the public catalog for several seconds.
        rowsPromise = Promise.race([
          network,
          new Promise(resolve => setTimeout(() => resolve([]), MAX_INITIAL_WAIT_MS))
        ]);
      }
    }
    return rowsPromise;
  }

  function applyRows(baseItems, kind, rows) {
    const relevant = rows.filter(r => r.kind === kind);
    const byKey = new Map(relevant.filter(r => !r.is_custom).map(r => [r.product_key, r]));
    const merged = [];

    for (const base of baseItems || []) {
      const row = byKey.get(productKey(kind, base));
      if (row?.hidden) continue;
      merged.push(row ? { ...base, ...(row.payload || {}) } : base);
    }

    for (const row of relevant.filter(r => r.is_custom && !r.hidden)) {
      if (row.payload && typeof row.payload === 'object') merged.push({ ...row.payload });
    }
    return merged;
  }

  async function mergeFurniture(data) {
    const rows = await fetchRows();
    const base = [...(data?.beds || []), ...(data?.sofas || [])];
    const items = applyRows(base, 'furniture', rows);
    return {
      ...data,
      beds: items.filter(p => p.category === 'beds'),
      sofas: items.filter(p => p.category === 'sofas')
    };
  }

  async function mergeMattresses(items) {
    const rows = await fetchRows();
    return applyRows(items || [], 'mattress', rows);
  }

  function resetCache() {
    rowsPromise = null;
    try { localStorage.removeItem(CACHE_KEY); } catch (_) {}
  }

  window.NoktenaCatalog = Object.freeze({
    configured,
    productKey,
    mergeFurniture,
    mergeMattresses,
    resetCache
  });
})();
