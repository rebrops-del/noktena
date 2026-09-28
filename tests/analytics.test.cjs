const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const script=fs.readFileSync(require('node:path').join(__dirname,'../assets/yandex-analytics.js'),'utf8');
function setup({pathname='/checkout.html',navigation='navigate',cart=[]}={}){
  const goals=[];
  const goalParams=[];
  const documentEvents={};
  const clickHandlers=[];
  const windowEvents={};
  const local=new Map([['noktena-cart-v1',JSON.stringify(cart)]]);
  const session=new Map();
  let reply={ok:true,order:{id:'order-14',order_no:'NK-14',total:12000}};
  const document={readyState:'complete',scripts:[],createElement:()=>({}),getElementsByTagName:()=>[{parentNode:{insertBefore(){}}}],querySelector:()=>null,addEventListener:(type,fn)=>{documentEvents[type]=fn;if(type==='click')clickHandlers.push(fn)}};
  const window={NOKTENA_METRIKA_ID:112921323,ym:(id,action,name,params)=>{if(action==='reachGoal'){goals.push(name);goalParams.push(params)}},fetch:async()=>({ok:reply.ok,clone:()=>({json:async()=>reply}),json:async()=>reply}),addEventListener:(type,fn)=>{windowEvents[type]=fn}};
  const context={window,document,location:{pathname,search:'',href:'https://noktena.ru'+pathname},localStorage:{getItem:k=>local.get(k)||null},sessionStorage:{getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,v)},performance:{getEntriesByType:()=>[{type:navigation}]},URL,URLSearchParams,setInterval:()=>0,clearInterval(){},console};
  vm.runInNewContext(script,context);
  return{window,goals,goalParams,documentEvents,clickHandlers,windowEvents,local,setReply:value=>{reply=value}};
}

test('PURCHASE fires after a successful order once per order number',async()=>{
  const app=setup();
  const request={method:'POST',body:JSON.stringify({items:[{key:'m1',name:'Матрас',price:12000,qty:1}]})};
  await app.window.fetch('https://example.com/?action=create-order',request);
  await app.window.fetch('https://example.com/?action=create-order',request);
  assert.equal(app.goals.filter(x=>x==='PURCHASE').length,1);
  app.setReply({ok:false,error:'Ошибка'});
  await app.window.fetch('https://example.com/?action=create-order',request);
  assert.equal(app.goals.filter(x=>x==='PURCHASE').length,1);
});

test('ADD_TO_CART tracks a local cart action but not cross-tab storage changes',()=>{
  const app=setup({pathname:'/'});
  const item={kind:'mattress',category:'mattress',key:'m1',name:'Матрас',price:12000,qty:1};
  app.windowEvents['noktena-cart-change']({detail:{items:[item]}});
  assert.equal(app.goals.filter(x=>x==='ADD_TO_CART').length,1);
  app.local.set('noktena-cart-v1',JSON.stringify([{...item,qty:2}]));
  app.windowEvents.storage({key:'noktena-cart-v1'});
  assert.equal(app.goals.filter(x=>x==='ADD_TO_CART').length,1);
});

test('BEGIN_CHECKOUT is not repeated on reload',()=>{
  const cart=[{kind:'mattress',key:'m1',price:12000,qty:1}];
  assert.equal(setup({cart}).goals.filter(x=>x==='BEGIN_CHECKOUT').length,1);
  assert.equal(setup({cart,navigation:'reload'}).goals.filter(x=>x==='BEGIN_CHECKOUT').length,0);
});

test('contact links are attributed to the correct channel',()=>{
  const app=setup({pathname:'/product.html'});
  function click(href){
    const anchor={getAttribute:()=>href,matches:()=>false};
    app.clickHandlers[0]({target:{closest:()=>anchor}});
  }
  for(const [href,goal,channel] of [
    ['https://max.ru/u/shop','MAX_CLICK','max'],
    ['tel:+79321207635','PHONE_CLICK','phone'],
    ['mailto:noktena@mail.ru','EMAIL_CLICK','email'],
    ['https://t.me/noktena','TELEGRAM_CLICK','telegram'],
    ['https://wa.me/79321207635','WHATSAPP_CLICK','whatsapp'],
    ['https://vk.com/noktena','VK_CLICK','vk']
  ]){
    const before=app.goals.length;
    click(href);
    assert.deepEqual(app.goals.slice(before),[goal,'CONTACT_CLICK']);
    assert.equal(app.goalParams[before+1].channel,channel);
  }
  const before=app.goals.length;
  click('https://notmax.ru/u/shop');
  assert.equal(app.goals.length,before);
});
