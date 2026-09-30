const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

test('delivery editor saves a regional price independently and keeps all global fields for Ekaterinburg',async()=>{
  const elements=new Map();
  const element=(id,value='')=>({value,hidden:false,disabled:false,listeners:{},classList:{add(){}},addEventListener(type,fn){this.listeners[type]=fn}});
  for(const [id,value] of Object.entries({
    '#deliveryCitySelect':'', '#deliveryGlobalFields':'', '#deliveryRegionalFields':'', '#regionalDeliveryPrice':'',
    '#globalBedAssemblyPrice':'', '#globalDeliveryPrice':'1500', '#globalLiftPrice':'600', '#globalStairLiftPrice':'300',
    '#globalSofaLiftSurcharge':'400', '#globalFreeDeliveryFrom':'0', '#globalDeliverySchedule':'Вторник / Пятница'
  }))elements.set(id,element(id,value));
  const select=elements.get('#deliveryCitySelect');
  select.replaceChildren=function(){this.options=[]};select.append=function(option){this.options.push(option)};
  const submit=element('submit');
  const form=element('form');form.querySelector=()=>submit;
  elements.set('#deliverySettingsForm',form);
  elements.set('#deliverySettingsForm .delivery-settings-grid',element('grid'));
  elements.set('#deliverySettingsModal',element('modal'));
  let selected='city-kazan';
  const cities=[{id:'ekaterinburg',name:'Екатеринбург',delivery_price:null},{id:'city-kazan',name:'Казань',delivery_price:990}];
  const regionalWrites=[],globalWrites=[];
  const manager={currentCity:()=>cities.find(city=>city.id===selected),cities:()=>cities,selectCity(id){selected=id},
    async saveDeliveryPrice(id,price){regionalWrites.push([id,price]);cities[1].delivery_price=Number(price)}};
  const context={window:{NoktenaCityAdmin:manager},document:{querySelector:selector=>elements.get(selector)||null,createElement:()=>({})},
    localStorage:{getItem:()=>JSON.stringify({access_token:'test'})},
    fetch:async(url,options)=>{globalWrites.push({action:new URL(url).searchParams.get('action'),body:JSON.parse(options.body)});return{ok:true,json:async()=>({ok:true})}},
    toast:()=>{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../admin/cart-settings.js'),'utf8'),context);
  context.window.NoktenaAdminDeliveryUi.render({bed_assembly_price:1800});
  assert.equal(select.value,'city-kazan');
  assert.equal(elements.get('#regionalDeliveryPrice').value,990);
  assert.equal(elements.get('#deliveryGlobalFields').hidden,true);
  elements.get('#regionalDeliveryPrice').value='1200';
  await form.listeners.submit({preventDefault(){},stopImmediatePropagation(){},currentTarget:form});
  assert.deepEqual(regionalWrites,[['city-kazan','1200']]);
  assert.equal(globalWrites.length,0);
  assert.equal(submit.disabled,false);

  select.listeners.change({target:{value:'ekaterinburg'}});
  assert.equal(elements.get('#deliveryGlobalFields').hidden,false);
  assert.equal(elements.get('#deliveryRegionalFields').hidden,true);
  assert.equal(elements.get('#globalBedAssemblyPrice').value,1800);
  await form.listeners.submit({preventDefault(){},stopImmediatePropagation(){},currentTarget:form});
  assert.deepEqual(globalWrites.map(write=>write.action),['delivery-settings-save','save']);
  assert.equal(globalWrites[1].body.item.bed_assembly_price,1800);
  assert.equal(globalWrites[1].body.key,'settings:delivery_v2');
});
