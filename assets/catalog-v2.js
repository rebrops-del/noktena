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

  function tabMarkup(){
    return `<div class="shop-tabs-shell"><div class="wrap shop-tabs" role="navigation" aria-label="Разделы магазина">
      <a class="shop-tab" data-shop-view="home" href="#home"><span class="shop-tab-icon">⌂</span>Главная</a>
      <a class="shop-tab" data-shop-view="mattresses" href="#mattresses"><span class="shop-tab-icon">▤</span>Матрасы</a>
      <a class="shop-tab" data-shop-view="beds" href="#beds"><span class="shop-tab-icon">▰</span>Кровати</a>
      <a class="shop-tab" data-shop-view="sofas" href="#sofas"><span class="shop-tab-icon">▱</span>Диваны</a>
    </div></div>`;
  }

  function routeFromHash(){
    const raw=(location.hash||'#home').slice(1).split('?')[0];
    return views.has(raw)?raw:'home';
  }

  function sections(){
    const cta=$('.cta')?.closest('section');
    return {
      hero:$('.hero'), delivery:$('#delivery'), about:$('#about'), guide:$('#guide'), catalog:$('#catalog'),
      hits:$('#homeHits'), furniture:$('#furnitureCatalog'), cta
    };
  }

  function show(el,on){if(el)el.classList.toggle('shop-view-hidden',!on)}

  function applyView(view,{scroll=true}={}){
    if(!views.has(view)) view='home';
    const s=sections();
    show(s.hero,view==='home');
    show(s.delivery,view==='home');
    show(s.about,view==='home');
    show(s.guide,view==='home');
    show(s.hits,view==='home');
    show(s.catalog,view==='mattresses');
    show(s.furniture,view==='beds'||view==='sofas');
    show(s.cta,true);
    $$('[data-shop-view]').forEach(a=>a.classList.toggle('is-active',a.dataset.shopView===view));
    document.body.dataset.shopView=view;
    if(view==='beds'||view==='sofas') renderFurniture(view);
    if(view==='home') renderHomeHits();
    if(scroll) window.scrollTo({top:0,behavior:'smooth'});
  }

  function chooseSpecs(product){
    const entries=Object.entries(product.specs||{}).filter(([k,v])=>k&&v&&k.toLowerCase()!=='производитель');
    const preferred=['Спальное место','Ширина','Глубина','Бельевой ящик','Подъёмный механизм','Кроватное основание','Количество спальных мест','Тип'];
    const out=[];
    for(const p of preferred){
      const e=entries.find(([k])=>k.toLowerCase()===p.toLowerCase());
      if(e&&!out.some(x=>x[0]===e[0]))out.push(e);
      if(out.length>=2)break;
    }
    for(const e of entries){
      if(out.length>=2)break;
      if(!out.some(x=>x[0]===e[0]))out.push(e);
    }
    return out;
  }

  function detailsMarkup(product){
    const entries=Object.entries(product.specs||{}).filter(([k,v])=>k&&v).slice(0,12);
    const dl=entries.length?`<dl>${entries.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`:'';
    return `<details class="f-details"><summary>Характеристики</summary><div class="f-details-content">${dl}<p class="f-description">${esc(product.description||'Характеристики и доступные варианты уточняйте при оформлении заказа.')}</p></div></details>`;
  }

  function cardMarkup(product){
    const imgs=(product.images||[]).filter(Boolean);
    const first=imgs[0]||'assets/hero-noktena-final.png?v=20260908-final2';
    const quick=chooseSpecs(product);
    const category=product.category==='beds'?'Кровать':'Диван';
    const subtype=product.subtype?`<span class="f-card-tag">${esc(product.subtype)}</span>`:'';
    const hit='';
    state.gallery.set(product.id,0);
    return `<article class="f-card" data-product-id="${esc(product.id)}">
      <div class="f-gallery" data-gallery-id="${esc(product.id)}">
        <img src="${esc(first)}" alt="${esc(product.title)}" loading="lazy" referrerpolicy="no-referrer">
        ${imgs.length>1?`<div class="f-gallery-nav"><button class="f-gallery-arrow" type="button" data-gallery-dir="-1" aria-label="Предыдущее фото">‹</button><button class="f-gallery-arrow" type="button" data-gallery-dir="1" aria-label="Следующее фото">›</button></div><div class="f-gallery-dots">${imgs.slice(0,8).map((_,i)=>`<span class="f-dot ${i===0?'is-active':''}"></span>`).join('')}</div>`:''}
        <span class="f-gallery-count">1 / ${Math.max(1,imgs.length)}</span>
      </div>
      <div class="f-card-body">
        <div class="f-card-tags"><span class="f-card-tag">${category}</span>${subtype}${hit}</div>
        <h3 title="${esc(product.title)}">${esc(product.title)}</h3>
        <div class="f-quick-specs">${quick.length?quick.map(([k,v])=>`<div class="f-quick-spec"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join(''):'<div class="f-quick-spec"><span>Производитель</span><b>Berhouse</b></div>'}</div>
        ${detailsMarkup(product)}
        <div class="f-card-bottom">
          <div class="f-price-row"><div class="f-price">${rub(product.price)}</div><div class="f-price-note">Актуальность цены<br>уточняйте при заказе</div></div>
          <a class="btn max-btn" href="${MAX_LINK}" target="_blank" rel="noopener"><img class="max-icon" src="${MAX_ICON}" alt="" aria-hidden="true"><span>Написать в MAX</span></a>
        </div>
      </div>
    </article>`;
  }

  function productById(id){
    return [...state.data.beds,...state.data.sofas].find(x=>x.id===id);
  }

  function setGallery(id,delta){
    const product=productById(id); if(!product)return;
    const imgs=(product.images||[]).filter(Boolean); if(imgs.length<2)return;
    const current=state.gallery.get(id)||0;
    const next=(current+delta+imgs.length)%imgs.length;
    state.gallery.set(id,next);
    const g=document.querySelector(`[data-gallery-id="${CSS.escape(id)}"]`); if(!g)return;
    const img=$('img',g); if(img){img.style.opacity='.35';setTimeout(()=>{img.src=imgs[next];img.style.opacity='1'},80)}
    const counter=$('.f-gallery-count',g); if(counter)counter.textContent=`${next+1} / ${imgs.length}`;
    $$('.f-dot',g).forEach((d,i)=>d.classList.toggle('is-active',i===next));
  }

  function filtered(view){
    let items=[...(state.data[view]||[])];
    const q=(state.query[view]||'').trim().toLowerCase();
    if(q) items=items.filter(p=>`${p.title} ${p.subtype||''} ${JSON.stringify(p.specs||{})}`.toLowerCase().includes(q));
    if(view==='sofas'&&state.subtype) items=items.filter(p=>p.subtype===state.subtype);
    const sort=state.sort[view];
    items.sort((a,b)=>{
      if(sort==='price-desc')return (b.price||-1)-(a.price||-1);
      if(sort==='name')return String(a.title).localeCompare(String(b.title),'ru');
      return (a.price??Number.MAX_SAFE_INTEGER)-(b.price??Number.MAX_SAFE_INTEGER);
    });
    return items;
  }

  function paginationMarkup(view,total,page){
    const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
    if(pages<=1)return '';
    const nums=[];
    const from=Math.max(1,page-2),to=Math.min(pages,page+2);
    if(from>1)nums.push(1);
    if(from>2)nums.push('…');
    for(let i=from;i<=to;i++)nums.push(i);
    if(to<pages-1)nums.push('…');
    if(to<pages)nums.push(pages);
    return `<div class="f-pagination" aria-label="Страницы каталога">
      <button class="f-page" data-page-view="${view}" data-page="${page-1}" ${page<=1?'disabled':''}>←</button>
      ${nums.map(n=>n==='…'?'<span class="f-page" style="display:grid;place-items:center;border:0;box-shadow:none;cursor:default">…</span>':`<button class="f-page ${n===page?'is-active':''}" data-page-view="${view}" data-page="${n}">${n}</button>`).join('')}
      <button class="f-page" data-page-view="${view}" data-page="${page+1}" ${page>=pages?'disabled':''}>→</button>
    </div>`;
  }

  function renderFurniture(view){
    const mount=$('#furnitureGrid'), count=$('#furnitureCount'), title=$('#furnitureTitle'), desc=$('#furnitureDesc'), subtype=$('#fSubtype');
    if(!mount)return;
    if(title) title.textContent=view==='beds'?'Кровати':'Диваны';
    if(desc) desc.textContent=view==='beds'?'Кровати Berhouse с разными вариантами спального места, основания и комплектации.':'Прямые и угловые диваны Berhouse. В карточках можно переключать фотографии и смотреть характеристики.';
    if(subtype){subtype.style.display=view==='sofas'?'block':'none';if(view!=='sofas'){subtype.value='';state.subtype=''}}
    if(!state.loaded){mount.innerHTML='<div class="f-loading">Загружаем каталог…</div>';return}
    const items=filtered(view);
    const pages=Math.max(1,Math.ceil(items.length/PAGE_SIZE));
    state.page[view]=Math.min(Math.max(1,state.page[view]),pages);
    const page=state.page[view];
    const slice=items.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
    if(count) count.textContent=`Найдено: ${items.length} · страница ${page} из ${pages}`;
    mount.innerHTML=slice.length?slice.map(cardMarkup).join(''):'<div class="f-empty">По выбранным параметрам товары не найдены.</div>';
    const pg=$('#furniturePagination'); if(pg)pg.innerHTML=paginationMarkup(view,items.length,page);
  }

  function renderHomeHits(){
    const mount=$('#homeHitsGrid'); if(!mount)return;
    if(!state.loaded){mount.innerHTML='<div class="f-loading">Загружаем хиты продаж…</div>';return}
    const all=[...state.data.beds,...state.data.sofas];
    const hits=[...state.data.beds.slice(0,3),...state.data.sofas.slice(0,3)];
    mount.innerHTML=hits.length?hits.map(cardMarkup).join(''):'<div class="f-empty">Подборка скоро появится.</div>';
  }

  async function loadFurniture(){
    try{
      const r=await fetch(`data/furniture.json?v=${Date.now()}`,{cache:'no-store'});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      const data=await r.json();
      state.data.beds=Array.isArray(data.beds)?data.beds:[];
      state.data.sofas=Array.isArray(data.sofas)?data.sofas:[];
      state.loaded=true;
    }catch(e){
      console.error('Furniture catalog load failed',e);
      state.loaded=true;
    }
    applyView(routeFromHash(),{scroll:false});
  }

  function bind(){
    document.addEventListener('click',e=>{
      const galleryBtn=e.target.closest('[data-gallery-dir]');
      if(galleryBtn){const g=galleryBtn.closest('[data-gallery-id]');if(g)setGallery(g.dataset.galleryId,Number(galleryBtn.dataset.galleryDir)||1);return}
      const pageBtn=e.target.closest('[data-page-view]');
      if(pageBtn&&!pageBtn.disabled){const view=pageBtn.dataset.pageView;state.page[view]=Number(pageBtn.dataset.page)||1;renderFurniture(view);$('#furnitureCatalog')?.scrollIntoView({behavior:'smooth',block:'start'});return}
      const catLink=e.target.closest('a[href="#catalog"]');
      if(catLink){e.preventDefault();location.hash='mattresses';}
    });
    window.addEventListener('hashchange',()=>{
      const h=(location.hash||'#home').slice(1).split('?')[0];
      if(views.has(h)){applyView(h);return}
      if(['top','guide','delivery','about'].includes(h)){
        applyView('home',{scroll:false});
        requestAnimationFrame(()=>document.getElementById(h)?.scrollIntoView({behavior:'smooth',block:'start'}));
        return;
      }
      applyView('home');
    });
    $('#fSearch')?.addEventListener('input',e=>{const v=routeFromHash();if(v==='beds'||v==='sofas'){state.query[v]=e.target.value;state.page[v]=1;renderFurniture(v)}});
    $('#fSort')?.addEventListener('change',e=>{const v=routeFromHash();if(v==='beds'||v==='sofas'){state.sort[v]=e.target.value;state.page[v]=1;renderFurniture(v)}});
    $('#fSubtype')?.addEventListener('change',e=>{state.subtype=e.target.value;state.page.sofas=1;renderFurniture('sofas')});
    $$('[data-home-link]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();location.hash=a.dataset.homeLink}));
  }

  function init(){
    const tabs=$('#shopTabsMount'); if(tabs)tabs.innerHTML=tabMarkup();
    bind();
    applyView(routeFromHash(),{scroll:false});
    loadFurniture();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
