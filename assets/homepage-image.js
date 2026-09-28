(() => {
  'use strict';
  const image=document.querySelector('#homeHeroImage');
  const settings=(window.NOKTENA_CATALOG_BOOTSTRAP?.rows||[]).find(row=>row.product_key==='settings:hero_v1')?.payload;
  if(!image||!settings?.url)return;
  let url;
  try{url=new URL(String(settings.url))}catch{return}
  if(url.protocol!=='https:'||url.username||url.password)return;
  const originalSrc=image.getAttribute('src'),originalAlt=image.alt;
  image.addEventListener('error',()=>{image.src=originalSrc;image.alt=originalAlt},{once:true});
  image.src=url.href;
  image.alt=String(settings.alt||'').trim().slice(0,160)||originalAlt;
})();
