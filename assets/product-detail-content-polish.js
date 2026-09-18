(() => {
  'use strict';

  const tidy=(value='')=>String(value)
    .replace(/\s*\(\s*BERHOUSE\s*\)\s*/gi,' ')
    .replace(/\s*\(\s*ЗР\s*\)\s*/gi,' ')
    .replace(/подъем/gi,'подъём')
    .replace(/ортопедическими латами\s*\(\s*металл\s*\)/gi,'ортопедическими латами (металл)')
    .replace(/\s+([,.;:])/g,'$1')
    .replace(/\s{2,}/g,' ')
    .trim();

  const quotedCase=text=>text.replace(/"([^"]+)"/g,(_,inside)=>`"${inside.toLowerCase().replace(/(^|[\s-])([а-яёa-z])/giu,(m,p,c)=>p+c.toUpperCase())}"`);

  function titleCase(value=''){
    let text=tidy(value);
    if(text&&text===text.toUpperCase()&&/[А-ЯЁ]/.test(text)){
      text=text.toLowerCase();
      text=text.charAt(0).toUpperCase()+text.slice(1);
      text=quotedCase(text);
    }
    return text.replace(/\s+-\s+/g,' — ').replace(/\s*\/\s*/g,' / ').trim();
  }

  function setText(el,value){
    if(!el)return;
    const next=String(value??'');
    if(el.textContent!==next)el.textContent=next;
  }

  function cleanMarketingText(value=''){
    return tidy(value)
      .replace(/\bволнующее очарование\b/gi,'')
      .replace(/\bнавеяно историями[^.!?]*[.!?]?/gi,'')
      .replace(/\s{2,}/g,' ')
      .trim();
  }

  function polish(){
    const root=document.querySelector('#productRoot');
    if(!root)return false;

    const product=root.querySelector('.pd-product');
    const error=root.querySelector('.pd-error');
    if(!product&&!error)return false;
    if(error)return true;

    const h1=root.querySelector('h1');
    if(h1)setText(h1,titleCase(h1.textContent));

    const kicker=root.querySelector('.pd-kicker');
    if(kicker&&/каталог мебели/i.test(kicker.textContent||''))setText(kicker,'КОЛЛЕКЦИЯ НОКТЕНА');

    const subtitle=root.querySelector('.pd-subtitle');
    if(subtitle)setText(subtitle,cleanMarketingText(subtitle.textContent));

    root.querySelectorAll('.pd-description').forEach(el=>setText(el,cleanMarketingText(el.textContent)));
    root.querySelectorAll('.pd-spec').forEach(row=>{
      const k=row.querySelector('span');
      const v=row.querySelector('b');
      if(k)setText(k,tidy(k.textContent));
      if(v)setText(v,tidy(v.textContent));
    });
    return true;
  }

  function init(){
    if(polish())return;
    const root=document.querySelector('#productRoot');
    if(!root)return;
    const observer=new MutationObserver(()=>{
      if(polish())observer.disconnect();
    });
    observer.observe(root,{subtree:true,childList:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
