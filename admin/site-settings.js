(() => {
  'use strict';
  const BOOT='https://admin-proxy-v2-production.up.railway.app/catalog-bootstrap.js';
  const SEO_KEY='settings:seo_v1';
  const DEFAULT_TITLE='Матрасы, кровати и диваны в Екатеринбурге — НОКТЕНА';
  const DEFAULT_DESCRIPTION='НОКТЕНА — матрасы, кровати и диваны с подбором размера и консультацией. Онлайн-магазин в Екатеринбурге, склад в Берёзовском, доставка по Екатеринбургу.';
  const $=selector=>document.querySelector(selector);
  const template=$('#siteSettingsTemplate');
  const main=$('.main');
  const link=$('[data-admin-open="site-settings"]');
  if(!template||!main||!link)return;

  const pane=document.createElement('section');
  pane.id='adminSiteSettingsPane';
  pane.className='admin-pane site-settings-pane hide';
  pane.append(template.content.cloneNode(true));
  main.append(pane);
  const form=$('#siteSeoForm');
  const submit=form.querySelector('[type="submit"]');

  function preview(){
    $('#siteSeoPreviewTitle').textContent=$('#siteSeoTitle').value.trim()||DEFAULT_TITLE;
    $('#siteSeoPreviewDescription').textContent=$('#siteSeoDescription').value.trim()||DEFAULT_DESCRIPTION;
  }
  for(const id of ['siteSeoTitle','siteSeoDescription'])$('#'+id).addEventListener('input',preview);

  async function readSeo(){
    const response=await fetch(BOOT+'?seo='+Date.now(),{cache:'no-store'});
    if(!response.ok)throw new Error('Не удалось загрузить SEO-настройки');
    const source=await response.text(),marker='window.NOKTENA_CATALOG_BOOTSTRAP=';
    const position=source.indexOf(marker);
    if(position<0)throw new Error('Не удалось прочитать SEO-настройки');
    const data=JSON.parse(source.slice(position+marker.length).trim().replace(/;+\s*$/,''));
    return (data.rows||[]).find(row=>row.product_key===SEO_KEY)?.payload||{};
  }
  async function open(){
    if(!pane.classList.contains('hide')&&!submit.disabled)return;
    $('#adminCatalogPane')?.classList.add('hide');
    $('#adminOrdersPane')?.classList.add('hide');
    $('#adminTabs')?.classList.add('hide');
    pane.classList.remove('hide');
    submit.disabled=true;
    try{
      const seo=await readSeo();
      $('#siteSeoTitle').value=seo.home_title||DEFAULT_TITLE;
      $('#siteSeoDescription').value=seo.home_description||DEFAULT_DESCRIPTION;
      preview();
      submit.disabled=false;
    }catch(error){toast(error.message,true)}
  }
  function close(){
    pane.classList.add('hide');
    $('#adminTabs')?.classList.remove('hide');
  }
  link.addEventListener('click',open);
  $('#catalogTab')?.addEventListener('click',close);
  $('#ordersTab')?.addEventListener('click',close);
  pane.addEventListener('click',event=>{
    const action=event.target.closest('[data-settings-open]')?.dataset.settingsOpen;
    if(action==='prices')$('#settingsOpen')?.click();
    if(action==='delivery')$('#deliverySettingsOpen')?.click();
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const home_title=$('#siteSeoTitle').value.trim();
    const home_description=$('#siteSeoDescription').value.trim();
    if(!home_title||!home_description){toast('Укажите заголовок и описание главной страницы',true);return}
    submit.disabled=true;
    try{
      await request('save',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
        key:SEO_KEY,kind:'mattress',item:{model:'__seo_v1__',home_title,home_description},hidden:false,is_custom:false
      })});
      toast('SEO главной страницы сохранено');
    }catch(error){toast(error.message,true)}finally{submit.disabled=false}
  });
})();
