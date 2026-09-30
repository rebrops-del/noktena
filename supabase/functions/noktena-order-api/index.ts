const SUPABASE_URL=Deno.env.get('SUPABASE_URL')||'';
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
function cors(){return {'access-control-allow-origin':'*','access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'content-type','cache-control':'no-store'}}
function J(x:unknown,s=200){return new Response(JSON.stringify(x),{status:s,headers:{...cors(),'content-type':'application/json; charset=utf-8'}})}
const svc=(x:Record<string,string>={})=>({apikey:SERVICE_KEY,Authorization:'Bearer '+SERVICE_KEY,...x});
function text(v:any,max=500){return String(v??'').trim().slice(0,max)}
function numberValue(v:any,name:string,min:number,max:number){const n=Number(v);if(!Number.isFinite(n)||n<min||n>max)throw new Error('BAD_'+name.toUpperCase());return n}
async function deliverySettings(){const r=await fetch(SUPABASE_URL+'/rest/v1/catalog_overrides?select=payload&product_key=eq.'+encodeURIComponent('settings:delivery_v2')+'&limit=1',{headers:svc({Accept:'application/json'})});if(!r.ok)throw new Error('SETTINGS_UNAVAILABLE');const rows=await r.json();return rows[0]?.payload||{}}
async function cityCatalogSettings(){
  const r=await fetch(SUPABASE_URL+'/rest/v1/catalog_overrides?select=payload&product_key=eq.'+encodeURIComponent('settings:city_catalogs_v1')+'&limit=1',{headers:svc({Accept:'application/json'})});
  if(!r.ok)throw new Error('CITY_SETTINGS_UNAVAILABLE');
  const rows=await r.json();return rows[0]?.payload||{};
}
async function createOrder(req:Request){
  const b=await req.json();
  const name=text(b.customer_name,120),phone=text(b.phone,60);
  if(name.length<2)throw new Error('NAME_REQUIRED');if(phone.length<5)throw new Error('PHONE_REQUIRED');
  const cityId=text(b.city_id,48)||'ekaterinburg',config=await cityCatalogSettings(),cities=Array.isArray(config.cities)?config.cities:[];
  const city=cityId==='ekaterinburg'?cities.find((c:any)=>c.id==='ekaterinburg')||{id:'ekaterinburg',name:'Екатеринбург',warehouse:'Берёзовский'}:cities.find((c:any)=>c.id===cityId);
  if(!city)throw new Error('CITY_UNAVAILABLE');
  const available=config.catalogs?.[cityId]||{keys:cityId==='ekaterinburg'?null:[],products:{}};
  const allowed=cityId==='ekaterinburg'&&!Array.isArray(available.keys)?null:new Set<string>(Array.isArray(available.keys)?available.keys:[]);
  const rawItems=Array.isArray(b.items)?b.items:[];if(!rawItems.length||rawItems.length>50)throw new Error('ITEMS_REQUIRED');
  for(const x of rawItems){
    const key=text(x.catalog_key,190)||text(x.kind,20)+':'+text(x.key,180);
    if((allowed&&!allowed.has(key))||available.products?.[key]?.hidden)throw new Error('PRODUCT_UNAVAILABLE');
  }
  const items=rawItems.map((x:any)=>{
    const qty=Math.max(1,Math.min(20,Math.round(numberValue(x.qty||1,'qty',1,20))));
    const method=['none','cargo','stairs'].includes(String(x.lift_method))?String(x.lift_method):'none';
    const liftQty=method==='none'?0:Math.max(0,Math.min(qty,Math.round(Number(x.lift_qty)||0)));
    const liftFloor=method==='stairs'&&liftQty>0?Math.max(1,Math.min(50,Math.round(Number(x.lift_floor)||1))):0;
    return{kind:text(x.kind,20),category:text(x.category,20),key:text(x.key,180),catalog_key:text(x.catalog_key,190)||text(x.kind,20)+':'+text(x.key,180),name:text(x.name,220),size:text(x.size,100),color:text(x.color,120),price:numberValue(x.price,'item_price',0,10000000),qty,url:text(x.url,500),lift_method:liftQty>0?method:'none',lift_qty:liftQty,lift_floor:liftFloor,lift_cost:0};
  });
  const subtotal=items.reduce((s:number,x:any)=>s+x.price*x.qty,0),s=await deliverySettings();
  const deliveryMethod=['delivery','pickup'].includes(String(b.delivery_method))?String(b.delivery_method):'delivery';
  if(cityId!=='ekaterinburg'&&deliveryMethod==='pickup'&&!city.warehouse)throw new Error('PICKUP_UNAVAILABLE');
  const regional=cityId!=='ekaterinburg',own=regional&&city.delivery_settings&&typeof city.delivery_settings==='object'?city.delivery_settings:{};
  const deliveryPrice=regional?Math.max(0,Number(city.delivery_price)||0):Math.max(0,Number(s.delivery_price)||0);
  const freeFrom=Math.max(0,Number(regional?own.free_delivery_from??0:s.free_delivery_from)||0);
  const deliveryCost=deliveryMethod==='pickup'||(freeFrom>0&&subtotal>=freeFrom)?0:deliveryPrice;
  const cargo=Math.max(0,Number(own.cargo_lift_price??s.cargo_lift_price)||0),stairs=Math.max(0,Number(own.stair_lift_price??s.stair_lift_price)||0),sofaSurcharge=Math.max(0,Number(own.sofa_lift_surcharge??s.sofa_lift_surcharge)||0),assemblyPrice=Math.max(0,Number(own.bed_assembly_price??s.bed_assembly_price??1500)||0);
  let liftCost=0,liftCount=0;const methods=new Set<string>();let maxFloor=0;
  for(const x of items){
    if(deliveryMethod!=='delivery'){x.lift_method='none';x.lift_qty=0;x.lift_floor=0;x.lift_cost=0;continue}
    const q=Number(x.lift_qty)||0;if(q<=0||x.lift_method==='none')continue;
    let cost=0;if(x.lift_method==='cargo')cost=cargo*q;if(x.lift_method==='stairs'){cost=stairs*Math.max(1,Number(x.lift_floor)||1)*q;maxFloor=Math.max(maxFloor,Number(x.lift_floor)||0)}
    if(x.category==='sofas')cost+=sofaSurcharge*q;x.lift_cost=cost;liftCost+=cost;liftCount+=q;methods.add(x.lift_method);
  }
  const bedQty=items.filter((x:any)=>x.category==='beds').reduce((n:number,x:any)=>n+x.qty,0);
  const requestedAssembly=Math.max(0,Math.round(Number(b.assembly_qty)||0));const assemblyQty=!!b.assembly_requested&&bedQty>0?Math.min(bedQty,requestedAssembly||bedQty):0;const assemblyCost=assemblyQty*assemblyPrice;
  const total=subtotal+deliveryCost+liftCost+assemblyCost;const liftMethod=methods.size===0?'none':methods.size===1?[...methods][0]:'mixed';
  const row={status:'new',customer_name:name,phone,email:text(b.email,160)||null,city:text(city.name,120),address:text(b.address,300)||null,comment:text(b.comment,1200)||null,delivery_method:deliveryMethod,lift_method:liftMethod,floor:maxFloor,assembly_requested:assemblyQty>0,assembly_qty:assemblyQty,lift_count:liftCount,items,subtotal,delivery_cost:deliveryCost,lift_cost:liftCost,assembly_cost:assemblyCost,total,source:'noktena.ru'};
  const r=await fetch(SUPABASE_URL+'/rest/v1/orders',{method:'POST',headers:svc({'content-type':'application/json',Prefer:'return=representation'}),body:JSON.stringify(row)});const data=await r.json().catch(()=>[]);if(!r.ok)throw new Error('ORDER_SAVE_FAILED');const order=data[0]||{};
  return{order_no:order.order_no,total:Number(order.total||total),created_at:order.created_at||new Date().toISOString(),lift_count:liftCount,assembly_qty:assemblyQty};
}
Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors()});try{if(req.method!=='POST')return J({ok:false,error:'METHOD_NOT_ALLOWED'},405);return J({ok:true,order:await createOrder(req)},201)}catch(e){const m=e instanceof Error?e.message:String(e);return J({ok:false,error:m},['CITY_UNAVAILABLE','PRODUCT_UNAVAILABLE','PICKUP_UNAVAILABLE'].includes(m)?400:500)}});
