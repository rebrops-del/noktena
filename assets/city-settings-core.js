((root,factory)=>{
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.NoktenaCitySettings=api;
})(typeof window!=='undefined'?window:null,()=>{
  'use strict';
  const BASE_CITY='ekaterinburg';
  const CITY_KEYS=Object.freeze(['settings:contacts_v1','settings:popular_v1','settings:home_banners_v1','settings:hero_v1','settings:seo_v1','settings:category_prices_v1','settings:promo_global_v1','settings:discount_global_v1','settings:order_notifications_v1']);
  const validCity=id=>/^[a-z0-9][a-z0-9-]{0,47}$/.test(String(id||''));
  function key(base,cityId=BASE_CITY){
    if(!/^settings:[a-z0-9_]+$/.test(base))throw new Error('Некорректный ключ настройки');
    if(!validCity(cityId))throw new Error('Некорректный город');
    return cityId===BASE_CITY?base:base+':city:'+cityId;
  }
  function cityId(){
    if(typeof window==='undefined')return BASE_CITY;
    const selected=window.NoktenaCityAdmin?.currentCity()?.id||window.NoktenaCities?.id();
    if(selected)return selected;
    let remembered='';try{remembered=localStorage.getItem('noktena-selected-city-v1')||''}catch{}
    const cities=(window.NOKTENA_CATALOG_BOOTSTRAP?.rows||[]).find(row=>row.product_key==='settings:city_catalogs_v1')?.payload?.cities||[];
    return cities.some(city=>city.id===remembered)?remembered:BASE_CITY;
  }
  function ownRow(rows,base,id=cityId()){return (rows||[]).find(row=>row.product_key===key(base,id))}
  function payload(rows,base,id=cityId(),inherit=true){return (ownRow(rows,base,id)||(inherit&&id!==BASE_CITY?ownRow(rows,base,BASE_CITY):null))?.payload||null}
  function seo(rows,id=cityId()){
    const saved=ownRow(rows,'settings:seo_v1',id)?.payload;
    if(saved||id===BASE_CITY)return saved||null;
    const city=(rows||[]).find(row=>row.product_key==='settings:city_catalogs_v1')?.payload?.cities?.find(value=>value.id===id);
    const name=city?.name||'вашем городе';
    return {...(payload(rows,'settings:seo_v1',BASE_CITY)||{}),history:[],home_title:city?.seo_title||`Матрасы, кровати и диваны — НОКТЕНА, г. ${name}`,home_description:city?.seo_description||`Матрасы, кровати и диваны в г. ${name}. Подбор размера, заказ онлайн и доставка. Условия подтвердит менеджер.`};
  }
  return Object.freeze({BASE_CITY,CITY_KEYS,key,cityId,ownRow,payload,seo});
});
