from pathlib import Path
import re

p = Path('admin/admin.js')
s = p.read_text(encoding='utf-8')
start = s.index('  async function uploadSingleImage(')
end = s.index('  async function uploadImages(', start)
new = r'''  function nativeUploadResultError(data, file) {
    const labels = {
      unauthorized:'Сервер не получил сессию администратора. Выйдите из админки и войдите снова.',
      invalid_session:'Сессия истекла. Выйдите из админки и войдите снова.',
      forbidden:'У этой учётной записи нет прав администратора.',
      file_missing:'Сервер не получил выбранный файл.',
      invalid_file_type:'Этот формат изображения не поддерживается.',
      file_too_large:'Файл слишком большой. Максимальный размер — 15 МБ.',
      upload_failed:`Storage отклонил файл: ${data?.detail || 'неизвестная ошибка'}`,
      server_not_configured:'Сервер загрузки не настроен.',
      admin_check_failed:`Не удалось проверить права администратора: ${data?.detail || 'неизвестная ошибка'}`,
      unexpected_error:`Ошибка сервера загрузки: ${data?.detail || 'неизвестная ошибка'}`
    };
    return new Error(labels[data?.error] || `Не удалось загрузить «${file.name}»${data?.detail ? `: ${data.detail}` : ''}`);
  }

  async function submitUploadWithNativeForm(file, productKey, color) {
    if (typeof DataTransfer === 'undefined') throw new Error('Этот браузер не поддерживает безопасную загрузку файлов. Обновите браузер.');

    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const frameName = `noktena-upload-${nonce.replace(/[^a-z0-9-]/gi,'')}`;
    const iframe = document.createElement('iframe');
    iframe.name = frameName;
    iframe.style.display = 'none';
    iframe.setAttribute('aria-hidden', 'true');

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = `${baseUrl()}/functions/v1/admin-upload-image`;
    form.target = frameName;
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
    addHidden('return_url', `${location.origin}/admin/upload-callback.html`);
    addHidden('nonce', nonce);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.name = 'file';
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    form.appendChild(fileInput);

    document.body.appendChild(iframe);
    document.body.appendChild(form);

    return await new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        window.removeEventListener('message', onMessage);
        clearTimeout(timer);
        setTimeout(() => {
          try { form.remove(); } catch (_) {}
          try { iframe.remove(); } catch (_) {}
        }, 0);
      };
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        fn(value);
      };
      const onMessage = event => {
        if (event.origin !== location.origin) return;
        const data = event.data || {};
        if (data.type !== 'noktena-upload-result' || data.nonce !== nonce) return;
        if (data.ok && data.url) finish(resolve, data);
        else finish(reject, nativeUploadResultError(data, file));
      };
      window.addEventListener('message', onMessage);
      const timer = setTimeout(() => finish(reject, new Error('Сервер не вернул результат загрузки за 120 секунд.')), 120000);
      try {
        form.submit();
      } catch (err) {
        finish(reject, new Error(`Браузер не смог отправить форму загрузки: ${err?.message || err}`));
      }
    });
  }

  async function uploadSingleImage(file, color = '', retried = false) {
    if (!state.session?.access_token) throw new Error('Сессия администратора не найдена. Войдите заново.');
    if (!isImageFile(file)) throw new Error('Выберите файл изображения: JPG, PNG, WEBP, GIF, AVIF, HEIC или HEIF.');
    if (Number(file.size || 0) > 15 * 1024 * 1024) throw new Error('Файл слишком большой. Максимальный размер — 15 МБ.');

    const productKey = $('#editKey').value || $('#editName').value.trim() || `new-${Date.now()}`;
    try {
      const result = await submitUploadWithNativeForm(file, productKey, color);
      return result.url;
    } catch (err) {
      if (!retried && /Сессия истекла/.test(String(err?.message || '')) && state.session?.refresh_token) {
        await refreshSession();
        return uploadSingleImage(file, color, true);
      }
      throw err;
    }
  }

'''
s = s[:start] + new + s[end:]
p.write_text(s, encoding='utf-8')

h = Path('admin/index.html')
html = h.read_text(encoding='utf-8')
html = re.sub(r'admin\.js\?v=[^"\']+', 'admin.js?v=20260919-photo-native1', html)
h.write_text(html, encoding='utf-8')
