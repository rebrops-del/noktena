from pathlib import Path
import re

p = Path('admin/admin.js')
s = p.read_text(encoding='utf-8')

start = s.index('  function nativeUploadResultError(')
end = s.index('  async function uploadImages(', start)

new_upload = r'''  function uploadResultError(data, fileName = 'фото') {
    const labels = {
      unauthorized:'Сервер не получил сессию администратора. Выйдите из админки и войдите снова.',
      invalid_session:'Сессия истекла. Выйдите из админки и войдите снова.',
      forbidden:'У этой учётной записи нет прав администратора.',
      file_missing:'Сервер не получил выбранный файл.',
      invalid_file_type:'Этот формат изображения не поддерживается.',
      file_too_large:'Фото слишком большое даже после подготовки. Используйте файл до 8 МБ.',
      invalid_form:'Сервер не смог прочитать файл. Попробуйте другой JPG или PNG.',
      upload_failed:`Storage отклонил файл: ${data?.detail || 'неизвестная ошибка'}`,
      server_not_configured:'Сервер загрузки не настроен.',
      admin_check_failed:`Не удалось проверить права администратора: ${data?.detail || 'неизвестная ошибка'}`,
      unexpected_error:`Ошибка сервера загрузки: ${data?.detail || 'неизвестная ошибка'}`
    };
    return new Error(labels[data?.error] || `Не удалось загрузить «${fileName}»${data?.detail ? `: ${data.detail}` : ''}`);
  }

  async function prepareUploadFile(file) {
    if (!file) return file;
    const type = String(file.type || '').toLowerCase();
    const compressible = ['image/jpeg','image/png','image/webp'].includes(type);
    if (!compressible || Number(file.size || 0) <= 2.5 * 1024 * 1024) return file;

    try {
      const bitmap = await createImageBitmap(file);
      const maxSide = 2000;
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', {alpha:false});
      ctx.drawImage(bitmap, 0, 0, width, height);
      if (typeof bitmap.close === 'function') bitmap.close();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.86));
      if (!blob) return file;
      const base = String(file.name || 'photo').replace(/\.[^.]+$/, '') || 'photo';
      const prepared = new File([blob], `${base}.jpg`, {type:'image/jpeg', lastModified:Date.now()});
      return prepared.size < file.size ? prepared : file;
    } catch (_) {
      return file;
    }
  }

  function captureUploadDraft(color = '') {
    syncVariantsFromDom();
    syncColorImagesFromDom();
    const ids = ['editKey','editIsCustom','editKind','editCategory','editName','editPrice','editSubtype','editSummary','editDescription','editSpecs'];
    const fields = {};
    for (const id of ids) fields[id] = $('#'+id)?.value ?? '';
    return {
      fields,
      checks: {
        editAvailable:Boolean($('#editAvailable')?.checked),
        editHit:Boolean($('#editHit')?.checked),
        editHidden:Boolean($('#editHidden')?.checked)
      },
      images:[...state.editImages],
      variants:clone(state.editVariants),
      colorImages:clone(state.editColorImages),
      uploadColor:String(color || '')
    };
  }

  function uploadDraftKey(nonce) {
    return `noktena-admin-upload-draft-${nonce}`;
  }

  async function submitUploadWithFullPage(file, productKey, color = '') {
    if (typeof DataTransfer === 'undefined') throw new Error('Браузер не поддерживает отправку выбранного файла. Обновите браузер.');

    const prepared = await prepareUploadFile(file);
    if (Number(prepared?.size || 0) > 8 * 1024 * 1024) {
      throw new Error('Фото слишком большое. После автоматического уменьшения файл всё ещё больше 8 МБ.');
    }

    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const returnUrl = `${location.origin}/admin/?upload_return=1`;
    sessionStorage.setItem(uploadDraftKey(nonce), JSON.stringify(captureUploadDraft(color)));

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = `${baseUrl()}/functions/v1/admin-upload-image?return_url=${encodeURIComponent(returnUrl)}&nonce=${encodeURIComponent(nonce)}`;
    form.enctype = 'multipart/form-data';
    form.style.display = 'none';

    const addHidden = (name, value) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = String(value ?? '');
      form.appendChild(input);
    };
    addHidden('access_token', state.session.access_token);
    addHidden('product_key', productKey);
    addHidden('color', String(color || ''));
    addHidden('return_url', returnUrl);
    addHidden('nonce', nonce);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.name = 'file';
    const dt = new DataTransfer();
    dt.items.add(prepared);
    fileInput.files = dt.files;
    form.appendChild(fileInput);
    document.body.appendChild(form);

    form.submit();
    return await new Promise(() => {});
  }

  async function uploadSingleImage(file, color = '') {
    if (!state.session?.access_token) throw new Error('Сессия администратора не найдена. Войдите заново.');
    if (!isImageFile(file)) throw new Error('Выберите файл изображения: JPG, PNG, WEBP, GIF, AVIF, HEIC или HEIF.');
    if (Number(file.size || 0) > 25 * 1024 * 1024) throw new Error('Исходный файл слишком большой. Максимальный размер — 25 МБ.');
    const productKey = $('#editKey').value || $('#editName').value.trim() || `new-${Date.now()}`;
    return submitUploadWithFullPage(file, productKey, color);
  }

'''

s = s[:start] + new_upload + s[end:]

restore_helpers = r'''  async function restoreUploadReturn() {
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

'''
marker = '  async function reloadData() {'
if restore_helpers not in s:
    s = s.replace(marker, restore_helpers + marker, 1)

old_login = "        await signIn($('#loginEmail').value.trim(), $('#loginPassword').value);\n        await enterApp();"
new_login = old_login + "\n        await restoreUploadReturn();"
s = s.replace(old_login, new_login, 1)

old_init = "      await enterApp();\n    } catch (err) {"
new_init = "      await enterApp();\n      await restoreUploadReturn();\n    } catch (err) {"
s = s.replace(old_init, new_init, 1)

p.write_text(s, encoding='utf-8')

h = Path('admin/index.html')
html = h.read_text(encoding='utf-8')
html = html.replace(' multiple hidden', ' hidden')
html = re.sub(r'admin\.js\?v=[^"\']+', 'admin.js?v=20260919-photo-fullpage1', html)
h.write_text(html, encoding='utf-8')
