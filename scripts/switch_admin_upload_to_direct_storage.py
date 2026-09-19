from pathlib import Path
import re

p = Path('admin/admin.js')
s = p.read_text(encoding='utf-8')
start = s.index('  async function uploadSingleImage(')
end = s.index('  async function uploadImages(', start)
new = r'''  async function uploadSingleImage(file, color = '', retried = false) {
    if (!state.session?.access_token) throw new Error('Сессия администратора не найдена. Войдите заново.');
    if (!isImageFile(file)) throw new Error('Выберите файл изображения: JPG, PNG, WEBP, GIF, AVIF, HEIC или HEIF.');
    if (Number(file.size || 0) > 25 * 1024 * 1024) throw new Error('Файл слишком большой. Максимальный размер — 25 МБ.');

    const bucket = cfg.storageBucket || 'product-images';
    const productKey = $('#editKey').value || $('#editName').value.trim() || `new-${Date.now()}`;
    const productFolder = asciiProductFolder(productKey);
    const colorFolder = color ? `/colors/${asciiProductFolder(String(color))}` : '';
    const ext = uploadExtension(file);
    const randomPart = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)).replace(/[^a-z0-9-]/gi, '');
    const path = `products/${productFolder}${colorFolder}/${Date.now()}-${randomPart}.${ext}`;
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    let r;
    try {
      r = await fetch(`${baseUrl()}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`, {
        method:'POST',
        headers:{
          apikey:cfg.supabaseAnonKey,
          Authorization:`Bearer ${state.session.access_token}`,
          'Content-Type':file.type || 'application/octet-stream',
          'x-upsert':'false'
        },
        body:file,
        signal:controller.signal
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err?.name === 'AbortError') throw new Error('Прямая загрузка фото в хранилище заняла больше 60 секунд и была остановлена.');
      throw new Error(`Не удалось связаться с хранилищем: ${err?.message || err}`);
    }
    clearTimeout(timeout);

    if (r.status === 401 && !retried && state.session?.refresh_token) {
      await refreshSession();
      return uploadSingleImage(file, color, true);
    }

    if (!r.ok) {
      const raw = await r.text().catch(() => '');
      let detail = raw;
      try {
        const parsed = JSON.parse(raw);
        detail = parsed.message || parsed.error || parsed.statusCode || raw;
      } catch (_) {}
      if (r.status === 403) throw new Error('Supabase отклонил загрузку: у текущей учётной записи нет права записи в хранилище.');
      throw new Error(`Storage отклонил «${file.name}»${detail ? `: ${detail}` : ` (HTTP ${r.status})`}`);
    }

    return `${baseUrl()}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`;
  }

'''
s = s[:start] + new + s[end:]
p.write_text(s, encoding='utf-8')

h = Path('admin/index.html')
html = h.read_text(encoding='utf-8')
html = re.sub(r'admin\.js\?v=[^"\']+', 'admin.js?v=20260919-photo-direct1', html)
h.write_text(html, encoding='utf-8')
