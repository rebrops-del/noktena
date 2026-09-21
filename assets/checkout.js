(()=>{
  'use strict';
  const API='https://admin-proxy-v2-production.up.railway.app/api/noktena-admin';
  const $=s=>document.querySelector(s);
  const cart=()=>window.NoktenaCart;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>cart()?.money(n)||`${Math.round(Number(n)||0).toLocaleString('ru-RU')} ₽`;
  const serviceState=new Map();

  function items(){return cart()?.load()||[]}
  function settings(){return cart()?.settings()||{delivery_price:0,cargo_lift_price:0,stair_lift_price:0,sofa_lift_surcharge:0,free_delivery_from:0,delivery_schedule:'',bed_assembly_price:1500}}
  function bedQty(){return items().filter(x=>x.category==='beds').reduce((n,x)=>n+(Number(x.qty)||1),0)}
  function subtotal(){return items().reduce((n,x)=>n+(Number(x.price)||0)*(Number(x.qty)||1),0)}
  function selected(name){return document.querySelector(`input[name="${name}"]:checked`)?.value||''}
  function itemKey(x){return [x.kind,x.key,x.size||'',x.color||'',Number(x.price)||0].join('|')}
  function serviceFor(x){
    const key=itemKey(x),max=Math.max(1,Number(x.qty)||1);
    let state=serviceState.get(key);
    if(!state){state={method:'none',qty:max,floor:1};serviceState.set(key,state)}
    state.qty=Math.max(1,Math.min(max,Number(state.qty)||max));
    state.floor=Math.max(1,Math.min(50,Number(state.floor)||1));
    if(!['none','cargo','stairs'].includes(state.method))state.method='none';
    return state;
  }
  function cleanServiceState(){const valid=new Set(items().map(itemKey));for(const key of serviceState.keys())if(!valid.has(key))serviceState.delete(key)}
  function itemLiftCost(x,state,s,deliveryMethod){
    if(deliveryMethod!=='delivery'||!state||state.method==='none')return 0;
    const qty=Math.max(1,Math.min(Number(x.qty)||1,Number(state.qty)||1));
    let cost=0;
    if(state.method==='cargo')cost=s.cargo_lift_price*qty;
    if(state.method==='stairs')cost=s.stair_lift_price*Math.max(1,Number(state.floor)||1)*qty;
    if(x.category==='sofas')cost+=s.sofa_lift_surcharge*qty;
    return cost;
  }
  function liftTotals(){
    const s=settings(),deliveryMethod=selected('deliveryMethod')||'delivery';let total=0,count=0;
    const details=items().map(x=>{const st=serviceFor(x),qty=st.method==='none'||deliveryMethod!=='delivery'?0:Math.max(1,Math.min(Number(x.qty)||1,Number(st.qty)||1)),cost=itemLiftCost(x,st,s,deliveryMethod);total+=cost;count+=qty;return{key:itemKey(x),method:st.method,qty,floor:st.floor,cost}});
    return{total,count,details};
  }
  function assemblyQty(){
    const beds=bedQty();if(!beds||!$('#orderAssembly')?.checked)return 0;
    return Math.max(1,Math.min(beds,Number($('#assemblyQty')?.value)||beds));
  }
  function costs(){
    const s=settings(),sub=subtotal(),deliveryMethod=selected('deliveryMethod')||'delivery';
    let delivery=deliveryMethod==='pickup'?0:s.delivery_price;
    if(deliveryMethod==='delivery'&&s.free_delivery_from>0&&sub>=s.free_delivery_from)delivery=0;
    const lifts=liftTotals(),aQty=assemblyQty(),assembly=aQty*s.bed_assembly_price;
    return{sub,delivery,lift:lifts.total,liftCount:lifts.count,assembly,assemblyQty:aQty,total:sub+delivery+lifts.total+assembly};
  }
  function serviceDescription(x,state,s){
    if(state.method==='none')return 'Подъём не выбран';
    const q=Math.max(1,Math.min(Number(x.qty)||1,Number(state.qty)||1));
    if(state.method==='cargo')return `${money(s.cargo_lift_price)} × ${q}${x.category==='sofas'&&s.sofa_lift_surcharge?` + доплата за диван ${money(s.sofa_lift_surcharge)} × ${q}`:''}`;
    return `${money(s.stair_lift_price)} × ${Math.max(1,Number(state.floor)||1)} эт. × ${q}${x.category==='sofas'&&s.sofa_lift_surcharge?` + доплата за диван ${money(s.sofa_lift_surcharge)} × ${q}`:''}`;
  }
  function serviceMarkup(x,i){
    const s=settings(),state=serviceFor(x),qty=Math.max(1,Number(x.qty)||1),cost=itemLiftCost(x,state,s,selected('deliveryMethod')||'delivery');
    const qtyOptions=Array.from({length:qty},(_,n)=>n+1).map(n=>`<option value="${n}" ${n===state.qty?'selected':''}>${n} ${n===1?'единица':n<5?'единицы':'единиц'}</option>`).join('');
    return `<div class="checkout-item-service" data-service-row="${i}">
      <div class="checkout-service-head"><div><b>Подъём этого товара</b><small>Можно настроить отдельно от остальных позиций</small></div><strong data-service-cost="${i}">${cost?money(cost):'0 ₽'}</strong></div>
      <div class="checkout-service-fields">
        <label>Способ<select data-lift-method="${i}"><option value="none" ${state.method==='none'?'selected':''}>Без подъёма</option><option value="cargo" ${state.method==='cargo'?'selected':''}>Грузовой лифт</option><option value="stairs" ${state.method==='stairs'?'selected':''}>По лестнице</option></select></label>
        <label data-lift-qty-wrap="${i}" class="${state.method==='none'?'hide':''}">Сколько поднимать<select data-lift-qty="${i}">${qtyOptions}</select></label>
        <label data-lift-floor-wrap="${i}" class="${state.method==='stairs'?'':'hide'}">Этаж<input data-lift-floor="${i}" type="number" min="1" max="50" value="${state.floor}"></label>
      </div>
      <div class="checkout-service-calc" data-service-calc="${i}">${esc(serviceDescription(x,state,s))}</div>
    </div>`;
  }
  function renderItems(){
    cleanServiceState();const list=items(),mount=$('#checkoutItems'),empty=$('#checkoutEmpty'),right=$('#checkoutRight');if(!mount)return;
    if(!list.length){mount.innerHTML='';empty?.classList.remove('hide');right?.classList.add('hide');return}
    empty?.classList.add('hide');right?.classList.remove('hide');
    mount.innerHTML=list.map((x,i)=>`<div class="checkout-item"><div class="checkout-item-main"><div><div class="checkout-item-title">${esc(x.name)}</div><div class="checkout-item-meta">${x.size?`Размер: ${esc(x.size)}`:''}${x.size&&x.color?' · ':''}${x.color?`Цвет: ${esc(x.color)}`:''}</div><button type="button" class="checkout-remove" data-remove="${i}">Удалить</button></div><div class="checkout-item-price"><div>${money((Number(x.price)||0)*(Number(x.qty)||1))}</div><div class="checkout-qty"><button type="button" data-qty="${i}" data-delta="-1">−</button><span>${Number(x.qty)||1}</span><button type="button" data-qty="${i}" data-delta="1">+</button></div></div></div>${serviceMarkup(x,i)}</div>`).join('');
    renderAssembly();updateConditional();
  }
  function renderAssembly(){
    const beds=bedQty(),block=$('#assemblyBlock'),row=$('#sumAssemblyRow'),s=settings();
    if(!beds){block?.classList.add('hide');row?.classList.add('hide');if($('#orderAssembly'))$('#orderAssembly').checked=false;return}
    block?.classList.remove('hide');row?.classList.remove('hide');
    if($('#assemblyOptionText'))$('#assemblyOptionText').textContent=`${money(s.bed_assembly_price)} за 1 кровать · в корзине: ${beds}`;
    const select=$('#assemblyQty');if(select){const current=Math.max(1,Math.min(beds,Number(select.value)||beds));select.innerHTML=Array.from({length:beds},(_,i)=>i+1).map(n=>`<option value="${n}" ${n===current?'selected':''}>${n}</option>`).join('')}
    $('#assemblyQtyLabel')?.classList.toggle('hide',!$('#orderAssembly')?.checked);
  }
  function updateServiceLabels(){
    const s=settings();$('#deliveryOptionText').textContent=s.free_delivery_from>0?`${money(s.delivery_price)} · бесплатно от ${money(s.free_delivery_from)}`:money(s.delivery_price);
    const sch=$('#deliverySchedule');if(s.delivery_schedule){sch.textContent=`График доставки: ${s.delivery_schedule}`;sch.classList.remove('hide')}else sch.classList.add('hide')
  }
  function updateServiceRow(i){
    const x=items()[i];if(!x)return;const state=serviceFor(x),s=settings(),delivery=selected('deliveryMethod')==='delivery';
    document.querySelector(`[data-lift-qty-wrap="${i}"]`)?.classList.toggle('hide',state.method==='none');
    document.querySelector(`[data-lift-floor-wrap="${i}"]`)?.classList.toggle('hide',state.method!=='stairs');
    const cost=itemLiftCost(x,state,s,delivery?'delivery':'pickup');const costEl=document.querySelector(`[data-service-cost="${i}"]`);if(costEl)costEl.textContent=cost?money(cost):'0 ₽';
    const calc=document.querySelector(`[data-service-calc="${i}"]`);if(calc)calc.textContent=delivery?serviceDescription(x,state,s):'При самовывозе подъём не рассчитывается';
  }
  function updateConditional(){
    const delivery=selected('deliveryMethod')==='delivery';$('#addressLabel')?.classList.toggle('hide',!delivery);$('#liftHelp')?.classList.toggle('hide',!delivery);
    document.querySelectorAll('.checkout-item-service').forEach(el=>el.classList.toggle('hide',!delivery));
    items().forEach((_,i)=>updateServiceRow(i));renderAssembly();updateSummary();
  }
  function updateSummary(){
    const c=costs();$('#sumProducts').textContent=money(c.sub);$('#sumDelivery').textContent=c.delivery?money(c.delivery):'Бесплатно';
    const liftRow=$('#sumLiftRow');liftRow?.classList.toggle('hide',c.liftCount===0);if($('#sumLift'))$('#sumLift').textContent=c.lift?money(c.lift):'0 ₽';if($('#sumLiftLabel'))$('#sumLiftLabel').textContent=c.liftCount?`Подъём (${c.liftCount} ед.)`:'Подъём';
    const beds=bedQty();$('#sumAssemblyRow')?.classList.toggle('hide',beds===0);if($('#sumAssembly'))$('#sumAssembly').textContent=c.assembly?money(c.assembly):'0 ₽';if($('#sumAssemblyLabel'))$('#sumAssemblyLabel').textContent=c.assemblyQty?`Сборка (${c.assemblyQty} ${c.assemblyQty===1?'кровать':'кровати'})`:'Сборка кровати';
    $('#sumTotal').textContent=money(c.total);
  }
  function orderItems(){return items().map(x=>{const st=serviceFor(x);return{kind:x.kind,category:x.category,key:x.key,name:x.name,size:x.size||'',color:x.color||'',price:Number(x.price)||0,qty:Number(x.qty)||1,url:x.url||'',lift_method:st.method,lift_qty:st.method==='none'?0:Math.max(1,Math.min(Number(x.qty)||1,Number(st.qty)||1)),lift_floor:st.method==='stairs'?Math.max(1,Number(st.floor)||1):0}})}
  async function submit(e){
    e.preventDefault();const list=items();if(!list.length)return;const deliveryMethod=selected('deliveryMethod')||'delivery';const address=$('#orderAddress').value.trim();if(deliveryMethod==='delivery'&&!address){$('#orderAddress').focus();return alert('Укажите адрес доставки')}
    const btn=$('#checkoutSubmit');btn.disabled=true;btn.textContent='Оформляем…';const itemPayload=orderItems();const activeMethods=[...new Set(itemPayload.filter(x=>x.lift_qty>0).map(x=>x.lift_method))];const maxFloor=Math.max(0,...itemPayload.map(x=>Number(x.lift_floor)||0));
    const payload={customer_name:$('#orderName').value.trim(),phone:$('#orderPhone').value.trim(),email:$('#orderEmail').value.trim(),city:$('#orderCity').value.trim(),address,comment:$('#orderComment').value.trim(),delivery_method:deliveryMethod,lift_method:activeMethods.length===0?'none':activeMethods.length===1?activeMethods[0]:'mixed',floor:maxFloor,assembly_requested:!!$('#orderAssembly').checked,assembly_qty:assemblyQty(),items:itemPayload};
    try{const r=await fetch(API+'?action=create-order',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const data=await r.json().catch(()=>({}));if(!r.ok||!data.ok)throw new Error(data.error||'Не удалось оформить заказ');const order=data.order||{};cart().clear();$('#checkoutApp').classList.add('hide');const success=$('#checkoutSuccess');success.classList.remove('hide');success.innerHTML=`<h1>Заказ оформлен</h1><p>Номер вашего заказа</p><strong>№ ${esc(order.order_no||'—')}</strong><p>Сумма: <b>${money(order.total||0)}</b></p><p>Менеджер НОКТЕНА свяжется с вами для подтверждения заказа.</p><a class="checkout-submit" style="display:inline-flex;width:auto;padding:0 24px;align-items:center;text-decoration:none" href="/">Вернуться в каталог</a>`;window.scrollTo({top:0,behavior:'smooth'})}catch(err){alert(err.message||'Ошибка оформления заказа');btn.disabled=false;btn.textContent='Оформить заказ'}
  }
  document.addEventListener('click',e=>{
    const rem=e.target.closest('[data-remove]');if(rem){cart().remove(Number(rem.dataset.remove));renderItems();return}
    const q=e.target.closest('[data-qty]');if(q){const i=Number(q.dataset.qty),list=items(),next=(Number(list[i]?.qty)||1)+Number(q.dataset.delta||0);if(next<=0)cart().remove(i);else cart().setQty(i,next);renderItems();return}
  });
  document.addEventListener('change',e=>{
    if(e.target.matches('input[name="deliveryMethod"]')){updateConditional();return}
    if(e.target.matches('#orderAssembly')){renderAssembly();updateSummary();return}
    if(e.target.matches('#assemblyQty')){updateSummary();return}
    const method=e.target.closest('[data-lift-method]');if(method){const i=Number(method.dataset.liftMethod),x=items()[i];if(x){const st=serviceFor(x);st.method=method.value;if(st.method!=='none'&&!st.qty)st.qty=Number(x.qty)||1;updateServiceRow(i);updateSummary()}return}
    const qty=e.target.closest('[data-lift-qty]');if(qty){const i=Number(qty.dataset.liftQty),x=items()[i];if(x){serviceFor(x).qty=Math.max(1,Number(qty.value)||1);updateServiceRow(i);updateSummary()}return}
  });
  document.addEventListener('input',e=>{const floor=e.target.closest('[data-lift-floor]');if(!floor)return;const i=Number(floor.dataset.liftFloor),x=items()[i];if(x){serviceFor(x).floor=Math.max(1,Math.min(50,Number(floor.value)||1));updateServiceRow(i);updateSummary()}});
  $('#checkoutForm')?.addEventListener('submit',submit);window.addEventListener('noktena-cart-change',renderItems);
  function init(){updateServiceLabels();renderItems();updateConditional()}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();