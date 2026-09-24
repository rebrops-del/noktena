const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const script=fs.readFileSync(require('node:path').join(__dirname,'../assets/yandex-analytics.js'),'utf8');
function setup({pathname='/checkout.html',navigation='navigate',cart=[]}={}){
  const goals=[];
  const documentEvents={};
  const windowEvents={};
  const local=new Map([['noktena-cart-v1',JSON.stringify(cart)]]);
  const session=new Map();
  let reply={ok:true,order:{id:'order-14',order_no:'NK-14',total:12000}};
  const document={readyState:'complete',scripts:[],createElement:()=>({}),getElementsByTagName:()=>[{parentNode:{insertBefore(){}}}],querySelector:()=>null,addEventListener:(type,fn)=>{documentEvents[type]=fn}};
  const window={NOKTENA_METRIKA_ID:112921323,ym:(id,action,name)=>{if(action==='reachGoal')goals.push(name)},fetch:async()=>({ok:reply.ok,clone:()=>({json:async()=>reply}),json:async()=>reply}),addEventListener:(type,fn)=>{windowEvents[type]=fn}};
  const context={window,document,location:{pathname,search:''},localStorage:{getItem:k=>local.get(k)||null},sessionStorage:{getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,v)},performance:{getEntriesByType:()=>[{type:navigation}]},URLSearchParams,setInterval:()=>0,clearInterval(){},console};
  vm.runInNewContext(script,context);
  return{window,goals,documentEvents,windowEvents,local,setReply:value=>{reply=value}};
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
