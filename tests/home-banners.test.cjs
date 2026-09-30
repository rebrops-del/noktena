const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const sample=(id,title)=>({id,label:'ПОДБОРКА',title,description:'Текст предложения',button:'Смотреть',link:'#beds',image:'https://example.test/bed.webp',alt:'Кровать',enabled:true});
function configContext(){const context={window:{},URL};vm.runInNewContext(source('assets/home-banners-config.js'),context);return context}

test('banner settings reject unsafe links and preserve an intentionally empty or disabled list',()=>{
  const {window}=configContext(),config=window.NoktenaHomeBanners;
  assert.equal(config.fromPayload(null).length,1);
  assert.equal(config.fromPayload({banners:[]}).length,0);
  assert.equal(config.fromPayload({banners:[{...sample('a','Первая'),enabled:false}]}).at(0).enabled,false);
  for(const url of ['javascript:alert(1)','//example.test/x','http://example.test','https://user:pass@example.test/x']){
    assert.equal(config.validLink(url),'');assert.equal(config.validImage(url),'');
  }
  assert.equal(config.validLink('#beds'),'#beds');
  assert.equal(config.validLink('/product.html?kind=furniture'),'/product.html?kind=furniture');
});

test('home page renders multiple banners and switches between them without showing disabled ones',()=>{
  const context=configContext();
  const nodes=new Map();
  function element(tag='div'){
    const item={tag,children:[],handlers:{},hidden:false,textContent:'',className:'',
      classList:{add(){}},append(...children){this.children.push(...children)},
      setAttribute(key,value){this[key]=value},addEventListener(type,handler){this.handlers[type]=handler},remove(){this.removed=true}};
    Object.defineProperty(item,'origin',{get(){return this.href?new URL(this.href,'https://noktena.ru').origin:''}});
    return item;
  }
  const get=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)};
  context.document={getElementById:get,createElement:element};
  context.location={origin:'https://noktena.ru'};
  context.window.NOKTENA_CATALOG_BOOTSTRAP={rows:[{product_key:'settings:home_banners_v1',payload:{banners:[sample('a','Первая'),{...sample('b','Вторая'),image:''},{...sample('c','Скрыта'),enabled:false}]}}]};
  vm.runInNewContext(source('assets/home-banners.js'),context);
  const cards=get('homeBannersSlides').children;
  assert.equal(cards.length,2);
  assert.equal(get('homeBanners').hidden,false);
  assert.equal(cards[0].hidden,false);
  assert.equal(cards[1].hidden,true);
  assert.equal(get('homeBannersCounter').textContent,'1 / 2');
  get('homeBannerNext').handlers.click();
  assert.equal(cards[0].hidden,true);
  assert.equal(cards[1].hidden,false);
  assert.equal(get('homeBannersCounter').textContent,'2 / 2');
  get('homeBannerPrevious').handlers.click();
  assert.equal(cards[0].hidden,false);
});

test('admin saves ordering, visibility and uploaded image in one shared setting',async()=>{
  const context=configContext(),nodes=new Map(),saved=[],uploads=[];
  function node(id){
    if(!nodes.has(id))nodes.set(id,{id,handlers:{},disabled:false,textContent:'',innerHTML:'',
      addEventListener(type,handler){this.handlers[type]=handler},
      querySelector:selector=>node(selector),
      get lastElementChild(){return {querySelector:()=>({focus(){}})}}});
    return nodes.get(id);
  }
  const pane={querySelector:node};
  Object.assign(context,{document:{createElement:()=>node('image')},Date,Math,FormData,File,Event,
    toast(){},request:async(action,options)=>{if(action==='upload'){uploads.push(options.body);return {url:'https://cdn.example.test/new.webp'}}saved.push(JSON.parse(options.body));return {ok:true}}});
  vm.runInNewContext(source('admin/banner-settings.js'),context);
  const editor=context.window.NoktenaBannerEditor.init(pane);
  editor.fill({banners:[sample('a','Первая'),sample('b','Вторая')]});
  assert.match(node('#siteBannersList').innerHTML,/Первая/);
  function target(id,action){return {closest:selector=>selector==='[data-banner-id]'?{dataset:{bannerId:id}}:selector==='[data-banner-action]'?{dataset:{bannerAction:action}}:null}}
  node('#siteBannersList').handlers.click({target:target('b','up')});
  const checkbox={dataset:{field:'enabled'},checked:false,closest:target('a').closest};
  node('#siteBannersList').handlers.input({target:checkbox});
  const fileInput={matches:selector=>selector==='[data-banner-file]',files:[new File(['image'],'new.webp',{type:'image/webp'})],closest:target('b').closest,value:'new.webp'};
  await node('#siteBannersList').handlers.change({target:fileInput});
  assert.equal(uploads.length,1);
  assert.equal(uploads[0].get('product_key'),'homepage-banner-image');
  await node('#siteBannersForm').handlers.submit({preventDefault(){}});
  assert.equal(saved.length,1);
  assert.equal(saved[0].key,'settings:home_banners_v1');
  assert.equal(saved[0].item.banners[0].id,'b');
  assert.equal(saved[0].item.banners[0].image,'https://cdn.example.test/new.webp');
  assert.equal(saved[0].item.banners[1].enabled,false);
});
