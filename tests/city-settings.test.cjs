const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const core=require('../assets/city-settings-core.js');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('a city keeps independent contacts, banner, SEO, and price settings',()=>{
  const rows=[
    {product_key:'settings:city_catalogs_v1',payload:{cities:[{id:'ekaterinburg',name:'Екатеринбург'},{id:'city-kazan',name:'Казань',seo_title:'Матрасы в Казани'}]}},
    {product_key:'settings:contacts_v1',payload:{phone:'EKB'}},
    {product_key:'settings:contacts_v1:city:city-kazan',payload:{phone:'KZN'}},
    {product_key:'settings:home_banners_v1',payload:{banners:[{title:'Общая акция'}]}},
    {product_key:'settings:home_banners_v1:city:city-kazan',payload:{banners:[]}},
    {product_key:'settings:category_prices_v1:city:city-kazan',payload:{rows:[{category:'beds',price_mode:'percent',price_value:10}]}}
  ];
  assert.equal(core.key('settings:contacts_v1','ekaterinburg'),'settings:contacts_v1');
  assert.equal(core.key('settings:contacts_v1','city-kazan'),'settings:contacts_v1:city:city-kazan');
  assert.equal(core.payload(rows,'settings:contacts_v1','city-kazan').phone,'KZN');
  assert.equal(core.payload(rows,'settings:contacts_v1','ekaterinburg').phone,'EKB');
  assert.equal(core.payload(rows,'settings:contacts_v1','city-other').phone,'EKB');
  assert.deepEqual(core.payload(rows,'settings:home_banners_v1','city-kazan').banners,[]);
  assert.equal(core.seo(rows,'city-kazan').home_title,'Матрасы в Казани');
  assert.equal(core.payload(rows,'settings:category_prices_v1','city-kazan',false).rows[0].price_value,10);
  assert.equal(core.payload(rows,'settings:category_prices_v1','ekaterinburg',false),null);
  assert.throws(()=>core.key('settings:contacts_v1','../other'),/город/);
});

test('shop price adjustment reads the selected city and leaves the base city unchanged',()=>{
  const bootstrap={categorySettings:[{category:'beds',price_mode:'percent',price_value:5}],rows:[
    {product_key:'settings:category_prices_v1:city:city-kazan',payload:{rows:[{category:'beds',price_mode:'fixed',price_value:3000}]}}
  ]};
  for(const [cityId,expected] of [['ekaterinburg',5],['city-kazan',3000]]){
    const context={window:{NOKTENA_CATALOG_BOOTSTRAP:bootstrap,NoktenaCities:{id:()=>cityId}},localStorage:{getItem:()=>null},URL,console};
    vm.runInNewContext(read('assets/city-settings-core.js'),context);
    vm.runInNewContext(read('assets/catalog-runtime.js'),context);
    assert.equal(context.window.NoktenaCatalog.settingFor('beds').price_value,expected);
  }
});

test('order messages use the city recipient and reject deleted or unknown cities',async()=>{
  const {parseNotificationBootstrap,notificationKey}=await import('../railway-admin/notification-settings.js');
  const rows=[
    {product_key:'settings:city_catalogs_v1',payload:{cities:[{id:'ekaterinburg'},{id:'city-kazan'}]}},
    {product_key:notificationKey('ekaterinburg'),payload:{email_to:'ekb@example.org',messenger:'none'}},
    {product_key:notificationKey('city-kazan'),payload:{email_to:'kazan@example.org',messenger:'telegram',telegram_chat:'-100123456789'}}
  ];
  const script='window.NOKTENA_CATALOG_BOOTSTRAP='+JSON.stringify({rows})+';';
  assert.equal(parseNotificationBootstrap(script,{},'city-kazan').email_to,'kazan@example.org');
  assert.equal(parseNotificationBootstrap(script,{},'ekaterinburg').email_to,'ekb@example.org');
  assert.throws(()=>parseNotificationBootstrap(script,{},'city-deleted'),/CITY_UNAVAILABLE/);
});
