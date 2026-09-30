const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../assets/city-catalog-core.js');
const importer=require('../admin/city-import.js');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

test('new cities start empty, and overrides and added products affect only that city',()=>{
  const base=[{model:'Матрас А',variants:[{size:'80×190',price:12000}]},{model:'Матрас Б',variants:[{size:'90×190',price:14000}]}];
  const settings=core.normalize({cities:[{id:'city-kazan',name:'Казань'}],catalogs:{'city-kazan':{
    keys:['mattress:Матрас А','mattress:city-kazan-exclusive'],products:{
      'mattress:Матрас А':{model:'Матрас А',variants:[{size:'80×190',price:10000}]},
      'mattress:city-kazan-exclusive':{model:'Матрас К',variants:[{size:'80×200',price:18000}]}
    }
  }}});
  assert.equal(core.applyCatalog(base,'mattress',core.normalize({cities:[{id:'city-empty',name:'Уфа'}]}),'city-empty').length,0);
  assert.deepEqual(core.applyCatalog(base,'mattress',settings,'city-kazan').map(x=>[x._catalogKey,x.variants[0].price]),[
    ['mattress:Матрас А',10000],['mattress:city-kazan-exclusive',18000]
  ]);
  assert.deepEqual(core.applyCatalog(base,'mattress',settings,'ekaterinburg').map(x=>x.variants[0].price),[12000,14000]);
  assert.equal(core.applyCatalog(base,'furniture',settings,'city-kazan').length,0);
  settings.catalogs['city-kazan'].products['mattress:Матрас А'].hidden=true;
  assert.deepEqual(core.applyCatalog(base,'mattress',settings,'city-kazan').map(x=>x.model),['Матрас К']);
});

test('admin cards follow the selected city and a new Ekaterinburg card reaches the public catalog',()=>{
  const base=[{_kind:'mattress',_key:'mattress:Матрас А',model:'Матрас А',variants:[{size:'80×190',price:12000}]}];
  const settings=core.normalize({cities:[{id:'city-kazan',name:'Казань'}],catalogs:{
    ekaterinburg:{products:{'mattress:custom-ekb':{model:'Матрас Е',variants:[{size:'90×190',price:20000}]}}},
    'city-kazan':{keys:['mattress:Матрас А','mattress:custom-kazan'],products:{
      'mattress:Матрас А':{model:'Матрас А',variants:[{size:'80×190',price:14000}],hidden:true},
      'mattress:custom-kazan':{model:'Матрас К',variants:[{size:'80×200',price:18000}]}
    }}
  }});
  assert.deepEqual(core.adminCatalog(base,settings,'ekaterinburg').map(item=>item.model),['Матрас А','Матрас Е']);
  assert.deepEqual(core.applyCatalog(base,'mattress',settings,'ekaterinburg').map(item=>item.model),['Матрас А','Матрас Е']);
  const kazan=core.adminCatalog(base,settings,'city-kazan');
  assert.deepEqual(kazan.map(item=>item.model),['Матрас А','Матрас К']);
  assert.equal(kazan[0]._hidden,true);
  assert.equal(kazan[0].variants[0].price,14000);
  assert.equal(kazan[1]._isCustom,true);
  assert.deepEqual(core.applyCatalog(base,'mattress',settings,'city-kazan').map(item=>item.model),['Матрас К']);
  assert.equal(core.adminCatalog(base,settings,'ekaterinburg')[0].variants[0].price,12000);
});

