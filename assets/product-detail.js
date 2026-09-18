(() => {
  'use strict';

  const MAX_LINK='https://max.ru/u/f9LHodD0cOKZqie3BJvn11xgsNvxJK_kFOqYtKyFuZ2uMitoxZIwNaH8-NY';
  const MAX_ICON='https://max.ru/s/img/big-logo.png';
  const DATA_FILES=['data/data1.json','data/data2.json','data/data3.json','data/data4.json','data/data5.json','data/data6.json'];
  const REMOVE_MODELS=new Set(['Матрас Mega холкон TFK','Матрас Mega холкон-кокос TFK','Матрас MEGA Бикокос ППУ 10 ECO','Матрас Стандарт Детский','Подушка Обнимашки']);
  const FIRMNESS={'Подушка Память форма':'Средняя','Матрас Стандарт':'Ниже средней','Матрас Барселона ZAСоня Gray Night':'1 сторона — выше средней / 2 сторона — средняя','Матрас Касабланка ZAСоня Gray Night':'Средняя','Матрас Валенсия ZAСоня Gray Night':'Средняя','Матрас Ибица ZAСоня Gray Night':'Средняя','Матрас Imperial Suite латекс-кокос Gray Night':'Жёсткая','Матрас MEGA MULT ЗИМА ЛЕТО MultiPocket Gray Night':'1 сторона — мягкая / 2 сторона — средняя','Матрас MEGA MULT ELITE MultiPocket Gray Night':'1 сторона — мягкая / 2 сторона — средняя'};
  const PHOTO_POS={'Матрас Imperial Suite кокос Gray Night':[0,0],'Матрас Imperial Suite латекс-кокос Gray Night':[1,0],'Матрас Imperial Suite холкон-кокос Gray Night':[2,0],'Матрас MEGA MULT ELITE MultiPocket Gray Night':[3,0],'Матрас MEGA MULT ЗИМА ЛЕТО MultiPocket Gray Night':[4,0],'Матрас MEGA MULT кокос ППУ 20 MultiPocket Gray Night':[0,1],'Матрас MEGA Элит Блитц TFK Gray Night':[1,1],'Матрас Барселона ZAСоня Gray Night':[2,1],'Матрас Валенсия ZAСоня Gray Night':[3,1],'Матрас Ибица ZAСоня Gray Night':[4,1],'Матрас Касабланка ZAСоня Gray Night':[0,2],'Матрас Стандарт':[1,2],'Матрас Mega кокос 10 TFK Gray Night':[2,2],'Матрас Mega кокос 10 TFK':[3,2],'Матрас Mega кокос 20 TFK Gray Night':[4,2],'Матрас Mega кокос 20 TFK':[0,3],'Матрас Mega кокос 30 TFK Gray Night':[1,3],'Матрас Mega кокос 30 TFK':[2,3],'Матрас MEGA ППУ 10 ECO':[3,3],'Матрас Mega холкон TFK Gray Night':[4,3],'Матрас Mega холкон-кокос TFK Gray Night':[0,4],'Наматрасник "Непромокаемый чехол"':[1,4],'Подушка Память форма':[2,4],'Матрас ППУ 16 ZAСоня':[3,4],'Матрас Солид ZaСоня':[4,4]};

  const $=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rub=n=>Number.isFinite(Number(n))?`${Math.round(Number(n)).toLocaleString('ru-RU')} ₽`:'Цена по запросу';
  const oldPrice=n=>Math.round((Number(n)/0.7)/100)*100;
  const params=new URLSearchParams(location.search);
  const root=$('#productRoot');
  let galleryImages=[];
  let galleryIndex=0;

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

  function setDocumentMeta(title,description){
    document.title=`${title} — НОКТЕНА`;
    const meta=document.querySelector('meta[name="description"]');
    if(meta)meta.content=description||`Характеристики и цена: ${title}.`;
  }

  function setBack(view,label){
    const url=`/#${view}`;
    const top=$('#backTop');
    if(top)top.href=url;
    const b=$('#breadcrumbs');
    if(b)b.innerHTML=`<a href="/">Главная</a><span>›</span><a href="${url}">${esc(label)}</a><span>›</span><span>Товар</span>`;
  }

  function galleryMarkup(images,title){
    galleryImages=[...new Set((images||[]).filter(Boolean))];
    galleryIndex=0;
    if(!galleryImages.length)galleryImages=['assets/hero-noktena-final.png?v=20260908-final2'];
    const first=galleryImages[0];
    return `<div class="pd-gallery-card">
      <div class="pd-main-media" id="pdMainMedia" style="--pd-bg:url('${esc(first)}')">
        <img id="pdMainImage" src="${esc(first)}" alt="${esc(title)}" decoding="async" referrerpolicy="no-referrer">
        ${galleryImages.length>1?`<button class="pd-gallery-arrow prev" type="button" data-pd-dir="-1" aria-label="Предыдущее фото">‹</button><button class="pd-gallery-arrow next" type="button" data-pd-dir="1" aria-label="Следующее фото">›</button>`:''}
        <span class="pd-counter" id="pdCounter">1 / ${galleryImages.length}</span>
      </div>
      ${galleryImages.length>1?`<div class="pd-thumbs" id="pdThumbs">${galleryImages.map((src,i)=>`<button class="pd-thumb ${i===0?'is-active':''}" type="button" data-pd-index="${i}" aria-label="Фото ${i+1}"><img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer"></button>`).join('')}</div>`:''}
    </div>`;
  }

  function mattressImageMarkup(product){
    const pp=PHOTO_POS[product.model];
    if(!pp)return galleryMarkup([],product.model);
    galleryImages=[];
    return `<div class="pd-gallery-card"><div class="pd-main-media pd-sprite-media"><div class="pd-sprite" style="--col:${pp[0]};background-image:url('assets/product-row-${pp[1]+1}.webp?v=20260905-photos2')" role="img" aria-label="${esc(product.model)}"></div></div></div>`;
  }

  function specsMarkup(specs){
    const entries=Object.entries(specs||{}).filter(([k,v])=>k&&v);
    if(!entries.length)return '<p class="pd-description">Характеристики уточняйте при оформлении заказа.</p>';
    return `<div class="pd-specs">${entries.map(([k,v])=>`<div class="pd-spec"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>`;
  }

  function renderFurniture(product){
    const isBed=product.category==='beds';
    const view=isBed?'beds':'sofas';
    const label=isBed?'Кровати':'Диваны';
    const typeLabel=isBed?'Кровать':'Диван';
    setBack(view,label);
    setDocumentMeta(product.title,product.description);
    const status=product.available?'В наличии':'Наличие уточняйте';
    root.innerHTML=`<article class="pd-product">
      ${galleryMarkup(product.images,product.title)}
      <div>
        <section class="pd-info-card">
          <div class="pd-tags"><span class="pd-tag">${typeLabel}</span>${product.subtype?`<span class="pd-tag neutral">${esc(product.subtype)}</span>`:''}${product.brand?`<span class="pd-tag neutral">${esc(product.brand)}</span>`:''}</div>
          <h1>${esc(product.title)}</h1>
          <p class="pd-subtitle">Фотографии, основные характеристики и доступная информация о модели.</p>
          <div class="pd-price-row"><div class="pd-price-stack"><div class="pd-price">${rub(product.price)}</div></div><div class="pd-status">${esc(status)}</div></div>
          <div class="pd-action-stack"><a class="pd-max-btn" href="${MAX_LINK}" target="_blank" rel="noopener"><img src="${MAX_ICON}" alt="" aria-hidden="true"><span>Уточнить и заказать в MAX</span></a><div class="pd-note">Цвет, комплектацию и наличие конкретного варианта уточняйте перед оформлением заказа.</div></div>
        </section>
        <section class="pd-section-card"><h2>Характеристики</h2>${specsMarkup(product.specs)}</section>
        <section class="pd-section-card"><h2>Описание</h2><p class="pd-description">${esc(product.description||'Подробности по модели уточняйте при оформлении заказа.')}</p></section>
      </div>
    </article>`;
  }

  function renderMattress(product){
    setBack('mattresses','Матрасы');
    setDocumentMeta(product.model,product.description||product.intro);
    const variants=(product.variants||[]).filter(v=>String(v.size)!=='600х1200');
    const first=variants[0]||product.variants?.[0]||{price:0,size:'—'};
    const firmness=getFirmness(product);
    root.innerHTML=`<article class="pd-product">
      ${mattressImageMarkup(product)}
      <div>
        <section class="pd-info-card">
          <div class="pd-tags"><span class="pd-tag">${esc(product.category||'Матрас')}</span>${product.article?`<span class="pd-tag neutral">Арт. ${esc(product.article)}</span>`:''}</div>
          <h1>${esc(product.model)}</h1>
          <p class="pd-subtitle">${esc(product.intro||'Матрас для комфортного ежедневного сна.')}</p>
          <div class="pd-price-row"><div class="pd-price-stack"><div class="pd-old-row"><span class="pd-old-price" id="pdOldPrice">${rub(oldPrice(first.price))}</span><span class="pd-discount">−30%</span></div><div class="pd-price" id="pdPrice">${rub(first.price)}</div></div><div class="pd-status">Цена сентября<br>до 30 сентября</div></div>
          <div class="pd-field"><label for="pdVariant">Размер</label><select class="pd-select" id="pdVariant">${variants.map((v,i)=>`<option value="${Number(v.price)||0}" ${i===0?'selected':''}>${esc(v.size)} — ${rub(v.price)}</option>`).join('')}</select></div>
          <div class="pd-action-stack"><a class="pd-max-btn" href="${MAX_LINK}" target="_blank" rel="noopener"><img src="${MAX_ICON}" alt="" aria-hidden="true"><span>Уточнить и заказать в MAX</span></a></div>
        </section>
        <section class="pd-section-card"><h2>Состав и характеристики</h2><div class="pd-specs"><div class="pd-spec"><span>Жёсткость</span><b>${esc(firmness)}</b></div>${product.article?`<div class="pd-spec"><span>Артикул</span><b>${esc(product.article)}</b></div>`:''}<div class="pd-spec"><span>Категория</span><b>${esc(product.category||'Матрасы')}</b></div></div><p class="pd-description" style="margin-top:16px">${esc(product.description||product.intro||'Описание уточняется')}</p></section>
        <section class="pd-section-card"><h2>Размеры и цены</h2><div style="overflow:auto"><table class="pd-variants"><thead><tr><th>Размер</th><th>Цена</th></tr></thead><tbody>${variants.map(v=>`<tr><td>${esc(v.size)}</td><td>${rub(v.price)}</td></tr>`).join('')}</tbody></table></div></section>
      </div>
    </article>`;
    $('#pdVariant')?.addEventListener('change',e=>{
      const price=Number(e.target.value)||0;
      const p=$('#pdPrice'),op=$('#pdOldPrice');
      if(p)p.textContent=rub(price);
      if(op)op.textContent=rub(oldPrice(price));
    });
  }

  function showGallery(index){
    if(!galleryImages.length)return;
    const len=galleryImages.length;
    galleryIndex=(index+len)%len;
    const src=galleryImages[galleryIndex];
    const img=$('#pdMainImage');
    const media=$('#pdMainMedia');
    if(img){img.style.opacity='.35';const preload=new Image();preload.onload=()=>{img.src=src;img.style.opacity='1'};preload.onerror=()=>{img.style.opacity='1'};preload.src=src;}
    if(media)media.style.setProperty('--pd-bg',`url("${src.replace(/"/g,'\\"')}")`);
    const counter=$('#pdCounter');if(counter)counter.textContent=`${galleryIndex+1} / ${len}`;
    document.querySelectorAll('[data-pd-index]').forEach(el=>el.classList.toggle('is-active',Number(el.dataset.pdIndex)===galleryIndex));
    const active=document.querySelector(`[data-pd-index="${galleryIndex}"]`);active?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
  }

  document.addEventListener('click',e=>{
    const dir=e.target.closest('[data-pd-dir]');
    if(dir){showGallery(galleryIndex+(Number(dir.dataset.pdDir)||1));return;}
    const thumb=e.target.closest('[data-pd-index]');
    if(thumb){showGallery(Number(thumb.dataset.pdIndex)||0);}
  });
  document.addEventListener('keydown',e=>{if(galleryImages.length>1&&e.key==='ArrowLeft')showGallery(galleryIndex-1);if(galleryImages.length>1&&e.key==='ArrowRight')showGallery(galleryIndex+1)});

  async function init(){
    try{
      const kind=params.get('kind');
      if(kind==='furniture'){
        const id=params.get('id');
        const r=await fetch(`data/furniture.json?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);
        const data=await r.json();
        const product=[...(data.beds||[]),...(data.sofas||[])].find(x=>x.id===id);
        if(!product)throw new Error('Товар не найден');
        renderFurniture(product);
        return;
      }
      if(kind==='mattress'){
        const model=params.get('model');
        const sets=await Promise.all(DATA_FILES.map(f=>fetch(`${f}?v=20260918-product`,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`${f} ${r.status}`);return r.json()})));
        const product=sets.flat().filter(x=>!REMOVE_MODELS.has(x.model)).find(x=>x.model===model);
        if(!product)throw new Error('Товар не найден');
        renderMattress(product);
        return;
      }
      throw new Error('Не указан товар');
    }catch(err){
      console.error(err);
      root.innerHTML=`<div class="pd-error"><b>Не удалось открыть товар.</b><br><br><a href="/">Вернуться в каталог НОКТЕНА</a></div>`;
    }
  }

  init();
})();
