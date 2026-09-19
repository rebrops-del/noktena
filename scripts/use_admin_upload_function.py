from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'{label}: target not found')
    if text.count(old) != 1:
        raise SystemExit(f'{label}: expected one target, found {text.count(old)}')
    return text.replace(old, new, 1)

p = Path('admin/admin.js')
s = p.read_text(encoding='utf-8')

old = '''  async function uploadSingleImage(file, folderSuffix = '') {\n    if (!state.session?.access_token) throw new Error('Сессия администратора не найдена. Войдите заново.');\n    if (!isImageFile(file)) throw new Error('Выберите файл изображения: JPG, PNG, WEBP, GIF, AVIF, HEIC или HEIF.');\n    const key = $('#editKey').value || `new-${Date.now()}`;\n    const bucket = cfg.storageBucket || 'product-images';\n    const ext = uploadExtension(file);\n    const random = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)).replace(/[^a-z0-9-]/gi, '');\n    const name = `${Date.now()}-${random}.${ext}`;\n    const suffix = folderSuffix ? `/${folderSuffix}` : '';\n    const path = `products/${asciiProductFolder(key)}${suffix}/${name}`;\n    const encoded = path.split('/').map(encodeURIComponent).join('/');\n    await uploadStorageObject(file, bucket, encoded);\n    return publicStorageUrl(bucket, encoded);\n  }'''

new = '''  async function uploadSingleImage(file, color = '', retried = false) {\n    if (!state.session?.access_token) throw new Error('Сессия администратора не найдена. Войдите заново.');\n    if (!isImageFile(file)) throw new Error('Выберите файл изображения: JPG, PNG, WEBP, GIF, AVIF, HEIC или HEIF.');\n    const form = new FormData();\n    form.append('file', file, file.name || 'image');\n    form.append('productKey', $('#editKey').value || $('#editName').value.trim() || `new-${Date.now()}`);\n    if (color) form.append('color', String(color));\n\n    const r = await fetch(`${baseUrl()}/functions/v1/admin-upload-image`, {\n      method:'POST',\n      headers:authHeaders(),\n      body:form\n    });\n    if (r.status === 401 && !retried && state.session?.refresh_token) {\n      await refreshSession();\n      return uploadSingleImage(file, color, true);\n    }\n    const data = await r.json().catch(() => ({}));\n    if (!r.ok || !data?.url) {\n      const detail = data?.detail || data?.message || data?.error || `HTTP ${r.status}`;\n      const labels = {\n        invalid_session:'Сессия истекла. Войдите заново.',\n        forbidden:'У этой учётной записи нет прав администратора.',\n        file_too_large:'Файл слишком большой. Максимальный размер — 25 МБ.',\n        file_required:'Файл не получен сервером.',\n        empty_file:'Выбран пустой файл.'\n      };\n      throw new Error(labels[data?.error] || `Не удалось загрузить «${file.name}»: ${detail}`);\n    }\n    return data.url;\n  }'''

s = replace_once(s, old, new, 'uploadSingleImage')
s = s.replace("const url = await uploadSingleImage(file, `colors/${asciiProductFolder(color)}`);", "const url = await uploadSingleImage(file, color);")
p.write_text(s, encoding='utf-8')

p = Path('admin/index.html')
s = p.read_text(encoding='utf-8')
s = s.replace('admin.js?v=20260919-photoupload3', 'admin.js?v=20260919-photoupload4')
p.write_text(s, encoding='utf-8')
