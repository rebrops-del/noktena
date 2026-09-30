const test=require('node:test');
const assert=require('node:assert/strict');

const modulePromise=import('../railway-admin/notification-settings.js');

test('notification defaults keep the existing mail recipient and MAX channel',async()=>{
  const {normalizeNotifications}=await modulePromise;
  assert.deepEqual(normalizeNotifications({},{}),{
    email_enabled:true,email_to:'noktena@mail.ru',messenger:'max',max_target_type:'user',max_target:'',telegram_chat:''
  });
});

test('saved choices are read from bootstrap and server recipient overrides are honored',async()=>{
  const {parseNotificationBootstrap,NOTIFICATION_KEY}=await modulePromise;
  const payload={email_enabled:true,email_to:'orders@example.org',messenger:'both',max_target_type:'chat',max_target:'123456',telegram_chat:'-10012345678'};
  const script='window.NOKTENA_CATALOG_BOOTSTRAP='+JSON.stringify({rows:[{product_key:NOTIFICATION_KEY,payload}]})+';';
  assert.deepEqual(parseNotificationBootstrap(script,{MAX_BOT_TOKEN:'private'}),payload);
  assert.equal(parseNotificationBootstrap('window.NOKTENA_CATALOG_BOOTSTRAP={"rows":[]};',{ORDER_EMAIL_TO:'owner@example.org'}).email_to,'owner@example.org');
});

test('notification settings reject multiple addresses and invalid recipient IDs',async()=>{
  const {normalizeNotifications}=await modulePromise;
  assert.throws(()=>normalizeNotifications({email_to:'a@example.org,b@example.org'}),/BAD_NOTIFICATION_EMAIL/);
  assert.throws(()=>normalizeNotifications({max_target:'https://max.ru/u/profile'}),/BAD_MAX_TARGET/);
  assert.throws(()=>normalizeNotifications({telegram_chat:'https://t.me/profile'}),/BAD_TELEGRAM_CHAT/);
  assert.throws(()=>normalizeNotifications({telegram_chat:'-10012345678\nother'}),/BAD_TELEGRAM_CHAT/);
});

test('malformed bootstrap never silently sends to a fallback recipient',async()=>{
  const {parseNotificationBootstrap}=await modulePromise;
  assert.throws(()=>parseNotificationBootstrap('unavailable'),/NOTIFICATION_SETTINGS_UNAVAILABLE/);
  assert.throws(()=>parseNotificationBootstrap('window.NOKTENA_CATALOG_BOOTSTRAP={invalid};'),SyntaxError);
});
