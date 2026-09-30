export const NOTIFICATION_KEY='settings:order_notifications_v1';
const DEFAULT_EMAIL='noktena@mail.ru';

export function normalizeNotifications(payload={},environment={}){
  const source=payload&&typeof payload==='object'?payload:{};
  const configuredEmail=String(environment.ORDER_EMAIL_TO||DEFAULT_EMAIL).trim();
  const requestedEmail=String(source.email_to||'').trim();
  const email_to=requestedEmail||configuredEmail;
  if(!/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(email_to)||email_to.length>254)throw new Error('BAD_NOTIFICATION_EMAIL');
  const messenger=['none','max','telegram','both'].includes(source.messenger)?source.messenger:'max';
  const max_target=String(source.max_target||'').trim()||String(environment.MAX_CHAT_ID||environment.MAX_USER_ID||'').trim();
  const max_target_type=source.max_target_type==='user'?'user':source.max_target_type==='chat'?'chat':environment.MAX_CHAT_ID?'chat':'user';
  const telegram_chat=String(source.telegram_chat||'').trim()||String(environment.TELEGRAM_CHAT_ID||'').trim();
  if(max_target&&!/^\d{1,20}$/.test(max_target))throw new Error('BAD_MAX_TARGET');
  if(telegram_chat&&!/^(?:-?\d{1,20}|@[A-Za-z0-9_]{5,32})$/.test(telegram_chat))throw new Error('BAD_TELEGRAM_CHAT');
  return {email_enabled:source.email_enabled!==false,email_to,messenger,max_target_type,max_target,telegram_chat};
}

export function parseNotificationBootstrap(source,environment={}){
  const marker='window.NOKTENA_CATALOG_BOOTSTRAP=';
  const position=source.indexOf(marker);
  if(position<0)throw new Error('NOTIFICATION_SETTINGS_UNAVAILABLE');
  const bootstrap=JSON.parse(source.slice(position+marker.length).trim().replace(/;+\s*$/,''));
  const payload=(bootstrap.rows||[]).find(row=>row.product_key===NOTIFICATION_KEY)?.payload;
  return normalizeNotifications(payload,environment);
}
