(()=>{
  'use strict';
  const $=selector=>document.querySelector(selector);
  const core=window.NoktenaCityCatalogCore,importer=window.NoktenaCityImport;
  const template=$('#cityCatalogTemplate'),main=$('.main'),link=$('[data-admin-open="cities"]');
  if(!core||!importer||!template||!main||!link)return;
  const pane=document.createElement('section');pane.id='adminCityPane';pane.className='admin-pane city-pane hide';pane.append(template.content.cloneNode(true));main.append(pane);
  const BOOT='https://admin-proxy-v2-production.up.railway.app/catalog-bootstrap.js';
  const citySelect=$('#adminCitySelect');
  const SELECTED_CITY_KEY='noktena-admin-city-v1';
  let remembered='';try{remembered=localStorage.getItem(SELECTED_CITY_KEY)||''}catch{}
  let state=core.normalize(),base=[],selectedId=remembered||'ekaterinburg',pending=null,busy=false,loaded=false;
  function rememberCity(){try{localStorage.setItem(SELECTED_CITY_KEY,selectedId)}catch{}}
  const city=()=>state.cities.find(c=>c.id===selectedId);
  const catalog=()=>state.catalogs[selectedId];
  const contentFields={hero_description:'cityHeroDescription',delivery_description:'cityDeliveryDescription',service_description:'cityServiceDescription',about_description:'cityAboutDescription'};
  const keyOf=item=>item._key||item._catalogKey||core.keyFor(item._kind,item);
  const nameOf=item=>item.model||item.title||'Без названия';
  const ownKeys=c=>c.keys===null?[...new Set([...base.map(keyOf),...Object.keys(c.products)])]:c.keys;
  const productsFor=(cityId,source=base)=>core.adminCatalog(source,state,cityId);
  const notifyOverview=()=>window.NoktenaAdminCatalog?.refresh();
  function sourceItems(){
    const items=new Map(base.map(item=>[keyOf(item),item]));
    for(const key of Object.keys(catalog().products||{}))if(!items.has(key)){
      const product=catalog().products[key];items.set(key,{...product,_key:key,_kind:key.split(':')[0],_isCustom:true});
    }
    return [...items.values()];
  }
  function effectiveProduct(key){
    const original=base.find(x=>keyOf(x)===key),override=catalog().products[key];
    return {...(original||{}),...(override||{}),_key:key,_kind:key.split(':')[0],_isCustom:!original,_changed:!!override,_hidden:!!override?.hidden};
  }
  function status(message,error=false){const el=$('#cityCatalogStatus');el.textContent=message;el.classList.toggle('is-error',error)}
  function optionList(){
    citySelect.replaceChildren();
    for(const item of state.cities){const opt=document.createElement('option');opt.value=item.id;opt.textContent=item.name;citySelect.append(opt)}
    citySelect.value=selectedId;
    citySelect.disabled=!loaded||busy;
    $('#adminCitySummary').textContent='Каталог, цены и настройки: '+(city()?.name||'Екатеринбург')+'.';
  }
  function fillCityForms(){
    optionList();const c=city();if(!c)return;
    $('#cityAdminName').value=c.name;$('#cityAdminWarehouse').value=c.warehouse;
    const other=selectedId!=='ekaterinburg',remove=$('#cityAdminDelete');
    remove.hidden=!other;remove.disabled=!other||busy;
    for(const [key,id] of Object.entries(contentFields))$('#'+id).value=c[key]||'';
  }
  function render(){
    const c=city();if(!c)return;
    const selected=new Set(ownKeys(catalog())),filter=$('#cityCatalogSearch').value.trim().toLowerCase();
    const rows=sourceItems().filter(item=>!filter||[nameOf(item),keyOf(item)].join(' ').toLowerCase().includes(filter));
    const list=$('#cityCatalogList');list.replaceChildren();
    for(const item of rows){
      const key=keyOf(item),product=effectiveProduct(key),row=document.createElement('div');row.className='city-product-row';
      const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=selected.has(key);check.dataset.cityCheck=key;
      const name=document.createElement('span'),title=document.createElement('strong'),detail=document.createElement('small');
      title.textContent=nameOf(product);detail.textContent=(product._kind==='mattress'?'Матрас':product.category==='sofas'?'Диван':'Кровать')+' · '+key+(product._hidden?' · скрыт':catalog().products[key]?' · изменён для города':'');
      name.append(title,detail);label.append(check,name);row.append(label);
      list.append(row);
    }
    $('#cityCatalogCount').textContent=`Включено ${selected.size} товаров · найдено ${rows.length} из ${sourceItems().length}`;
    $('#cityCopyCatalog').disabled=selectedId==='ekaterinburg';
  }
  async function readBootstrap(){
    const response=await fetch(BOOT+'?cities='+Date.now(),{cache:'no-store'});
    if(!response.ok)throw new Error('Не удалось загрузить список городов');
    const source=await response.text(),marker='window.NOKTENA_CATALOG_BOOTSTRAP=',at=source.indexOf(marker);
    if(at<0)throw new Error('Не удалось прочитать настройки городов');
    return JSON.parse(source.slice(at+marker.length).trim().replace(/;+\s*$/,''));
  }
  async function reload(source){
    const [data,bootstrap]=await Promise.all([source?Promise.resolve({items:source}):request('catalog'),readBootstrap()]);
    base=Array.isArray(data.items)?data.items:[];state=core.fromBootstrap(bootstrap);
    if(!state.cities.some(x=>x.id===selectedId)){selectedId='ekaterinburg';rememberCity()}
    loaded=true;fillCityForms();render();status('Изменения появятся на сайте после сохранения и обновления страницы.');announceCity();
  }
  async function ensureLoaded(source){
    if(loaded){if(Array.isArray(source))base=source;return}
    await reload(source);
  }
  async function open(){
    $('#adminCatalogPane')?.classList.add('hide');$('#adminOrdersPane')?.classList.add('hide');$('#adminTabs')?.classList.add('hide');$('#adminSiteSettingsPane')?.classList.add('hide');pane.classList.remove('hide');
    status('Загружаем каталог…');
    try{await reload();notifyOverview()}catch(error){status(error.message,true);toast(error.message,true)}
  }
  function close(){pane.classList.add('hide');$('#adminTabs')?.classList.remove('hide')}
  async function persist(message){
    if(busy)throw new Error('Дождитесь завершения сохранения');
    if(!loaded)throw new Error('Сначала загрузите настройки городов');
    const payload=core.normalize(state),bytes=new Blob([JSON.stringify(payload)]).size;
    if(bytes>5*1024*1024)throw new Error('Каталог превышает 5 МБ. Уменьшите описания или разделите ассортимент.');
    busy=true;citySelect.disabled=true;$('#cityCatalogSave').disabled=true;$('#cityImportSave').disabled=true;$('#cityAdminDelete').disabled=true;status('Сохраняем…');
    try{
      await request('save',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key:core.KEY,kind:'mattress',item:payload,hidden:false,is_custom:false})});
      state=payload;fillCityForms();status(message);toast(message);render();notifyOverview();announceCity();
    }catch(error){status(error.message,true);throw error}
    finally{busy=false;citySelect.disabled=false;$('#cityCatalogSave').disabled=false;$('#cityImportSave').disabled=!pending;$('#cityAdminDelete').disabled=selectedId==='ekaterinburg'}
  }
  async function saveDeliverySettings(cityId,values){
    const selected=state.cities.find(item=>item.id===cityId);
    if(!loaded||!selected||cityId==='ekaterinburg')throw new Error('Выберите дополнительный город');
    const value=String(values.delivery_price??'').trim(),price=value===''?null:Number(value);
    if(value!==''&&(!Number.isSafeInteger(price)||price<0||price>1000000))throw new Error('Укажите целую стоимость доставки от 0 до 1 000 000 ₽');
    const options={};
    for(const key of core.DELIVERY_FIELDS){
      const number=Number(values[key]),limit=key==='free_delivery_from'?10000000:1000000;
      if(!Number.isSafeInteger(number)||number<0||number>limit)throw new Error('Укажите целую неотрицательную стоимость для всех услуг');
      options[key]=number;
    }
    options.delivery_schedule=String(values.delivery_schedule||'').trim();
    if(options.delivery_schedule.length>200)throw new Error('График доставки: не более 200 символов');
    const previous=selected.delivery_price,oldOptions=selected.delivery_settings;
    selected.delivery_price=price;
    selected.delivery_settings=options;
    try{await persist('Условия доставки для города '+selected.name+' сохранены')}
    catch(error){selected.delivery_price=previous;if(oldOptions)selected.delivery_settings=oldOptions;else delete selected.delivery_settings;throw error}
  }
  function setKeys(keys){catalog().keys=[...new Set(keys)];render();notifyOverview();status('Изменения ещё не сохранены.')}
  function withoutFlags(item){
    const cleaned=structuredClone(item);
    for(const key of Object.keys(cleaned))if(key.startsWith('_'))delete cleaned[key];
    return cleaned;
  }
  async function saveProduct(cityId,item,hidden){
    if(cityId!==selectedId)throw new Error('Выбран другой город. Откройте карточку заново.');
    const key=keyOf(item),c=catalog(),isNew=!base.some(x=>keyOf(x)===key);
    if(!/^(mattress|furniture):.{1,180}$/.test(key))throw new Error('Некорректный артикул');
    if(isNew&&!hidden&&(!Array.isArray(item.variants)||!item.variants.some(v=>v.size&&Number(v.price)>0)))throw new Error('Добавьте размер и цену товара перед публикацией');
    if(c.keys!==null&&!c.keys.includes(key))c.keys.push(key);
    c.products[key]={...withoutFlags(item),hidden:!!hidden};
    await persist('Товар сохранён для города '+city().name);
    return true;
  }
  async function removeProduct(cityId,item){
    if(cityId!==selectedId)throw new Error('Выбран другой город');
    const key=keyOf(item),c=catalog(),existing=base.some(x=>keyOf(x)===key);
    if(existing){delete c.products[key]}
    else{if(c.keys!==null)c.keys=c.keys.filter(x=>x!==key);delete c.products[key]}
    await persist(existing?'Изменения товара для города сброшены':'Товар удалён из каталога города');
  }
  async function removeFromCity(cityId,item){
    if(cityId!==selectedId)throw new Error('Выбран другой город');
    const key=keyOf(item),c=catalog();
    c.keys=ownKeys(c).filter(x=>x!==key);
    delete c.products[key];
    await persist('Товар убран из каталога города '+city().name);
  }
  async function bulkPrices(cityId,percent){
    if(cityId!==selectedId)throw new Error('Выбран другой город');
    const c=catalog(),change=n=>Math.max(0,Math.round((Number(n)||0)*(1+percent/100)/100)*100);
    for(const key of ownKeys(c)){
      const product=effectiveProduct(key);
      if(product._hidden||(!product.model&&!product.title))continue;
      const updated={...(c.products[key]||{})};
      if(Number(product.price)>0)updated.price=change(product.price);
      if(Array.isArray(product.variants))updated.variants=product.variants.map(variant=>({...variant,price:Number(variant.price)>0?change(variant.price):variant.price}));
      c.products[key]={...updated,hidden:false};
    }
    await persist('Цены товаров города '+city().name+' обновлены');
  }
  function download(filename,text){
    const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
    a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  link.addEventListener('click',()=>open());
  $('#catalogTab')?.addEventListener('click',close);$('#ordersTab')?.addEventListener('click',close);
  function announceCity(){document.dispatchEvent(new CustomEvent('noktena:admin-city-change',{detail:{city:city()}}))}
  function selectCity(id){
    if(busy||!loaded||!state.cities.some(item=>item.id===id)){citySelect.value=selectedId;return}
    if(id===selectedId)return;
    selectedId=id;rememberCity();pending=null;$('#cityCatalogFile').value='';$('#cityImportPreview').textContent='';$('#cityImportSave').disabled=true;
    fillCityForms();render();notifyOverview();status('Выбран город '+city().name);announceCity();
  }
  citySelect.addEventListener('change',event=>selectCity(event.target.value));
  $('#cityAddForm').addEventListener('submit',async event=>{
    event.preventDefault();const name=$('#cityAddName').value.trim();if(!name)return;
    if(state.cities.some(x=>x.name.toLocaleLowerCase('ru')===name.toLocaleLowerCase('ru')))return toast('Такой город уже добавлен',true);
    const id='city-'+crypto.randomUUID().slice(0,12);
    state.cities.push({id,name,warehouse:'',delivery_price:null});state.catalogs[id]={keys:[],products:{}};selectedId=id;
    try{await persist('Город '+name+' добавлен с пустым каталогом');rememberCity();$('#cityAddName').value=''}catch(error){toast(error.message,true)}
  });
  $('#cityDetailsForm').addEventListener('submit',async event=>{
    event.preventDefault();const name=$('#cityAdminName').value.trim(),warehouse=$('#cityAdminWarehouse').value.trim();
    if(!name)return toast('Укажите название города',true);
    Object.assign(city(),{name,warehouse});
    try{await persist('Данные города сохранены')}catch(error){toast(error.message,true)}
  });
  $('#cityAdminDelete').addEventListener('click',async()=>{
    const removed=city();if(!removed||removed.id==='ekaterinburg'||busy)return;
    const count=ownKeys(catalog()).length;
    if(!confirm('Удалить город «'+removed.name+'» вместе с каталогом (товаров: '+count+'), доставкой и настройками? Ранее оформленные заказы останутся.'))return;
    const before=state,beforeId=selectedId;
    state=core.removeCity(state,removed.id);selectedId='ekaterinburg';
    try{
      await persist('Город '+removed.name+' удалён');
      rememberCity();
      pending=null;$('#cityCatalogFile').value='';$('#cityImportPreview').textContent='';$('#cityImportSave').disabled=true;
      const keys=window.NoktenaCitySettings.CITY_KEYS.map(key=>window.NoktenaCitySettings.key(key,removed.id));
      const cleared=await Promise.allSettled(keys.map(key=>request('reset',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key})})));
      if(cleared.some(result=>result.status==='rejected'))toast('Город удалён, но часть старых настроек не удалось очистить.',true);
    }catch(error){
      state=before;selectedId=beforeId;fillCityForms();render();toast(error.message,true);
    }
  });
  $('#cityContentForm').addEventListener('input',event=>{
    const field=Object.entries(contentFields).find(([,id])=>id===event.target.id);
    if(field)status('Описание ещё не сохранено.');
  });
  $('#cityContentForm').addEventListener('submit',async event=>{
    event.preventDefault();const selected=city();
    for(const [key,id] of Object.entries(contentFields))selected[key]=$('#'+id).value.trim().slice(0,core.TEXT_LIMITS[key]);
    try{await persist('Описание города сохранено')}catch(error){toast(error.message,true)}
  });
  $('#cityCopyCatalog').addEventListener('click',()=>{
    if(selectedId==='ekaterinburg')return;
    const source=state.catalogs.ekaterinburg;
    if(catalog().keys?.length&&!confirm('Заменить выбор товаров каталога '+city().name+' товарами Екатеринбурга?'))return;
    catalog().keys=ownKeys(source);catalog().products={...structuredClone(source.products),...catalog().products};render();notifyOverview();status('Список скопирован. Нажмите «Сохранить товары города».');
  });
  $('#citySelectAll').addEventListener('click',()=>setKeys(sourceItems().map(keyOf)));
  $('#cityClear').addEventListener('click',()=>setKeys([]));
  $('#cityCatalogSearch').addEventListener('input',render);
  $('#cityCatalogList').addEventListener('change',event=>{
    const check=event.target.closest('[data-city-check]');if(!check)return;
    const keys=new Set(ownKeys(catalog()));if(check.checked)keys.add(check.dataset.cityCheck);else keys.delete(check.dataset.cityCheck);
    setKeys([...keys]);
  });
  $('#cityOpenProducts').addEventListener('click',()=>$('.side-nav [data-admin-open="catalog"]')?.click());
  $('#cityCatalogSave').addEventListener('click',()=>persist('Товары города сохранены').catch(error=>toast(error.message,true)));
  $('#cityCatalogDownloadTemplate').addEventListener('click',()=>download('noktena-catalog-template.csv','\uFEFF'+importer.COLUMNS.join(';')+'\r\n'));
  $('#cityCatalogExport').addEventListener('click',()=>{
    const items=ownKeys(catalog()).map(effectiveProduct).filter(x=>!catalog().products[x._key]?.hidden);
    download(`noktena-${selectedId}.csv`,importer.exportCSV(items));
  });
  $('#cityCatalogFile').addEventListener('change',async event=>{
    pending=null;$('#cityImportSave').disabled=true;const file=event.target.files?.[0];if(!file)return;
    if(file.size>3*1024*1024){$('#cityImportPreview').textContent='Файл должен быть меньше 3 МБ';return}
    try{
      const contents=await file.text(),list=file.name.toLowerCase().endsWith('.json')?importer.parseJSON(contents,selectedId):importer.parseCSV(contents,selectedId);
      pending={list,cityId:selectedId};$('#cityImportPreview').textContent=`Проверено: ${list.length} моделей, ${list.reduce((n,x)=>n+x.variants.length,0)} размеров. Загрузка изменит только город ${city().name}.`;
      $('#cityImportSave').disabled=false;
    }catch(error){$('#cityImportPreview').textContent='Ошибка файла: '+error.message}
  });
  $('#cityImportSave').addEventListener('click',async()=>{
    if(!pending||pending.cityId!==selectedId)return;
    const replace=$('#cityImportMode').value==='replace',name=city().name;
    if(replace&&!confirm('Заменить весь каталог города '+name+' товарами из файла?'))return;
    const c=catalog(),keys=replace?new Set():new Set(ownKeys(c)),products=replace?{}:{...c.products};
    for(const item of pending.list){const key=keyOf(item);keys.add(key);products[key]=withoutFlags(item)}
    c.keys=[...keys];c.products=products;
    try{await persist(replace?'Каталог города заменён':'Каталог города обновлён');pending=null;$('#cityCatalogFile').value='';$('#cityImportSave').disabled=true;$('#cityImportPreview').textContent='Каталог загружен. Обновите страницу магазина.'}
    catch(error){toast(error.message,true)}
  });
  window.NoktenaCityAdmin=Object.freeze({saveProduct,removeProduct,removeFromCity,saveDeliverySettings,bulkPrices,productsFor,currentCity:city,cities:()=>state.cities,selectCity,ensureLoaded,open,reload});
})();
