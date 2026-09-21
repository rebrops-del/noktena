const API='https://oldtlbkrftflfthfsqdv.supabase.co/functions/v1/noktena-admin-api';
const SESSION_KEY='nkt-adm2';
let session=null;
let items=[];
let current=null;
let draft=null;
let originalBasePrice=0;

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const clone=value=>structuredClone(value);

function esc(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));
}

function toast(message,error=false){
  const el=$('#toast');
  el.textContent=message;
  el.className='toast'+(error?' error':'');
  window.clearTimeout(toast.timer);
  toast.timer=window.setTimeout(()=>el.classList.add('hide'),4000);
}

function saveSession(value){
  session=value;
  if(value)localStorage.setItem(SESSION_KEY,JSON.stringify(value));
  else localStorage.removeItem(SESSION_KEY);
}

try{session=JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{saveSession(null)}

async function request(action,options={},auth=true,retry=true){
  const headers={...(options.headers||{})};
  if(auth&&session?.access_token)headers.Authorization='Bearer '+session.access_token;
  let response=await fetch(API+'?action='+encodeURIComponent(action),{...options,headers});

  if(response.status===401&&auth&&retry&&session?.refresh_token){
    const refreshResponse=await fetch(API+'?action=refresh',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({refresh_token:session.refresh_token})
    });
    const refreshed=await refreshResponse.json().catch(()=>({}));
    if(!refreshResponse.ok)throw new Error(refreshed.error||'Сессия истекла');
    saveSession(refreshed.session);
    return request(action,options,auth,false);
  }

  const data=await response.json().catch(()=>({error:'Некорректный ответ сервера'}));
  if(!response.ok)throw new Error(data.error||'Ошибка сервера');
  return data;
}

function productName(item){
  return item?._kind==='mattress'?(item.model||'Без названия'):(item.title||'Без названия');
}

function group(item){
  if(item?._kind==='mattress')return 'mattress';
  return item?.category==='sofas'?'sofas':'beds';
}

function basePrice(item){
  const prices=(item?.variants||[]).map(v=>Number(v.price)).filter(n=>n>0);
  if(Number(item?.price)>0)prices.push(Number(item.price));
  return prices.length?Math.min(...prices):0;
}

function money(value){
  return (Number(value)||0).toLocaleString('ru-RU')+' ₽';
}

function categoryLabel(item){
  const g=group(item);
  return g==='mattress'?'Матрас':g==='sofas'?'Диван':'Кровать';
}

function draw(){
  const query=$('#q').value.trim().toLowerCase();
  const kind=$('#kindFilter').value;
  const status=$('#statusFilter').value;
  const filtered=items.filter(item=>{
    const haystack=[productName(item),item.description,item.summary,item.intro,item._key].join(' ').toLowerCase();
    return (!query||haystack.includes(query))&&
      (!kind||group(item)===kind)&&
      (!status||(status==='changed'&&item._changed)||(status==='custom'&&item._isCustom));
  });

  $('#count').textContent=`Показано ${filtered.length} из ${items.length}`;
  $('#rows').innerHTML=filtered.map(item=>{
    const image=item.images?.[0];
    const badges=[
      item._isCustom?'<span class="pill custom">Новая</span>':'',
      item._changed?'<span class="pill">Изменена</span>':''
    ].filter(Boolean).join(' ');
    return `<tr>
      <td><div class="prod">${image?`<img class="thumb" src="${esc(image)}" alt="">`:'<div class="thumb"></div>'}<div><b>${esc(productName(item))}</b><div class="muted">${esc(item._key)}</div></div></div></td>
      <td>${categoryLabel(item)}</td>
      <td><b>${money(basePrice(item))}</b></td>
      <td>${badges||'Каталог'}</td>
      <td><button class="btn secondary" data-edit="${esc(item._key)}">Изменить</button></td>
    </tr>`;
  }).join('')||'<tr><td colspan="5">Товары не найдены</td></tr>';
}

