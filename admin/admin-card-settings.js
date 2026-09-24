(()=>{
  'use strict';

  const DEFAULT_PROMO_TITLE='';
  const DEFAULT_PROMO_SUBTITLE='';

  const style=document.createElement('style');
  style.textContent=`
    .dimension-settings{margin-top:14px;padding:16px;border:1px solid #dce8e2;border-radius:14px;background:#f8fbf9}
    .dimension-settings h3{margin:0 0 5px}
    .dimension-settings .muted{margin-bottom:12px}
    .depth-size-grid{display:grid;gap:8px}
    .depth-size-row{display:grid;grid-template-columns:minmax(150px,1fr) minmax(180px,240px);gap:12px;align-items:center;padding:10px 12px;border:1px solid #dfe9e3;border-radius:11px;background:#fff}
    .depth-size-row b{font-size:13px}
    .depth-size-row input{height:42px}
    .admin-field-note{display:block;margin-top:5px;font-size:11px;color:#718078;font-weight:500}
    @media(max-width:700px){.depth-size-row{grid-template-columns:1fr}}
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

  function ensureDepthSection(){
    const variantsSection=document.getElementById('variants')?.closest('.section');
    if(!variantsSection||document.getElementById('depthBySizeSection'))return;
    const section=document.createElement('section');
    section.id='depthBySizeSection';
    section.className='section dimension-settings';
    section.innerHTML='<h3>Глубина по размерам</h3><div class="muted">Можно задать глубину вручную для каждого размера. Пустое поле = автоматический расчёт по характеристикам модели.</div><div id="depthBySizeRows" class="depth-size-grid"></div>';
    variantsSection.insertAdjacentElement('afterend',section);
  }

  function renderDepthRows(){
    ensureDepthSection();
    const section=document.getElementById('depthBySizeSection');
    const rows=document.getElementById('depthBySizeRows');
    if(!section||!rows||!hasDraft())return;
    const show=draft._kind==='furniture';
    section.classList.toggle('hide',!show);
    if(!show)return;
    draft.depthBySize=(draft.depthBySize&&typeof draft.depthBySize==='object')?draft.depthBySize:{};
    const sizes=uniqueSizes();
    rows.innerHTML=sizes.length?sizes.map(size=>{
      const raw=draft.depthBySize[size];
      const value=Number(raw)>0?Math.round(Number(raw)):'';
      return `<label class="depth-size-row"><b>${String(size).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</b><input type="number" min="0" step="1" inputmode="numeric" data-depth-size="${String(size).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}" value="${value}" placeholder="Авто, мм"></label>`;
    }).join(''):'<div class="muted">Сначала добавьте размеры товара в блоке «Размеры / цвета / цены».</div>';
  }

  function persistDepthInputs(){
    if(!isFurniture())return;
    draft.depthBySize=(draft.depthBySize&&typeof draft.depthBySize==='object')?draft.depthBySize:{};
    document.querySelectorAll('[data-depth-size]').forEach(input=>{
      const size=input.dataset.depthSize||'';
      const raw=String(input.value||'').trim();
      if(!size)return;
      if(!raw){delete draft.depthBySize[size];return;}
      const value=Math.max(0,Math.round(Number(raw)||0));
      if(value>0)draft.depthBySize[size]=value;else delete draft.depthBySize[size];
    });
    if(!Object.keys(draft.depthBySize).length)delete draft.depthBySize;
  }

  function syncAll(){
    if(!hasDraft())return;
    syncPromoFields();
    renderDepthRows();
  }

  ensurePromoFields();
  ensureDepthSection();

  const editor=document.getElementById('editor');
  if(editor)new MutationObserver(()=>{
    if(!editor.classList.contains('hide'))queueMicrotask(syncAll);
  }).observe(editor,{attributes:true,attributeFilter:['class']});

  document.getElementById('depthBySizeRows')?.addEventListener('input',e=>{
    if(e.target.matches('[data-depth-size]'))persistDepthInputs();
  });

  document.getElementById('editorForm')?.addEventListener('submit',()=>{
    if(!hasDraft())return;
    persistDepthInputs();
    if(isFurniture()){
      const title=document.getElementById('promoLabel');
      const subtitle=document.getElementById('promoSubtext');
      if(title)draft.promoLabel=title.value.trim();
      if(subtitle)draft.promoSubtext=subtitle.value.trim();
    }
  },true);

  /* When variants are re-rendered, keep the unique-size depth editor in sync. */
  const variants=document.getElementById('variants');
  if(variants)new MutationObserver(()=>{
    if(editor&&!editor.classList.contains('hide'))setTimeout(renderDepthRows,0);
  }).observe(variants,{childList:true});
})();
