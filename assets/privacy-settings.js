(() => {
  'use strict';
  const settings=(window.NOKTENA_CATALOG_BOOTSTRAP?.rows||[]).find(row=>row.product_key==='settings:seo_v1')?.payload;
  const p=settings?.privacy||{};
  const publication=/^\d{4}-\d{2}-\d{2}$/.test(String(p.published_at||''))?String(p.published_at).split('-').reverse().join('.'):'—';
  const values={operator:p.operator,inn:p.inn,ogrn:p.ogrn,address:p.address,contact:p.contact||'noktena@mail.ru',retention:p.retention||'до достижения целей обработки',published_at:publication};
  const complete=!!p.operator&&/^(\d{10}|\d{12})$/.test(String(p.inn||''))&&/^(\d{13}|\d{15})$/.test(String(p.ogrn||''))&&!!p.address;
  document.querySelectorAll('[data-privacy-field]').forEach(node=>{node.textContent=String(values[node.dataset.privacyField]||'—')});
  const status=document.querySelector('#privacyStatus');
  if(status)status.textContent=complete?'':'Сведения об операторе пока не опубликованы полностью. Для уточнения обработки данных напишите на noktena@mail.ru.';
  const body=document.querySelector('#privacyBody');
  if(body)body.hidden=!complete;
  const draft=document.querySelector('#privacyDraft');
  if(draft)draft.hidden=complete;
})();
