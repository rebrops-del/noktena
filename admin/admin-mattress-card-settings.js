(()=>{
  'use strict';
  const DEFAULT_PROMO_TITLE='Цена сентября';
  const DEFAULT_PROMO_SUBTITLE='до 30 сентября';

  function hasDraft(){try{return typeof draft!=='undefined'&&!!draft}catch{return false}}
  function isMattress(){return hasDraft()&&draft._kind==='mattress'}

  function syncMattressFields(){
    if(!isMattress())return;

    const discountWrap=document.getElementById('productDiscountPercentLabel');
    const discount=document.getElementById('productDiscountPercent');
    if(discountWrap)discountWrap.classList.remove('hide');
    if(discount){
      const raw=Number(draft.discountPercent);
      discount.value=Number.isFinite(raw)?Math.min(99,Math.max(0,Math.round(raw))):30;
    }

    const promoWrap=document.getElementById('promoLabelWrap');
    const promoSubWrap=document.getElementById('promoSubtextWrap');
    const promo=document.getElementById('promoLabel');
    const promoSub=document.getElementById('promoSubtext');
    if(promoWrap)promoWrap.classList.remove('hide');
    if(promoSubWrap)promoSubWrap.classList.remove('hide');
    if(promo)promo.value=Object.prototype.hasOwnProperty.call(draft,'promoLabel')?String(draft.promoLabel??''):DEFAULT_PROMO_TITLE;
    if(promoSub)promoSub.value=Object.prototype.hasOwnProperty.call(draft,'promoSubtext')?String(draft.promoSubtext??''):DEFAULT_PROMO_SUBTITLE;
  }

  document.getElementById('productDiscountPercent')?.addEventListener('input',event=>{
    if(!isMattress())return;
    const value=Number(event.target.value);
    draft.discountPercent=Number.isFinite(value)?Math.min(99,Math.max(0,Math.round(value))):30;
  });
  document.getElementById('promoLabel')?.addEventListener('input',event=>{if(isMattress())draft.promoLabel=event.target.value;});
  document.getElementById('promoSubtext')?.addEventListener('input',event=>{if(isMattress())draft.promoSubtext=event.target.value;});

  document.getElementById('editorForm')?.addEventListener('submit',()=>{
    if(!isMattress())return;
    const discount=document.getElementById('productDiscountPercent');
    const promo=document.getElementById('promoLabel');
    const promoSub=document.getElementById('promoSubtext');
    if(discount){
      const value=Number(discount.value);
      draft.discountPercent=Number.isFinite(value)?Math.min(99,Math.max(0,Math.round(value))):30;
    }
    if(promo)draft.promoLabel=promo.value.trim();
    if(promoSub)draft.promoSubtext=promoSub.value.trim();
  },true);

  const editor=document.getElementById('editor');
  if(editor)new MutationObserver(()=>{
    if(!editor.classList.contains('hide'))requestAnimationFrame(()=>requestAnimationFrame(syncMattressFields));
  }).observe(editor,{attributes:true,attributeFilter:['class']});
})();
