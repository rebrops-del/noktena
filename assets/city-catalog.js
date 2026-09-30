(()=>{
  'use strict';
  const core=window.NoktenaCityCatalogCore;
  if(!core)return;
  const settings=core.fromBootstrap(window.NOKTENA_CATALOG_BOOTSTRAP);
  const STORAGE_KEY='noktena-selected-city-v1';
  const requested=new URLSearchParams(location.search).get('city');
  let saved='';try{saved=localStorage.getItem(STORAGE_KEY)||''}catch{}
  const selected=settings.cities.find(city=>city.id===(requested||saved))||settings.cities[0];
  try{localStorage.setItem(STORAGE_KEY,selected.id)}catch{}
  const current=()=>selected;
  const apply=(items,kind)=>core.applyCatalog(items,kind,settings,selected.id);
  function change(id){
    if(!settings.cities.some(city=>city.id===id)||id===selected.id)return;
    try{localStorage.setItem(STORAGE_KEY,id)}catch{}
    if(location.pathname.endsWith('/product.html')||location.pathname.endsWith('/checkout.html')){location.href='/?city='+encodeURIComponent(id);return}
    const url=new URL(location.href);url.searchParams.set('city',id);location.href=url.href;
  }
  function chooseButton(city){
    const button=document.createElement('button');button.type='button';button.className='city-choose';button.dataset.cityId=city.id;
    button.setAttribute('aria-current',city.id===selected.id?'true':'false');
    const label=document.createElement('span');label.textContent=city.name;button.append(label);
    if(city.id===selected.id){const mark=document.createElement('b');mark.textContent='✓';button.append(mark)}
    return button;
  }
  function renderPicker(){
    const header=document.querySelector('.top-city');
    if(header){
      const summary=header.querySelector('summary'),panel=header.querySelector(':scope > div');
      if(summary)summary.textContent='Ваш город: '+selected.name+' ⌄';
      if(panel){panel.replaceChildren();const heading=document.createElement('strong');heading.textContent='Выберите город';panel.append(heading,...settings.cities.map(chooseButton));const hint=document.createElement('small');hint.textContent='Ассортимент зависит от выбранного города.';panel.append(hint)}
    }
    const productPicker=document.querySelector('.city-picker');
    if(productPicker){
      const label=productPicker.querySelector('summary span:nth-child(2)'),panel=productPicker.querySelector('.city-popover');
      if(label)label.textContent='г. '+selected.name;
      if(panel){panel.replaceChildren();const title=document.createElement('span');title.className='city-popover-title';title.textContent='Ваш город';panel.append(title,...settings.cities.map(chooseButton));const hint=document.createElement('small');hint.textContent='На сайте показаны товары выбранного города.';panel.append(hint)}
    }
    document.addEventListener('click',event=>{const button=event.target.closest('[data-city-id]');if(button)change(button.dataset.cityId)});
  }
  function text(selector,value){const el=document.querySelector(selector);if(el)el.textContent=value}
  function renderRegion(){
    renderPicker();
    const about=document.querySelector('.networkbox > div > p');
    const contactLinks=[...(about?.querySelectorAll?.('a')||[])].map(link=>link.cloneNode(true));
    text('.mobile-location','Ваш город · '+selected.name);
    text('.nav-contact span',selected.name+' · онлайн-магазин');
    const cityInput=document.querySelector('#orderCity');if(cityInput){cityInput.value=selected.name;cityInput.readOnly=true}
    const regional=selected.id!=='ekaterinburg';
    if(regional){
      text('.hero-copy .eyebrow','НОКТЕНА · '+selected.name.toUpperCase());
      text('.hero-copy p','Матрасы, кровати и диваны для комфортного сна. Выберите модель из каталога вашего города, а условия доставки подтвердит менеджер.');
      text('.hero-assurance span:last-child','Каталог для '+selected.name);
      text('.delivery-lead','Условия доставки для города '+selected.name+' подтвердит менеджер при оформлении заказа.');
      text('.deliverybox .dgrid .d:first-child small',selected.delivery_price==null?'Стоимость и сроки уточнит менеджер':'Доставка по городу '+selected.name);
      text('.deliverybox .dgrid .d:first-child b',selected.delivery_price==null?'Уточняется':selected.delivery_price===0?'Бесплатно':Number(selected.delivery_price).toLocaleString('ru-RU')+' ₽');
      text('.deliverybox .dgrid .d:nth-child(5) b',selected.delivery_settings?.delivery_schedule||'Уточняется');
      text('#homeService .service-layout p','Подберём размер, комплектацию и условия доставки для города '+selected.name+'.');
      text('.networkbox > div > p','Выберите товары вашего города и отправьте заказ. Менеджер подтвердит наличие, комплектацию и условия доставки.');
      text('.networkfacts .fact:nth-child(2) span','г. '+selected.name);
      text('.networkfacts .fact:nth-child(3) span',selected.warehouse?'г. '+selected.warehouse:'Уточняется при заказе');
      text('.premium-footer > div:first-child > span',selected.name+(selected.warehouse?' · склад: '+selected.warehouse:''));
      text('.pd-service-item:first-child b',selected.warehouse?'Склад: г. '+selected.warehouse:'Наличие уточнит менеджер');
      text('.pd-service-item:nth-child(2) b','Доставка по г. '+selected.name);
      text('.pd-service-item:nth-child(2) span',selected.delivery_price==null?'Стоимость и сроки уточнит менеджер':selected.delivery_price===0?'Бесплатно':'Стоимость: '+Number(selected.delivery_price).toLocaleString('ru-RU')+' ₽');
      text('.site-top-warehouse',selected.warehouse?'склад: г. '+selected.warehouse:'наличие уточняется');
      const footer=document.querySelector('.pd-footer span');if(footer){const privacy=footer.querySelector('a');footer.replaceChildren(document.createTextNode(selected.name+(selected.warehouse?' · склад: г. '+selected.warehouse:'')+' · '));if(privacy)footer.append(privacy)}
      text('.checkout-intro .overline','ВАШ ЗАКАЗ · '+selected.name.toUpperCase());
      const pickup=document.querySelector('input[name="deliveryMethod"][value="pickup"]');if(pickup){pickup.closest('label').hidden=!selected.warehouse;if(!selected.warehouse&&pickup.checked){const delivery=document.querySelector('input[name="deliveryMethod"][value="delivery"]');if(delivery)delivery.checked=true}}
      const pickupLabel=document.querySelector('input[name="deliveryMethod"][value="pickup"] ~ span small');if(pickupLabel&&selected.warehouse)pickupLabel.textContent='Со склада в г. '+selected.warehouse+' — бесплатно';
    }
    for(const [field,selector] of [['hero_description','.hero-copy p'],['delivery_description','.delivery-lead'],['service_description','#homeService .service-layout p'],['about_description','.networkbox > div > p']]){
      if(selected[field])text(selector,selected[field]);
    }
    if(about&&(regional||selected.about_description)&&contactLinks.length){
      about.append(document.createTextNode(' Связаться с нами: '));
      contactLinks.forEach((link,index)=>{if(index)about.append(document.createTextNode(' · '));about.append(link)});
    }
    if(regional){
      if(document.title.includes('Екатеринбург'))document.title=document.title.replace(/Екатеринбург[еа]?/g,selected.name);
      for(const meta of document.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]')){
        const old=meta.content;if(old.includes('Екатеринбург'))meta.content=old.replace(/Екатеринбург[еа]?/g,selected.name);
      }
      for(const script of document.querySelectorAll('script[type="application/ld+json"]')){
        try{const data=JSON.parse(script.textContent);if(data['@type']==='Store'&&data.areaServed){data.areaServed={'@type':'City',name:selected.name};script.textContent=JSON.stringify(data)}}catch{}
      }
    }
    if(document.querySelector('.hero-copy')){
      const title=selected.seo_title||(regional?`Матрасы, кровати и диваны — НОКТЕНА, г. ${selected.name}`:'');
      const description=selected.seo_description||(regional?`Матрасы, кровати и диваны в г. ${selected.name}. Подбор размера, заказ онлайн и доставка. Условия подтвердит менеджер.`:'');
      if(title){document.title=title;for(const meta of document.querySelectorAll('meta[property="og:title"],meta[name="twitter:title"]'))meta.content=title}
      if(description)for(const meta of document.querySelectorAll('meta[name="description"],meta[property="og:description"],meta[name="twitter:description"]'))meta.content=description;
    }
  }
  window.NoktenaCities=Object.freeze({settings,current,id:()=>selected.id,change,apply});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',renderRegion);else renderRegion();
})();
