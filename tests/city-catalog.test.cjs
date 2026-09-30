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
    {id:'city-kazan',name:'Казань',hero_description:'Матрасы для Казани',delivery_description:'Доставка по Казани',service_description:'Поможем в Казани',about_description:'О магазине в Казани',seo_title:'Каталог Казань — НОКТЕНА',seo_description:'Кровати и матрасы для Казани'}
  ]});
  const restored=core.normalize(payload);
  assert.equal(restored.cities[1].about_description,'О магазине в Казани');
  assert.equal(restored.cities[0].hero_description,'');
  const selectors=new Map([
    ['.hero-copy',{textContent:''}],['.hero-copy p',{textContent:'Исходный текст'}],
    ['.delivery-lead',{textContent:'Исходная доставка'}],['#homeService .service-layout p',{textContent:''}],['.networkbox > div > p',{textContent:''}]
  ]);
  const metas=new Map(['description','og:title','og:description','twitter:title','twitter:description'].map(key=>[key,{content:'Исходное значение'}]));
  const document={readyState:'complete',title:'Исходный заголовок',querySelector:s=>selectors.get(s)||null,
    querySelectorAll:s=>s.startsWith('meta[')?[...metas].filter(([key])=>s.includes(`name="${key}"`)||s.includes(`property="${key}"`)).map(([,el])=>el):[],addEventListener(){}};
  const context={document,window:{NoktenaCityCatalogCore:core,NOKTENA_CATALOG_BOOTSTRAP:{rows:[{product_key:core.KEY,payload:restored}]}},
    location:{search:'?city=city-kazan',pathname:'/',href:'https://noktena.ru/?city=city-kazan'},URL,URLSearchParams,
    localStorage:{getItem(){return''},setItem(){}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/city-catalog.js'),'utf8'),context);
  assert.equal(selectors.get('.hero-copy p').textContent,'Матрасы для Казани');
  assert.equal(selectors.get('.delivery-lead').textContent,'Доставка по Казани');
  assert.equal(selectors.get('.networkbox > div > p').textContent,'О магазине в Казани');
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
