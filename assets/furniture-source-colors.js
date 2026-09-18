(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const norm = value => clean(value).toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, '');
  const unique = values => {
    const out = [];
    const seen = new Set();
    for (const value of values || []) {
      const text = clean(value);
      const key = norm(text);
      if (!text || !key || seen.has(key)) continue;
      seen.add(key);
      out.push(text);
    }
    return out;
  };

  function family(value) {
    let text = clean(value).toLowerCase().replace(/ё/g, 'е');
    text = text.replace(/\b(veluto|велюто|велюр|ткань|экокожа|кожа)\b/giu, ' ');
    text = text.replace(/\b\d{1,3}\b/g, ' ').replace(/[^a-zа-я]+/giu, ' ').replace(/\s+/g, ' ').trim();

    if (text.includes('серо беж')) return 'beige';
    if (text.includes('серо син')) return 'light-blue';
    if (text.includes('темно сер') || text.includes('темный сер')) return 'dark-gray';
    if (text.includes('светло сер') || text.includes('светлый сер')) return 'light-gray';
    if (/\bярко\s+роз/.test(text)) return 'pink';

    const groups = [
      [['беж', 'песоч', 'крем'], 'beige'],
      [['борд', 'винн'], 'burgundy'],
      [['корич', 'шокол'], 'brown'],
      [['лазур', 'азур'], 'azure'],
      [['бирюз'], 'turquoise'],
      [['оранж', 'террак'], 'orange'],
      [['голуб'], 'light-blue'],
      [['син'], 'blue'],
      [['роз', 'фукс'], 'pink'],
      [['сер', 'графит', 'антрац'], 'gray'],
      [['зел', 'изумруд'], 'green'],
      [['мят'], 'mint'],
      [['олив'], 'olive'],
      [['крас'], 'red'],
      [['желт', 'охр', 'горч'], 'yellow'],
      [['фиолет', 'сирен'], 'purple'],
      [['бел', 'айвор', 'молоч'], 'white'],
      [['черн', 'кольт'], 'black'],
      [['капуч', 'тауп'], 'taupe']
    ];
    for (const [needles, key] of groups) {
      if (needles.some(needle => text.includes(needle))) return key;
    }
    return norm(text);
  }

  function matchScore(sourceColor, variantColor) {
    const a = norm(sourceColor);
    const b = norm(variantColor);
    if (a && a === b) return 1000;
    let score = family(sourceColor) === family(variantColor) ? 500 : 0;
    const s = clean(sourceColor).toLowerCase().replace(/ё/g, 'е');
    const v = clean(variantColor).toLowerCase().replace(/ё/g, 'е');
    for (const marker of ['темно', 'светло']) {
      if (s.includes(marker) && v.includes(marker)) score += 120;
      else if (s.includes(marker) !== v.includes(marker)) score -= 90;
    }
    return score;
  }

  function buildColorMap(sourceColors, variantColors) {
    const mapping = new Map();
    const freeSources = new Set(sourceColors);
    const freeVariants = new Set(variantColors);
    const pairs = [];

    for (const variant of variantColors) {
      for (const source of sourceColors) {
        pairs.push({ variant, source, score: matchScore(source, variant) });
      }
    }
    pairs.sort((a, b) => b.score - a.score);

    for (const pair of pairs) {
      if (pair.score < 350 || !freeSources.has(pair.source) || !freeVariants.has(pair.variant)) continue;
      mapping.set(norm(pair.variant), pair.source);
      freeSources.delete(pair.source);
      freeVariants.delete(pair.variant);
    }

    const remainingSources = sourceColors.filter(x => freeSources.has(x));
    const remainingVariants = variantColors.filter(x => freeVariants.has(x));
    if (remainingSources.length === remainingVariants.length) {
      remainingVariants.forEach((variant, index) => mapping.set(norm(variant), remainingSources[index]));
    }
    return mapping;
  }

  function normalizeProduct(product) {
    if (!product || !Array.isArray(product.variants)) return product;
    const variants = product.variants;
    const variantColors = unique(variants.map(v => v?.color));
    const imageKeys = Object.keys(product.colorImages || {}).filter(Boolean);
    if (!imageKeys.length) return product;

    // enrich_furniture_color_images writes the real Berhouse selector labels first.
    // A previous sync may have appended internal aliases afterwards, so keep only
    // the first selector-sized group as the customer-facing source of truth.
    const sourceCount = variantColors.length || imageKeys.length;
    const sourceColors = unique(imageKeys.slice(0, Math.min(sourceCount, imageKeys.length)));
    if (!sourceColors.length) return product;

    const mapping = buildColorMap(sourceColors, variantColors);
    const colorOrder = new Map(sourceColors.map((color, index) => [norm(color), index]));
    const nextVariants = variants.map((variant, index) => {
      const original = clean(variant?.color);
      const mapped = mapping.get(norm(original)) || original;
      return { ...variant, color: mapped, __noktenaOrder: colorOrder.get(norm(mapped)) ?? (sourceColors.length + index) };
    }).sort((a, b) => a.__noktenaOrder - b.__noktenaOrder).map(variant => {
      const { __noktenaOrder, ...rest } = variant;
      return rest;
    });

    return { ...product, colors: sourceColors, variants: nextVariants };
  }

  function normalizeCatalog(data) {
    if (!data || typeof data !== 'object') return data;
    return {
      ...data,
      beds: Array.isArray(data.beds) ? data.beds.map(normalizeProduct) : [],
      sofas: Array.isArray(data.sofas) ? data.sofas.map(normalizeProduct) : []
    };
  }

  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    const target = typeof args[0] === 'string' ? args[0] : String(args[0]?.url || '');
    if (!/data\/furniture\.json(?:[?#]|$)/i.test(target) || !response.ok) return response;
    try {
      const data = normalizeCatalog(await response.clone().json());
      const headers = new Headers(response.headers);
      headers.set('content-type', 'application/json; charset=utf-8');
      return new Response(JSON.stringify(data), {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch (error) {
      console.error('NOKTENA furniture color normalization failed', error);
      return response;
    }
  };
})();
