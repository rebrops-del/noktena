#!/usr/bin/env python3
from pathlib import Path


def replace_once(text, old, new, label):
    if new in text:
        print(f'{label}: already applied')
        return text
    if old not in text:
        raise SystemExit(f'{label}: target not found')
    print(f'{label}: applied')
    return text.replace(old, new, 1)


# 1. Load the admin runtime before the mattress catalog inline script.
index_path = Path('index.html')
index = index_path.read_text(encoding='utf-8')
index = replace_once(
    index,
    '<script>\nconst MAX_LINK=',
    '<script src="assets/admin-config.js?v=20260919-1"></script>\n<script src="assets/catalog-runtime.js?v=20260919-1"></script>\n<script>\nconst MAX_LINK=',
    'index runtime scripts',
)
index = replace_once(
    index,
    ",pp=PHOTO_POS[x.model],photo=pp?",
    ",customImg=Array.isArray(x.images)&&x.images[0]?x.images[0]:'',pp=PHOTO_POS[x.model],photo=customImg?`<div class=\"photo-media\"><img src=\"${safe(customImg)}\" alt=\"${safe(x.model)}\" style=\"width:100%;height:100%;object-fit:cover;display:block\"></div>`:pp?",
    'mattress custom image',
)
index = replace_once(
    index,
    "products=sets.flat().filter(x=>!REMOVE_MODELS.has(x.model))",
    "let baseProducts=sets.flat();if(window.NoktenaCatalog)baseProducts=await window.NoktenaCatalog.mergeMattresses(baseProducts);products=baseProducts.filter(x=>!REMOVE_MODELS.has(x.model))",
    'mattress override merge',
)
index_path.write_text(index, encoding='utf-8')

# 2. Merge furniture overrides before catalog rendering.
catalog_path = Path('assets/catalog-v2.js')
catalog = catalog_path.read_text(encoding='utf-8')
catalog = replace_once(
    catalog,
    "const data=await r.json();state.data.beds=Array.isArray(data.beds)?data.beds:[];state.data.sofas=Array.isArray(data.sofas)?data.sofas:[];state.loaded=true;",
    "const raw=await r.json();const data=window.NoktenaCatalog?await window.NoktenaCatalog.mergeFurniture(raw):raw;state.data.beds=Array.isArray(data.beds)?data.beds:[];state.data.sofas=Array.isArray(data.sofas)?data.sofas:[];state.loaded=true;",
    'furniture catalog override merge',
)
catalog_path.write_text(catalog, encoding='utf-8')

# 3. Product detail pages use the same merged catalog and custom mattress photos.
detail_path = Path('assets/product-detail.js')
detail = detail_path.read_text(encoding='utf-8')
detail = replace_once(
    detail,
    "function mattressImageMarkup(product){const pp=PHOTO_POS[product.model];if(!pp)return galleryMarkup([],product.model);galleryImages=[];return",
    "function mattressImageMarkup(product){if(Array.isArray(product.images)&&product.images.length)return galleryMarkup(product.images,product.model);const pp=PHOTO_POS[product.model];if(!pp)return galleryMarkup([],product.model);galleryImages=[];return",
    'mattress detail custom images',
)
detail = replace_once(
    detail,
    "const model=params.get('model')||'';const sets=await Promise.all(DATA_FILES.map(f=>fetch(`${f}?v=20260918-quality1`,{cache:'no-store'}).then(r=>r.json())));const all=sets.flat().filter(x=>!REMOVE_MODELS.has(x.model));const product=all.find(x=>x.model===model);",
    "const model=params.get('model')||'';const sets=await Promise.all(DATA_FILES.map(f=>fetch(`${f}?v=20260918-quality1`,{cache:'no-store'}).then(r=>r.json())));let all=sets.flat();if(window.NoktenaCatalog)all=await window.NoktenaCatalog.mergeMattresses(all);all=all.filter(x=>!REMOVE_MODELS.has(x.model));const product=all.find(x=>x.model===model);",
    'mattress detail override merge',
)
detail = replace_once(
    detail,
    "const id=params.get('id')||'';const r=await fetch(`data/furniture.json?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const data=await r.json();const product=[...(data.beds||[]),...(data.sofas||[])].find(x=>x.id===id);",
    "const id=params.get('id')||'';const r=await fetch(`data/furniture.json?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const raw=await r.json();const data=window.NoktenaCatalog?await window.NoktenaCatalog.mergeFurniture(raw):raw;const product=[...(data.beds||[]),...(data.sofas||[])].find(x=>x.id===id);",
    'furniture detail override merge',
)
detail_path.write_text(detail, encoding='utf-8')

# 4. Product detail HTML loads runtime before product scripts.
product_path = Path('product.html')
product = product_path.read_text(encoding='utf-8')
product = replace_once(
    product,
    '<script src="assets/furniture-source-colors.js?v=20260918-galleryfix4"></script>',
    '<script src="assets/admin-config.js?v=20260919-1"></script>\n<script src="assets/catalog-runtime.js?v=20260919-1"></script>\n<script src="assets/furniture-source-colors.js?v=20260918-galleryfix4"></script>',
    'product runtime scripts',
)
product_path.write_text(product, encoding='utf-8')

print('Admin runtime integration complete')
