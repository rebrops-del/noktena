from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'{label}: target not found')
    if text.count(old) != 1:
        raise SystemExit(f'{label}: expected one target, found {text.count(old)}')
    return text.replace(old, new, 1)

# --- admin/admin.js ---
p = Path('admin/admin.js')
s = p.read_text(encoding='utf-8')

s = replace_once(s,
"    editImages: [],\n    editVariants: []\n  };",
"    editImages: [],\n    editVariants: [],\n    editColorImages: {}\n  };",
'admin state')

old_render_variants = """  function renderVariants() {\n    $('#variantRows').innerHTML = state.editVariants.map((v,i) => `<div class=\"variant-row\" data-variant-index=\"${i}\"><input data-v-size value=\"${esc(v.size || '')}\" placeholder=\"1600×2000\"><input data-v-color value=\"${esc(v.color || '')}\" placeholder=\"Цвет\"><input data-v-price type=\"number\" min=\"0\" step=\"1\" value=\"${Number(v.price)||0}\"><button type=\"button\" class=\"variant-remove\" data-v-remove=\"${i}\">×</button></div>`).join('');\n  }\n"""
new_render_variants = """  function renderVariants() {\n    $('#variantRows').innerHTML = state.editVariants.map((v,i) => `<div class=\"variant-row\" data-variant-index=\"${i}\"><input data-v-size value=\"${esc(v.size || '')}\" placeholder=\"1600×2000\"><input data-v-color data-prev-color=\"${esc(v.color || '')}\" value=\"${esc(v.color || '')}\" placeholder=\"Цвет\"><input data-v-price type=\"number\" min=\"0\" step=\"1\" value=\"${Number(v.price)||0}\"><button type=\"button\" class=\"variant-remove\" data-v-remove=\"${i}\">×</button></div>`).join('');\n    renderColorImageBindings();\n  }\n\n  function currentVariantColors() {\n    return uniq($$('.variant-row').map(row => $('[data-v-color]', row)?.value || ''));\n  }\n\n  function syncColorImagesFromDom() {\n    $$('#colorImageRows [data-color-image-select]').forEach(select => {\n      const color = String(select.dataset.colorImageSelect || '').trim();\n      if (!color) return;\n      if (select.value) state.editColorImages[color] = select.value;\n      else delete state.editColorImages[color];\n    });\n  }\n\n  function colorImageLabel(src) {\n    let file = String(src || '').split(/[?#]/)[0].split('/').pop() || 'изображение';\n    try { file = decodeURIComponent(file); } catch (_) {}\n    const index = state.editImages.indexOf(src);\n    return index >= 0 ? `Фото ${index + 1} · ${file}` : `Фото цвета · ${file}`;\n  }\n\n  function renderColorImageBindings() {\n    const section = $('#colorImagesSection');\n    const mount = $('#colorImageRows');\n    if (!section || !mount) return;\n    const furniture = $('#editKind')?.value === 'furniture';\n    section.classList.toggle('hidden', !furniture);\n    if (!furniture) return;\n\n    const colors = currentVariantColors();\n    if (!colors.length) {\n      mount.innerHTML = '<div class=\"color-image-empty\">Сначала укажите цвета в блоке «Размеры и цены».</div>';\n      return;\n    }\n\n    const candidates = uniq([...state.editImages, ...Object.values(state.editColorImages || {})]);\n    mount.innerHTML = colors.map(color => {\n      const selected = state.editColorImages[color] || '';\n      const options = [`<option value=\"\">Без привязки</option>`, ...candidates.map(src => `<option value=\"${esc(src)}\" ${src === selected ? 'selected' : ''}>${esc(colorImageLabel(src))}</option>`)].join('');\n      return `<div class=\"color-image-row\">\n        <div class=\"color-image-preview\">${selected ? `<img src=\"${esc(selected)}\" alt=\"${esc(color)}\">` : '<span>Нет фото</span>'}</div>\n        <div class=\"color-image-meta\"><b>${esc(color)}</b><small>Фото при выборе этого цвета</small></div>\n        <select data-color-image-select=\"${esc(color)}\">${options}</select>\n      </div>`;\n    }).join('');\n  }\n"""
s = replace_once(s, old_render_variants, new_render_variants, 'render variants')

s = replace_once(s,
"    $('#specsSection').classList.toggle('hidden', !furniture);\n    $('#editCategory').innerHTML = furniture",
"    $('#specsSection').classList.toggle('hidden', !furniture);\n    $('#colorImagesSection')?.classList.toggle('hidden', !furniture);\n    $('#editCategory').innerHTML = furniture",
'editor mode')

s = replace_once(s,
"    state.editImages = [...(item.images || [])];\n    state.editVariants = clone(item.variants || []);\n    renderImages();\n    renderVariants();",
"    state.editImages = [...(item.images || [])];\n    state.editVariants = clone(item.variants || []);\n    state.editColorImages = clone(item.colorImages || {});\n    renderImages();\n    renderVariants();",
'open editor state')

