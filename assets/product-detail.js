(() => {
  'use strict';

  const MAX_LINK='https://max.ru/u/f9LHodD0cOKZqie3BJvn11xgsNvxJK_kFOqYtKyFuZ2uMitoxZIwNaH8-NY';
  const MAX_ICON='https://max.ru/s/img/big-logo.png';
  const DATA_FILES=['data/data1.json','data/data2.json','data/data3.json','data/data4.json','data/data5.json','data/data6.json'];
  const REMOVE_MODELS=new Set(['Матрас Mega холкон TFK','Матрас Mega холкон-кокос TFK','Матрас MEGA Бикокос ППУ 10 ECO','Матрас Стандарт Детский','Подушка Обнимашки']);
  const FIRMNESS={'Подушка Память форма':'Средняя','Матрас Стандарт':'Ниже средней','Матрас Барселона ZAСоня Gray Night':'1 сторона — выше средней / 2 сторона — средняя','Матрас Касабланка ZAСоня Gray Night':'Средняя','Матрас Валенсия ZAСоня Gray Night':'Средняя','Матрас Ибица ZAСоня Gray Night':'Средняя','Матрас Imperial Suite латекс-кокос Gray Night':'Жёсткая','Матрас MEGA MULT ЗИМА ЛЕТО MultiPocket Gray Night':'1 сторона — мягкая / 2 сторона — средняя','Матрас MEGA MULT ELITE MultiPocket Gray Night':'1 сторона — мягкая / 2 сторона — средняя'};
  const PHOTO_POS={'Матрас Imperial Suite кокос Gray Night':[0,0],'Матрас Imperial Suite латекс-кокос Gray Night':[1,0],'Матрас Imperial Suite холкон-кокос Gray Night':[2,0],'Матрас MEGA MULT ELITE MultiPocket Gray Night':[3,0],'Матрас MEGA MULT ЗИМА ЛЕТО MultiPocket Gray Night':[4,0],'Матрас MEGA MULT кокос ППУ 20 MultiPocket Gray Night':[0,1],'Матрас MEGA Элит Блитц TFK Gray Night':[1,1],'Матрас Барселона ZAСоня Gray Night':[2,1],'Матрас Валенсия ZAСоня Gray Night':[3,1],'Матрас Ибица ZAСоня Gray Night':[4,1],'Матрас Касабланка ZAСоня Gray Night':[0,2],'Матрас Стандарт':[1,2],'Матрас Mega кокос 10 TFK Gray Night':[2,2],'Матрас Mega кокос 10 TFK':[3,2],'Матрас Mega кокос 20 TFK Gray Night':[4,2],'Матрас Mega кокос 20 TFK':[0,3],'Матрас Mega кокос 30 TFK Gray Night':[1,3],'Матрас Mega кокос 30 TFK':[2,3],'Матрас MEGA ППУ 10 ECO':[3,3],'Матрас Mega холкон TFK Gray Night':[4,3],'Матрас Mega холкон-кокос TFK Gray Night':[0,4],'Наматрасник "Непромокаемый чехол"':[1,4],'Подушка Память форма':[2,4],'Матрас ППУ 16 ZAСоня':[3,4],'Матрас Солид ZaСоня':[4,4]};

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rub=n=>Number.isFinite(Number(n))?`${Math.round(Number(n)).toLocaleString('ru-RU')} ₽`:'Цена по запросу';
  const oldPrice=n=>Math.round((Number(n)/0.7)/100)*100;
  const uniq=list=>[...new Set((list||[]).filter(Boolean).map(v=>String(v).trim()).filter(Boolean))];
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
  function colorCss(name){const n=String(name||'').toLowerCase();const map=[['беж','#d8c4a6'],['сер','#8b8c90'],['голуб','#91b9cf'],['роз','#d8a8b4'],['чёр','#222'],['черн','#222'],['бел','#f8f6f0'],['корич','#76584a'],['зел','#718b77'],['син','#4c6687'],['борд','#7c3340'],['фиолет','#806b8c'],['жёлт','#d9b957'],['оранж','#c9824d']];const hit=map.find(([k])=>n.includes(k));return hit?hit[1]:'#b7afa5';}
  function setDocumentMeta(title,description){document.title=`${title} — НОКТЕНА`;const meta=document.querySelector('meta[name="description"]');if(meta)meta.content=String(description||`Характеристики и цена: ${title}.`).replace(/\s+/g,' ').slice(0,180);}
  function setBack(view,label){const url=`/#${view}`;const top=$('#backTop');if(top)top.href=url;const b=$('#breadcrumbs');if(b)b.innerHTML=`<a href="/">Главная</a><span>›</span><a href="${url}">${esc(label)}</a><span>›</span><span>Карточка товара</span>`;}

  function galleryMarkup(images,title){
    galleryImages=uniq(images);galleryIndex=0;if(!galleryImages.length)galleryImages=['assets/hero-noktena-final.png?v=20260908-final2'];const first=galleryImages[0];
    return `<div class="pd-gallery-card">
      <div class="pd-main-media" id="pdMainMedia" style="--pd-bg:url('${esc(first)}')">
        <img id="pdMainImage" src="${esc(first)}" alt="${esc(title)}" decoding="async" referrerpolicy="no-referrer">
        ${galleryImages.length>1?`<button class="pd-gallery-arrow prev" type="button" data-pd-dir="-1" aria-label="Предыдущее фото">‹</button><button class="pd-gallery-arrow next" type="button" data-pd-dir="1" aria-label="Следующее фото">›</button>`:''}
        <span class="pd-counter" id="pdCounter">${galleryImages.length>1?`1 / ${galleryImages.length}`:'1 фото'}</span>
      </div>
      ${galleryImages.length>1?`<div class="pd-thumbs" id="pdThumbs">${galleryImages.map((src,i)=>`<button class="pd-thumb ${i===0?'is-active':''}" type="button" data-pd-index="${i}" aria-label="Фото ${i+1}"><img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer"></button>`).join('')}</div>`:''}
    </div>`;
  }
  function mattressImageMarkup(product){const pp=PHOTO_POS[product.model];if(!pp)return galleryMarkup([],product.model);galleryImages=[];return `<div class="pd-gallery-card"><div class="pd-main-media pd-sprite-media"><div class="pd-sprite" style="--col:${pp[0]};background-image:url('assets/product-row-${pp[1]+1}.webp?v=20260905-photos2')" role="img" aria-label="${esc(product.model)}"></div></div></div>`;}
  function specsMarkup(specs){const entries=Object.entries(specs||{}).filter(([k,v])=>k&&v);if(!entries.length)return '<p class="pd-description">Характеристики уточняйте при оформлении заказа.</p>';return `<div class="pd-specs">${entries.map(([k,v])=>`<div class="pd-spec"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>`;}
  function variantFor(product,color,size){const vars=Array.isArray(product.variants)?product.variants:[];return vars.find(v=>(!color||v.color===color)&&(!size||v.size===size))||vars.find(v=>(!size||v.size===size))||vars.find(v=>(!color||v.color===color))||null;}

  function renderFurniture(product){
    furnitureProduct=product;const isBed=product.category==='beds';const view=isBed?'beds':'sofas';const label=isBed?'Кровати':'Диваны';const typeLabel=isBed?'Кровать':'Диван';setBack(view,label);setDocumentMeta(product.title,product.description);
    const colors=uniq(product.colors?.length?product.colors:(product.variants||[]).map(v=>v.color));const sizes=uniq(product.sizes?.length?product.sizes:(product.variants||[]).map(v=>v.size));selectedColor=colors[0]||'';selectedSize=sizes[0]||'';const variant=variantFor(product,selectedColor,selectedSize);const price=variant?.price||product.price;
    root.innerHTML=`<article class="pd-product">
      ${galleryMarkup(product.images,product.title)}
      <div class="pd-content-column">
        <section class="pd-info-card">
          <div class="pd-kicker">Коллекция НОКТЕНА</div>
          <div class="pd-tags"><span class="pd-tag">${typeLabel}</span>${product.subtype?`<span class="pd-tag neutral">${esc(product.subtype)}</span>`:''}${product.hit?'<span class="pd-tag gold">Хит продаж</span>':''}</div>
          <h1>${esc(product.title)}</h1>
          <p class="pd-subtitle">${esc(product.summary||String(product.description||'').split(/(?<=[.!?])\s+/)[0]||'Выберите подходящий вариант модели.')}</p>
          <div class="pd-price-row"><div class="pd-price-stack"><div class="pd-price-caption">Цена выбранного варианта</div><div class="pd-price" id="pdFurniturePrice">${rub(price)}</div></div><div class="pd-status" id="pdFurnitureStatus">${product.available?'В наличии':'Наличие уточняйте'}</div></div>
          ${colors.length?`<div class="pd-choice"><div class="pd-choice-head"><label>Цвет</label><b id="pdColorName">${esc(selectedColor)}</b></div><div class="pd-colors">${colors.map((c,i)=>`<button type="button" class="pd-color ${i===0?'is-active':''}" data-pd-color="${esc(c)}" style="--swatch:${colorCss(c)}"><span class="pd-color-dot"></span><span>${esc(c)}</span></button>`).join('')}</div></div>`:''}
          ${sizes.length?`<div class="pd-choice"><div class="pd-choice-head"><label>${isBed?'Спальное место':'Размер / вариант'}</label><b>${sizes.length} вариантов</b></div><div class="pd-size-grid">${sizes.map((s,i)=>`<button type="button" class="pd-size ${i===0?'is-active':''}" data-pd-size="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>`:''}
          <div class="pd-action-stack"><a class="pd-primary-btn" href="${MAX_LINK}" target="_blank" rel="noopener"><span>Уточнить выбранный вариант</span><span aria-hidden="true">→</span></a><a class="pd-max-btn" href="${MAX_LINK}" target="_blank" rel="noopener"><img src="${MAX_ICON}" alt="" aria-hidden="true"><span>Написать в MAX</span></a><div class="pd-note">Перед оформлением подтвердим наличие, цвет и комплектацию выбранного варианта.</div></div>
        </section>
        <section class="pd-section-card"><div class="pd-section-title"><span>01</span><h2>Характеристики</h2></div>${specsMarkup(product.specs)}<div id="pdVariantSpecs"></div></section>
        <section class="pd-section-card"><div class="pd-section-title"><span>02</span><h2>Описание модели</h2></div><p class="pd-description">${esc(product.description||'Подробности по модели уточняйте при оформлении заказа.')}</p></section>
      </div>
    </article>`;
    updateFurnitureSelection();
  }

  function updateFurnitureSelection(){
    if(!furnitureProduct)return;const variant=variantFor(furnitureProduct,selectedColor,selectedSize);const price=variant?.price||furnitureProduct.price;const p=$('#pdFurniturePrice');if(p)p.textContent=rub(price);const st=$('#pdFurnitureStatus');if(st)st.textContent=variant?.availability||((variant?.available||furnitureProduct.available)?'В наличии':'Наличие уточняйте');const extra=$('#pdVariantSpecs');if(extra){const attrs=variant?.attributes||{};const entries=Object.entries(attrs).filter(([k,v])=>k&&v&&!['Цвет фасада','Спальное место','Размер'].includes(k));extra.innerHTML=entries.length?`<div class="pd-variant-note"><b>Выбранный вариант</b><div>${selectedColor?`<span>Цвет: ${esc(selectedColor)}</span>`:''}${selectedSize?`<span>Размер: ${esc(selectedSize)}</span>`:''}${entries.slice(0,4).map(([k,v])=>`<span>${esc(k)}: ${esc(v)}</span>`).join('')}</div></div>`:'';}
  }

  function renderMattress(product){
    setBack('mattresses','Матрасы');setDocumentMeta(product.model,product.description||product.intro);const variants=(product.variants||[]).filter(v=>String(v.size)!=='600х1200');const first=variants[0]||product.variants?.[0]||{price:0,size:'—'};const firmness=getFirmness(product);
    root.innerHTML=`<article class="pd-product">
      ${mattressImageMarkup(product)}
      <div class="pd-content-column">
        <section class="pd-info-card">
          <div class="pd-kicker">Матрасы НОКТЕНА</div><div class="pd-tags"><span class="pd-tag">${esc(product.category||'Матрас')}</span>${product.article?`<span class="pd-tag neutral">Арт. ${esc(product.article)}</span>`:''}</div>
          <h1>${esc(product.model)}</h1><p class="pd-subtitle">${esc(product.intro||'Матрас для комфортного ежедневного сна.')}</p>
          <div class="pd-price-row"><div class="pd-price-stack"><div class="pd-old-row"><span class="pd-old-price" id="pdOldPrice">${rub(oldPrice(first.price))}</span><span class="pd-discount">−30%</span></div><div class="pd-price" id="pdPrice">${rub(first.price)}</div></div><div class="pd-status"><span class="pd-status-gold">Цена сентября</span><small>до 30 сентября</small></div></div>
          <div class="pd-choice"><div class="pd-choice-head"><label>Размер</label><b>${variants.length} вариантов</b></div><select class="pd-select" id="pdVariant">${variants.map((v,i)=>`<option value="${Number(v.price)||0}" ${i===0?'selected':''}>${esc(v.size)} — ${rub(v.price)}</option>`).join('')}</select></div>
          <div class="pd-action-stack"><a class="pd-primary-btn" href="${MAX_LINK}" target="_blank" rel="noopener"><span>Уточнить выбранный размер</span><span aria-hidden="true">→</span></a><a class="pd-max-btn" href="${MAX_LINK}" target="_blank" rel="noopener"><img src="${MAX_ICON}" alt="" aria-hidden="true"><span>Написать в MAX</span></a></div>
        </section>
        <section class="pd-section-card"><div class="pd-section-title"><span>01</span><h2>Состав и характеристики</h2></div><div class="pd-specs"><div class="pd-spec"><span>Жёсткость</span><b>${esc(firmness)}</b></div>${product.article?`<div class="pd-spec"><span>Артикул</span><b>${esc(product.article)}</b></div>`:''}<div class="pd-spec"><span>Категория</span><b>${esc(product.category||'Матрасы')}</b></div></div><p class="pd-description pd-description-spaced">${esc(product.description||product.intro||'Описание уточняется')}</p></section>
        <section class="pd-section-card"><div class="pd-section-title"><span>02</span><h2>Размеры и цены</h2></div><div class="pd-table-wrap"><table class="pd-variants"><thead><tr><th>Размер</th><th>Цена</th></tr></thead><tbody>${variants.map(v=>`<tr><td>${esc(v.size)}</td><td>${rub(v.price)}</td></tr>`).join('')}</tbody></table></div></section>
      </div>
    </article>`;
    $('#pdVariant')?.addEventListener('change',e=>{const price=Number(e.target.value)||0;const p=$('#pdPrice'),op=$('#pdOldPrice');if(p)p.textContent=rub(price);if(op)op.textContent=rub(oldPrice(price));});
  }

  function showGallery(index){if(!galleryImages.length)return;const len=galleryImages.length;galleryIndex=(index+len)%len;const src=galleryImages[galleryIndex];const img=$('#pdMainImage');const media=$('#pdMainMedia');if(img){img.classList.add('is-changing');const preload=new Image();preload.onload=()=>{img.src=src;img.classList.remove('is-changing')};preload.onerror=()=>img.classList.remove('is-changing');preload.src=src;}if(media)media.style.setProperty('--pd-bg',`url("${src.replace(/"/g,'\\"')}")`);const counter=$('#pdCounter');if(counter)counter.textContent=`${galleryIndex+1} / ${len}`;$$('[data-pd-index]').forEach(el=>el.classList.toggle('is-active',Number(el.dataset.pdIndex)===galleryIndex));const active=document.querySelector(`[data-pd-index="${galleryIndex}"]`);active?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});}

  document.addEventListener('click',e=>{
    const dir=e.target.closest('[data-pd-dir]');if(dir){showGallery(galleryIndex+(Number(dir.dataset.pdDir)||1));return;}
    const thumb=e.target.closest('[data-pd-index]');if(thumb){showGallery(Number(thumb.dataset.pdIndex)||0);return;}
    const color=e.target.closest('[data-pd-color]');if(color){selectedColor=color.dataset.pdColor||'';$$('[data-pd-color]').forEach(b=>b.classList.toggle('is-active',b===color));const name=$('#pdColorName');if(name)name.textContent=selectedColor;updateFurnitureSelection();return;}
    const size=e.target.closest('[data-pd-size]');if(size){selectedSize=size.dataset.pdSize||'';$$('[data-pd-size]').forEach(b=>b.classList.toggle('is-active',b===size));updateFurnitureSelection();}
  });
  document.addEventListener('keydown',e=>{if(!galleryImages.length)return;if(e.key==='ArrowLeft')showGallery(galleryIndex-1);if(e.key==='ArrowRight')showGallery(galleryIndex+1);});

  async function load(){
    try{
      const kind=params.get('kind')||'furniture';
      if(kind==='mattress'){
        const model=params.get('model')||'';const sets=await Promise.all(DATA_FILES.map(f=>fetch(`${f}?v=20260918-premium`,{cache:'no-store'}).then(r=>r.json())));const all=sets.flat().filter(x=>!REMOVE_MODELS.has(x.model));const product=all.find(x=>x.model===model);if(!product)throw new Error('Матрас не найден');renderMattress(product);return;
      }
      const id=params.get('id')||'';const r=await fetch(`data/furniture.json?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const data=await r.json();const product=[...(data.beds||[]),...(data.sofas||[])].find(x=>x.id===id);if(!product)throw new Error('Товар не найден');renderFurniture(product);
    }catch(e){console.error(e);root.innerHTML='<div class="pd-error"><h1>Не удалось открыть товар</h1><p>Вернитесь в каталог и выберите модель ещё раз.</p><a href="/">Вернуться на главную</a></div>';}
  }
  load();
})();