async function loadCatalog(){
  $('#rows').innerHTML='<tr><td colspan="5">Загрузка…</td></tr>';
  const data=await request('catalog');
  items=Array.isArray(data.items)?data.items:[];
  draw();
}

function readVariantRows(){
  if(!draft)return;
  const previous=Array.isArray(draft.variants)?draft.variants:[];
  draft.variants=$$('.variant-row').map(row=>{
    const index=Number(row.dataset.index);
    const old=Number.isInteger(index)&&previous[index]?previous[index]:{};
    const next={...old};
    next.size=(row.querySelector('[data-size]')?.value||'').trim();
    if(draft._kind==='furniture')next.color=(row.querySelector('[data-color]')?.value||'').trim();
    next.price=Number(row.querySelector('[data-price]')?.value)||0;
    next.available=!!row.querySelector('[data-available]')?.checked;
    return next;
  }).filter(v=>v.size||v.color||v.price);
}

function renderImages(){
  const images=Array.isArray(draft?.images)?draft.images:[];
  $('#images').innerHTML=images.map((url,index)=>`<div class="image-card">
    <img src="${esc(url)}" alt="Фото товара">
    <div class="image-actions">
      <button type="button" data-main-image="${index}">${index===0?'Главное ✓':'Сделать главным'}</button>
      <button type="button" data-remove-image="${index}" style="color:#c93643">Убрать</button>
    </div>
  </div>`).join('')||'<div class="muted">Фотографий пока нет.</div>';
}

function renderVariants(){
  const variants=Array.isArray(draft?.variants)?draft.variants:[];
  $('#variants').innerHTML=variants.map((variant,index)=>draft._kind==='mattress'?`<div class="variant-row mattress" data-index="${index}">
      <input data-size value="${esc(variant.size||'')}" placeholder="Размер">
      <input data-price type="number" min="0" value="${Number(variant.price)||0}" placeholder="Цена">
      <label class="check"><input data-available type="checkbox" ${variant.available===false?'':'checked'}> В наличии</label>
      <button type="button" class="btn danger remove-variant" data-remove-variant="${index}">×</button>
    </div>`:`<div class="variant-row" data-index="${index}">
      <input data-size value="${esc(variant.size||'')}" placeholder="Размер">
      <input data-color value="${esc(variant.color||'')}" placeholder="Цвет">
      <input data-price type="number" min="0" value="${Number(variant.price)||0}" placeholder="Цена">
      <label class="check"><input data-available type="checkbox" ${variant.available===false?'':'checked'}> В наличии</label>
      <button type="button" class="btn danger remove-variant" data-remove-variant="${index}">×</button>
    </div>`).join('')||'<div class="muted">Вариантов пока нет.</div>';
  renderColors();
}

function renderColors(){
  if(!draft||draft._kind!=='furniture'){
    $('#colorSection').classList.add('hide');
    return;
  }
  $('#colorSection').classList.remove('hide');
  draft.colorImages=draft.colorImages&&typeof draft.colorImages==='object'?draft.colorImages:{};
  const colors=[...new Set((draft.variants||[]).map(v=>v.color).filter(Boolean))];
  const availableImages=[...new Set([...(draft.images||[]),...Object.values(draft.colorImages).filter(Boolean)])];
  $('#colors').innerHTML=colors.map(color=>{
    const selected=draft.colorImages[color]||'';
    const options=availableImages.map(url=>`<option value="${esc(url)}" ${url===selected?'selected':''}>${url===selected?'Текущее фото':'Фото из карточки'}</option>`).join('');
    return `<div class="color-row">
      ${selected?`<img src="${esc(selected)}" alt="${esc(color)}">`:'<div class="thumb"></div>'}
      <b>${esc(color)}</b>
      <select data-color-select="${esc(color)}"><option value="">Без привязки</option>${options}</select>
      <label class="btn secondary" style="display:inline-flex;align-items:center;cursor:pointer">+ Фото<input data-color-file="${esc(color)}" type="file" accept="image/*" hidden></label>
      ${selected?`<button type="button" class="btn danger" data-remove-color="${esc(color)}">Удалить</button>`:''}
    </div>`;
  }).join('')||'<div class="muted">Добавьте цвет в вариантах товара.</div>';
}

