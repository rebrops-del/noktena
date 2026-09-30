((root,factory)=>{
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.NoktenaCityCatalogCore=api;
})(typeof window!=='undefined'?window:null,()=>{
  'use strict';
  const KEY='settings:city_catalogs_v1';
  const TEXT_LIMITS=Object.freeze({hero_description:500,delivery_description:350,service_description:500,about_description:800,seo_title:100,seo_description:250});
  const DEFAULT_CITY={id:'ekaterinburg',name:'Екатеринбург',warehouse:'Берёзовский',delivery_price:null,...Object.fromEntries(Object.keys(TEXT_LIMITS).map(key=>[key,'']))};
  const validId=id=>/^[a-z0-9][a-z0-9-]{0,47}$/.test(String(id||''));
  const keyFor=(kind,product)=>String(product?._catalogKey||product?._key||`${kind}:${kind==='furniture'?product?.id||'':product?.model||''}`);
  function normalize(payload){
    const raw=payload&&typeof payload==='object'?payload:{};
    const cities=[{...DEFAULT_CITY}];
    for(const city of Array.isArray(raw.cities)?raw.cities:[]){
      if(!validId(city?.id))continue;
      const value={id:city.id,name:String(city.name||'').trim().slice(0,80),warehouse:String(city.warehouse||'').trim().slice(0,120),delivery_price:city.delivery_price==null||city.delivery_price===''?null:Math.max(0,Number(city.delivery_price)||0)};
      for(const [key,limit] of Object.entries(TEXT_LIMITS))value[key]=String(city[key]||'').trim().slice(0,limit);
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
    const keys=catalog.keys===null?[...base.keys()]:catalog.keys;
    return keys.filter(key=>key.startsWith(kind+':')).map(key=>{
      const original=base.get(key),override=catalog.products[key];
      if(!original&&!override)return null;
      if(override?.hidden)return null;
      return {...(original||{}),...(override||{}),_catalogKey:key};
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
  return Object.freeze({KEY,DEFAULT_CITY,TEXT_LIMITS,normalize,keyFor,applyCatalog,fromBootstrap,removeCity});
});
