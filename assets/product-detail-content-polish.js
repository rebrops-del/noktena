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
  function polish(){
    const root=document.querySelector('#productRoot');
    if(!root)return;
    const h1=root.querySelector('h1');
    if(h1)h1.textContent=titleCase(h1.textContent);
    const kicker=root.querySelector('.pd-kicker');
    if(kicker&&/каталог мебели/i.test(kicker.textContent||''))kicker.textContent='КОЛЛЕКЦИЯ НОКТЕНА';
    const subtitle=root.querySelector('.pd-subtitle');
    if(subtitle){
      let text=tidy(subtitle.textContent)
        .replace(/\bволнующее очарование\b/gi,'')
        .replace(/\bнавеяно историями[^.!?]*[.!?]?/gi,'')
        .replace(/\s{2,}/g,' ')
        .trim();
      subtitle.textContent=text;
    }
    root.querySelectorAll('.pd-description').forEach(el=>{
      let text=tidy(el.textContent)
        .replace(/\bволнующее очарование\b/gi,'')
        .replace(/\bнавеяно историями[^.!?]*[.!?]?/gi,'')
        .replace(/\s{2,}/g,' ')
        .trim();
      el.textContent=text;
    });
    root.querySelectorAll('.pd-spec').forEach(row=>{
      const k=row.querySelector('span'); const v=row.querySelector('b');
      if(k)k.textContent=tidy(k.textContent);
      if(v)v.textContent=tidy(v.textContent);
    });
  }
  const observer=new MutationObserver(polish);
  observer.observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',polish);else polish();
})();
