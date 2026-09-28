const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('SEO editor loads saved metadata and sends changes through the authenticated admin request',async()=>{
  const nodes=new Map(),saved=[],messages=[];
  function node(key){
    if(!nodes.has(key)){
      const classes=new Set(key==='pane'?['hide']:[]);
      nodes.set(key,{value:'',textContent:'',disabled:false,handlers:{},
        classList:{add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name)},
        addEventListener(type,handler){this.handlers[type]=handler},
        querySelector(){return node('submit')},append(){},click(){this.handlers.click?.()}});
    }
    return nodes.get(key);
  }
  const document={querySelector:node,createElement:()=>node('pane')};
  node('#siteSettingsTemplate').content={cloneNode:()=>({})};
  const context={document,Date,toast:(message,error)=>messages.push({message,error}),
    fetch:async()=>({ok:true,text:async()=> 'window.NOKTENA_CATALOG_BOOTSTRAP='+JSON.stringify({rows:[{
      product_key:'settings:seo_v1',payload:{home_title:'Матрасы в Екатеринбурге',home_description:'Подберём размер и привезём матрас.'}
    }]})+';'}),
    request:async(action,options)=>{saved.push({action,body:JSON.parse(options.body)});return {ok:true}}};
  vm.runInNewContext(read('admin/site-settings.js'),context);
  await node('[data-admin-open="site-settings"]').handlers.click();
  assert.equal(node('#siteSeoTitle').value,'Матрасы в Екатеринбурге');
  assert.equal(node('#siteSeoPreviewDescription').textContent,'Подберём размер и привезём матрас.');
  assert.equal(node('pane').classList.contains('hide'),false);
  assert.equal(node('#adminCatalogPane').classList.contains('hide'),true);
  node('#siteSeoTitle').value='Новый заголовок — НОКТЕНА';
  node('#siteSeoDescription').value='  Новое описание для поиска.  ';
  await node('#siteSeoForm').handlers.submit({preventDefault(){}});
  assert.equal(saved.length,1);
  assert.equal(saved[0].action,'save');
  assert.equal(saved[0].body.key,'settings:seo_v1');
  assert.equal(saved[0].body.item.home_description,'Новое описание для поиска.');
  assert.equal(messages.at(-1).message,'SEO главной страницы сохранено');
  node('#catalogTab').handlers.click();
  assert.equal(node('pane').classList.contains('hide'),true);
  assert.equal(node('#adminTabs').classList.contains('hide'),false);
});

test('homepage runtime updates search metadata from saved settings and keeps defaults without them',()=>{
  const metadata=new Map(['description','og:title','og:description','twitter:title','twitter:description'].map(key=>[key,{content:'Исходное значение',setAttribute(name,value){assert.equal(name,'content');this.content=value}}]));
  const document={title:'Исходный заголовок',querySelector(selector){return metadata.get(selector.match(/(?:name|property)="([^"]+)"/)?.[1])||null}};
  const code=read('assets/seo-settings.js');
  vm.runInNewContext(code,{document,window:{NOKTENA_CATALOG_BOOTSTRAP:{rows:[]}}});
  assert.equal(document.title,'Исходный заголовок');
  const title='Матрасы — НОКТЕНА',description='Удобный выбор матраса с доставкой.';
  vm.runInNewContext(code,{document,window:{NOKTENA_CATALOG_BOOTSTRAP:{rows:[{
    product_key:'settings:seo_v1',payload:{home_title:title,home_description:description}
  }]}}});
  assert.equal(document.title,title);
  assert.equal(metadata.get('description').content,description);
  assert.equal(metadata.get('og:title').content,title);
  assert.equal(metadata.get('twitter:description').content,description);
});
