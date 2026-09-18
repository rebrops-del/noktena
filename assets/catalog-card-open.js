(() => {
  'use strict';

  const interactive='button,select,input,textarea,label,summary,details,[data-gallery-dir],[data-card-color],[data-card-size]';

  function resolveProductUrl(raw){
    if(!raw)return '';
    try{return new URL(raw, document.baseURI).href;}catch(_){return raw;}
  }

  function openProduct(raw){
    const url=resolveProductUrl(raw);
    if(!url)return;
    window.location.assign(url);
  }

  function enhance(root=document){
    const cards=[];
    if(root.matches?.('[data-product-link]'))cards.push(root);
    root.querySelectorAll?.('[data-product-link]').forEach(card=>cards.push(card));
    cards.forEach(card=>{
      if(card.dataset.cardEnhanced)return;
      card.dataset.cardEnhanced='1';
      card.setAttribute('tabindex','0');
      card.setAttribute('role','link');
      const title=card.querySelector('h3')?.textContent?.trim();
      if(title)card.setAttribute('aria-label',`Открыть товар: ${title}`);
    });
  }

  document.addEventListener('click',e=>{
    const detailLink=e.target.closest('a.product-more-link, a.f-card-details-link');
    if(detailLink){
      const href=detailLink.getAttribute('href');
      if(href){
        e.preventDefault();
        e.stopPropagation();
        openProduct(href);
      }
      return;
    }

    const card=e.target.closest('[data-product-link]');
    if(!card)return;
    if(e.target.closest('a'))return;
    if(e.target.closest(interactive))return;
    e.preventDefault();
    openProduct(card.dataset.productLink);
  });

  document.addEventListener('keydown',e=>{
    if(e.key!=='Enter'&&e.key!==' ')return;
    const card=e.target.closest('[data-product-link]');
    if(!card||e.target.closest('a')||e.target.closest(interactive))return;
    e.preventDefault();
    openProduct(card.dataset.productLink);
  });

  const observer=new MutationObserver(mutations=>mutations.forEach(m=>m.addedNodes.forEach(n=>{
    if(n.nodeType===1)enhance(n);
  })));
  observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>enhance());else enhance();
})();
