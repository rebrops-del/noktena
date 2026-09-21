from pathlib import Path
import re

# ADMIN: per-card discount percentage for furniture.
path = Path('admin/admin-enhancements.js')
s = path.read_text(encoding='utf-8')
if 'productDiscountPercent' not in s:
    marker = """  function syncBadgeField(){
    ensureBadgeField();
    const select=document.getElementById('productBadge');
    if(!select||typeof draft==='undefined'||!draft)return;
    select.value=effectiveBadge(draft);
  }
"""
    addition = marker + """
  function ensureDiscountField(){
    const grid=document.querySelector('#editorForm .grid2');
    if(!grid||document.getElementById('productDiscountPercent'))return;
    const label=document.createElement('label');
    label.id='productDiscountPercentLabel';
    label.innerHTML='Скидка в карточке, %<input id="productDiscountPercent" type="number" min="0" max="99" step="1" inputmode="numeric" placeholder="30">';
    const badge=document.getElementById('productBadge')?.closest('label');
    if(badge?.nextSibling)grid.insertBefore(label,badge.nextSibling);else grid.appendChild(label);
    label.querySelector('input')?.addEventListener('input',event=>{
      if(typeof draft==='undefined'||!draft||draft._kind!=='furniture')return;
      const value=Number(event.target.value);
      draft.discountPercent=Number.isFinite(value)?Math.min(99,Math.max(0,Math.round(value))):30;
    });
  }

  function syncDiscountField(){
    ensureDiscountField();
    const input=document.getElementById('productDiscountPercent');
    const label=document.getElementById('productDiscountPercentLabel');
    if(!input||typeof draft==='undefined'||!draft)return;
    const isFurniture=draft._kind==='furniture';
    label?.classList.toggle('hide',!isFurniture);
    if(!isFurniture)return;
    const raw=Number(draft.discountPercent);
    input.value=Number.isFinite(raw)?Math.min(99,Math.max(0,Math.round(raw))):30;
  }
"""
    if marker not in s:
        raise SystemExit('syncBadgeField marker not found')
    s = s.replace(marker, addition, 1)
    old_observer = "  ensureBadgeField();\n  if(editor)new MutationObserver(()=>{if(!editor.classList.contains('hide'))syncBadgeField()}).observe(editor,{attributes:true,attributeFilter:['class']});"
    new_observer = "  ensureBadgeField();\n  ensureDiscountField();\n  if(editor)new MutationObserver(()=>{if(!editor.classList.contains('hide')){syncBadgeField();syncDiscountField();}}).observe(editor,{attributes:true,attributeFilter:['class']});"
    if old_observer not in s:
        raise SystemExit('editor observer marker not found')
    s = s.replace(old_observer, new_observer, 1)
    submit_old = "    const select=document.getElementById('productBadge');\n    if(select)draft.badge=select.value||'none';"
    submit_new = submit_old + "\n    const discountInput=document.getElementById('productDiscountPercent');\n    if(discountInput&&draft._kind==='furniture'){\n      const raw=Number(discountInput.value);\n      draft.discountPercent=Number.isFinite(raw)?Math.min(99,Math.max(0,Math.round(raw))):30;\n    }"
    if submit_old not in s:
        raise SystemExit('admin submit marker not found')
    s = s.replace(submit_old, submit_new, 1)
    path.write_text(s, encoding='utf-8')

# STOREFRONT: use each product's configured discount instead of fixed 30%.
path = Path('assets/catalog-v2.js')
s = path.read_text(encoding='utf-8')
old = "  const oldPrice=n=>Number(n)>=5000?Math.round((Number(n)/0.7)/100)*100:null;"
new = "  const discountPercent=product=>{const raw=Number(product?.discountPercent);return Number.isFinite(raw)?Math.min(99,Math.max(0,Math.round(raw))):30;};\n  const oldPrice=(n,discount=30)=>{const price=Number(n),pct=Math.min(99,Math.max(0,Number(discount)||0));return price>=5000&&pct>0?Math.round((price/(1-pct/100))/100)*100:null;};"
if old in s:
    s = s.replace(old, new, 1)
