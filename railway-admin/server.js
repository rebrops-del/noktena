import http from 'node:http';
import nodemailer from 'nodemailer';
import {notificationKey,normalizeNotifications,parseNotificationBootstrap} from './notification-settings.js';

const PORT = Number(process.env.PORT || 3000);
const PROJECT = 'https://oldtlbkrftflfthfsqdv.supabase.co';
const ADMIN_API = PROJECT + '/functions/v1/noktena-admin-api';
const ORDER_API = PROJECT + '/functions/v1/noktena-order-api';
const DELETE_ORDER_API = PROJECT + '/functions/v1/noktena-order-delete';
const PUBLIC_BOOTSTRAP = PROJECT + '/functions/v1/noktena-admin?public=1';
const STORAGE_PREFIX = PROJECT + '/storage/v1/object/public/';
const ALLOWED_ORIGINS = new Set(['https://noktena.ru','https://www.noktena.ru']);

const SMTP_HOST=process.env.SMTP_HOST||'';
const SMTP_PORT=Number(process.env.SMTP_PORT||465);
const SMTP_SECURE=String(process.env.SMTP_SECURE||'true').toLowerCase()!=='false';
const SMTP_USER=process.env.SMTP_USER||'';
const SMTP_PASS=process.env.SMTP_PASS||'';
const ORDER_EMAIL_TO=process.env.ORDER_EMAIL_TO||'noktena@mail.ru';
const ORDER_EMAIL_FROM=process.env.ORDER_EMAIL_FROM||SMTP_USER||'noktena@mail.ru';
const MAX_BOT_TOKEN=process.env.MAX_BOT_TOKEN||'';
const MAX_CHAT_ID=process.env.MAX_CHAT_ID||'';
const MAX_USER_ID=process.env.MAX_USER_ID||'';
const MAX_API='https://platform-api2.max.ru';
const TELEGRAM_BOT_TOKEN=process.env.TELEGRAM_BOT_TOKEN||'';
let mailer=null;

