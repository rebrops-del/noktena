(()=>{
  'use strict';
  const API='https://admin-proxy-v2-production.up.railway.app/api/noktena-admin';
  const KEY='settings:delivery_v2';
  const $=s=>document.querySelector(s);
  function session(){try{return JSON.parse(localStorage.getItem('nkt-adm2')||'null')}catch{return null}}
  async function api(action,options={}){const headers={...(options.headers||{})},s=session();if(s?.access_token)headers.Authorization='Bearer '+s.access_token;const r=await fetch(API+'?action='+encodeURIComponent(action),{...options,headers});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Ошибка сервера');return d}
  function ensure(){const grid=$('#deliverySettingsForm .delivery-settings-grid');if(!grid||$('#globalBedAssemblyPrice'))return;const label=document.createElement('label');label.innerHTML='Сборка кровати, ₽ / кровать<input id="globalBedAssemblyPrice" type="number" min="0" step="1" value="1500">';const schedule=$('#globalDeliverySchedule')?.closest('label');if(schedule)grid.insertBefore(label,schedule);else grid.appendChild(label);const notice=$('#deliverySettingsForm .notice');if(notice)notice.textContent='Подъём по лестнице указывается за один этаж. Доплата за диван прибавляется к выбранному способу подъёма. Сборка кровати рассчитывается за каждую кровать в заказе.'}
  function renderCity(deliverySettings){
    if(deliverySettings){const value=Number(deliverySettings.bed_assembly_price);$('#globalBedAssemblyPrice').value=Number.isFinite(value)&&value>=0?value:1500}
    const manager=window.NoktenaCityAdmin,select=$('#deliveryCitySelect');if(!manager||!select)return;
    const current=manager.currentCity(),id=current?.id||'ekaterinburg';
    select.replaceChildren();
    for(const city of manager.cities()){
      const option=document.createElement('option');option.value=city.id;option.textContent=city.name;select.append(option);
    }
    select.value=id;
    const regional=id!=='ekaterinburg';
    $('#deliveryGlobalFields').hidden=regional;
    $('#deliveryRegionalFields').hidden=!regional;
    $('#regionalDeliveryPrice').value=regional?current.delivery_price??'':'';
  }
  $('#deliveryCitySelect')?.addEventListener('change',event=>{
    window.NoktenaCityAdmin?.selectCity(event.target.value);
    renderCity();
  });
  window.NoktenaAdminDeliveryUi=Object.freeze({render:renderCity});
  ensure();const modal=$('#deliverySettingsModal');
  $('#deliverySettingsForm')?.addEventListener('submit',async event=>{
    event.preventDefault();event.stopImmediatePropagation();ensure();const submit=event.currentTarget.querySelector('button[type="submit"]');if(submit)submit.disabled=true;
    const cityId=$('#deliveryCitySelect').value;
    if(cityId!=='ekaterinburg'){
      try{
        await window.NoktenaCityAdmin.saveDeliveryPrice(cityId,$('#regionalDeliveryPrice').value);
        modal.classList.add('hide');
      }catch(error){if(typeof toast==='function')toast(error.message,true);else alert(error.message)}
      finally{if(submit)submit.disabled=false}
      return;
    }
    const payload={deliveryV2:true,delivery_price:Math.max(0,Number($('#globalDeliveryPrice').value)||0),cargo_lift_price:Math.max(0,Number($('#globalLiftPrice').value)||0),stair_lift_price:Math.max(0,Number($('#globalStairLiftPrice').value)||0),sofa_lift_surcharge:Math.max(0,Number($('#globalSofaLiftSurcharge').value)||0),free_delivery_from:Math.max(0,Number($('#globalFreeDeliveryFrom').value)||0),delivery_schedule:String($('#globalDeliverySchedule').value||'').trim(),bed_assembly_price:Math.max(0,Number($('#globalBedAssemblyPrice').value)||0),model:'__delivery_v2__'};
    try{await api('delivery-settings-save',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({delivery_price:payload.delivery_price,lift_price:payload.cargo_lift_price,sofa_lift_surcharge:payload.sofa_lift_surcharge,free_delivery_from:payload.free_delivery_from})});await api('save',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key:KEY,kind:'mattress',item:payload,hidden:false,is_custom:false})});modal.classList.add('hide');if(typeof toast==='function')toast('Доставка, подъём и сборка сохранены')}catch(e){if(typeof toast==='function')toast(e.message,true);else alert(e.message)}finally{if(submit)submit.disabled=false}
  },true);
})();
