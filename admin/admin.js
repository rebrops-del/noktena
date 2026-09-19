(() => {
  'use strict';

  const cfg = window.NOKTENA_ADMIN_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const SESSION_KEY = 'noktena-admin-session-v1';
  const DATA_FILES = ['../data/data1.json','../data/data2.json','../data/data3.json','../data/data4.json','../data/data5.json','../data/data6.json'];
  const state = {
    session: null,
    baseByKey: new Map(),
    rowsByKey: new Map(),
    items: [],
    editImages: [],
    editVariants: [],
    editColorImages: {},
    assetUrls: new Map()
  };

  const configured = () => Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
  const baseUrl = () => String(cfg.supabaseUrl || '').replace(/\/$/, '');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rub = n => Number(n) > 0 ? `${Math.round(Number(n)).toLocaleString('ru-RU')} ₽` : '—';
  const deepEqual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const clone = obj => JSON.parse(JSON.stringify(obj ?? {}));
  const uniq = list => [...new Set((list || []).filter(Boolean).map(v => String(v).trim()).filter(Boolean))];
  const keyFor = (kind, p) => kind === 'furniture' ? `furniture:${p.id}` : `mattress:${p.model}`;

  function imageSrc(value) {
    const key = String(value || '');
    return state.assetUrls.get(key) || key;
  }

  function toast(message, error = false) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.toggle('error', error);
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  function authHeaders(extra = {}, token = null) {
    const headers = {apikey: cfg.supabaseAnonKey, ...extra};
    const bearer = token || state.session?.access_token;
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    return headers;
  }

  function publicAuthHeaders(extra = {}) {
    return {apikey: cfg.supabaseAnonKey, ...extra};
  }

  async function refreshSession() {
    const refreshToken = state.session?.refresh_token;
    if (!refreshToken) throw new Error('Нет refresh token');
    const r = await fetch(`${baseUrl()}/auth/v1/token?grant_type=refresh_token`, {
      method:'POST',
      headers:publicAuthHeaders({'Content-Type':'application/json'}),
      body:JSON.stringify({refresh_token:refreshToken})
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.access_token) throw new Error(data.error_description || data.msg || 'Сессия истекла');
    state.session = data;
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    return data;
  }

  async function request(path, options = {}, retried = false) {
    const r = await fetch(`${baseUrl()}${path}`, {
      ...options,
      headers: authHeaders(options.headers || {})
    });
    if (r.status === 401 && !retried && state.session?.refresh_token) {
      try {
        await refreshSession();
        return request(path, options, true);
      } catch (_) {
        localStorage.removeItem(SESSION_KEY);
        state.session = null;
      }
    }
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new Error(text || `HTTP ${r.status}`);
    }
    if (r.status === 204 || options.headers?.Prefer?.includes('return=minimal')) return null;
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  }

  async function signIn(email, password) {
    const r = await fetch(`${baseUrl()}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: publicAuthHeaders({'Content-Type':'application/json'}),
      body: JSON.stringify({email, password})
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.access_token) throw new Error(data.error_description || data.msg || data.error || 'Не удалось войти');
    state.session = data;
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    return data;
  }

  async function updatePassword(password) {
    const token = state.session?.access_token;
    if (!token) throw new Error('Сессия не найдена. Войдите заново.');
    const r = await fetch(`${baseUrl()}/auth/v1/user`, {
      method:'PUT',
      headers:authHeaders({'Content-Type':'application/json'}, token),
      body:JSON.stringify({password})
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.msg || data.message || data.error_description || data.error || 'Не удалось изменить пароль');
    return data;
  }

  async function sendRecovery(email) {
    const redirectTo = window.NOKTENA_ADMIN_SHELL_URL || `${location.origin}/admin/`;
    const r = await fetch(`${baseUrl()}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method:'POST',
      headers:publicAuthHeaders({'Content-Type':'application/json'}),
      body:JSON.stringify({email})
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.msg || data.message || data.error_description || data.error || 'Не удалось отправить письмо');
  }

  function adoptRecoverySession() {
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    if (hash.get('type') !== 'recovery' || !hash.get('access_token')) return false;
    state.session = {
      access_token: hash.get('access_token'),
      refresh_token: hash.get('refresh_token') || '',
      token_type: hash.get('token_type') || 'bearer',
      expires_in: Number(hash.get('expires_in')) || 3600,
      user: null
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(state.session));
    return true;
  }

  function restoreSession() {
    try {
      const raw = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (raw?.access_token) state.session = raw;
    } catch (_) {}
  }

  async function loadBaseCatalog() {
    const [furnitureResponse, mattressSets] = await Promise.all([
      fetch(`../data/furniture.json?v=${Date.now()}`, {cache:'no-store'}),
      Promise.all(DATA_FILES.map(f => fetch(`${f}?v=${Date.now()}`, {cache:'no-store'}).then(r => {
        if (!r.ok) throw new Error(`${f}: ${r.status}`);
        return r.json();
      })))
    ]);
    if (!furnitureResponse.ok) throw new Error(`furniture.json: ${furnitureResponse.status}`);
    const furniture = await furnitureResponse.json();
    state.baseByKey.clear();

    for (const p of [...(furniture.beds || []), ...(furniture.sofas || [])]) {
      const key = keyFor('furniture', p);
      state.baseByKey.set(key, {key, kind:'furniture', base:clone(p)});
    }
    for (const p of mattressSets.flat()) {
      if (!p?.model) continue;
      const key = keyFor('mattress', p);
      if (!state.baseByKey.has(key)) state.baseByKey.set(key, {key, kind:'mattress', base:clone(p)});
    }
  }

  async function loadOverrides() {
    const rows = await request('/rest/v1/catalog_overrides?select=product_key,kind,source_id,payload,hidden,is_custom,updated_at&order=updated_at.desc');
    state.rowsByKey = new Map((rows || []).map(r => [r.product_key, r]));
  }

  async function loadCatalogImages() {
    const rows = await request('/rest/v1/catalog_images?select=id,data_url&order=created_at.asc');
    state.assetUrls = new Map((rows || []).map(row => [`asset:${row.id}`, row.data_url]));
  }

  function rebuildItems() {
    const items = [];
    for (const rec of state.baseByKey.values()) {
      const row = state.rowsByKey.get(rec.key);
      const merged = row ? {...clone(rec.base), ...clone(row.payload || {})} : clone(rec.base);
      items.push({...merged, _key:rec.key, _kind:rec.kind, _base:rec.base, _changed:Boolean(row), _hidden:Boolean(row?.hidden), _isCustom:false});
    }
    for (const row of state.rowsByKey.values()) {
      if (!row.is_custom) continue;
      const merged = clone(row.payload || {});
      items.push({...merged, _key:row.product_key, _kind:row.kind, _base:{}, _changed:true, _hidden:Boolean(row.hidden), _isCustom:true});
    }
    state.items = items;
  }

  function itemGroup(item) {
    if (item._kind === 'mattress') return 'mattress';
    return item.category === 'sofas' ? 'sofas' : 'beds';
  }

  function categoryLabel(item) {
    const group = itemGroup(item);
    if (group === 'beds') return 'Кровать';
    if (group === 'sofas') return 'Диван';
    return item.category || 'Матрас';
  }

  function itemName(item) {
    return item._kind === 'mattress' ? item.model : item.title;
  }

  function minPrice(item) {
    const prices = (item.variants || []).map(v => Number(v?.price)).filter(n => Number.isFinite(n) && n > 0);
    const base = Number(item.price);
    if (Number.isFinite(base) && base > 0) prices.push(base);
    return prices.length ? Math.min(...prices) : 0;
  }

  function imageFor(item) {
    return Array.isArray(item.images) && item.images[0] ? imageSrc(item.images[0]) : '';
  }

  function renderStats() {
    const active = state.items.filter(x => !x._hidden);
    const changed = state.items.filter(x => x._changed).length;
    const custom = state.items.filter(x => x._isCustom).length;
    $('#stats').innerHTML = [
      ['Всего товаров', state.items.length],
      ['Опубликовано', active.length],
      ['Изменено вручную', changed],
      ['Добавлено вручную', custom]
    ].map(([label,value]) => `<div class="stat"><small>${label}</small><b>${value}</b></div>`).join('');
  }

  function filteredItems() {
    const q = ($('#searchInput').value || '').trim().toLowerCase();
    const kind = $('#kindFilter').value;
    const status = $('#statusFilter').value;
    return state.items.filter(item => {
      if (q && !`${itemName(item)} ${item.description || ''} ${item.summary || item.intro || ''}`.toLowerCase().includes(q)) return false;
      if (kind && itemGroup(item) !== kind) return false;
      if (status === 'active' && item._hidden) return false;
      if (status === 'hidden' && !item._hidden) return false;
      if (status === 'changed' && !item._changed) return false;
      return true;
    }).sort((a,b) => itemName(a).localeCompare(itemName(b), 'ru'));
  }

  function renderTable() {
    renderStats();
    const rows = filteredItems();
    $('#productRows').innerHTML = rows.length ? rows.map(item => {
      const img = imageFor(item);
      const source = item._isCustom ? '<span class="pill gold">Вручную</span>' : item._changed ? '<span class="pill gold">Berhouse + правки</span>' : '<span class="pill gray">Каталог</span>';
      return `<tr>
        <td><div class="product-cell">${img?`<img class="thumb" src="${esc(img)}" alt="" loading="lazy">`:'<div class="thumb"></div>'}<div><b>${esc(itemName(item))}</b><small>${esc(item._key)}</small></div></div></td>
        <td>${esc(categoryLabel(item))}</td>
        <td><b>${rub(minPrice(item))}</b></td>
        <td>${item._hidden?'<span class="pill red">Скрыт</span>':'<span class="pill green">На сайте</span>'}</td>
        <td>${source}</td>
        <td><div class="row-actions"><button class="icon-btn" data-edit-key="${esc(item._key)}">Изменить</button></div></td>
      </tr>`;
    }).join('') : '<tr><td colspan="6" class="loading-row">Ничего не найдено</td></tr>';
    $('#tableFooter').textContent = `Показано: ${rows.length} из ${state.items.length}`;
  }

  function specsToText(specs) {
    return Object.entries(specs || {}).map(([k,v]) => `${k}: ${v}`).join('\n');
  }

  function textToSpecs(text) {
    const out = {};
    for (const line of String(text || '').split(/\n+/)) {
      const i = line.indexOf(':');
      if (i < 1) continue;
      const k = line.slice(0,i).trim();
      const v = line.slice(i+1).trim();
      if (k && v) out[k] = v;
    }
    return out;
  }

  function renderImages() {
    $('#imageGrid').innerHTML = state.editImages.length ? state.editImages.map((src,i) => `<div class="image-item"><img src="${esc(imageSrc(src))}" alt=""><div class="image-actions"><button type="button" data-image-main="${i}">${i===0?'Главное':'Сделать главным'}</button><button type="button" data-image-remove="${i}">Удалить</button></div></div>`).join('') : '<div class="loading-row">Фотографии не добавлены</div>';
  }

  function renderVariants() {
    $('#variantRows').innerHTML = state.editVariants.map((v,i) => `<div class="variant-row" data-variant-index="${i}"><input data-v-size value="${esc(v.size || '')}" placeholder="1600×2000"><input data-v-color data-prev-color="${esc(v.color || '')}" value="${esc(v.color || '')}" placeholder="Цвет"><input data-v-price type="number" min="0" step="1" value="${Number(v.price)||0}"><button type="button" class="variant-remove" data-v-remove="${i}">×</button></div>`).join('');
    renderColorImageBindings();
  }

  function currentVariantColors() {
    return uniq($$('.variant-row').map(row => $('[data-v-color]', row)?.value || ''));
  }

  function syncColorImagesFromDom() {
    $$('#colorImageRows [data-color-image-select]').forEach(select => {
      const color = String(select.dataset.colorImageSelect || '').trim();
      if (!color) return;
      if (select.value) state.editColorImages[color] = select.value;
      else delete state.editColorImages[color];
    });
  }

  function colorImageLabel(src) {
    const index = state.editImages.indexOf(src);
    if (String(src || '').startsWith('asset:')) return index >= 0 ? `Фото ${index + 1} · загруженное` : 'Фото цвета · загруженное';
    let file = String(src || '').split(/[?#]/)[0].split('/').pop() || 'изображение';
    try { file = decodeURIComponent(file); } catch (_) {}
    return index >= 0 ? `Фото ${index + 1} · ${file}` : `Фото цвета · ${file}`;
  }

  function renderColorImageBindings() {
    const section = $('#colorImagesSection');
    const mount = $('#colorImageRows');
    if (!section || !mount) return;
    const furniture = $('#editKind')?.value === 'furniture';
    section.classList.toggle('hidden', !furniture);
    if (!furniture) return;

    const colors = currentVariantColors();
    if (!colors.length) {
      mount.innerHTML = '<div class="color-image-empty">Сначала укажите цвета в блоке «Размеры и цены».</div>';
      return;
    }

    const candidates = uniq([...state.editImages, ...Object.values(state.editColorImages || {})]);
    mount.innerHTML = colors.map(color => {
      const selected = state.editColorImages[color] || '';
      const options = [`<option value="">Без привязки</option>`, ...candidates.map(src => `<option value="${esc(src)}" ${src === selected ? 'selected' : ''}>${esc(colorImageLabel(src))}</option>`)].join('');
      return `<div class="color-image-row">
        <div class="color-image-preview">${selected ? `<img src="${esc(imageSrc(selected))}" alt="${esc(color)}">` : '<span>Нет фото</span>'}</div>
        <div class="color-image-meta"><b>${esc(color)}</b><small>Фото при выборе этого цвета</small></div>
        <div class="color-image-controls">
          <select data-color-image-select="${esc(color)}">${options}</select>
          <button type="button" class="color-image-upload-btn" data-color-image-upload-trigger="${esc(color)}">+ Загрузить фото</button>
          <input type="file" accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.avif,.heic,.heif" data-color-image-upload="${esc(color)}" hidden>
          ${selected ? `<button type="button" class="color-image-delete" data-color-image-remove="${esc(color)}">Удалить фото</button>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  function syncVariantsFromDom() {
    state.editVariants = $$('.variant-row').map(row => ({
      size: $('[data-v-size]', row).value.trim(),
      color: $('[data-v-color]', row).value.trim(),
      price: Number($('[data-v-price]', row).value) || 0,
      available: true
    })).filter(v => v.size || v.color || v.price);
  }

  function setEditorMode(kind) {
    const furniture = kind === 'furniture';
    $('#specsSection').classList.toggle('hidden', !furniture);
    $('#colorImagesSection')?.classList.toggle('hidden', !furniture);
    $('#editCategory').innerHTML = furniture
      ? '<option value="beds">Кровати</option><option value="sofas">Диваны</option>'
      : '<option value="Матрасы">Матрасы</option><option value="Подушки">Подушки</option><option value="Чехлы">Чехлы</option>';
  }

  function openEditor(key = null) {
    let item = key ? state.items.find(x => x._key === key) : null;
    const isNew = !item;
    if (!item) item = {_kind:'mattress',category:'Матрасы',variants:[],images:[],available:true,hit:false,_key:'',_isCustom:true,_hidden:false};
    $('#editKey').value = item._key || '';
    $('#editIsCustom').value = item._isCustom ? '1' : '0';
    $('#editorTitle').textContent = isNew ? 'Новый товар' : itemName(item);
    $('#editKind').value = item._kind;
    setEditorMode(item._kind);
    $('#editCategory').value = item.category || (item._kind === 'furniture' ? 'beds' : 'Матрасы');
    $('#editName').value = itemName(item) || '';
    $('#editPrice').value = Number(item.price) || minPrice(item) || '';
    $('#editSubtype').value = item.subtype || '';
    $('#editSummary').value = item._kind === 'mattress' ? (item.intro || '') : (item.summary || '');
    $('#editDescription').value = item.description || '';
    $('#editSpecs').value = specsToText(item.specs || {});
    $('#editAvailable').checked = item.available !== false;
    $('#editHit').checked = Boolean(item.hit);
    $('#editHidden').checked = Boolean(item._hidden);
    state.editImages = [...(item.images || [])];
    state.editVariants = clone(item.variants || []);
    state.editColorImages = clone(item.colorImages || {});
    renderImages();
    renderVariants();
    const reset = $('#resetOverrideBtn');
    reset.classList.toggle('hidden', isNew || (!item._changed && !item._isCustom));
    reset.textContent = item._isCustom ? 'Удалить товар' : 'Сбросить ручные изменения';
    $('#editorModal').classList.remove('hidden');
  }

  function closeEditor() { $('#editorModal').classList.add('hidden'); }
  function openBulk() { renderBulkPreview(); $('#bulkModal').classList.remove('hidden'); }
  function closeBulk() { $('#bulkModal').classList.add('hidden'); }

  function managedObjectFromForm(existing = null) {
    syncVariantsFromDom();
    syncColorImagesFromDom();
    const kind = $('#editKind').value;
    const category = $('#editCategory').value;
    const name = $('#editName').value.trim();
    const price = Number($('#editPrice').value) || 0;
    const description = $('#editDescription').value.trim();
    const summary = $('#editSummary').value.trim();
    const variants = clone(state.editVariants);
    if (price > 0 && variants.length && variants.every(v => !Number(v.price))) variants.forEach(v => v.price = price);
    if (kind === 'mattress') {
      return {
        model: name,
        category,
        intro: summary,
        description,
        images: [...state.editImages],
        variants
      };
    }
    const id = existing?.id || `custom-${Date.now()}`;
    return {
      id,
      category,
      title: name,
      subtype: $('#editSubtype').value.trim(),
      summary,
      description,
      price,
      images: [...state.editImages],
      variants,
      sizes: uniq(variants.map(v => v.size)),
      colors: uniq(variants.map(v => v.color)),
      colorImages: clone(state.editColorImages),
      specs: textToSpecs($('#editSpecs').value),
      available: $('#editAvailable').checked,
      hit: $('#editHit').checked
    };
  }

  function diffPayload(base, edited, kind) {
    const fields = kind === 'mattress'
      ? ['model','category','intro','description','images','variants']
      : ['category','title','subtype','summary','description','price','images','variants','sizes','colors','colorImages','specs','available','hit'];
    const out = {};
    for (const field of fields) if (!deepEqual(base?.[field], edited?.[field])) out[field] = clone(edited[field]);
    return out;
  }

  function invalidatePublicCatalogCache() {
    try {
      for (const key of Object.keys(localStorage)) if (key.startsWith('noktena-catalog-overrides-')) localStorage.removeItem(key);
    } catch (_) {}
  }

  async function upsertRows(rows) {
    if (!rows.length) return;
    await request('/rest/v1/catalog_overrides?on_conflict=product_key', {
      method:'POST',
      headers:{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify(rows)
    });
    invalidatePublicCatalogCache();
  }

  async function saveEditor(e) {
    e.preventDefault();
    const btn = $('#saveProductBtn');
    btn.disabled = true;
    btn.textContent = 'Сохраняем…';
    try {
      const oldKey = $('#editKey').value;
      const existingItem = oldKey ? state.items.find(x => x._key === oldKey) : null;
      const kind = $('#editKind').value;
      const isCustom = !oldKey || $('#editIsCustom').value === '1';
      const edited = managedObjectFromForm(existingItem);
      if (!itemName({...edited,_kind:kind}).trim()) throw new Error('Укажите название товара');
      let key = oldKey;
      if (!key) key = kind === 'furniture' ? `furniture:${edited.id}` : `mattress:custom-${Date.now()}`;
      const baseRec = state.baseByKey.get(key);
      const currentRow = state.rowsByKey.get(key);
      const payload = isCustom ? edited : {...(currentRow?.payload || {}), ...diffPayload(baseRec?.base || {}, edited, kind)};
      await upsertRows([{
        product_key:key,
        kind,
        source_id:kind === 'furniture' ? String(edited.id || '').replace(/^berhouse-/,'') : edited.model,
        payload,
        hidden:$('#editHidden').checked,
        is_custom:isCustom
      }]);
      await reloadData();
      closeEditor();
      toast('Карточка сохранена');
    } catch (err) {
      console.error(err);
      toast(err.message || 'Не удалось сохранить карточку', true);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Сохранить';
    }
  }

  async function resetCurrentOverride() {
    const key = $('#editKey').value;
    if (!key) return;
    const item = state.items.find(x => x._key === key);
    const question = item?._isCustom ? 'Удалить этот товар из каталога?' : 'Сбросить все ручные изменения этой карточки?';
    if (!confirm(question)) return;
    try {
      await request(`/rest/v1/catalog_overrides?product_key=eq.${encodeURIComponent(key)}`, {method:'DELETE',headers:{Prefer:'return=minimal'}});
      invalidatePublicCatalogCache();
      await reloadData();
      closeEditor();
      toast(item?._isCustom ? 'Товар удалён' : 'Изменения сброшены');
    } catch (err) { toast(err.message, true); }
  }

  function safeSegment(value) {
    return String(value || 'product').toLowerCase().replace(/[^a-zа-я0-9._-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,80) || 'product';
  }

  function asciiProductFolder(value) {
    const text = String(value || 'product');
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `p-${(hash >>> 0).toString(36)}`;
  }

  function uploadExtension(file) {
    const fromName = String(file?.name || '').match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase();
    if (fromName) return fromName === 'jpeg' ? 'jpg' : fromName;
    const type = String(file?.type || '').toLowerCase();
    if (type === 'image/jpeg') return 'jpg';
    if (type === 'image/png') return 'png';
    if (type === 'image/webp') return 'webp';
    if (type === 'image/gif') return 'gif';
    if (type === 'image/avif') return 'avif';
    return 'img';
  }

  async function uploadStorageObject(file, bucket, encodedPath, retried = false) {
    const r = await fetch(`${baseUrl()}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`, {
      method:'POST',
      headers:authHeaders({
        'Content-Type':file.type || 'application/octet-stream',
        'x-upsert':'false'
      }),
      body:file
    });
    if (r.status === 401 && !retried && state.session?.refresh_token) {
      await refreshSession();
      return uploadStorageObject(file, bucket, encodedPath, true);
    }
    if (!r.ok) {
      const raw = await r.text().catch(() => '');
      let detail = raw;
      try {
        const parsed = JSON.parse(raw);
        detail = parsed.message || parsed.error || parsed.statusCode || raw;
      } catch (_) {}
      throw new Error(`Не удалось загрузить «${file.name}»${detail ? `: ${detail}` : ` (HTTP ${r.status})`}`);
    }
  }

  function isImageFile(file) {
    const type = String(file?.type || '').toLowerCase();
    if (type.startsWith('image/')) return true;
    return /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i.test(String(file?.name || ''));
  }

  function publicStorageUrl(bucket, encodedPath) {
    return `${baseUrl()}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`;
  }

  function readBlobAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Не удалось прочитать выбранное фото.'));
      reader.readAsDataURL(blob);
    });
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise(resolve => canvas.toBlob(resolve, type, quality));
  }

  async function prepareInlineImage(file) {
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

  async function uploadImages(files) {
    if (!files?.length) return [];
    const validFiles = [...files].filter(isImageFile);
    if (!validFiles.length) throw new Error('Выберите файл изображения: JPG, PNG, WEBP, GIF, AVIF, HEIC или HEIF.');
    const uploaded = [];
    for (const file of validFiles) {
      const url = await uploadSingleImage(file);
      state.editImages.push(url);
      uploaded.push(url);
      renderImages();
      renderColorImageBindings();
    }
    toast(validFiles.length === 1 ? 'Фотография загружена' : `Фотографии загружены: ${validFiles.length}`);
    return uploaded;
  }

  async function uploadColorImage(color, file) {
    color = String(color || '').trim();
    if (!color) throw new Error('Не удалось определить цвет.');
    const url = await uploadSingleImage(file, color);
    state.editColorImages[color] = url;
    renderColorImageBindings();
    toast(`Фото для цвета «${color}» загружено и привязано`);
    return url;
  }

  function priceTransform(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return value;
    const pct = (Number($('#bulkPercent').value) || 0) * Number($('#bulkSign').value || 1);
    const step = Math.max(1, Number($('#bulkRound').value) || 1);
    const raw = n * (1 + pct / 100);
    const mode = $('#bulkRoundMode').value;
    const units = raw / step;
    const rounded = mode === 'up' ? Math.ceil(units) : mode === 'down' ? Math.floor(units) : Math.round(units);
    return Math.max(step, rounded * step);
  }

  function bulkTargets() {
    const scope = $('#bulkScope').value;
    return state.items.filter(item => !item._hidden && (scope === 'all' || itemGroup(item) === scope));
  }

  function renderBulkPreview() {
    const targets = bulkTargets();
    const examples = targets.slice(0,5).map(item => {
      const before = minPrice(item);
      return `<div class="bulk-example"><span>${esc(itemName(item))}</span><span>${rub(before)}</span><b>→ ${rub(priceTransform(before))}</b></div>`;
    }).join('');
    $('#bulkPreview').innerHTML = `<h4>Изменится товаров: ${targets.length}</h4>${examples || '<div class="loading-row">Нет товаров по выбранному фильтру</div>'}`;
  }

  async function applyBulk() {
    const targets = bulkTargets();
    if (!targets.length) return toast('Нет товаров для изменения', true);
    const pct = (Number($('#bulkPercent').value) || 0) * Number($('#bulkSign').value || 1);
    if (!pct) return toast('Укажите процент изменения', true);
    if (!confirm(`Изменить цены у ${targets.length} товаров на ${pct > 0 ? '+' : ''}${pct}%?`)) return;
    const btn = $('#applyBulkBtn');
    btn.disabled = true;
    btn.textContent = 'Применяем…';
    try {
      const rows = targets.map(item => {
        const currentRow = state.rowsByKey.get(item._key);
        const newVariants = (item.variants || []).map(v => ({...v, price:priceTransform(v.price)}));
        const newPrice = priceTransform(item.price || minPrice(item));
        if (item._isCustom) {
          const payload = {...clone(item), variants:newVariants};
          delete payload._key;delete payload._kind;delete payload._base;delete payload._changed;delete payload._hidden;delete payload._isCustom;
          if (item._kind === 'furniture') payload.price = newPrice;
          return {product_key:item._key,kind:item._kind,source_id:item._kind==='furniture'?item.id:item.model,payload,hidden:false,is_custom:true};
        }
        const payload = {...(currentRow?.payload || {}), variants:newVariants};
        if (item._kind === 'furniture') payload.price = newPrice;
        return {product_key:item._key,kind:item._kind,source_id:item._kind==='furniture'?String(item.id||'').replace(/^berhouse-/,''):item.model,payload,hidden:false,is_custom:false};
      });
      await upsertRows(rows);
      await reloadData();
      closeBulk();
      toast(`Цены изменены: ${targets.length} товаров`);
    } catch (err) {
      console.error(err);
      toast(err.message || 'Не удалось изменить цены', true);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Применить изменения';
    }
  }

  async function restoreUploadReturn() {
    const params = new URLSearchParams(location.search);
    if (params.get('upload_return') !== '1') return;

    const nonce = params.get('nonce') || '';
    const raw = nonce ? sessionStorage.getItem(uploadDraftKey(nonce)) : '';
    if (nonce) sessionStorage.removeItem(uploadDraftKey(nonce));
    history.replaceState(null, '', '/admin/');

    if (!raw) {
      toast('Не удалось восстановить карточку после загрузки. Откройте товар снова.', true);
      return;
    }

    let draft;
    try { draft = JSON.parse(raw); } catch (_) { draft = null; }
    if (!draft?.fields) {
      toast('Не удалось восстановить карточку после загрузки.', true);
      return;
    }

    const key = String(draft.fields.editKey || '');
    openEditor(key || null);

    $('#editKind').value = draft.fields.editKind || 'mattress';
    setEditorMode($('#editKind').value);
    for (const [id, value] of Object.entries(draft.fields || {})) {
      const el = $('#'+id);
      if (el) el.value = value ?? '';
    }
    $('#editAvailable').checked = Boolean(draft.checks?.editAvailable);
    $('#editHit').checked = Boolean(draft.checks?.editHit);
    $('#editHidden').checked = Boolean(draft.checks?.editHidden);
    state.editImages = Array.isArray(draft.images) ? [...draft.images] : [];
    state.editVariants = Array.isArray(draft.variants) ? clone(draft.variants) : [];
    state.editColorImages = draft.colorImages && typeof draft.colorImages === 'object' ? clone(draft.colorImages) : {};

    const result = {
      ok: params.get('ok') === '1',
      url: params.get('url') || '',
      error: params.get('error') || '',
      detail: params.get('detail') || ''
    };

    if (result.ok && result.url) {
      const color = String(draft.uploadColor || '').trim();
      if (color) state.editColorImages[color] = result.url;
      else if (!state.editImages.includes(result.url)) state.editImages.push(result.url);
    }

    renderImages();
    renderVariants();
    renderColorImageBindings();

    const status = $('#imageUploadStatus');
    if (result.ok && result.url) {
      if (status && !draft.uploadColor) {
        status.className = 'upload-status success';
        status.textContent = 'Фото загружено. Нажмите «Сохранить» в карточке.';
      }
      toast(draft.uploadColor ? `Фото для цвета «${draft.uploadColor}» загружено` : 'Фотография загружена');
    } else {
      const err = uploadResultError(result, 'фото');
      if (status && !draft.uploadColor) {
        status.className = 'upload-status error';
        status.textContent = err.message;
      }
      toast(err.message, true);
    }
  }

  async function reloadData() {
    await Promise.all([loadOverrides(), loadCatalogImages()]);
    rebuildItems();
    renderTable();
  }

  async function enterApp() {
    $('#setupScreen').classList.add('hidden');
    $('#loginScreen').classList.add('hidden');
    $('#app').classList.remove('hidden');
    $('#adminEmail').textContent = state.session?.user?.email || '';
    try {
      await loadBaseCatalog();
      await reloadData();
    } catch (err) {
      console.error(err);
      toast(`Ошибка загрузки каталога: ${err.message}`, true);
    }
  }

  function bind() {
    $('#loginForm').addEventListener('submit', async e => {
      e.preventDefault();
      $('#loginError').textContent = '';
      const btn = $('#loginForm .primary-btn');
      btn.disabled = true;
      btn.textContent = 'Входим…';
      try {
        await signIn($('#loginEmail').value.trim(), $('#loginPassword').value);
        await enterApp();
      } catch (err) {
        $('#loginError').textContent = err.message || 'Ошибка входа';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Войти';
      }
    });
    $('#forgotPasswordBtn').addEventListener('click', async () => {
      const email = $('#loginEmail').value.trim().toLowerCase();
      const status = $('#recoveryStatus');
      status.textContent = '';
      if (!email) { status.textContent = 'Введите e-mail администратора.'; return; }
      const btn = $('#forgotPasswordBtn');
      btn.disabled = true;
      btn.textContent = 'Отправляем…';
      try {
        await sendRecovery(email);
        status.style.color = '#16704a';
        status.textContent = 'Ссылка для смены пароля отправлена на e-mail.';
      } catch (err) {
        status.style.color = '#c93845';
        status.textContent = err.message || 'Не удалось отправить письмо.';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Забыли пароль?';
      }
    });

    $('#resetPasswordForm').addEventListener('submit', async e => {
      e.preventDefault();
      const pass = $('#resetPassword').value;
      const repeat = $('#resetPasswordRepeat').value;
      const status = $('#resetPasswordStatus');
      status.textContent = '';
      if (pass.length < 8) { status.textContent = 'Пароль должен содержать минимум 8 символов.'; return; }
      if (pass !== repeat) { status.textContent = 'Пароли не совпадают.'; return; }
      const btn = $('#resetPasswordSubmit');
      btn.disabled = true;
      btn.textContent = 'Сохраняем…';
      try {
        await updatePassword(pass);
        localStorage.removeItem(SESSION_KEY);
        state.session = null;
        history.replaceState(null, '', '/admin/');
        $('#recoveryScreen').classList.add('hidden');
        $('#loginScreen').classList.remove('hidden');
        $('#loginError').style.color = '#16704a';
        $('#loginError').textContent = 'Пароль изменён. Войдите с новым паролем.';
      } catch (err) {
        status.textContent = err.message || 'Не удалось изменить пароль.';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Сохранить новый пароль';
      }
    });

    $('#changePasswordBtn').addEventListener('click', () => {
      $('#changePasswordForm').reset();
      $('#changePasswordStatus').textContent = '';
      $('#passwordModal').classList.remove('hidden');
    });
    $$('[data-close-password]').forEach(el => el.addEventListener('click', () => $('#passwordModal').classList.add('hidden')));
    $('#changePasswordForm').addEventListener('submit', async e => {
      e.preventDefault();
      const current = $('#currentPassword').value;
      const next = $('#newPassword').value;
      const repeat = $('#newPasswordRepeat').value;
      const status = $('#changePasswordStatus');
      status.textContent = '';
      if (next.length < 8) { status.textContent = 'Новый пароль должен содержать минимум 8 символов.'; return; }
      if (next !== repeat) { status.textContent = 'Новые пароли не совпадают.'; return; }
      const email = state.session?.user?.email || $('#adminEmail').textContent.trim();
      if (!email) { status.textContent = 'Не удалось определить e-mail администратора.'; return; }
      const btn = $('#changePasswordSubmit');
      btn.disabled = true;
      btn.textContent = 'Сохраняем…';
      try {
        await signIn(email, current);
        await updatePassword(next);
        $('#passwordModal').classList.add('hidden');
        toast('Пароль изменён');
      } catch (err) {
        status.textContent = err.message || 'Не удалось изменить пароль.';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Изменить пароль';
      }
    });

    $('#logoutBtn').addEventListener('click', () => { localStorage.removeItem(SESSION_KEY); state.session = null; location.reload(); });
    $('#searchInput').addEventListener('input', renderTable);
    $('#kindFilter').addEventListener('change', renderTable);
    $('#statusFilter').addEventListener('change', renderTable);
    $('#addBtn').addEventListener('click', () => openEditor());
    $('#bulkBtn').addEventListener('click', openBulk);
    $('#bulkNav').addEventListener('click', openBulk);
    document.addEventListener('click', e => {
      const edit = e.target.closest('[data-edit-key]'); if (edit) openEditor(edit.dataset.editKey);
      if (e.target.closest('[data-close-modal]')) closeEditor();
      if (e.target.closest('[data-close-bulk]')) closeBulk();
      const rm = e.target.closest('[data-image-remove]'); if (rm) {
        const index = Number(rm.dataset.imageRemove);
        const src = state.editImages[index];
        if (src) {
          state.editImages.splice(index, 1);
          for (const [color, url] of Object.entries(state.editColorImages || {})) {
            if (url === src) delete state.editColorImages[color];
          }
        }
        renderImages();
        renderColorImageBindings();
      }
      const colorUploadTrigger = e.target.closest('[data-color-image-upload-trigger]'); if (colorUploadTrigger) {
        const color = String(colorUploadTrigger.dataset.colorImageUploadTrigger || '').trim();
        const input = $$('[data-color-image-upload]').find(el => String(el.dataset.colorImageUpload || '').trim() === color);
        if (input) input.click();
      }
      const colorRm = e.target.closest('[data-color-image-remove]'); if (colorRm) {
        const color = String(colorRm.dataset.colorImageRemove || '').trim();
        const src = state.editColorImages[color] || '';
        if (color) delete state.editColorImages[color];
        if (src) {
          state.editImages = state.editImages.filter(url => url !== src);
          for (const [otherColor, url] of Object.entries(state.editColorImages || {})) {
            if (url === src) delete state.editColorImages[otherColor];
          }
        }
        renderImages();
        renderColorImageBindings();
        toast(color ? `Фото для цвета «${color}» удалено из карточки` : 'Фото удалено из карточки');
      }
      const main = e.target.closest('[data-image-main]'); if (main) { const i=Number(main.dataset.imageMain); if(i>0){const [src]=state.editImages.splice(i,1);state.editImages.unshift(src);renderImages();renderColorImageBindings();} }
      const vrm = e.target.closest('[data-v-remove]'); if (vrm) { syncVariantsFromDom(); state.editVariants.splice(Number(vrm.dataset.vRemove),1); renderVariants(); }
    });
    document.addEventListener('input', e => {
      const input = e.target.closest('[data-v-color]');
      if (!input) return;
      const previous = String(input.dataset.prevColor || '').trim();
      const next = input.value.trim();
      if (previous && next && previous !== next && state.editColorImages[previous] && !state.editColorImages[next]) {
        state.editColorImages[next] = state.editColorImages[previous];
        delete state.editColorImages[previous];
      }
      input.dataset.prevColor = next;
      renderColorImageBindings();
    });
    document.addEventListener('change', async e => {
      const uploadInput = e.target.closest('[data-color-image-upload]');
      if (uploadInput) {
        const color = String(uploadInput.dataset.colorImageUpload || '').trim();
        const file = uploadInput.files?.[0];
        if (!file) return;
        const trigger = $$('[data-color-image-upload-trigger]').find(el => String(el.dataset.colorImageUploadTrigger || '').trim() === color);
        if (trigger) { trigger.disabled = true; trigger.textContent = 'Обрабатываем…'; }
        try {
          await uploadColorImage(color, file);
        } catch (err) {
          console.error(err);
          toast(err.message || 'Не удалось загрузить фото для цвета', true);
        } finally {
          uploadInput.value = '';
          renderColorImageBindings();
        }
        return;
      }
      const select = e.target.closest('[data-color-image-select]');
      if (!select) return;
      const color = String(select.dataset.colorImageSelect || '').trim();
      if (select.value) state.editColorImages[color] = select.value;
      else delete state.editColorImages[color];
      renderColorImageBindings();
    });
    $('#editorForm').addEventListener('submit', saveEditor);
    $('#editKind').addEventListener('change', e => setEditorMode(e.target.value));
    $('#addVariant').addEventListener('click', () => { syncVariantsFromDom(); state.editVariants.push({size:'',color:'',price:Number($('#editPrice').value)||0,available:true}); renderVariants(); });
    $('#addImageUrl').addEventListener('click', () => { const u=$('#imageUrlInput').value.trim(); if(u){state.editImages.push(u);$('#imageUrlInput').value='';renderImages();renderColorImageBindings();} });
    $('#imageUploadButton')?.addEventListener('click', () => $('#imageUpload')?.click());
    $('#imageUpload').addEventListener('change', async e => {
      const input = e.target;
      const button = $('#imageUploadButton');
      const status = $('#imageUploadStatus');
      const files = [...input.files];
      if (!files.length) return;
      if (button) { button.disabled = true; button.textContent = 'Обрабатываем…'; }
      if (status) { status.className = 'upload-status'; status.textContent = 'Подготавливаем фото…'; }
      try {
        await uploadImages(files);
        if (status) { status.className = 'upload-status success'; status.textContent = 'Фото загружено. Не забудьте нажать «Сохранить» в карточке.'; }
      } catch(err) {
        console.error(err);
        if (status) { status.className = 'upload-status error'; status.textContent = err.message || 'Не удалось загрузить фото'; }
        toast(err.message || 'Не удалось загрузить фото',true);
      } finally {
        input.value='';
        if (button) { button.disabled = false; button.textContent = '+ Загрузить фото'; }
      }
    });
    $('#resetOverrideBtn').addEventListener('click', resetCurrentOverride);
    ['bulkScope','bulkSign','bulkPercent','bulkRound','bulkRoundMode'].forEach(id => $('#'+id).addEventListener(id==='bulkPercent'?'input':'change', renderBulkPreview));
    $('#applyBulkBtn').addEventListener('click', applyBulk);
  }

  async function init() {
    bind();
    if (!configured()) {
      $('#setupScreen').classList.remove('hidden');
      return;
    }
    if (adoptRecoverySession()) {
      $('#loginScreen').classList.add('hidden');
      $('#recoveryScreen').classList.remove('hidden');
      return;
    }
    restoreSession();
    if (!state.session) {
      $('#loginScreen').classList.remove('hidden');
      return;
    }
    try {
      if (state.session.refresh_token) await refreshSession();
      await enterApp();
    } catch (err) {
      console.error(err);
      localStorage.removeItem(SESSION_KEY);
      state.session = null;
      $('#app').classList.add('hidden');
      $('#loginScreen').classList.remove('hidden');
      $('#loginError').textContent = 'Сессия истекла. Войдите снова.';
    }
  }

  init();
})();