function openEditor(key){
  current=items.find(item=>item._key===key);
  if(!current)return;
  draft=clone(current);
  originalBasePrice=Number(draft.price)||basePrice(draft);
  $('#editorTitle').textContent=productName(draft);
  $('#editorKey').textContent=draft._key;
  $('#name').value=productName(draft)||'';
  $('#category').value=draft.category||'';
  $('#price').value=originalBasePrice||'';
  $('#available').value=draft.available===false?'0':'1';
  $('#summary').value=draft._kind==='mattress'?(draft.intro||''):(draft.summary||'');
  $('#description').value=draft.description||'';
  $('#hidden').checked=!!draft._hidden;
  $('#reset').textContent=draft._isCustom?'Удалить карточку':'Сбросить изменения';
  renderImages();
  renderVariants();
  $('#editor').classList.remove('hide');
}

function closeEditor(){
  $('#editor').classList.add('hide');
  current=null;
  draft=null;
}

async function uploadPhoto(file,color=''){
  if(!file||!draft)return;
  const form=new FormData();
  form.append('file',file);
  form.append('product_key',draft._key);
  const data=await request('upload',{method:'POST',body:form});
  if(color){
    draft.colorImages=draft.colorImages||{};
    draft.colorImages[color]=data.url;
  }else{
    draft.images=Array.isArray(draft.images)?draft.images:[];
    draft.images.push(data.url);
  }
  renderImages();
  renderColors();
  toast('Фото загружено');
}

function addNewVariant(){
  readVariantRows();
  draft.variants=Array.isArray(draft.variants)?draft.variants:[];
  const price=Number($('#price').value)||0;
  draft.variants.push(draft._kind==='mattress'?{size:'',price,available:true}:{size:'',color:'',price,available:true});
  renderVariants();
}

function openNewCard(){
  $('#newType').value='mattress';
  $('#newName').value='';
  $('#newModal').classList.remove('hide');
  $('#newName').focus();
}

function closeNewCard(){
  $('#newModal').classList.add('hide');
}

function createDraftFromNewForm(){
  const type=$('#newType').value;
  const name=$('#newName').value.trim();
  if(!name)throw new Error('Укажите название карточки');
  const uid=crypto.randomUUID();
  if(type==='mattress'){
    return {
      _kind:'mattress',_key:'mattress:custom-'+uid,_isCustom:true,_changed:true,_hidden:false,
      model:name,category:'Матрасы',description:'',intro:'',images:[],variants:[],available:true
    };
  }
  return {
    _kind:'furniture',_key:'furniture:custom-'+uid,_isCustom:true,_changed:true,_hidden:false,
    id:'custom-'+uid,category:type,title:name,price:0,description:'',summary:'',images:[],variants:[],colors:[],sizes:[],colorImages:{},available:true
  };
}

function openFreshDraft(item){
  current=item;
  draft=clone(item);
  originalBasePrice=0;
  $('#editorTitle').textContent=productName(draft);
  $('#editorKey').textContent=draft._key;
  $('#name').value=productName(draft);
  $('#category').value=draft.category||'';
  $('#price').value='';
  $('#available').value='1';
  $('#summary').value='';
  $('#description').value='';
  $('#hidden').checked=false;
  $('#reset').textContent='Удалить карточку';
  renderImages();
  renderVariants();
  $('#editor').classList.remove('hide');
}

