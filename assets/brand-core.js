((root,factory)=>{
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.NoktenaBrandCore=api;
})(typeof window!=='undefined'?window:null,()=>{
  'use strict';
  const KEY='settings:brand_v1';
  const DEFAULTS=Object.freeze({name:'НОКТЕНА',logo_url:'',site_color:'#243a31',admin_color:'#25372e',accent_color:'#a3815f',previous_names:[]});
  const color=value=>/^#[0-9a-f]{6}$/i.test(String(value||''))?String(value).toLowerCase():'';
  function logoUrl(value){
    if(!value)return '';
    try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:''}catch{return ''}
  }
  function contrastWithWhite(hex){
    const channels=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
    return 1/(.2126*channels[0]+.7152*channels[1]+.0722*channels[2]+.05);
  }
  function normalize(value){
    const source=value&&typeof value==='object'?value:{};
    const name=String(source.name||'').trim().slice(0,80)||DEFAULTS.name;
    const previous_names=[...new Set((Array.isArray(source.previous_names)?source.previous_names:[]).map(v=>String(v||'').trim().slice(0,80)).filter(v=>v&&v!==name&&v!==DEFAULTS.name))].slice(-10);
    return {
      name,
      logo_url:logoUrl(source.logo_url),
      site_color:color(source.site_color)||DEFAULTS.site_color,
      admin_color:color(source.admin_color)||DEFAULTS.admin_color,
      accent_color:color(source.accent_color)||DEFAULTS.accent_color,
      previous_names
    };
  }
  function validate(value){
    const name=String(value?.name||'').trim();
    if(!name||name.length>80||/[<>\r\n]/.test(name))throw new Error('Укажите название до 80 символов без переносов и угловых скобок');
    if(value.logo_url&&!logoUrl(value.logo_url))throw new Error('Для логотипа нужна публичная ссылка HTTPS');
    for(const field of ['site_color','admin_color','accent_color'])if(!color(value[field]))throw new Error('Укажите цвет в формате #RRGGBB');
    for(const field of ['site_color','admin_color'])if(contrastWithWhite(value[field])<4.5)throw new Error('Основной цвет должен быть темнее, чтобы белый текст на нём читался');
    return normalize(value);
  }
  function fromRows(rows){return normalize((rows||[]).find(row=>row.product_key===KEY)?.payload)}
  function replace(value,name,previous=[]){
    let result=String(value??'').replace(/НОКТЕН(?:А|Ы|Е)/gi,name);
    for(const old of previous){
      const escaped=old.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      result=result.replace(new RegExp('(?<![\\p{L}\\p{N}])'+escaped+'(?![\\p{L}\\p{N}])','giu'),name);
    }
    return result;
  }
  return Object.freeze({KEY,DEFAULTS,color,logoUrl,contrastWithWhite,normalize,validate,fromRows,replace});
});
