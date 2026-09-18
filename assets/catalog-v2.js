(() => {
  'use strict';
  const MAX_LINK='https://max.ru/u/f9LHodD0cOKZqie3BJvn11xgsNvxJK_kFOqYtKyFuZ2uMitoxZIwNaH8-NY';
  const MAX_ICON='https://max.ru/s/img/big-logo.png';
  const PAGE_SIZE=12;
  const views=new Set(['home','mattresses','beds','sofas']);
  const state={data:{beds:[],sofas:[]},page:{beds:1,sofas:1},query:{beds:'',sofas:''},sort:{beds:'price-asc',sofas:'price-asc'},subtype:'',gallery:new Map(),loaded:false};
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rub=n=>Number.isFinite(Number(n))?`${Math.round(Number(n)).toLocaleString('ru-RU')} ₽`:'Цена по запросу';

  const ICONS={
    home:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.8 10.6 12 3.8l8.2 6.8v9.1a.8.8 0 0 1-.8.8H4.6a.8.8 0 0 1-.8-.8v-9.1Z"/><path d="M9.3 20.5v-6.8h5.4v6.8"/></svg>`,
    mattress:`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="10" rx="3"/><path d="M3 12h18M7 7v10M17 7v10"/></svg>`,
    bed:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 19v-8m18 8v-8M3 16h18M5 11V7.5A2.5 2.5 0 0 1 7.5 5h3A2.5 2.5 0 0 1 13 7.5V11m0 0V8.7A2.7 2.7 0 0 1 15.7 6h1.6A2.7 2.7 0 0 1 20 8.7V11"/></svg>`,
    sofa:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12V8.7A2.7 2.7 0 0 1 7.7 6h8.6A2.7 2.7 0 0 1 19 8.7V12"/><path d="M4 11a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a2 2 0 0 0-4 0v1H6v-1a2 2 0 0 0-2-2ZM5 19v2m14-2v2"/></svg>`
  };

  function tabMarkup(){
    return `<div class="shop-tabs-shell"><div class="wrap shop-tabs" role="navigation" aria-label="Разделы магазина">
      <a class="shop-tab" data-shop-view="home" href="#home"><span class="shop-tab-icon">${ICONS.home}</span><span><b>Главная</b><small>НОКТЕНА</small></span></a>
      <a class="shop-tab" data-shop-view="mattresses" href="#mattresses"><span class="shop-tab-icon">${ICONS.mattress}</span><span><b>Матрасы</b><small>для сна</small></span></a>
      <a class="shop-tab" data-shop-view="beds" href="#beds"><span class="shop-tab-icon">${ICONS.bed}</span><span><b>Кровати</b><small>для спальни</small></span></a>
      <a class="shop-tab" data-shop-view="sofas" href="#sofas"><span class="shop-tab-icon">${ICONS.sofa}</span><span><b>Диваны</b><small>для отдыха</small></span></a>
    </div></div>`;
  }

  function routeFromHash(){const raw=(location.hash||'#home').slice(1).split('?')[0];return views.has(raw)?raw:'home';}
  function sections(){const cta=$('.cta')?.closest('section');return{hero:$('.hero'),delivery:$('#delivery'),about:$('#about'),guide:$('#guide'),catalog:$('#catalog'),hits:$('#homeHits'),furniture:$('#furnitureCatalog'),cta};}
  function show(el,on){if(el)el.classList.toggle('shop-view-hidden',!on)}
  function applyView(view,{scroll=true}={}){
    if(!views.has(view))view='home';const s=sections();
    show(s.hero,view==='home');show(s.delivery,view==='home');show(s.about,view==='home');show(s.guide,view==='home');show(s.hits,view==='home');show(s.catalog,view==='mattresses');show(s.furniture,view==='beds'||view==='sofas');show(s.cta,true);
    $$('[data-shop-view]').forEach(a=>a.classList.toggle('is-active',a.dataset.shopView===view));document.body.dataset.shopView=view;
    if(view==='beds'||view==='sofas')renderFurniture(view);if(view==='home')renderHomeHits();if(scroll)window.scrollTo({top:0,behavior:'smooth'});
  }

  function detailUrl(product){return `product.html?kind=furniture&id=${encodeURIComponent(product.id)}`;}
  function uniq(list){return [...new Set((list||[]).filter(Boolean).map(v=>String(v).trim()).filter(Boolean))];}
  function shortText(product){const t=String(product.summary||product.description||'').replace(/\s+/g,' ').trim();return t.length>180?`${t.slice(0,177).trim()}…`:t;}
  function chooseSpecs(product){
    const entries=Object.entries(product.specs||{}).filter(([k,v])=>k&&v&&k.toLowerCase()!=='производитель');
    const preferred=['Спальное место','Кроватное основание','Механизм трансформации','Бельевой ящик','Подъёмный механизм','Наполнение','Материал обивки','Количество спальных мест'];
    const out=[];for(const p of preferred){const e=entries.find(([k])=>k.toLowerCase()===p.toLowerCase());if(e&&!out.some(x=>x[0]===e[0]))out.push(e);if(out.length>=3)break;}for(const e of entries){if(out.length>=3)break;if(!out.some(x=>x[0]===e[0]))out.push(e);}return out;
  }
  function colorCss(name){
    const n=String(name||'').toLowerCase();
    const map=[['беж','#d8c4a6'],['сер','#8b8c90'],['голуб','#91b9cf'],['роз','#d8a8b4'],['чёр','#222'],['черн','#222'],['бел','#f7f5ef'],['корич','#76584a'],['зел','#718b77'],['син','#4c6687'],['борд','#7c3340'],['фиолет','#806b8c'],['жёлт','#d9b957'],['оранж','#c9824d']];
    const hit=map.find(([k])=>n.includes(k));return hit?hit[1]:'#b6aea3';
  }
  function preferredVariant(product,color,size){
    const vars=Array.isArray(product.variants)?product.variants:[];
    return vars.find(v=>(!color||v.color===color)&&(!size||v.size===size))||vars.find(v=>(!size||v.size===size))||vars.find(v=>(!color||v.color===color))||null;
  }
  function cardMarkup(product){
    const imgs=uniq(product.images);const first=imgs[0]||'assets/hero-noktena-final.png?v=20260908-final2';const quick=chooseSpecs(product);const category=product.category==='beds'?'Кровать':'Диван';const link=detailUrl(product);
    const colors=uniq(product.colors?.length?product.colors:(product.variants||[]).map(v=>v.color));const sizes=uniq(product.sizes?.length?product.sizes:(product.variants||[]).map(v=>v.size));const initial=preferredVariant(product,colors[0]||'',sizes[0]||'');const price=initial?.price||product.price;
    state.gallery.set(product.id,0);
    return `<article class="f-card product-open-card" data-product-id="${esc(product.id)}" data-product-link="${esc(link)}" data-selected-color="${esc(colors[0]||'')}" data-selected-size="${esc(sizes[0]||'')}">
      <div class="f-gallery" data-gallery-id="${esc(product.id)}">
        <img src="${esc(first)}" alt="${esc(product.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">
        <div class="f-gallery-shade"></div>
        <div class="f-card-overlay-tags"><span>${category}</span>${product.hit?'<span class="hit">Хит продаж</span>':''}</div>
        ${imgs.length>1?`<div class="f-gallery-nav"><button class="f-gallery-arrow" type="button" data-gallery-dir="-1" aria-label="Предыдущее фото">‹</button><button class="f-gallery-arrow" type="button" data-gallery-dir="1" aria-label="Следующее фото">›</button></div>`:''}
        <span class="f-gallery-count">${imgs.length>1?`1 / ${imgs.length}`:'1 фото'}</span>
      </div>
      <div class="f-card-body">
        <div class="f-card-eyebrow">${product.subtype?esc(product.subtype):'Коллекция НОКТЕНА'}${product.available?' · в наличии':''}</div>
        <h3 title="${esc(product.title)}">${esc(product.title)}</h3>
        ${shortText(product)?`<p class="f-card-summary">${esc(shortText(product))}</p>`:''}
        ${quick.length?`<div class="f-premium-specs">${quick.map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>`:''}
        ${colors.length?`<div class="f-option"><div class="f-option-head"><span>Цвет</span><b class="f-color-name">${esc(colors[0])}</b></div><div class="f-color-list">${colors.slice(0,8).map((c,i)=>`<button type="button" class="f-color ${i===0?'is-active':''}" data-card-color="${esc(c)}" title="${esc(c)}" aria-label="Цвет ${esc(c)}" style="--swatch:${colorCss(c)}"></button>`).join('')}${colors.length>8?`<span class="f-more-options">+${colors.length-8}</span>`:''}</div></div>`:''}
        ${sizes.length?`<div class="f-option"><div class="f-option-head"><span>${product.category==='beds'?'Спальное место':'Размер'}</span><b>${sizes.length} ${sizes.length===1?'вариант':'вариантов'}</b></div><select class="f-size-select" data-card-size>${sizes.map((s,i)=>`<option value="${esc(s)}" ${i===0?'selected':''}>${esc(s)}</option>`).join('')}</select></div>`:''}
        <div class="f-card-bottom">
          <div class="f-price-row"><div><div class="f-price-caption">Цена выбранного варианта</div><div class="f-price" data-card-price>${rub(price)}</div></div><div class="f-price-note">Актуальность наличия<br>подтвердим при заказе</div></div>
          <a class="product-more-link" href="${esc(link)}"><span>Открыть карточку товара</span><span aria-hidden="true">→</span></a>
          <a class="btn max-btn" href="${MAX_LINK}" target="_blank" rel="noopener"><img class="max-icon" src="${MAX_ICON}" alt="" aria-hidden="true"><span>Задать вопрос в MAX</span></a>
        </div>
      </div>
    </article>`;
  }

  function productById(id){return [...state.data.beds,...state.data.sofas].find(x=>x.id===id);}
  function updateCardVariant(card){const product=productById(card?.dataset.productId);if(!product)return;const color=card.dataset.selectedColor||'';const size=card.dataset.selectedSize||'';const variant=preferredVariant(product,color,size);const price=variant?.price||product.price;const el=$('[data-card-price]',card);if(el)el.textContent=rub(price);}
  function setGallery(id,delta){
    const product=productById(id);if(!product)return;const imgs=uniq(product.images);if(imgs.length<2)return;const current=state.gallery.get(id)||0;const next=(current+delta+imgs.length)%imgs.length;const g=document.querySelector(`[data-gallery-id="${CSS.escape(id)}"]`);if(!g)return;const img=$('img',g);if(!img)return;const preload=new Image();preload.onload=()=>{state.gallery.set(id,next);img.classList.add('is-changing');setTimeout(()=>{img.src=imgs[next];img.classList.remove('is-changing')},90);const counter=$('.f-gallery-count',g);if(counter)counter.textContent=`${next+1} / ${imgs.length}`;};preload.src=imgs[next];
  }
  function filtered(view){let items=[...(state.data[view]||[])];const q=(state.query[view]||'').trim().toLowerCase();if(q)items=items.filter(p=>`${p.title} ${p.subtype||''} ${p.description||''} ${JSON.stringify(p.specs||{})}`.toLowerCase().includes(q));if(view==='sofas'&&state.subtype)items=items.filter(p=>p.subtype===state.subtype);const sort=state.sort[view];items.sort((a,b)=>{if(sort==='price-desc')return (b.price||-1)-(a.price||-1);if(sort==='name')return String(a.title).localeCompare(String(b.title),'ru');return (a.price??Number.MAX_SAFE_INTEGER)-(b.price??Number.MAX_SAFE_INTEGER);});return items;}
  function paginationMarkup(view,total,page){const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));if(pages<=1)return'';const nums=[];const from=Math.max(1,page-2),to=Math.min(pages,page+2);if(from>1)nums.push(1);if(from>2)nums.push('…');for(let i=from;i<=to;i++)nums.push(i);if(to<pages-1)nums.push('…');if(to<pages)nums.push(pages);return `<div class="f-pagination" aria-label="Страницы каталога"><button class="f-page" data-page-view="${view}" data-page="${page-1}" ${page<=1?'disabled':''}>←</button>${nums.map(n=>n==='…'?'<span class="f-page f-page-gap">…</span>':`<button class="f-page ${n===page?'is-active':''}" data-page-view="${view}" data-page="${n}">${n}</button>`).join('')}<button class="f-page" data-page-view="${view}" data-page="${page+1}" ${page>=pages?'disabled':''}>→</button></div>`;}
  function renderFurniture(view){const mount=$('#furnitureGrid'),count=$('#furnitureCount'),title=$('#furnitureTitle'),desc=$('#furnitureDesc'),subtype=$('#fSubtype');if(!mount)return;if(title)title.textContent=view==='beds'?'Кровати для продуманной спальни':'Диваны для красивого интерьера';if(desc)desc.textContent=view==='beds'?'Выберите модель, цвет и спальное место. В полной карточке — фотографии, описание, характеристики и все доступные варианты.':'Прямые и угловые модели с выбором доступных вариантов. Внутри каждой карточки — полная галерея и характеристики.';if(subtype){subtype.style.display=view==='sofas'?'block':'none';if(view!=='sofas'){subtype.value='';state.subtype='';}}if(!state.loaded){mount.innerHTML='<div class="f-loading">Загружаем коллекцию…</div>';return;}const items=filtered(view);const pages=Math.max(1,Math.ceil(items.length/PAGE_SIZE));state.page[view]=Math.min(Math.max(1,state.page[view]),pages);const page=state.page[view];const slice=items.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);if(count)count.textContent=`${items.length} моделей · страница ${page} из ${pages}`;mount.innerHTML=slice.length?slice.map(cardMarkup).join(''):'<div class="f-empty">По выбранным параметрам модели не найдены.</div>';const pg=$('#furniturePagination');if(pg)pg.innerHTML=paginationMarkup(view,items.length,page);}
  function renderHomeHits(){const mount=$('#homeHitsGrid');if(!mount)return;if(!state.loaded){mount.innerHTML='<div class="f-loading">Подбираем модели…</div>';return;}const hits=[...state.data.beds.filter(x=>x.hit).slice(0,3),...state.data.sofas.filter(x=>x.hit).slice(0,3)];const fallback=[...state.data.beds.slice(0,3),...state.data.sofas.slice(0,3)];mount.innerHTML=(hits.length>=4?hits:fallback).map(cardMarkup).join('');}
  async function loadFurniture(){try{const r=await fetch(`data/furniture.json?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const data=await r.json();state.data.beds=Array.isArray(data.beds)?data.beds:[];state.data.sofas=Array.isArray(data.sofas)?data.sofas:[];state.loaded=true;}catch(e){console.error('Furniture catalog load failed',e);state.loaded=true;}applyView(routeFromHash(),{scroll:false});}
  function bind(){
    document.addEventListener('click',e=>{
      const galleryBtn=e.target.closest('[data-gallery-dir]');if(galleryBtn){e.preventDefault();e.stopPropagation();const g=galleryBtn.closest('[data-gallery-id]');if(g)setGallery(g.dataset.galleryId,Number(galleryBtn.dataset.galleryDir)||1);return;}
      const colorBtn=e.target.closest('[data-card-color]');if(colorBtn){e.preventDefault();e.stopPropagation();const card=colorBtn.closest('.f-card');if(!card)return;card.dataset.selectedColor=colorBtn.dataset.cardColor||'';$$('[data-card-color]',card).forEach(b=>b.classList.toggle('is-active',b===colorBtn));const name=$('.f-color-name',card);if(name)name.textContent=colorBtn.dataset.cardColor;updateCardVariant(card);return;}
      const pageBtn=e.target.closest('[data-page-view]');if(pageBtn&&!pageBtn.disabled){const view=pageBtn.dataset.pageView;state.page[view]=Number(pageBtn.dataset.page)||1;renderFurniture(view);$('#furnitureCatalog')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
      const catLink=e.target.closest('a[href="#catalog"]');if(catLink){e.preventDefault();location.hash='mattresses';}
    });
    document.addEventListener('change',e=>{const select=e.target.closest('[data-card-size]');if(!select)return;const card=select.closest('.f-card');if(!card)return;card.dataset.selectedSize=select.value;updateCardVariant(card);});
    window.addEventListener('hashchange',()=>{const h=(location.hash||'#home').slice(1).split('?')[0];if(views.has(h)){applyView(h);return;}if(['top','guide','delivery','about'].includes(h)){applyView('home',{scroll:false});requestAnimationFrame(()=>document.getElementById(h)?.scrollIntoView({behavior:'smooth',block:'start'}));return;}applyView('home');});
    $('#fSearch')?.addEventListener('input',e=>{const v=routeFromHash();if(v==='beds'||v==='sofas'){state.query[v]=e.target.value;state.page[v]=1;renderFurniture(v);}});
    $('#fSort')?.addEventListener('change',e=>{const v=routeFromHash();if(v==='beds'||v==='sofas'){state.sort[v]=e.target.value;state.page[v]=1;renderFurniture(v);}});
    $('#fSubtype')?.addEventListener('change',e=>{state.subtype=e.target.value;state.page.sofas=1;renderFurniture('sofas');});
    $$('[data-home-link]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();location.hash=a.dataset.homeLink;}));
  }
  function init(){const tabs=$('#shopTabsMount');if(tabs)tabs.innerHTML=tabMarkup();bind();applyView(routeFromHash(),{scroll:false});loadFurniture();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
