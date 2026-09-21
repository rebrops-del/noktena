from pathlib import Path
import re

path = Path('assets/catalog-v2.js')
s = path.read_text(encoding='utf-8')

old_choose = """  function chooseSpecs(product){
    const entries=Object.entries(product.specs||{}).filter(publicSpec);
    const preferred=['Спальное место','Кроватное основание','Механизм трансформации','Бельевой ящик','Подъёмный механизм','Наполнение','Материал обивки','Материал фасада','Количество спальных мест'];
    const out=[];for(const p of preferred){const e=entries.find(([k])=>k.toLowerCase()===p.toLowerCase());if(e&&!out.some(x=>x[0]===e[0]))out.push(e);if(out.length>=3)break;}for(const e of entries){if(out.length>=3)break;if(!out.some(x=>x[0]===e[0]))out.push(e);}return out;
  }
"""
new_choose = """  function specKey(value){return String(value||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/g,'');}
  function variantSpecMap(product,variant){
    const out={...(product?.specs||{})};
    const attrs=variant?.attributes&&typeof variant.attributes==='object'?variant.attributes:{};
    for(const [key,value] of Object.entries(attrs))if(key&&value!==''&&value!=null)out[key]=value;
    if(variant?.size){
      const sleepKey=Object.keys(out).find(k=>specKey(k)==='спальноеместо');
      const attrSleepKey=Object.keys(attrs).find(k=>specKey(k)==='спальноеместо');
      if(product?.category==='beds'||sleepKey||attrSleepKey)out[sleepKey||attrSleepKey||'Спальное место']=attrs[attrSleepKey]||variant.size;
      const sizeKey=Object.keys(out).find(k=>specKey(k)==='размер');
      const attrSizeKey=Object.keys(attrs).find(k=>specKey(k)==='размер');
      if(sizeKey&&!attrSizeKey)out[sizeKey]=variant.size;
    }
    return out;
  }
  function specValueFor(product,variant,label){
    const specs=variantSpecMap(product,variant),wanted=specKey(label);
    const key=Object.keys(specs).find(k=>specKey(k)===wanted);
    return key?specs[key]:'';
  }
  function chooseSpecs(product,variant=null){
    const entries=Object.entries(variantSpecMap(product,variant)).filter(publicSpec);
    const preferred=['Спальное место','Глубина','Ширина','Кроватное основание','Механизм трансформации','Бельевой ящик','Подъёмный механизм','Наполнение','Материал обивки','Материал фасада','Количество спальных мест'];
    const out=[];for(const p of preferred){const e=entries.find(([k])=>specKey(k)===specKey(p));if(e&&!out.some(x=>x[0]===e[0]))out.push(e);if(out.length>=3)break;}for(const e of entries){if(out.length>=3)break;if(!out.some(x=>x[0]===e[0]))out.push(e);}return out;
  }
"""
if old_choose in s:
    s = s.replace(old_choose, new_choose, 1)
elif 'function variantSpecMap(product,variant)' not in s:
    raise SystemExit('chooseSpecs marker not found')

old_card_head = "    const imgs=uniq(product.images);const quick=chooseSpecs(product);const category=product.category==='beds'?'Кровать':'Диван';const link=detailUrl(product);\n    const sizes=sortSizes(product.sizes?.length?product.sizes:(product.variants||[]).map(v=>v.size));const initial=preferredVariant(product,'',sizes[0]||'');const price=furniturePrice(product,initial,sizes[0]||'');const discount=discountPercent(product);const comparePrice=oldPrice(price,discount);const first=imgs[0]||'assets/hero-noktena-final.png?v=20260908-final2';"
new_card_head = "    const imgs=uniq(product.images);const category=product.category==='beds'?'Кровать':'Диван';const link=detailUrl(product);\n    const sizes=sortSizes(product.sizes?.length?product.sizes:(product.variants||[]).map(v=>v.size));const initial=preferredVariant(product,'',sizes[0]||'');const quick=chooseSpecs(product,initial);const price=furniturePrice(product,initial,sizes[0]||'');const discount=discountPercent(product);const comparePrice=oldPrice(price,discount);const first=imgs[0]||'assets/hero-noktena-final.png?v=20260908-final2';"
if old_card_head in s:
    s = s.replace(old_card_head, new_card_head, 1)
elif 'const quick=chooseSpecs(product,initial)' not in s:
    raise SystemExit('card head marker not found')

