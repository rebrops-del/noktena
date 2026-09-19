from pathlib import Path
import re

p = Path('admin/admin.js')
s = p.read_text(encoding='utf-8')
start = s.index('  async function uploadSingleImage(')
end = s.index('  async function uploadImages(', start)
new = r'''  async function uploadSingleImage(file, color = '', retried = false) {
    if (!state.session?.access_token) throw new Error('Сессия администратора не найдена. Войдите заново.');
    if (!isImageFile(file)) throw new Error('Выберите файл изображения: JPG, PNG, WEBP, GIF, AVIF, HEIC или HEIF.');
    if (Number(file.size || 0) > 15 * 1024 * 1024) throw new Error('Файл слишком большой. Максимальный размер — 15 МБ.');

    const productKey = $('#editKey').value || $('#editName').value.trim() || `new-${Date.now()}`;
    const form = new FormData();
    form.append('access_token', state.session.access_token);
    form.append('product_key', productKey);
    form.append('color', String(color || ''));
    form.append('file', file, file.name || `image.${uploadExtension(file)}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    let r;
    try {
      // Intentionally do not add Authorization/apikey/Content-Type headers here.
      // A plain multipart request is CORS-safelisted and does not require a preflight request.
      r = await fetch(`${baseUrl()}/functions/v1/admin-upload-image`, {
        method:'POST',
        body:form,
        signal:controller.signal,
        cache:'no-store'
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err?.name === 'AbortError') throw new Error('Загрузка заняла больше 90 секунд и была остановлена.');
      throw new Error(`Не удалось отправить фото: ${err?.message || err}`);
    }
    clearTimeout(timeout);

    const raw = await r.text().catch(() => '');
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}

    if (r.status === 401 && !retried && state.session?.refresh_token) {
      await refreshSession();
      return uploadSingleImage(file, color, true);
    }

    if (!r.ok || !data?.url) {
      const labels = {
        unauthorized:'Сервер не получил сессию администратора. Выйдите из админки и войдите снова.',
        invalid_session:'Сессия истекла. Выйдите из админки и войдите снова.',
        forbidden:'У этой учётной записи нет прав администратора.',
        file_missing:'Сервер не получил выбранный файл.',
        invalid_file_type:'Этот формат изображения не поддерживается.',
        file_too_large:'Файл слишком большой. Максимальный размер — 15 МБ.',
        upload_failed:`Storage отклонил файл: ${data?.detail || 'неизвестная ошибка'}`,
        server_not_configured:'Сервер загрузки не настроен.'
      };
      const detail = data?.detail || data?.message || data?.error || raw || `HTTP ${r.status}`;
      throw new Error(labels[data?.error] || `Не удалось загрузить «${file.name}»: ${detail}`);
    }

    return data.url;
  }

'''
s = s[:start] + new + s[end:]
p.write_text(s, encoding='utf-8')

h = Path('admin/index.html')
html = h.read_text(encoding='utf-8')
html = re.sub(r'admin\.js\?v=[^"\']+', 'admin.js?v=20260919-photo-simple1', html)
h.write_text(html, encoding='utf-8')
