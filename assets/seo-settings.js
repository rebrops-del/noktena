(() => {
  'use strict';
  const row=(window.NOKTENA_CATALOG_BOOTSTRAP?.rows||[]).find(item=>item.product_key==='settings:seo_v1');
  const settings=row?.payload;
  if(!settings)return;
  const title=String(settings.home_title||'').trim().slice(0,100);
  const description=String(settings.home_description||'').trim().slice(0,250);
  if(!title||!description)return;
  function meta(selector,value){
    const node=document.querySelector(selector);
    if(node)node.setAttribute('content',value);
  }
  document.title=title;
  meta('meta[name="description"]',description);
  meta('meta[property="og:title"]',title);
  meta('meta[property="og:description"]',description);
  meta('meta[name="twitter:title"]',title);
  meta('meta[name="twitter:description"]',description);
  let image;
  try{image=new URL(String(settings.og_image||''));}catch{}
  if(image?.protocol==='https:'&&!image.username&&!image.password){
    meta('meta[property="og:image"]',image.href);
    meta('meta[property="og:image:secure_url"]',image.href);
    meta('meta[name="twitter:image"]',image.href);
    const assetPath=image.searchParams.get('url')||image.pathname;
    const mime=/\.png$/i.test(assetPath)?'image/png':/\.jpe?g$/i.test(assetPath)?'image/jpeg':/\.webp$/i.test(assetPath)?'image/webp':'';
    meta('meta[property="og:image:type"]',mime);
  }
})();
