(()=>{
  'use strict';
  const $=selector=>document.querySelector(selector);
  const form=$('#siteNotificationsForm');
  if(!form)return;
  const email=$('#notificationEmailTo');
  const enabled=$('#notificationEmailEnabled');
  const messenger=$('#notificationMessenger');
  const maxType=$('#notificationMaxType');
  const maxTarget=$('#notificationMaxTarget');
  const telegramChat=$('#notificationTelegramChat');
  const save=$('#notificationSave');
  const test=$('#notificationTest');
  let busy=false,loaded=false,readiness={};

  function selected(channel){return messenger.value===channel||messenger.value==='both'}
  function updateFields(){
    $('#notificationMaxFields').hidden=!selected('max');
    $('#notificationTelegramFields').hidden=!selected('telegram');
    email.disabled=!enabled.checked;
  }
  function status(){
    const parts=[];
    if(enabled.checked)parts.push(readiness.mail_configured?'Почта: SMTP задан, проверьте доставку тестом.':'Почта: SMTP на сервере не настроен.');
    if(selected('max'))parts.push(readiness.max_bot_configured?'MAX: бот подключён; проверьте получателя тестом.':'MAX: токен бота пока не добавлен на сервер.');
    if(selected('telegram'))parts.push(readiness.telegram_bot_configured?'Telegram: бот подключён; проверьте получателя тестом.':'Telegram: токен бота пока не добавлен на сервер.');
    $('#notificationReadiness').textContent=parts.join(' ');
  }
  function fill(data){
    enabled.checked=data.email_enabled!==false;
    email.value=data.email_to||'noktena@mail.ru';
    messenger.value=['none','max','telegram','both'].includes(data.messenger)?data.messenger:'max';
    maxType.value=data.max_target_type==='user'?'user':'chat';
    maxTarget.value=data.max_target||'';
    telegramChat.value=data.telegram_chat||'';
    updateFields();status();
  }
  function values(){return {email_enabled:enabled.checked,email_to:email.value.trim(),messenger:messenger.value,max_target_type:maxType.value,max_target:maxTarget.value.trim(),telegram_chat:telegramChat.value.trim()}}
  function errorMessage(error){
    const names={BAD_NOTIFICATION_EMAIL:'Укажите один корректный адрес электронной почты.',BAD_MAX_TARGET:'Для MAX нужен числовой ID чата или пользователя.',BAD_TELEGRAM_CHAT:'Укажите ID чата Telegram или @имя канала.'};
    return names[error.message]||error.message;
  }
  function validate(data){
    if(data.email_enabled&&!/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(data.email_to))throw new Error('BAD_NOTIFICATION_EMAIL');
    if(selected('max')&&data.max_target&&!/^\d{1,20}$/.test(data.max_target))throw new Error('BAD_MAX_TARGET');
    if(selected('telegram')&&data.telegram_chat&&!/^(?:-?\d{1,20}|@[A-Za-z0-9_]{5,32})$/.test(data.telegram_chat))throw new Error('BAD_TELEGRAM_CHAT');
  }
  function message(value,isError=false){const target=$('#notificationResult');target.textContent=value;target.classList.toggle('is-error',isError)}
  async function load(){
    if(busy)return;
    test.disabled=true;save.disabled=true;message('Загружаем настройки…');
    try{
      const response=await request('notification-settings');
      readiness=response.readiness||{};fill(response.settings||{});loaded=true;message('Настройки загружены. Проверка отправки не создаёт заказ.');test.disabled=false;
    }catch(error){loaded=false;message(errorMessage(error),true)}finally{save.disabled=false}
  }
  form.addEventListener('change',()=>{updateFields();status();if(loaded){message('Сохраните изменения перед проверкой.');test.disabled=true}});
  form.addEventListener('input',()=>{if(loaded){message('Сохраните изменения перед проверкой.');test.disabled=true}});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    const data=values();try{validate(data)}catch(error){message(errorMessage(error),true);return}
    busy=true;save.disabled=true;test.disabled=true;message('Сохраняем…');
    try{
      const response=await request('notification-settings-save',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
      readiness=response.readiness||{};fill(response.settings||data);loaded=true;status();message('Настройки сохранены. Теперь отправьте проверку и убедитесь, что сообщение получено.');test.disabled=false;
    }catch(error){message(errorMessage(error),true)}finally{busy=false;save.disabled=false}
  });
  test.addEventListener('click',async()=>{
    if(busy||!loaded)return;
    busy=true;test.disabled=true;save.disabled=true;message('Отправляем проверку…');
    try{
      const response=await request('notification-test',{method:'POST'});
      const labels={email:'Почта',max:'MAX',telegram:'Telegram'};
      const results=Object.entries(response.results||{});
      const failed=results.filter(([,result])=>!result.sent);
      message(results.length?results.map(([channel,result])=>`${labels[channel]||channel}: ${result.sent?'отправлено':'ошибка — '+(result.reason||'проверьте подключение')}`).join(' · '):'Каналы отключены. Включите хотя бы один способ уведомления.',!!failed.length);
    }catch(error){message(errorMessage(error),true)}finally{busy=false;test.disabled=false;save.disabled=false}
  });
  window.NoktenaNotificationEditor={load};
})();