async function saveEditor(event){
  event.preventDefault();
  if(!draft)return;
  $('#save').disabled=true;
  try{
    readVariantRows();
    const newBase=Number($('#price').value)||0;
    if(newBase>0&&newBase!==originalBasePrice){
      draft.variants=(draft.variants||[]).map(variant=>({...variant,price:newBase}));
    }
    draft.category=$('#category').value.trim();
    draft.available=$('#available').value==='1';
    draft.description=$('#description').value.trim();

    const name=$('#name').value.trim();
    if(!name)throw new Error('Название не может быть пустым');

    if(draft._kind==='mattress'){
      draft.model=name;
      draft.intro=$('#summary').value.trim();
      delete draft.price;
    }else{
      draft.title=name;
      draft.summary=$('#summary').value.trim();
      draft.price=newBase;
      draft.sizes=[...new Set((draft.variants||[]).map(v=>v.size).filter(Boolean))];
      draft.colors=[...new Set((draft.variants||[]).map(v=>v.color).filter(Boolean))];
    }

    await request('save',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({key:draft._key,kind:draft._kind,item:draft,hidden:$('#hidden').checked,is_custom:!!draft._isCustom})
    });
    toast('Карточка сохранена');
    closeEditor();
    await loadCatalog();
  }catch(error){
    toast(error.message,true);
  }finally{
    $('#save').disabled=false;
  }
}

async function resetOrDelete(){
  if(!current)return;
  const isCustom=!!current._isCustom;
  if(!current._changed&&!isCustom)return toast('У карточки нет ручных изменений',true);
  const message=isCustom?'Удалить эту добавленную карточку?':'Сбросить все ручные изменения этой карточки?';
  if(!confirm(message))return;
  try{
    await request('reset',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key:current._key})
    });
    closeEditor();
    await loadCatalog();
    toast(isCustom?'Карточка удалена':'Изменения сброшены');
  }catch(error){toast(error.message,true)}
}

async function bulkPrices(){
  const value=prompt('Изменить все цены на %, например 10 или -5');
  if(value===null)return;
  const percent=Number(value);
  if(!Number.isFinite(percent)||percent===0)return toast('Укажите ненулевой процент',true);
  if(!confirm(`Применить ${percent}% ко всем видимым товарам каталога?`))return;
  try{
    const change=n=>Math.max(0,Math.round((Number(n)||0)*(1+percent/100)/100)*100);
    const rows=items.map(item=>{
      const changed=clone(item);
      if(Number(changed.price)>0)changed.price=change(changed.price);
      if(Array.isArray(changed.variants))changed.variants=changed.variants.map(variant=>({
        ...variant,price:Number(variant.price)>0?change(variant.price):variant.price
      }));
      return {key:changed._key,kind:changed._kind,item:changed,hidden:false,is_custom:!!changed._isCustom};
    });
    await request('save-many',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({rows})
    });
    await loadCatalog();
    toast('Цены обновлены');
  }catch(error){toast(error.message,true)}
}

async function start(){
  try{
    $('#login').classList.add('hide');
    $('#app').classList.remove('hide');
    $('#adminEmail').textContent=session?.user?.email||'';
    await loadCatalog();
  }catch(error){
    toast(error.message,true);
    saveSession(null);
    $('#app').classList.add('hide');
    $('#login').classList.remove('hide');
  }
}

async function health(){
  try{
    const data=await request('health',{},false);
    $('#apiStatus').textContent=data.ok?'Сервер готов':'Сервер недоступен';
    $('#apiStatus').style.color=data.ok?'#087345':'#b82e3b';
  }catch(error){
    $('#apiStatus').textContent='Сервер недоступен: '+error.message;
    $('#apiStatus').style.color='#b82e3b';
  }
}

$('#loginForm').addEventListener('submit',async event=>{
  event.preventDefault();
  $('#loginError').textContent='';
  $('#loginBtn').disabled=true;
  try{
    const data=await request('login',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({email:$('#email').value.trim(),password:$('#password').value})
    },false);
    saveSession(data.session);
    await start();
  }catch(error){$('#loginError').textContent=error.message}
  finally{$('#loginBtn').disabled=false}
});

