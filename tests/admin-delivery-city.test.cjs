const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const core=require('../assets/city-catalog-core.js');

test('delivery editor shows every field for each city and saves regional services separately',async()=>{
  const elements=new Map();
  const element=(id,value='')=>({value,hidden:false,disabled:false,listeners:{},classList:{add(){},contains(){return false}},addEventListener(type,fn){this.listeners[type]=fn}});
  for(const [id,value] of Object.entries({
    '#globalDeliveryPriceWrap':'', '#regionalDeliveryPriceWrap':'', '#deliveryRegionalFields':'', '#regionalDeliveryPrice':'',
    '#globalBedAssemblyPrice':'', '#globalDeliveryPrice':'1500', '#globalLiftPrice':'600', '#globalStairLiftPrice':'300',
    '#globalSofaLiftSurcharge':'400', '#globalFreeDeliveryFrom':'0', '#globalDeliverySchedule':'Вторник / Пятница'
  }))elements.set(id,element(id,value));
  const submit=element('submit');
  const form=element('form');form.querySelector=()=>submit;
  elements.set('#deliverySettingsForm',form);
  elements.set('#deliverySettingsForm .delivery-settings-grid',element('grid'));
  elements.set('#deliverySettingsModal',element('modal'));
  let selected='city-kazan';
  const cities=[{id:'ekaterinburg',name:'Екатеринбург',delivery_price:null},{id:'city-kazan',name:'Казань',delivery_price:990}];
  const regionalWrites=[],globalWrites=[];
  const manager={currentCity:()=>cities.find(city=>city.id===selected),cities:()=>cities,selectCity(id){selected=id},
    async saveDeliverySettings(id,options){regionalWrites.push({id,options});cities[1].delivery_price=Number(options.delivery_price);cities[1].delivery_settings={...options}}};
  const listeners={};
  const context={window:{NoktenaCityAdmin:manager,NoktenaCityCatalogCore:core},document:{querySelector:selector=>elements.get(selector)||null,createElement:()=>({}),addEventListener(type,handler){listeners[type]=handler}},
    localStorage:{getItem:()=>JSON.stringify({access_token:'test'})},
    fetch:async(url,options)=>{globalWrites.push({action:new URL(url).searchParams.get('action'),body:JSON.parse(options.body)});return{ok:true,json:async()=>({ok:true})}},
    toast:()=>{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../admin/cart-settings.js'),'utf8'),context);
  context.window.NoktenaAdminDeliveryUi.render({delivery_price:1500,cargo_lift_price:600,stair_lift_price:300,sofa_lift_surcharge:400,free_delivery_from:10000,bed_assembly_price:1800,delivery_schedule:'Пятница'});
  assert.equal(elements.get('#regionalDeliveryPrice').value,990);
  assert.equal(elements.get('#globalDeliveryPriceWrap').hidden,true);
  assert.equal(elements.get('#regionalDeliveryPriceWrap').hidden,false);
  assert.equal(elements.get('#globalLiftPrice').value,600);
  assert.equal(elements.get('#globalFreeDeliveryFrom').value,0);
  assert.equal(elements.get('#globalDeliverySchedule').value,'');
  elements.get('#regionalDeliveryPrice').value='1200';
  elements.get('#globalLiftPrice').value='750';
  elements.get('#globalStairLiftPrice').value='450';
  elements.get('#globalSofaLiftSurcharge').value='250';
  elements.get('#globalFreeDeliveryFrom').value='25000';
  elements.get('#globalBedAssemblyPrice').value='1300';
  elements.get('#globalDeliverySchedule').value='Среда';
  await form.listeners.submit({preventDefault(){},stopImmediatePropagation(){},currentTarget:form});
  assert.equal(regionalWrites.length,1);
  assert.equal(regionalWrites[0].id,'city-kazan');
  assert.deepEqual(JSON.parse(JSON.stringify(regionalWrites[0].options)),{delivery_price:'1200',cargo_lift_price:'750',stair_lift_price:'450',sofa_lift_surcharge:'250',free_delivery_from:'25000',bed_assembly_price:'1300',delivery_schedule:'Среда'});
  assert.equal(globalWrites.length,0);
  assert.equal(submit.disabled,false);

  selected='ekaterinburg';listeners['noktena:admin-city-change']();
  assert.equal(elements.get('#globalDeliveryPriceWrap').hidden,false);
  assert.equal(elements.get('#regionalDeliveryPriceWrap').hidden,true);
  assert.equal(elements.get('#deliveryRegionalFields').hidden,true);
  assert.equal(elements.get('#globalBedAssemblyPrice').value,1800);
  assert.equal(elements.get('#globalLiftPrice').value,600);
  assert.equal(elements.get('#globalDeliverySchedule').value,'Пятница');
  await form.listeners.submit({preventDefault(){},stopImmediatePropagation(){},currentTarget:form});
  assert.deepEqual(globalWrites.map(write=>write.action),['delivery-settings-save','save']);
  assert.equal(globalWrites[1].body.item.bed_assembly_price,1800);
  assert.equal(globalWrites[1].body.key,'settings:delivery_v2');
  selected='city-kazan';listeners['noktena:admin-city-change']();
  assert.equal(elements.get('#globalLiftPrice').value,750);
  assert.equal(elements.get('#globalFreeDeliveryFrom').value,25000);
  assert.equal(elements.get('#globalDeliverySchedule').value,'Среда');
});
