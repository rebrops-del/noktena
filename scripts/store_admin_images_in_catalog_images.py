from pathlib import Path
import re

repo = Path('.')
admin = repo / 'admin/admin.js'
s = admin.read_text(encoding='utf-8')

# State map for separately stored images.
s = s.replace(
"    editImages: [],\n    editVariants: [],\n    editColorImages: {}\n  };",
"    editImages: [],\n    editVariants: [],\n    editColorImages: {},\n    assetUrls: new Map()\n  };"
)

# Resolve asset:<uuid> tokens to data URLs for previews/table UI.
marker = "  const keyFor = (kind, p) => kind === 'furniture' ? `furniture:${p.id}` : `mattress:${p.model}`;\n"
if "function imageSrc(value)" not in s:
    s = s.replace(marker, marker + "\n  function imageSrc(value) {\n    const key = String(value || '');\n    return state.assetUrls.get(key) || key;\n  }\n")

s = s.replace(
"  async function loadOverrides() {\n    const rows = await request('/rest/v1/catalog_overrides?select=product_key,kind,source_id,payload,hidden,is_custom,updated_at&order=updated_at.desc');\n    state.rowsByKey = new Map((rows || []).map(r => [r.product_key, r]));\n  }",
"  async function loadOverrides() {\n    const rows = await request('/rest/v1/catalog_overrides?select=product_key,kind,source_id,payload,hidden,is_custom,updated_at&order=updated_at.desc');\n    state.rowsByKey = new Map((rows || []).map(r => [r.product_key, r]));\n  }\n\n  async function loadCatalogImages() {\n    const rows = await request('/rest/v1/catalog_images?select=id,data_url&order=created_at.asc');\n    state.assetUrls = new Map((rows || []).map(row => [`asset:${row.id}`, row.data_url]));\n  }"
)

s = s.replace(
"  function imageFor(item) {\n    return Array.isArray(item.images) && item.images[0] ? item.images[0] : '';\n  }",
"  function imageFor(item) {\n    return Array.isArray(item.images) && item.images[0] ? imageSrc(item.images[0]) : '';\n  }"
)

s = s.replace(
"  function renderImages() {\n    $('#imageGrid').innerHTML = state.editImages.length ? state.editImages.map((src,i) => `<div class=\"image-item\"><img src=\"${esc(src)}\" alt=\"\"><div class=\"image-actions\"><button type=\"button\" data-image-main=\"${i}\">${i===0?'Главное':'Сделать главным'}</button><button type=\"button\" data-image-remove=\"${i}\">Удалить</button></div></div>`).join('') : '<div class=\"loading-row\">Фотографии не добавлены</div>';\n  }",
"  function renderImages() {\n    $('#imageGrid').innerHTML = state.editImages.length ? state.editImages.map((src,i) => `<div class=\"image-item\"><img src=\"${esc(imageSrc(src))}\" alt=\"\"><div class=\"image-actions\"><button type=\"button\" data-image-main=\"${i}\">${i===0?'Главное':'Сделать главным'}</button><button type=\"button\" data-image-remove=\"${i}\">Удалить</button></div></div>`).join('') : '<div class=\"loading-row\">Фотографии не добавлены</div>';\n  }"
)

# Label for uploaded asset tokens, avoid dumping data URL into option text.
start = s.index('  function colorImageLabel(src) {')
end = s.index('  function renderColorImageBindings()', start)
s = s[:start] + r'''  function colorImageLabel(src) {
    const index = state.editImages.indexOf(src);
    if (String(src || '').startsWith('asset:')) return index >= 0 ? `Фото ${index + 1} · загруженное` : 'Фото цвета · загруженное';
    let file = String(src || '').split(/[?#]/)[0].split('/').pop() || 'изображение';
    try { file = decodeURIComponent(file); } catch (_) {}
    return index >= 0 ? `Фото ${index + 1} · ${file}` : `Фото цвета · ${file}`;
  }

''' + s[end:]

s = s.replace(
"<div class=\"color-image-preview\">${selected ? `<img src=\"${esc(selected)}\" alt=\"${esc(color)}\">` : '<span>Нет фото</span>'}</div>",
"<div class=\"color-image-preview\">${selected ? `<img src=\"${esc(imageSrc(selected))}\" alt=\"${esc(color)}\">` : '<span>Нет фото</span>'}</div>"
)

