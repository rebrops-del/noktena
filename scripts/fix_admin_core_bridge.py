from pathlib import Path
import re

p = Path('admin/admin.js')
s = p.read_text(encoding='utf-8')

old = "    $('#editPrice').value = Number(item.price) || minPrice(item) || '';"
new = "    $('#editPrice').value = Number(item.price) || minPrice(item) || '';\n    $('#editPrice').dataset.originalPrice = String(Number(item.price) || minPrice(item) || 0);"
if old not in s:
    raise SystemExit('editPrice marker not found')
s = s.replace(old, new, 1)

old = "    if (price > 0 && variants.length && variants.every(v => !Number(v.price))) variants.forEach(v => v.price = price);"
new = "    const originalPrice = Number($('#editPrice').dataset.originalPrice) || 0;\n    const basePriceChanged = price > 0 && price !== originalPrice;\n    if (price > 0 && variants.length && (basePriceChanged || variants.every(v => !Number(v.price)))) variants.forEach(v => v.price = price);"
if old not in s:
    raise SystemExit('price propagation marker not found')
s = s.replace(old, new, 1)

bridge_block = r'''
  const ADMIN_BRIDGE_URL = `${baseUrl()}/functions/v1/noktena-admin-bridge`;
  const bridgePending = new Map();

  window.addEventListener('message', e => {
    const data = e.data;
    if (!data || data.type !== 'noktena-admin-bridge' || !data.request_id) return;
    const pending = bridgePending.get(data.request_id);
    if (!pending) return;
    bridgePending.delete(data.request_id);
    clearTimeout(pending.timer);
    try { pending.form.remove(); } catch (_) {}
    try { pending.iframe.remove(); } catch (_) {}
    if (data.ok) pending.resolve(data);
    else pending.reject(new Error(data.error || 'Сервер не выполнил операцию'));
  });

  function bridgePost(fields, timeoutMs = 45000) {
    return new Promise((resolve, reject) => {
      if (!state.session?.access_token) return reject(new Error('Сессия администратора не найдена. Войдите заново.'));
      const requestId = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
      const frameName = `noktena_bridge_${requestId.replace(/[^a-z0-9]/gi,'')}`;
      const iframe = document.createElement('iframe');
      iframe.name = frameName;
      iframe.hidden = true;
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = ADMIN_BRIDGE_URL;
      form.target = frameName;
      form.enctype = 'application/x-www-form-urlencoded';
      form.style.display = 'none';
      const all = {...fields, request_id: requestId, access_token: state.session.access_token};
      for (const [name, value] of Object.entries(all)) {
        const input = document.createElement('textarea');
        input.name = name;
        input.value = String(value ?? '');
        form.appendChild(input);
      }
      document.body.appendChild(iframe);
      document.body.appendChild(form);
      const timer = setTimeout(() => {
        bridgePending.delete(requestId);
        try { form.remove(); } catch (_) {}
        try { iframe.remove(); } catch (_) {}
        reject(new Error('Сервер не ответил на загрузку фото.'));
      }, timeoutMs);
      bridgePending.set(requestId, {resolve, reject, timer, form, iframe});
      form.submit();
    });
  }

  function fileToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => reject(new Error('Не удалось прочитать изображение'));
      r.readAsDataURL(blob);
    });
  }

  function canvasToBlob(canvas, quality) {
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  }

  async function preparePhotoForBridge(file) {
    if (!file || !String(file.type || '').startsWith('image/')) throw new Error('Выберите изображение JPG, PNG или WEBP.');
    if (file.size > 25 * 1024 * 1024) throw new Error('Фото больше 25 МБ.');
    let bitmap;
    try { bitmap = await createImageBitmap(file); }
    catch (_) {
      if (file.size <= 250 * 1024) return await fileToDataUrl(file);
      throw new Error('Не удалось обработать изображение. Сохраните его как JPG и попробуйте снова.');
    }
    const attempts = [[1600,.78],[1400,.72],[1200,.68],[1000,.62],[850,.58]];
    let dataUrl = '';
    for (const [maxSide, quality] of attempts) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d', {alpha:false});
      ctx.fillStyle = '#fff'; ctx.fillRect(0,0,w,h); ctx.drawImage(bitmap,0,0,w,h);
      const blob = await canvasToBlob(canvas, quality);
      if (!blob) continue;
      dataUrl = await fileToDataUrl(blob);
      if (dataUrl.length <= 430000) break;
    }
    try { bitmap.close(); } catch (_) {}
    if (!dataUrl || dataUrl.length > 480000) throw new Error('Фото слишком большое даже после оптимизации.');
    return dataUrl;
  }

  async function uploadImages(files, color = '') {
    if (!files?.length) return [];
    const uploaded = [];
    const productKey = $('#editKey').value || $('#editName').value.trim() || `new-${Date.now()}`;
    for (const file of files) {
      const dataUrl = await preparePhotoForBridge(file);
      const result = await bridgePost({action:'save_image', product_key:productKey, data_url:dataUrl});
      if (!result.url) throw new Error('Сервер не вернул адрес загруженного фото.');
      const url = result.url;
      if (color) state.editColorImages[color] = url;
      else if (!state.editImages.includes(url)) state.editImages.push(url);
      uploaded.push(url);
      renderImages();
      renderColorImageBindings();
    }
    toast(color ? `Фото для цвета «${color}» загружено` : 'Фотография загружена');
    return uploaded;
  }
'''

