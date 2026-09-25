(() => {
  'use strict';
  const row=(window.NOKTENA_CATALOG_BOOTSTRAP?.rows||[]).find(item=>item.product_key==='settings:contacts_v1');
  const settings=row?.payload;
  if(!settings)return;
  const phone=String(settings.phone||'').trim();
  const digits=phone.replace(/\D/g,'');
  let maxUrl;
  try{maxUrl=new URL(String(settings.max_url||''))}catch{}
  if(!phone.startsWith('+7')||digits.length!==11||!maxUrl||maxUrl.protocol!=='https:'||!['max.ru','www.max.ru'].includes(maxUrl.hostname)||maxUrl.pathname==='/'||maxUrl.username||maxUrl.password||maxUrl.port)return;
  function updateLinks(){
    document.querySelectorAll('a[href^="tel:"]').forEach(link=>{
      const href='tel:+'+digits;
      if(link.getAttribute('href')!==href)link.setAttribute('href',href);
      if(/^\+?\d[\d\s()\-]{8,}$/.test(link.textContent.trim())&&link.textContent!==phone)link.textContent=phone;
    });
    document.querySelectorAll('a[href*="max.ru"]').forEach(link=>{if(link.href!==maxUrl.href)link.href=maxUrl.href});
    const jsonLd=document.querySelector('script[type="application/ld+json"]');
    if(jsonLd){
      try{
        const data=JSON.parse(jsonLd.textContent);
        if(data['@type']==='Store'&&(data.telephone!=='+'+digits||data.sameAs?.[0]!==maxUrl.href)){
          data.telephone='+'+digits;
          data.sameAs=[maxUrl.href];
          jsonLd.textContent=JSON.stringify(data);
        }
      }catch{}
    }
  }
  let scheduled=false;
  const observer=new MutationObserver(()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;updateLinks()});
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',updateLinks,{once:true});
  else updateLinks();
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
