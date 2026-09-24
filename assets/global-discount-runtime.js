(()=>{
  'use strict';
  const KEY='settings:discount_global_v1';

  const clamp=value=>Math.min(99,Math.max(0,Math.round(Number(value)||0)));
  const getSettings=()=>{
    const rows=window.NOKTENA_CATALOG_BOOTSTRAP?.rows||[];
    const row=rows.find(r=>r.product_key===KEY);
    if(!row)return{enabled:false,percent:0};
    const p=row.payload||{};
    return{enabled:p.enabled===true,percent:clamp(Object.prototype.hasOwnProperty.call(p,'percent')?p.percent:0)};
  };
  const parseMoney=text=>{
    const n=Number(String(text||'').replace(/[^0-9]/g,''));
    return Number.isFinite(n)&&n>0?n:0;
  };
  const money=value=>`${Math.round(Number(value)||0).toLocaleString('ru-RU')} ₽`;
  const oldPrice=(price,pct)=>price>0&&pct>0?Math.round((price/(1-pct/100))/100)*100:0;

  function ensureStyle(){
    if(document.getElementById('global-discount-style'))return;
    const style=document.createElement('style');
    style.id='global-discount-style';
    style.textContent=`
      .discount-badge,.f-discount-badge,.pd-discount{
        display:inline-flex!important;align-items:center!important;justify-content:center!important;
        height:26px!important;min-width:54px!important;padding:0 10px!important;margin:0!important;
        border:1px solid #efcfd0!important;border-radius:999px!important;
        background:#fff3f3!important;color:#b64b50!important;
        font-family:"Onest",Arial,sans-serif!important;font-size:12px!important;font-weight:700!important;
        line-height:1!important;letter-spacing:0!important;white-space:nowrap!important;box-shadow:none!important;
      }
      .old-price-line,.f-old-price-line,.pd-old-row{align-items:center!important;gap:9px!important}
    `;
    document.head.appendChild(style);
  }

  function applyBlock(root,priceSelector,oldSelector,badgeSelector,rowSelector,pct,force){
    const priceEl=root.querySelector(priceSelector),oldEl=root.querySelector(oldSelector),badgeEl=root.querySelector(badgeSelector),row=root.querySelector(rowSelector);
    if(!badgeEl)return;
    if(force){
      if(pct<=0){if(row)row.style.display='none';return;}
      const sale=parseMoney(priceEl?.textContent);
      if(row)row.style.display='';
      const label=`−${pct}%`;
      if(badgeEl.textContent!==label)badgeEl.textContent=label;
      const old=oldPrice(sale,pct);
      if(oldEl&&old>0){const text=money(old);if(oldEl.textContent!==text)oldEl.textContent=text;}
    }
  }

  let scheduled=false;
  function apply(){
    scheduled=false;ensureStyle();
    const s=getSettings();
    document.querySelectorAll('.card').forEach(root=>applyBlock(root,'.price','.old-price','.discount-badge','.old-price-line',s.percent,s.enabled));
    document.querySelectorAll('.f-card').forEach(root=>applyBlock(root,'.f-price','.f-old-price','.f-discount-badge','.f-old-price-line',s.percent,s.enabled));
    document.querySelectorAll('.pd-info-card').forEach(root=>applyBlock(root,'.pd-price','.pd-old-price','.pd-discount','.pd-old-row',s.percent,s.enabled));
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(apply);}

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  window.addEventListener('hashchange',schedule);window.addEventListener('load',schedule,{once:true});
})();
