(() => {
  'use strict';
  const core=window.NoktenaBrandCore;
  if(!core)return;
  let brand=core.fromRows(window.NOKTENA_CATALOG_BOOTSTRAP?.rows);
  const textSources=new WeakMap(),attributeSources=new WeakMap(),metaSources=new WeakMap(),iconSources=new WeakMap();
  let titleSource=null,titleRendered=null;
  const looksBranded=value=>/НОКТЕН(?:А|Ы|Е)/i.test(value||'')||brand.previous_names.some(old=>String(value||'').toLocaleLowerCase('ru-RU').includes(old.toLocaleLowerCase('ru-RU')));
  const replace=value=>core.replace(value,brand.name,brand.previous_names);
  function brandedText(node){
    if(!node.nodeValue||node.parentElement?.closest('script,style,noscript,textarea,[contenteditable="true"],[data-privacy-field]'))return;
    const previous=textSources.get(node);
    const source=previous&&previous.rendered===node.nodeValue?previous.source:node.nodeValue;
    if(!looksBranded(source))return;
    const rendered=replace(source);
    textSources.set(node,{source,rendered});
    if(node.nodeValue!==rendered)node.nodeValue=rendered;
  }
  function brandedAttribute(node,key){
    const value=node.getAttribute(key);
    if(value==null)return;
    let sources=attributeSources.get(node);
    const previous=sources?.[key];
    const source=previous&&previous.rendered===value?previous.source:value;
    if(!looksBranded(source))return;
    const rendered=replace(source);
    if(!sources){sources={};attributeSources.set(node,sources)}
    sources[key]={source,rendered};
    if(value!==rendered)node.setAttribute(key,rendered);
  }
  function walk(node){
    if(node.nodeType===3){brandedText(node);return}
    if(node.nodeType!==1||node.matches('script,style,noscript,textarea,[contenteditable="true"],[data-privacy-field]'))return;
    for(const key of ['alt','aria-label','title','placeholder'])brandedAttribute(node,key);
    const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);
    while(walker.nextNode())brandedText(walker.currentNode);
    for(const element of node.querySelectorAll('[alt],[aria-label],[title],[placeholder]'))for(const key of ['alt','aria-label','title','placeholder'])brandedAttribute(element,key);
    for(const img of [node,...node.querySelectorAll('img[data-brand-logo]')]){
      if(img.matches?.('img[data-brand-logo]')){
        if(!img.dataset.defaultBrandLogo)img.dataset.defaultBrandLogo=img.getAttribute('src')||'';
        if(!img.dataset.brandErrorBound){
          img.dataset.brandErrorBound='true';
          img.addEventListener('error',()=>{if(img.getAttribute('src')!==img.dataset.defaultBrandLogo)img.src=img.dataset.defaultBrandLogo});
        }
        const target=brand.logo_url||img.dataset.defaultBrandLogo;
        if(img.getAttribute('src')!==target)img.src=target;
        img.alt=brand.name;
      }
    }
  }
  function meta(){
    const source=titleSource!==null&&titleRendered===document.title?titleSource:document.title;
    titleSource=source;titleRendered=replace(source);document.title=titleRendered;
    for(const node of document.querySelectorAll('meta[content]')){
      const previous=metaSources.get(node),source=previous&&previous.rendered===node.content?previous.source:node.content;
      if(looksBranded(source)){
        const rendered=replace(source);metaSources.set(node,{source,rendered});node.content=rendered;
      }
    }
    const siteName=document.querySelector('meta[property="og:site_name"]');if(siteName)siteName.content=brand.name;
    for(const script of document.querySelectorAll('script[type="application/ld+json"]')){
      try{const data=JSON.parse(script.textContent);if(data['@type']==='Store'){
        data.name=brand.name;
        if(brand.logo_url)data.logo=brand.logo_url;
        script.textContent=JSON.stringify(data).replace(/</g,'\\u003c');
      }}catch{}
    }
    const theme=document.querySelector('meta[name="theme-color"]');if(theme)theme.content=brand.site_color;
    for(const icon of document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]')){
      if(!iconSources.has(icon))iconSources.set(icon,{href:icon.getAttribute('href'),sizes:icon.getAttribute('sizes'),type:icon.getAttribute('type')});
      const original=iconSources.get(icon);
      icon.setAttribute('href',brand.logo_url||original.href);
      for(const key of ['sizes','type'])if(brand.logo_url||original[key]===null)icon.removeAttribute(key);else icon.setAttribute(key,original[key]);
    }
  }
  function apply(next){
    brand=core.normalize(next);
    const root=document.documentElement;
    root.style.setProperty('--brand-site',brand.site_color);
    root.style.setProperty('--brand-admin',brand.admin_color);
    root.style.setProperty('--brand-accent',brand.accent_color);
    document.body.classList.toggle('brand-site-theme',brand.site_color!==core.DEFAULTS.site_color||brand.accent_color!==core.DEFAULTS.accent_color);
    document.body.classList.toggle('brand-admin-theme',brand.admin_color!==core.DEFAULTS.admin_color||brand.accent_color!==core.DEFAULTS.accent_color);
    walk(document.body);meta();
  }
  window.NoktenaBrand=Object.freeze({get name(){return brand.name},get logoUrl(){return brand.logo_url},get settings(){return {...brand}},replace,apply});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>apply(brand),{once:true});else apply(brand);
  const observer=new MutationObserver(records=>{
    for(const record of records){
      if(record.type==='childList')for(const node of record.addedNodes)walk(node);
      if(record.type==='characterData')brandedText(record.target);
      if(record.type==='attributes')brandedAttribute(record.target,record.attributeName);
    }
  });
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['alt','aria-label','title','placeholder']});
})();