$('#logout').addEventListener('click',()=>{saveSession(null);location.reload()});
$('#reload').addEventListener('click',()=>loadCatalog().catch(error=>toast(error.message,true)));
$('#add').addEventListener('click',openNewCard);
$('#bulk').addEventListener('click',bulkPrices);
$('#closeEditor').addEventListener('click',closeEditor);
$('#cancel').addEventListener('click',closeEditor);
$('#reset').addEventListener('click',resetOrDelete);
$('#editorForm').addEventListener('submit',saveEditor);
$('#addVariant').addEventListener('click',addNewVariant);
$('#closeNew').addEventListener('click',closeNewCard);
$('#cancelNew').addEventListener('click',closeNewCard);

['q','kindFilter','statusFilter'].forEach(id=>$('#'+id).addEventListener(id==='q'?'input':'change',draw));

$('#newForm').addEventListener('submit',event=>{
  event.preventDefault();
  try{
    const item=createDraftFromNewForm();
    closeNewCard();
    openFreshDraft(item);
  }catch(error){toast(error.message,true)}
});

$('#photo').addEventListener('change',async event=>{
  const file=event.target.files?.[0];
  if(file)try{await uploadPhoto(file)}catch(error){toast(error.message,true)}
  event.target.value='';
});

$('#addUrl').addEventListener('click',()=>{
  const url=$('#photoUrl').value.trim();
  if(!url)return;
  try{new URL(url)}catch{return toast('Некорректная ссылка',true)}
  draft.images=Array.isArray(draft.images)?draft.images:[];
  draft.images.push(url);
  $('#photoUrl').value='';
  renderImages();
  renderColors();
});

$('#variants').addEventListener('input',event=>{
  if(event.target.matches('[data-color]')){
    readVariantRows();
    renderColors();
  }
});

$('#variants').addEventListener('change',event=>{
  if(event.target.matches('[data-available]'))readVariantRows();
});

document.addEventListener('click',event=>{
  const editButton=event.target.closest('[data-edit]');
  if(editButton){openEditor(editButton.dataset.edit);return}

  const removeImage=event.target.closest('[data-remove-image]');
  if(removeImage&&draft){
    const index=Number(removeImage.dataset.removeImage);
    const url=draft.images?.[index];
    draft.images.splice(index,1);
    for(const [color,image] of Object.entries(draft.colorImages||{}))if(image===url)delete draft.colorImages[color];
    renderImages();renderColors();return;
  }

  const mainImage=event.target.closest('[data-main-image]');
  if(mainImage&&draft){
    const index=Number(mainImage.dataset.mainImage);
    if(index>0){const [url]=draft.images.splice(index,1);draft.images.unshift(url);renderImages();renderColors()}
    return;
  }

  const removeVariant=event.target.closest('[data-remove-variant]');
  if(removeVariant&&draft){
    readVariantRows();
    draft.variants.splice(Number(removeVariant.dataset.removeVariant),1);
    renderVariants();return;
  }

  const removeColor=event.target.closest('[data-remove-color]');
  if(removeColor&&draft){delete draft.colorImages[removeColor.dataset.removeColor];renderColors()}
});

document.addEventListener('change',async event=>{
  const select=event.target.closest('[data-color-select]');
  if(select&&draft){
    draft.colorImages=draft.colorImages||{};
    if(select.value)draft.colorImages[select.dataset.colorSelect]=select.value;
    else delete draft.colorImages[select.dataset.colorSelect];
    renderColors();return;
  }

  const input=event.target.closest('[data-color-file]');
  if(input&&input.files?.[0]&&draft){
    try{await uploadPhoto(input.files[0],input.dataset.colorFile)}catch(error){toast(error.message,true)}
    input.value='';
  }
});

health();
if(session)start();