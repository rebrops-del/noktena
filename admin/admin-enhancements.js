(()=>{
  'use strict';
  const API_URL='https://admin-proxy-v2-production.up.railway.app/api/noktena-admin';
  const BOOT_URL='https://admin-proxy-v2-production.up.railway.app/catalog-bootstrap.js';
  const DELIVERY_KEY='settings:delivery_v2';
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
    .admin-mattress-thumb{width:58px;height:46px;border-radius:8px;background-repeat:no-repeat;background-size:500% 100%;background-position:calc(var(--col) * 25%) 0;background-color:#eef3f0;flex:0 0 58px}
    .delivery-schedule-label{grid-column:1/-1}
    .delivery-schedule-label textarea{min-height:84px;resize:vertical}
  `;
  document.head.appendChild(style);

  function fixMattressThumbs(){
    document.querySelectorAll('#rows tr').forEach(row=>{
      const key=row.querySelector('.muted')?.textContent?.trim()||'';
      if(!key.startsWith('mattress:'))return;
      if(row.querySelector('img.thumb,.admin-mattress-thumb'))return;
      const model=key.slice('mattress:'.length),pos=PHOTO_POS[model];
      if(!pos)return;
      const blank=row.querySelector('.thumb');
      if(!blank)return;
      const el=document.createElement('div');
      el.className='admin-mattress-thumb';
      el.style.setProperty('--col',String(pos[0]));
      el.style.backgroundImage=`url('../assets/product-row-${pos[1]+1}.webp?v=20260905-photos2')`;
      blank.replaceWith(el);
    });
  }

  const rows=document.getElementById('rows');
  if(rows){
    new MutationObserver(fixMattressThumbs).observe(rows,{childList:true,subtree:true});
    fixMattressThumbs();
  }

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
})();
