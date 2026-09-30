(()=>{
  'use strict';
  const $=selector=>document.querySelector(selector);
  const core=window.NoktenaCityCatalogCore,importer=window.NoktenaCityImport;
  const template=$('#cityCatalogTemplate'),main=$('.main'),link=$('[data-admin-open="cities"]');
  if(!core||!importer||!template||!main||!link)return;
  const pane=document.createElement('section');pane.id='adminCityPane';pane.className='admin-pane city-pane hide';pane.append(template.content.cloneNode(true));main.append(pane);
  const BOOT='https://admin-proxy-v2-production.up.railway.app/catalog-bootstrap.js';
  let state=core.normalize(),base=[],selectedId='ekaterinburg',pending=null,busy=false,loaded=false;
  const city=()=>state.cities.find(c=>c.id===selectedId);
  const catalog=()=>state.catalogs[selectedId];
  const keyOf=item=>item._key||item._catalogKey||core.keyFor(item._kind,item);
  const nameOf=item=>item.model||item.title||'Без названия';
  const ownKeys=c=>c.keys===null?[...new Set([...base.map(keyOf),...Object.keys(c.products)])]:c.keys;
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
    const select=$('#cityAdminSelect');select.replaceChildren();
    for(const item of state.cities){const opt=document.createElement('option');opt.value=item.id;opt.textContent=item.name;select.append(opt)}
    select.value=selectedId;
  }
  function render(){
    optionList();const c=city();if(!c)return;
    $('#cityAdminName').value=c.name;$('#cityAdminWarehouse').value=c.warehouse;
    $('#cityAdminDelivery').value=c.delivery_price??'';
    const selected=new Set(ownKeys(catalog())),filter=$('#cityCatalogSearch').value.trim().toLowerCase();
    const rows=sourceItems().filter(item=>!filter||[nameOf(item),keyOf(item)].join(' ').toLowerCase().includes(filter));
    const list=$('#cityCatalogList');list.replaceChildren();
    for(const item of rows){
      const key=keyOf(item),product=effectiveProduct(key),row=document.createElement('div');row.className='city-product-row';
      const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=selected.has(key);check.dataset.cityCheck=key;
      const name=document.createElement('span'),title=document.createElement('strong'),detail=document.createElement('small');
      title.textContent=nameOf(product);detail.textContent=(product._kind==='mattress'?'Матрас':product.category==='sofas'?'Диван':'Кровать')+' · '+key+(product._hidden?' · скрыт':catalog().products[key]?' · изменён для города':'');
      name.append(title,detail);label.append(check,name);row.append(label);
      const edit=document.createElement('button');edit.className='btn secondary';edit.type='button';edit.dataset.cityEdit=key;edit.textContent='Изменить для города';row.append(edit);
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
  async function reload(){
    const [data,bootstrap]=await Promise.all([request('catalog'),readBootstrap()]);
    base=Array.isArray(data.items)?data.items:[];state=core.fromBootstrap(bootstrap);
    if(!state.cities.some(x=>x.id===selectedId))selectedId='ekaterinburg';
    loaded=true;render();status('Изменения появятся на сайте после сохранения и обновления страницы.');
  }
  async function open(){
    $('#adminCatalogPane')?.classList.add('hide');$('#adminOrdersPane')?.classList.add('hide');$('#adminTabs')?.classList.add('hide');$('#adminSiteSettingsPane')?.classList.add('hide');pane.classList.remove('hide');
    status('Загружаем каталог…');
    try{await reload()}catch(error){status(error.message,true);toast(error.message,true)}
  }
  function close(){pane.classList.add('hide');$('#adminTabs')?.classList.remove('hide')}
  async function persist(message){
    if(busy)throw new Error('Дождитесь завершения сохранения');
    const payload=core.normalize(state),bytes=new Blob([JSON.stringify(payload)]).size;
    if(bytes>5*1024*1024)throw new Error('Каталог превышает 5 МБ. Уменьшите описания или разделите ассортимент.');
    busy=true;$('#cityCatalogSave').disabled=true;$('#cityImportSave').disabled=true;status('Сохраняем…');
    try{
      await request('save',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key:core.KEY,kind:'mattress',item:payload,hidden:false,is_custom:false})});
      state=payload;status(message);toast(message);render();
    }catch(error){status(error.message,true);throw error}
    finally{busy=false;$('#cityCatalogSave').disabled=false;$('#cityImportSave').disabled=!pending}
  }
  function setKeys(keys){catalog().keys=[...new Set(keys)];render();status('Изменения ещё не сохранены.')}
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
    if(isNew&&(c.keys===null||!c.keys.includes(key))){c.keys=ownKeys(c);c.keys.push(key)}
    if(c.keys!==null&&!c.keys.includes(key))c.keys.push(key);
    c.products[key]={...withoutFlags(item),hidden:!!hidden};
    await persist('Товар сохранён для города '+city().name);
    return true;
  }
  async function removeProduct(cityId,item){
    if(cityId!==selectedId)throw new Error('Выбран другой город');
    const key=keyOf(item),c=catalog(),existing=base.some(x=>keyOf(x)===key);
    if(existing){delete c.products[key]}
    else{c.keys=ownKeys(c).filter(x=>x!==key);delete c.products[key]}
    await persist(existing?'Изменения товара для города сброшены':'Товар удалён из каталога города');
  }
  function download(filename,text){
    const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
    a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  link.addEventListener('click',()=>open());
  $('#catalogTab')?.addEventListener('click',close);$('#ordersTab')?.addEventListener('click',close);
  $('#cityAdminSelect').addEventListener('change',event=>{selectedId=event.target.value;pending=null;$('#cityCatalogFile').value='';$('#cityImportPreview').textContent='';$('#cityImportSave').disabled=true;render();status('Выбран город '+city().name)});
  $('#cityAddForm').addEventListener('submit',async event=>{
    event.preventDefault();const name=$('#cityAddName').value.trim();if(!name)return;
    if(state.cities.some(x=>x.name.toLocaleLowerCase('ru')===name.toLocaleLowerCase('ru')))return toast('Такой город уже добавлен',true);
    const id='city-'+crypto.randomUUID().slice(0,12);
    state.cities.push({id,name,warehouse:'',delivery_price:null});state.catalogs[id]={keys:[],products:{}};selectedId=id;
    try{await persist('Город '+name+' добавлен с пустым каталогом');$('#cityAddName').value=''}catch(error){toast(error.message,true)}
  });
  $('#cityDetailsForm').addEventListener('submit',async event=>{
    event.preventDefault();const name=$('#cityAdminName').value.trim(),warehouse=$('#cityAdminWarehouse').value.trim(),raw=$('#cityAdminDelivery').value;
    if(!name)return toast('Укажите название города',true);
    if(raw!==''&&(!Number.isFinite(Number(raw))||Number(raw)<0||Number(raw)>1000000))return toast('Проверьте стоимость доставки',true);
    Object.assign(city(),{name,warehouse,delivery_price:raw===''?null:Number(raw)});
    try{await persist('Данные города сохранены')}catch(error){toast(error.message,true)}
  });
  $('#cityCopyCatalog').addEventListener('click',()=>{
    if(selectedId==='ekaterinburg')return;
    const source=state.catalogs.ekaterinburg;
    if(catalog().keys?.length&&!confirm('Заменить выбор товаров каталога '+city().name+' товарами Екатеринбурга?'))return;
    catalog().keys=ownKeys(source);catalog().products={...structuredClone(source.products),...catalog().products};render();status('Список скопирован. Нажмите «Сохранить товары города».');
  });
  $('#citySelectAll').addEventListener('click',()=>setKeys(sourceItems().map(keyOf)));
  $('#cityClear').addEventListener('click',()=>setKeys([]));
  $('#cityCatalogSearch').addEventListener('input',render);
  $('#cityCatalogList').addEventListener('change',event=>{
    const check=event.target.closest('[data-city-check]');if(!check)return;
    const keys=new Set(ownKeys(catalog()));if(check.checked)keys.add(check.dataset.cityCheck);else keys.delete(check.dataset.cityCheck);
    setKeys([...keys]);
  });
  $('#cityCatalogList').addEventListener('click',event=>{
    const key=event.target.closest('[data-city-edit]')?.dataset.cityEdit;
    if(key)window.NoktenaAdminCityEditor?.openExisting(selectedId,effectiveProduct(key));
  });
  $('#cityAddProduct').addEventListener('click',()=>window.NoktenaAdminCityEditor?.openNew(selectedId));
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
  window.NoktenaCityAdmin=Object.freeze({saveProduct,removeProduct,open,reload});
})();