# Replace inline image preparation with much smaller database image preparation and row insert.
start = s.index('  async function prepareInlineImage(file) {')
end = s.index('  async function uploadImages(files) {', start)
new_upload = r'''  async function prepareInlineImage(file) {
    if (!file) throw new Error('Файл не выбран.');
    if (!isImageFile(file)) throw new Error('Выберите изображение JPG, PNG, WEBP, GIF, AVIF, HEIC или HEIF.');
    if (Number(file.size || 0) > 25 * 1024 * 1024) throw new Error('Исходное фото слишком большое. Максимальный размер — 25 МБ.');

    const type = String(file.type || '').toLowerCase();
    const canDecode = ['image/jpeg','image/png','image/webp','image/avif'].includes(type);
    if (!canDecode) {
      if (Number(file.size || 0) > 85 * 1024) throw new Error('Для GIF/HEIC/HEIF используйте файл до 85 КБ либо предварительно сохраните его как JPG/PNG/WEBP.');
      return readBlobAsDataUrl(file);
    }

    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch (_) {
      if (Number(file.size || 0) <= 85 * 1024) return readBlobAsDataUrl(file);
      throw new Error('Браузер не смог обработать это изображение. Сохраните его как обычный JPG или PNG и загрузите снова.');
    }

    const render = async (maxSide, quality) => {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', {alpha:false});
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      return canvasBlob(canvas, 'image/jpeg', quality);
    };

    const attempts = [
      [1300, 0.76],
      [1100, 0.68],
      [950, 0.62],
      [820, 0.57],
      [720, 0.52]
    ];
    let blob = null;
    for (const [maxSide, quality] of attempts) {
      blob = await render(maxSide, quality);
      if (blob && blob.size <= 85 * 1024) break;
    }
    if (typeof bitmap.close === 'function') bitmap.close();
    if (!blob) throw new Error('Не удалось подготовить изображение. Попробуйте другой JPG или PNG.');
    if (blob.size > 95 * 1024) throw new Error('Фото после оптимизации всё ещё слишком большое. Используйте изображение меньшего разрешения.');
    return readBlobAsDataUrl(blob);
  }

  async function uploadSingleImage(file, color = '') {
    const dataUrl = await prepareInlineImage(file);
    if (!dataUrl.startsWith('data:image/')) throw new Error('Не удалось подготовить изображение.');
    const productKey = $('#editKey').value || $('#editName').value.trim() || `new-${Date.now()}`;
    const rows = await request('/rest/v1/catalog_images?select=id,data_url', {
      method:'POST',
      headers:{'Content-Type':'application/json', Prefer:'return=representation'},
      body:JSON.stringify({
        product_key:productKey,
        color:String(color || ''),
        data_url:dataUrl
      })
    });
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row?.id) throw new Error('Фото обработано, но база не вернула ID изображения.');
    const token = `asset:${row.id}`;
    state.assetUrls.set(token, row.data_url || dataUrl);
    return token;
  }

'''
s = s[:start] + new_upload + s[end:]

s = s.replace(
"  async function reloadData() {\n    await loadOverrides();\n    rebuildItems();\n    renderTable();\n  }",
"  async function reloadData() {\n    await Promise.all([loadOverrides(), loadCatalogImages()]);\n    rebuildItems();\n    renderTable();\n  }"
)

# Cache bust admin JS.
admin.write_text(s, encoding='utf-8')

h = repo / 'admin/index.html'
html = h.read_text(encoding='utf-8')
html = re.sub(r'admin\.js\?v=[^\"\']+', 'admin.js?v=20260919-photo-assets1', html)
h.write_text(html, encoding='utf-8')

# Public runtime resolves asset tokens before applying overrides.
runtime = repo / 'assets/catalog-runtime.js'
r = runtime.read_text(encoding='utf-8')
fetch_start = r.index('  async function fetchRows() {')
fetch_end = r.index('  function applyRows(', fetch_start)
new_fetch = r'''  function resolveCatalogImageTokens(rows, assets) {
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

'''
r = r[:fetch_start] + new_fetch + r[fetch_end:]
runtime.write_text(r, encoding='utf-8')

for page_name in ['index.html', 'product.html']:
    p = repo / page_name
    text = p.read_text(encoding='utf-8')
    text = re.sub(r'assets/catalog-runtime\.js\?v=[^\"\']+', 'assets/catalog-runtime.js?v=20260919-assets1', text)
    p.write_text(text, encoding='utf-8')

print('patched')
