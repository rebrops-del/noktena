import http from 'node:http';

const PORT = Number(process.env.PORT || 3000);
const PROJECT = 'https://oldtlbkrftflfthfsqdv.supabase.co';
const ADMIN_API = PROJECT + '/functions/v1/noktena-admin-api';
const PUBLIC_BOOTSTRAP = PROJECT + '/functions/v1/noktena-admin?public=1';
const STORAGE_PREFIX = PROJECT + '/storage/v1/object/public/';
const ALLOWED_ORIGINS = new Set(['https://noktena.ru','https://www.noktena.ru']);

function applyCors(req,res){const origin=req.headers.origin||'';res.setHeader('Access-Control-Allow-Origin',ALLOWED_ORIGINS.has(origin)?origin:'*');res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','authorization,content-type,apikey,x-client-info');res.setHeader('Access-Control-Max-Age','86400');res.setHeader('Cache-Control','no-store')}
function sendJson(res,status,payload){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(payload))}
async function readBody(req){const chunks=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));return chunks.length?Buffer.concat(chunks):undefined}
function proxyBase(req){return 'https://'+req.headers.host}
function proxiedAsset(req,url){return proxyBase(req)+'/asset?url='+encodeURIComponent(url)}
function rewriteValue(req,value){
  if(typeof value==='string'&&value.startsWith(STORAGE_PREFIX))return proxiedAsset(req,value);
  if(Array.isArray(value))return value.map(v=>rewriteValue(req,v));
  if(value&&typeof value==='object'){for(const k of Object.keys(value))value[k]=rewriteValue(req,value[k]);}
  return value;
}

const server=http.createServer(async(req,res)=>{
  applyCors(req,res);
  if(req.method==='OPTIONS'){res.statusCode=204;return res.end()}
  const incoming=new URL(req.url||'/','http://localhost');
  if(incoming.pathname==='/health')return sendJson(res,200,{ok:true,service:'noktena-admin-proxy'});

  if(incoming.pathname==='/asset'){
    try{
      const target=incoming.searchParams.get('url')||'';
      if(!target.startsWith(STORAGE_PREFIX))return sendJson(res,400,{ok:false,error:'BAD_ASSET_URL'});
      const upstream=await fetch(target,{headers:{accept:req.headers.accept||'*/*'}});
      const body=Buffer.from(await upstream.arrayBuffer());
      res.statusCode=upstream.status;
      res.setHeader('Content-Type',upstream.headers.get('content-type')||'application/octet-stream');
      res.setHeader('Cache-Control','public, max-age=31536000, immutable');
      return res.end(body);
    }catch(error){return sendJson(res,502,{ok:false,error:'ASSET_UNAVAILABLE',message:error instanceof Error?error.message:String(error)})}
  }

  if(incoming.pathname==='/catalog-bootstrap.js'){
    try{
      const upstream=await fetch(PUBLIC_BOOTSTRAP,{headers:{accept:'application/javascript'}});
      let text=await upstream.text();
      text=text.replaceAll(STORAGE_PREFIX,proxyBase(req)+'/asset?url='+encodeURIComponent(STORAGE_PREFIX));
      res.statusCode=upstream.status;
      res.setHeader('Content-Type','application/javascript; charset=utf-8');
      return res.end(text);
    }catch(error){res.statusCode=200;res.setHeader('Content-Type','application/javascript; charset=utf-8');return res.end('window.NOKTENA_CATALOG_BOOTSTRAP={rows:[],assets:[]};')}
  }

  if(incoming.pathname!=='/api/noktena-admin')return sendJson(res,404,{ok:false,error:'NOT_FOUND'});
  if(!['GET','POST'].includes(req.method||''))return sendJson(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
  try{
    const upstreamUrl=new URL(ADMIN_API);for(const [key,value] of incoming.searchParams)upstreamUrl.searchParams.append(key,value);
    const headers={};for(const name of ['authorization','content-type','apikey','x-client-info']){const value=req.headers[name];if(value)headers[name]=Array.isArray(value)?value.join(','):value}
    const body=req.method==='POST'?await readBody(req):undefined;
    const upstream=await fetch(upstreamUrl,{method:req.method,headers,body});
    const contentType=upstream.headers.get('content-type')||'application/json; charset=utf-8';
    const raw=Buffer.from(await upstream.arrayBuffer());
    res.statusCode=upstream.status;res.setHeader('Content-Type',contentType);res.setHeader('X-Noktena-Proxy','railway');
    if(contentType.includes('application/json')){
      try{const data=rewriteValue(req,JSON.parse(raw.toString('utf8')));return res.end(JSON.stringify(data))}catch{}
    }
    return res.end(raw);
  }catch(error){return sendJson(res,502,{ok:false,error:'UPSTREAM_UNAVAILABLE',message:error instanceof Error?error.message:String(error)})}
});
server.listen(PORT,'0.0.0.0',()=>console.log(`noktena admin proxy listening on ${PORT}`));
