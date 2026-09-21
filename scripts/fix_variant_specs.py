from pathlib import Path
import re

path = Path('assets/catalog-v2.js')
s = path.read_text(encoding='utf-8')

old_block = """  function specKey(value){return String(value||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/g,'');}
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
"""
new_block = """  function specKey(value){return String(value||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/g,'');}
  function numberPair(value){const nums=String(value||'').match(/\\d+/g)?.map(Number)||[];return nums.length>=2?[nums[0],nums[1]]:null;}
  function firstNumber(value){const match=String(value||'').match(/\\d+/);return match?Number(match[0]):null;}
  function baseSpecEntry(product,label){const specs=product?.specs||{},wanted=specKey(label);const key=Object.keys(specs).find(k=>specKey(k)===wanted);return key?[key,specs[key]]:null;}
  function deriveFrameDimension(product,variant,label){
    const dimension=baseSpecEntry(product,label),baseSleep=baseSpecEntry(product,'Спальное место');
    const selected=numberPair(variant?.attributes?.['Спальное место']||variant?.size),base=numberPair(baseSleep?.[1]);
    if(!dimension||!selected||!base)return dimension?.[1]||'';
    const frame=firstNumber(dimension[1]);if(!Number.isFinite(frame))return dimension[1];
    const index=specKey(label)==='глубина'?1:0;
    const value=Math.max(0,Math.round(frame+(selected[index]-base[index])));
    const unit=/мм/i.test(String(dimension[1]))?' мм':'';
    return `${value}${unit}`;
  }
  function variantText(value,variant){
    const text=String(value||'');const size=String(variant?.attributes?.['Спальное место']||variant?.size||'').trim();
    if(!text||!size)return text;
    return text.replace(/\\d{2,4}\\s*[×xх*]\\s*\\d{2,4}\\s*(?:мм)?/i,size);
  }
  function shortTextForVariant(product,variant){return variantText(shortText(product),variant);}
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
      if(product?.category==='beds')for(const label of ['Ширина','Глубина']){
        const attrKey=Object.keys(attrs).find(k=>specKey(k)===specKey(label));
        const outKey=Object.keys(out).find(k=>specKey(k)===specKey(label));
        if(!attrKey&&outKey)out[outKey]=deriveFrameDimension(product,variant,label);
      }
    }
    return out;
  }
  function specValueFor(product,variant,label){
"""
if old_block in s:
    s = s.replace(old_block, new_block, 1)
elif 'function deriveFrameDimension(product,variant,label)' not in s:
    raise SystemExit('variant spec block marker not found')

old_details = "    const entries=Object.entries(variantSpecMap(product,variant)).filter(publicSpec);const description=String(product.description||'').trim();if(!entries.length&&!description)return '';"
new_details = "    const entries=Object.entries(variantSpecMap(product,variant)).filter(publicSpec);const description=variantText(String(product.description||'').trim(),variant);if(!entries.length&&!description)return '';"
if old_details in s:
    s = s.replace(old_details, new_details, 1)

old_head = "const initial=preferredVariant(product,'',sizes[0]||'');const quick=chooseSpecs(product,initial);const price="
new_head = "const initial=preferredVariant(product,'',sizes[0]||'');const quick=chooseSpecs(product,initial);const summary=shortTextForVariant(product,initial);const price="
if old_head in s:
    s = s.replace(old_head, new_head, 1)
elif 'const summary=shortTextForVariant(product,initial)' not in s:
    raise SystemExit('summary variable marker not found')

old_summary = "${shortText(product)?`<p class=\"f-card-summary\">${esc(shortText(product))}</p>`:''}"
new_summary = "${summary?`<p class=\"f-card-summary\">${esc(summary)}</p>`:''}"
if old_summary in s:
    s = s.replace(old_summary, new_summary, 1)
elif '${summary?`<p class="f-card-summary">' not in s:
    raise SystemExit('summary markup marker not found')

old_update = "function updateCardSpecs(card,product,variant){if(!card||!product)return;card.querySelectorAll('[data-spec-key]').forEach(row=>{const value=specValueFor(product,variant,row.dataset.specKey);const target=row.querySelector('b');if(target&&value!==''&&value!=null)target.textContent=String(value);});card.querySelectorAll('[data-detail-spec-key]').forEach(row=>{const value=specValueFor(product,variant,row.dataset.detailSpecKey);const target=row.querySelector('dd');if(target&&value!==''&&value!=null)target.textContent=String(value);});}"
new_update = "function updateCardSpecs(card,product,variant){if(!card||!product)return;card.querySelectorAll('[data-spec-key]').forEach(row=>{const value=specValueFor(product,variant,row.dataset.specKey);const target=row.querySelector('b');if(target&&value!==''&&value!=null)target.textContent=String(value);});card.querySelectorAll('[data-detail-spec-key]').forEach(row=>{const value=specValueFor(product,variant,row.dataset.detailSpecKey);const target=row.querySelector('dd');if(target&&value!==''&&value!=null)target.textContent=String(value);});const summary=card.querySelector('.f-card-summary');if(summary)summary.textContent=shortTextForVariant(product,variant);const detailsText=card.querySelector('.f-card-details-body>p');if(detailsText)detailsText.textContent=variantText(product.description||'',variant);}"
if old_update in s:
    s = s.replace(old_update, new_update, 1)
elif 'summary.textContent=shortTextForVariant(product,variant)' not in s:
    raise SystemExit('updateCardSpecs marker not found')

path.write_text(s, encoding='utf-8')

path = Path('index.html')
s = path.read_text(encoding='utf-8')
s = re.sub(r'assets/catalog-v2\.js\?v=[^"\']+', 'assets/catalog-v2.js?v=20260921-variantdims2', s)
path.write_text(s, encoding='utf-8')
