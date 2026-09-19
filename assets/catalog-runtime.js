(() => {
  'use strict';

  const cfg = window.NOKTENA_ADMIN_CONFIG || {};
  const configured = () => Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
  let rowsPromise = null;

  const headers = () => ({
    apikey: cfg.supabaseAnonKey,
    Authorization: `Bearer ${cfg.supabaseAnonKey}`,
    Accept: 'application/json'
  });

  const productKey = (kind, product) => kind === 'furniture'
    ? `furniture:${product?.id || ''}`
    : `mattress:${product?.model || ''}`;

  async function fetchRows() {
    if (!configured()) return [];
    if (!rowsPromise) {
      const url = `${cfg.supabaseUrl.replace(/\/$/, '')}/rest/v1/catalog_overrides?select=product_key,kind,payload,hidden,is_custom,updated_at`;
      rowsPromise = fetch(url, { headers: headers(), cache: 'no-store' })
        .then(async r => {
          if (!r.ok) throw new Error(`Supabase catalog HTTP ${r.status}`);
          return r.json();
        })
        .catch(err => {
          console.warn('NOKTENA catalog overrides unavailable; using base catalog.', err);
          rowsPromise = null;
          return [];
        });
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
  }

  window.NoktenaCatalog = Object.freeze({
    configured,
    productKey,
    mergeFurniture,
    mergeMattresses,
    resetCache
  });
})();
