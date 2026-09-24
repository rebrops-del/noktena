(()=>{
  'use strict';
  const b=window.NOKTENA_CATALOG_BOOTSTRAP||{};
  const rows=Array.isArray(b.rows)?b.rows:[];
  const overrides=new Map(rows.filter(r=>r.kind==='mattress').map(r=>[String(r.product_key||'').replace(/^mattress:/,''),r.payload||{}]));

  const style=document.createElement('style');
  style.textContent=`
    .hit-badge,
    .product-promo-badge.hit,
    .f-card-overlay-tags .hit{
      display:inline-flex!important;
      align-items:center!important;
      justify-content:center!important;
      height:32px!important;
      min-height:32px!important;
      padding:0 13px!important;
      border-radius:999px!important;
      background:#ef3340!important;
      border:1px solid #ef3340!important;
      color:#fff!important;
      font-family:Onest,Arial,"Segoe UI",sans-serif!important;
      font-size:11px!important;
      line-height:1!important;
      font-weight:800!important;
      letter-spacing:.025em!important;
      text-transform:uppercase!important;
      white-space:nowrap!important;
      box-shadow:none!important;
      box-sizing:border-box!important;
    }
  `;
  document.head.appendChild(style);

  const money=n=>`${Math.round(Number(n)||0).toLocaleString('ru-RU')} ₽`;
  const parseMoney=text=>Number(String(text||'').replace(/\s/g,'').match(/\d+/g)?.join('')||0);
  const clamp=n=>Math.min(99,Math.max(0,Math.round(Number(n)||0)));
  const comparePrice=(price,pct)=>price>0&&pct>0?Math.round((price/(1-pct/100))/100)*100:0;

  function modelFromCard(card){
    const raw=card.getAttribute('data-product-link')||card.querySelector('a[href*="product.html"]')?.getAttribute('href')||'';
    try{return new URL(raw,location.href).searchParams.get('model')||''}catch{return''}
  }

  function apply(card){
    if(!card.matches('.card'))return;
    const model=modelFromCard(card);if(!model)return;
    const o=overrides.get(model)||{};
    const pct=Object.prototype.hasOwnProperty.call(o,'discountPercent')?clamp(o.discountPercent):0;
    const price=parseMoney(card.querySelector('.price')?.textContent||'');
    const line=card.querySelector('.old-price-line');
    const old=card.querySelector('.old-price');
    const badge=card.querySelector('.discount-badge');
    const cmp=comparePrice(price,pct);
    if(line)line.style.display=pct>0&&cmp>0?'':'none';
    if(old&&cmp>0)old.textContent=money(cmp);
    if(badge)badge.textContent=`−${pct}%`;

    const promo=card.querySelector('.promo');
    if(promo){
      const title=Object.prototype.hasOwnProperty.call(o,'promoLabel')?String(o.promoLabel??'').trim():'';
      const subtitle=Object.prototype.hasOwnProperty.call(o,'promoSubtext')?String(o.promoSubtext??'').trim():'';
      promo.style.display=title||subtitle?'':'none';
      const bEl=promo.querySelector('b'),sEl=promo.querySelector('span');
      if(bEl){bEl.textContent=title;bEl.style.display=title?'':'none'}
      if(sEl){sEl.textContent=subtitle;sEl.style.display=subtitle?'':'none'}
    }

    const select=card.querySelector('.size-select');
    if(select&&!select.dataset.adminCardSettingsBound){
      select.dataset.adminCardSettingsBound='1';
      select.addEventListener('change',()=>setTimeout(()=>apply(card),0));
    }
  }

  function refresh(root=document){
    if(root.matches?.('.card'))apply(root);
    root.querySelectorAll?.('.card').forEach(apply);
  }
  refresh();
  new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1)refresh(n)}))).observe(document.body,{childList:true,subtree:true});
})();
