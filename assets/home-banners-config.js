(() => {
  'use strict';
  const KEY='settings:home_banners_v1';
  const DEFAULT_MAX='https://max.ru/u/f9LHodD0cOKZqie3BJvn11xgsNvxJK_kFOqYtKyFuZ2uMitoxZIwNaH8-NY';
  const DESTINATIONS=[
    {value:'#mattresses',label:'Каталог матрасов',hint:'Откроет раздел матрасов',button:'Смотреть матрасы'},
    {value:'#beds',label:'Каталог кроватей',hint:'Откроет раздел кроватей',button:'Смотреть кровати'},
    {value:'#sofas',label:'Каталог диванов',hint:'Откроет раздел диванов',button:'Смотреть диваны'},
    {value:'#homeHits',label:'Популярные модели',hint:'Покажет подборку популярных товаров',button:'Смотреть модели'},
    {value:'#delivery',label:'Доставка и подъём',hint:'Откроет раздел с условиями доставки',button:'Условия доставки'},
    {value:'#guide',label:'Как выбрать матрас',hint:'Откроет советы по выбору',button:'Как выбрать'},
    {value:'contact:max',label:'Написать в MAX',hint:'Откроет чат по ссылке из раздела «Контакты»',button:'Написать в MAX'},
    {value:'contact:phone',label:'Позвонить',hint:'Позвонит по номеру из раздела «Контакты»',button:'Позвонить'}
  ];
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
    if(value==='contact:max'||value==='contact:phone')return value;
    if(/^#[a-z][\w-]*$/i.test(value)||/^\/(?!\/)[^\s<>\\]*$/.test(value))return value;
    try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:''}catch{return ''}
  }
  function resolveLink(raw,contacts={}){
    const value=validLink(raw);
    if(value==='contact:max'){
      const url=validLink(contacts?.max_url)||DEFAULT_MAX;
      try{const parsed=new URL(url);return ['max.ru','www.max.ru'].includes(parsed.hostname)&&parsed.pathname!=='/'&&!parsed.port?parsed.href:DEFAULT_MAX}catch{return DEFAULT_MAX}
    }
    if(value==='contact:phone'){
      const phone=String(contacts?.phone_href||'tel:+79321207635');
      return /^tel:\+7\d{10}$/.test(phone)?phone:'tel:+79321207635';
    }
    return value;
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
  window.NoktenaHomeBanners={KEY,DEFAULT_BANNERS,DESTINATIONS,normalise,fromPayload,validImage,validLink,resolveLink};
})();
