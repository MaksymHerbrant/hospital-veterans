import http from 'node:http';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { extname, resolve, sep } from 'node:path';

const port = Number(process.env.PORT || 3001);
const password = process.env.ADMIN_PASSWORD || '';
const path = resolve('data/content.json');
const sessions = new Map();
const attempts = new Map();
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon','.pdf':'application/pdf','.doc':'application/msword','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.xls':'application/vnd.ms-excel','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.zip':'application/zip','.mp4':'video/mp4'};
const mediaRoot = resolve('media');
const json = (res, status, data, headers={}) => {res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data));};
// Шматки тіла запиту збираються як байти й декодуються разом: інакше літера на межі шматка ламається на «��».
const readBody = async req => {const chunks=[];let size=0;for await (const chunk of req) {size+=chunk.length;if(size>12_000_000) throw Error('Завеликий запит');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');};
const sameOrigin = req => {const origin=req.headers.origin;if(!origin) return false;try{return new URL(origin).host===req.headers.host;}catch{return false;}};
const authenticated = req => {const token=(req.headers.cookie||'').match(/(?:^|; )session=([a-f0-9]+)/)?.[1];const expires=sessions.get(token);if(!expires||expires<Date.now()){sessions.delete(token);return false;}return true;};
http.createServer(async (req,res)=>{
 try {
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){
   if(req.method !== 'GET' && !sameOrigin(req)) return json(res,403,{error:'Недозволений запит'});
   if(url.pathname==='/api/content' && req.method==='GET') return json(res,200,JSON.parse(await readFile(path,'utf8')));
   if(url.pathname==='/api/login' && req.method==='POST'){
    if(password.length<12) return json(res,503,{error:'Адміністратор має встановити ADMIN_PASSWORD (щонайменше 12 символів).'});
    const ip=req.socket.remoteAddress;const entry=attempts.get(ip)||{count:0,until:0};if(entry.until>Date.now())return json(res,429,{error:'Забагато спроб. Спробуйте через 15 хвилин.'});
    const input=String((await readBody(req)).password||'');const a=Buffer.from(input),b=Buffer.from(password);
    if(a.length!==b.length||!timingSafeEqual(a,b)){entry.count++;if(entry.count>=5){entry.until=Date.now()+900000;entry.count=0;}attempts.set(ip,entry);return json(res,401,{error:'Неправильний пароль'});}
    attempts.delete(ip);const token=randomBytes(32).toString('hex');sessions.set(token,Date.now()+8*3600000);
    return json(res,200,{ok:true},{'Set-Cookie':`session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.NODE_ENV==='production'?'; Secure':''}`});
   }
   if(url.pathname==='/api/session' && req.method==='GET')return json(res,200,{authenticated:authenticated(req)});
   if(url.pathname==='/api/logout' && req.method==='POST'){const token=(req.headers.cookie||'').match(/(?:^|; )session=([a-f0-9]+)/)?.[1];sessions.delete(token);return json(res,200,{ok:true},{'Set-Cookie':'session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});}
   if(url.pathname==='/api/content' && req.method==='PUT'){
    if(!authenticated(req))return json(res,401,{error:'Потрібно увійти'});
    const data=await readBody(req);if(!Array.isArray(data.pages)||!Array.isArray(data.posts))return json(res,400,{error:'Некоректні дані'});
    const tmp=path+'.tmp';await writeFile(tmp,JSON.stringify(data,null,2));await rename(tmp,path);return json(res,200,{ok:true});
   }
   return json(res,404,{error:'Не знайдено'});
  }
  if(req.method!=='GET')return json(res,405,{error:'Метод не підтримується'});
  if(url.pathname.startsWith('/wp-content/uploads/')){
   // Фото й документи, перенесені зі старого сайту скриптом імпорту.
   const file=resolve(mediaRoot,'.'+decodeURIComponent(url.pathname));
   if(!file.startsWith(mediaRoot+sep))return json(res,403,{error:'Заборонено'});
   let contents;try{contents=await readFile(file);}catch{return json(res,404,{error:'Файл не знайдено'});}
   const type=mime[extname(file).toLowerCase()]||'application/octet-stream';
   res.writeHead(200,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=86400',...(type==='image/svg+xml'?{'Content-Security-Policy':"sandbox; default-src 'none'; style-src 'unsafe-inline'"}:{})});
   return res.end(contents);
  }
  const dist=resolve('dist');const requested=resolve(dist,'.'+decodeURIComponent(url.pathname));if(requested!==dist&&!requested.startsWith(dist+sep))return json(res,403,{error:'Заборонено'});
  let file=requested;let contents;try{contents=await readFile(file);}catch{file=resolve(dist,'index.html');contents=await readFile(file);}
  res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(contents);
 }catch(e){console.error(e);json(res,500,{error:'Помилка сервера'});}
}).listen(port,()=>console.log(`Сервер працює на http://localhost:${port}`));
