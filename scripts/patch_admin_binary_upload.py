from pathlib import Path
import re

p = Path('admin/admin.js')
s = p.read_text(encoding='utf-8')
start = s.index('  async function uploadSingleImage(')
end = s.index('  async function uploadImages(', start)
new = """  async function uploadSingleImage(file, color = '', retried = false) {
    if (!state.session?.access_token) throw new Error('Сессия администратора не найдена. Войдите заново.');
    if (!isImageFile(file)) throw new Error('Выберите файл изображения: JPG, PNG, WEBP, GIF, AVIF, HEIC или HEIF.');

    const productKey = $('#editKey').value || $('#editName').value.trim() || `new-${Date.now()}`;
    const params = new URLSearchParams({ productKey, filename: file.name || 'image' });
    if (color) params.set('color', String(color));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let r;
    try {
      r = await fetch(`${baseUrl()}/functions/v1/admin-upload-image?${params.toString()}`, {
        method:'POST',
        headers:{
          Authorization:`Bearer ${state.session.access_token}`,
          'Content-Type':file.type || 'application/octet-stream'
        },
        body:file,
        signal:controller.signal
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err?.name === 'AbortError') throw new Error('Загрузка заняла больше 30 секунд и была остановлена. Попробуйте файл меньшего размера.');
      throw new Error(`Не удалось связаться с сервером загрузки: ${err?.message || err}`);
    }
    clearTimeout(timeout);

    if (r.status === 401 && !retried && state.session?.refresh_token) {
      await refreshSession();
      return uploadSingleImage(file, color, true);
    }

    const raw = await r.text().catch(() => '');
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}

    if (!r.ok || !data?.url) {
      const detail = data?.detail || data?.message || data?.error || raw || `HTTP ${r.status}`;
      const labels = {
        unauthorized:'Сервер не получил авторизацию. Выйдите из админки и войдите снова.',
        invalid_session:'Сессия истекла. Выйдите из админки и войдите снова.',
        forbidden:'У этой учётной записи нет прав администратора.',
        origin_not_allowed:'Домен админ-панели не разрешён сервером загрузки.',
        server_not_configured:'Сервер загрузки не настроен.',
        file_too_large:'Файл слишком большой. Максимальный размер — 25 МБ.',
        empty_file:'Выбран пустой файл.',
        upload_failed:`Storage отклонил файл: ${data?.detail || 'неизвестная ошибка'}`,
        public_url_failed:'Файл записан, но сервер не смог получить публичную ссылку.'
      };
      throw new Error(labels[data?.error] || `Не удалось загрузить «${file.name}»: ${detail}`);
    }
    return data.url;
  }

"""
s = s[:start] + new + s[end:]
p.write_text(s, encoding='utf-8')

h = Path('admin/index.html')
html = h.read_text(encoding='utf-8')
html = re.sub(r'admin\.js\?v=[^"\']+', 'admin.js?v=20260919-photo-binary1', html)
h.write_text(html, encoding='utf-8')
