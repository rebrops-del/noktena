(()=>{
  'use strict';
  const KEY='settings:promo_global_v1';
  const getSettings=()=>{const rows=window.NOKTENA_CATALOG_BOOTSTRAP?.rows||[];const row=rows.find(r=>r.product_key===KEY);const p=row?.payload||{};return{enabled:p.enabled===true,title:String(p.title??''),subtitle:String(p.subtitle??'')};};
  function setPair(box,title,subtitle,detail=false){if(!box)return;const hide=!title&&!subtitle;box.style.display=hide?'none':'';if(hide)return;if(detail){let main=box.querySelector('.pd-status-gold');let sub=box.querySelector('small');if(title){if(!main){main=document.createElement('span');main.className='pd-status-gold';box.prepend(main)}if(main.textContent!==title)main.textContent=title;}else if(main)main.remove();if(subtitle){if(!sub){sub=document.createElement('small');box.appendChild(sub)}if(sub.textContent!==subtitle)sub.textContent=subtitle;}else if(sub)sub.remove();return;}let main=box.querySelector('b');let sub=box.querySelector('span');if(title){if(!main){main=document.createElement('b');box.prepend(main)}if(main.textContent!==title)main.textContent=title;}else if(main)main.remove();if(subtitle){if(!sub){sub=document.createElement('span');box.appendChild(sub)}if(sub.textContent!==subtitle)sub.textContent=subtitle;}else if(sub)sub.remove();}
  let scheduled=false;
  function apply(){scheduled=false;const s=getSettings();if(!s.enabled)return;document.querySelectorAll('.promo,.f-price-promo').forEach(el=>setPair(el,s.title,s.subtitle,false));document.querySelectorAll('.pd-status').forEach(el=>setPair(el,s.title,s.subtitle,true));}
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(apply)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('hashchange',schedule);window.addEventListener('load',schedule,{once:true});
})();
