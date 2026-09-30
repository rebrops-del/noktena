const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const citySettings=require('../assets/city-settings-core.js');

test('contact settings update links and structured data without repeated DOM writes',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../assets/contact-settings.js'),'utf8');
  let writes=0,notify;
  const phone={textContent:'+7 (932) 120-76-35',href:'tel:+79321207635',
    getAttribute(){return this.href},setAttribute(key,value){this.href=value;writes++}};
  const max={_href:'https://max.ru/u/old',
    get href(){return this._href},set href(value){this._href=value;writes++}};
  const store={textContent:JSON.stringify({'@type':'Store',telephone:'+79321207635',sameAs:['https://max.ru/u/old']})};
  const containers=Array.from({length:2},()=>({dataset:{},hidden:true,children:[],
    replaceChildren(...nodes){this.children=nodes;writes++}}));
  const makeNode=()=>({children:[],append(...nodes){this.children.push(...nodes)},setAttribute(name,value){this[name]=value}});
  const document={readyState:'complete',documentElement:{},
    querySelectorAll(selector){return selector==='a[href^="tel:"]'?[phone]:selector==='[data-contact-socials]'?containers:[max]},
    querySelector(){return store},createElement:makeNode};
  vm.runInNewContext(source,{window:{NOKTENA_CATALOG_BOOTSTRAP:{rows:[
      {product_key:'settings:contacts_v1',payload:{phone:'+7 (900) 555-01-22',max_url:'https://max.ru/u/new',
        telegram_url:'https://t.me/noktena',whatsapp_url:'https://wa.me/79005550122',vk_url:'https://vk.com/noktena'}}
    ]}},document,URL,MutationObserver:class{constructor(callback){notify=callback}observe(){}},
    requestAnimationFrame(callback){callback()}});
  assert.equal(phone.href,'tel:+79005550122');
  assert.equal(phone.textContent,'+7 (900) 555-01-22');
  assert.equal(max.href,'https://max.ru/u/new');
  assert.equal(JSON.parse(store.textContent).telephone,'+79005550122');
  assert.equal(containers[0].hidden,false);
  assert.deepEqual(containers[0].children.map(link=>link.children[1].textContent),['Telegram','WhatsApp','VK']);
  assert.deepEqual(containers[0].children.map(link=>link.children[0].children[0].src),[
    '/assets/brand-telegram.svg','/assets/brand-whatsapp.svg','/assets/brand-vk.svg']);
  assert.equal(containers[0].children[0].href,'https://t.me/noktena');
  assert.equal(containers[1].children.length,3);
  assert.equal(JSON.parse(store.textContent).sameAs.length,4);
  const previous=writes;
  notify();
  assert.equal(writes,previous);
  vm.runInNewContext(source,{window:{NOKTENA_CATALOG_BOOTSTRAP:{rows:[
    {product_key:'settings:contacts_v1',payload:{phone:'+7 (900) 555-01-22',max_url:'https://max.ru/u/new',
      telegram_url:'',whatsapp_url:'https://example.com/invalid',vk_url:''}}
  ]}},document,URL,MutationObserver:class{observe(){}},requestAnimationFrame(callback){callback()}});
  assert.equal(containers[0].hidden,true);
  assert.equal(containers[1].children.length,0);
});

