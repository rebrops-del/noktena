(()=>{
  'use strict';

  const COUNTER_ID=Number(window.NOKTENA_METRIKA_ID||0);
  const CART_KEY='noktena-cart-v1';
  const CURRENCY='RUB';
  const goal=(name,params={})=>{
    if(!COUNTER_ID||typeof window.ym!=='function')return;
    try{window.ym(COUNTER_ID,'reachGoal',name,params)}catch{}
  };
  const money=n=>Math.max(0,Number(n)||0);
  const text=(el)=>String(el?.textContent||'').trim();
  const parseMoney=v=>{
    const m=String(v||'').replace(/\s/g,'').match(/\d+/g)||[];
    return m.length?Number(m.join('')):0;
  };
  const categoryName=v=>v==='beds'?'Кровати':v==='sofas'?'Диваны':'Матрасы';
  const product=(x,qty)=>({
    id:String(x?.key||x?.id||x?.name||''),
    name:String(x?.name||x?.key||'Товар'),
    price:money(x?.price),
    brand:'НОКТЕНА',
    category:categoryName(x?.category),
    variant:[x?.size,x?.color].filter(Boolean).join(' / '),
    quantity:Math.max(1,Number(qty??x?.qty)||1)
  });

  window.dataLayer=window.dataLayer||[];
  function ecommerce(action,products,actionField){
    const payload={currencyCode:CURRENCY};
    payload[action]={products:(products||[]).map((x)=>x.id?x:product(x))};
    if(actionField)payload[action].actionField=actionField;
    window.dataLayer.push({ecommerce:payload});
  }

  function loadCounter(){
    if(!COUNTER_ID)return;
    (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(let j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r)return}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym');
    window.ym(COUNTER_ID,'init',{
      clickmap:true,
      trackLinks:true,
      accurateTrackBounce:true,
      webvisor:true,
      ecommerce:'dataLayer'
    });
  }

  function readCart(){
    try{const x=JSON.parse(localStorage.getItem(CART_KEY)||'[]');return Array.isArray(x)?x:[]}catch{return[]}
  }
  const signature=x=>[x?.kind,x?.key,x?.size||'',x?.color||'',Number(x?.price)||0].join('|');
  let previousCart=readCart().map(x=>({...x}));
  function cartDiff(next){
    const prevMap=new Map(previousCart.map(x=>[signature(x),x]));
    const nextMap=new Map(next.map(x=>[signature(x),x]));
    const added=[],removed=[];
    for(const [k,x] of nextMap){
      const old=prevMap.get(k),d=(Number(x.qty)||1)-(Number(old?.qty)||0);
      if(d>0)added.push(product(x,d));
    }
    for(const [k,x] of prevMap){
      const now=nextMap.get(k),d=(Number(x.qty)||1)-(Number(now?.qty)||0);
      if(d>0)removed.push(product(x,d));
    }
    if(added.length){
      ecommerce('add',added);
      goal('ADD_TO_CART',{items:added,cart_value:next.reduce((s,x)=>s+money(x.price)*(Number(x.qty)||1),0)});
    }
    if(removed.length){
      ecommerce('remove',removed);
      goal('REMOVE_FROM_CART',{items:removed});
    }
    previousCart=next.map(x=>({...x}));
  }

  function detailProduct(){
    const qs=new URLSearchParams(location.search),kind=qs.get('kind')||'';
    if(!kind)return null;
    const key=kind==='mattress'?(qs.get('model')||''):(qs.get('id')||'');
    const name=text(document.querySelector('.pd-info-card h1'))||key;
    const price=parseMoney(text(document.querySelector('#pdFurniturePrice,#pdPrice,.pd-info-card .pd-price')));
    if(!name||!price)return null;
    let size='',color='',category='mattress';
    if(kind==='mattress'){
      const s=document.querySelector('#pdVariant');
      if(s)size=String(s.options[s.selectedIndex]?.textContent||'').split('—')[0].trim();
    }else{
      size=String(document.querySelector('[data-pd-size].is-active')?.dataset.pdSize||'').trim();
      color=text(document.querySelector('#pdColorName'));
      const tag=text(document.querySelector('.pd-tags .pd-tag')).toLowerCase();
      category=tag.includes('диван')?'sofas':'beds';
    }
    return{kind,key,name,price,size,color,category};
  }

  function trackDetail(){
    if(!/product\.html$/i.test(location.pathname))return;
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      const item=detailProduct();
      if(item){
        clearInterval(timer);
        ecommerce('detail',[product(item)]);
        goal('VIEW_PRODUCT',{product_id:item.key,product_name:item.name,price:item.price,category:categoryName(item.category)});
      }else if(tries>30)clearInterval(timer);
    },200);
  }

  function trackCheckout(){
    if(!/checkout\.html$/i.test(location.pathname))return;
    if(performance.getEntriesByType?.('navigation')?.[0]?.type==='reload')return;
    const cart=readCart();
    if(!cart.length)return;
    const value=cart.reduce((s,x)=>s+money(x.price)*(Number(x.qty)||1),0);
    goal('BEGIN_CHECKOUT',{cart_value:value,items_count:cart.reduce((s,x)=>s+(Number(x.qty)||1),0)});
  }

  const nativeFetch=window.fetch.bind(window);
  const trackedOrders=new Set();
  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:String(input?.url||'');
    const isOrder=/action=create-order/i.test(url)&&String(init?.method||'GET').toUpperCase()==='POST';
    let requestBody=null;
    if(isOrder){try{requestBody=JSON.parse(String(init?.body||'{}'))}catch{}}
    const response=await nativeFetch(input,init);
    if(isOrder&&response.ok){
      try{
        const copy=response.clone();
        const data=await copy.json();
        if(data?.ok){
          const order=data.order||{};
          const items=(requestBody?.items||[]).map(x=>product({
            key:x.key||x.name,
            name:x.name,
            price:x.price,
            category:x.category,
            size:x.size,
            color:x.color
          },x.qty));
          const revenue=money(order.total||requestBody?.total||items.reduce((s,x)=>s+x.price*x.quantity,0));
          const orderId=String(order.order_no||order.id||'');
          let alreadyTracked=false;
          try{alreadyTracked=!!sessionStorage.getItem(`noktena-purchase:${orderId}`)}catch{}
          if(!orderId||trackedOrders.has(orderId)||alreadyTracked)return response;
          trackedOrders.add(orderId);
          try{sessionStorage.setItem(`noktena-purchase:${orderId}`,'1')}catch{}
          ecommerce('purchase',items,{id:orderId,revenue});
          goal('PURCHASE',{order_id:orderId,order_price:revenue,revenue,currency:CURRENCY,items_count:items.reduce((s,x)=>s+x.quantity,0)});
        }
      }catch{}
    }
    return response;
  };

  document.addEventListener('click',e=>{
    const a=e.target.closest('a,button');
    if(!a)return;
    const href=String(a.getAttribute('href')||'');
    const label=text(a).toLowerCase();
    if(a.matches('.max-btn,.pd-header-max')||/max\.ru/i.test(href)||label.includes('max')){
      goal('MAX_CLICK',{page:location.pathname,href});
      return;
    }
    if(/^tel:/i.test(href)){
      goal('PHONE_CLICK',{phone:href.replace(/^tel:/i,''),page:location.pathname});
      return;
    }
    if(a.matches('.cart-detail-buy'))goal('BUY_CLICK',{page:location.pathname});
    if(a.matches('.product-more-link')||/product\.html/i.test(href))goal('PRODUCT_CLICK',{href,page:location.pathname});
    else if(a.matches('[data-pd-size]:not(.is-active)'))goal('SIZE_SELECT',{value:a.dataset.pdSize,page:location.pathname});
  },true);
  document.addEventListener('click',e=>{
    const card=e.target.closest('[data-product-link]');
    if(!card||e.target.closest('a,button,select,input,textarea,label,summary,details,[data-gallery-dir],[data-card-color],[data-card-size]'))return;
    goal('PRODUCT_CLICK',{href:card.dataset.productLink,page:location.pathname});
  },true);
  document.addEventListener('keydown',e=>{
    if(!['Enter',' '].includes(e.key)||!e.target.matches('[data-product-link]'))return;
    goal('PRODUCT_CLICK',{href:e.target.dataset.productLink,page:location.pathname});
  },true);

  document.addEventListener('change',e=>{
    const el=e.target;
    if(el.matches('.size-select,.f-size-select,#pdVariant'))goal('SIZE_SELECT',{value:String(el.value||''),page:location.pathname});
    if(el.matches('input[name="deliveryMethod"]'))goal('DELIVERY_SELECT',{method:String(el.value||'')});
  },true);

  window.addEventListener('noktena-cart-change',e=>cartDiff(Array.isArray(e.detail?.items)?e.detail.items:readCart()));
  window.addEventListener('storage',e=>{if(e.key===CART_KEY)previousCart=readCart().map(x=>({...x}))});

  loadCounter();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{trackDetail();trackCheckout()});
  else{trackDetail();trackCheckout()}

  window.NoktenaAnalytics=Object.freeze({goal,ecommerce,counterId:COUNTER_ID});
})();
