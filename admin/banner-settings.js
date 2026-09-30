(() => {
  'use strict';
  const config=window.NoktenaHomeBanners;
  if(!config)return;
  const escape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function init(pane){
    const list=pane.querySelector('#siteBannersList');
    const form=pane.querySelector('#siteBannersForm');
    const add=pane.querySelector('#siteBannerAdd');
    const save=pane.querySelector('#siteBannersSave');
    const status=pane.querySelector('#siteBannersStatus');
    let draft=[],busy=false;
    save.disabled=true;
    function render(){
      list.innerHTML=draft.length?draft.map((banner,index)=>{
        const preview=config.validImage(banner.image);
        return `<article class="site-banner-card" data-banner-id="${escape(banner.id)}">
          <div class="site-banner-card-head"><div><span>БАННЕР ${index+1}</span><strong>${escape(banner.title||'Новое предложение')}</strong></div><div class="site-banner-card-actions"><button type="button" class="btn secondary" data-banner-action="up" ${index===0?'disabled':''} aria-label="Поднять баннер ${index+1}">↑</button><button type="button" class="btn secondary" data-banner-action="down" ${index===draft.length-1?'disabled':''} aria-label="Опустить баннер ${index+1}">↓</button><button type="button" class="btn secondary" data-banner-action="remove" aria-label="Удалить баннер ${index+1}">Удалить</button></div></div>
          <div class="site-banner-card-body"><div class="site-banner-fields">
            <label class="site-banner-active"><input type="checkbox" data-field="enabled" ${banner.enabled?'checked':''}> Показывать на сайте</label>
            <label>Надпись над заголовком<input data-field="label" maxlength="60" value="${escape(banner.label)}" placeholder="СПЕЦИАЛЬНОЕ ПРЕДЛОЖЕНИЕ"></label>
            <label>Заголовок *<input data-field="title" maxlength="100" value="${escape(banner.title)}" placeholder="Например, Всё для уютной спальни"></label>
            <label>Описание<textarea data-field="description" maxlength="240" rows="3" placeholder="Коротко расскажите об акции или подборке">${escape(banner.description)}</textarea></label>
            <div class="site-banner-inline"><label>Текст кнопки<input data-field="button" maxlength="50" value="${escape(banner.button)}" placeholder="Смотреть товары"></label><label>Ссылка кнопки<input data-field="link" maxlength="1000" value="${escape(banner.link)}" placeholder="#beds или https://…"></label></div>
          </div><div class="site-banner-media">
            <div class="site-banner-preview">${preview?`<img src="${escape(preview)}" alt="Предпросмотр баннера">`:'<span>Добавьте изображение для баннера</span>'}</div>
            <label class="site-banner-upload btn secondary">Загрузить картинку<input type="file" data-banner-file accept="image/jpeg,image/png,image/webp"></label>
            <small>JPEG, PNG или WebP до 12 МБ. Лучше горизонтальное фото от 1200 × 700 пикселей.</small>
            <label>Или ссылка на картинку<input data-field="image" maxlength="1000" value="${escape(banner.image)}" placeholder="https://…/image.webp"></label>
            <label>Описание картинки<input data-field="alt" maxlength="160" value="${escape(banner.alt)}" placeholder="Кровать в светлой спальне"></label>
          </div></div></article>`;
      }).join(''):'<p class="site-banners-empty">Баннеров пока нет. Нажмите «Добавить баннер», чтобы создать первый.</p>';
      add.disabled=busy||draft.length>=8;
      save.disabled=busy;
    }
    function fill(payload){
      draft=config.fromPayload(payload).map((banner,index)=>({...banner,id:banner.id||`banner-${index}`}));
      status.textContent='';render();
    }
    add.addEventListener('click',()=>{
      if(busy||draft.length>=8)return;
      draft.push({id:`banner-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,label:'',title:'',description:'',button:'',link:'',image:'',alt:'',enabled:true});
      render();list.lastElementChild?.querySelector('[data-field="title"]')?.focus();
      status.textContent='Заполните баннер и нажмите «Сохранить баннеры».';
    });
    list.addEventListener('input',event=>{
      const field=event.target.dataset.field;
      const banner=draft.find(item=>item.id===event.target.closest('[data-banner-id]')?.dataset.bannerId);
      if(!field||!banner)return;
      banner[field]=field==='enabled'?event.target.checked:event.target.value;
      if(field==='title')event.target.closest('.site-banner-card').querySelector('.site-banner-card-head strong').textContent=banner.title||'Новое предложение';
      if(field==='image'){
        const preview=event.target.closest('.site-banner-card').querySelector('.site-banner-preview');
        const image=config.validImage(banner.image);
        preview.replaceChildren();
        if(image){const img=document.createElement('img');img.src=image;img.alt='Предпросмотр баннера';preview.append(img)}
        else preview.textContent='Добавьте изображение для баннера';
      }
    });
    list.addEventListener('change',event=>{
      if(event.target.dataset.field==='enabled')event.target.dispatchEvent(new Event('input',{bubbles:true}));
    });
    list.addEventListener('click',event=>{
      const action=event.target.closest('[data-banner-action]')?.dataset.bannerAction;
      if(!action||busy)return;
      const id=event.target.closest('[data-banner-id]')?.dataset.bannerId;
      const index=draft.findIndex(item=>item.id===id);
      if(index<0)return;
      if(action==='remove')draft.splice(index,1);
      if(action==='up'&&index>0)[draft[index-1],draft[index]]=[draft[index],draft[index-1]];
      if(action==='down'&&index<draft.length-1)[draft[index+1],draft[index]]=[draft[index],draft[index+1]];
      render();status.textContent='Порядок и изменения вступят в силу после сохранения.';
    });
    list.addEventListener('error',event=>{
      if(event.target.matches('.site-banner-preview img'))event.target.closest('.site-banner-preview').textContent='Картинка не открылась. Проверьте ссылку.';
    },true);
    list.addEventListener('change',async event=>{
      if(!event.target.matches('[data-banner-file]'))return;
      const input=event.target,file=input.files?.[0];
      if(!file||busy)return;
      if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>12*1024*1024){toast('Выберите JPEG, PNG или WebP до 12 МБ',true);input.value='';return}
      const id=input.closest('[data-banner-id]').dataset.bannerId;
      busy=true;render();status.textContent='Загружаем картинку…';
      try{
        const body=new FormData();body.append('file',file);body.append('product_key','homepage-banner-image');
        const uploaded=await request('upload',{method:'POST',body});
        const url=config.validImage(uploaded.url);
        if(!url||!url.startsWith('https://'))throw new Error('Сервер вернул неверную ссылку на картинку');
        const banner=draft.find(item=>item.id===id);
        if(banner){banner.image=url;banner.alt||=banner.title;status.textContent='Картинка загружена. Сохраните баннеры, чтобы показать её на сайте.'}
      }catch(error){status.textContent='Не удалось загрузить картинку';toast(error.message,true)}
      finally{busy=false;render()}
    });
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(busy)return;
      for(const [index,banner] of draft.entries()){
        const number=index+1;
        if(!banner.title.trim()){toast(`Баннер ${number}: укажите заголовок`,true);return}
        if(!!banner.button.trim()!==!!banner.link.trim()||banner.link&&!config.validLink(banner.link)){toast(`Баннер ${number}: укажите текст кнопки и корректную ссылку (#раздел, /страница или HTTPS)`,true);return}
        if(banner.image&&!config.validImage(banner.image)){toast(`Баннер ${number}: укажите ссылку на картинку HTTPS`,true);return}
      }
      busy=true;save.disabled=true;add.disabled=true;status.textContent='Сохраняем баннеры…';
      try{
        const banners=draft.map(config.normalise);
        await request('save',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key:config.KEY,kind:'mattress',item:{model:'__home_banners_v1__',banners},hidden:false,is_custom:false})});
        status.textContent='Баннеры сохранены. Обновите главную страницу, чтобы увидеть результат.';
        toast('Баннеры на главной сохранены');
      }catch(error){status.textContent='Не удалось сохранить баннеры';toast(error.message,true)}
      finally{busy=false;render()}
    });
    return {fill};
  }
  window.NoktenaBannerEditor={init};
})();