s = replace_once(s,
"  function managedObjectFromForm(existing = null) {\n    syncVariantsFromDom();",
"  function managedObjectFromForm(existing = null) {\n    syncVariantsFromDom();\n    syncColorImagesFromDom();",
'managed form sync')

s = replace_once(s,
"      colors: uniq(variants.map(v => v.color)),\n      specs: textToSpecs($('#editSpecs').value),",
"      colors: uniq(variants.map(v => v.color)),\n      colorImages: clone(state.editColorImages),\n      specs: textToSpecs($('#editSpecs').value),",
'managed color images')

s = replace_once(s,
"      : ['category','title','subtype','summary','description','price','images','variants','sizes','colors','specs','available','hit'];",
"      : ['category','title','subtype','summary','description','price','images','variants','sizes','colors','colorImages','specs','available','hit'];",
'diff fields')

s = replace_once(s,
"    renderImages();\n    toast('Фотографии загружены');",
"    renderImages();\n    renderColorImageBindings();\n    toast('Фотографии загружены');",
'upload render bindings')

old_click = """      const rm = e.target.closest('[data-image-remove]'); if (rm) { state.editImages.splice(Number(rm.dataset.imageRemove),1); renderImages(); }\n      const main = e.target.closest('[data-image-main]'); if (main) { const i=Number(main.dataset.imageMain); if(i>0){const [src]=state.editImages.splice(i,1);state.editImages.unshift(src);renderImages();} }\n      const vrm = e.target.closest('[data-v-remove]'); if (vrm) { syncVariantsFromDom(); state.editVariants.splice(Number(vrm.dataset.vRemove),1); renderVariants(); }\n    });\n"""
new_click = """      const rm = e.target.closest('[data-image-remove]'); if (rm) { state.editImages.splice(Number(rm.dataset.imageRemove),1); renderImages(); renderColorImageBindings(); }\n      const main = e.target.closest('[data-image-main]'); if (main) { const i=Number(main.dataset.imageMain); if(i>0){const [src]=state.editImages.splice(i,1);state.editImages.unshift(src);renderImages();renderColorImageBindings();} }\n      const vrm = e.target.closest('[data-v-remove]'); if (vrm) { syncVariantsFromDom(); state.editVariants.splice(Number(vrm.dataset.vRemove),1); renderVariants(); }\n    });\n    document.addEventListener('input', e => {\n      const input = e.target.closest('[data-v-color]');\n      if (!input) return;\n      const previous = String(input.dataset.prevColor || '').trim();\n      const next = input.value.trim();\n      if (previous && next && previous !== next && state.editColorImages[previous] && !state.editColorImages[next]) {\n        state.editColorImages[next] = state.editColorImages[previous];\n        delete state.editColorImages[previous];\n      }\n      input.dataset.prevColor = next;\n      renderColorImageBindings();\n    });\n    document.addEventListener('change', e => {\n      const select = e.target.closest('[data-color-image-select]');\n      if (!select) return;\n      const color = String(select.dataset.colorImageSelect || '').trim();\n      if (select.value) state.editColorImages[color] = select.value;\n      else delete state.editColorImages[color];\n      renderColorImageBindings();\n    });\n"""
s = replace_once(s, old_click, new_click, 'editor delegated events')

s = replace_once(s,
"    $('#addVariant').addEventListener('click', () => { syncVariantsFromDom(); state.editVariants.push({size:'',color:'',price:Number($('#editPrice').value)||0,available:true}); renderVariants(); });\n    $('#addImageUrl').addEventListener('click', () => { const u=$('#imageUrlInput').value.trim(); if(u){state.editImages.push(u);$('#imageUrlInput').value='';renderImages();} });",
"    $('#addVariant').addEventListener('click', () => { syncVariantsFromDom(); state.editVariants.push({size:'',color:'',price:Number($('#editPrice').value)||0,available:true}); renderVariants(); });\n    $('#addImageUrl').addEventListener('click', () => { const u=$('#imageUrlInput').value.trim(); if(u){state.editImages.push(u);$('#imageUrlInput').value='';renderImages();renderColorImageBindings();} });",
'add image binding refresh')

# Clear same-origin public catalog caches after admin writes, so the owner's storefront reflects edits immediately.
s = replace_once(s,
"  async function upsertRows(rows) {\n    if (!rows.length) return;\n    await request('/rest/v1/catalog_overrides?on_conflict=product_key', {",
"  function invalidatePublicCatalogCache() {\n    try {\n      for (const key of Object.keys(localStorage)) if (key.startsWith('noktena-catalog-overrides-')) localStorage.removeItem(key);\n    } catch (_) {}\n  }\n\n  async function upsertRows(rows) {\n    if (!rows.length) return;\n    await request('/rest/v1/catalog_overrides?on_conflict=product_key', {",
'cache invalidation helper')

