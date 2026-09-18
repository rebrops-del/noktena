(() => {
  'use strict';
  const interactive='a,button,select,input,textarea,label,summary,details,[data-gallery-dir]';

  function enhance(root=document){
    root.querySelectorAll?.('[data-product-link]').forEach(card=>{
      if(card.dataset.cardEnhanced)return;
      card.dataset.cardEnhanced='1';
      card.setAttribute('tabindex','0');
      card.setAttribute('role','link');
      const title=card.querySelector('h3')?.textContent?.trim();
      if(title)card.setAttribute('aria-label',`Открыть товар: ${title}`);
    });
  }

  document.addEventListener('click',e=>{
    const card=e.target.closest('[data-product-link]');
    if(!card)return;
    if(e.target.closest(interactive))return;
    const url=card.dataset.productLink;
    if(url)location.href=url;
  });

  document.addEventListener('keydown',e=>{
    if(e.key!=='Enter'&&e.key!==' ')return;
    const card=e.target.closest('[data-product-link]');
    if(!card||e.target.closest(interactive))return;
    e.preventDefault();
    const url=card.dataset.productLink;
    if(url)location.href=url;
  });

  const observer=new MutationObserver(mutations=>mutations.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1)enhance(n)})));
  observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>enhance());else enhance();
})();
