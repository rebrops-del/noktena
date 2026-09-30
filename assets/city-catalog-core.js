((root,factory)=>{
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.NoktenaCityCatalogCore=api;
})(typeof window!=='undefined'?window:null,()=>{
  'use strict';
  const KEY='settings:city_catalogs_v1';
  const TEXT_LIMITS=Object.freeze({hero_description:500,delivery_description:350,service_description:500,about_description:800,seo_title:100,seo_description:250});
  const DELIVERY_FIELDS=Object.freeze(['cargo_lift_price','stair_lift_price','sofa_lift_surcharge','free_delivery_from','bed_assembly_price']);
  const DEFAULT_CITY={id:'ekaterinburg',name:'Екатеринбург',warehouse:'Берёзовский',delivery_price:null,...Object.fromEntries(Object.keys(TEXT_LIMITS).map(key=>[key,'']))};
  const validId=id=>/^[a-z0-9][a-z0-9-]{0,47}$/.test(String(id||''));
  const keyFor=(kind,product)=>String(product?._catalogKey||product?._key||`${kind}:${kind==='furniture'?product?.id||'':product?.model||''}`);
  const amount=(value,fallback=0)=>value==null||value===''?fallback:Math.max(0,Number(value)||0);
  function deliveryForCity(city,global={}){
    const regional=!!city&&city.id!=='ekaterinburg',own=regional&&city.delivery_settings&&typeof city.delivery_settings==='object'?city.delivery_settings:{};
    const result={
      delivery_price:regional?amount(city.delivery_price):amount(global.delivery_price),
      delivery_pending:regional&&city.delivery_price==null,
      cargo_lift_price:amount(own.cargo_lift_price,amount(global.cargo_lift_price)),
      stair_lift_price:amount(own.stair_lift_price,amount(global.stair_lift_price)),
      sofa_lift_surcharge:amount(own.sofa_lift_surcharge,amount(global.sofa_lift_surcharge)),
      free_delivery_from:amount(own.free_delivery_from,regional?0:amount(global.free_delivery_from)),
      bed_assembly_price:amount(own.bed_assembly_price,amount(global.bed_assembly_price,1500)),
      delivery_schedule:String(own.delivery_schedule??(regional?'':global.delivery_schedule??'')).trim()
    };
    return result;
  }
  function normalize(payload){
    const raw=payload&&typeof payload==='object'?payload:{};
    const cities=[{...DEFAULT_CITY}];
    for(const city of Array.isArray(raw.cities)?raw.cities:[]){
      if(!validId(city?.id))continue;
      const value={id:city.id,name:String(city.name||'').trim().slice(0,80),warehouse:String(city.warehouse||'').trim().slice(0,120),delivery_price:city.delivery_price==null||city.delivery_price===''?null:Math.max(0,Number(city.delivery_price)||0)};
      for(const [key,limit] of Object.entries(TEXT_LIMITS))value[key]=String(city[key]||'').trim().slice(0,limit);
      if(city.delivery_settings&&typeof city.delivery_settings==='object'&&!Array.isArray(city.delivery_settings)){
        value.delivery_settings=Object.fromEntries(DELIVERY_FIELDS.filter(key=>Object.hasOwn(city.delivery_settings,key)).map(key=>[key,amount(city.delivery_settings[key])]));
        if(Object.hasOwn(city.delivery_settings,'delivery_schedule'))value.delivery_settings.delivery_schedule=String(city.delivery_settings.delivery_schedule||'').trim().slice(0,200);
      }
      if(city.id===DEFAULT_CITY.id){Object.assign(cities[0],value);continue}
      if(value.name&&!cities.some(x=>x.id===value.id))cities.push(value);
    }
    const catalogs={};
    for(const city of cities){
      const source=raw.catalogs?.[city.id]||{};
      const keys=Array.isArray(source.keys)?[...new Set(source.keys.filter(k=>typeof k==='string'&&/^(mattress|furniture):.{1,180}$/.test(k)))]:city.id===DEFAULT_CITY.id?null:[];
      const products=source.products&&typeof source.products==='object'&&!Array.isArray(source.products)?source.products:{};
      catalogs[city.id]={keys,products};
    }
    return {model:'__city_catalogs_v1__',cities,catalogs};
  }
  function applyCatalog(baseItems,kind,settings,cityId){
    const config=normalize(settings),chosen=config.cities.find(x=>x.id===cityId)||config.cities[0],catalog=config.catalogs[chosen.id];
    const base=new Map((baseItems||[]).map(product=>[keyFor(kind,product),product]));
    const keys=catalog.keys===null?[...new Set([...base.keys(),...Object.keys(catalog.products)])]:catalog.keys;
    return keys.filter(key=>key.startsWith(kind+':')).map(key=>{
      const original=base.get(key),override=catalog.products[key];
      if(!original&&!override)return null;
      if(override?.hidden)return null;
      return {...(original||{}),...(override||{}),_catalogKey:key};
    }).filter(Boolean);
  }
  function adminCatalog(baseItems,settings,cityId){
    const config=normalize(settings),chosen=config.cities.find(x=>x.id===cityId)||config.cities[0],catalog=config.catalogs[chosen.id];
    const base=new Map((baseItems||[]).map(product=>[keyFor(product._kind,product),product]));
    const keys=catalog.keys===null?[...new Set([...base.keys(),...Object.keys(catalog.products)])]:catalog.keys;
    return keys.map(key=>{
      const original=base.get(key),override=catalog.products[key];
      if(!original&&!override)return null;
      return {...(original||{}),...(override||{}),_key:key,_catalogKey:key,_kind:key.split(':')[0],_isCustom:!original,_changed:!!override,_hidden:!!(override?.hidden??original?._hidden)};
    }).filter(Boolean);
  }
  function removeCity(settings,id){
    if(id===DEFAULT_CITY.id)throw new Error('Екатеринбург нельзя удалить');
    const next=normalize(settings);
    if(!next.cities.some(city=>city.id===id))throw new Error('Город не найден');
    next.cities=next.cities.filter(city=>city.id!==id);
    delete next.catalogs[id];
    return next;
  }
  function fromBootstrap(bootstrap){return normalize((bootstrap?.rows||[]).find(row=>row.product_key===KEY)?.payload)}
  return Object.freeze({KEY,DEFAULT_CITY,TEXT_LIMITS,DELIVERY_FIELDS,deliveryForCity,normalize,keyFor,applyCatalog,adminCatalog,fromBootstrap,removeCity});
});
