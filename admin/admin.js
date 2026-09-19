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
    editVariants: []
  };

  const configured = () => Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
  const baseUrl = () => String(cfg.supabaseUrl || '').replace(/\/$/, '');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rub = n => Number(n) > 0 ? `${Math.round(Number(n)).toLocaleString('ru-RU')} ₽` : '—';
  const deepEqual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const clone = obj => JSON.parse(JSON.stringify(obj ?? {}));
  const uniq = list => [...new Set((list || []).filter(Boolean).map(v => String(v).trim()).filter(Boolean))];
  const keyFor = (kind, p) => kind === 'furniture' ? `furniture:${p.id}` : `mattress:${p.model}`;

  function toast(message, error = false) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.toggle('error', error);
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  function authHeaders(extra = {}, token = null) {
    return {
      apikey: cfg.supabaseAnonKey,
      Authorization: `Bearer ${token || state.session?.access_token || cfg.supabaseAnonKey}`,
      ...extra
    };
  }

  async function request(path, options = {}) {
    const r = await fetch(`${baseUrl()}${path}`, {
      ...options,
      headers: authHeaders(options.headers || {})
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      if (r.status === 401) {
        localStorage.removeItem(SESSION_KEY);
      }
      throw new Error(text || `HTTP ${r.status}`);
    }
    if (r.status === 204 || options.headers?.Prefer?.includes('return=minimal')) return null;
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  }

  async function signIn(email, password) {
    const r = await fetch(`${baseUrl()}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: authHeaders({'Content-Type':'application/json'}, cfg.supabaseAnonKey),
      body: JSON.stringify({email, password})
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.access_token) throw new Error(data.error_description || data.msg || 'Не удалось войти');
    state.session = data;
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    return data;
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
    return Array.isArray(item.images) && item.images[0] ? item.images[0] : '';
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
    $('#imageGrid').innerHTML = state.editImages.length ? state.editImages.map((src,i) => `<div class="image-item"><img src="${esc(src)}" alt=""><div class="image-actions"><button type="button" data-image-main="${i}">${i===0?'Главное':'Сделать главным'}</button><button type="button" data-image-remove="${i}">Удалить</button></div></div>`).join('') : '<div class="loading-row">Фотографии не добавлены</div>';
  }

  function renderVariants() {
    $('#variantRows').innerHTML = state.editVariants.map((v,i) => `<div class="variant-row" data-variant-index="${i}"><input data-v-size value="${esc(v.size || '')}" placeholder="1600×2000"><input data-v-color value="${esc(v.color || '')}" placeholder="Цвет"><input data-v-price type="number" min="0" step="1" value="${Number(v.price)||0}"><button type="button" class="variant-remove" data-v-remove="${i}">×</button></div>`).join('');
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
      specs: textToSpecs($('#editSpecs').value),
      available: $('#editAvailable').checked,
      hit: $('#editHit').checked
    };
  }

  function diffPayload(base, edited, kind) {
    const fields = kind === 'mattress'
      ? ['model','category','intro','description','images','variants']
      : ['category','title','subtype','summary','description','price','images','variants','sizes','colors','specs','available','hit'];
    const out = {};
    for (const field of fields) if (!deepEqual(base?.[field], edited?.[field])) out[field] = clone(edited[field]);
    return out;
  }

  async function upsertRows(rows) {
    if (!rows.length) return;
    await request('/rest/v1/catalog_overrides?on_conflict=product_key', {
      method:'POST',
      headers:{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify(rows)
    });
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
      await reloadData();
      closeEditor();
      toast(item?._isCustom ? 'Товар удалён' : 'Изменения сброшены');
    } catch (err) { toast(err.message, true); }
  }

  function safeSegment(value) {
    return String(value || 'product').toLowerCase().replace(/[^a-zа-я0-9._-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,80) || 'product';
  }

  async function uploadImages(files) {
    if (!files?.length) return;
    const key = $('#editKey').value || `new-${Date.now()}`;
    const bucket = cfg.storageBucket || 'product-images';
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const name = `${Date.now()}-${safeSegment(file.name)}`;
      const path = `products/${safeSegment(key)}/${name}`;
      const encoded = path.split('/').map(encodeURIComponent).join('/');
      const r = await fetch(`${baseUrl()}/storage/v1/object/${encodeURIComponent(bucket)}/${encoded}`, {
        method:'POST',
        headers:authHeaders({'Content-Type':file.type,'x-upsert':'true'}),
        body:file
      });
      if (!r.ok) throw new Error(`Не удалось загрузить ${file.name}`);
      state.editImages.push(`${baseUrl()}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encoded}`);
    }
    renderImages();
    toast('Фотографии загружены');
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

  async function reloadData() {
    await loadOverrides();
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
    $('#logoutBtn').addEventListener('click', () => { localStorage.removeItem(SESSION_KEY); location.reload(); });
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
      const rm = e.target.closest('[data-image-remove]'); if (rm) { state.editImages.splice(Number(rm.dataset.imageRemove),1); renderImages(); }
      const main = e.target.closest('[data-image-main]'); if (main) { const i=Number(main.dataset.imageMain); if(i>0){const [src]=state.editImages.splice(i,1);state.editImages.unshift(src);renderImages();} }
      const vrm = e.target.closest('[data-v-remove]'); if (vrm) { syncVariantsFromDom(); state.editVariants.splice(Number(vrm.dataset.vRemove),1); renderVariants(); }
    });
    $('#editorForm').addEventListener('submit', saveEditor);
    $('#editKind').addEventListener('change', e => setEditorMode(e.target.value));
    $('#addVariant').addEventListener('click', () => { syncVariantsFromDom(); state.editVariants.push({size:'',color:'',price:Number($('#editPrice').value)||0,available:true}); renderVariants(); });
    $('#addImageUrl').addEventListener('click', () => { const u=$('#imageUrlInput').value.trim(); if(u){state.editImages.push(u);$('#imageUrlInput').value='';renderImages();} });
    $('#imageUpload').addEventListener('change', async e => { try { await uploadImages([...e.target.files]); e.target.value=''; } catch(err){toast(err.message,true);} });
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
    restoreSession();
    if (!state.session) {
      $('#loginScreen').classList.remove('hidden');
      return;
    }
    await enterApp();
  }

  init();
})();