test('admin forms save validated contacts and ordered popular models',async()=>{
  const source=fs.readFileSync(path.join(__dirname,'../admin/store-settings.js'),'utf8');
  const nodes=new Map(),saved=[],messages=[];
  function element(id){
    if(!nodes.has(id))nodes.set(id,{id,value:'',innerHTML:'',handlers:{},
      classList:{add(){},remove(){},contains(){return true}},
      addEventListener(type,handler){this.handlers[type]=handler},
      querySelector(){return this.submit||(this.submit={disabled:false})},
      reset(){},focus(){}});
    return nodes.get(id);
  }
  const document={activeElement:{focus(){}},getElementById:element,
    querySelector:element,querySelectorAll:selector=>selector==='[data-popular-slot]'?element('popularSlots').slots:[],
    addEventListener(){}};
  const context={document,window:{NoktenaCitySettings:citySettings},URL,items:[
      {_key:'furniture:bed',_kind:'furniture',category:'beds',id:'bed',title:'Кровать'},
      {_key:'mattress:mat',_kind:'mattress',model:'mat',variants:[{size:'800×2000',price:7000}]}
    ],productName:item=>item.title||item.model,toast:(message,error)=>messages.push({message,error}),console,
    request:async(action,options)=>{assert.equal(action,'save');saved.push(JSON.parse(options.body));return{ok:true}},
    fetch:async()=>({ok:true,text:async()=> 'window.NOKTENA_CATALOG_BOOTSTRAP={"rows":[]};'}),
    saveSession(){}};
  vm.runInNewContext(source,context);
  await element('[data-admin-open="contacts"]').handlers.click();
  element('storePhone').value='+7 (900) 555-01-22';
  element('storeMaxUrl').value='https://max.ru/u/new';
  element('storeTelegramUrl').value='https://t.me/noktena';
  element('storeWhatsappUrl').value='https://wa.me/79005550122';
  element('storeVkUrl').value='https://vk.com/noktena';
  await element('contactsForm').handlers.submit({preventDefault(){},currentTarget:element('contactsForm')});
  assert.equal(saved[0].key,'settings:contacts_v1');
  assert.equal(saved[0].item.phone_href,'tel:+79005550122');
  assert.equal(saved[0].item.telegram_url,'https://t.me/noktena');
  assert.equal(saved[0].item.whatsapp_url,'https://wa.me/79005550122');
  assert.equal(saved[0].item.vk_url,'https://vk.com/noktena');
  element('storeWhatsappUrl').value='https://example.com/redirect';
  await element('contactsForm').handlers.submit({preventDefault(){},currentTarget:element('contactsForm')});
  assert.equal(saved.length,1);
  assert.match(messages.at(-1).message,/WhatsApp/);
  await element('[data-admin-open="popular"]').handlers.click();
  element('popularSlots').slots=[{value:'mattress:mat'},{value:'furniture:bed'}];
  await element('popularForm').handlers.submit({preventDefault(){},currentTarget:element('popularForm')});
  assert.equal(saved[1].key,'settings:popular_v1');
  assert.deepEqual(saved[1].item.keys,['mattress:mat','furniture:bed']);
});

test('password endpoint requires admin auth and checks the old password',async()=>{
  let handler;
  globalThis.Deno={env:{get:()=> 'test-key'},serve:fn=>{handler=fn}};
  await import('../supabase/functions/noktena-admin-api/index.ts');
  const events=[],originalFetch=globalThis.fetch;
  globalThis.fetch=async(url,options={})=>{
    events.push({url,method:options.method||'GET',body:options.body});
    if(url.includes('/auth/v1/user')&&options.method==='PUT')return Response.json({id:'owner'});
    if(url.includes('/auth/v1/user'))return Response.json({id:'owner',email:'owner@example.test'});
    if(url.includes('/rest/v1/admin_users'))return Response.json([{user_id:'owner'}]);
    if(url.includes('/auth/v1/token?grant_type=password'))return options.body.includes('incorrect')
      ?Response.json({}, {status:400}):Response.json({access_token:'fresh-token'});
    throw Error('Unexpected request: '+url);
  };
  function makeReq(current,auth){
    return new Request('https://example.test/?action=change-password',{
      method:'POST',headers:{'content-type':'application/json',...(auth?{Authorization:'Bearer test-token'}:{})},
      body:JSON.stringify({current_password:current,new_password:'a-valid-new-password-123'})
    });
  }
  try{
    assert.equal((await handler(makeReq('correct',false))).status,401);
    assert.equal(events.length,0);
    const invalid=await handler(makeReq('incorrect',true));
    assert.equal(invalid.status,400);
    assert.equal((await invalid.json()).error,'INVALID_CURRENT_PASSWORD');
    assert.equal(events.filter(x=>x.method==='PUT').length,0);
    const success=await handler(makeReq('correct',true));
    assert.equal(success.status,200);
    assert.equal((await success.json()).ok,true);
    const changed=events.find(x=>x.method==='PUT');
    assert.equal(JSON.parse(changed.body).password,'a-valid-new-password-123');
    assert.equal(JSON.parse(changed.body).current_password,'correct');
  }finally{globalThis.fetch=originalFetch;delete globalThis.Deno}
});
