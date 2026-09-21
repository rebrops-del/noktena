from pathlib import Path
import re


def replace_once(text, old, new, label):
    if old in text:
        return text.replace(old, new, 1)
    if new in text:
        return text
    raise SystemExit(f'{label}: marker not found')


# ---------------- Public catalog cards ----------------
path = Path('assets/catalog-v2.js')
s = path.read_text(encoding='utf-8')

old = "  const oldPrice=(n,discount=30)=>{const price=Number(n),pct=Math.min(99,Math.max(0,Number(discount)||0));return price>=5000&&pct>0?Math.round((price/(1-pct/100))/100)*100:null;};\n"
new = old + "  const promoField=(product,key,fallback)=>Object.prototype.hasOwnProperty.call(product||{},key)?String(product?.[key]??'').trim():fallback;\n  function promoMarkup(product){const title=promoField(product,'promoLabel','Цена сентября'),subtitle=promoField(product,'promoSubtext','до 30 сентября');return title||subtitle?`<div class=\"f-price-promo\">${title?`<b>${esc(title)}</b>`:''}${subtitle?`<span>${esc(subtitle)}</span>`:''}</div>`:'';}\n"
s = replace_once(s, old, new, 'catalog promo helpers')

pattern = re.compile(r"  function deriveFrameDimension\(product,variant,label\)\{.*?\n  \}\n  function variantText", re.S)
match = pattern.search(s)
if not match:
    raise SystemExit('catalog deriveFrameDimension block not found')
new_block = """  function deriveFrameDimension(product,variant,label){
    const isDepth=specKey(label)==='глубина';
    if(isDepth){
      const manual=Number(product?.depthBySize?.[String(variant?.size||'')]??variant?.depthOverride);
      if(Number.isFinite(manual)&&manual>0)return `${Math.round(manual)} мм`;
    }
    const dimension=baseSpecEntry(product,label),baseSleep=baseSpecEntry(product,'Спальное место');
    const selected=numberPair(variant?.attributes?.['Спальное место']||variant?.size),base=numberPair(baseSleep?.[1]);
    if(!dimension||!selected||!base)return dimension?.[1]||'';
    const frame=firstNumber(dimension[1]);if(!Number.isFinite(frame))return dimension[1];
    const index=isDepth?1:0;
    const unit=/мм/i.test(String(dimension[1]))?' мм':'';
    /* Bad supplier rows sometimes contain a depth smaller than the sleeping-place length.
       In that case the selected sleeping-place length is a safer automatic fallback. */
    if(isDepth&&frame<base[index])return `${selected[index]}${unit||' мм'}`;
    const value=Math.max(0,Math.round(frame+(selected[index]-base[index])));
    return `${value}${unit}`;
  }
  function variantText"""
s = s[:match.start()] + new_block + s[match.end():]

old_promo = '<div class="f-price-promo"><b>Цена сентября</b><span>до 30 сентября</span></div>'
s = replace_once(s, old_promo, '${promoMarkup(product)}', 'catalog promo markup')
path.write_text(s, encoding='utf-8')

# ---------------- Product detail page ----------------
path = Path('assets/product-detail.js')
s = path.read_text(encoding='utf-8')

old = "  const oldPrice=n=>Number(n)>0?Math.round((Number(n)/0.7)/100)*100:null;\n"
new = "  const discountPercent=product=>{const raw=Number(product?.discountPercent);return Number.isFinite(raw)?Math.min(99,Math.max(0,Math.round(raw))):30;};\n  const oldPrice=(n,discount=30)=>{const price=Number(n),pct=Math.min(99,Math.max(0,Number(discount)||0));return price>0&&pct>0?Math.round((price/(1-pct/100))/100)*100:null;};\n  const promoField=(product,key,fallback)=>Object.prototype.hasOwnProperty.call(product||{},key)?String(product?.[key]??'').trim():fallback;\n  const detailPromoMarkup=product=>{const title=promoField(product,'promoLabel','Цена сентября'),subtitle=promoField(product,'promoSubtext','до 30 сентября');return title||subtitle?`<div class=\"pd-status\">${title?`<span class=\"pd-status-gold\">${esc(title)}</span>`:''}${subtitle?`<small>${esc(subtitle)}</small>`:''}</div>`:'';};\n"
s = replace_once(s, old, new, 'detail price helpers')

anchor = "  const sortVariantsBySize=list=>[...(list||[])].sort((a,b)=>{const A=sizeSortValue(a?.size),B=sizeSortValue(b?.size);return A[0]-B[0]||A[1]-B[1]||A[2].localeCompare(B[2],'ru');});\n"
helpers = anchor + "  const detailSpecKey=value=>String(value||'').trim().toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/g,'');\n  const detailPair=value=>{const nums=String(value||'').match(/\\d+/g)?.map(Number)||[];return nums.length>=2?[nums[0],nums[1]]:null;};\n  const detailFirst=value=>{const m=String(value||'').match(/\\d+/);return m?Number(m[0]):null;};\n  function furnitureDepthValue(product,variant,size){\n    const manual=Number(product?.depthBySize?.[String(size||'')]??variant?.depthOverride);\n    if(Number.isFinite(manual)&&manual>0)return `${Math.round(manual)} мм`;\n    const attrs=variant?.attributes&&typeof variant.attributes==='object'?variant.attributes:{};\n    const attrKey=Object.keys(attrs).find(k=>detailSpecKey(k)==='глубина');\n    if(attrKey&&attrs[attrKey])return String(attrs[attrKey]);\n    if(product?.category!=='beds'||!size)return '';\n    const specs=product?.specs||{};\n    const depthKey=Object.keys(specs).find(k=>detailSpecKey(k)==='глубина');\n    const sleepKey=Object.keys(specs).find(k=>detailSpecKey(k)==='спальноеместо');\n    const selected=detailPair(variant?.attributes?.['Спальное место']||size),base=detailPair(sleepKey?specs[sleepKey]:'');\n    const frame=detailFirst(depthKey?specs[depthKey]:'');\n    if(!selected||!base||!Number.isFinite(frame))return depthKey?String(specs[depthKey]||''):'';\n    const unit=/мм/i.test(String(specs[depthKey]||''))?' мм':' мм';\n    if(frame<base[1])return `${selected[1]}${unit}`;\n    return `${Math.max(0,Math.round(frame+(selected[1]-base[1])))}${unit}`;\n  }\n"
s = replace_once(s, anchor, helpers, 'detail depth helpers')