function applyCors(req,res){const origin=req.headers.origin||'';res.setHeader('Access-Control-Allow-Origin',ALLOWED_ORIGINS.has(origin)?origin:'*');res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','authorization,content-type,apikey,x-client-info');res.setHeader('Access-Control-Max-Age','86400');res.setHeader('Cache-Control','no-store')}
function sendJson(res,status,payload){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(payload))}
async function readBody(req){const chunks=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));return chunks.length?Buffer.concat(chunks):undefined}
function proxyBase(req){return 'https://'+req.headers.host}
function proxiedAsset(req,url){return proxyBase(req)+'/asset?url='+encodeURIComponent(url)}
function rewriteValue(req,value){
  if(typeof value==='string'&&value.startsWith(STORAGE_PREFIX))return proxiedAsset(req,value);
  if(Array.isArray(value))return value.map(v=>rewriteValue(req,v));
  if(value&&typeof value==='object'){for(const k of Object.keys(value))value[k]=rewriteValue(req,value[k]);}
  return value;
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function money(v){return `${Math.round(Number(v)||0).toLocaleString('ru-RU')} ₽`;}
function mailReady(){return !!(SMTP_HOST&&SMTP_USER&&SMTP_PASS&&ORDER_EMAIL_TO);}
function maxReady(settings){return !!(MAX_BOT_TOKEN&&settings.max_target);}
function telegramReady(settings){return !!(TELEGRAM_BOT_TOKEN&&settings.telegram_chat);}
function transporter(){if(!mailer)mailer=nodemailer.createTransport({host:SMTP_HOST,port:SMTP_PORT,secure:SMTP_SECURE,auth:{user:SMTP_USER,pass:SMTP_PASS},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:12000});return mailer;}
async function notificationSettings(cityId='ekaterinburg'){
  const response=await fetch(PUBLIC_BOOTSTRAP+'&notifications='+Date.now(),{headers:{accept:'application/javascript'},cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('NOTIFICATION_SETTINGS_HTTP_'+response.status);
  return parseNotificationBootstrap(await response.text(),process.env,cityId);
}
function readiness(settings){return {mail_configured:mailReady(),max_configured:maxReady(settings),telegram_configured:telegramReady(settings),max_bot_configured:!!MAX_BOT_TOKEN,telegram_bot_configured:!!TELEGRAM_BOT_TOKEN};}
async function authorizeAdmin(req){
  const token=req.headers.authorization||'';
  if(!/^Bearer \S+$/.test(token))return false;
  const response=await fetch(ADMIN_API+'?action=orders',{headers:{Authorization:token},signal:AbortSignal.timeout(8000)});
  return response.ok;
}
function liftLabel(method,floor,qty){const count=Number(qty)||0;if(!count||method==='none')return 'Без подъёма';if(method==='cargo')return `Грузовой лифт × ${count}`;if(method==='stairs')return `По лестнице × ${count}${floor?`, этаж ${floor}`:''}`;if(method==='mixed')return `Несколько способов, ${count} ед.`;return 'Без подъёма';}
function deliveryLabel(method){return method==='pickup'?'Самовывоз':'Доставка';}
function maxOrderText(orderRequest,orderResult){
  const items=Array.isArray(orderRequest?.items)?orderRequest.items:[];
  const orderNo=orderResult?.order_no||'—';
  const liftCount=Number(orderResult?.lift_count)||items.reduce((n,x)=>n+(Number(x.lift_qty)||0),0);
  const assemblyQty=Number(orderResult?.assembly_qty)||Number(orderRequest?.assembly_qty)||0;
  const lines=[`🛒 НОВЫЙ ЗАКАЗ №${orderNo}`,'',`👤 ${orderRequest?.customer_name||'—'}`,`📞 ${orderRequest?.phone||'—'}`];
  if(orderRequest?.email)lines.push(`✉️ ${orderRequest.email}`);
  if(orderRequest?.delivery_method==='pickup')lines.push('📦 Самовывоз');
  else{lines.push('🚚 Доставка');const address=[orderRequest?.city,orderRequest?.address].filter(Boolean).join(', ');if(address)lines.push(`📍 ${address}`)}
  lines.push('','Товары:');
  items.forEach((item,index)=>{const qty=Math.max(1,Number(item.qty)||1);let line=`${index+1}. ${item.name||'Товар'} × ${qty} — ${money((Number(item.price)||0)*qty)}`;if(item.size)line+=`\n   Размер: ${item.size}`;if(item.color)line+=`\n   Цвет: ${item.color}`;if(Number(item.lift_qty)>0)line+=`\n   Подъём: ${liftLabel(item.lift_method,item.lift_floor,item.lift_qty)}`;lines.push(line)});
  lines.push('');if(liftCount)lines.push(`⬆️ Подъём: ${liftCount} ед.`);if(assemblyQty)lines.push(`🔧 Сборка кровати: ${assemblyQty} шт.`);if(orderRequest?.comment)lines.push(`💬 Комментарий: ${orderRequest.comment}`);lines.push('',`💰 ИТОГО: ${money(orderResult?.total)}`,'https://noktena.ru/admin/?tab=orders');
  return lines.join('\n').slice(0,4000);
}
async function sendMax(text,settings){
  if(!maxReady(settings)){console.warn('MAX notification skipped: bot or recipient is not configured');return {sent:false,reason:'MAX_NOT_CONFIGURED'}}
  try{const url=new URL(MAX_API+'/messages');url.searchParams.set(settings.max_target_type==='user'?'user_id':'chat_id',settings.max_target);url.searchParams.set('disable_link_preview','true');const r=await fetch(url,{method:'POST',headers:{Authorization:MAX_BOT_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({text}),signal:AbortSignal.timeout(10000)});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data?.message||data?.error||`MAX_HTTP_${r.status}`);console.log('MAX notification sent');return {sent:true}}
  catch(error){console.error('MAX order notification failed',error);return {sent:false,reason:error instanceof Error?error.message:String(error)}}
}
async function sendTelegram(text,settings){
  if(!telegramReady(settings)){console.warn('Telegram notification skipped: bot or recipient is not configured');return {sent:false,reason:'TELEGRAM_NOT_CONFIGURED'}}
  try{const response=await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:settings.telegram_chat,text,disable_web_page_preview:true}),signal:AbortSignal.timeout(10000)});const data=await response.json().catch(()=>({}));if(!response.ok||data.ok!==true)throw new Error(data.description||`TELEGRAM_HTTP_${response.status}`);console.log('Telegram notification sent');return {sent:true}}
  catch(error){console.error('Telegram order notification failed',error);return {sent:false,reason:error instanceof Error?error.message:String(error)}}
}

