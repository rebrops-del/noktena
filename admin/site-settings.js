(() => {
  'use strict';
  const BOOT='https://admin-proxy-v2-production.up.railway.app/catalog-bootstrap.js';
  const KEY='settings:seo_v1';
  const HERO_KEY='settings:hero_v1';
  const BANNER_KEY='settings:home_banners_v1';
  const DEFAULT_TITLE='Матрасы, кровати и диваны в Екатеринбурге — НОКТЕНА';
  const DEFAULT_DESCRIPTION='НОКТЕНА — матрасы, кровати и диваны с подбором размера и консультацией. Онлайн-магазин в Екатеринбурге, склад в Берёзовском, доставка по Екатеринбургу.';
  const DEFAULT_IMAGE='https://noktena.ru/assets/noktena-editorial-bedroom.webp';
  const DEFAULT_HERO_ALT='Светлая спальня с мягкой кроватью и матрасом';
  const $=selector=>document.querySelector(selector);
  const template=$('#siteSettingsTemplate');
  const main=$('.main');
  const link=$('[data-admin-open="site-settings"]');
  const bannerLink=$('[data-admin-open="banners"]');
  if(!template||!main||!link)return;

  const pane=document.createElement('section');
  pane.id='adminSiteSettingsPane';
  pane.className='admin-pane site-settings-pane hide';
  pane.append(template.content.cloneNode(true));
  main.append(pane);
  const banners=window.NoktenaBannerEditor?.init(pane);
  const form=$('#siteSeoForm');
  const submit=form.querySelector('[type="submit"]');
  const heroForm=$('#siteHeroForm');
  const heroSubmit=heroForm.querySelector('[type="submit"]');
  const heroReset=$('#siteHeroReset');
  let saved={},heroSaved={},bootstrap=null,busy=false,heroBusy=false;
  heroSubmit.disabled=true;
  heroReset.disabled=true;
  const fields={operator:'sitePrivacyOperator',inn:'sitePrivacyInn',ogrn:'sitePrivacyOgrn',address:'sitePrivacyAddress',contact:'sitePrivacyContact',retention:'sitePrivacyRetention',published_at:'sitePrivacyDate'};

  function snapshot(data){
    const privacy=data?.privacy||{};
    return {home_title:String(data?.home_title||DEFAULT_TITLE),home_description:String(data?.home_description||DEFAULT_DESCRIPTION),og_image:String(data?.og_image||''),privacy:Object.fromEntries(Object.keys(fields).map(key=>[key,String(privacy[key]||'')]))};
  }
  function readForm(){
    return {home_title:$('#siteSeoTitle').value.trim(),home_description:$('#siteSeoDescription').value.trim(),og_image:$('#siteOgUrl').value.trim(),privacy:Object.fromEntries(Object.entries(fields).map(([key,id])=>[key,$('#'+id).value.trim()]))};
  }
  function fill(data){
    const value=snapshot(data);
    $('#siteSeoTitle').value=value.home_title;
    $('#siteSeoDescription').value=value.home_description;
    $('#siteOgUrl').value=value.og_image;
    for(const [key,id] of Object.entries(fields))$('#'+id).value=value.privacy[key];
    preview();
  }
  function validImageUrl(raw){
    try{const url=new URL(raw);return url.protocol==='https:'&&!url.username&&!url.password?url.href:''}catch{return ''}
  }
  function previewHero(){
    const url=$('#siteHeroUrl').value.trim();
    const image=validImageUrl(url)||DEFAULT_IMAGE;
    if($('#siteHeroPreview').src!==image)$('#siteHeroPreview').src=image;
    $('#siteHeroPreview').alt=$('#siteHeroAlt').value.trim()||DEFAULT_HERO_ALT;
  }
  function fillHero(data){
    $('#siteHeroUrl').value=String(data?.url||'');
    $('#siteHeroAlt').value=String(data?.alt||'');
    $('#siteHeroStatus').textContent='';
    previewHero();
  }
  for(const id of ['siteHeroUrl','siteHeroAlt'])$('#'+id).addEventListener('input',previewHero);
  $('#siteHeroPreview').addEventListener('error',()=>{
    if($('#siteHeroPreview').src!==DEFAULT_IMAGE)$('#siteHeroPreview').src=DEFAULT_IMAGE;
    $('#siteHeroStatus').textContent='Фото по ссылке не открылось. Проверьте адрес перед сохранением.';
  });
  function privacyReady(value){
    const p=value.privacy;
    return !!p.operator&&[10,12].includes(p.inn.replace(/\D/g,'').length)&&[13,15].includes(p.ogrn.replace(/\D/g,'').length)&&!!p.address;
  }
  function preview(){
    const value=readForm();
    $('#siteSeoPreviewTitle').textContent=value.home_title||DEFAULT_TITLE;
    $('#siteSeoPreviewDescription').textContent=value.home_description||DEFAULT_DESCRIPTION;
    $('#siteSeoTitleCount').textContent=value.home_title.length+' символов · ориентир до 70';
    $('#siteSeoDescriptionCount').textContent=value.home_description.length+' символов · ориентир 140–160';
    $('#sitePrivacyReadiness').textContent=privacyReady(value)
      ?'Реквизиты оператора заполнены. Проверьте текст политики и условия обработки с юристом.'
      :'Реквизиты для политики пока не заполнены полностью: нужны оператор, ИНН, ОГРН / ОГРНИП и адрес. Сайт уже доступен поисковикам.';
    let image=DEFAULT_IMAGE;
    try{const url=new URL(value.og_image);if(url.protocol==='https:')image=url.href}catch{}
    if($('#siteOgPreview').src!==image)$('#siteOgPreview').src=image;
  }
  for(const id of ['siteSeoTitle','siteSeoDescription','siteOgUrl',...Object.values(fields)])$('#'+id).addEventListener('input',preview);
  $('#siteOgPreview').addEventListener('error',()=>{$('#siteOgUploadStatus').textContent='Изображение по этой ссылке не открылось. Проверьте адрес.'});

  async function readBootstrap(){
    const response=await fetch(BOOT+'?site_settings='+Date.now(),{cache:'no-store'});
    if(!response.ok)throw new Error('Не удалось загрузить настройки');
    const source=await response.text(),marker='window.NOKTENA_CATALOG_BOOTSTRAP=';
    const position=source.indexOf(marker);
    if(position<0)throw new Error('Не удалось прочитать настройки');
    const data=JSON.parse(source.slice(position+marker.length).trim().replace(/;+\s*$/,''));
    return data;
  }
  function renderHistory(){
    const target=$('#siteSettingsHistory');
    target.replaceChildren();
    const history=Array.isArray(saved.history)?[...saved.history].reverse():[];
    if(!history.length){target.textContent='История появится после первого сохранения.';return}
    const current=history[0]?.number;
    for(const item of history){
      const row=document.createElement('div');row.className='site-history-row';
      const label=document.createElement('div'),title=document.createElement('strong'),detail=document.createElement('small');
      title.textContent=(item.number===0?'Исходная версия':'Версия №'+item.number)+(item.number===current?' · сейчас на сайте':'');
      detail.textContent=(item.at?new Date(item.at).toLocaleString('ru-RU')+' · ':'')+(item.action||'Сохранение');
      label.append(title,detail);row.append(label);
      if(item.number!==current){const button=document.createElement('button');button.type='button';button.className='btn secondary';button.textContent='Восстановить';button.dataset.restore=String(item.number);row.append(button)}
      target.append(row);
    }
  }
  async function open(){
    if(!pane.classList.contains('hide')&&!submit.disabled)return;
    $('#adminCatalogPane')?.classList.add('hide');
    $('#adminOrdersPane')?.classList.add('hide');
    $('#adminTabs')?.classList.add('hide');
    pane.classList.remove('hide');
    submit.disabled=true;
    heroSubmit.disabled=true;
    heroReset.disabled=true;
    try{
      bootstrap=await readBootstrap();
      saved=(bootstrap.rows||[]).find(row=>row.product_key===KEY)?.payload||{};
      heroSaved=(bootstrap.rows||[]).find(row=>row.product_key===HERO_KEY)?.payload||{};
      banners?.fill((bootstrap.rows||[]).find(row=>row.product_key===BANNER_KEY)?.payload,(bootstrap.rows||[]).find(row=>row.product_key==='settings:contacts_v1')?.payload);
      fill(saved);fillHero(heroSaved);renderHistory();submit.disabled=false;heroSubmit.disabled=false;heroReset.disabled=false;
    }catch(error){toast(error.message,true)}
  }
  function close(){pane.classList.add('hide');$('#adminTabs')?.classList.remove('hide')}
  link.addEventListener('click',open);
  bannerLink?.addEventListener('click',async()=>{await open();$('#siteBannersHeading')?.scrollIntoView({block:'start',behavior:'smooth'})});
  $('#catalogTab')?.addEventListener('click',close);
  $('#ordersTab')?.addEventListener('click',close);
  pane.addEventListener('click',event=>{
    const action=event.target.closest('[data-settings-open]')?.dataset.settingsOpen;
    if(action==='prices')$('#settingsOpen')?.click();
    if(action==='delivery')$('#deliverySettingsOpen')?.click();
    if(action==='banners')$('#siteBannersHeading')?.scrollIntoView({block:'start',behavior:'smooth'});
    const restore=event.target.closest('[data-restore]')?.dataset.restore;
    if(restore!==undefined){
      const version=(saved.history||[]).find(item=>String(item.number)===restore);
      if(version){fill(version.snapshot);return persist('Восстановление версии №'+restore)}
    }
  });
  function validate(value){
    if(!value.home_title||!value.home_description)throw new Error('Укажите заголовок и описание главной страницы');
    if(value.og_image){let url;try{url=new URL(value.og_image)}catch{}if(!url||url.protocol!=='https:'||url.username||url.password)throw new Error('Для картинки нужна публичная ссылка HTTPS')}
    if(value.privacy.inn&&!/^(\d{10}|\d{12})$/.test(value.privacy.inn))throw new Error('ИНН должен содержать 10 или 12 цифр');
    if(value.privacy.ogrn&&!/^(\d{13}|\d{15})$/.test(value.privacy.ogrn))throw new Error('ОГРН / ОГРНИП должен содержать 13 или 15 цифр');
  }
  async function persist(action='Сохранение'){
    if(busy)return;
    const value=readForm();
    try{validate(value)}catch(error){toast(error.message,true);return}
    busy=true;submit.disabled=true;
    try{
      const old=Array.isArray(saved.history)?saved.history:[];
      const history=old.length?[...old]:[{number:0,at:new Date().toISOString(),action:'Исходная версия',snapshot:snapshot(saved)}];
      const number=Math.max(...history.map(entry=>Number(entry.number)||0))+1;
      history.push({number,at:new Date().toISOString(),action,snapshot:value});
      const next={model:'__seo_v1__',...value,history:[history[0],...history.slice(1).slice(-100)]};
      await request('save',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key:KEY,kind:'mattress',item:next,hidden:false,is_custom:false})});
      saved=next;renderHistory();toast(action==='Сохранение'?'Настройки и SEO сохранены':'Настройки восстановлены и сохранены новой версией');
    }catch(error){toast(error.message,true)}finally{busy=false;submit.disabled=false}
  }
  form.addEventListener('submit',event=>{event.preventDefault();return persist()});
  heroForm.addEventListener('submit',async event=>{
    event.preventDefault();
    if(heroBusy)return;
    const url=$('#siteHeroUrl').value.trim(),alt=$('#siteHeroAlt').value.trim();
    if(url&&!validImageUrl(url)){toast('Укажите публичную ссылку HTTPS на фотографию',true);return}
    const next={model:'__homepage_hero_v1__',url,alt};
    heroBusy=true;heroSubmit.disabled=true;heroReset.disabled=true;
    $('#siteHeroStatus').textContent='Сохраняем…';
    try{
      await request('save',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key:HERO_KEY,kind:'mattress',item:next,hidden:false,is_custom:false})});
      heroSaved=next;
      $('#siteHeroStatus').textContent=url?'Изображение сохранено. На главной оно появится после обновления страницы.':'Исходная фотография восстановлена. Обновите главную страницу.';
      toast('Изображение на главной сохранено');
    }catch(error){$('#siteHeroStatus').textContent='Не удалось сохранить изображение';toast(error.message,true)}
    finally{heroBusy=false;heroSubmit.disabled=false;heroReset.disabled=false}
  });
  heroReset.addEventListener('click',()=>{
    if(heroBusy)return;
    $('#siteHeroUrl').value='';$('#siteHeroAlt').value='';
    $('#siteHeroStatus').textContent='Исходное фото выбрано. Нажмите «Сохранить изображение», чтобы применить его на сайте.';
    previewHero();
  });
  $('#siteHeroFile').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file||heroBusy)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>12*1024*1024){toast('Выберите JPEG, PNG или WebP до 12 МБ',true);event.target.value='';return}
    heroBusy=true;heroSubmit.disabled=true;heroReset.disabled=true;
    const status=$('#siteHeroStatus');status.textContent='Загружаем фотографию…';
    try{
      const data=new FormData();data.append('file',file);data.append('product_key','homepage-hero-image');
      const uploaded=await request('upload',{method:'POST',body:data});
      if(!validImageUrl(uploaded.url))throw new Error('Сервер вернул неверную ссылку на фотографию');
      $('#siteHeroUrl').value=uploaded.url;previewHero();
      status.textContent='Фотография загружена. Нажмите «Сохранить изображение», чтобы показать её на сайте.';
    }catch(error){status.textContent='Не удалось загрузить фотографию';toast(error.message,true)}
    finally{event.target.value='';heroBusy=false;heroSubmit.disabled=false;heroReset.disabled=false}
  });
  $('#siteOgFile').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>12*1024*1024){toast('Выберите PNG, JPEG или WebP до 12 МБ',true);event.target.value='';return}
    const status=$('#siteOgUploadStatus');status.textContent='Загрузка…';submit.disabled=true;
    try{
      const data=new FormData();data.append('file',file);data.append('product_key','site-og-image');
      const uploaded=await request('upload',{method:'POST',body:data});
      $('#siteOgUrl').value=uploaded.url;status.textContent='Изображение загружено. Сохраните настройки, чтобы применить его.';preview();
    }catch(error){status.textContent='Не удалось загрузить изображение';toast(error.message,true)}finally{event.target.value='';submit.disabled=busy}
  });
  $('#siteSettingsBackup').addEventListener('click',async event=>{
    const button=event.currentTarget;button.disabled=true;
    try{
      const files=['furniture.json',...Array.from({length:6},(_,i)=>'data'+(i+1)+'.json')];
      const [data,catalog,categories,delivery,source]=await Promise.all([
        readBootstrap(),request('catalog'),request('settings'),request('delivery-settings'),
        Promise.all(files.map(async file=>{const response=await fetch('/data/'+file);if(!response.ok)throw new Error('Не удалось прочитать '+file);return [file,await response.json()]}))
      ]);
      const backup={format:'noktena-backup-v1',exported_at:new Date().toISOString(),note:'Изображения представлены только ссылками, файлы не включены.',source_data:Object.fromEntries(source),catalog:catalog.items,overrides:data.rows,category_settings:categories.settings,delivery_settings:delivery.settings};
      const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));
      const a=document.createElement('a');a.href=url;a.download='noktena-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      toast('Резервная копия скачана');
    }catch(error){toast(error.message,true)}finally{button.disabled=false}
  });
})();