old_quick = '${quick.length?`<div class="f-premium-specs">${quick.map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join(\'\')}</div>`:\'\'}'
new_quick = '${quick.length?`<div class="f-premium-specs">${quick.map(([k,v])=>`<div data-spec-key="${esc(k)}"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join(\'\')}</div>`:\'\'}'
if old_quick in s:
    s = s.replace(old_quick, new_quick, 1)
elif 'data-spec-key=' not in s:
    raise SystemExit('quick specs marker not found')

old_details_sig = "  function cardDetailsMarkup(product){\n    const entries=Object.entries(product.specs||{}).filter(publicSpec);const description=String(product.description||'').trim();if(!entries.length&&!description)return '';"
new_details_sig = "  function cardDetailsMarkup(product,variant=null){\n    const entries=Object.entries(variantSpecMap(product,variant)).filter(publicSpec);const description=String(product.description||'').trim();if(!entries.length&&!description)return '';"
if old_details_sig in s:
    s = s.replace(old_details_sig, new_details_sig, 1)
elif 'function cardDetailsMarkup(product,variant=null)' not in s:
    raise SystemExit('details function marker not found')

old_detail_row = '${entries.length?`<dl>${entries.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join(\'\')}</dl>`:\'\'}'
new_detail_row = '${entries.length?`<dl>${entries.map(([k,v])=>`<div data-detail-spec-key="${esc(k)}"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join(\'\')}</dl>`:\'\'}'
if old_detail_row in s:
    s = s.replace(old_detail_row, new_detail_row, 1)
elif 'data-detail-spec-key=' not in s:
    raise SystemExit('detail rows marker not found')

if '${cardDetailsMarkup(product)}' in s:
    s = s.replace('${cardDetailsMarkup(product)}', '${cardDetailsMarkup(product,initial)}', 1)

old_update = "  function updateCardVariant(card){const product=productById(card?.dataset.productId);if(!product)return;const size=card.dataset.selectedSize||'';const variant=preferredVariant(product,'',size);const price=furniturePrice(product,variant,size);const discount=discountPercent(product),comparePrice=oldPrice(price,discount);const el=$('[data-card-price]',card),old=$('[data-card-old-price]',card),badge=$('[data-card-discount]',card),line=old?.closest('.f-old-price-line');if(el)el.textContent=rub(price);if(old)old.textContent=comparePrice?rub(comparePrice):'';if(badge)badge.textContent=`−${discount}%`;if(line)line.style.display=discount>0&&comparePrice?'':'none';}"
new_update = "  function updateCardSpecs(card,product,variant){if(!card||!product)return;card.querySelectorAll('[data-spec-key]').forEach(row=>{const value=specValueFor(product,variant,row.dataset.specKey);const target=row.querySelector('b');if(target&&value!==''&&value!=null)target.textContent=String(value);});card.querySelectorAll('[data-detail-spec-key]').forEach(row=>{const value=specValueFor(product,variant,row.dataset.detailSpecKey);const target=row.querySelector('dd');if(target&&value!==''&&value!=null)target.textContent=String(value);});}\n  function updateCardVariant(card){const product=productById(card?.dataset.productId);if(!product)return;const size=card.dataset.selectedSize||'';const variant=preferredVariant(product,'',size);const price=furniturePrice(product,variant,size);const discount=discountPercent(product),comparePrice=oldPrice(price,discount);const el=$('[data-card-price]',card),old=$('[data-card-old-price]',card),badge=$('[data-card-discount]',card),line=old?.closest('.f-old-price-line');if(el)el.textContent=rub(price);if(old)old.textContent=comparePrice?rub(comparePrice):'';if(badge)badge.textContent=`−${discount}%`;if(line)line.style.display=discount>0&&comparePrice?'':'none';updateCardSpecs(card,product,variant);}"
if old_update in s:
    s = s.replace(old_update, new_update, 1)
elif 'function updateCardSpecs(card,product,variant)' not in s:
    raise SystemExit('updateCardVariant marker not found')

path.write_text(s, encoding='utf-8')

path = Path('index.html')
s = path.read_text(encoding='utf-8')
s = re.sub(r'assets/catalog-v2\.js\?v=[^"\']+', 'assets/catalog-v2.js?v=20260921-variantdims1', s)
path.write_text(s, encoding='utf-8')
