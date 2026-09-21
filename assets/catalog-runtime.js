(() => {
  'use strict';

  const cfg = window.NOKTENA_ADMIN_CONFIG || {};
  const configured = () => Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
  const CACHE_KEY = 'noktena-catalog-overrides-v3';
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

  function resolveCatalogImageTokens(rows, assets) {
    const assetMap = new Map((assets || []).map(row => [`asset:${row.id}`, row.data_url]));
    const resolveOne = value => {
      const key = String(value || '');
      return assetMap.get(key) || value;
    };
    return (rows || []).map(row => {
      if (!row?.payload || typeof row.payload !== 'object') return row;
      const payload = { ...row.payload };
      if (Array.isArray(payload.images)) payload.images = payload.images.map(resolveOne);
      if (payload.colorImages && typeof payload.colorImages === 'object') {
        payload.colorImages = Object.fromEntries(Object.entries(payload.colorImages).map(([color, value]) => [color, resolveOne(value)]));
      }
      return { ...row, payload };
    });
  }

  async function fetchRows() {
    const bootstrap = window.NOKTENA_CATALOG_BOOTSTRAP;
    if (Array.isArray(bootstrap?.rows)) {
      if (!rowsPromise) {
        const resolvedRows = resolveCatalogImageTokens(bootstrap.rows, Array.isArray(bootstrap.assets) ? bootstrap.assets : []);
        writeCache(resolvedRows);
        rowsPromise = Promise.resolve(resolvedRows);
      }
      return rowsPromise;
    }
    if (!configured()) return [];
    if (!rowsPromise) {
      const cached = readCache();
      const root = cfg.supabaseUrl.replace(/\/$/, '');
      const overridesUrl = `${root}/rest/v1/catalog_overrides?select=product_key,kind,payload,hidden,is_custom,updated_at`;
      const imagesUrl = `${root}/rest/v1/catalog_images?select=id,data_url`;

      const network = Promise.all([
        fetch(overridesUrl, { headers: headers(), cache: 'no-store' }),
        fetch(imagesUrl, { headers: headers(), cache: 'no-store' })
      ])
        .then(async ([overrideResponse, imageResponse]) => {
          if (!overrideResponse.ok) throw new Error(`Supabase catalog HTTP ${overrideResponse.status}`);
          if (!imageResponse.ok) throw new Error(`Supabase images HTTP ${imageResponse.status}`);
          const [rows, assets] = await Promise.all([overrideResponse.json(), imageResponse.json()]);
          const resolvedRows = resolveCatalogImageTokens(rows, assets);
          writeCache(resolvedRows);
          return resolvedRows;
        })
        .catch(err => {
          console.warn('NOKTENA catalog overrides unavailable; using cached/base catalog.', err);
          return cached;
        });

      if (cached.length) {
        network.catch(() => {});
        rowsPromise = Promise.resolve(cached);
      } else {
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
