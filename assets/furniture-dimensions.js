(() => {
  'use strict';

  const key = value => String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, '');
  const pair = value => {
    const numbers = String(value || '').match(/\d+/g)?.map(Number) || [];
    return numbers.length >= 2 ? numbers.slice(0, 2) : null;
  };
  const first = value => {
    const found = String(value || '').match(/\d+/);
    return found ? Number(found[0]) : null;
  };
  const entry = (object, label) => Object.entries(object || {}).find(([name]) => key(name) === key(label));
  const formatted = value => `${Math.round(value)} мм`;

  function dimension(product, variant, size, label) {
    const dimensionKey = key(label);
    if (dimensionKey !== 'ширина' && dimensionKey !== 'глубина') return '';
    const chosenSize = String(size || variant?.size || '').trim();
    const mapName = dimensionKey === 'ширина' ? 'widthBySize' : 'depthBySize';
    const overrideName = dimensionKey === 'ширина' ? 'widthOverride' : 'depthOverride';
    const manual = Number(product?.[mapName]?.[chosenSize] ?? variant?.[overrideName]);
    if (Number.isFinite(manual) && manual > 0) return formatted(manual);

    const attributes = variant?.attributes || {};
    const attribute = entry(attributes, label);
    if (attribute?.[1]) return String(attribute[1]);

    const original = entry(product?.specs, label)?.[1];
    if (!original) return '';
    if (product?.category !== 'beds' || !chosenSize) return String(original || '');
    const selected = pair(chosenSize || entry(attributes, 'Спальное место')?.[1]);
    const baseline = pair(entry(product?.specs, 'Спальное место')?.[1]);
    const frame = first(original);
    if (!selected) return String(original || '');
    const index = dimensionKey === 'ширина' ? 0 : 1;
    if (!baseline || !Number.isFinite(frame) || frame < baseline[index]) return formatted(selected[index]);
    return formatted(Math.max(0, frame + selected[index] - baseline[index]));
  }

  const api = Object.freeze({ key, entry, dimension });
  if (typeof window !== 'undefined') window.NoktenaFurnitureDimensions = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
