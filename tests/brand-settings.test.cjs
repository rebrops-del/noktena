const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const brand=require('../assets/brand-core.js');

test('global brand is read from one shared row regardless of a selected city',()=>{
  const rows=[
    {product_key:'settings:brand_v1',payload:{name:'Новый магазин',logo_url:'https://example.org/logo.png',site_color:'#173a55',admin_color:'#394052',accent_color:'#bc8956'}},
    {product_key:'settings:brand_v1:city:kazan',payload:{name:'Wrong city row'}}
  ];
  assert.equal(brand.fromRows(rows).name,'Новый магазин');
  assert.equal(brand.fromRows(rows).logo_url,'https://example.org/logo.png');
  assert.deepEqual(brand.fromRows([]),brand.DEFAULTS);
});

test('brand input rejects unreadable main colors and unsafe names or image URLs',()=>{
  const valid={...brand.DEFAULTS,name:'Новый магазин'};
  assert.equal(brand.validate(valid).name,'Новый магазин');
  assert.throws(()=>brand.validate({...valid,site_color:'#ffffff'}),/белый текст/);
  assert.throws(()=>brand.validate({...valid,admin_color:'#eeeeee'}),/белый текст/);
  assert.throws(()=>brand.validate({...valid,name:'Название\nДругое'}),/название/);
  assert.throws(()=>brand.validate({...valid,logo_url:'javascript:alert(1)'}),/HTTPS/);
  assert.throws(()=>brand.validate({...valid,logo_url:'https://user:pass@example.org/logo.png'}),/HTTPS/);
  assert.equal(brand.replace('НОКТЕНА · Журнал НОКТЕНЫ · в НОКТЕНЕ','Магазин Сна'),'Магазин Сна · Журнал Магазин Сна · в Магазин Сна');
  assert.equal(brand.replace('Доставка из Старой марки. Старой маркировки нет.','Новая марка',['Старой марки']),'Доставка из Новая марка. Старой маркировки нет.');
});

test('every public page and both admin routes load the brand before their own scripts',()=>{
  for(const file of ['index.html','product.html','checkout.html','privacy.html','admin/index.html','admin-v2/index.html']){
    const content=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
    assert.match(content,/catalog-bootstrap\.js/);
    assert.ok(content.indexOf('catalog-bootstrap.js')<content.indexOf('brand-core.js'),file);
    assert.ok(content.indexOf('brand-core.js')<content.indexOf('brand-runtime.js'),file);
    assert.match(content,/data-brand-logo/,file);
  }
  const admin=fs.readFileSync(path.join(__dirname,'..','admin/index.html'),'utf8');
  for(const field of ['brandName','brandLogoFile','brandSiteColor','brandAdminColor','brandAccentColor'])assert.ok(admin.includes(`id="${field}"`));
});

test('order notification parser carries the saved global brand to email',async()=>{
  const {parseNotificationBootstrap}=await import('../railway-admin/notification-settings.js');
  const script='window.NOKTENA_CATALOG_BOOTSTRAP='+JSON.stringify({rows:[{product_key:'settings:brand_v1',payload:{name:'Магазин Сна'}}]})+';';
  assert.equal(parseNotificationBootstrap(script).brand_name,'Магазин Сна');
});

test('admin uploads a logo and saves the brand globally after a city has been selected',async()=>{
  const nodes=new Map(),writes=[],applied=[];
  const node=id=>{
    if(!nodes.has(id))nodes.set(id,{
      value:'',textContent:'',disabled:false,src:'',handlers:{},style:{},files:[],
      addEventListener(type,handler){this.handlers[type]=handler},
      getAttribute(key){return key==='src'?this.src:''},
      querySelector(){return node('submit')},querySelectorAll(){return []}
    });
    return nodes.get(id);
  };
  node('brandSiteColor').value=brand.DEFAULTS.site_color;
  node('brandAdminColor').value=brand.DEFAULTS.admin_color;
  node('brandAccentColor').value=brand.DEFAULTS.accent_color;
  const pane=node('pane');pane.classList={contains:()=>false};
  const context={
    document:{querySelector:key=>key==='#siteBrandForm'?node('form'):key==='#adminSiteSettingsPane'?pane:null,getElementById:node},
    window:{NoktenaBrandCore:brand,NoktenaBrand:{apply:value=>applied.push(value)}},
    MutationObserver:class{observe(){}},FormData,URL,
    fetch:async()=>({ok:true,text:async()=>`window.NOKTENA_CATALOG_BOOTSTRAP=${JSON.stringify({rows:[{product_key:brand.KEY,payload:{name:'Старая марка'}}]})};`}),
    request:async(action,options)=>{if(action==='upload')return {url:'https://example.org/new-logo.png'};writes.push(JSON.parse(options.body));return {ok:true}},
    toast:()=>{}
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','admin/brand-settings.js'),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(node('brandName').value,'Старая марка');
  const image=new File(['png'], 'logo.png', {type:'image/png'});
  node('brandLogoFile').files=[image];
  await node('brandLogoFile').handlers.change({target:node('brandLogoFile')});
  node('brandName').value='Новая марка';
  await node('form').handlers.submit({preventDefault(){}});
  assert.equal(writes.length,1);
  assert.equal(writes[0].key,'settings:brand_v1');
  assert.equal(writes[0].item.logo_url,'https://example.org/new-logo.png');
  assert.equal(applied[0].name,'Новая марка');
});

test('saved old SEO titles display the new brand on the storefront',()=>{
  const city=require('../assets/city-settings-core.js');
  const metadata=new Map();
  const document={title:'',querySelector(selector){if(!metadata.has(selector))metadata.set(selector,{content:'',setAttribute(key,value){this[key]=value}});return metadata.get(selector)}};
  const settings={rows:[{product_key:'settings:seo_v1',payload:{home_title:'Матрасы — НОКТЕНА',home_description:'НОКТЕНА — подбор и доставка.'}}]};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','assets/seo-settings.js'),'utf8'),{document,URL,window:{NoktenaCitySettings:city,NOKTENA_CATALOG_BOOTSTRAP:settings,NoktenaBrand:{replace:value=>brand.replace(value,'Новая марка')}}});
  assert.equal(document.title,'Матрасы — Новая марка');
  assert.equal(metadata.get('meta[name="description"]').content,'Новая марка — подбор и доставка.');
});
