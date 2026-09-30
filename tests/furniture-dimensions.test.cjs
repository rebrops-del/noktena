const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dimensions = require('../assets/furniture-dimensions.js');

const furniture = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/furniture.json'), 'utf8'));
const pair = size => String(size).match(/\d+/g)?.slice(0, 2).map(Number);

test('both children’s beds offer all three sizes and describe the range', () => {
  for (const id of ['berhouse-24139', 'berhouse-24140']) {
    const bed = furniture.beds.find(product => product.id === id);
    assert.ok(bed, id);
    assert.deepEqual(bed.sizes.map(pair), [[800, 1600], [800, 1900], [900, 1900]]);
    assert.equal(new Set(bed.variants.map(variant => variant.size)).size, 3);
    assert.match(bed.description, /800×1600, 800×1900 и 900×1900 мм/);
    assert.doesNotMatch(`${bed.summary} ${bed.description}`, /единственном размере|1 размер/i);
    const wide = bed.variants.find(variant => pair(variant.size)?.[0] === 900);
    assert.equal(dimensions.dimension(bed, wide, wide.size, 'Ширина'), '900 мм');
    assert.equal(dimensions.dimension(bed, wide, wide.size, 'Глубина'), '1900 мм');
  }
});

test('bed dimensions change with the selected size across the catalog', () => {
  for (const bed of furniture.beds.filter(product => product.sizes?.length > 1)) {
    const baseline = pair(bed.specs?.['Спальное место']);
    if (!baseline) continue;
    const variants = bed.sizes.map(size => bed.variants.find(variant => variant.size === size)).filter(Boolean);
    for (const [label, index] of [['Ширина', 0], ['Глубина', 1]]) {
      if (!bed.specs?.[label]) continue;
      for (const first of variants) for (const second of variants) {
        if (pair(first.size)[index] === pair(second.size)[index]) continue;
        assert.notEqual(dimensions.dimension(bed, first, first.size, label), dimensions.dimension(bed, second, second.size, label), `${bed.id}: ${label} ${first.size} / ${second.size}`);
      }
    }
  }
});

test('per-size manual values override automatic dimensions without changing the other size', () => {
  const bed = furniture.beds.find(product => product.id === 'berhouse-24139');
  const size = bed.sizes[2], variant = bed.variants.find(item => item.size === size);
  const edited = { ...bed, widthBySize: { [size]: 1010 }, depthBySize: { [size]: 2040 } };
  assert.equal(dimensions.dimension(edited, variant, size, 'Ширина'), '1010 мм');
  assert.equal(dimensions.dimension(edited, variant, size, 'Глубина'), '2040 мм');
  assert.equal(dimensions.dimension(edited, bed.variants[0], bed.sizes[0], 'Ширина'), '800 мм');
  assert.equal(dimensions.dimension({ ...bed, specs: {} }, variant, size, 'Ширина'), '');
});
