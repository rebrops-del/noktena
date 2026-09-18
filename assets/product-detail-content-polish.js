(() => {
  'use strict';

  const tidy=(value='')=>String(value)
    .replace(/\u00a0/g,' ')
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

  function cleanDescriptionLine(value=''){
    return tidy(value)
      .replace(/\bволнующее очарование\b/gi,'')
      .replace(/\bнавеяно историями[^.!?]*[.!?]?/gi,'')
      .replace(/\s{2,}/g,' ')
      .trim();
  }

  function splitSentences(text=''){
    const found=String(text).match(/[^.!?]+(?:[.!?]+|$)/g);
    return (found||[text]).map(s=>s.trim()).filter(Boolean);
  }

  function formatDescription(value=''){
    let raw=String(value??'')
      .replace(/\r\n?/g,'\n')
      .replace(/\u00a0/g,' ')
      .replace(/[ \t]+\n/g,'\n')
      .replace(/\n[ \t]+/g,'\n');

    const labels='Механизм трансформации|Спальное место|Размеры|Габариты|Каркас|Наполнитель|Обивка|Материал обивки|Бельевой ящик|Основание|Упаковка';
    raw=raw.replace(new RegExp(`\\s+(?=(${labels})\\s*[:—-])`,'gi'),'\n');

    const explicit=raw.split(/\n+/).map(cleanDescriptionLine).filter(Boolean);
    const paragraphs=[];

    explicit.forEach(block=>{
      if(block.length<230){paragraphs.push(block);return;}
      const sentences=splitSentences(block);
      if(sentences.length<=1){paragraphs.push(block);return;}
      let group=[];
      let length=0;
      sentences.forEach(sentence=>{
        const nextLength=length+(group.length?1:0)+sentence.length;
        if(group.length&&nextLength>230){
          paragraphs.push(group.join(' '));
          group=[sentence];
          length=sentence.length;
        }else{
          group.push(sentence);
          length=nextLength;
        }
      });
      if(group.length)paragraphs.push(group.join(' '));
    });

    return paragraphs.join('\n\n').replace(/\n{3,}/g,'\n\n').trim();
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

    root.querySelectorAll('.pd-description').forEach(el=>setText(el,formatDescription(el.textContent)));
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
