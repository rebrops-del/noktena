(() => {
  'use strict';
  const MAX_LINK='https://max.ru/u/f9LHodD0cOKZqie3BJvn11xgsNvxJK_kFOqYtKyFuZ2uMitoxZIwNaH8-NY';
  const MAX_ICON='https://max.ru/s/img/big-logo.png';
  const PAGE_SIZE=12;
  const views=new Set(['home','mattresses','beds','sofas','delivery','guide']);
  const state={data:{beds:[],sofas:[]},page:{beds:1,sofas:1},query:{beds:'',sofas:''},sort:{beds:'price-asc',sofas:'price-asc'},subtype:'',gallery:new Map(),loaded:false};
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rub=n=>Number.isFinite(Number(n))&&Number(n)>0?`${Math.round(Number(n)).toLocaleString('ru-RU')} ₽`:'Цена по запросу';
  const oldPrice=n=>Number(n)>=5000?Math.round((Number(n)/0.7)/100)*100:null;

  const ICONS={
    home:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.8 10.6 12 3.8l8.2 6.8v9.1a.8.8 0 0 1-.8.8H4.6a.8.8 0 0 1-.8-.8v-9.1Z"/><path d="M9.3 20.5v-6.8h5.4v6.8"/></svg>`,
    mattress:`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="10" rx="3"/><path d="M3 12h18M7 7v10M17 7v10"/></svg>`,
    bed:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 19v-8m18 8v-8M3 16h18M5 11V7.5A2.5 2.5 0 0 1 7.5 5h3A2.5 2.5 0 0 1 13 7.5V11m0 0V8.7A2.7 2.7 0 0 1 15.7 6h1.6A2.7 2.7 0 0 1 20 8.7V11"/></svg>`,
    sofa:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12V8.7A2.7 2.7 0 0 1 7.7 6h8.6A2.7 2.7 0 0 1 19 8.7V12"/><path d="M4 11a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a2 2 0 0 0-4 0v1H6v-1a2 2 0 0 0-2-2ZM5 19v2m14-2v2"/></svg>`,
    guide:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h10.5A3.5 3.5 0 0 1 19 8v11.5H8.5A3.5 3.5 0 0 1 5 16V4.5Z"/><path d="M8.5 19.5A3.5 3.5 0 0 1 12 16h7M9 8h6M9 11h6"/></svg>`
  };

  function tabMarkup(){
    return `<div class="shop-tabs-shell"><div class="wrap shop-tabs" role="navigation" aria-label="Разделы магазина">
      <a class="shop-tab" data-shop-view="home" href="#home"><span class="shop-tab-icon">${ICONS.home}</span><span><b>Главная</b><small>НОКТЕНА</small></span></a>
      <a class="shop-tab" data-shop-view="mattresses" href="#mattresses"><span class="shop-tab-icon">${ICONS.mattress}</span><span><b>Матрасы</b><small>для сна</small></span></a>
      <a class="shop-tab" data-shop-view="beds" href="#beds"><span class="shop-tab-icon">${ICONS.bed}</span><span><b>Кровати</b><small>для спальни</small></span></a>
      <a class="shop-tab" data-shop-view="sofas" href="#sofas"><span class="shop-tab-icon">${ICONS.sofa}</span><span><b>Диваны</b><small>для отдыха</small></span></a>
      <a class="shop-tab" data-shop-view="delivery" href="#delivery"><span class="shop-tab-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5h11v10H3z"/><path d="M14 10h3.4l3.1 3.2v3.3H14z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/></svg></span><span><b>Доставка</b><small>и подъём</small></span></a>
      <a class="shop-tab" data-shop-view="guide" href="#guide"><span class="shop-tab-icon">${ICONS.guide}</span><span><b>Как выбрать</b><small>инструкция</small></span></a>
    </div></div>`;
  }

  function routeFromHash(){const raw=(location.hash||'#home').slice(1).split('?')[0];return views.has(raw)?raw:'home';}
  function sections(){const cta=$('.cta')?.closest('section');return{hero:$('.hero'),delivery:$('#delivery'),about:$('#about'),guide:$('#guide'),catalog:$('#catalog'),hits:$('#homeHits'),furniture:$('#furnitureCatalog'),cta};}
  function show(el,on){if(el)el.classList.toggle('shop-view-hidden',!on)}
  function applyView(view,{scroll=true}={}){
    if(!views.has(view))view='home';const s=sections();
    show(s.hero,view==='home');show(s.delivery,view==='delivery');show(s.about,view==='home');show(s.guide,view==='guide');show(s.hits,view==='home');show(s.catalog,view==='mattresses');show(s.furniture,view==='beds'||view==='sofas');show(s.cta,true);
    $$('[data-shop-view]').forEach(a=>a.classList.toggle('is-active',a.dataset.shopView===view));document.body.dataset.shopView=view;
    if(view==='beds'||view==='sofas')renderFurniture(view);if(view==='home')renderHomeHits();if(scroll)window.scrollTo({top:0,behavior:'smooth'});
  }

  function detailUrl(product){return `product.html?kind=furniture&id=${encodeURIComponent(product.id)}`;}
  function uniq(list){return [...new Set((list||[]).filter(Boolean).map(v=>String(v).trim()).filter(Boolean))];}
  function sizeSortValue(value){const nums=String(value||'').replace(/×/g,'х').match(/\d+/g)?.map(Number)||[];return [nums[0]??Number.MAX_SAFE_INTEGER,nums[1]??Number.MAX_SAFE_INTEGER,String(value||'')];}
  function sortSizes(list){return uniq(list).sort((a,b)=>{const A=sizeSortValue(a),B=sizeSortValue(b);return A[0]-B[0]||A[1]-B[1]||A[2].localeCompare(B[2],'ru');});}
  function shortText(product){const t=String(product.summary||product.description||'').replace(/\s+/g,' ').trim();return t.length>180?`${t.slice(0,177).trim()}…`:t;}
  function publicSpec([k,v]){return k&&v&&!/производител|артикул|sku/i.test(k);}
  function chooseSpecs(product){
    const entries=Object.entries(product.specs||{}).filter(publicSpec);
    const preferred=['Спальное место','Кроватное основание','Механизм трансформации','Бельевой ящик','Подъёмный механизм','Наполнение','Материал обивки','Материал фасада','Количество спальных мест'];
    const out=[];for(const p of preferred){const e=entries.find(([k])=>k.toLowerCase()===p.toLowerCase());if(e&&!out.some(x=>x[0]===e[0]))out.push(e);if(out.length>=3)break;}for(const e of entries){if(out.length>=3)break;if(!out.some(x=>x[0]===e[0]))out.push(e);}return out;
  }
  function swatchCss(name){
    const n=String(name||'').toLowerCase().replace(/ё/g,'е');
    const map=[['молоч','#eee7d8'],['крем','#eadcc5'],['айвор','#eee6d5'],['беж','#d8c4a6'],['песоч','#cbb58b'],['капуч','#a98970'],['тауп','#8b7c70'],['графит','#555b5d'],['антрац','#44494c'],['темно сер','#66686b'],['светло сер','#b9b8b4'],['сер','#8b8c90'],['бирюз','#49a5a9'],['мят','#91b8a4'],['изумруд','#39705c'],['олив','#7d8662'],['зел','#718b77'],['голуб','#91b9cf'],['син','#4c6687'],['борд','#7c3340'],['винн','#7c3340'],['пудр','#d8a8b4'],['роз','#d8a8b4'],['сирен','#9b83a8'],['фиолет','#806b8c'],['корич','#76584a'],['шокол','#5f4438'],['террак','#b96f52'],['оранж','#c9824d'],['горч','#b99a4d'],['желт','#d9b957'],['бел','#f7f5ef'],['черн','#222']];
    const hit=map.find(([k])=>n.includes(k));return hit?hit[1]:'#b7afa5';
  }
  function colorKey(value){let n=String(value||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/g,'');if(n==='бордо')n='бордовый';return n;}
  function preferredVariant(product,color,size){const vars=Array.isArray(product.variants)?product.variants:[];return vars.find(v=>(!color||colorKey(v.color)===colorKey(color))&&(!size||v.size===size))||vars.find(v=>(!size||v.size===size))||vars.find(v=>(!color||colorKey(v.color)===colorKey(color)))||null;}
  function validFurniturePrice(value){const n=Number(value);return Number.isFinite(n)&&n>=5000?n:null;}
  function furniturePrice(product,variant,size=''){const direct=validFurniturePrice(variant?.price);if(direct)return direct;const vars=Array.isArray(product?.variants)?product.variants:[];const same=vars.map(v=>String(v?.size||'')===String(size||'')?validFurniturePrice(v?.price):null).filter(Boolean);if(same.length)return Math.min(...same);const base=validFurniturePrice(product?.price);if(base)return base;const all=vars.map(v=>validFurniturePrice(v?.price)).filter(Boolean);return all.length?Math.min(...all):null;}
  function colorImageFor(product,color){if(!color)return '';const map=product?.colorImages||{};if(map[color])return map[color];const wanted=colorKey(color);const key=Object.keys(map).find(k=>colorKey(k)===wanted);return key?map[key]:'';}
  function updateCardImage(card,product,color){const src=colorImageFor(product,color);if(!src)return;const img=$('.f-gallery img',card);if(!img||img.getAttribute('src')===src)return;const preload=new Image();preload.onload=()=>{img.classList.add('is-changing');setTimeout(()=>{img.src=src;img.classList.remove('is-changing')},90);};preload.onerror=()=>{};preload.src=src;}
  function cardDetailsMarkup(product){
    const entries=Object.entries(product.specs||{}).filter(publicSpec);const description=String(product.description||'').trim();if(!entries.length&&!description)return '';
    return `<details class="f-card-details"><summary><span>Описание и характеристики</span><span class="f-card-details-plus">+</span></summary><div class="f-card-details-body">${description?`<p>${esc(description)}</p>`:''}${entries.length?`<dl>${entries.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`:''}<a href="${esc(detailUrl(product))}" class="f-card-details-link">Все характеристики →</a></div></details>`;
  }

  function cardMarkup(product){
    const imgs=uniq(product.images);const quick=chooseSpecs(product);const category=product.category==='beds'?'Кровать':'Диван';const link=detailUrl(product);
    const sizes=sortSizes(product.sizes?.length?product.sizes:(product.variants||[]).map(v=>v.size));const initial=preferredVariant(product,'',sizes[0]||'');const price=furniturePrice(product,initial,sizes[0]||'');const first=imgs[0]||'assets/hero-noktena-final.png?v=20260908-final2';
    state.gallery.set(product.id,0);
    return `<article class="f-card product-open-card" data-product-id="${esc(product.id)}" data-product-link="${esc(link)}" data-selected-size="${esc(sizes[0]||'')}">
      <div class="f-gallery" data-gallery-id="${esc(product.id)}">
        <img src="${esc(first)}" alt="${esc(product.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">
        <div class="f-gallery-shade"></div>
        <div class="f-card-overlay-tags"><span>${category}</span>${product.hit?'<span class="hit">Хит продаж</span>':''}</div>
        ${imgs.length>1?`<div class="f-gallery-nav"><button class="f-gallery-arrow" type="button" data-gallery-dir="-1" aria-label="Предыдущее фото">‹</button><button class="f-gallery-arrow" type="button" data-gallery-dir="1" aria-label="Следующее фото">›</button></div>`:''}
        <span class="f-gallery-count">${imgs.length>1?`1 / ${imgs.length}`:'1 фото'}</span>
      </div>
      <div class="f-card-body">
        <div class="f-card-eyebrow">${product.subtype?esc(product.subtype):'Каталог мебели'}${product.available?' · в наличии':''}</div>
        <h3 title="${esc(product.title)}">${esc(product.title)}</h3>
        ${shortText(product)?`<p class="f-card-summary">${esc(shortText(product))}</p>`:''}
        ${quick.length?`<div class="f-premium-specs">${quick.map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>`:''}
        ${cardDetailsMarkup(product)}
        ${sizes.length?`<div class="f-option"><div class="f-option-head"><span>${product.category==='beds'?'Спальное место':'Размер'}</span><b>${sizes.length} ${sizes.length===1?'вариант':'вариантов'}</b></div><select class="f-size-select" data-card-size>${sizes.map((s,i)=>`<option value="${esc(s)}" ${i===0?'selected':''}>${esc(s)}</option>`).join('')}</select></div>`:''}
        <div class="f-card-bottom">
          <div class="f-price-row"><div class="f-price-stack"><div class="f-price-caption">Цена выбранного варианта</div><div class="f-old-price-line"><span class="f-old-price" data-card-old-price>${rub(oldPrice(price))}</span><span class="f-discount-badge">−30%</span></div><div class="f-price" data-card-price>${rub(price)}</div></div><div class="f-price-promo"><b>Цена сентября</b><span>до 30 сентября</span></div></div>
          <a class="product-more-link" href="${esc(link)}"><span>Подробнее о модели</span><span aria-hidden="true">→</span></a>
          <a class="btn max-btn" href="${MAX_LINK}" target="_blank" rel="noopener"><img class="max-icon" src="${MAX_ICON}" alt="" aria-hidden="true"><span>Получить консультацию в MAX</span></a>
        </div>
      </div>
    </article>`;
  }

  function productById(id){return [...state.data.beds,...state.data.sofas].find(x=>x.id===id);}
  function updateCardVariant(card){const product=productById(card?.dataset.productId);if(!product)return;const size=card.dataset.selectedSize||'';const variant=preferredVariant(product,'',size);const price=furniturePrice(product,variant,size);const el=$('[data-card-price]',card),old=$('[data-card-old-price]',card);if(el)el.textContent=rub(price);if(old)old.textContent=rub(oldPrice(price));}
  function setGallery(id,delta){const product=productById(id);if(!product)return;const imgs=uniq(product.images);if(imgs.length<2)return;const current=state.gallery.get(id)||0;const next=(current+delta+imgs.length)%imgs.length;const g=document.querySelector(`[data-gallery-id="${CSS.escape(id)}"]`);if(!g)return;const img=$('img',g);if(!img)return;const preload=new Image();preload.onload=()=>{state.gallery.set(id,next);img.classList.add('is-changing');setTimeout(()=>{img.src=imgs[next];img.classList.remove('is-changing')},90);const counter=$('.f-gallery-count',g);if(counter)counter.textContent=`${next+1} / ${imgs.length}`;};preload.src=imgs[next];}
  function filtered(view){let items=[...(state.data[view]||[])];const q=(state.query[view]||'').trim().toLowerCase();if(q)items=items.filter(p=>`${p.title} ${p.subtype||''} ${p.description||''} ${JSON.stringify(p.specs||{})}`.toLowerCase().includes(q));if(view==='sofas'&&state.subtype)items=items.filter(p=>p.subtype===state.subtype);const sort=state.sort[view];items.sort((a,b)=>{if(sort==='price-desc')return (b.price||-1)-(a.price||-1);if(sort==='name')return String(a.title).localeCompare(String(b.title),'ru');return (a.price??Number.MAX_SAFE_INTEGER)-(b.price??Number.MAX_SAFE_INTEGER);});return items;}
  function paginationMarkup(view,total,page){const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));if(pages<=1)return'';const nums=[];const from=Math.max(1,page-2),to=Math.min(pages,page+2);if(from>1)nums.push(1);if(from>2)nums.push('…');for(let i=from;i<=to;i++)nums.push(i);if(to<pages-1)nums.push('…');if(to<pages)nums.push(pages);return `<div class="f-pagination" aria-label="Страницы каталога"><button class="f-page" data-page-view="${view}" data-page="${page-1}" ${page<=1?'disabled':''}>←</button>${nums.map(n=>n==='…'?'<span class="f-page f-page-gap">…</span>':`<button class="f-page ${n===page?'is-active':''}" data-page-view="${view}" data-page="${n}">${n}</button>`).join('')}<button class="f-page" data-page-view="${view}" data-page="${page+1}" ${page>=pages?'disabled':''}>→</button></div>`;}
  function renderFurniture(view){const mount=$('#furnitureGrid'),count=$('#furnitureCount'),title=$('#furnitureTitle'),desc=$('#furnitureDesc'),subtype=$('#fSubtype');if(!mount)return;if(title)title.textContent=view==='beds'?'Кровати для вашей спальни':'Диваны для комфортного отдыха';if(desc)desc.textContent=view==='beds'?'Выберите модель и подходящее спальное место. Цвета, фотографии и подробные характеристики — в карточке товара.':'Прямые и угловые модели. Цвет, фотографии и доступные варианты выбираются внутри карточки товара.';if(subtype){subtype.style.display=view==='sofas'?'block':'none';if(view!=='sofas'){subtype.value='';state.subtype='';}}if(!state.loaded){mount.innerHTML='<div class="f-loading">Загружаем коллекцию…</div>';return;}const items=filtered(view);const pages=Math.max(1,Math.ceil(items.length/PAGE_SIZE));state.page[view]=Math.min(Math.max(1,state.page[view]),pages);const page=state.page[view];const slice=items.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);if(count)count.textContent=`${items.length} моделей · страница ${page} из ${pages}`;mount.innerHTML=slice.length?slice.map(cardMarkup).join(''):'<div class="f-empty">По выбранным параметрам модели не найдены.</div>';const pg=$('#furniturePagination');if(pg)pg.innerHTML=paginationMarkup(view,items.length,page);}
  function renderHomeHits(){const mount=$('#homeHitsGrid');if(!mount)return;if(!state.loaded){mount.innerHTML='<div class="f-loading">Подбираем модели…</div>';return;}const excluded=p=>{const t=String(p?.title||'').toLowerCase();return t.includes('детская кровать стандарт')||(t.includes('диван тахта')&&t.includes('кушетка')&&t.includes('левый угол'));};const beds=state.data.beds.filter(p=>!excluded(p));const sofas=state.data.sofas.filter(p=>!excluded(p));const bedHits=beds.filter(x=>x.hit),sofaHits=sofas.filter(x=>x.hit);const kuba=state.data.beds.find(p=>p.id==='berhouse-24136');const bedSource=(bedHits.length>=3?bedHits:beds).filter(p=>p.id!=='berhouse-24136');const bedPicks=bedSource.slice(0,3);if(kuba){const kubaHit={...kuba,hit:true};if(bedPicks.length>=3)bedPicks[2]=kubaHit;else bedPicks.push(kubaHit);}const sofaPicks=(sofaHits.length>=3?sofaHits:sofas).slice(0,3);mount.innerHTML=[...bedPicks,...sofaPicks].map(cardMarkup).join('');}
  async function loadFurniture(){try{const r=await fetch(`data/furniture.json?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const raw=await r.json();const data=window.NoktenaCatalog?await window.NoktenaCatalog.mergeFurniture(raw):raw;state.data.beds=Array.isArray(data.beds)?data.beds:[];state.data.sofas=Array.isArray(data.sofas)?data.sofas:[];state.loaded=true;}catch(e){console.error('Furniture catalog load failed',e);state.loaded=true;}applyView(routeFromHash(),{scroll:false});}
  function bind(){
    document.addEventListener('click',e=>{
      const galleryBtn=e.target.closest('[data-gallery-dir]');if(galleryBtn){e.preventDefault();e.stopPropagation();const g=galleryBtn.closest('[data-gallery-id]');if(g)setGallery(g.dataset.galleryId,Number(galleryBtn.dataset.galleryDir)||1);return;}
      const pageBtn=e.target.closest('[data-page-view]');if(pageBtn&&!pageBtn.disabled){const view=pageBtn.dataset.pageView;state.page[view]=Number(pageBtn.dataset.page)||1;renderFurniture(view);$('#furnitureCatalog')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
      const catLink=e.target.closest('a[href="#catalog"]');if(catLink){e.preventDefault();location.hash='mattresses';}
    });
    document.addEventListener('change',e=>{const select=e.target.closest('[data-card-size]');if(!select)return;const card=select.closest('.f-card');if(!card)return;card.dataset.selectedSize=select.value;updateCardVariant(card);});
    window.addEventListener('hashchange',()=>{const h=(location.hash||'#home').slice(1).split('?')[0];if(views.has(h)){applyView(h);return;}if(['top','delivery','about'].includes(h)){applyView('home',{scroll:false});requestAnimationFrame(()=>document.getElementById(h)?.scrollIntoView({behavior:'smooth',block:'start'}));return;}applyView('home');});
    $('#fSearch')?.addEventListener('input',e=>{const v=routeFromHash();if(v==='beds'||v==='sofas'){state.query[v]=e.target.value;state.page[v]=1;renderFurniture(v);}});
    $('#fSort')?.addEventListener('change',e=>{const v=routeFromHash();if(v==='beds'||v==='sofas'){state.sort[v]=e.target.value;state.page[v]=1;renderFurniture(v);}});
    $('#fSubtype')?.addEventListener('change',e=>{state.subtype=e.target.value;state.page.sofas=1;renderFurniture('sofas');});
    $$('[data-home-link]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();location.hash=a.dataset.homeLink;}));
  }
  function init(){const tabs=$('#shopTabsMount');if(tabs)tabs.innerHTML=tabMarkup();bind();applyView(routeFromHash(),{scroll:false});loadFurniture();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
