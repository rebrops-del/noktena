((root,factory)=>{
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.NoktenaCityImport=api;
})(typeof window!=='undefined'?window:null,()=>{
  'use strict';
  const COLUMNS=['key','type','name','size','price','color','description','image'];
  const HEADERS={key:'key',артикул:'key',код:'key',sku:'key',type:'type',тип:'type',категория:'type',name:'name',название:'name',модель:'name',size:'size',размер:'size',price:'price',цена:'price',color:'color',цвет:'color',description:'description',описание:'description',image:'image',фото:'image',изображение:'image'};
  const kindFor=value=>{const s=String(value||'').trim().toLowerCase();return s==='mattress'||s==='матрас'||s==='матрасы'?'mattress':s==='beds'||s==='bed'||s==='кровать'||s==='кровати'?'beds':s==='sofas'||s==='sofa'||s==='диван'||s==='диваны'?'sofas':''};
  function csvRows(text){
    const source=String(text||'').replace(/^\uFEFF/,''),first=source.split(/\r?\n/,1)[0],delimiter=(first.match(/;/g)||[]).length>=(first.match(/,/g)||[]).length?';':',';
    const rows=[];let row=[],value='',quoted=false;
    for(let i=0;i<source.length;i++){
      const c=source[i];
      if(c==='"'){if(quoted&&source[i+1]==='"'){value+='"';i++}else quoted=!quoted}
      else if(!quoted&&c===delimiter){row.push(value);value=''}
      else if(!quoted&&(c==='\n'||c==='\r')){if(c==='\r'&&source[i+1]==='\n')i++;row.push(value);if(row.some(v=>v.trim()))rows.push(row);row=[];value=''}
      else value+=c;
    }
    if(quoted)throw new Error('Не закрыты кавычки в CSV');
    row.push(value);if(row.some(v=>v.trim()))rows.push(row);
    return rows;
  }
  function validImages(input){
    const images=Array.isArray(input)?input:String(input||'').split('|');
    return images.map(x=>String(x||'').trim()).filter(Boolean).map(raw=>{
      let url;try{url=new URL(raw)}catch{}
      if(!url||url.protocol!=='https:'||url.username||url.password)throw new Error('Фото должно быть публичной HTTPS-ссылкой: '+raw.slice(0,80));
      return url.href;
    });
  }
  function stableKey(kind,cityId,name){
    let hash=2166136261;
    for(const c of `${cityId}:${kind}:${name.toLowerCase()}`){hash^=c.codePointAt(0);hash=Math.imul(hash,16777619)}
    return `${kind}:city-${cityId}-${(hash>>>0).toString(16).padStart(8,'0')}`;
  }
  function normalizeKey(raw,kind,cityId,name){
    const value=String(raw||'').trim();
    if(!value)return stableKey(kind,cityId,name);
    const key=value.includes(':')?value:`${kind}:${value}`;
    if(!key.startsWith(kind+':')||key.length>190||/[\r\n]/.test(key))throw new Error('Некорректный артикул: '+value.slice(0,80));
    return key;
  }
  function parsePrice(value){
    const n=Number(String(value??'').replace(/[\s\u00a0₽]/g,'').replace(',','.'));
    if(!Number.isFinite(n)||n<=0||n>100000000)throw new Error('Цена должна быть больше нуля: '+String(value).slice(0,40));
    return n;
  }
  function parseCSV(text,cityId){
    const rows=csvRows(text);if(rows.length<2)throw new Error('Добавьте заголовки и хотя бы один товар');
    if(rows.length>10001)throw new Error('В одном файле не более 10 000 строк');
    const header=rows.shift().map(v=>HEADERS[v.trim().toLowerCase()]||'');
    if(!['type','name','price'].every(x=>header.includes(x)))throw new Error('В CSV нужны столбцы: type, name, price');
    const map=new Map();
    for(const [index,row] of rows.entries()){
      const data=Object.fromEntries(header.map((h,i)=>[h,String(row[i]||'').trim()]).filter(([h])=>h));
      const group=kindFor(data.type),name=String(data.name||'').trim();
      if(!group||!name)throw new Error(`Строка ${index+2}: укажите тип и название`);
      const kind=group==='mattress'?'mattress':'furniture',key=normalizeKey(data.key,kind,cityId,name),price=parsePrice(data.price),size=data.size||'',color=data.color||'';
      if(!size)throw new Error(`Строка ${index+2}: укажите размер`);
      let item=map.get(key);
      if(item&&(item._kind!==kind||(kind==='furniture'&&item.category!==group)||String(item._kind==='mattress'?item.model:item.title)!==name))throw new Error(`Строка ${index+2}: у артикула ${key} разные товары`);
      if(!item){
        item=kind==='mattress'?{_kind:kind,_key:key,model:name,category:'Матрасы',intro:'',description:'',images:[],variants:[],available:true}:{_kind:kind,_key:key,id:key.slice('furniture:'.length),title:name,category:group,summary:'',description:'',images:[],variants:[],colors:[],sizes:[],colorImages:{},available:true};
        map.set(key,item);
      }
      if(data.description)item.description=data.description;
      for(const url of validImages(data.image))if(!item.images.includes(url))item.images.push(url);
      const variant={size,price,available:true};if(kind==='furniture')variant.color=color;
      if(item.variants.some(v=>v.size===size&&(kind==='mattress'||v.color===color)))throw new Error(`Строка ${index+2}: повторяется размер и цвет товара ${name}`);
      item.variants.push(variant);
    }
    if(map.size>1000)throw new Error('В одном файле не более 1000 моделей');
    for(const item of map.values())if(item._kind==='furniture'){item.price=Math.min(...item.variants.map(v=>v.price));item.sizes=[...new Set(item.variants.map(v=>v.size))];item.colors=[...new Set(item.variants.map(v=>v.color).filter(Boolean))]}
    return [...map.values()];
  }
  function parseJSON(text,cityId){
    let raw;try{raw=JSON.parse(text)}catch{throw new Error('Не удалось прочитать JSON')}
    const list=Array.isArray(raw)?raw:raw?.items;
    if(!Array.isArray(list)||!list.length||list.length>1000)throw new Error('JSON должен содержать от 1 до 1000 товаров в массиве items');
    const found=new Set();
    return list.map((source,index)=>{
      if(!source||typeof source!=='object'||Array.isArray(source))throw new Error(`Товар ${index+1}: неверный формат`);
      const group=kindFor(source.type||source._kind||source.kind||source.category),kind=group==='mattress'?'mattress':group?'furniture':'',name=String(source.name||source.model||source.title||'').trim();
      if(!kind||!name)throw new Error(`Товар ${index+1}: укажите тип и название`);
      const key=normalizeKey(source.key||source._key,kind,cityId,name);
      if(found.has(key))throw new Error('Повторяется артикул '+key);found.add(key);
      if(!Array.isArray(source.variants))throw new Error(`Товар ${index+1}: нужен массив variants`);
      const variants=source.variants.map(v=>({size:String(v?.size||'').trim(),price:parsePrice(v?.price),available:v?.available!==false,...(kind==='furniture'?{color:String(v?.color||'').trim()}:{})}));
      if(!variants.length||variants.some(v=>!v.size))throw new Error(`Товар ${index+1}: укажите размеры и цены`);
      if(new Set(variants.map(v=>v.size+'|'+(v.color||''))).size!==variants.length)throw new Error(`Товар ${index+1}: размеры и цвета повторяются`);
      const images=validImages(source.images||source.image||[]);
      if(kind==='mattress')return {_kind:kind,_key:key,model:name,category:source.category||'Матрасы',intro:String(source.intro||source.summary||''),description:String(source.description||''),images,variants,available:source.available!==false};
      return {_kind:kind,_key:key,id:key.slice('furniture:'.length),title:name,category:group,summary:String(source.summary||source.intro||''),description:String(source.description||''),images,variants,price:Math.min(...variants.map(v=>v.price)),sizes:[...new Set(variants.map(v=>v.size))],colors:[...new Set(variants.map(v=>v.color).filter(Boolean))],colorImages:{},available:source.available!==false};
    });
  }
  const quote=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
  function exportCSV(items){
    const lines=[COLUMNS.join(';')];
    for(const item of items){
      const key=item._key||item._catalogKey,group=kindFor(item._kind)==='mattress'?'mattress':item.category||'beds',name=item.model||item.title||'';
      for(const variant of item.variants?.length?item.variants:[{}]){
        const values=[key,group,name,variant.size||'',variant.price||item.price||'',variant.color||'',item.description||'',(item.images||[]).join('|')];
        lines.push(values.map(quote).join(';'));
      }
    }
    return '\uFEFF'+lines.join('\r\n')+'\r\n';
  }
  return Object.freeze({COLUMNS,parseCSV,parseJSON,exportCSV,stableKey});
});
