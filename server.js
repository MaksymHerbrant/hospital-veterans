import http from 'node:http';
import { readFile, writeFile, rename, mkdir, stat, appendFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { extname, resolve, sep } from 'node:path';

const port = Number(process.env.PORT || 3001);
const envPassword = process.env.ADMIN_PASSWORD || '';
const path = resolve('data/content.json');
const usersPath = resolve('data/users.json');
const auditPath = resolve('data/audit.jsonl');
const sessions = new Map();
const attempts = new Map();
const hashPassword = pw => ({ hash: bcrypt.hashSync(String(pw), 12) });
const verifyHash = async (input, _salt, hash) => bcrypt.compare(String(input || ''), hash);
const saveUsers = async users => {
 await mkdir(resolve('data'), { recursive: true });
 const tmp = usersPath + '.tmp';
 await writeFile(tmp, JSON.stringify(users, null, 2), 'utf8');
 await rename(tmp, usersPath);
};
const readUsers = async () => {
 try {
  const list = JSON.parse(await readFile(usersPath, 'utf8'));
  if (Array.isArray(list) && list.length) return list;
 } catch {}
 const now = new Date().toISOString();
 const initialPw = envPassword.length >= 12 ? envPassword : 'admin';
 const initial = [{ login: 'admin', role: 'superadmin', ...hashPassword(initialPw), mustChangePassword: false, active: true, createdAt: now, updatedAt: now }];
 await saveUsers(initial);
 return initial;
};
const clientIp = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
const auditLog = async (req, action, details = '', user = '—') => {
 try {
  await mkdir(resolve('data'), { recursive: true });
  const entry = { time: new Date().toISOString(), ip: clientIp(req), user, action, details };
  await appendFile(auditPath, JSON.stringify(entry) + '\n', 'utf8');
 } catch (e) { console.error('Audit log error:', e); }
};
const diffContentChanges = (prev, next) => {
 const changes = [];
 const byId = arr => new Map((arr || []).map(x => [x.id, x]));
 const checkList = (key, label, fields) => {
  const oldMap = byId(prev[key]), newMap = byId(next[key]);
  for (const [id, item] of newMap) {
   const old = oldMap.get(id);
   const name = item.title || item.name || id;
   if (!old) {
    changes.push({ action: `create_${key}`, details: `Створено (${label}): «${name}»` });
    continue;
   }
   const changed = fields.filter(([f]) => JSON.stringify(old[f] ?? null) !== JSON.stringify(item[f] ?? null)).map(([, lbl]) => lbl);
   if (changed.length) changes.push({ action: `update_${key}`, details: `Оновлено (${label}): «${name}» — ${changed.join(', ')}` });
  }
  for (const [id, old] of oldMap) {
   if (!newMap.has(id)) changes.push({ action: `delete_${key}`, details: `Видалено (${label}): «${old.title || old.name || id}»` });
  }
 };
 checkList('posts', 'новина', [['title', 'заголовок'], ['date', 'дата'], ['image', 'фото'], ['excerpt', 'опис'], ['content', 'текст']]);
 checkList('pages', 'сторінка', [['title', 'заголовок'], ['content', 'текст'], ['department', 'структура відділення']]);
 checkList('services', 'послуга', [['department', 'підрозділ'], ['category', 'розділ'], ['group', 'група'], ['name', 'назва'], ['price', 'ціна']]);
 return changes;
};
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon','.pdf':'application/pdf','.doc':'application/msword','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.xls':'application/vnd.ms-excel','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.zip':'application/zip','.mp4':'video/mp4'};
const mediaRoot = resolve('media');
const siteTitle = 'Львівський обласний госпіталь ветеранів війн та репресованих ім. Ю. Липи';
const defaultDesc = 'Львівський обласний госпіталь ветеранів війн та репресованих ім. Ю. Липи — багатопрофільний медичний заклад';
const defaultImage = '/wp-content/uploads/2024/05/slider0004.jpg';
let cachedContent = null;
let cachedMtime = 0;
const getContent = async () => {
 const info = await stat(path);
 if (!cachedContent || info.mtimeMs !== cachedMtime) {
  cachedContent = JSON.parse(await readFile(path, 'utf8'));
  cachedMtime = info.mtimeMs;
 }
 return cachedContent;
};
const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stripHtml = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const sameSlug = (a, b) => { try { return decodeURIComponent(a) === decodeURIComponent(b); } catch { return a === b; } };
const firstImg = html => { const m = String(html || '').match(/<img[^>]+src=["']([^"']+)["']/i); return m ? m[1] : ''; };
const resolveMeta = (pathname, data, origin) => {
 const parts = pathname.split('/').filter(Boolean);
 const type = parts[0] || '';
 let slug = '';
 try { slug = decodeURIComponent(parts.slice(1).join('/')); } catch { slug = parts.slice(1).join('/'); }
 let title = siteTitle, description = defaultDesc, image = defaultImage, ogType = 'website';
 if (type === 'news' && !slug) {
  title = `Наші новини — ${siteTitle}`;
 } else if (type === 'news' && slug) {
  const item = (data.posts || []).find(x => sameSlug(x.slug, slug));
  if (item) {
   title = `${item.title} — ${siteTitle}`;
   description = item.excerpt || stripHtml(item.content).slice(0, 180) || defaultDesc;
   image = (item.image && !item.image.startsWith('data:')) ? item.image : defaultImage;
   ogType = 'article';
  }
 } else if (type === 'pages') {
  title = `Структура госпіталю — ${siteTitle}`;
 } else if (type === 'page' && slug) {
  const item = (data.pages || []).find(x => sameSlug(x.slug, slug));
  if (item) {
   title = `${item.title} — ${siteTitle}`;
   const snippet = item.intro || stripHtml(item.content) || stripHtml(item.department?.accordion?.[0]?.content);
   description = snippet ? snippet.slice(0, 180) : defaultDesc;
   image = item.department?.carousel?.[0] || firstImg(item.content) || defaultImage;
  }
 } else if (type === 'project' && slug) {
  const item = (data.projects || []).find(x => sameSlug(x.slug, slug));
  if (item) {
   title = `${item.title} — ${siteTitle}`;
   description = stripHtml(item.content).slice(0, 180) || defaultDesc;
   image = item.image || firstImg(item.content) || defaultImage;
  }
 } else if (type === 'team-members' && slug) {
  const item = (data.doctors || []).find(x => sameSlug(x.slug, slug));
  if (item) {
   title = `${item.name}${item.position ? ' — ' + item.position : ''} — ${siteTitle}`;
   description = stripHtml(item.content).slice(0, 180) || item.position || defaultDesc;
   image = item.photo || defaultImage;
   ogType = 'profile';
  }
 } else if (type === 'team-group' && slug) {
  const item = (data.teams || []).find(x => sameSlug(x.slug, slug));
  if (item) title = `${item.title} — Команда — ${siteTitle}`;
 } else if (type === 'likari') {
  title = `Пошук лікаря — ${siteTitle}`;
 }
 const absImage = image.startsWith('http') ? image : `${origin}${image.startsWith('/') ? '' : '/'}${image}`;
 return { title, description: description.slice(0, 200), image: absImage, ogType, url: `${origin}${pathname}` };
};
const injectMeta = (htmlText, meta) => {
 const tags = [
  `<meta property="og:type" content="${esc(meta.ogType)}"/>`,
  `<meta property="og:title" content="${esc(meta.title)}"/>`,
  `<meta property="og:description" content="${esc(meta.description)}"/>`,
  `<meta property="og:image" content="${esc(meta.image)}"/>`,
  `<meta property="og:url" content="${esc(meta.url)}"/>`,
  `<meta name="twitter:card" content="summary_large_image"/>`,
  `<meta name="twitter:title" content="${esc(meta.title)}"/>`,
  `<meta name="twitter:description" content="${esc(meta.description)}"/>`,
  `<meta name="twitter:image" content="${esc(meta.image)}"/>`
 ].join('');
 return htmlText
  .replace(/<title>[^<]*<\/title>/i, `<title>${esc(meta.title)}</title>`)
  .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${esc(meta.description)}"/>`)
  .replace(/<\/head>/i, `${tags}</head>`);
};
const json = (res, status, data, headers={}) => {res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data));};
// Шматки тіла запиту збираються як байти й декодуються разом: інакше літера на межі шматка ламається на «��».
const readBody = async req => {const chunks=[];let size=0;for await (const chunk of req) {size+=chunk.length;if(size>12_000_000) throw Error('Завеликий запит');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');};
const sameOrigin = req => {const origin=req.headers.origin;if(!origin) return false;try{return new URL(origin).host===req.headers.host;}catch{return false;}};
const getSession = req => {
 const token = (req.headers.cookie || '').match(/(?:^|; )session=([a-f0-9]+)/)?.[1];
 const sess = sessions.get(token);
 if (!sess || sess.expires < Date.now()) { sessions.delete(token); return null; }
 return { token, ...sess };
};
const requireAuth = async (req, res, { superadmin = false, allowTemp = false } = {}) => {
 const sess = getSession(req);
 if (!sess) { json(res, 401, { error: 'Потрібно увійти' }); return null; }
 const users = await readUsers();
 const user = users.find(u => u.login === sess.login);
 if (!user || user.active === false) { sessions.delete(sess.token); json(res, 401, { error: 'Обліковий запис вимкнено' }); return null; }
 if (superadmin && user.role !== 'superadmin') { json(res, 403, { error: 'Доступ лише для суперадміна' }); return null; }
 if (!allowTemp && user.mustChangePassword) { json(res, 403, { error: 'Спочатку змініть тимчасовий пароль' }); return null; }
 return { sess, user, users };
};
http.createServer(async (req,res)=>{
 try {
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){
   if(req.method !== 'GET' && !sameOrigin(req)) return json(res,403,{error:'Недозволений запит'});
   if(url.pathname==='/api/content' && req.method==='GET') return json(res,200,JSON.parse(await readFile(path,'utf8')));
   if(url.pathname==='/api/login' && req.method==='POST'){
    const ip=clientIp(req);const entry=attempts.get(ip)||{count:0,until:0};
    if(entry.until>Date.now()){await auditLog(req,'login_locked','Перевищено кількість спроб входу');return json(res,429,{error:'Забагато спроб. Спробуйте через 15 хвилин.'});}
    const body=await readBody(req);
    const loginName=String(body.login||'admin').trim();
    const input=String(body.password||'');
    const users=await readUsers();
    const user=users.find(u=>u.login===loginName);
    if(!user||user.active===false||!(await verifyHash(input,user.salt,user.hash))){
     entry.count++;if(entry.count>=5){entry.until=Date.now()+900000;entry.count=0;}attempts.set(ip,entry);
     await auditLog(req,'login_fail',`Невдала спроба входу (${user&&user.active===false?'заблокований':'неправильний логін/пароль'})`,loginName);
     return json(res,401,{error:user&&user.active===false?'Обліковий запис заблоковано':'Неправильний логін або пароль'});
    }
    attempts.delete(ip);
    const token=randomBytes(32).toString('hex');
    sessions.set(token,{login:user.login,role:user.role,expires:Date.now()+8*3600000});
    await auditLog(req,'login_ok',`Вхід (${user.role})`,user.login);
    return json(res,200,{ok:true,login:user.login,role:user.role,mustChangePassword:Boolean(user.mustChangePassword)},{'Set-Cookie':`session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.NODE_ENV==='production'?'; Secure':''}`});
   }
   if(url.pathname==='/api/session' && req.method==='GET'){
    const sess=getSession(req);
    if(!sess)return json(res,200,{authenticated:false});
    const users=await readUsers();
    const user=users.find(u=>u.login===sess.login);
    if(!user||user.active===false){sessions.delete(sess.token);return json(res,200,{authenticated:false});}
    return json(res,200,{authenticated:true,login:user.login,role:user.role,mustChangePassword:Boolean(user.mustChangePassword)});
   }
   if(url.pathname==='/api/logout' && req.method==='POST'){
    const sess=getSession(req);
    if(sess)sessions.delete(sess.token);
    await auditLog(req,'logout','Вихід з адмінпанелі',sess?.login||'—');
    return json(res,200,{ok:true},{'Set-Cookie':'session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});
   }
   if(url.pathname==='/api/change-password' && req.method==='POST'){
    const auth=await requireAuth(req,res,{allowTemp:true});if(!auth)return;
    const body=await readBody(req);
    if(!(await verifyHash(body.currentPassword,auth.user.salt,auth.user.hash)))return json(res,401,{error:'Поточний пароль неправильний'});
    const nextPw=String(body.newPassword||'').trim();
    if(nextPw.length<8)return json(res,400,{error:'Новий пароль має містити щонайменше 8 символів.'});
    const nextLogin=body.newLogin!==undefined?String(body.newLogin).trim():auth.user.login;
    if(!/^[a-zA-Z0-9._-]{3,32}$/.test(nextLogin))return json(res,400,{error:'Логін має містити 3–32 латинські літери, цифри або . _ -'});
    if(nextLogin!==auth.user.login&&auth.users.some(u=>u.login===nextLogin))return json(res,409,{error:'Такий логін уже зайнятий.'});
    const oldLogin=auth.user.login;
    Object.assign(auth.user,{login:nextLogin,...hashPassword(nextPw),mustChangePassword:false,updatedAt:new Date().toISOString()});
    await saveUsers(auth.users);
    auth.sess.login=nextLogin;
    sessions.set(auth.sess.token,{login:nextLogin,role:auth.user.role,expires:auth.sess.expires});
    await auditLog(req,'password_change',oldLogin!==nextLogin?`Зміна логіну (${oldLogin} → ${nextLogin}) та пароля`:'Зміна власного пароля',nextLogin);
    return json(res,200,{ok:true,login:nextLogin,mustChangePassword:false});
   }
   if(url.pathname==='/api/users' && req.method==='GET'){
    const auth=await requireAuth(req,res,{superadmin:true});if(!auth)return;
    return json(res,200,{users:auth.users.map(({salt,hash,...u})=>u)});
   }
   if(url.pathname==='/api/users' && req.method==='POST'){
    const auth=await requireAuth(req,res,{superadmin:true});if(!auth)return;
    const body=await readBody(req);
    const loginName=String(body.login||'').trim();
    const pw=String(body.password||'').trim();
    const role=body.role==='superadmin'?'superadmin':'editor';
    if(!/^[a-zA-Z0-9._-]{3,32}$/.test(loginName))return json(res,400,{error:'Логін має містити 3–32 латинські літери, цифри або . _ -'});
    if(pw.length<8)return json(res,400,{error:'Тимчасовий пароль має містити щонайменше 8 символів.'});
    if(auth.users.some(u=>u.login===loginName))return json(res,409,{error:'Користувач із таким логіном уже існує.'});
    const now=new Date().toISOString();
    auth.users.push({login:loginName,role,...hashPassword(pw),mustChangePassword:true,active:true,createdAt:now,updatedAt:now});
    await saveUsers(auth.users);
    await auditLog(req,'create_user',`Створено користувача «${loginName}» (${role})`,auth.user.login);
    return json(res,200,{ok:true});
   }
   if(url.pathname==='/api/users' && req.method==='PATCH'){
    const auth=await requireAuth(req,res,{superadmin:true});if(!auth)return;
    const body=await readBody(req);
    const target=auth.users.find(u=>u.login===body.login);
    if(!target)return json(res,404,{error:'Користувача не знайдено.'});
    if(body.active===false&&target.login===auth.user.login)return json(res,400,{error:'Не можна заблокувати самого себе.'});
    if(body.active===false&&target.role==='superadmin'&&auth.users.filter(u=>u.role==='superadmin'&&u.active!==false).length<=1)return json(res,400,{error:'Має залишатися хоча б один активний суперадмін.'});
    const actions=[];
    if(typeof body.active==='boolean'){target.active=body.active;actions.push(body.active?'розблоковано':'заблоковано');}
    if(body.role==='superadmin'||body.role==='editor'){
     if(target.role==='superadmin'&&body.role!=='superadmin'&&auth.users.filter(u=>u.role==='superadmin'&&u.active!==false).length<=1)return json(res,400,{error:'Має залишатися хоча б один суперадмін.'});
     target.role=body.role;actions.push(`роль: ${body.role}`);
    }
    if(body.password){
     const pw=String(body.password).trim();
     if(pw.length<8)return json(res,400,{error:'Пароль має містити щонайменше 8 символів.'});
     Object.assign(target,{...hashPassword(pw),mustChangePassword:true});
     actions.push('скинуто тимчасовий пароль');
    }
    target.updatedAt=new Date().toISOString();
    await saveUsers(auth.users);
    await auditLog(req,'update_user',`Користувач «${target.login}»: ${actions.join(', ')}`,auth.user.login);
    return json(res,200,{ok:true});
   }
   if(url.pathname==='/api/users' && req.method==='DELETE'){
    const auth=await requireAuth(req,res,{superadmin:true});if(!auth)return;
    const body=await readBody(req);
    if(body.login===auth.user.login)return json(res,400,{error:'Не можна видалити самого себе.'});
    const target=auth.users.find(u=>u.login===body.login);
    if(!target)return json(res,404,{error:'Користувача не знайдено.'});
    if(target.role==='superadmin'&&auth.users.filter(u=>u.role==='superadmin'&&u.active!==false).length<=1)return json(res,400,{error:'Має залишатися хоча б один суперадмін.'});
    await saveUsers(auth.users.filter(u=>u.login!==body.login));
    await auditLog(req,'delete_user',`Видалено користувача «${body.login}»`,auth.user.login);
    return json(res,200,{ok:true});
   }
   if(url.pathname==='/api/audit' && req.method==='GET'){
    const auth=await requireAuth(req,res,{superadmin:true});if(!auth)return;
    let entries=[];
    try{const raw=await readFile(auditPath,'utf8');entries=raw.trim().split('\n').filter(Boolean).map(line=>JSON.parse(line)).reverse().slice(0,500);}catch{}
    return json(res,200,{entries});
   }
   if(url.pathname==='/api/content' && req.method==='PUT'){
    const auth=await requireAuth(req,res);if(!auth)return;
    const data=await readBody(req);if(!Array.isArray(data.pages)||!Array.isArray(data.posts))return json(res,400,{error:'Некоректні дані'});
    const prev=await getContent();
    const changes=diffContentChanges(prev,data);
    const tmp=path+'.tmp';await writeFile(tmp,JSON.stringify(data,null,2));await rename(tmp,path);cachedContent=data;
    for(const c of changes) await auditLog(req,c.action,c.details,auth.user.login);
    if(!changes.length) await auditLog(req,'save_content','Збереження без змін вмісту',auth.user.login);
    return json(res,200,{ok:true});
   }
   if(url.pathname==='/api/upload' && req.method==='POST'){
    const auth=await requireAuth(req,res);if(!auth)return;
    const body=await readBody(req);
    const match=String(body.dataUrl||'').match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
    if(!match)return json(res,400,{error:'Підтримуються лише зображення JPEG, PNG або WebP.'});
    const buf=Buffer.from(match[2],'base64');
    if(buf.length>2_500_000)return json(res,400,{error:'Розмір фотографії не повинен перевищувати 2 МБ.'});
    const ext=match[1]==='jpeg'?'jpg':match[1];
    const dir=resolve(mediaRoot,'wp-content/uploads/admin');
    await mkdir(dir,{recursive:true});
    const filename=`${Date.now()}-${randomBytes(4).toString('hex')}.${ext}`;
    await writeFile(resolve(dir,filename),buf);
    const fileUrl=`/wp-content/uploads/admin/${filename}`;
    await auditLog(req,'upload',`Завантажено фото: ${fileUrl} (${Math.round(buf.length/1024)} КБ)`,auth.user.login);
    return json(res,200,{url:fileUrl});
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
  if(extname(file)==='.html'){
   const origin=`${req.headers['x-forwarded-proto']||'http'}://${req.headers.host||`localhost:${port}`}`;
   const meta=resolveMeta(url.pathname,await getContent(),origin);
   contents=Buffer.from(injectMeta(contents.toString('utf8'),meta),'utf8');
  }
  res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(contents);
 }catch(e){console.error(e);json(res,500,{error:'Помилка сервера'});}
}).listen(port,()=>console.log(`Сервер працює на http://localhost:${port}`));
