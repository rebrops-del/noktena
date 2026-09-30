const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

function editorHarness(payload={},heroPayload={}){
  const nodes=new Map(),saved=[],uploads=[],messages=[];
  function node(key){
    if(!nodes.has(key)){
      const classes=new Set(key==='pane'?['hide']:[]);
      nodes.set(key,{value:'',textContent:'',disabled:false,handlers:{},children:[],dataset:{},src:'',
        classList:{add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name)},
        addEventListener(type,handler){this.handlers[type]=handler},
        querySelector(){return node('submit')},append(...items){this.children.push(...items)},replaceChildren(){this.children=[]},click(){this.handlers.click?.()}});
    }
    return nodes.get(key);
  }
  const document={querySelector:node,createElement:tag=>node(tag==='section'?'pane':Symbol()),body:{append(){}}};
  node('#siteSettingsTemplate').content={cloneNode:()=>({})};
  const context={document,window:{},Date,URL,FormData,toast:(message,error)=>messages.push({message,error}),
    fetch:async()=>({ok:true,text:async()=> 'window.NOKTENA_CATALOG_BOOTSTRAP='+JSON.stringify({rows:[{product_key:'settings:seo_v1',payload},{product_key:'settings:hero_v1',payload:heroPayload}]})+';'}),
    request:async(action,options)=>{if(action==='upload'){uploads.push(options.body);return{url:'https://example.test/hero.webp'}}saved.push({action,body:JSON.parse(options.body)});return {ok:true}}};
  vm.runInNewContext(read('admin/site-settings.js'),context);
  return {node,saved,uploads,messages};
}

test('settings editor saves SEO and privacy, keeps the initial version and restores an older version',async()=>{
  const h=editorHarness({home_title:'Матрасы в Екатеринбурге',home_description:'Подберём размер и привезём матрас.'});
  await h.node('[data-admin-open="site-settings"]').handlers.click();
  assert.equal(h.node('#siteSeoTitle').value,'Матрасы в Екатеринбурге');
  assert.equal(h.node('#siteSeoPreviewDescription').textContent,'Подберём размер и привезём матрас.');
  h.node('#siteSeoTitle').value='Новый заголовок — НОКТЕНА';
  h.node('#siteSeoDescription').value='  Новое описание для поиска.  ';
  h.node('#sitePrivacyOperator').value='ООО «НОКТЕНА»';
  h.node('#sitePrivacyInn').value='1234567890';
  h.node('#sitePrivacyOgrn').value='1234567890123';
  h.node('#sitePrivacyAddress').value='Екатеринбург';
  await h.node('#siteSeoForm').handlers.submit({preventDefault(){}});
  assert.equal(h.saved.length,1);
  assert.equal(h.saved[0].action,'save');
  const item=h.saved[0].body.item;
  assert.equal(item.home_description,'Новое описание для поиска.');
  assert.equal(item.privacy.operator,'ООО «НОКТЕНА»');
  assert.equal(item.history.length,2);
  assert.equal(item.history[0].snapshot.home_title,'Матрасы в Екатеринбурге');
  assert.equal(h.messages.at(-1).message,'Настройки и SEO сохранены');
  await h.node('pane').handlers.click({target:{closest:selector=>selector==='[data-restore]'?{dataset:{restore:'0'}}:null}});
  assert.equal(h.saved.length,2);
  assert.equal(h.saved[1].body.item.home_title,'Матрасы в Екатеринбурге');
  assert.equal(h.saved[1].body.item.history.at(-1).action,'Восстановление версии №0');
  assert.equal(h.saved[1].body.item.history.length,3);
  h.node('#catalogTab').handlers.click();
  assert.equal(h.node('pane').classList.contains('hide'),true);
});

test('bad OG URL and malformed INN are rejected before saving',async()=>{
  const h=editorHarness();await h.node('[data-admin-open="site-settings"]').handlers.click();
  h.node('#siteOgUrl').value='javascript:alert(1)';
  await h.node('#siteSeoForm').handlers.submit({preventDefault(){}});
  assert.equal(h.saved.length,0);
  h.node('#siteOgUrl').value='';h.node('#sitePrivacyInn').value='123';
  await h.node('#siteSeoForm').handlers.submit({preventDefault(){}});
  assert.equal(h.saved.length,0);
  assert.match(h.messages.at(-1).message,/ИНН/);
});

