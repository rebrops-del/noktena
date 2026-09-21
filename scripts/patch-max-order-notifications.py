from pathlib import Path

p = Path('railway-admin/server.js')
s = p.read_text()

if "const MAX_BOT_TOKEN=" not in s:
    marker = "const ORDER_EMAIL_FROM=process.env.ORDER_EMAIL_FROM||SMTP_USER||'noktena@mail.ru';\nlet mailer=null;"
    repl = "const ORDER_EMAIL_FROM=process.env.ORDER_EMAIL_FROM||SMTP_USER||'noktena@mail.ru';\nconst MAX_BOT_TOKEN=process.env.MAX_BOT_TOKEN||'';\nconst MAX_CHAT_ID=process.env.MAX_CHAT_ID||'';\nconst MAX_USER_ID=process.env.MAX_USER_ID||'';\nconst MAX_API='https://platform-api2.max.ru';\nlet mailer=null;"
    if marker not in s:
        raise SystemExit('env marker not found')
    s = s.replace(marker, repl, 1)

if "function maxReady()" not in s:
    marker = "function mailReady(){return !!(SMTP_HOST&&SMTP_USER&&SMTP_PASS&&ORDER_EMAIL_TO);}\nfunction transporter()"
    repl = "function mailReady(){return !!(SMTP_HOST&&SMTP_USER&&SMTP_PASS&&ORDER_EMAIL_TO);}\nfunction maxReady(){return !!(MAX_BOT_TOKEN&&(MAX_CHAT_ID||MAX_USER_ID));}\nfunction transporter()"
    if marker not in s:
        raise SystemExit('ready marker not found')
    s = s.replace(marker, repl, 1)

if "async function notifyOrderByMax" not in s:
    marker = "async function notifyOrderByEmail(orderRequest,orderResult){"
    if marker not in s:
        raise SystemExit('mail function marker not found')
    insert = '''function maxOrderText(orderRequest,orderResult){
  const items=Array.isArray(orderRequest?.items)?orderRequest.items:[];
  const orderNo=orderResult?.order_no||'—';
  const liftCount=Number(orderResult?.lift_count)||items.reduce((n,x)=>n+(Number(x.lift_qty)||0),0);
  const assemblyQty=Number(orderResult?.assembly_qty)||Number(orderRequest?.assembly_qty)||0;
  const lines=[`🛒 НОВЫЙ ЗАКАЗ №${orderNo}`,'',`👤 ${orderRequest?.customer_name||'—'}`,`📞 ${orderRequest?.phone||'—'}`];
  if(orderRequest?.email)lines.push(`✉️ ${orderRequest.email}`);
  if(orderRequest?.delivery_method==='pickup')lines.push('📦 Самовывоз');
  else{lines.push('🚚 Доставка');const address=[orderRequest?.city,orderRequest?.address].filter(Boolean).join(', ');if(address)lines.push(`📍 ${address}`)}
  lines.push('','Товары:');
  items.forEach((item,index)=>{const qty=Math.max(1,Number(item.qty)||1);let line=`${index+1}. ${item.name||'Товар'} × ${qty} — ${money((Number(item.price)||0)*qty)}`;if(item.size)line+=`\\n   Размер: ${item.size}`;if(item.color)line+=`\\n   Цвет: ${item.color}`;if(Number(item.lift_qty)>0)line+=`\\n   Подъём: ${liftLabel(item.lift_method,item.lift_floor,item.lift_qty)}`;lines.push(line)});
  lines.push('');if(liftCount)lines.push(`⬆️ Подъём: ${liftCount} ед.`);if(assemblyQty)lines.push(`🔧 Сборка кровати: ${assemblyQty} шт.`);if(orderRequest?.comment)lines.push(`💬 Комментарий: ${orderRequest.comment}`);lines.push('',`💰 ИТОГО: ${money(orderResult?.total)}`,'https://noktena.ru/admin/?tab=orders');
  return lines.join('\\n').slice(0,4000);
}
async function notifyOrderByMax(orderRequest,orderResult){
  if(!maxReady()){console.warn('MAX notification skipped: MAX is not configured');return {sent:false,reason:'MAX_NOT_CONFIGURED'}}
  try{const url=new URL(MAX_API+'/messages');if(MAX_CHAT_ID)url.searchParams.set('chat_id',MAX_CHAT_ID);else url.searchParams.set('user_id',MAX_USER_ID);url.searchParams.set('disable_link_preview','true');const r=await fetch(url,{method:'POST',headers:{Authorization:MAX_BOT_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({text:maxOrderText(orderRequest,orderResult)})});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data?.message||data?.error||`MAX_HTTP_${r.status}`);console.log('MAX order notification sent');return {sent:true}}
  catch(error){console.error('MAX order notification failed',error);return {sent:false,reason:error instanceof Error?error.message:String(error)}}
}

'''
    s = s.replace(marker, insert + marker, 1)

old = "if(incoming.pathname==='/health')return sendJson(res,200,{ok:true,service:'noktena-admin-proxy',mail_configured:mailReady(),order_api:'v2'});"
new = "if(incoming.pathname==='/health')return sendJson(res,200,{ok:true,service:'noktena-admin-proxy',mail_configured:mailReady(),max_configured:maxReady(),order_api:'v2'});"
if old in s:
    s = s.replace(old, new, 1)

old = "try{const data=rewriteValue(req,JSON.parse(raw.toString('utf8')));if(upstream.ok&&orderRequest&&data?.order)data.email_notification=await notifyOrderByEmail(orderRequest,data.order);return res.end(JSON.stringify(data))}catch{}"
new = "try{const data=rewriteValue(req,JSON.parse(raw.toString('utf8')));if(upstream.ok&&orderRequest&&data?.order){data.email_notification=await notifyOrderByEmail(orderRequest,data.order);data.max_notification=await notifyOrderByMax(orderRequest,data.order)}return res.end(JSON.stringify(data))}catch{}"
if old in s:
    s = s.replace(old, new, 1)
elif "data.max_notification=await notifyOrderByMax" not in s:
    raise SystemExit('order notification marker not found')

p.write_text(s)
