(() => {
  'use strict';
  const BOOT='https://admin-proxy-v2-production.up.railway.app/catalog-bootstrap.js';
  const CONTACTS='settings:contacts_v1';
  const POPULAR='settings:popular_v1';
  const DEFAULT_MAX='https://max.ru/u/f9LHodD0cOKZqie3BJvn11xgsNvxJK_kFOqYtKyFuZ2uMitoxZIwNaH8-NY';
  const $=id=>document.getElementById(id);
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let lastFocus=null;

  async function readSettings(key){
    const response=await fetch(BOOT+'?settings='+Date.now(),{cache:'no-store'});
    if(!response.ok)throw new Error('Не удалось загрузить настройки');
    const source=await response.text();
    const marker='window.NOKTENA_CATALOG_BOOTSTRAP=';
    const start=source.indexOf(marker);
    if(start<0)throw new Error('Не удалось прочитать настройки');
    const data=JSON.parse(source.slice(start+marker.length).trim().replace(/;+\s*$/,''));
    return (data.rows||[]).find(row=>row.product_key===key)?.payload||null;
  }
  async function saveSettings(key,payload){
    return request('save',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key,kind:'mattress',item:payload,hidden:false,is_custom:false})});
  }
  function openModal(id){
    lastFocus=document.activeElement;
    $(id).classList.remove('hide');
    $(id).querySelector('input,select,button')?.focus();
  }
  function closeModal(modal){
    modal.classList.add('hide');
    if(modal.id==='passwordModal')$('passwordForm').reset();
    lastFocus?.focus?.();
  }
  document.querySelectorAll('[data-close-store-modal]').forEach(button=>button.addEventListener('click',()=>closeModal(button.closest('.modal'))));
  for(const id of ['contactsModal','popularModal','passwordModal']){
    const modal=$(id);
    modal.addEventListener('click',event=>{if(event.target===modal)closeModal(modal)});
  }
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    const open=['passwordModal','popularModal','contactsModal'].map($).find(modal=>!modal.classList.contains('hide'));
    if(open)closeModal(open);
  });

  document.querySelector('[data-admin-open="contacts"]')?.addEventListener('click',async()=>{
    try{
      const settings=await readSettings(CONTACTS);
      $('storePhone').value=settings?.phone||'+7 (932) 120-76-35';
      $('storeMaxUrl').value=settings?.max_url||DEFAULT_MAX;
      openModal('contactsModal');
    }catch(error){toast(error.message,true)}
  });
  $('contactsForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const form=event.currentTarget,button=form.querySelector('[type="submit"]');
    const phone=$('storePhone').value.trim(),digits=phone.replace(/\D/g,'');
    if(!/^\+7[\d\s()\-]{10,}$/.test(phone)||digits.length!==11){toast('Укажите российский номер в формате +7',true);return}
    let url;
    try{url=new URL($('storeMaxUrl').value.trim())}catch{}
    if(!url||url.protocol!=='https:'||!['max.ru','www.max.ru'].includes(url.hostname)||url.pathname==='/'||url.username||url.password||url.port){toast('Укажите ссылку на профиль в MAX, например https://max.ru/u/...',true);return}
    button.disabled=true;
    try{
      await saveSettings(CONTACTS,{model:'__contacts_v1__',phone,phone_href:'tel:+'+digits,max_url:url.href});
      closeModal($('contactsModal'));
      toast('Контакты сохранены на сайте');
    }catch(error){toast(error.message,true)}finally{button.disabled=false}
  });

  const publicItems=()=>items.filter(item=>!item._hidden&&item._key&&((item._kind==='furniture'&&item.id)||(item._kind==='mattress'&&item.model)));
  function defaultPopular(){
    const beds=publicItems().filter(item=>item.category==='beds');
    const sofas=publicItems().filter(item=>item.category==='sofas');
    const bedHits=beds.filter(item=>item.hit),sofaHits=sofas.filter(item=>item.hit);
    const kuba=beds.find(item=>item.id==='berhouse-24136');
    const chosen=(bedHits.length>=3?bedHits:beds).filter(item=>item.id!=='berhouse-24136').slice(0,3);
    if(kuba){if(chosen.length>=3)chosen[2]=kuba;else chosen.push(kuba)}
    return [...chosen,...(sofaHits.length>=3?sofaHits:sofas).slice(0,3)].map(item=>item._key);
  }
  function renderPopular(selected){
    const options=publicItems().slice().sort((a,b)=>{
      const cat=(a._kind==='mattress'?0:a.category==='beds'?1:2)-(b._kind==='mattress'?0:b.category==='beds'?1:2);
      return cat||productName(a).localeCompare(productName(b),'ru');
    });
    $('popularSlots').innerHTML=Array.from({length:6},(_,index)=>`<label>Место ${index+1}<select data-popular-slot><option value="">Не показывать</option>${options.map(item=>`<option value="${escapeHtml(item._key)}" ${selected[index]===item._key?'selected':''}>${item._kind==='mattress'?'Матрас':item.category==='beds'?'Кровать':'Диван'} · ${escapeHtml(productName(item))}</option>`).join('')}</select></label>`).join('');
  }
  document.querySelector('[data-admin-open="popular"]')?.addEventListener('click',async()=>{
    try{
      const settings=await readSettings(POPULAR);
      renderPopular(Array.isArray(settings?.keys)?settings.keys:defaultPopular());
      openModal('popularModal');
    }catch(error){toast(error.message,true)}
  });
  $('popularForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const keys=[...document.querySelectorAll('[data-popular-slot]')].map(select=>select.value).filter(Boolean);
    if(!keys.length||new Set(keys).size!==keys.length){toast('Выберите хотя бы одну модель, без повторов',true);return}
    const button=event.currentTarget.querySelector('[type="submit"]');button.disabled=true;
    try{
      await saveSettings(POPULAR,{model:'__popular_v1__',keys});
      closeModal($('popularModal'));toast('Подборка на главной сохранена');
    }catch(error){toast(error.message,true)}finally{button.disabled=false}
  });

  document.querySelector('[data-admin-open="password"]')?.addEventListener('click',()=>openModal('passwordModal'));
  $('passwordForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const current=$('currentAdminPassword').value,next=$('newAdminPassword').value;
    if(next!==$('confirmAdminPassword').value){toast('Новые пароли не совпадают',true);return}
    if(next.length<12||next===current){toast('Укажите новый пароль длиной не менее 12 символов',true);return}
    const button=event.currentTarget.querySelector('[type="submit"]');button.disabled=true;
    try{
      await request('change-password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({current_password:current,new_password:next})});
      saveSession(null);
      $('passwordForm').reset();closeModal($('passwordModal'));
      $('app').classList.add('hide');$('login').classList.remove('hide');$('password').value='';
      $('loginError').textContent='Пароль изменён. Войдите с новым паролем.';
      $('email').focus();
    }catch(error){toast(error.message==='INVALID_CURRENT_PASSWORD'?'Текущий пароль неверен':error.message==='PASSWORD_UPDATE_FAILED'?'Пароль не обновлён. Проверьте настройки безопасности.':error.message,true)}finally{button.disabled=false}
  });
})();
