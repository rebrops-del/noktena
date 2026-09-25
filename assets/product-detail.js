(() => {
  'use strict';

  const MAX_LINK='https://max.ru/u/f9LHodD0cOKZqie3BJvn11xgsNvxJK_kFOqYtKyFuZ2uMitoxZIwNaH8-NY';
  const MAX_ICON='/assets/max-logo.png?v=20260922-max1';
  const DATA_FILES=['data/data1.json','data/data2.json','data/data3.json','data/data4.json','data/data5.json','data/data6.json'];
  const REMOVE_MODELS=new Set(['Матрас Mega холкон TFK','Матрас Mega холкон-кокос TFK','Матрас MEGA Бикокос ППУ 10 ECO','Матрас Стандарт Детский','Подушка Обнимашки']);
  const FIRMNESS={'Подушка Память форма':'Средняя','Матрас Стандарт':'Ниже средней','Матрас Барселона ZAСоня Gray Night':'1 сторона — выше средней / 2 сторона — средняя','Матрас Касабланка ZAСоня Gray Night':'Средняя','Матрас Валенсия ZAСоня Gray Night':'Средняя','Матрас Ибица ZAСоня Gray Night':'Средняя','Матрас Imperial Suite латекс-кокос Gray Night':'Жёсткая','Матрас MEGA MULT ЗИМА ЛЕТО MultiPocket Gray Night':'1 сторона — мягкая / 2 сторона — средняя','Матрас MEGA MULT ELITE MultiPocket Gray Night':'1 сторона — мягкая / 2 сторона — средняя'};
  const PHOTO_POS={'Матрас Imperial Suite кокос Gray Night':[0,0],'Матрас Imperial Suite латекс-кокос Gray Night':[1,0],'Матрас Imperial Suite холкон-кокос Gray Night':[2,0],'Матрас MEGA MULT ELITE MultiPocket Gray Night':[3,0],'Матрас MEGA MULT ЗИМА ЛЕТО MultiPocket Gray Night':[4,0],'Матрас MEGA MULT кокос ППУ 20 MultiPocket Gray Night':[0,1],'Матрас MEGA Элит Блитц TFK Gray Night':[1,1],'Матрас Барселона ZAСоня Gray Night':[2,1],'Матрас Валенсия ZAСоня Gray Night':[3,1],'Матрас Ибица ZAСоня Gray Night':[4,1],'Матрас Касабланка ZAСоня Gray Night':[0,2],'Матрас Стандарт':[1,2],'Матрас Mega кокос 10 TFK Gray Night':[2,2],'Матрас Mega кокос 10 TFK':[3,2],'Матрас Mega кокос 20 TFK Gray Night':[4,2],'Матрас Mega кокос 20 TFK':[0,3],'Матрас Mega кокос 30 TFK Gray Night':[1,3],'Матрас Mega кокос 30 TFK':[2,3],'Матрас MEGA ППУ 10 ECO':[3,3],'Матрас Mega холкон TFK Gray Night':[4,3],'Матрас Mega холкон-кокос TFK Gray Night':[0,4],'Наматрасник "Непромокаемый чехол"':[1,4],'Подушка Память форма':[2,4],'Матрас ППУ 16 ZAСоня':[3,4],'Матрас Солид ZaСоня':[4,4]};

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rub=n=>Number.isFinite(Number(n))&&Number(n)>0?`${Math.round(Number(n)).toLocaleString('ru-RU')} ₽`:'Цена по запросу';
  const discountPercent=product=>{const raw=Number(product?.discountPercent);return product?.discountPercent!=null&&Number.isFinite(raw)?Math.min(99,Math.max(0,Math.round(raw))):0;};
  const oldPrice=(n,discount=0)=>{const price=Number(n),pct=Math.min(99,Math.max(0,Number(discount)||0));return price>0&&pct>0?Math.round((price/(1-pct/100))/100)*100:null;};
  const promoField=(product,key,fallback)=>Object.prototype.hasOwnProperty.call(product||{},key)?String(product?.[key]??'').trim():fallback;
  const detailPromoMarkup=product=>{const title=promoField(product,'promoLabel',''),subtitle=promoField(product,'promoSubtext','');return `<div class="pd-status" ${title||subtitle?'':'style="display:none"'}>${title?`<span class="pd-status-gold">${esc(title)}</span>`:''}${subtitle?`<small>${esc(subtitle)}</small>`:''}</div>`;};
  const uniq=list=>[...new Set((list||[]).filter(Boolean).map(v=>String(v).trim()).filter(Boolean))];
  const sizeSortValue=value=>{const nums=String(value||'').replace(/×/g,'х').match(/\d+/g)?.map(Number)||[];return [nums[0]??Number.MAX_SAFE_INTEGER,nums[1]??Number.MAX_SAFE_INTEGER,String(value||'')];};
  const sortSizes=list=>uniq(list).sort((a,b)=>{const A=sizeSortValue(a),B=sizeSortValue(b);return A[0]-B[0]||A[1]-B[1]||A[2].localeCompare(B[2],'ru');});
  const sortVariantsBySize=list=>[...(list||[])].sort((a,b)=>{const A=sizeSortValue(a?.size),B=sizeSortValue(b?.size);return A[0]-B[0]||A[1]-B[1]||A[2].localeCompare(B[2],'ru');});
  const detailSpecKey=value=>String(value||'').trim().toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/g,'');
  const detailPair=value=>{const nums=String(value||'').match(/\d+/g)?.map(Number)||[];return nums.length>=2?[nums[0],nums[1]]:null;};
  const detailFirst=value=>{const m=String(value||'').match(/\d+/);return m?Number(m[0]):null;};
  function furnitureDepthValue(product,variant,size){
    const manual=Number(product?.depthBySize?.[String(size||'')]??variant?.depthOverride);
    if(Number.isFinite(manual)&&manual>0)return `${Math.round(manual)} мм`;
    const attrs=variant?.attributes&&typeof variant.attributes==='object'?variant.attributes:{};
    const attrKey=Object.keys(attrs).find(k=>detailSpecKey(k)==='глубина');
    if(attrKey&&attrs[attrKey])return String(attrs[attrKey]);
    if(product?.category!=='beds'||!size)return '';
    const specs=product?.specs||{};
    const depthKey=Object.keys(specs).find(k=>detailSpecKey(k)==='глубина');
    const sleepKey=Object.keys(specs).find(k=>detailSpecKey(k)==='спальноеместо');
    const selected=detailPair(variant?.attributes?.['Спальное место']||size),base=detailPair(sleepKey?specs[sleepKey]:'');
    const frame=detailFirst(depthKey?specs[depthKey]:'');
    if(!selected||!base||!Number.isFinite(frame))return depthKey?String(specs[depthKey]||''):'';
    const unit=/мм/i.test(String(specs[depthKey]||''))?' мм':' мм';
    if(frame<base[1])return `${selected[1]}${unit}`;
    return `${Math.max(0,Math.round(frame+(selected[1]-base[1])))}${unit}`;
  }
  const params=new URLSearchParams(location.search);
  const root=$('#productRoot');
  let galleryImages=[];
  let galleryIndex=0;
  let furnitureProduct=null;
  let selectedColor='';
  let selectedSize='';

  function getFirmness(x){
    if(FIRMNESS[x.model])return FIRMNESS[x.model];
    if(['Чехлы','Подушки'].includes(x.category))return 'Не применяется';
    const t=((x.intro||'')+' '+(x.description||'')).toLowerCase();
    if(t.includes('максимально жесткий')||t.includes('максимально жёсткий'))return 'Максимально жёсткая';
    if(t.includes('жесткость выше средней')||t.includes('жёсткость выше средней')||t.includes('выше средней жесткости')||t.includes('выше средней жёсткости'))return 'Выше средней';
    if(t.includes('ниже средней'))return 'Ниже средней';
    if(t.includes('средней жесткости')||t.includes('средней жёсткости'))return 'Средняя';
    if(t.includes('мягкий матрас'))return 'Мягкая';
    if(t.includes('жесткий матрас')||t.includes('жёсткий матрас'))return 'Жёсткая';
    return 'Уточняется';
  }
  function swatchCss(name){const n=String(name||'').toLowerCase().replace(/ё/g,'е');const map=[['молоч','#eee7d8'],['крем','#eadcc5'],['айвор','#eee6d5'],['беж','#d8c4a6'],['песоч','#cbb58b'],['капуч','#a98970'],['тауп','#8b7c70'],['графит','#555b5d'],['антрац','#44494c'],['темно сер','#66686b'],['светло сер','#b9b8b4'],['сер','#8b8c90'],['бирюз','#49a5a9'],['мят','#91b8a4'],['изумруд','#39705c'],['олив','#7d8662'],['зел','#718b77'],['голуб','#91b9cf'],['син','#4c6687'],['борд','#7c3340'],['винн','#7c3340'],['пудр','#d8a8b4'],['роз','#d8a8b4'],['сирен','#9b83a8'],['фиолет','#806b8c'],['корич','#76584a'],['шокол','#5f4438'],['террак','#b96f52'],['оранж','#c9824d'],['горч','#b99a4d'],['желт','#d9b957'],['бел','#f7f5ef'],['черн','#222']];const hit=map.find(([k])=>n.includes(k));return hit?hit[1]:'#b7afa5';}
  function colorKey(value){let n=String(value||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/g,'');if(n==='бордо')n='бордовый';return n;}
  function setDocumentMeta(title,description){document.title=/НОКТЕНА/i.test(title)?title:`${title} — НОКТЕНА`;const summary=String(description||`Характеристики и цена: ${title}.`).replace(/\s+/g,' ').slice(0,180);const meta=document.querySelector('meta[name="description"]');if(meta)meta.content=summary;for(const [key,value] of [['og:title',document.title],['og:description',summary]]){const el=document.querySelector(`meta[property="${key}"]`);if(el)el.content=value;}}
  function productSEO(product,kind,price){
    const title=product.title||product.model||'';
    const photo=product.images?.[0];
    const og=document.querySelector('meta[property="og:image"]')||document.head.appendChild(document.createElement('meta'));
    og.setAttribute('property','og:image');og.content=new URL(photo||'assets/logo-noktena-final.png',location.href).href;
    const canonical=document.querySelector('link[rel="canonical"]')||document.head.appendChild(document.createElement('link'));
    canonical.rel='canonical';canonical.href=location.href.split('#')[0];
    const node=document.querySelector('#productStructuredData')||document.head.appendChild(document.createElement('script'));
    node.id='productStructuredData';node.type='application/ld+json';
    const data={'@context':'https://schema.org','@type':'Product',name:title,description:product.description||product.intro||'',image:photo?[new URL(photo,location.href).href]:undefined,brand:{'@type':'Brand',name:'НОКТЕНА'},category:kind==='mattress'?'Матрасы':product.category==='beds'?'Кровати':'Диваны'};
    if(Number(price)>0){data.offers={'@type':'Offer',priceCurrency:'RUB',price:Number(price),url:location.href.split('#')[0]};if(product.available===true)data.offers.availability='https://schema.org/InStock';if(product.available===false)data.offers.availability='https://schema.org/PreOrder'}
    node.textContent=JSON.stringify(data).replace(/</g,'\\u003c');
  }
  function renderSimilar(all,current,kind){
    const mount=$('#similarProducts');if(!mount)return;
    const candidates=all.filter(item=>item!==current&&item.category===current.category).slice(0,3);
    if(!candidates.length){mount.hidden=true;return;}
    mount.innerHTML=`<span class="overline">ПРОДОЛЖИТЬ ВЫБОР</span><h2>Похожие модели</h2><div class="pd-similar-grid">${candidates.map(item=>{
      const title=item.title||item.model||'';
      const src=item.images?.[0];
      const pp=PHOTO_POS[item.model];
      const visual=src?`<img src="${esc(src)}" alt="${esc(title)}" loading="lazy" decoding="async">`:pp?`<img class="pd-mattress-thumb" src="assets/admin-mattress-thumbs/r${pp[1]+1}-c${pp[0]+1}.webp" alt="${esc(title)}" width="1200" height="900" loading="lazy" decoding="async">`:'<div class="pd-similar-sprite"></div>';
      const price=kind==='mattress'?Math.min(...(item.variants||[]).map(v=>Number(v.price)||Infinity)):furniturePrice(item,null);
      const href=kind==='mattress'?`product.html?kind=mattress&model=${encodeURIComponent(item.model)}`:`product.html?kind=furniture&id=${encodeURIComponent(item.id)}`;
      return `<a class="pd-similar-card" href="${href}">${visual}<b>${esc(title)}</b><span>${rub(price)}</span></a>`;
    }).join('')}</div>`;mount.hidden=false;
  }
  function setBack(view,label){const url=`/#${view}`;const top=$('#backTop');if(top)top.href=url;const b=$('#breadcrumbs');if(b)b.innerHTML=`<a href="/">Главная</a><span>›</span><a href="${url}">${esc(label)}</a><span>›</span><span>Карточка товара</span>`;}

  function galleryMarkup(images,title,kind='furniture'){
    galleryImages=uniq(images);galleryIndex=0;if(!galleryImages.length)galleryImages=['assets/hero-noktena-final.png?v=20260908-final2'];const first=galleryImages[0];
    setTimeout(()=>{
      $$('#pdThumbs [data-pd-index]').forEach(button=>{
        if(Number(button.dataset.pdIndex)===0)return;
        const img=button.querySelector('img');if(img&&!img.naturalWidth)removeBrokenGalleryPhoto(img.getAttribute('src'));
      });
    },12000);
    return `<div class="pd-gallery-card">
      <div class="pd-main-media ${kind==='mattress'?'pd-mattress-media':''}" id="pdMainMedia" style="--pd-bg:url('${esc(first)}')">
        <img id="pdMainImage" src="${esc(first)}" alt="${esc(title)}" decoding="async" referrerpolicy="no-referrer">
        <button class="pd-zoom" type="button" aria-label="Увеличить изображение товара">Увеличить ↗</button>
        ${galleryImages.length>1?`<button class="pd-gallery-arrow prev" type="button" data-pd-dir="-1" aria-label="Предыдущее фото" hidden>‹</button><button class="pd-gallery-arrow next" type="button" data-pd-dir="1" aria-label="Следующее фото" hidden>›</button>`:''}
        <span class="pd-counter" id="pdCounter">1 фото</span>
      </div>
      ${galleryImages.length>1?`<div class="pd-thumbs" id="pdThumbs" hidden>${galleryImages.map((src,i)=>`<button class="pd-thumb ${i===0?'is-active':''}" type="button" data-pd-index="${i}" aria-label="Фото ${i+1}" hidden><img src="${esc(src)}" alt="" decoding="async" referrerpolicy="no-referrer"></button>`).join('')}</div>`:''}
    </div>`;
  }
  function mattressImageMarkup(product){if(Array.isArray(product.images)&&product.images.length)return galleryMarkup(product.images,product.model,'mattress');const pp=PHOTO_POS[product.model];return galleryMarkup(pp?[`assets/admin-mattress-thumbs/r${pp[1]+1}-c${pp[0]+1}.webp`]:[],product.model,'mattress');}
  function publicSpec([k,v]){return k&&v&&!/производител|артикул|sku/i.test(k);}
  function specsMarkup(specs){const entries=Object.entries(specs||{}).filter(publicSpec);if(!entries.length)return '<p class="pd-description">Характеристики уточняйте при оформлении заказа.</p>';return `<div class="pd-specs">${entries.map(([k,v])=>`<div class="pd-spec"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>`;}
  function variantFor(product,color,size){const vars=Array.isArray(product.variants)?product.variants:[];return vars.find(v=>(!color||colorKey(v.color)===colorKey(color))&&(!size||v.size===size))||vars.find(v=>(!size||v.size===size))||vars.find(v=>(!color||colorKey(v.color)===colorKey(color)))||null;}
  function validFurniturePrice(value){const n=Number(value);return Number.isFinite(n)&&n>=5000?n:null;}
  function furniturePrice(product,variant,size=''){const direct=validFurniturePrice(variant?.price);if(direct)return direct;const vars=Array.isArray(product?.variants)?product.variants:[];const same=vars.map(v=>String(v?.size||'')===String(size||'')?validFurniturePrice(v?.price):null).filter(Boolean);if(same.length)return Math.min(...same);const base=validFurniturePrice(product?.price);if(base)return base;const all=vars.map(v=>validFurniturePrice(v?.price)).filter(Boolean);return all.length?Math.min(...all):null;}

  function colorImageFor(product,color){if(!color)return '';const map=product?.colorImages||{};if(map[color])return map[color];const wanted=colorKey(color);const key=Object.keys(map).find(k=>colorKey(k)===wanted);return key?map[key]:'';}
  function updateFurnitureImage(){
    if(!furnitureProduct||!selectedColor)return;const src=colorImageFor(furnitureProduct,selectedColor);if(!src)return;const index=galleryImages.indexOf(src);if(index>=0){if(index!==galleryIndex)showGallery(index);return;}const img=$('#pdMainImage');const media=$('#pdMainMedia');if(img&&img.getAttribute('src')!==src){const preload=new Image();preload.onload=()=>{img.classList.add('is-changing');setTimeout(()=>{img.src=src;img.classList.remove('is-changing')},90);};preload.onerror=()=>img.classList.remove('is-changing');preload.src=src;}if(media)media.style.setProperty('--pd-bg',`url("${src.replace(/"/g,'\\"')}")`);$$('[data-pd-index]').forEach(el=>el.classList.remove('is-active'));
  }
  function renderFurniture(product){
    furnitureProduct=product;const isBed=product.category==='beds';const view=isBed?'beds':'sofas';const label=isBed?'Кровати':'Диваны';const typeLabel=isBed?'Кровать':'Диван';setBack(view,label);setDocumentMeta(product.seoTitle||product.title,product.seoDescription||product.description);
    const variantColors=uniq((product.variants||[]).map(v=>v?.color));const colors=variantColors.length?variantColors:uniq(product.colors||[]);const sizes=sortSizes(product.sizes?.length?product.sizes:(product.variants||[]).map(v=>v.size));selectedColor=colors[0]||'';selectedSize=sizes[0]||'';const variant=variantFor(product,selectedColor,selectedSize);const price=furniturePrice(product,variant,selectedSize);
    root.innerHTML=`<article class="pd-product">
      ${galleryMarkup(product.images,product.title)}
      <div class="pd-content-column">
        <section class="pd-info-card">
          <div class="pd-kicker">Каталог мебели</div>
          <div class="pd-tags"><span class="pd-tag">${typeLabel}</span>${product.subtype?`<span class="pd-tag neutral">${esc(product.subtype)}</span>`:''}${product.hit?'<span class="pd-tag gold">Хит продаж</span>':''}</div>
          <h1>${esc(product.title)}</h1>
          <p class="pd-subtitle">${esc(product.summary||String(product.description||'').split(/(?<=[.!?])\s+/)[0]||'Выберите подходящий вариант модели.')}</p>
          <div class="pd-price-row"><div class="pd-price-stack"><div class="pd-price-caption">Цена выбранного варианта</div><div class="pd-old-row" ${discountPercent(product)>0?'':'style="display:none"'}><span class="pd-old-price" id="pdFurnitureOldPrice">${oldPrice(price,discountPercent(product))?rub(oldPrice(price,discountPercent(product))):''}</span><span class="pd-discount" id="pdFurnitureDiscount">−${discountPercent(product)}%</span></div><div class="pd-price" id="pdFurniturePrice">${rub(price)}</div></div>${detailPromoMarkup(product)}</div>
          ${colors.length?`<div class="pd-choice"><div class="pd-choice-head"><label>Цвет</label><b id="pdColorName">${esc(selectedColor)}</b></div><div class="pd-colors">${colors.map((c,i)=>`<button type="button" class="pd-color ${i===0?'is-active':''}" data-pd-color="${esc(c)}">${esc(c)}</button>`).join('')}</div></div>`:''}
          ${sizes.length?`<div class="pd-choice"><div class="pd-choice-head"><label>${isBed?'Спальное место':'Размер / вариант'}</label><b>${sizes.length} вариантов</b></div><div class="pd-size-grid">${sizes.map((s,i)=>`<button type="button" class="pd-size ${i===0?'is-active':''}" data-pd-size="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>`:''}
          <div class="pd-action-stack"><a class="pd-max-btn" href="${MAX_LINK}" target="_blank" rel="noopener"><img src="${MAX_ICON}" alt="" aria-hidden="true"><span>Получить консультацию в MAX</span></a><div class="pd-note">Перед оформлением подтвердим актуальное наличие, выбранный цвет и комплектацию.</div></div>
        </section>
        <section class="pd-section-card"><div class="pd-section-title"><span>01</span><h2>Характеристики</h2></div>${specsMarkup(product.specs)}<div id="pdVariantSpecs"></div></section>
        <section class="pd-section-card"><div class="pd-section-title"><span>02</span><h2>Описание модели</h2></div><p class="pd-description">${esc(product.description||'Подробности по модели уточняйте при оформлении заказа.')}</p></section>
      </div>
    </article>`;
    updateFurnitureSelection();
  }

  function updateFurnitureSelection(){
    if(!furnitureProduct)return;updateFurnitureImage();const variant=variantFor(furnitureProduct,selectedColor,selectedSize);const price=furniturePrice(furnitureProduct,variant,selectedSize);const discount=discountPercent(furnitureProduct),compare=oldPrice(price,discount);const p=$('#pdFurniturePrice'),op=$('#pdFurnitureOldPrice'),db=$('#pdFurnitureDiscount'),oldRow=op?.closest('.pd-old-row');if(p)p.textContent=rub(price);if(op)op.textContent=compare?rub(compare):'';if(db)db.textContent=`−${discount}%`;if(oldRow)oldRow.style.display=discount>0&&compare?'':'none';
    const subtitle=$('.pd-subtitle');
    if(subtitle&&furnitureProduct.category==='beds'&&selectedSize){
      const base=String(furnitureProduct.summary||String(furnitureProduct.description||'').split(/(?<=[.!?])\s+/)[0]||'').trim();
      const synced=base.match(/Спальное место\s*[—-]/i)?base.replace(/Спальное место\s*[—-]\s*[^.]+\.?\s*/i,`Спальное место — ${selectedSize}. `):`Спальное место — ${selectedSize}. ${base}`;
      subtitle.textContent=synced.trim();
    }
    const attrs=variant?.attributes||{};
    const normSpecKey=value=>String(value||'').trim().toLowerCase().replace(/ё/g,'е');
    $$('.pd-spec').forEach(row=>{
      const keyEl=row.querySelector('span'),valueEl=row.querySelector('b');
      if(!keyEl||!valueEl)return;
      const key=normSpecKey(keyEl.textContent);
      if(furnitureProduct.category==='beds'&&selectedSize&&/спальн.*мест/.test(key)){valueEl.textContent=selectedSize;return;}
      if(key==='глубина'){const depth=furnitureDepthValue(furnitureProduct,variant,selectedSize);if(depth){valueEl.textContent=depth;return;}}
      const attrKey=Object.keys(attrs).find(k=>normSpecKey(k)===key);
      if(attrKey&&attrs[attrKey]){valueEl.textContent=attrs[attrKey];return;}
      if(furnitureProduct.category==='beds'&&selectedSize&&(key==='размер'||key==='размеры'||key==='размер спального места'))valueEl.textContent=selectedSize;
    });
    const extra=$('#pdVariantSpecs');if(extra){const entries=Object.entries(attrs).filter(([k,v])=>k&&v&&!['Цвет фасада','Спальное место','Размер'].includes(k)&&!/производител|артикул|sku/i.test(k));extra.innerHTML=entries.length?`<div class="pd-variant-note"><b>Выбранный вариант</b><div>${selectedColor?`<span>Цвет: ${esc(selectedColor)}</span>`:''}${selectedSize?`<span>Размер: ${esc(selectedSize)}</span>`:''}${entries.slice(0,4).map(([k,v])=>`<span>${esc(k)}: ${esc(v)}</span>`).join('')}</div></div>`:'';}
  }

  function renderMattress(product){
    setBack('mattresses','Матрасы');setDocumentMeta(product.seoTitle||product.model,product.seoDescription||product.description||product.intro);const variants=sortVariantsBySize((product.variants||[]).filter(v=>String(v.size)!=='600х1200'));const first=variants[0]||product.variants?.[0]||{price:0,size:'—'};const firmness=getFirmness(product);
    root.innerHTML=`<article class="pd-product">
      ${mattressImageMarkup(product)}
      <div class="pd-content-column">
        <section class="pd-info-card">
          <div class="pd-kicker">Каталог матрасов</div><div class="pd-tags"><span class="pd-tag">${esc(product.category||'Матрас')}</span></div>
          <h1>${esc(product.model)}</h1><p class="pd-subtitle">${esc(product.intro||'Матрас для комфортного ежедневного сна.')}</p>
          <div class="pd-price-row"><div class="pd-price-stack"><div class="pd-old-row" ${discountPercent(product)>0?'':'style="display:none"'}><span class="pd-old-price" id="pdOldPrice">${oldPrice(first.price,discountPercent(product))?rub(oldPrice(first.price,discountPercent(product))):''}</span><span class="pd-discount">−${discountPercent(product)}%</span></div><div class="pd-price" id="pdPrice">${rub(first.price)}</div></div>${detailPromoMarkup(product)}</div>
          <div class="pd-choice"><div class="pd-choice-head"><label>Размер</label><b>${variants.length} вариантов</b></div><select class="pd-select" id="pdVariant">${variants.map((v,i)=>`<option value="${Number(v.price)||0}" ${i===0?'selected':''}>${esc(v.size)} — ${rub(v.price)}</option>`).join('')}</select></div>
          <div class="pd-action-stack"><a class="pd-max-btn" href="${MAX_LINK}" target="_blank" rel="noopener"><img src="${MAX_ICON}" alt="" aria-hidden="true"><span>Получить консультацию в MAX</span></a></div>
        </section>
        <section class="pd-section-card"><div class="pd-section-title"><span>01</span><h2>Состав и характеристики</h2></div><div class="pd-specs"><div class="pd-spec"><span>Жёсткость</span><b>${esc(firmness)}</b></div><div class="pd-spec"><span>Категория</span><b>${esc(product.category||'Матрасы')}</b></div></div><p class="pd-description pd-description-spaced">${esc(product.description||product.intro||'Описание уточняется')}</p></section>
        <section class="pd-section-card"><div class="pd-section-title"><span>02</span><h2>Размеры и цены</h2></div><div class="pd-table-wrap"><table class="pd-variants"><thead><tr><th>Размер</th><th>Цена</th></tr></thead><tbody>${variants.map(v=>`<tr><td>${esc(v.size)}</td><td>${rub(v.price)}</td></tr>`).join('')}</tbody></table></div></section>
      </div>
    </article>`;
    $('#pdVariant')?.addEventListener('change',e=>{const price=Number(e.target.value)||0;const p=$('#pdPrice'),op=$('#pdOldPrice');if(p)p.textContent=rub(price);if(op)op.textContent=oldPrice(price,discountPercent(product))?rub(oldPrice(price,discountPercent(product))):'';});
  }

  function readyGalleryImages(){if(galleryImages.length===1)return galleryImages;return galleryImages.filter(src=>$$('#pdThumbs img').some(img=>img.getAttribute('src')===src&&img.naturalWidth>0));}
  function updateGalleryVisibility(){
    const buttons=$$('[data-pd-index]');
    buttons.forEach(button=>{const img=button.querySelector('img');button.hidden=!img?.naturalWidth;});
    const ready=readyGalleryImages(),multiple=ready.length>1;
    const thumbs=$('#pdThumbs');if(thumbs)thumbs.hidden=!multiple;
    $$('.pd-gallery-arrow').forEach(button=>button.hidden=!multiple);
    const counter=$('#pdCounter');if(counter)counter.textContent=multiple?`${Math.max(0,ready.indexOf(galleryImages[galleryIndex]))+1} / ${ready.length}`:ready.length?'1 фото':'Фото загружается';
  }
  function showGallery(index){
    if(!galleryImages.length)return;
    const len=galleryImages.length,ready=readyGalleryImages();if(!ready.length)return;
    const step=index<galleryIndex?-1:1;let next=(index+len)%len;
    for(let i=0;i<len&&!ready.includes(galleryImages[next]);i++)next=(next+step+len)%len;
    galleryIndex=next;const src=galleryImages[next],img=$('#pdMainImage'),media=$('#pdMainMedia');
    if(img){img.classList.add('is-changing');const preload=new Image();preload.onload=()=>{img.src=src;img.classList.remove('is-changing')};preload.onerror=()=>{img.classList.remove('is-changing');removeBrokenGalleryPhoto(src)};preload.src=src;}
    if(media)media.style.setProperty('--pd-bg',`url("${src.replace(/"/g,'\\"')}")`);
    $$('[data-pd-index]').forEach(el=>el.classList.toggle('is-active',Number(el.dataset.pdIndex)===galleryIndex));
    updateGalleryVisibility();document.querySelector(`[data-pd-index="${galleryIndex}"]`)?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
  }

  function removeBrokenGalleryPhoto(src){
    const index=galleryImages.indexOf(src);if(index<0)return;
    galleryImages.splice(index,1);if(galleryIndex>index)galleryIndex--;
    const main=$('#pdMainImage'),media=$('#pdMainMedia'),thumbs=$('#pdThumbs');
    $$('[data-pd-index]').forEach(button=>{
      const photo=button.querySelector('img')?.getAttribute('src');
      if(photo===src){button.remove();return;}
      const next=galleryImages.indexOf(photo);button.dataset.pdIndex=String(next);
      button.setAttribute('aria-label',`Фото ${next+1}`);
      button.classList.toggle('is-active',next===galleryIndex);
    });
    if(galleryImages.length<2){thumbs?.remove();$$('.pd-gallery-arrow').forEach(button=>button.remove());}
    updateGalleryVisibility();
    if(!galleryImages.length){
      main?.removeAttribute('src');if(main)main.hidden=true;
      media?.classList.add('is-unavailable');media?.style.setProperty('--pd-bg','none');
      media?.querySelector('.pd-zoom')?.setAttribute('hidden','');
      const note=document.createElement('span');note.className='pd-unavailable-note';note.textContent='Фото временно недоступно';media?.appendChild(note);
      const counter=$('#pdCounter');if(counter)counter.textContent='Фото недоступно';
    }else if(main?.getAttribute('src')===src){showGallery(Math.max(0,galleryIndex));}
  }
  document.addEventListener('load',event=>{
    if(event.target instanceof HTMLImageElement&&event.target.closest('.pd-thumb'))updateGalleryVisibility();
  },true);
  document.addEventListener('error',event=>{
    const image=event.target;
    if(!(image instanceof HTMLImageElement))return;
    if(image.closest('.pd-thumb')||image.id==='pdMainImage')removeBrokenGalleryPhoto(image.getAttribute('src'));
  },true);

  document.addEventListener('click',e=>{
    const dir=e.target.closest('[data-pd-dir]');if(dir){showGallery(galleryIndex+(Number(dir.dataset.pdDir)||1));return;}
    const thumb=e.target.closest('[data-pd-index]');if(thumb){showGallery(Number(thumb.dataset.pdIndex)||0);return;}
    const color=e.target.closest('[data-pd-color]');if(color){selectedColor=color.dataset.pdColor||'';$$('[data-pd-color]').forEach(b=>b.classList.toggle('is-active',b===color));const name=$('#pdColorName');if(name)name.textContent=selectedColor;updateFurnitureSelection();return;}
    const size=e.target.closest('[data-pd-size]');if(size){selectedSize=size.dataset.pdSize||'';$$('[data-pd-size]').forEach(b=>b.classList.toggle('is-active',b===size));updateFurnitureSelection();}
  });
  document.addEventListener('keydown',e=>{if(!galleryImages.length||e.target.closest('input,select,textarea,[contenteditable]')||$('#productLightbox')?.open)return;if(e.key==='ArrowLeft')showGallery(galleryIndex-1);if(e.key==='ArrowRight')showGallery(galleryIndex+1);});

  async function load(){
    try{
      const kind=params.get('kind')||'furniture';
      if(kind==='mattress'){
        const model=params.get('model')||'';const sets=await Promise.all(DATA_FILES.map(f=>fetch(`${f}?v=20260918-quality1`,{cache:'no-store'}).then(r=>r.json())));let all=sets.flat();if(window.NoktenaCatalog)all=await window.NoktenaCatalog.mergeMattresses(all);all=all.filter(x=>!REMOVE_MODELS.has(x.model));const product=all.find(x=>x.model===model);if(!product)throw new Error('Матрас не найден');renderMattress(product);productSEO(product,'mattress',product.variants?.[0]?.price);renderSimilar(all,product,'mattress');return;
      }
      const id=params.get('id')||'';const r=await fetch(`data/furniture.json?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const raw=await r.json();const data=window.NoktenaCatalog?await window.NoktenaCatalog.mergeFurniture(raw):raw;const product=[...(data.beds||[]),...(data.sofas||[])].find(x=>x.id===id);if(!product)throw new Error('Товар не найден');renderFurniture(product);productSEO(product,'furniture',furniturePrice(product,null));renderSimilar([...(data.beds||[]),...(data.sofas||[])],product,'furniture');
    }catch(e){console.error(e);root.innerHTML='<div class="pd-error"><h1>Не удалось открыть товар</h1><p>Вернитесь в каталог и выберите модель ещё раз.</p><a href="/">Вернуться на главную</a></div>';}
  }
  load();
})();