test('deleting a city removes its catalog and delivery price without touching other cities',()=>{
  const original=core.normalize({cities:[
    {id:'city-kazan',name:'Казань',delivery_price:990,hero_description:'Товары в Казани'},
    {id:'city-perm',name:'Пермь',delivery_price:0}
  ],catalogs:{
    'city-kazan':{keys:['mattress:kazan-only'],products:{'mattress:kazan-only':{model:'Казань'}}},
    'city-perm':{keys:['mattress:perm-only'],products:{'mattress:perm-only':{model:'Пермь'}}}
  }});
  const result=core.removeCity(original,'city-kazan');
  assert.deepEqual(result.cities.map(x=>x.id),['ekaterinburg','city-perm']);
  assert.equal(result.catalogs['city-kazan'],undefined);
  assert.equal(result.cities[1].delivery_price,0);
  assert.equal(result.catalogs['city-perm'].products['mattress:perm-only'].model,'Пермь');
  assert.equal(original.cities[1].delivery_price,990);
  assert.equal(original.catalogs['city-kazan'].products['mattress:kazan-only'].model,'Казань');
  assert.deepEqual(core.normalize(result),result);
  assert.throws(()=>core.removeCity(result,'ekaterinburg'),/нельзя удалить/);
  assert.throws(()=>core.removeCity(result,'city-kazan'),/не найден/);
});

