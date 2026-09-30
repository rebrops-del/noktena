const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../assets/city-catalog-core.js');
const importer=require('../admin/city-import.js');

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
