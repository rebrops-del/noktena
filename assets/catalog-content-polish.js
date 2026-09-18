(() => {
  'use strict';

  const tidy = (value='') => String(value)
    .replace(/\s*\(\s*BERHOUSE\s*\)\s*/gi,' ')
    .replace(/\s*\(\s*ЗР\s*\)\s*/gi,' ')
    .replace(/ортопедическими латами\s*\(\s*металл\s*\)/gi,'ортопедическими латами (металл)')
    .replace(/подъем/gi,'подъём')
    .replace(/\s+([,.;:])/g,'$1')
    .replace(/\s{2,}/g,' ')
    .trim();

  const quotedCase = (text) => text.replace(/"([^"]+)"/g,(_,inside)=>`"${inside.toLowerCase().replace(/(^|[\s-])([а-яёa-z])/giu,(m,p,c)=>p+c.toUpperCase())}"`);

  function tidyTitle(value=''){
    let text=tidy(value);
    if(text && text===text.toUpperCase() && /[А-ЯЁ]/.test(text)){
      text=text.toLowerCase();
      text=text.charAt(0).toUpperCase()+text.slice(1);
      text=quotedCase(text);
    }
    return text
      .replace(/\s+-\s+/g,' — ')
      .replace(/\s*\/\s*/g,' / ')
      .replace(/\s{2,}/g,' ')
      .trim();
  }

  function rows(card){
    return Array.from(card.querySelectorAll('.f-premium-specs > div')).map(row=>({
      key: tidy(row.querySelector('span')?.textContent||''),
      value: tidy(row.querySelector('b')?.textContent||'')
    })).filter(x=>x.key&&x.value);
  }

  const byKey=(items,pattern)=>items.find(x=>pattern.test(x.key))?.value||'';

  function conciseSummary(card){
    const isBed=(card.querySelector('.f-card-overlay-tags span')?.textContent||'').trim().toLowerCase()==='кровать';
    const items=rows(card);
    const sleep=byKey(items,/спальн.*мест/i);
    const base=byKey(items,/основан/i);
    const mechanism=byKey(items,/механизм трансформац/i);
    const box=byKey(items,/бельев.*ящик/i);
    const filling=byKey(items,/наполнен/i);

    const parts=[];
    if(isBed){
      parts.push(sleep?`Кровать со спальным местом ${sleep}.`:'Кровать для современной спальни.');
      if(base)parts.push(`Основание — ${base}.`);
      else if(box)parts.push(`Бельевой ящик — ${box}.`);
    }else{
      parts.push(sleep?`Диван со спальным местом ${sleep}.`:'Диван для отдыха и сна.');
      if(mechanism)parts.push(`Механизм — ${mechanism}.`);
      else if(filling)parts.push(`Наполнение — ${filling}.`);
    }
    return parts.join(' ');
  }

  function polishCard(card){
    if(card.dataset.copyPolished==='1')return;
    const title=card.querySelector('h3');
    if(title){
      const cleaned=tidyTitle(title.textContent);
      title.textContent=cleaned;
      title.title=cleaned;
    }

    const eyebrow=card.querySelector('.f-card-eyebrow');
    const category=(card.querySelector('.f-card-overlay-tags span')?.textContent||'').trim().toLowerCase();
    if(eyebrow)eyebrow.textContent=category==='кровать'?'КОЛЛЕКЦИЯ КРОВАТЕЙ':'КОЛЛЕКЦИЯ ДИВАНОВ';

    const summary=card.querySelector('.f-card-summary');
    if(summary){
      const generated=conciseSummary(card);
      const original=tidy(summary.textContent);
      summary.textContent=generated||original;
    }

    card.querySelectorAll('.f-premium-specs > div').forEach(row=>{
      const k=row.querySelector('span'); const v=row.querySelector('b');
      if(k)k.textContent=tidy(k.textContent);
      if(v)v.textContent=tidy(v.textContent);
    });

    const detailsSummary=card.querySelector('.f-card-details summary span:first-child');
    if(detailsSummary)detailsSummary.textContent='Характеристики модели';
    const detailsText=card.querySelector('.f-card-details-body p');
    if(detailsText){
      let text=tidy(detailsText.textContent)
        .replace(/\bволнующее очарование\b/gi,'')
        .replace(/\bнавеяно историями[^.!?]*[.!?]?/gi,'')
        .replace(/\s{2,}/g,' ')
        .trim();
      if(text.length>420)text=text.slice(0,417).replace(/\s+\S*$/,'')+'…';
      detailsText.textContent=text;
    }

    const optionLabel=card.querySelector('.f-option-head span');
    if(optionLabel)optionLabel.textContent=category==='кровать'?'Размер спального места':'Размер модели';
    const priceCaption=card.querySelector('.f-price-caption');
    if(priceCaption)priceCaption.textContent='Стоимость выбранного варианта';

    card.dataset.copyPolished='1';
  }

  function run(){document.querySelectorAll('.f-card').forEach(polishCard);}
  const observer=new MutationObserver(run);
  observer.observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();
