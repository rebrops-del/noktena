(()=>{
  'use strict';
  const params=new URLSearchParams(location.search);
  if(params.get('kind')!=='mattress')return;
  const normalize=value=>String(value||'').trim().replace(/[«»„“”]/g,'"').replace(/\s+/g,' ');
  if(normalize(params.get('model'))!=='Наматрасник "Непромокаемый чехол"')return;

  const src='assets/admin-mattress-thumbs/r5-c2.webp?v=20260922-topper2';
  function apply(){
    const media=document.querySelector('.pd-main-media');
    if(!media)return false;
    media.classList.remove('pd-sprite-media');
    media.style.setProperty('--pd-bg',`url('${src}')`);
    const sprite=media.querySelector('.pd-sprite');
    if(sprite)sprite.remove();
    let img=media.querySelector('#pdMainImage');
    if(!img){
      img=document.createElement('img');
      img.id='pdMainImage';
      img.decoding='async';
      img.referrerPolicy='no-referrer';
      media.prepend(img);
    }
    img.src=src;
    img.alt=params.get('model')||'Наматрасник НОКТЕНА';
    const counter=media.querySelector('#pdCounter,.pd-counter');
    if(counter)counter.textContent='1 фото';
    media.querySelectorAll('.pd-gallery-arrow').forEach(el=>el.remove());
    const thumbs=document.querySelector('#pdThumbs,.pd-thumbs');
    if(thumbs)thumbs.remove();
    return true;
  }

  if(apply())return;
  const observer=new MutationObserver(()=>{if(apply())observer.disconnect();});
  observer.observe(document.getElementById('productRoot')||document.body,{childList:true,subtree:true});
  window.addEventListener('load',apply,{once:true});
})();
