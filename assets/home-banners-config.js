(() => {
  'use strict';
  const KEY='settings:home_banners_v1';
  const DEFAULT_BANNERS=[{
    id:'bedroom-selection',label:'ПОДБОРКА НОКТЕНА',title:'Уютная спальня начинается с правильного выбора',
    description:'Подберём кровать и матрас под вашу комнату. Расскажем об актуальных предложениях и поможем выбрать размер.',
    button:'Смотреть кровати',link:'#beds',image:'/assets/noktena-editorial-bedroom.webp',
    alt:'Светлая спальня с мягкой кроватью',enabled:true
  }];
  function validImage(raw){
    const value=String(raw||'').trim();
    if(!value)return '';
    if(/^\/(?!\/)[^\s<>\\]*$/.test(value))return value;
    try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:''}catch{return ''}
  }
  function validLink(raw){
    const value=String(raw||'').trim();
    if(/^#[a-z][\w-]*$/i.test(value)||/^\/(?!\/)[^\s<>\\]*$/.test(value))return value;
    try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:''}catch{return ''}
  }
  function normalise(banner,index){
    if(!banner||typeof banner!=='object')return null;
    return {
      id:String(banner.id||'banner-'+index).slice(0,80),
      label:String(banner.label||'').trim().slice(0,60),title:String(banner.title||'').trim().slice(0,100),
      description:String(banner.description||'').trim().slice(0,240),
      button:String(banner.button||'').trim().slice(0,50),link:validLink(banner.link),
      image:validImage(banner.image),alt:String(banner.alt||'').trim().slice(0,160),enabled:banner.enabled!==false
    };
  }
  function fromPayload(payload){
    const source=payload==null?DEFAULT_BANNERS:payload.banners;
    return Array.isArray(source)?source.slice(0,8).map(normalise).filter(Boolean):[];
  }
  window.NoktenaHomeBanners={KEY,DEFAULT_BANNERS,normalise,fromPayload,validImage,validLink};
})();