pattern = re.compile(r"\n  function safeSegment\(value\) \{.*?\n  function priceTransform\(value\) \{", re.S)
m = pattern.search(s)
if not m:
    raise SystemExit('upload block not found')
s = s[:m.start()] + '\n' + bridge_block + '\n  function priceTransform(value) {' + s[m.end():]

old_row = '''        <div class="color-image-meta"><b>${esc(color)}</b><small>Фото при выборе этого цвета</small></div>
        <select data-color-image-select="${esc(color)}">${options}</select>
      </div>`;'''
new_row = '''        <div class="color-image-meta"><b>${esc(color)}</b><small>Фото при выборе этого цвета</small></div>
        <div class="color-image-controls">
          <select data-color-image-select="${esc(color)}">${options}</select>
          <button type="button" class="secondary-btn" data-color-upload-trigger="${esc(color)}">+ Загрузить фото</button>
          <input type="file" accept="image/jpeg,image/png,image/webp" data-color-upload="${esc(color)}" hidden>
          ${selected ? `<button type="button" class="danger-link" data-color-image-remove="${esc(color)}">Удалить фото</button>` : ''}
        </div>
      </div>`;'''
if old_row not in s:
    raise SystemExit('color row marker not found')
s = s.replace(old_row, new_row, 1)

old_click = "      const vrm = e.target.closest('[data-v-remove]'); if (vrm) { syncVariantsFromDom(); state.editVariants.splice(Number(vrm.dataset.vRemove),1); renderVariants(); }"
new_click = old_click + "\n      const colorUpload = e.target.closest('[data-color-upload-trigger]'); if (colorUpload) { const color=colorUpload.dataset.colorUploadTrigger; const input=[...document.querySelectorAll('[data-color-upload]')].find(x=>x.dataset.colorUpload===color); if(input) input.click(); }\n      const colorRemove = e.target.closest('[data-color-image-remove]'); if (colorRemove) { const color=String(colorRemove.dataset.colorImageRemove||''); const src=state.editColorImages[color]; delete state.editColorImages[color]; if(src){ state.editImages=state.editImages.filter(x=>x!==src); for(const [c,u] of Object.entries(state.editColorImages)){ if(u===src) delete state.editColorImages[c]; } } renderImages(); renderColorImageBindings(); }"
if old_click not in s:
    raise SystemExit('click marker not found')
s = s.replace(old_click, new_click, 1)

old_change = "    document.addEventListener('change', e => {\n      const select = e.target.closest('[data-color-image-select]');"
new_change = "    document.addEventListener('change', async e => {\n      const colorFile = e.target.closest('[data-color-upload]');\n      if (colorFile) {\n        const color = String(colorFile.dataset.colorUpload || '').trim();\n        const file = colorFile.files?.[0];\n        colorFile.value = '';\n        if (file) { try { await uploadImages([file], color); } catch (err) { toast(err.message || 'Не удалось загрузить фото', true); } }\n        return;\n      }\n      const select = e.target.closest('[data-color-image-select]');"
if old_change not in s:
    raise SystemExit('change marker not found')
s = s.replace(old_change, new_change, 1)

p.write_text(s, encoding='utf-8')

ip = Path('admin/index.html')
html = ip.read_text(encoding='utf-8')
html = re.sub(r'admin\.js\?v=[^"\']+', 'admin.js?v=20260919-corebridge1', html)
ip.write_text(html, encoding='utf-8')
print('patched')
