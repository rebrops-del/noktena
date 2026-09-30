const test=require('node:test');
const assert=require('node:assert/strict');
let handler,citySettings,stored;
globalThis.Deno={env:{get:key=>key==='SUPABASE_URL'?'https://test.supabase.local':'test-service-key'},serve:fn=>{handler=fn}};
globalThis.fetch=async(url,init)=>{
  if(url.includes('settings%3Acity_catalogs_v1'))return Response.json([{payload:citySettings}]);
  if(url.includes('settings%3Adelivery_v2'))return Response.json([{payload:{delivery_price:1500,free_delivery_from:30000}}]);
  if(url.endsWith('/rest/v1/orders')){stored=JSON.parse(init.body);return Response.json([{...stored,order_no:1234}])}
  throw new Error('Unexpected fetch '+url);
};

const ready=import('../supabase/functions/noktena-order-api/index.ts');
const item={kind:'mattress',key:'Матрас А',catalog_key:'mattress:Матрас А',category:'mattress',name:'Матрас А',size:'80×190',price:12000,qty:1};
const order=(city_id,products=[item],delivery_method='delivery')=>new Request('https://test.supabase.local/functions/v1/noktena-order-api',{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({customer_name:'Тестовый покупатель',phone:'+79990000000',city_id,city:'Подставленный город',delivery_method,address:'Адрес',items:products})
});

test('server accepts only the selected city catalog and uses its shipping settings',async()=>{
  await ready;
  citySettings={cities:[{id:'city-kazan',name:'Казань',warehouse:'',delivery_price:700}],catalogs:{'city-kazan':{keys:['mattress:Матрас А'],products:{}}}};
  stored=null;
  let response=await handler(order('city-kazan',[{...item,catalog_key:'mattress:Матрас Б'}]));
  assert.equal(response.status,400);assert.equal((await response.json()).error,'PRODUCT_UNAVAILABLE');assert.equal(stored,null);
  response=await handler(order('city-unknown'));
  assert.equal(response.status,400);assert.equal((await response.json()).error,'CITY_UNAVAILABLE');assert.equal(stored,null);
  response=await handler(order('city-kazan',[item],'pickup'));
  assert.equal(response.status,400);assert.equal((await response.json()).error,'PICKUP_UNAVAILABLE');assert.equal(stored,null);
  response=await handler(order('city-kazan'));
  assert.equal(response.status,201);assert.equal((await response.json()).order.total,12700);
  assert.equal(stored.city,'Казань');assert.equal(stored.items[0].catalog_key,'mattress:Матрас А');
  assert.equal(stored.delivery_cost,700);
});

test('the existing Ekaterinburg catalog works without city settings',async()=>{
  await ready;citySettings={};stored=null;
  const response=await handler(order('ekaterinburg'));
  assert.equal(response.status,201);assert.equal(stored.city,'Екатеринбург');assert.equal(stored.delivery_cost,1500);
});
