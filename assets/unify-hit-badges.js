(()=>{
  'use strict';

  const BADGE_TEXT='Хит продаж';
  const CARD_SELECTOR='.card,.f-card,.product-open-card';

  function isHit(el){
    if(!(el instanceof HTMLElement))return false;
    const text=(el.textContent||'').trim().replace(/\s+/g,' ').toLowerCase();
    if(text==='хит продаж')return true;
    return el.classList.contains('hit-badge') ||
      (el.classList.contains('product-promo-badge')&&el.classList.contains('hit')) ||
      (el.classList.contains('hit')&&el.closest('.f-card-overlay-tags'));
  }

  function forceStyle(el){
    el.textContent=BADGE_TEXT;
    el.classList.add('noktena-hit-unified');
    const s=el.style;
    const set=(name,value)=>s.setProperty(name,value,'important');
    set('display','inline-flex');
    set('align-items','center');
    set('justify-content','center');
    set('width','auto');
    set('min-width','0');
    set('max-width','max-content');
    set('height','32px');
    set('min-height','32px');
    set('max-height','32px');
    set('padding','0 13px');
    set('margin','0');
    set('box-sizing','border-box');
    set('border','1px solid #ef3340');
    set('border-radius','999px');
    set('background','#ef3340');
    set('background-image','none');
    set('color','#ffffff');
    set('-webkit-text-fill-color','#ffffff');
    set('font-family','Onest, Arial, "Segoe UI", sans-serif');
    set('font-size','11px');
    set('font-style','normal');
    set('font-weight','800');
    set('line-height','1');
    set('letter-spacing','.025em');
    set('text-transform','uppercase');
    set('text-decoration','none');
    set('white-space','nowrap');
    set('box-shadow','none');
    set('text-shadow','none');
    set('transform','none');
    set('vertical-align','top');
    set('flex','0 0 auto');
  }

  function normalizeCard(card){
    const candidates=[...card.querySelectorAll('.hit-badge,.product-promo-badge.hit,.f-card-overlay-tags .hit,.noktena-hit-unified')].filter(isHit);
    if(!candidates.length)return;

    // There must never be two visually different "Хит продаж" badges in one card.
    const first=candidates[0];
    for(const duplicate of candidates.slice(1))duplicate.remove();
    forceStyle(first);

    // Keep the same spacing to the product title in mattress cards.
    const title=card.querySelector('.cardtop h3');
    if(title&&first.parentElement===title.parentElement){
      first.style.setProperty('margin-bottom','14px','important');
    }
  }

  function normalize(root=document){
    if(root instanceof HTMLElement && root.matches(CARD_SELECTOR))normalizeCard(root);
    root.querySelectorAll?.(CARD_SELECTOR).forEach(normalizeCard);
  }

  // Run after all catalog scripts, then keep enforcing the same element style when cards are redrawn.
  normalize();
  requestAnimationFrame(()=>normalize());
  setTimeout(()=>normalize(),150);
  setTimeout(()=>normalize(),700);

  const observer=new MutationObserver(records=>{
    for(const record of records){
      for(const node of record.addedNodes){
        if(node.nodeType===1)normalize(node);
      }
    }
  });
  observer.observe(document.body,{childList:true,subtree:true});
})();
