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
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

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

  function cleanMattressItem(value=''){
    return String(value)
      .replace(/\s+/g,' ')
      .replace(/\s+([,.;:])/g,'$1')
      .replace(/\s+-\s+/g,' — ')
      .trim()
      .replace(/[.!?]+$/,'');
  }

  function splitTopLevel(value=''){
    const out=[];
    let buffer='';
    let depth=0;
    for(const ch of String(value)){
      if(ch==='(')depth++;
      if(ch===')'&&depth>0)depth--;
      if(ch===','&&depth===0){
        if(buffer.trim())out.push(buffer.trim());
        buffer='';
        continue;
      }
      buffer+=ch;
    }
    if(buffer.trim())out.push(buffer.trim());
    return out;
  }

  function ensureMattressStyles(){
    if(document.getElementById('noktena-product-mattress-styles'))return;
    const style=document.createElement('style');
    style.id='noktena-product-mattress-styles';
    style.textContent=`
      .pd-mattress-details{display:grid;gap:24px}
      .pd-mattress-block{display:grid;gap:12px}
      .pd-mattress-block h3{margin:0;color:#294a3f;font-family:Onest,"Segoe UI",sans-serif;font-size:12px;line-height:1.2;font-weight:700;letter-spacing:.07em;text-transform:uppercase}
      .pd-mattress-list{list-style:none;margin:0;padding:0;display:grid;border-top:1px solid #eee9df}
      .pd-mattress-list li{position:relative;padding:11px 8px 11px 20px;border-bottom:1px solid #eee9df;color:#586b63;font-size:12.5px;line-height:1.5}
      .pd-mattress-list li:before{content:"";position:absolute;left:2px;top:17px;width:6px;height:6px;border-radius:50%;background:#b8975e}
      .pd-mattress-facts{display:grid;grid-template-columns:1fr 1fr;gap:0 24px;border-top:1px solid #eee9df}
      .pd-mattress-facts>div{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;padding:12px 0;border-bottom:1px solid #eee9df;font-size:11.5px}
      .pd-mattress-facts span{color:#819089}
      .pd-mattress-facts b{text-align:right;color:#314d42;font-weight:700}
      @media(max-width:620px){.pd-mattress-facts{grid-template-columns:1fr}.pd-mattress-facts>div{grid-template-columns:1fr;gap:4px}.pd-mattress-facts b{text-align:left}.pd-mattress-list li{font-size:12px}}
    `;
    document.head.appendChild(style);
  }

  function formatMattressDetails(root){
    const heading=Array.from(root.querySelectorAll('.pd-section-title h2')).find(el=>/состав и характеристики/i.test(el.textContent||''));
    if(!heading)return;
    const section=heading.closest('.pd-section-card');
    if(!section||section.dataset.mattressStructured)return;
    const description=section.querySelector('.pd-description');
    if(!description)return;

    const composition=[];
    const facts=[];
    const addFact=(label,value)=>{
      const clean=cleanMattressItem(value);
      if(!clean)return;
      if(label==='Категория'&&/^хит(ы)? продаж$/i.test(clean))return;
      if(!facts.some(([a,b])=>a===label&&b===clean))facts.push([label,clean]);
    };

    section.querySelectorAll('.pd-spec').forEach(row=>{
      const label=cleanMattressItem(row.querySelector('span')?.textContent||'');
      const value=cleanMattressItem(row.querySelector('b')?.textContent||'');
      if(label&&value)addFact(label,value);
    });

    const raw=String(description.textContent||'').replace(/\s+/g,' ').trim();
    const sentences=raw.split(/(?<=[.!?])\s+/).map(cleanMattressItem).filter(Boolean);
    for(const sentence of sentences){
      const low=sentence.toLowerCase();
      if(/ж[её]стк|мягк/.test(low)&&/матрас/.test(low))continue;

      let match=sentence.match(/^Высота\s*:?[\s—-]*(.+)$/i);
      if(match){addFact('Высота',match[1]);continue;}

      match=sentence.match(/^(Максимальная нагрузка|Допустимая нагрузка|Нагрузка на спальное место|Нагрузка)\s*:?[\s—-]*(.+)$/i);
      if(match){addFact(match[1],match[2]);continue;}

      for(const part of splitTopLevel(sentence)){
        const item=cleanMattressItem(part);
        if(item&&!composition.includes(item))composition.push(item);
      }
    }

    if(!composition.length&&!facts.length)return;
    ensureMattressStyles();

    const compositionHtml=composition.length
      ? `<div class="pd-mattress-block"><h3>Состав</h3><ul class="pd-mattress-list">${composition.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`
      : '';
    const factsHtml=facts.length
      ? `<div class="pd-mattress-block"><h3>Характеристики</h3><div class="pd-mattress-facts">${facts.map(([label,value])=>`<div><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`).join('')}</div></div>`
      : '';

    const block=document.createElement('div');
    block.className='pd-mattress-details';
    block.innerHTML=compositionHtml+factsHtml;
    section.querySelector('.pd-specs')?.remove();
    description.remove();
    heading.closest('.pd-section-title')?.insertAdjacentElement('afterend',block);
    section.dataset.mattressStructured='1';
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
    formatMattressDetails(root);
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