async function notifyOrderByEmail(orderRequest,orderResult,settings){
  if(!settings.email_enabled)return {sent:false,reason:'DISABLED'};
  if(!mailReady()){console.warn('Order email skipped: SMTP is not configured');return {sent:false,reason:'SMTP_NOT_CONFIGURED'};}
  try{
    const items=Array.isArray(orderRequest?.items)?orderRequest.items:[];
    const rows=items.map((item,index)=>{const lift=Number(item.lift_qty)>0?`<br><span style="color:#64748b">Подъём: ${esc(liftLabel(item.lift_method,item.lift_floor,item.lift_qty))}</span>`:'';return `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">${index+1}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb"><b>${esc(item.name)}</b>${item.size?`<br><span style="color:#64748b">Размер: ${esc(item.size)}</span>`:''}${item.color?`<br><span style="color:#64748b">Цвет: ${esc(item.color)}</span>`:''}${lift}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center">${Math.max(1,Number(item.qty)||1)}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${money((Number(item.price)||0)*(Math.max(1,Number(item.qty)||1)))}</td></tr>`}).join('');
    const orderNo=orderResult?.order_no||'—',liftCount=Number(orderResult?.lift_count)||items.reduce((n,x)=>n+(Number(x.lift_qty)||0),0),assemblyQty=Number(orderResult?.assembly_qty)||Number(orderRequest?.assembly_qty)||0;
    const html=`<!doctype html><html><body style="font-family:Arial,sans-serif;color:#173e32;background:#f6f8f7;padding:24px"><div style="max-width:760px;margin:auto;background:#fff;border-radius:16px;padding:24px;border:1px solid #dbe8e1"><h1 style="margin:0 0 18px">Новый заказ №${esc(orderNo)}</h1><p style="margin:0 0 18px;color:#64748b">НОКТЕНА · noktena.ru</p><h2 style="font-size:18px">Покупатель</h2><p><b>Имя:</b> ${esc(orderRequest?.customer_name)}<br><b>Телефон:</b> ${esc(orderRequest?.phone)}${orderRequest?.email?`<br><b>E-mail:</b> ${esc(orderRequest.email)}`:''}${orderRequest?.city?`<br><b>Город:</b> ${esc(orderRequest.city)}`:''}${orderRequest?.address?`<br><b>Адрес:</b> ${esc(orderRequest.address)}`:''}</p><h2 style="font-size:18px">Состав заказа</h2><table style="width:100%;border-collapse:collapse"><thead><tr><th style="padding:8px;text-align:left">#</th><th style="padding:8px;text-align:left">Товар</th><th style="padding:8px">Кол-во</th><th style="padding:8px;text-align:right">Сумма</th></tr></thead><tbody>${rows}</tbody></table><h2 style="font-size:18px;margin-top:24px">Доставка и услуги</h2><p><b>Способ:</b> ${esc(deliveryLabel(orderRequest?.delivery_method))}<br><b>Подъём:</b> ${liftCount?`${liftCount} ед. (подробно по товарам выше)`:'не нужен'}<br><b>Сборка кровати:</b> ${assemblyQty?`${assemblyQty} шт.`:'Нет'}</p>${orderRequest?.comment?`<p><b>Комментарий:</b><br>${esc(orderRequest.comment)}</p>`:''}<div style="margin-top:24px;padding:18px;background:#eef7f2;border-radius:12px"><div style="font-size:13px;color:#64748b">Итоговая сумма</div><div style="font-size:28px;font-weight:800">${money(orderResult?.total)}</div></div></div></body></html>`;
    const info=await transporter().sendMail({from:`НОКТЕНА <${ORDER_EMAIL_FROM}>`,to:settings.email_to,subject:`Новый заказ №${orderNo} на ${money(orderResult?.total)}`,html,text:`Новый заказ №${orderNo}\nПокупатель: ${orderRequest?.customer_name||''}\nТелефон: ${orderRequest?.phone||''}\nПодъём: ${liftCount} ед.\nСборка: ${assemblyQty} шт.\nИтого: ${money(orderResult?.total)}`});
    console.log('Order email sent',info.messageId||'');return {sent:true};
  }catch(error){console.error('Order email failed',error);return {sent:false,reason:error instanceof Error?error.message:String(error)};}
}
async function deliverNotifications(orderRequest,orderResult,settings){
  const tasks=[];
  if(settings.email_enabled)tasks.push(notifyOrderByEmail(orderRequest,orderResult,settings));
  const message=maxOrderText(orderRequest,orderResult);
  if(['max','both'].includes(settings.messenger))tasks.push(sendMax(message,settings));
  if(['telegram','both'].includes(settings.messenger))tasks.push(sendTelegram(message,settings));
  await Promise.allSettled(tasks);
}
async function sendNotificationTest(settings){
  const text='НОКТЕНА · проверка уведомлений о заказах. Это тестовое сообщение, заказ не создавался.';
  const results={};
  if(settings.email_enabled){
    if(!mailReady())results.email={sent:false,reason:'SMTP_NOT_CONFIGURED'};
    else try{await transporter().sendMail({from:`НОКТЕНА <${ORDER_EMAIL_FROM}>`,to:settings.email_to,subject:'НОКТЕНА · проверка уведомлений',text});results.email={sent:true}}catch(error){console.error('Email test failed',error);results.email={sent:false,reason:error instanceof Error?error.message:String(error)}}
  }
  if(['max','both'].includes(settings.messenger))results.max=await sendMax(text,settings);
  if(['telegram','both'].includes(settings.messenger))results.telegram=await sendTelegram(text,settings);
  return results;
}

