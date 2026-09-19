from pathlib import Path
import re

p = Path('admin/admin.js')
s = p.read_text(encoding='utf-8')
start = s.index('  function uploadResultError(')
end = s.index('  async function uploadImages(', start)
new = r'''  function readBlobAsDataUrl(blob) {
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
      if (Number(file.size || 0) > 650 * 1024) throw new Error('Для GIF/HEIC/HEIF используйте файл до 650 КБ либо предварительно сохраните его как JPG/PNG/WEBP.');
      return readBlobAsDataUrl(file);
    }

    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch (_) {
      if (Number(file.size || 0) <= 650 * 1024) return readBlobAsDataUrl(file);
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

    let blob = await render(1800, 0.82);
    if (blob && blob.size > 620 * 1024) blob = await render(1500, 0.74);
    if (blob && blob.size > 620 * 1024) blob = await render(1250, 0.68);
    if (typeof bitmap.close === 'function') bitmap.close();
    if (!blob) throw new Error('Не удалось подготовить изображение. Попробуйте другой JPG или PNG.');
    if (blob.size > 700 * 1024) throw new Error('Фото после оптимизации всё ещё слишком большое. Используйте изображение меньшего разрешения.');

    return readBlobAsDataUrl(blob);
  }

  async function uploadSingleImage(file, color = '') {
    const dataUrl = await prepareInlineImage(file);
    if (!dataUrl.startsWith('data:image/')) throw new Error('Не удалось подготовить изображение.');
    return dataUrl;
  }

'''
s = s[:start] + new + s[end:]

# Disable stale full-page return handling in init/login paths.
s = s.replace('        await restoreUploadReturn();\n', '')
s = s.replace('      await restoreUploadReturn();\n', '')

# Update upload copy so it no longer suggests a network upload.
s = s.replace("status.textContent = `Загрузка: ${files.length} файл(а)…`;", "status.textContent = 'Подготавливаем фото…';")
s = s.replace("button.textContent = 'Загружаем…';", "button.textContent = 'Обрабатываем…';")
s = s.replace("trigger.textContent = 'Загружаем…';", "trigger.textContent = 'Обрабатываем…';")

p.write_text(s, encoding='utf-8')

h = Path('admin/index.html')
html = h.read_text(encoding='utf-8')
html = re.sub(r'admin\\.js\\?v=[^"\\']+', 'admin.js?v=20260919-photo-inline1', html)
h.write_text(html, encoding='utf-8')

# Fix public runtime: modern publishable key must not be sent as Bearer token.
r = Path('assets/catalog-runtime.js')
if r.exists():
    js = r.read_text(encoding='utf-8')
    js = re.sub(r"const headers = \\(\\) => \\({\\s*apikey: cfg\\.supabaseAnonKey,\\s*Authorization: `Bearer \\${cfg\\.supabaseAnonKey}`,\\s*Accept: 'application/json'\\s*}\\);",
                "const headers = () => ({\\n  apikey: cfg.supabaseAnonKey,\\n  Accept: 'application/json'\\n});", js)
    r.write_text(js, encoding='utf-8')

for page in ['index.html','product.html']:
    q = Path(page)
    if q.exists():
        text = q.read_text(encoding='utf-8')
        text = re.sub(r'assets/catalog-runtime\\.js\\?v=[^"\\']+', 'assets/catalog-runtime.js?v=20260919-inline1', text)
        q.write_text(text, encoding='utf-8')