elif 'const discountPercent=product=>' not in s:
    raise SystemExit('oldPrice marker not found')

old = "    const sizes=sortSizes(product.sizes?.length?product.sizes:(product.variants||[]).map(v=>v.size));const initial=preferredVariant(product,'',sizes[0]||'');const price=furniturePrice(product,initial,sizes[0]||'');const first=imgs[0]||'assets/hero-noktena-final.png?v=20260908-final2';"
new = "    const sizes=sortSizes(product.sizes?.length?product.sizes:(product.variants||[]).map(v=>v.size));const initial=preferredVariant(product,'',sizes[0]||'');const price=furniturePrice(product,initial,sizes[0]||'');const discount=discountPercent(product);const comparePrice=oldPrice(price,discount);const first=imgs[0]||'assets/hero-noktena-final.png?v=20260908-final2';"
if old in s:
    s = s.replace(old, new, 1)
elif 'const discount=discountPercent(product)' not in s:
    raise SystemExit('card price marker not found')

old = '<div class="f-price-row"><div class="f-price-stack"><div class="f-price-caption">Цена выбранного варианта</div><div class="f-old-price-line"><span class="f-old-price" data-card-old-price>${rub(oldPrice(price))}</span><span class="f-discount-badge">−30%</span></div><div class="f-price" data-card-price>${rub(price)}</div></div><div class="f-price-promo"><b>Цена сентября</b><span>до 30 сентября</span></div></div>'
new = '<div class="f-price-row"><div class="f-price-stack"><div class="f-price-caption">Цена выбранного варианта</div><div class="f-old-price-line" ${discount>0&&comparePrice?\'\':\'style="display:none"\'}><span class="f-old-price" data-card-old-price>${comparePrice?rub(comparePrice):\'\'}</span><span class="f-discount-badge" data-card-discount>−${discount}%</span></div><div class="f-price" data-card-price>${rub(price)}</div></div><div class="f-price-promo"><b>Цена сентября</b><span>до 30 сентября</span></div></div>'
if old in s:
    s = s.replace(old, new, 1)
elif 'data-card-discount' not in s:
    raise SystemExit('price markup marker not found')

old = "  function updateCardVariant(card){const product=productById(card?.dataset.productId);if(!product)return;const size=card.dataset.selectedSize||'';const variant=preferredVariant(product,'',size);const price=furniturePrice(product,variant,size);const el=$('[data-card-price]',card),old=$('[data-card-old-price]',card);if(el)el.textContent=rub(price);if(old)old.textContent=rub(oldPrice(price));}"
new = "  function updateCardVariant(card){const product=productById(card?.dataset.productId);if(!product)return;const size=card.dataset.selectedSize||'';const variant=preferredVariant(product,'',size);const price=furniturePrice(product,variant,size);const discount=discountPercent(product),comparePrice=oldPrice(price,discount);const el=$('[data-card-price]',card),old=$('[data-card-old-price]',card),badge=$('[data-card-discount]',card),line=old?.closest('.f-old-price-line');if(el)el.textContent=rub(price);if(old)old.textContent=comparePrice?rub(comparePrice):'';if(badge)badge.textContent=`−${discount}%`;if(line)line.style.display=discount>0&&comparePrice?'':'none';}"
if old in s:
    s = s.replace(old, new, 1)
elif 'comparePrice=oldPrice(price,discount)' not in s:
    raise SystemExit('updateCardVariant marker not found')
path.write_text(s, encoding='utf-8')

# Cache-bust updated scripts.
path = Path('admin/index.html')
s = path.read_text(encoding='utf-8')
s = re.sub(r'admin-enhancements\.js\?v=\d+', 'admin-enhancements.js?v=9', s)
path.write_text(s, encoding='utf-8')

path = Path('index.html')
s = path.read_text(encoding='utf-8')
s = re.sub(r'assets/catalog-v2\.js\?v=[^"\']+', 'assets/catalog-v2.js?v=20260921-discount1', s)
path.write_text(s, encoding='utf-8')
