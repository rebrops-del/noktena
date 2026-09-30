(()=>{
  'use strict';

  const DEFAULT_PROMO_TITLE='';
  const DEFAULT_PROMO_SUBTITLE='';

  const style=document.createElement('style');
  style.textContent=`
    .dimension-settings{margin-top:14px;padding:16px;border:1px solid #dce8e2;border-radius:14px;background:#f8fbf9}
    .dimension-settings h3{margin:0 0 5px}
    .dimension-settings .muted{margin-bottom:12px}
    .dimension-size-grid{display:grid;gap:8px}
    .dimension-size-row{display:grid;grid-template-columns:minmax(150px,1fr) repeat(2,minmax(150px,220px));gap:12px;align-items:center;padding:10px 12px;border:1px solid #dfe9e3;border-radius:11px;background:#fff}
    .dimension-size-row b{font-size:13px}
    .dimension-size-row label{font-size:12px;color:#52665b;font-weight:700}
    .dimension-size-row input{height:42px;margin-top:5px}
    .admin-field-note{display:block;margin-top:5px;font-size:11px;color:#718078;font-weight:500}
    @media(max-width:700px){.dimension-size-row{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  function hasDraft(){
    try{return typeof draft!=='undefined'&&!!draft}catch{return false}
  }

  function isFurniture(){
    return hasDraft()&&draft._kind==='furniture';
  }

  function uniqueSizes(){
    if(!isFurniture())return [];
    const values=[];
    for(const variant of (draft.variants||[])){
      const size=String(variant?.size||'').trim();
      if(size&&!values.includes(size))values.push(size);
    }
    return values;
  }

  function ensurePromoFields(){
    const grid=document.querySelector('#editorForm .grid2');
    if(!grid||document.getElementById('promoLabel'))return;

    const title=document.createElement('label');
    title.id='promoLabelWrap';
    title.innerHTML='Текст ценовой плашки<input id="promoLabel" maxlength="60" placeholder="Спеццена"><small class="admin-field-note">Например: Спеццена, Цена недели. Оставьте пустым вместе с подписью, чтобы скрыть плашку.</small>';

    const subtitle=document.createElement('label');
    subtitle.id='promoSubtextWrap';
    subtitle.innerHTML='Подпись под плашкой<input id="promoSubtext" maxlength="80" placeholder="Только до воскресенья"><small class="admin-field-note">Например: до конца недели, только до воскресенья.</small>';

    const discount=document.getElementById('productDiscountPercentLabel');
    if(discount?.nextSibling){
      grid.insertBefore(title,discount.nextSibling);
      grid.insertBefore(subtitle,title.nextSibling);
    }else{
      grid.appendChild(title);
      grid.appendChild(subtitle);
    }

    title.querySelector('input')?.addEventListener('input',e=>{if(isFurniture())draft.promoLabel=e.target.value;});
    subtitle.querySelector('input')?.addEventListener('input',e=>{if(isFurniture())draft.promoSubtext=e.target.value;});
  }

  function syncPromoFields(){
    ensurePromoFields();
    const title=document.getElementById('promoLabel');
    const subtitle=document.getElementById('promoSubtext');
    const titleWrap=document.getElementById('promoLabelWrap');
    const subtitleWrap=document.getElementById('promoSubtextWrap');
    if(!title||!subtitle||!hasDraft())return;
    const show=draft._kind==='furniture';
    titleWrap?.classList.toggle('hide',!show);
    subtitleWrap?.classList.toggle('hide',!show);
    if(!show)return;
    title.value=Object.prototype.hasOwnProperty.call(draft,'promoLabel')?String(draft.promoLabel??''):DEFAULT_PROMO_TITLE;
    subtitle.value=Object.prototype.hasOwnProperty.call(draft,'promoSubtext')?String(draft.promoSubtext??''):DEFAULT_PROMO_SUBTITLE;
  }

  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function ensureDimensionSection(){
    const variantsSection=document.getElementById('variants')?.closest('.section');
    if(!variantsSection||document.getElementById('dimensionBySizeSection'))return;
    const section=document.createElement('section');
    section.id='dimensionBySizeSection';
    section.className='section dimension-settings';
    section.innerHTML='<h3>Ширина и глубина по размерам</h3><div class="muted">Габариты кровати в миллиметрах. Укажите точные значения для каждого размера, если они отличаются от автоматического расчёта. Пустое поле = автоматический расчёт по спальному месту и исходным характеристикам.</div><div id="dimensionBySizeRows" class="dimension-size-grid"></div>';
    variantsSection.insertAdjacentElement('afterend',section);
  }

  function renderDimensionRows(){
    ensureDimensionSection();
    const section=document.getElementById('dimensionBySizeSection');
    const rows=document.getElementById('dimensionBySizeRows');
    if(!section||!rows||!hasDraft())return;
    const show=draft._kind==='furniture';
    section.classList.toggle('hide',!show);
    if(!show)return;
    const sizes=uniqueSizes();
    rows.innerHTML=sizes.length?sizes.map(size=>{
      const value=map=>Number(draft[map]?.[size])>0?Math.round(Number(draft[map][size])):'';
      return `<div class="dimension-size-row"><b>${escape(size)}</b><label>Ширина, мм<input type="number" min="1" step="1" inputmode="numeric" data-width-size="${escape(size)}" value="${value('widthBySize')}" placeholder="Авто"></label><label>Глубина, мм<input type="number" min="1" step="1" inputmode="numeric" data-depth-size="${escape(size)}" value="${value('depthBySize')}" placeholder="Авто"></label></div>`;
    }).join(''):'<div class="muted">Сначала добавьте размеры товара в блоке «Размеры / цвета / цены».</div>';
  }

  function persistDimensionInputs(){
    if(!isFurniture())return;
    for(const [selector,mapName,dataset] of [['[data-width-size]','widthBySize','widthSize'],['[data-depth-size]','depthBySize','depthSize']]){
      const map={...(draft[mapName]||{})};
      document.querySelectorAll(selector).forEach(input=>{
        const size=input.dataset[dataset]||'';
        const raw=String(input.value||'').trim();
        if(!size)return;
        const value=Number(raw);
        if(raw&&Number.isFinite(value)&&value>0)map[size]=Math.round(value);
        else delete map[size];
      });
      if(Object.keys(map).length)draft[mapName]=map;
      else delete draft[mapName];
    }
  }

  function syncAll(){
    if(!hasDraft())return;
    syncPromoFields();
    renderDimensionRows();
  }

  ensurePromoFields();
  ensureDimensionSection();

  const editor=document.getElementById('editor');
  if(editor)new MutationObserver(()=>{
    if(!editor.classList.contains('hide'))queueMicrotask(syncAll);
  }).observe(editor,{attributes:true,attributeFilter:['class']});

  document.getElementById('dimensionBySizeRows')?.addEventListener('input',e=>{
    if(e.target.matches('[data-depth-size],[data-width-size]'))persistDimensionInputs();
  });

  document.getElementById('editorForm')?.addEventListener('submit',()=>{
    if(!hasDraft())return;
    persistDimensionInputs();
    if(isFurniture()){
      const title=document.getElementById('promoLabel');
      const subtitle=document.getElementById('promoSubtext');
      if(title)draft.promoLabel=title.value.trim();
      if(subtitle)draft.promoSubtext=subtitle.value.trim();
    }
  },true);

  /* When variants are re-rendered, keep the unique-size dimension editor in sync. */
  const variants=document.getElementById('variants');
  if(variants)new MutationObserver(()=>{
    if(editor&&!editor.classList.contains('hide'))setTimeout(renderDimensionRows,0);
  }).observe(variants,{childList:true});
})();
