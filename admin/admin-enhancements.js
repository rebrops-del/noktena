(()=>{
  'use strict';
  const API_URL='https://admin-proxy-v2-production.up.railway.app/api/noktena-admin';
  const BOOT_URL='https://admin-proxy-v2-production.up.railway.app/catalog-bootstrap.js';
  const DELIVERY_KEY='settings:delivery_v2';

  /* Products intentionally hidden from the public storefront must not clutter ADMIN. */
  const REMOVED_FROM_STOREFRONT=new Set([
    'Матрас Mega холкон TFK',
    'Матрас Mega холкон-кокос TFK',
    'Матрас MEGA Бикокос ППУ 10 ECO',
    'Матрас Стандарт Детский',
    'Подушка Обнимашки'
  ]);

  const DEFAULT_HIT_MODELS=new Set([
    'Матрас Mega холкон-кокос TFK Gray Night',
    'Матрас Mega кокос 30 TFK',
    'Матрас Imperial Suite холкон-кокос Gray Night',
    'Матрас Барселона ZAСоня Gray Night'
  ]);

  const BADGES={
    hit:'Хит продаж',
    sale:'Распродажа',
    last:'Последняя штука',
    new:'Новинка'
  };

  const PHOTO_POS={
    'Матрас Imperial Suite кокос Gray Night':[0,0],
    'Матрас Imperial Suite латекс-кокос Gray Night':[1,0],
    'Матрас Imperial Suite холкон-кокос Gray Night':[2,0],
    'Матрас MEGA MULT ELITE MultiPocket Gray Night':[3,0],
    'Матрас MEGA MULT ЗИМА ЛЕТО MultiPocket Gray Night':[4,0],
    'Матрас MEGA MULT кокос ППУ 20 MultiPocket Gray Night':[0,1],
    'Матрас MEGA Элит Блитц TFK Gray Night':[1,1],
    'Матрас Барселона ZAСоня Gray Night':[2,1],
    'Матрас Валенсия ZAСоня Gray Night':[3,1],
    'Матрас Ибица ZAСоня Gray Night':[4,1],
    'Матрас Касабланка ZAСоня Gray Night':[0,2],
    'Матрас Стандарт':[1,2],
    'Матрас Mega кокос 10 TFK Gray Night':[2,2],
    'Матрас Mega кокос 10 TFK':[3,2],
    'Матрас Mega кокос 20 TFK Gray Night':[4,2],
    'Матрас Mega кокос 20 TFK':[0,3],
    'Матрас Mega кокос 30 TFK Gray Night':[1,3],
    'Матрас Mega кокос 30 TFK':[2,3],
    'Матрас MEGA ППУ 10 ECO':[3,3],
    'Матрас Mega холкон TFK Gray Night':[4,3],
    'Матрас Mega холкон-кокос TFK Gray Night':[0,4],
    'Наматрасник "Непромокаемый чехол"':[1,4],
    'Подушка Память форма':[2,4],
    'Матрас ППУ 16 ZAСоня':[3,4],
    'Матрас Солид ZaСоня':[4,4]
  };

  const style=document.createElement('style');
  style.textContent=`
    .side>div:first-child{display:flex;flex-direction:column;align-items:flex-start;gap:14px;margin-bottom:12px}
    .side>div:first-child small{display:block;margin:0;padding-left:2px;font-size:12px;font-weight:800;letter-spacing:.14em;opacity:.82}
    .side>a{display:inline-block;margin-top:4px}
    .admin-mattress-thumb,.mattress-thumb-hi{width:96px!important;height:72px!important;border-radius:11px!important;object-fit:cover!important;background:#f4f6f5!important;box-shadow:0 2px 10px rgba(18,61,50,.08);border:1px solid rgba(18,61,50,.08);flex:0 0 96px!important;image-rendering:auto}
    .prod:has(.admin-mattress-thumb),.prod:has(.mattress-thumb-hi){gap:13px}
    .delivery-schedule-label{grid-column:1/-1}
    .delivery-schedule-label textarea{min-height:84px;resize:vertical}
    .admin-badge-pill{display:inline-flex;align-items:center;margin-left:6px;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:900;white-space:nowrap}
    .admin-badge-pill.hit{background:#fff0f1;color:#c82735}
    .admin-badge-pill.sale{background:#fff4dd;color:#9a6411}
    .admin-badge-pill.last{background:#fff0e8;color:#b14c24}
    .admin-badge-pill.new{background:#e9f7ef;color:#087345}
    #productBadge{font-weight:700}
  `;
  document.head.appendChild(style);

  function isPublicAdminItem(item){
    return !(item?._kind==='mattress'&&REMOVED_FROM_STOREFRONT.has(String(item.model||'')));
  }

  function defaultBadgeFor(item){
    if(!item)return '';
    if(item.hit===true)return 'hit';
    if(item._kind==='mattress'){
      if(DEFAULT_HIT_MODELS.has(String(item.model||'')))return 'hit';
      if(/^хит(ы)? продаж$/i.test(String(item.category||'').trim()))return 'hit';
    }
    return '';
  }

  function effectiveBadge(item){
    if(!item)return '';
    if(Object.prototype.hasOwnProperty.call(item,'badge'))return item.badge==='none'?'':String(item.badge||'');
    return defaultBadgeFor(item);
  }

  function ensureBadgeField(){
    const grid=document.querySelector('#editorForm .grid2');
    if(!grid||document.getElementById('productBadge'))return;
    const label=document.createElement('label');
    label.innerHTML='Плашка на карточке<select id="productBadge"><option value="">Без плашки</option><option value="hit">Хит продаж</option><option value="sale">Распродажа</option><option value="last">Последняя штука</option><option value="new">Новинка</option></select>';
    const available=document.getElementById('available')?.closest('label');
    if(available?.nextSibling)grid.insertBefore(label,available.nextSibling);else grid.appendChild(label);
    label.querySelector('select')?.addEventListener('change',event=>{
      if(typeof draft==='undefined'||!draft)return;
      draft.badge=event.target.value||'none';
    });
  }

  function syncBadgeField(){
    ensureBadgeField();
    const select=document.getElementById('productBadge');
    if(!select||typeof draft==='undefined'||!draft)return;
    select.value=effectiveBadge(draft);
  }

  function mattressThumbUrl(model){
    const pos=PHOTO_POS[model];
    if(!pos)return '';
    return `../assets/admin-mattress-thumbs/r${pos[1]+1}-c${pos[0]+1}.webp?v=20260921-1`;
  }

  function enhanceAdminRows(){
    document.querySelectorAll('#rows tr').forEach(row=>{
      const key=row.querySelector('.muted')?.textContent?.trim()||'';
      if(!key)return;
      let item=null;
      try{if(typeof items!=='undefined')item=items.find(x=>x._key===key)||null}catch{}

      if(key.startsWith('mattress:')){
        const model=key.slice('mattress:'.length);
        const existing=row.querySelector('img.thumb');
        if(existing){
          existing.classList.add('mattress-thumb-hi');
          existing.loading='lazy';
          existing.decoding='async';
        }else if(!row.querySelector('.admin-mattress-thumb')){
          const url=mattressThumbUrl(model),blank=row.querySelector('.thumb');
          if(url&&blank){
            const img=document.createElement('img');
            img.className='admin-mattress-thumb';
            img.src=url;
            img.alt=model;
            img.loading='lazy';
            img.decoding='async';
            img.addEventListener('error',()=>{
              const pos=PHOTO_POS[model];
              if(!pos)return;
              const fallback=document.createElement('div');
              fallback.className='admin-mattress-thumb';
              fallback.style.backgroundImage=`url('../assets/product-row-${pos[1]+1}.webp?v=20260905-photos2')`;
              fallback.style.backgroundRepeat='no-repeat';
              fallback.style.backgroundSize='500% 100%';
              fallback.style.backgroundPosition=`${pos[0]*25}% 0`;
              img.replaceWith(fallback);
            },{once:true});
            blank.replaceWith(img);
          }
        }
      }

      const badge=effectiveBadge(item);
      if(badge&&BADGES[badge]){
        const statusCell=row.children[3];
        if(statusCell&&!statusCell.querySelector('.admin-badge-pill')){
          const pill=document.createElement('span');
          pill.className=`admin-badge-pill ${badge}`;
          pill.textContent=BADGES[badge];
          statusCell.appendChild(pill);
        }
      }
    });
  }

  /* Keep ADMIN aligned with the public catalog. */
  try{
    const coreDraw=draw;
    draw=function(){
      items=items.filter(isPublicAdminItem);
      const result=coreDraw();
      enhanceAdminRows();
      return result;
    };
  }catch{}

  const rows=document.getElementById('rows');
  if(rows)new MutationObserver(enhanceAdminRows).observe(rows,{childList:true,subtree:true});

  const editor=document.getElementById('editor');
  ensureBadgeField();
  if(editor)new MutationObserver(()=>{if(!editor.classList.contains('hide'))syncBadgeField()}).observe(editor,{attributes:true,attributeFilter:['class']});

  document.getElementById('editorForm')?.addEventListener('submit',()=>{
    if(typeof draft==='undefined'||!draft)return;
    const select=document.getElementById('productBadge');
    if(select)draft.badge=select.value||'none';
  },true);

  function ensureDeliveryFields(){
    const grid=document.querySelector('#deliverySettingsForm .delivery-settings-grid');
    if(!grid)return;
    const cargo=document.getElementById('globalLiftPrice');
    if(cargo){
      const label=cargo.closest('label');
      if(label&&label.firstChild)label.firstChild.nodeValue='Подъём на грузовом лифте, ₽';
    }
    if(!document.getElementById('globalStairLiftPrice')){
      const label=document.createElement('label');
      label.innerHTML='Подъём по лестнице, ₽ / этаж<input id="globalStairLiftPrice" type="number" min="0" step="1">';
      const sofa=document.getElementById('globalSofaLiftSurcharge')?.closest('label');
      grid.insertBefore(label,sofa||null);
    }
    if(!document.getElementById('globalDeliverySchedule')){
      const label=document.createElement('label');
      label.className='delivery-schedule-label';
      label.innerHTML='График доставки<textarea id="globalDeliverySchedule" rows="3" placeholder="Например: Вторник / Пятница, 10:00–20:00"></textarea>';
      grid.appendChild(label);
    }
    const notice=document.querySelector('#deliverySettingsForm .notice');
    if(notice)notice.textContent='Подъём по лестнице указывается за один этаж. Для дивана дополнительная доплата прибавляется к выбранному способу подъёма. График доставки отображается на сайте.';
  }

  function getSession(){
    try{return JSON.parse(localStorage.getItem('nkt-adm2')||'null')}catch{return null}
  }
  async function api(action,options={}){
    const s=getSession(),headers={...(options.headers||{})};
    if(s?.access_token)headers.Authorization='Bearer '+s.access_token;
    const r=await fetch(API_URL+'?action='+encodeURIComponent(action),{...options,headers});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||'Ошибка сервера');
    return data;
  }
  async function loadBootstrap(){
    const text=await fetch(BOOT_URL+'?admin-delivery='+Date.now(),{cache:'no-store'}).then(r=>r.text());
    const marker='window.NOKTENA_CATALOG_BOOTSTRAP=';
    const p=text.indexOf(marker);
    if(p<0)return {};
    const json=text.slice(p+marker.length).trim().replace(/;+\s*$/,'');
    return JSON.parse(json);
  }
  function v2FromBootstrap(b){
    const row=(b.rows||[]).find(r=>r.product_key===DELIVERY_KEY);
    return row?.payload||null;
  }
  function fillV2(d){
    document.getElementById('globalDeliveryPrice').value=Number(d.delivery_price)||0;
    document.getElementById('globalLiftPrice').value=Number(d.cargo_lift_price??d.lift_price)||0;
    document.getElementById('globalStairLiftPrice').value=Number(d.stair_lift_price)||0;
    document.getElementById('globalSofaLiftSurcharge').value=Number(d.sofa_lift_surcharge)||0;
    document.getElementById('globalFreeDeliveryFrom').value=Number(d.free_delivery_from)||0;
    document.getElementById('globalDeliverySchedule').value=String(d.delivery_schedule||'');
  }

  ensureDeliveryFields();

  const openBtn=document.getElementById('deliverySettingsOpen');
  openBtn?.addEventListener('click',async event=>{
    event.preventDefault();
    event.stopImmediatePropagation();
    ensureDeliveryFields();
    try{
      const [legacy,b]=await Promise.all([api('delivery-settings'),loadBootstrap()]);
      const old=legacy.settings||{};
      const d=v2FromBootstrap(b)||{
        delivery_price:old.delivery_price||0,
        cargo_lift_price:old.lift_price||0,
        stair_lift_price:300,
        sofa_lift_surcharge:old.sofa_lift_surcharge||0,
        free_delivery_from:old.free_delivery_from||0,
        delivery_schedule:'Вторник / Пятница'
      };
      fillV2(d);
      document.getElementById('deliverySettingsModal').classList.remove('hide');
    }catch(error){
      if(typeof toast==='function')toast(error.message,true);else alert(error.message);
    }
  },true);

  const form=document.getElementById('deliverySettingsForm');
  form?.addEventListener('submit',async event=>{
    event.preventDefault();
    event.stopImmediatePropagation();
    const payload={
      deliveryV2:true,
      delivery_price:Math.max(0,Number(document.getElementById('globalDeliveryPrice').value)||0),
      cargo_lift_price:Math.max(0,Number(document.getElementById('globalLiftPrice').value)||0),
      stair_lift_price:Math.max(0,Number(document.getElementById('globalStairLiftPrice').value)||0),
      sofa_lift_surcharge:Math.max(0,Number(document.getElementById('globalSofaLiftSurcharge').value)||0),
      free_delivery_from:Math.max(0,Number(document.getElementById('globalFreeDeliveryFrom').value)||0),
      delivery_schedule:String(document.getElementById('globalDeliverySchedule').value||'').trim(),
      model:'__delivery_v2__'
    };
    const submit=form.querySelector('button[type="submit"]');
    if(submit)submit.disabled=true;
    try{
      await api('delivery-settings-save',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
        delivery_price:payload.delivery_price,
        lift_price:payload.cargo_lift_price,
        sofa_lift_surcharge:payload.sofa_lift_surcharge,
        free_delivery_from:payload.free_delivery_from
      })});
      await api('save',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
        key:DELIVERY_KEY,kind:'mattress',item:payload,hidden:false,is_custom:false
      })});
      document.getElementById('deliverySettingsModal').classList.add('hide');
      if(typeof toast==='function')toast('Настройки доставки и график сохранены');
    }catch(error){
      if(typeof toast==='function')toast(error.message,true);else alert(error.message);
    }finally{if(submit)submit.disabled=false}
  },true);

  enhanceAdminRows();
})();