test('homepage image uploads, saves separately from SEO and can return to default',async()=>{
  const h=editorHarness({}, {url:'https://example.test/old.jpg',alt:'Старая спальня'});
  await h.node('[data-admin-open="site-settings"]').handlers.click();
  assert.equal(h.node('#siteHeroUrl').value,'https://example.test/old.jpg');
  assert.equal(h.node('#siteHeroPreview').src,'https://example.test/old.jpg');
  const input=h.node('#siteHeroFile');
  input.files=[new File(['image'], 'new.webp', {type:'image/webp'})];
  await input.handlers.change({target:input});
  assert.equal(h.uploads.length,1);
  assert.equal(h.uploads[0].get('product_key'),'homepage-hero-image');
  assert.equal(h.node('#siteHeroUrl').value,'https://example.test/hero.webp');
  h.node('#siteHeroAlt').value='Новая спальня';
  await h.node('#siteHeroForm').handlers.submit({preventDefault(){}});
  assert.equal(h.saved.length,1);
  assert.equal(h.saved[0].body.key,'settings:hero_v1');
  assert.equal(h.saved[0].body.item.alt,'Новая спальня');
  assert.equal(h.saved[0].body.item.url,'https://example.test/hero.webp');
  h.node('#siteHeroReset').handlers.click();
  assert.equal(h.node('#siteHeroUrl').value,'');
  await h.node('#siteHeroForm').handlers.submit({preventDefault(){}});
  assert.equal(h.saved[1].body.item.url,'');
  h.node('#siteHeroUrl').value='javascript:alert(1)';
  await h.node('#siteHeroForm').handlers.submit({preventDefault(){}});
  assert.equal(h.saved.length,2);
});

test('homepage uses saved image and reverts if it cannot be loaded',()=>{
  const source=read('assets/homepage-image.js');
  const image={src:'assets/noktena-editorial-bedroom.webp',alt:'Исходное фото',handlers:{},
    getAttribute(name){assert.equal(name,'src');return this.src},
    addEventListener(type,handler){this.handlers[type]=handler}};
  const document={querySelector:()=>image};
  const run=url=>vm.runInNewContext(source,{document,URL,window:{NOKTENA_CATALOG_BOOTSTRAP:{rows:[{product_key:'settings:hero_v1',payload:{url,alt:'Новая спальня'}}]}}});
  run('javascript:alert(1)');
  assert.equal(image.src,'assets/noktena-editorial-bedroom.webp');
  run('https://example.test/hero.webp');
  assert.equal(image.src,'https://example.test/hero.webp');
  assert.equal(image.alt,'Новая спальня');
  image.handlers.error();
  assert.equal(image.src,'assets/noktena-editorial-bedroom.webp');
  assert.equal(image.alt,'Исходное фото');
});

test('homepage runtime updates metadata and OG image from saved settings, keeping defaults without them',()=>{
  const metadata=new Map(['description','og:title','og:description','og:image','og:image:secure_url','og:image:type','twitter:title','twitter:description','twitter:image'].map(key=>[key,{content:'Исходное значение',setAttribute(name,value){assert.equal(name,'content');this.content=value}}]));
  const document={title:'Исходный заголовок',querySelector(selector){return metadata.get(selector.match(/(?:name|property)="([^"]+)"/)?.[1])||null}};
  const code=read('assets/seo-settings.js');
  vm.runInNewContext(code,{document,URL,window:{NOKTENA_CATALOG_BOOTSTRAP:{rows:[]}}});
  assert.equal(document.title,'Исходный заголовок');
  const title='Матрасы — НОКТЕНА',description='Удобный выбор матраса с доставкой.',image='https://example.org/preview.png';
  vm.runInNewContext(code,{document,URL,window:{NOKTENA_CATALOG_BOOTSTRAP:{rows:[{
    product_key:'settings:seo_v1',payload:{home_title:title,home_description:description,og_image:image}
  }]}}});
  assert.equal(document.title,title);
  assert.equal(metadata.get('description').content,description);
  assert.equal(metadata.get('og:title').content,title);
  assert.equal(metadata.get('twitter:description').content,description);
  assert.equal(metadata.get('og:image').content,image);
  assert.equal(metadata.get('twitter:image').content,image);
});

test('privacy page reveals policy only after operator details are complete',()=>{
  const fields=['operator','inn','ogrn','address','contact','retention','published_at'].map(key=>({dataset:{privacyField:key},textContent:''}));
  const status={textContent:''},body={hidden:true},draft={hidden:false};
  const document={querySelector:selector=>({'#privacyStatus':status,'#privacyBody':body,'#privacyDraft':draft}[selector]),querySelectorAll:()=>fields};
  const code=read('assets/privacy-settings.js');
  vm.runInNewContext(code,{document,window:{NOKTENA_CATALOG_BOOTSTRAP:{rows:[]}}});
  assert.equal(body.hidden,true);
  const payload={privacy:{operator:'ИП Иванов',inn:'123456789012',ogrn:'123456789012345',address:'Екатеринбург'}};
  vm.runInNewContext(code,{document,window:{NOKTENA_CATALOG_BOOTSTRAP:{rows:[{product_key:'settings:seo_v1',payload}]}}});
  assert.equal(body.hidden,false);assert.equal(draft.hidden,true);
  assert.equal(fields[0].textContent,'ИП Иванов');
});
