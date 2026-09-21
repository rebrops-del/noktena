(()=>{
  'use strict';
  const API='https://admin-proxy-v2-production.up.railway.app/api/noktena-admin';
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>`${Math.round(Number(n)||0).toLocaleString('ru-RU')} ₽`;
  const statusLabels={new:'Новый',confirmed:'Подтверждён',processing:'В работе',done:'Выполнен',cancelled:'Отменён'};
  let ordersCache=[];
  let currentOrderId='';
  let pollBusy=false;

  function sess(){try{return JSON.parse(localStorage.getItem('nkt-adm2')||'null')}catch{return null}}
  async function api(action,options={}){
    const headers={...(options.headers||{})},s=sess();
    if(s?.access_token)headers.Authorization='Bearer '+s.access_token;
    const r=await fetch(API+'?action='+encodeURIComponent(action),{...options,headers});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||'Ошибка сервера');
    return d;
  }
  function itemCount(o){return (Array.isArray(o?.items)?o.items:[]).reduce((n,x)=>n+(Number(x.qty)||1),0)}
  function liftText(x){const q=Number(x?.lift_qty)||0;if(!q)return'';if(x.lift_method==='cargo')return `Грузовой лифт × ${q}`;if(x.lift_method==='stairs')return `Лестница × ${q}, этаж ${Number(x.lift_floor)||1}`;return''}
  function dateText(v){try{return new Date(v).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return''}}
  function statusClass(status){return `orders-status orders-status-${esc(status||'new')}`}

  function ensureStyles(){
    if($('#ordersStyles'))return;
    const style=document.createElement('style');style.id='ordersStyles';style.textContent=`
      #ordersOpen{position:relative;padding-right:16px}.orders-badge{position:absolute;right:-8px;top:-9px;display:grid;place-items:center;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:#d92d3b;color:#fff;font-size:11px;font-weight:900;box-shadow:0 0 0 3px #f5f8f6}.orders-badge.hide{display:none!important}
      .orders-modalbox{width:min(1040px,96vw)}.orders-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:14px 0}.orders-summary{font-size:13px;color:var(--muted)}
      .orders-list{display:grid;gap:8px}.orders-row{display:grid;grid-template-columns:110px 130px minmax(160px,1.2fr) minmax(130px,1fr) 120px 130px 32px;gap:12px;align-items:center;padding:13px 14px;border:1px solid var(--line);border-radius:14px;background:#fff;cursor:pointer;transition:.16s}.orders-row:hover{border-color:#9fc9b5;box-shadow:0 7px 18px rgba(18,61,50,.07);transform:translateY(-1px)}.orders-row.is-new{border-left:4px solid #d92d3b;background:#fffdfd}.orders-no{font-weight:900;color:var(--ink)}.orders-client{font-weight:800}.orders-phone{color:#52675f}.orders-total{font-weight:900;text-align:right}.orders-arrow{font-size:22px;color:#91a49b;text-align:right}
      .orders-status{display:inline-flex;align-items:center;justify-content:center;min-height:28px;padding:0 9px;border-radius:999px;font-size:11px;font-weight:900;white-space:nowrap}.orders-status-new{background:#fff0f1;color:#b82533}.orders-status-confirmed{background:#edf7ff;color:#246b9b}.orders-status-processing{background:#fff7e6;color:#9a6500}.orders-status-done{background:#eaf8f0;color:#087345}.orders-status-cancelled{background:#f1f3f2;color:#73827b}
      .orders-detail-top{display:flex;align-items:flex-start;justify-content:space-between;gap:15px;flex-wrap:wrap;margin:16px 0}.orders-detail-title{font-size:24px;font-weight:900}.orders-detail-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.orders-info-card{border:1px solid var(--line);border-radius:14px;padding:14px;background:#fff}.orders-info-card h3{font-size:13px;margin:0 0 9px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}.orders-info-card div{line-height:1.55}.orders-detail-items{margin-top:14px;border:1px solid var(--line);border-radius:14px;overflow:hidden}.orders-detail-item{display:grid;grid-template-columns:1fr auto;gap:12px;padding:12px 14px;border-bottom:1px solid #edf2ef}.orders-detail-item:last-child{border-bottom:0}.orders-detail-item-title{font-weight:900}.orders-detail-meta{font-size:12px;color:var(--muted);margin-top:3px}.orders-detail-price{text-align:right;font-weight:900}.orders-detail-totals{margin:14px 0 0 auto;width:min(390px,100%);border:1px solid var(--line);border-radius:14px;padding:13px 15px;background:#fbfdfc}.orders-total-line{display:flex;justify-content:space-between;gap:16px;padding:5px 0}.orders-total-line.grand{margin-top:5px;padding-top:11px;border-top:1px solid var(--line);font-size:19px;font-weight:900}.orders-back{display:inline-flex;align-items:center;gap:6px;border:0;background:none;color:var(--green);font-weight:900;cursor:pointer;padding:0}.orders-comment{margin-top:14px;padding:12px 14px;border-radius:12px;background:#eff8f3}.orders-detail-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.orders-detail-actions select{width:auto;min-width:190px}
      @media(max-width:900px){.orders-row{grid-template-columns:90px 110px 1fr 110px 28px}.orders-row .orders-phone,.orders-row .orders-date-extra{display:none}.orders-detail-grid{grid-template-columns:1fr 1fr}}
      @media(max-width:620px){.orders-row{grid-template-columns:1fr auto;gap:6px 10px}.orders-row>*{text-align:left}.orders-row .orders-date,.orders-row .orders-phone{display:block}.orders-arrow{grid-column:2;grid-row:1/5;align-self:center}.orders-detail-grid{grid-template-columns:1fr}.orders-modalbox{padding:14px}.orders-detail-title{font-size:20px}}
    `;document.head.appendChild(style);
  }

  function ensure(){
    ensureStyles();
    if($('#ordersOpen'))return;
    const actions=document.querySelector('.main .top .actions');
    if(actions){
      const btn=document.createElement('button');btn.id='ordersOpen';btn.type='button';btn.className='btn secondary';btn.innerHTML='Заказы <span id="ordersBadge" class="orders-badge hide">0</span>';
      const add=$('#add');actions.insertBefore(btn,add||null);btn.addEventListener('click',open);
    }
    const modal=document.createElement('div');modal.id='ordersModal';modal.className='modal hide';modal.innerHTML=`
      <div class="modalbox orders-modalbox">
        <div class="modalhead">
          <div><b>Заказы с сайта</b><div class="muted">Заказы из корзины и формы оформления.</div></div>
          <div class="actions"><button id="ordersReload" class="btn secondary" type="button">Обновить</button><button id="ordersClose" class="btn secondary" type="button">Закрыть</button></div>
        </div>
        <section id="ordersListScreen">
          <div class="orders-toolbar"><div id="ordersSummary" class="orders-summary"></div></div>
          <div id="ordersList" class="orders-list"></div>
        </section>
        <section id="ordersDetailScreen" class="hide"></section>
      </div>`;
    document.body.appendChild(modal);
    $('#ordersClose').addEventListener('click',()=>modal.classList.add('hide'));
    $('#ordersReload').addEventListener('click',()=>load(true));
  }

  function updateBadge(rows=ordersCache){
    const count=(rows||[]).filter(o=>o.status==='new').length,badge=$('#ordersBadge'),btn=$('#ordersOpen');
    if(!badge)return;
    badge.textContent=count>99?'99+':String(count);
    badge.classList.toggle('hide',count===0);
    if(btn)btn.title=count?`Новых заказов: ${count}`:'Новых заказов нет';
  }

  function renderList(rows){
    const mount=$('#ordersList'),summary=$('#ordersSummary');if(!mount)return;
    updateBadge(rows);
    const newCount=rows.filter(o=>o.status==='new').length;
    if(summary)summary.textContent=`Всего: ${rows.length}${newCount?` · Новых: ${newCount}`:''}`;
    if(!rows.length){mount.innerHTML='<div class="notice">Заказов пока нет.</div>';return}
    mount.innerHTML=rows.map(o=>`<article class="orders-row ${o.status==='new'?'is-new':''}" data-order-open="${esc(o.id)}" tabindex="0" role="button" aria-label="Открыть заказ ${esc(o.order_no)}">
      <div class="orders-no">№ ${esc(o.order_no)}</div>
      <div class="orders-date">${esc(dateText(o.created_at))}</div>
      <div><div class="orders-client">${esc(o.customer_name)}</div><div class="muted">${itemCount(o)} ${itemCount(o)===1?'товар':'товаров'}</div></div>
      <div class="orders-phone">${esc(o.phone)}</div>
      <div class="orders-total">${money(o.total)}</div>
      <div><span class="${statusClass(o.status)}">${esc(statusLabels[o.status]||o.status)}</span></div>
      <div class="orders-arrow">›</div>
    </article>`).join('');
  }

  function renderDetail(o){
    if(!o)return;currentOrderId=o.id;
    const items=Array.isArray(o.items)?o.items:[],liftCount=Number(o.lift_count)||items.reduce((n,x)=>n+(Number(x.lift_qty)||0),0),assemblyQty=Number(o.assembly_qty)||0;
    $('#ordersListScreen')?.classList.add('hide');const screen=$('#ordersDetailScreen');screen.classList.remove('hide');
    screen.innerHTML=`
      <div class="orders-detail-top">
        <div><button class="orders-back" type="button" id="ordersBack">← К списку заказов</button><div class="orders-detail-title" style="margin-top:9px">Заказ № ${esc(o.order_no)}</div><div class="muted">${esc(dateText(o.created_at))}</div></div>
        <div class="orders-detail-actions"><span class="${statusClass(o.status)}">${esc(statusLabels[o.status]||o.status)}</span><select id="orderDetailStatus" data-order-status="${esc(o.id)}"><option value="new" ${o.status==='new'?'selected':''}>Новый</option><option value="confirmed" ${o.status==='confirmed'?'selected':''}>Подтверждён</option><option value="processing" ${o.status==='processing'?'selected':''}>В работе</option><option value="done" ${o.status==='done'?'selected':''}>Выполнен</option><option value="cancelled" ${o.status==='cancelled'?'selected':''}>Отменён</option></select></div>
      </div>
      <div class="orders-detail-grid">
        <div class="orders-info-card"><h3>Покупатель</h3><div><b>${esc(o.customer_name)}</b><br>${esc(o.phone)}${o.email?`<br>${esc(o.email)}`:''}</div></div>
        <div class="orders-info-card"><h3>Получение</h3><div><b>${o.delivery_method==='pickup'?'Самовывоз':'Доставка'}</b>${o.address?`<br>${esc(o.city||'')} ${esc(o.address)}`:''}<br>Подъём: ${liftCount?`${liftCount} ед.`:'не нужен'}${o.assembly_requested?`<br>Сборка кровати: ${assemblyQty||1} шт.`:''}</div></div>
        <div class="orders-info-card"><h3>Заказ</h3><div>Позиций: ${items.length}<br>Товаров: ${itemCount(o)}<br><b>Итого: ${money(o.total)}</b></div></div>
      </div>
      <div class="orders-detail-items">${items.map(x=>{const lift=liftText(x);return `<div class="orders-detail-item"><div><div class="orders-detail-item-title">${esc(x.name)} × ${esc(x.qty)}</div><div class="orders-detail-meta">${x.size?`Размер: ${esc(x.size)}`:''}${x.size&&x.color?' · ':''}${x.color?`Цвет: ${esc(x.color)}`:''}${lift?`<br>Подъём: ${esc(lift)}${Number(x.lift_cost)>0?` · ${money(x.lift_cost)}`:''}`:''}</div></div><div class="orders-detail-price">${money((Number(x.price)||0)*(Number(x.qty)||1))}</div></div>`}).join('')}</div>
      ${o.comment?`<div class="orders-comment"><b>Комментарий покупателя</b><div style="margin-top:5px">${esc(o.comment)}</div></div>`:''}
      <div class="orders-detail-totals"><div class="orders-total-line"><span>Товары</span><b>${money(o.subtotal)}</b></div><div class="orders-total-line"><span>Доставка</span><b>${money(o.delivery_cost)}</b></div>${liftCount?`<div class="orders-total-line"><span>Подъём (${liftCount} ед.)</span><b>${money(o.lift_cost)}</b></div>`:''}${o.assembly_requested?`<div class="orders-total-line"><span>Сборка (${assemblyQty||1})</span><b>${money(o.assembly_cost)}</b></div>`:''}<div class="orders-total-line grand"><span>Итого</span><b>${money(o.total)}</b></div></div>`;
    $('#ordersBack').addEventListener('click',backToList);
  }

  function backToList(){currentOrderId='';$('#ordersDetailScreen')?.classList.add('hide');$('#ordersListScreen')?.classList.remove('hide')}

  async function fetchOrders(){const d=await api('orders');ordersCache=Array.isArray(d.orders)?d.orders:[];updateBadge(ordersCache);return ordersCache}
  async function load(showLoader=false){
    const mount=$('#ordersList');if(showLoader&&mount)mount.innerHTML='<div class="muted">Загрузка заказов…</div>';
    try{const rows=await fetchOrders();renderList(rows);if(currentOrderId){const current=rows.find(o=>o.id===currentOrderId);if(current)renderDetail(current);else backToList()}}
    catch(e){if(mount)mount.innerHTML=`<div style="color:#b82e3b">${esc(e.message)}</div>`}
  }
  async function open(){ensure();backToList();$('#ordersModal').classList.remove('hide');await load(true)}

  async function poll(){
    if(pollBusy||!sess()?.access_token)return;pollBusy=true;
    try{await fetchOrders();if(!$('#ordersModal')?.classList.contains('hide'))renderList(ordersCache)}catch{}finally{pollBusy=false}
  }

  document.addEventListener('click',e=>{const row=e.target.closest('[data-order-open]');if(!row)return;const o=ordersCache.find(x=>x.id===row.dataset.orderOpen);if(o)renderDetail(o)});
  document.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const row=e.target.closest('[data-order-open]');if(!row)return;e.preventDefault();const o=ordersCache.find(x=>x.id===row.dataset.orderOpen);if(o)renderDetail(o)});
  document.addEventListener('change',async e=>{
    const s=e.target.closest('[data-order-status]');if(!s)return;
    const old=ordersCache.find(o=>o.id===s.dataset.orderStatus)?.status;
    try{
      await api('order-status',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:s.dataset.orderStatus,status:s.value})});
      const o=ordersCache.find(o=>o.id===s.dataset.orderStatus);if(o)o.status=s.value;updateBadge();
      if(o&&currentOrderId===o.id)renderDetail(o);else renderList(ordersCache);
      if(typeof toast==='function')toast('Статус заказа обновлён');
    }catch(err){s.value=old||'new';if(typeof toast==='function')toast(err.message,true)}
  });

  ensure();
  setTimeout(poll,2500);setTimeout(poll,8000);setInterval(poll,30000);
})();