const server=http.createServer(async(req,res)=>{
  applyCors(req,res);
  if(req.method==='OPTIONS'){res.statusCode=204;return res.end()}
  const incoming=new URL(req.url||'/','http://localhost');
  if(incoming.pathname==='/health')return sendJson(res,200,{ok:true,service:'noktena-admin-proxy',mail_configured:mailReady(),max_configured:!!(MAX_BOT_TOKEN&&(MAX_CHAT_ID||MAX_USER_ID)),telegram_configured:!!(TELEGRAM_BOT_TOKEN&&process.env.TELEGRAM_CHAT_ID),order_api:'v2'});

  if(incoming.pathname==='/asset'){
    try{
      const target=incoming.searchParams.get('url')||'';
      if(!target.startsWith(STORAGE_PREFIX))return sendJson(res,400,{ok:false,error:'BAD_ASSET_URL'});
      const upstream=await fetch(target,{headers:{accept:req.headers.accept||'*/*'}});
      const body=Buffer.from(await upstream.arrayBuffer());
      res.statusCode=upstream.status;
      res.setHeader('Content-Type',upstream.headers.get('content-type')||'application/octet-stream');
      res.setHeader('Cache-Control','public, max-age=31536000, immutable');
      return res.end(body);
    }catch(error){return sendJson(res,502,{ok:false,error:'ASSET_UNAVAILABLE',message:error instanceof Error?error.message:String(error)})}
  }

  if(incoming.pathname==='/catalog-bootstrap.js'){
    try{
      const upstream=await fetch(PUBLIC_BOOTSTRAP,{headers:{accept:'application/javascript'}});
      let text=await upstream.text();
      text=text.replaceAll(STORAGE_PREFIX,proxyBase(req)+'/asset?url='+encodeURIComponent(STORAGE_PREFIX));
      res.statusCode=upstream.status;
      res.setHeader('Content-Type','application/javascript; charset=utf-8');
      return res.end(text);
    }catch(error){res.statusCode=200;res.setHeader('Content-Type','application/javascript; charset=utf-8');return res.end('window.NOKTENA_CATALOG_BOOTSTRAP={rows:[],assets:[]};')}
  }

  if(incoming.pathname!=='/api/noktena-admin')return sendJson(res,404,{ok:false,error:'NOT_FOUND'});
  if(!['GET','POST'].includes(req.method||''))return sendJson(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
  try{
    const action=incoming.searchParams.get('action')||'',isOrder=req.method==='POST'&&action==='create-order',isDelete=req.method==='POST'&&action==='delete-order';
    if(['notification-settings','notification-settings-save','notification-test'].includes(action)){
      if(!await authorizeAdmin(req))return sendJson(res,401,{ok:false,error:'AUTH_EXPIRED'});
      if(action==='notification-settings'&&req.method==='GET'){
        const settings=await notificationSettings(incoming.searchParams.get('city_id')||'ekaterinburg');return sendJson(res,200,{ok:true,settings,readiness:readiness(settings)});
      }
      if(action==='notification-settings-save'&&req.method==='POST'){
        const payload=JSON.parse((await readBody(req)??Buffer.from('{}')).toString('utf8'));
        const cityId=String(payload.city_id||'ekaterinburg');
        if(!/^[a-z0-9][a-z0-9-]{0,47}$/.test(cityId))return sendJson(res,400,{ok:false,error:'CITY_UNAVAILABLE'});
        await notificationSettings(cityId);
        const settings=normalizeNotifications(payload,process.env);
        const saved=await fetch(ADMIN_API+'?action=save',{method:'POST',headers:{Authorization:req.headers.authorization,'content-type':'application/json'},body:JSON.stringify({key:notificationKey(cityId),kind:'mattress',item:{model:'__order_notifications_v1__',...settings},hidden:false,is_custom:false}),signal:AbortSignal.timeout(8000)});
        if(!saved.ok)return sendJson(res,saved.status,{ok:false,error:'NOTIFICATION_SAVE_FAILED'});
        return sendJson(res,200,{ok:true,settings,readiness:readiness(settings)});
      }
      if(action==='notification-test'&&req.method==='POST'){
        const payload=JSON.parse((await readBody(req)??Buffer.from('{}')).toString('utf8'));
        const settings=await notificationSettings(payload.city_id||'ekaterinburg');return sendJson(res,200,{ok:true,results:await sendNotificationTest(settings)});
      }
      return sendJson(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
    }
    const upstreamUrl=new URL(isOrder?ORDER_API:isDelete?DELETE_ORDER_API:ADMIN_API);if(!isOrder&&!isDelete)for(const [key,value] of incoming.searchParams)upstreamUrl.searchParams.append(key,value);
    const headers={};for(const name of ['authorization','content-type','apikey','x-client-info']){const value=req.headers[name];if(value)headers[name]=Array.isArray(value)?value.join(','):value}
    const body=req.method==='POST'?await readBody(req):undefined;
    let orderRequest=null;if(isOrder&&body){try{orderRequest=JSON.parse(body.toString('utf8'))}catch{}}
    const upstream=await fetch(upstreamUrl,{method:req.method,headers,body});
    const contentType=upstream.headers.get('content-type')||'application/json; charset=utf-8';
    const raw=Buffer.from(await upstream.arrayBuffer());
    res.statusCode=upstream.status;res.setHeader('Content-Type',contentType);res.setHeader('X-Noktena-Proxy','railway');
    if(contentType.includes('application/json')){
      try{const data=rewriteValue(req,JSON.parse(raw.toString('utf8')));if(upstream.ok&&orderRequest&&data?.order){res.end(JSON.stringify(data));void notificationSettings(orderRequest.city_id||'ekaterinburg').then(settings=>deliverNotifications(orderRequest,data.order,settings)).catch(error=>console.error('Order notification setup failed',error));return}return res.end(JSON.stringify(data))}catch{}
    }
    return res.end(raw);
  }catch(error){const message=error instanceof Error?error.message:String(error);return message==='CITY_UNAVAILABLE'?sendJson(res,400,{ok:false,error:message}):sendJson(res,502,{ok:false,error:'UPSTREAM_UNAVAILABLE',message})}
});
server.listen(PORT,'0.0.0.0',()=>console.log(`noktena admin proxy listening on ${PORT}`));
// railway-watch: itemized-lift-checkout-v2
