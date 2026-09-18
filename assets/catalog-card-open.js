(() => {
  'use strict';

  const interactive='button,select,input,textarea,label,summary,details,[data-gallery-dir],[data-card-color],[data-card-size]';

  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function cleanMattressText(value=''){
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

  function parseMattressDetails(card,raw){
    const composition=[];
    const facts=[];
    const addFact=(label,value)=>{
      const clean=cleanMattressText(value);
      if(clean&&!facts.some(([a,b])=>a===label&&b===clean))facts.push([label,clean]);
    };

    const firmness=cleanMattressText(card.querySelector('.firmness span')?.textContent||'');
    if(firmness)addFact('Жёсткость',firmness);

    const category=cleanMattressText(card.querySelector('.tag')?.textContent||'');
    if(category)addFact('Категория',category);

    const sentences=String(raw||'').replace(/\s+/g,' ').trim().split(/(?<=[.!?])\s+/).map(cleanMattressText).filter(Boolean);
    for(const sentence of sentences){
      const firmnessPrefix=sentence.match(/^Ж[её]сткость\s*:?[\s—-]*(максимально\s+ж[её]сткая|выше\s+средней|ниже\s+средней|средняя|мягкая|ж[её]сткая)\s*(.*)$/i);
      if(firmnessPrefix){
        if(!firmness)addFact('Жёсткость',firmnessPrefix[1]);
        const remainder=cleanMattressText(firmnessPrefix[2]||'');
        if(remainder){
          for(const part of splitTopLevel(remainder)){
            const item=cleanMattressText(part);
            if(item)composition.push(item);
          }
        }
        continue;
      }

      const low=sentence.toLowerCase();
      if(/ж[её]стк|мягк/.test(low)&&/матрас/.test(low))continue;

      let match=sentence.match(/^Высота\s*:?[\s—-]*(.+)$/i);
      if(match){addFact('Высота',match[1]);continue;}

      match=sentence.match(/^(Максимальная нагрузка|Допустимая нагрузка|Нагрузка на спальное место|Нагрузка)\s*:?[\s—-]*(.+)$/i);
      if(match){addFact(match[1],match[2]);continue;}

      for(const part of splitTopLevel(sentence)){
        const item=cleanMattressText(part);
        if(item)composition.push(item);
      }
    }
    return {composition,facts};
  }

  function ensureMattressStyles(){
    if(document.getElementById('noktena-mattress-spec-styles'))return;
    const style=document.createElement('style');
    style.id='noktena-mattress-spec-styles';
    style.textContent=`
      .card .speccontent.mattress-speccontent{white-space:normal!important;padding:14px!important}
      .mattress-structured{display:grid;gap:16px}
      .mattress-spec-group{display:grid;gap:9px}
      .mattress-spec-group>strong{display:block;color:#264a3d;font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase}
      .mattress-spec-list{list-style:none;margin:0;padding:0;display:grid;gap:7px}
      .mattress-spec-list li{position:relative;padding-left:15px;color:#5f7169;font-size:10.5px;line-height:1.5}
      .mattress-spec-list li:before{content:"";position:absolute;left:0;top:.62em;width:5px;height:5px;border-radius:50%;background:#b49661}
      .mattress-spec-facts{border-top:1px solid #ece7dd}
      .mattress-spec-facts>div{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:12px;padding:8px 0;border-bottom:1px solid #f0ece4;align-items:start}
      .mattress-spec-facts span{color:#87938d;font-size:10px;line-height:1.35}
      .mattress-spec-facts b{color:#2d4b40;font-size:10px;line-height:1.35;font-weight:600;text-align:right}
      @media(max-width:620px){.mattress-spec-facts>div{grid-template-columns:1fr;gap:3px}.mattress-spec-facts b{text-align:left}}
    `;
    document.head.appendChild(style);
  }

  function formatMattressSpec(card){
    if(!card?.classList?.contains('card')||card.dataset.mattressSpecFormatted)return;
    const content=card.querySelector('.speccontent');
    if(!content)return;
    const raw=content.textContent||'';
    const {composition,facts}=parseMattressDetails(card,raw);
    if(!composition.length&&!facts.length)return;

    ensureMattressStyles();
    const compositionHtml=composition.length
      ? `<div class="mattress-spec-group"><strong>Состав</strong><ul class="mattress-spec-list">${composition.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></div>`
      : '';
    const factsHtml=facts.length
      ? `<div class="mattress-spec-group"><strong>Характеристики</strong><div class="mattress-spec-facts">${facts.map(([label,value])=>`<div><span>${esc(label)}</span><b>${esc(value)}</b></div>`).join('')}</div></div>`
      : '';

    content.classList.add('mattress-speccontent');
    content.innerHTML=`<div class="mattress-structured">${compositionHtml}${factsHtml}</div>`;
    card.dataset.mattressSpecFormatted='1';
  }

  function resolveProductUrl(raw){
    if(!raw)return '';
    try{return new URL(raw, document.baseURI).href;}catch(_){return raw;}
  }

  function openProduct(raw){
    const url=resolveProductUrl(raw);
    if(!url)return;
    window.location.assign(url);
  }

  function enhance(root=document){
    const cards=[];
    if(root.matches?.('[data-product-link]'))cards.push(root);
    root.querySelectorAll?.('[data-product-link]').forEach(card=>cards.push(card));
    cards.forEach(card=>{
      formatMattressSpec(card);
      if(card.dataset.cardEnhanced)return;
      card.dataset.cardEnhanced='1';
      card.setAttribute('tabindex','0');
      card.setAttribute('role','link');
      const title=card.querySelector('h3')?.textContent?.trim();
      if(title)card.setAttribute('aria-label',`Открыть товар: ${title}`);
    });
  }

  document.addEventListener('click',e=>{
    const detailLink=e.target.closest('a.product-more-link, a.f-card-details-link');
    if(detailLink){
      const href=detailLink.getAttribute('href');
      if(href){
        e.preventDefault();
        e.stopPropagation();
        openProduct(href);
      }
      return;
    }

    const card=e.target.closest('[data-product-link]');
    if(!card)return;
    if(e.target.closest('a'))return;
    if(e.target.closest(interactive))return;
    e.preventDefault();
    openProduct(card.dataset.productLink);
  });

  document.addEventListener('keydown',e=>{
    if(e.key!=='Enter'&&e.key!==' ')return;
    const card=e.target.closest('[data-product-link]');
    if(!card||e.target.closest('a')||e.target.closest(interactive))return;
    e.preventDefault();
    openProduct(card.dataset.productLink);
  });

  const observer=new MutationObserver(mutations=>mutations.forEach(m=>m.addedNodes.forEach(n=>{
    if(n.nodeType===1)enhance(n);
  })));
  observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>enhance());else enhance();
})();