s = replace_once(s,
"      body:JSON.stringify(rows)\n    });\n  }",
"      body:JSON.stringify(rows)\n    });\n    invalidatePublicCatalogCache();\n  }",
'upsert cache invalidation')

s = replace_once(s,
"      await request(`/rest/v1/catalog_overrides?product_key=eq.${encodeURIComponent(key)}`, {method:'DELETE',headers:{Prefer:'return=minimal'}});\n      await reloadData();",
"      await request(`/rest/v1/catalog_overrides?product_key=eq.${encodeURIComponent(key)}`, {method:'DELETE',headers:{Prefer:'return=minimal'}});\n      invalidatePublicCatalogCache();\n      await reloadData();",
'delete cache invalidation')

p.write_text(s, encoding='utf-8')

# --- admin/index.html ---
p = Path('admin/index.html')
s = p.read_text(encoding='utf-8')

section_target = """      <div class=\"form-section\">\n        <div class=\"section-head\"><div><h3>Размеры и цены</h3><p>Цена каждого варианта может отличаться.</p></div><button id=\"addVariant\" type=\"button\" class=\"secondary-btn\">+ Вариант</button></div>\n        <div class=\"variants-table\"><div class=\"variant-head\"><span>Размер</span><span>Цвет</span><span>Цена, ₽</span><span></span></div><div id=\"variantRows\"></div></div>\n      </div>\n\n      <div class=\"form-section furniture-only\" id=\"specsSection\">\n"""
section_new = """      <div class=\"form-section\">\n        <div class=\"section-head\"><div><h3>Размеры и цены</h3><p>Цена каждого варианта может отличаться.</p></div><button id=\"addVariant\" type=\"button\" class=\"secondary-btn\">+ Вариант</button></div>\n        <div class=\"variants-table\"><div class=\"variant-head\"><span>Размер</span><span>Цвет</span><span>Цена, ₽</span><span></span></div><div id=\"variantRows\"></div></div>\n      </div>\n\n      <div class=\"form-section furniture-only hidden\" id=\"colorImagesSection\">\n        <div class=\"section-head\"><div><h3>Цвет → фото</h3><p>Для каждого цвета выберите изображение, которое будет показываться покупателю при переключении цвета.</p></div></div>\n        <div id=\"colorImageRows\" class=\"color-image-bindings\"></div>\n      </div>\n\n      <div class=\"form-section furniture-only\" id=\"specsSection\">\n"""
s = replace_once(s, section_target, section_new, 'admin color image section')
s = s.replace('admin.css?v=20260919-1', 'admin.css?v=20260919-colorphotos1')
s = s.replace('admin.js?v=20260919-1', 'admin.js?v=20260919-colorphotos1')
p.write_text(s, encoding='utf-8')

# --- admin/admin.css ---
p = Path('admin/admin.css')
s = p.read_text(encoding='utf-8')
css = """
.color-image-bindings{display:grid;gap:10px}.color-image-row{display:grid;grid-template-columns:74px minmax(150px,.7fr) minmax(260px,1.3fr);gap:12px;align-items:center;border:1px solid var(--line);border-radius:14px;padding:10px;background:#f9fbfa}.color-image-preview{width:74px;height:58px;border-radius:10px;overflow:hidden;border:1px solid #dfe8e3;background:#eef3f0;display:grid;place-items:center}.color-image-preview img{width:100%;height:100%;object-fit:cover}.color-image-preview span{font-size:9px;color:#8a9991;text-align:center}.color-image-meta{min-width:0}.color-image-meta b{display:block;font-size:12px;line-height:1.35}.color-image-meta small{display:block;color:var(--mut);font-size:10px;margin-top:3px}.color-image-row select{width:100%;height:42px;border:1px solid #d7e2dc;background:#fff;color:var(--ink);border-radius:11px;padding:0 10px;outline:none}.color-image-row select:focus{border-color:var(--green);box-shadow:0 0 0 3px rgba(10,141,85,.1)}.color-image-empty{border:1px dashed #cddbd4;border-radius:12px;padding:16px;color:var(--mut);font-size:11px;background:#fafcfb}@media(max-width:760px){.color-image-row{grid-template-columns:64px 1fr}.color-image-preview{width:64px;height:54px}.color-image-row select{grid-column:1/-1}}
"""
if '.color-image-bindings{' not in s:
    s += css
p.write_text(s, encoding='utf-8')

# --- public runtime cache version ---
p = Path('assets/catalog-runtime.js')
s = p.read_text(encoding='utf-8')
s = s.replace("const CACHE_KEY = 'noktena-catalog-overrides-v1';", "const CACHE_KEY = 'noktena-catalog-overrides-v2';")
p.write_text(s, encoding='utf-8')

print('Admin color-to-photo mapping UI patched successfully.')
