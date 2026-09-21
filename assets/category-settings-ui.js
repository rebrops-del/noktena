(()=>{
  'use strict';
  const b=window.NOKTENA_CATALOG_BOOTSTRAP||{};
  const legacy=b.deliverySettings||{};
  const v2row=(b.rows||[]).find(r=>r.product_key==='settings:delivery_v2');
  const raw=v2row?.payload||{};
  const delivery={
    delivery_price:Math.max(0,Number(raw.delivery_price??legacy.delivery_price)||0),
    cargo_lift_price:Math.max(0,Number(raw.cargo_lift_price??legacy.lift_price)||0),
    stair_lift_price:Math.max(0,Number(raw.stair_lift_price)||0),
    sofa_lift_surcharge:Math.max(0,Number(raw.sofa_lift_surcharge??legacy.sofa_lift_surcharge)||0),
    free_delivery_from:Math.max(0,Number(raw.free_delivery_from??legacy.free_delivery_from)||0),
    delivery_schedule:String(raw.delivery_schedule||'').trim()
  };
  const BADGES={
    hit:{label:'Хит продаж',className:'hit'},
    sale:{label:'Распродажа',className:'sale'},
    last:{label:'Последняя штука',className:'last'},
    new:{label:'Новинка',className:'new'}
  };
  const money=n=>`${Math.round(Number(n)||0).toLocaleString('ru-RU')} ₽`;
  const style=document.createElement('style');
  style.textContent=`
    .global-delivery-chip{display:none!important}.global-delivery-product{margin-top:8px;padding:9px 11px;border-radius:10px;background:#f2f8f4;color:#315c4c;font-size:12px;font-weight:700}
    .global-delivery-product{margin:12px 0 0;font-size:13px;line-height:1.55}.global-delivery-product strong{color:#0a8d55}.global-delivery-chip{line-height:1.5}
    .product-promo-badge{display:inline-flex;align-items:center;justify-content:center;min-height:24px;padding:5px 10px;border-radius:999px;font-size:10px;font-weight:900;letter-spacing:.035em;text-transform:uppercase;white-space:nowrap;box-shadow:0 5px 14px rgba(0,0,0,.08)}
    .product-promo-badge.hit{background:#e5323d;color:#fff}
    .product-promo-badge.sale{background:#f3a52a;color:#fff}
    .product-promo-badge.last{background:#9f4a31;color:#fff}
    .product-promo-badge.new{background:#0a8d55;color:#fff}
    .card .product-promo-badge{align-self:start}
    .pd-product-badge{margin:0 0 10px}
  `;
  document.head.appendChild(style);
  const value=n=>n>0?money(n):'Уточняется';

  function updateDeliverySection(){
    const grid=document.querySelector('#delivery .dgrid');
    if(!grid)return;
    const signature=[delivery.delivery_price,delivery.cargo_lift_price,delivery.stair_lift_price,delivery.sofa_lift_surcharge,delivery.free_delivery_from,delivery.delivery_schedule].join(':');
    if(grid.querySelector(`[data-global-delivery="${CSS.escape(signature)}"]`))return;
    const cards=[
      `<div class="d" data-global-delivery="${signature.replace(/"/g,'&quot;')}">Доставка<b>${value(delivery.delivery_price)}</b><small>до подъезда по г. Екатеринбург</small></div>`,
      `<div class="d">Грузовой лифт<b>${value(delivery.cargo_lift_price)}</b><small>подъём на этаж при наличии грузового лифта</small></div>`,
      `<div class="d">По лестнице<b>${delivery.stair_lift_price>0?money(delivery.stair_lift_price)+' / этаж':'Уточняется'}</b><small>ручной подъём по лестнице, стоимость за один этаж</small></div>`,
      `<div class="d">Подъём дивана<b>${delivery.sofa_lift_surcharge>0?'+'+money(delivery.sofa_lift_surcharge):'Без доплаты'}</b><small>доплата к выбранному способу подъёма дивана</small></div>`,
      `<div class="d">График<b>${delivery.delivery_schedule||'Уточняется'}</b><small>плановые дни и время доставки</small></div>`
    ];
    if(delivery.free_delivery_from>0)cards.push(`<div class="d">Бесплатная доставка<b>от ${money(delivery.free_delivery_from)}</b><small>порог бесплатной доставки</small></div>`);
    grid.innerHTML=cards.join('');
  }

  let furnitureMapPromise=null;
  async function furnitureMap(){
    if(furnitureMapPromise)return furnitureMapPromise;
    furnitureMapPromise=(async()=>{try{const r=await fetch('data/furniture.json?delivery-ui=5',{cache:'force-cache'});if(!r.ok)return new Map();const d=await r.json();return new Map([...(d.beds||[]).map(x=>[String(x.id),'beds']),...(d.sofas||[]).map(x=>[String(x.id),'sofas'])])}catch{return new Map()}})();
    return furnitureMapPromise;
  }
  function customCategory(id){const row=(b.rows||[]).find(r=>r.product_key===`furniture:${id}`);return row?.payload?.category||''}
  function rowOverride(kind,key){const pk=kind==='mattress'?`mattress:${key}`:`furniture:${key}`;return(b.rows||[]).find(r=>r.product_key===pk)?.payload||null}
  function effective(category,override){
    const hasD=override&&Object.prototype.hasOwnProperty.call(override,'deliveryPriceOverride')&&override.deliveryPriceOverride!==''&&override.deliveryPriceOverride!=null;
    const hasF=override&&Object.prototype.hasOwnProperty.call(override,'freeDeliveryFromOverride')&&override.freeDeliveryFromOverride!==''&&override.freeDeliveryFromOverride!=null;
    return{
      delivery_price:hasD?Math.max(0,Number(override.deliveryPriceOverride)||0):delivery.delivery_price,
      free_delivery_from:hasF?Math.max(0,Number(override.freeDeliveryFromOverride)||0):delivery.free_delivery_from,
      cargo_lift_price:delivery.cargo_lift_price,
      stair_lift_price:delivery.stair_lift_price,
      sofa_lift_surcharge:category==='sofas'?delivery.sofa_lift_surcharge:0,
      delivery_schedule:delivery.delivery_schedule
    };
  }
  function chipText(s){
    const parts=[
      s.delivery_price>0?`доставка ${money(s.delivery_price)}`:'доставка — уточняется',
      s.cargo_lift_price>0?`грузовой лифт ${money(s.cargo_lift_price)}`:'грузовой лифт — уточняется',
      s.stair_lift_price>0?`лестница ${money(s.stair_lift_price)}/этаж`:'лестница — уточняется'
    ];
    if(s.sofa_lift_surcharge>0)parts.push(`диван +${money(s.sofa_lift_surcharge)}`);
    if(s.free_delivery_from>0)parts.push(`бесплатно от ${money(s.free_delivery_from)}`);
    if(s.delivery_schedule)parts.push(`график: ${s.delivery_schedule}`);
    return parts.join(' · ');
  }
  async function decorateCards(){
    const fmap=await furnitureMap();
    document.querySelectorAll('.product-open-card:not([data-delivery-decorated])').forEach(card=>{
      const link=card.getAttribute('data-product-link')||card.querySelector('a[href*="product.html"]')?.getAttribute('href')||'';
      let category='',key='',kind='';
      try{
        const u=new URL(link,location.href),p=u.searchParams;
        kind=p.get('kind')||'';
        if(kind==='mattress'){category='mattress';key=p.get('model')||''}
        else if(kind==='furniture'){key=p.get('id')||'';category=customCategory(key)||fmap.get(key)||''}
      }catch{}
      if(!category)return;
      const s=effective(category,rowOverride(kind,key)),target=card.querySelector('.cardbottom,.f-card-bottom,.body,.f-card-body');
      if(target){const el=document.createElement('div');el.className='global-delivery-chip';el.textContent=chipText(s);target.prepend(el);card.dataset.deliveryDecorated='1'}
    });
  }

  function badgeState(kind,key){
    const override=rowOverride(kind,key);
    if(!override||!Object.prototype.hasOwnProperty.call(override,'badge'))return null;
    const badge=String(override.badge||'');
    if(badge==='none'||badge==='')return {type:'none'};
    return BADGES[badge]?{type:badge,...BADGES[badge]}:{type:'none'};
  }
  function cardIdentity(card){
    const link=card.getAttribute('data-product-link')||card.querySelector('a[href*="product.html"]')?.getAttribute('href')||'';
    try{
      const u=new URL(link,location.href),p=u.searchParams,kind=p.get('kind')||'';
      if(kind==='mattress')return{kind,key:p.get('model')||''};
      if(kind==='furniture')return{kind,key:p.get('id')||''};
    }catch{}
    return null;
  }
  function renderBadge(card,state){
    if(!state)return;
    card.querySelectorAll('.product-promo-badge').forEach(x=>x.remove());
    if(card.matches('.card'))card.querySelectorAll('.hit-badge').forEach(x=>x.remove());
    if(card.matches('.f-card'))card.querySelectorAll('.f-card-overlay-tags .hit').forEach(x=>x.remove());
    if(state.type==='none')return;
    const el=document.createElement(card.matches('.f-card')?'span':'div');
    el.className=`product-promo-badge ${state.className}`;
    el.textContent=state.label;
    if(card.matches('.f-card')){
      const container=card.querySelector('.f-card-overlay-tags');
      if(container)container.appendChild(el);
    }else{
      const top=card.querySelector('.cardtop');
      if(top)top.prepend(el);
    }
  }
  function decorateBadges(){
    document.querySelectorAll('.product-open-card:not([data-badge-decorated])').forEach(card=>{
      const id=cardIdentity(card);if(!id)return;
      const state=badgeState(id.kind,id.key);
      if(state)renderBadge(card,state);
      card.dataset.badgeDecorated='1';
    });
  }
  function decorateProductDetail(){
    const p=new URLSearchParams(location.search),kind=p.get('kind')||'';
    const key=kind==='mattress'?(p.get('model')||''):kind==='furniture'?(p.get('id')||''):'';
    if(!kind||!key)return;
    const state=badgeState(kind,key);if(!state||state.type==='none')return;
    const inject=()=>{
      if(document.querySelector('.pd-product-badge'))return true;
      const title=document.querySelector('.pd-info-card h1,.pd-title,h1');
      if(!title)return false;
      const el=document.createElement('div');
      el.className=`product-promo-badge ${state.className} pd-product-badge`;
      el.textContent=state.label;
      title.insertAdjacentElement('beforebegin',el);
      return true;
    };
    if(inject())return;
    const mo=new MutationObserver(()=>{if(inject())mo.disconnect()});
    mo.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>mo.disconnect(),12000);
  }

  async function addProductDelivery(){
    const p=new URLSearchParams(location.search),kind=p.get('kind');if(!kind)return;
    let category='',key='';
    if(kind==='mattress'){category='mattress';key=p.get('model')||''}
    else if(kind==='furniture'){key=p.get('id')||'';category=customCategory(key);if(!category)category=(await furnitureMap()).get(key)||''}
    if(!category)return;
    const s=effective(category,rowOverride(kind,key));
    const inject=()=>{
      const price=document.querySelector('.pd-info-card .pd-price-row');
      if(!price||document.querySelector('.global-delivery-product'))return false;
      const el=document.createElement('div');el.className='global-delivery-product';el.innerHTML=`<strong>Доставка и подъём:</strong> ${chipText(s)}`;price.insertAdjacentElement('afterend',el);return true;
    };
    if(inject())return;
    const mo=new MutationObserver(()=>{if(inject())mo.disconnect()});
    mo.observe(document.getElementById('productRoot')||document.body,{childList:true,subtree:true});
    setTimeout(()=>mo.disconnect(),15000);
  }

  let refreshQueued=false;
  function refresh(){
    if(refreshQueued)return;
    refreshQueued=true;
    setTimeout(async()=>{
      refreshQueued=false;
      updateDeliverySection();
      document.querySelectorAll('.global-delivery-chip').forEach(el=>el.remove());
      decorateBadges();
    },0);
  }
  refresh();
  addProductDelivery();
  decorateProductDetail();
  const observer=new MutationObserver(refresh);
  observer.observe(document.body,{childList:true,subtree:true});
})();