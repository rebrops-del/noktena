(()=>{
  'use strict';
  const SRC='assets/admin-mattress-thumbs/r5-c2.webp?v=20260922-topper3';
  const norm=v=>String(v||'').toLowerCase().replace(/[«»„“”"']/g,'').replace(/ё/g,'е').replace(/\s+/g,' ').trim();
  const isTopperLink=href=>{try{const u=new URL(href,location.href);return norm(u.searchParams.get('model')).includes('наматрасник')&&norm(u.searchParams.get('model')).includes('непромокаемый чехол')}catch{return false}};
  function apply(){document.querySelectorAll('.card.product-open-card').forEach(card=>{const href=card.dataset.productLink||card.querySelector('a[href*="product.html"]')?.getAttribute('href')||'';if(!isTopperLink(href))return;let media=card.querySelector('.photo-media');if(!media)return;let img=media.querySelector('img');if(!img){img=document.createElement('img');media.replaceChildren(img);}img.src=SRC;img.alt='Наматрасник «Непромокаемый чехол»';img.loading='lazy';img.decoding='async';img.style.width='100%';img.style.height='100%';img.style.objectFit='cover';});}
  let pending=false;function schedule(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;apply()})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('hashchange',schedule);
})();