test('cart uses a selected city delivery price, including free and pending delivery',()=>{
  let selected={id:'city-kazan',name:'Казань',delivery_price:990};
  const window={NoktenaCities:{current:()=>selected,id:()=>selected.id},
    NOKTENA_CATALOG_BOOTSTRAP:{rows:[{product_key:'settings:delivery_v2',payload:{delivery_price:500,free_delivery_from:15000}}]},
    addEventListener(){}};
  const context={window,document:{querySelector(){return null},querySelectorAll(){return[]},body:{}},
    MutationObserver:class{observe(){}},requestAnimationFrame(){},localStorage:{getItem(){return null}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/cart.js'),'utf8'),context);
  assert.equal(window.NoktenaCart.settings().delivery_price,990);
  assert.equal(window.NoktenaCart.settings().delivery_pending,false);
  assert.equal(window.NoktenaCart.settings().free_delivery_from,0);
  selected={...selected,delivery_price:0};
  assert.equal(window.NoktenaCart.settings().delivery_price,0);
  assert.equal(window.NoktenaCart.settings().delivery_pending,false);
  selected={...selected,delivery_price:null};
  assert.equal(window.NoktenaCart.settings().delivery_pending,true);
  selected={id:'ekaterinburg',name:'Екатеринбург',delivery_price:null};
  assert.equal(window.NoktenaCart.settings().delivery_price,500);
  assert.equal(window.NoktenaCart.settings().free_delivery_from,15000);
});

test('CSV supports one product with multiple sizes, quoted fields, and stable re-import',()=>{
  const source='key;type;name;size;price;color;description;image\r\n'+
    ';матрас;"Матрас; Город";80×190;12 000;;"Верхний; слой";https://example.test/one.jpg\r\n'+
    ';матрас;"Матрас; Город";90×190;13 500;;;https://example.test/one.jpg\r\n'+
    ';кровать;Кровать К;90×190;24000;Бежевый;;\r\n';
  const a=importer.parseCSV(source,'city-kazan'),b=importer.parseCSV(source,'city-kazan');
  assert.equal(a.length,2);assert.equal(a[0].variants.length,2);
  assert.equal(a[0].description,'Верхний; слой');
  assert.equal(a[0]._key,b[0]._key);
  assert.equal(a[1].category,'beds');
  const exported=importer.exportCSV(a);
  assert.deepEqual(importer.parseCSV(exported,'city-kazan').map(x=>x._key),a.map(x=>x._key));
});

test('invalid import rows are rejected before changing any catalog',()=>{
  assert.throws(()=>importer.parseCSV('type;name;price;size\nmattress;Товар;1000;80×190\nmattress;Товар;1000;80×190','city-kazan'),/повторяется размер/);
  assert.throws(()=>importer.parseCSV('type;name;price;size;image\nmattress;Товар;1000;80×190;javascript:alert(1)','city-kazan'),/HTTPS/);
  assert.throws(()=>importer.parseJSON('{"items":[{"type":"sofas","name":"Диван","variants":[]}]}' ,'city-kazan'),/размеры и цены/);
  const items=importer.parseJSON(JSON.stringify({items:[{type:'sofas',name:'Диван',variants:[{size:'90×190',color:'Серый',price:25000}]}]}),'city-kazan');
  assert.equal(items[0].category,'sofas');assert.equal(items[0].price,25000);
});

test('city descriptions survive normalization and update only the selected city page',()=>{
  const payload=core.normalize({cities:[
    {id:'ekaterinburg',name:'Екатеринбург'},
    {id:'city-kazan',name:'Казань',delivery_price:990,hero_description:'Матрасы для Казани',delivery_description:'Доставка по Казани',service_description:'Поможем в Казани',about_description:'О магазине в Казани',seo_title:'Каталог Казань — НОКТЕНА',seo_description:'Кровати и матрасы для Казани'}
  ]});
  const restored=core.normalize(payload);
  assert.equal(restored.cities[1].about_description,'О магазине в Казани');
  assert.equal(restored.cities[0].hero_description,'');
  const about={textContent:'',appended:[],querySelectorAll:()=>[{href:'mailto:noktena@mail.ru',cloneNode(){return {href:this.href}}}],append(...items){this.appended.push(...items)}};
  const selectors=new Map([
    ['.hero-copy',{textContent:''}],['.hero-copy p',{textContent:'Исходный текст'}],
    ['.delivery-lead',{textContent:'Исходная доставка'}],['.pd-service-item:nth-child(2) span',{textContent:'Уточняется'}],['#homeService .service-layout p',{textContent:''}],['.networkbox > div > p',about]
  ]);
  const metas=new Map(['description','og:title','og:description','twitter:title','twitter:description'].map(key=>[key,{content:'Исходное значение'}]));
  const document={readyState:'complete',title:'Исходный заголовок',querySelector:s=>selectors.get(s)||null,
    querySelectorAll:s=>s.startsWith('meta[')?[...metas].filter(([key])=>s.includes(`name="${key}"`)||s.includes(`property="${key}"`)).map(([,el])=>el):[],
    createTextNode:text=>({textContent:text}),addEventListener(){}};
  const context={document,window:{NoktenaCityCatalogCore:core,NOKTENA_CATALOG_BOOTSTRAP:{rows:[{product_key:core.KEY,payload:restored}]}},
    location:{search:'?city=city-kazan',pathname:'/',href:'https://noktena.ru/?city=city-kazan'},URL,URLSearchParams,
    localStorage:{getItem(){return''},setItem(){}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/city-catalog.js'),'utf8'),context);
  assert.equal(selectors.get('.hero-copy p').textContent,'Матрасы для Казани');
  assert.equal(selectors.get('.delivery-lead').textContent,'Доставка по Казани');
  assert.equal(selectors.get('.pd-service-item:nth-child(2) span').textContent,'Стоимость: 990 ₽');
  assert.equal(selectors.get('.networkbox > div > p').textContent,'О магазине в Казани');
  assert.equal(about.appended.at(-1).href,'mailto:noktena@mail.ru');
  assert.equal(document.title,'Каталог Казань — НОКТЕНА');
  assert.equal(metas.get('description').content,'Кровати и матрасы для Казани');
  assert.equal(metas.get('og:title').content,'Каталог Казань — НОКТЕНА');
});

test('an empty Ekaterinburg description leaves the current homepage copy and SEO intact',()=>{
  const hero={textContent:'Текущий текст'},meta={content:'Текущее описание'},document={readyState:'complete',title:'Текущий заголовок',
    querySelector:s=>s==='.hero-copy'?{}:s==='.hero-copy p'?hero:null,
    querySelectorAll:s=>s.startsWith('meta[')?[meta]:[],addEventListener(){}};
  const context={document,window:{NoktenaCityCatalogCore:core,NOKTENA_CATALOG_BOOTSTRAP:{rows:[]}},
    location:{search:'',pathname:'/',href:'https://noktena.ru/'},URL,URLSearchParams,localStorage:{getItem(){return''},setItem(){}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/city-catalog.js'),'utf8'),context);
  assert.equal(hero.textContent,'Текущий текст');
  assert.equal(meta.content,'Текущее описание');
  assert.equal(document.title,'Текущий заголовок');
});
