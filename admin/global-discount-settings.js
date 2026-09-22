(()=>{
  'use strict';
  const API='https://admin-proxy-v2-production.up.railway.app/api/noktena-admin';
  const BOOT='https://admin-proxy-v2-production.up.railway.app/catalog-bootstrap.js';
  const KEY='settings:discount_global_v1';
  const DEFAULT_PERCENT=30;
  const clamp=value=>Math.min(99,Math.max(0,Math.round(Number(value)||0)));
  const getSession=()=>{try{return JSON.parse(localStorage.getItem('nkt-adm2')||'null')}catch{return null}};
  async function api(action,options={}){const s=getSession(),headers={...(options.headers||{})};if(s?.access_token)headers.Authorization='Bearer '+s.access_token;const r=await fetch(API+'?action='+encodeURIComponent(action),{...options,headers});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Ошибка сервера');return d;}
  async function loadBootstrap(){const text=await fetch(BOOT+'?discount='+Date.now(),{cache:'no-store'}).then(r=>r.text());const marker='window.NOKTENA_CATALOG_BOOTSTRAP=';const p=text.indexOf(marker);if(p<0)return{};return JSON.parse(text.slice(p+marker.length).trim().replace(/;+\s*$/,''));}
  function currentSettings(b){const row=(b.rows||[]).find(r=>r.product_key===KEY);if(!row)return{enabled:true,percent:DEFAULT_PERCENT};const p=row.payload||{};return{enabled:p.enabled!==false,percent:clamp(Object.prototype.hasOwnProperty.call(p,'percent')?p.percent:DEFAULT_PERCENT)};}
  function toastMsg(msg,error=false){if(typeof toast==='function')toast(msg,error);else alert(msg)}

  function buildModal(){
    if(document.getElementById('globalDiscountModal'))return;
    const modal=document.createElement('div');modal.id='globalDiscountModal';modal.className='modal hide';
    modal.innerHTML=`<div class="modalbox small"><div class="modalhead"><div><b>Скидка в карточке для всех товаров</b><div class="muted">Один процент сразу для матрасов, кроватей и диванов.</div></div><button id="globalDiscountClose" type="button" class="btn secondary">Закрыть</button></div><form id="globalDiscountForm"><label class="check" style="margin:8px 0 16px"><input id="globalDiscountEnabled" type="checkbox"> Использовать один процент скидки для всех карточек</label><label>Скидка в карточке, %<input id="globalDiscountPercent" type="number" min="0" max="99" step="1" inputmode="numeric" value="30"></label><div class="notice" style="margin-top:12px">Старая цена пересчитывается автоматически от текущей цены товара. Значение 0 скрывает старую цену и плашку скидки. Если общий режим выключен, снова используются индивидуальные настройки каждой карточки.</div><div class="savebar"><span></span><div class="actions"><button id="globalDiscountCancel" type="button" class="btn secondary">Отмена</button><button type="submit" class="btn primary">Сохранить для всех товаров</button></div></div></form></div>`;
    document.body.appendChild(modal);
    const close=()=>modal.classList.add('hide');
    document.getElementById('globalDiscountClose').addEventListener('click',close);
    document.getElementById('globalDiscountCancel').addEventListener('click',close);
    document.getElementById('globalDiscountForm').addEventListener('submit',async e=>{
      e.preventDefault();const btn=e.submitter;if(btn)btn.disabled=true;
      try{
        const payload={discountGlobalV1:true,enabled:document.getElementById('globalDiscountEnabled').checked,percent:clamp(document.getElementById('globalDiscountPercent').value)};
        await api('save',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key:KEY,kind:'mattress',item:payload,hidden:false,is_custom:false})});
        close();toastMsg(`Скидка ${payload.percent}% сохранена для всех карточек`);
      }catch(err){toastMsg(err.message,true)}finally{if(btn)btn.disabled=false;}
    });
  }

  function addButton(){
    const actions=document.querySelector('.main .top .actions');
    if(!actions||document.getElementById('globalDiscountOpen'))return;
    const btn=document.createElement('button');btn.id='globalDiscountOpen';btn.type='button';btn.className='btn secondary';btn.textContent='Скидка для всех';
    const promo=document.getElementById('globalPromoOpen');
    if(promo?.nextSibling)actions.insertBefore(btn,promo.nextSibling);else actions.insertBefore(btn,document.getElementById('deliverySettingsOpen')||document.getElementById('add')||null);
    btn.addEventListener('click',async()=>{
      buildModal();
      try{
        const s=currentSettings(await loadBootstrap());
        document.getElementById('globalDiscountEnabled').checked=s.enabled;
        document.getElementById('globalDiscountPercent').value=s.percent;
        document.getElementById('globalDiscountModal').classList.remove('hide');
      }catch(err){toastMsg(err.message,true);}
    });
  }

  function init(){buildModal();addButton();setTimeout(addButton,300);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
