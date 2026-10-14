(() => {
  'use strict';
  const core=window.NoktenaBrandCore;
  const form=document.querySelector('#siteBrandForm');
  if(!core||!form)return;
  const $=id=>document.getElementById(id);
  const BOOT='https://admin-proxy-v2-production.up.railway.app/catalog-bootstrap.js';
  const submit=form.querySelector('[type="submit"]');
  let pending=false;
  function values(){return {name:$('brandName').value.trim(),logo_url:$('brandLogoUrl').value.trim(),site_color:$('brandSiteColor').value,admin_color:$('brandAdminColor').value,accent_color:$('brandAccentColor').value}}
  function fill(data){
    const next=core.normalize(data);
    $('brandName').value=next.name;$('brandLogoUrl').value=next.logo_url;
    for(const [id,key] of [['brandSiteColor','site_color'],['brandAdminColor','admin_color'],['brandAccentColor','accent_color']])$(id).value=next[key];
    preview();
  }
  function preview(){
    const value=values(),name=value.name||core.DEFAULTS.name;
    $('brandPreviewName').textContent=name;
    const img=$('brandLogoPreview'),url=core.logoUrl(value.logo_url)||'/assets/logo-noktena-final.png';
    if(img.getAttribute('src')!==url)img.src=url;
    img.alt='Логотип '+name;
    $('brandPreviewSite').style.backgroundColor=value.site_color;
    $('brandPreviewAdmin').style.backgroundColor=value.admin_color;
    $('brandPreviewAccent').style.backgroundColor=value.accent_color;
  }
  for(const input of form.querySelectorAll('input:not([type="file"])'))input.addEventListener('input',preview);
  $('brandLogoPreview').addEventListener('error',()=>{if(!$('brandLogoPreview').src.endsWith('/assets/logo-noktena-final.png'))$('brandLogoPreview').src='/assets/logo-noktena-final.png';$('brandStatus').textContent='Логотип по ссылке не открылся. Проверьте её перед сохранением.'});
  async function load(){
    const response=await fetch(BOOT+'?brand_settings='+Date.now(),{cache:'no-store'});
    if(!response.ok)throw new Error('Не удалось загрузить настройки бренда');
    const source=await response.text(),marker='window.NOKTENA_CATALOG_BOOTSTRAP=',at=source.indexOf(marker);
    if(at<0)throw new Error('Не удалось прочитать настройки бренда');
    const data=JSON.parse(source.slice(at+marker.length).trim().replace(/;+\s*$/,''));
    fill(core.fromRows(data.rows));$('brandStatus').textContent='Бренд общий для всех городов.';
  }
  const pane=document.querySelector('#adminSiteSettingsPane');
  const observer=new MutationObserver(()=>{
    if(!pane.classList.contains('hide')&&!pending){load().catch(error=>{$('brandStatus').textContent=error.message})}
  });
  if(pane)observer.observe(pane,{attributes:true,attributeFilter:['class']});
  if(pane&&!pane.classList.contains('hide'))load().catch(error=>{$('brandStatus').textContent=error.message});
  $('brandLogoReset').addEventListener('click',()=>{$('brandLogoUrl').value='';preview();$('brandStatus').textContent='Исходный логотип выбран. Сохраните бренд, чтобы применить его.'});
  $('brandColorsReset').addEventListener('click',()=>{
    for(const [id,key] of [['brandSiteColor','site_color'],['brandAdminColor','admin_color'],['brandAccentColor','accent_color']])$(id).value=core.DEFAULTS[key];
    preview();$('brandStatus').textContent='Исходные цвета выбраны. Сохраните бренд, чтобы применить их.';
  });
  $('brandLogoFile').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file||pending)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>12*1024*1024){toast('Выберите PNG, JPEG или WebP до 12 МБ',true);event.target.value='';return}
    pending=true;submit.disabled=true;$('brandStatus').textContent='Загружаем логотип…';
    try{
      const data=new FormData();data.append('file',file);data.append('product_key','store-brand-logo');
      const result=await request('upload',{method:'POST',body:data});
      if(!core.logoUrl(result.url))throw new Error('Сервер вернул неверную ссылку на логотип');
      $('brandLogoUrl').value=result.url;preview();$('brandStatus').textContent='Логотип загружен. Нажмите «Сохранить бренд и цвета».';
    }catch(error){toast(error.message,true);$('brandStatus').textContent='Не удалось загрузить логотип'}
    finally{pending=false;submit.disabled=false;event.target.value=''}
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(pending)return;
    let value;
    try{
      value=core.validate(values());
      const previous=window.NoktenaBrand?.settings||core.DEFAULTS;
      value.previous_names=[...new Set([...(previous.previous_names||[]),previous.name].filter(name=>name&&name!==value.name&&name!==core.DEFAULTS.name))].slice(-10);
    }catch(error){toast(error.message,true);return}
    pending=true;submit.disabled=true;$('brandStatus').textContent='Сохраняем…';
    try{
      await request('save',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key:core.KEY,kind:'mattress',item:{model:'__brand_v1__',...value},hidden:false,is_custom:false})});
      window.NoktenaBrand?.apply(value);
      for(const id of ['siteSeoTitle','siteSeoDescription']){
        const field=$(id);if(field?.value){field.value=window.NoktenaBrand?.replace(field.value)||field.value;field.dispatchEvent(new Event('input',{bubbles:true}))}
      }
      $('brandStatus').textContent='Сохранено. Название, логотип и цвета обновятся на сайте и в админке после обновления страницы.';
      toast('Бренд и цвета сохранены');
    }catch(error){toast(error.message,true);$('brandStatus').textContent='Не удалось сохранить бренд'}
    finally{pending=false;submit.disabled=false}
  });
})();
