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
  function safeSocial(raw,type){
    let url;try{url=new URL(String(raw||''))}catch{}
    if(!url||url.protocol!=='https:'||url.username||url.password||url.port)return null;
    const host=url.hostname.toLowerCase(),path=url.pathname.replace(/^\/+|\/+$/g,'');
    if(type==='telegram')return ['t.me','www.t.me','telegram.me'].includes(host)&&path&&!path.startsWith('share/')?url.href:null;
    if(type==='whatsapp')return host==='wa.me'&&(/^[1-9]\d{9,14}$/.test(path)||/^message\/[a-z0-9]+$/i.test(path))?url.href:
      host==='api.whatsapp.com'&&path==='send'&&/^[1-9]\d{9,14}$/.test(url.searchParams.get('phone')||'')?url.href:null;
    if(type==='vk')return ['vk.com','www.vk.com','m.vk.com','vk.ru','www.vk.ru'].includes(host)&&!!path?url.href:null;
    return null;
  }
  const socials=[
    {type:'telegram',name:'Telegram',url:safeSocial(settings.telegram_url,'telegram')},
    {type:'whatsapp',name:'WhatsApp',url:safeSocial(settings.whatsapp_url,'whatsapp')},
    {type:'vk',name:'VK',url:safeSocial(settings.vk_url,'vk')}
  ].filter(item=>item.url);
  const signature=JSON.stringify(socials.map(item=>item.url));
  function updateSocials(){
    document.querySelectorAll('[data-contact-socials]').forEach(container=>{
      if(container.dataset.contactSignature===signature)return;
      const links=socials.map(item=>{
        const link=document.createElement('a');link.className='contact-social-link';
        link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';
        link.setAttribute('aria-label','Написать в '+item.name);
        const icon=document.createElement('span');icon.className='contact-social-icon';
        const image=document.createElement('img');image.src='/assets/brand-'+item.type+'.svg';image.alt='';
        image.setAttribute('aria-hidden','true');icon.append(image);
        const label=document.createElement('span');label.textContent=item.name;
        link.append(icon,label);return link;
      });
      container.replaceChildren(...links);
      container.hidden=links.length===0;
      container.dataset.contactSignature=signature;
    });
  }
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
        const sameAs=[maxUrl.href,...socials.map(item=>item.url)];
        if(data['@type']==='Store'&&(data.telephone!=='+'+digits||JSON.stringify(data.sameAs)!==JSON.stringify(sameAs))){
          data.telephone='+'+digits;
          data.sameAs=sameAs;
          jsonLd.textContent=JSON.stringify(data);
        }
      }catch{}
    }
    updateSocials();
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