old_markup = '<div class="pd-price-row"><div class="pd-price-stack"><div class="pd-price-caption">Цена выбранного варианта</div><div class="pd-old-row"><span class="pd-old-price" id="pdFurnitureOldPrice">${rub(oldPrice(price))}</span><span class="pd-discount">−30%</span></div><div class="pd-price" id="pdFurniturePrice">${rub(price)}</div></div><div class="pd-status"><span class="pd-status-gold">Цена сентября</span><small>до 30 сентября</small></div></div>'
new_markup = '<div class="pd-price-row"><div class="pd-price-stack"><div class="pd-price-caption">Цена выбранного варианта</div><div class="pd-old-row" ${discountPercent(product)>0?\'\':\'style="display:none"\'}><span class="pd-old-price" id="pdFurnitureOldPrice">${oldPrice(price,discountPercent(product))?rub(oldPrice(price,discountPercent(product))):\'\'}</span><span class="pd-discount" id="pdFurnitureDiscount">−${discountPercent(product)}%</span></div><div class="pd-price" id="pdFurniturePrice">${rub(price)}</div></div>${detailPromoMarkup(product)}</div>'
s = replace_once(s, old_markup, new_markup, 'detail promo markup')

old_update = "    if(!furnitureProduct)return;updateFurnitureImage();const variant=variantFor(furnitureProduct,selectedColor,selectedSize);const price=furniturePrice(furnitureProduct,variant,selectedSize);const p=$('#pdFurniturePrice'),op=$('#pdFurnitureOldPrice');if(p)p.textContent=rub(price);if(op)op.textContent=rub(oldPrice(price));\n"
new_update = "    if(!furnitureProduct)return;updateFurnitureImage();const variant=variantFor(furnitureProduct,selectedColor,selectedSize);const price=furniturePrice(furnitureProduct,variant,selectedSize);const discount=discountPercent(furnitureProduct),compare=oldPrice(price,discount);const p=$('#pdFurniturePrice'),op=$('#pdFurnitureOldPrice'),db=$('#pdFurnitureDiscount'),oldRow=op?.closest('.pd-old-row');if(p)p.textContent=rub(price);if(op)op.textContent=compare?rub(compare):'';if(db)db.textContent=`−${discount}%`;if(oldRow)oldRow.style.display=discount>0&&compare?'':'none';\n"
s = replace_once(s, old_update, new_update, 'detail selection price update')

old_loop = "      if(furnitureProduct.category==='beds'&&selectedSize&&/спальн.*мест/.test(key)){valueEl.textContent=selectedSize;return;}\n      const attrKey=Object.keys(attrs).find(k=>normSpecKey(k)===key);\n"
new_loop = "      if(furnitureProduct.category==='beds'&&selectedSize&&/спальн.*мест/.test(key)){valueEl.textContent=selectedSize;return;}\n      if(key==='глубина'){const depth=furnitureDepthValue(furnitureProduct,variant,selectedSize);if(depth){valueEl.textContent=depth;return;}}\n      const attrKey=Object.keys(attrs).find(k=>normSpecKey(k)===key);\n"
s = replace_once(s, old_loop, new_loop, 'detail dynamic depth')
path.write_text(s, encoding='utf-8')

# ---------------- Load new ADMIN controls and bust browser caches ----------------
path = Path('admin/index.html')
s = path.read_text(encoding='utf-8')
if 'admin-card-settings.js' not in s:
    s = s.replace('  <script src="./admin-enhancements.js?v=9" defer></script>\n', '  <script src="./admin-enhancements.js?v=9" defer></script>\n  <script src="./admin-card-settings.js?v=1" defer></script>\n')
else:
    s = re.sub(r'admin-card-settings\.js\?v=\d+', 'admin-card-settings.js?v=1', s)
path.write_text(s, encoding='utf-8')

path = Path('index.html')
s = path.read_text(encoding='utf-8')
s = re.sub(r'assets/catalog-v2\.js\?v=[^"\']+', 'assets/catalog-v2.js?v=20260921-depthpromo1', s)
path.write_text(s, encoding='utf-8')

path = Path('product.html')
s = path.read_text(encoding='utf-8')
s = re.sub(r'assets/product-detail\.js\?v=[^"\']+', 'assets/product-detail.js?v=20260921-depthpromo1', s)
path.write_text(s, encoding='utf-8')
