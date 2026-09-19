from pathlib import Path
import re

SHELL_URL = 'https://oldtlbkrftflfthfsqdv.supabase.co/functions/v1/noktena-admin'
PUBLIC_DATA_URL = SHELL_URL + '?public=1&v=20260919-sameorigin1'

# 1) Redirect the public /admin/ entry point to the same-origin Supabase admin shell.
p = Path('admin/index.html')
html = p.read_text(encoding='utf-8')
marker = '<meta name="robots" content="noindex,nofollow">'
redirect = marker + '\n<script>if(location.hostname==="noktena.ru"||location.hostname==="www.noktena.ru"){location.replace("' + SHELL_URL + '");}</script>'
if SHELL_URL not in html:
    if marker not in html:
        raise SystemExit('admin redirect marker not found')
    html = html.replace(marker, redirect, 1)
html = re.sub(r"admin\.js\?v=[^\"']+", 'admin.js?v=20260919-sameorigin1', html)
p.write_text(html, encoding='utf-8')

# 2) Recovery links must return to whichever admin shell is actually open.
p = Path('admin/admin.js')
js = p.read_text(encoding='utf-8')
old = "    const redirectTo = `${location.origin}/admin/`;"
new = "    const redirectTo = window.NOKTENA_ADMIN_SHELL_URL || `${location.origin}/admin/`;"
if old in js:
    js = js.replace(old, new, 1)
elif new not in js:
    raise SystemExit('recovery redirect marker not found')
p.write_text(js, encoding='utf-8')

# 3) Public storefront: prefer JavaScript bootstrap data loaded by a normal <script>,
#    avoiding cross-origin fetch/XHR to Supabase entirely.
p = Path('assets/catalog-runtime.js')
runtime = p.read_text(encoding='utf-8')
needle = "  async function fetchRows() {\n    if (!configured()) return [];\n    if (!rowsPromise) {"
replacement = """  async function fetchRows() {
    const bootstrap = window.NOKTENA_CATALOG_BOOTSTRAP;
    if (Array.isArray(bootstrap?.rows)) {
      if (!rowsPromise) {
        const resolvedRows = resolveCatalogImageTokens(bootstrap.rows, Array.isArray(bootstrap.assets) ? bootstrap.assets : []);
        writeCache(resolvedRows);
        rowsPromise = Promise.resolve(resolvedRows);
      }
      return rowsPromise;
    }
    if (!configured()) return [];
    if (!rowsPromise) {"""
if needle in runtime:
    runtime = runtime.replace(needle, replacement, 1)
elif 'const bootstrap = window.NOKTENA_CATALOG_BOOTSTRAP;' not in runtime:
    raise SystemExit('catalog runtime fetchRows marker not found')
p.write_text(runtime, encoding='utf-8')

# 4) Load the CORS-free public bootstrap before catalog-runtime on both storefront pages.
for name in ('index.html', 'product.html'):
    p = Path(name)
    text = p.read_text(encoding='utf-8')
    if PUBLIC_DATA_URL not in text:
        match = re.search(r'<script src="/?assets/catalog-runtime\.js[^\"]*"></script>', text)
        if not match:
            raise SystemExit(f'catalog-runtime script not found in {name}')
        tag = f'<script src="{PUBLIC_DATA_URL}"></script>\n'
        text = text[:match.start()] + tag + text[match.start():]
    text = re.sub(r"assets/catalog-runtime\.js\?v=[^\"']+", 'assets/catalog-runtime.js?v=20260919-sameorigin1', text)
    p.write_text(text, encoding='utf-8')
