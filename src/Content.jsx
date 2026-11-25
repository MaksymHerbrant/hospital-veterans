import React, {useEffect,useState,useRef} from 'react';
import Header, {departments,departmentUrl} from './Header';
import Footer from './Footer';
import BenefitIcon from './BenefitIcon';
const request=async(url,options)=>{const r=await fetch(url,options);const d=await r.json();if(!r.ok)throw Error(d.error||'Помилка запиту');return d;};
const urlFor=(item,type)=>`/${type}/${encodeURIComponent(item.slug)}`;
const same=(a,b)=>{try{return decodeURIComponent(a)===decodeURIComponent(b)}catch{return a===b}};
function internalLinks(markup,data){
 const doc=new DOMParser().parseFromString(markup||'', 'text/html');
 const records=[...data.pages.map(x=>[x,'page']),...data.posts.map(x=>[x,'news']),...(data.projects||[]).map(x=>[x,'project']),...(data.doctors||[]).map(x=>[x,'team-members']),...(data.teams||[]).map(x=>[x,'team-group'])];
 const normalize=path=>{try{return decodeURIComponent(path).replace(/\/$/,'')||'/'}catch{return path.replace(/\/$/,'')||'/'}};
 for(const anchor of doc.querySelectorAll('a[href]')){
  const href=anchor.getAttribute('href');if(!href||href.startsWith('#')||/^(mailto:|tel:)/i.test(href))continue;
  let url;try{url=new URL(href,'https://hospital-veterans.lviv.ua/')}catch{anchor.removeAttribute('href');continue}
  if(url.hostname==='portal-doctor3.eleks.com' && url.pathname.includes('/registration.html')){anchor.setAttribute('target','_blank');anchor.setAttribute('rel','noopener noreferrer');continue}
  if(!['hospital-veterans.lviv.ua','www.hospital-veterans.lviv.ua'].includes(url.hostname))continue;
  const path=normalize(url.pathname);
  if(path==='/'){anchor.setAttribute('href','/');continue}
  if(path==='/novyny'){anchor.setAttribute('href','/news');continue}
  // Файли перенесено скриптом імпорту в media/, сервер віддає їх за тією самою адресою.
  if(path.startsWith('/wp-content/uploads/')){anchor.setAttribute('href',url.pathname);continue}
  const found=records.find(([item])=>{try{return normalize(new URL(item.source).pathname)===path}catch{return false}});
  if(found){anchor.setAttribute('href',urlFor(...found)+(url.hash||''));continue}
  anchor.setAttribute('href','/material?path='+encodeURIComponent(url.pathname));
 }
 for(const img of doc.querySelectorAll('img[src]')){
  try{const url=new URL(img.getAttribute('src'),'https://hospital-veterans.lviv.ua/');if(url.hostname.endsWith('hospital-veterans.lviv.ua')&&url.pathname.startsWith('/wp-content/uploads/'))img.setAttribute('src',url.pathname);}catch{}
  img.setAttribute('loading','lazy');
 }
 return doc.body.innerHTML;
}
function Shell({children,teams}){return <><Header teams={teams}/>{children}<Footer/></>}
function Banner({crumb,title,date}){return <div className="page-banner"><div className="wrap"><a href="/">Головна</a> / {crumb}<h1>{title}</h1>{date&&<time>{date}</time>}</div></div>}
function counterIconType(icon=''){
 const s=icon.toLowerCase();
 if(s.includes('bed'))return 'bed';
 if(s.includes('users'))return 'staff';
 if(s.includes('user-md')||s.includes('stethoscope'))return 'doctor';
 if(s.includes('user'))return 'user';
 if(s.includes('heart'))return 'heart';
 if(s.includes('flask')||s.includes('lab'))return 'lab';
 return 'hospital';
}
function DepartmentCarousel({images,title}){
 const [idx,setIdx]=useState(0);
 const touchX=useRef(null);
 if(!images?.length)return null;
 const step=d=>setIdx(i=>(i+d+images.length)%images.length);
 return <div className="dept-carousel" onTouchStart={e=>{touchX.current=e.touches[0]?.clientX??null}} onTouchEnd={e=>{if(touchX.current===null)return;const dx=(e.changedTouches[0]?.clientX??touchX.current)-touchX.current;if(Math.abs(dx)>45)step(dx<0?1:-1);touchX.current=null}}>
  <div className="dept-carousel-track"><img src={images[idx]} alt={title}/></div>
  {images.length>1&&<><button type="button" className="dept-slide-btn prev" aria-label="Попереднє фото" onClick={()=>step(-1)}>❮</button><button type="button" className="dept-slide-btn next" aria-label="Наступне фото" onClick={()=>step(1)}>❯</button><div className="dept-carousel-dots">{images.map((_,i)=><button key={i} type="button" className={i===idx?'active':''} aria-label={`Фото ${i+1}`} onClick={()=>setIdx(i)}/>)}</div></>}
 </div>;
}
function DepartmentPage({item,data}){
 const dept=item.department;
 const [openIdx,setOpenIdx]=useState(0);
 const htmlBody=internalLinks(item.content,data);
 const hasBody=Boolean(htmlBody.replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').trim()||/<(img|iframe|table)\b/i.test(htmlBody));
 return <main>
  <Banner crumb="Відділення" title={item.title}/>
  <div className="wrap dept-page">
   {dept.counters?.length>0&&<section className="dept-counters" aria-label="Показники відділення">{dept.counters.map((c,i)=><div className="dept-counter" key={i}><span className="dept-counter-icon"><BenefitIcon type={counterIconType(c.icon)}/></span><strong>{c.value}</strong><span>{c.label}</span></div>)}</section>}
   {(dept.carousel?.length>0||dept.accordion?.length>0)&&<section className={'dept-main-grid'+(dept.carousel?.length&&dept.accordion?.length?' two-cols':'')}>
    <DepartmentCarousel images={dept.carousel} title={item.title}/>
    {dept.accordion?.length>0&&<div className="dept-accordion-wrap"><h2>{dept.accordionTitle||'Послуги відділення'}</h2><div className="reference-accordion dept-accordion">{dept.accordion.map((a,i)=><div className={'accordion-item '+(openIdx===i?'active':'')} key={i}><button type="button" aria-expanded={openIdx===i} onClick={()=>setOpenIdx(openIdx===i?-1:i)}><span>{openIdx===i?'−':'+'}</span>{a.title}</button>{openIdx===i&&<div className="dept-accordion-body" dangerouslySetInnerHTML={{__html:internalLinks(a.content,data)}}/>}</div>)}</div></div>}
   </section>}
   {hasBody&&<article className="article-body dept-about-body" dangerouslySetInnerHTML={{__html:htmlBody}}/>}
   {dept.team?.length>0&&<section className="dept-team-section"><h2>{dept.teamTitle||'Колектив відділення'}</h2><div className="doctor-grid">{dept.team.map((m,i)=><a className="doctor-card" key={i} href={m.href||'/likari'}>{m.photo?<img src={m.photo} alt={m.name} loading="lazy"/>:<span className="doctor-photo-empty" aria-hidden="true">✚</span>}<strong>{m.name}</strong>{m.position&&<span>{m.position}</span>}</a>)}</div></section>}
  </div>
 </main>;
}
function DoctorCard({doctor}){return <a className="doctor-card" href={urlFor(doctor,'team-members')}>{doctor.photo?<img src={doctor.photo} alt={doctor.name} loading="lazy"/>:<span className="doctor-photo-empty" aria-hidden="true">✚</span>}<strong>{doctor.name}</strong>{doctor.position&&<span>{doctor.position}</span>}{doctor.groups?.length>0&&<small>{doctor.groups.map(g=>g.title).join(', ')}</small>}</a>}
function DoctorGrid({list}){return list.length?<div className="doctor-grid">{list.map(d=><DoctorCard key={d.id} doctor={d}/>)}</div>:<p>Лікарів за вашим запитом не знайдено. Спробуйте інше прізвище або оберіть «Всі відділення».</p>}

export function useNewsPagination(posts){
 const [page,setPage]=useState(1);
 const [monthOnly,setMonthOnly]=useState(false);
 const [mobile,setMobile]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(max-width: 600px)').matches);
 useEffect(()=>{
  const mq=window.matchMedia('(max-width: 600px)');
  const onChange=e=>setMobile(e.matches);
  mq.addEventListener('change',onChange);
  return()=>mq.removeEventListener('change',onChange);
 },[]);
 const monthPrefix=new Date().toISOString().slice(0,7);
 const sorted=[...(posts||[])].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
 const monthCount=sorted.filter(p=>(p.date||'').startsWith(monthPrefix)).length;
 const filtered=monthOnly?sorted.filter(p=>(p.date||'').startsWith(monthPrefix)):sorted;
 const perPage=mobile?3:6;
 const totalPages=Math.max(1,Math.ceil(filtered.length/perPage));
 const current=Math.min(page,totalPages);
 const visible=filtered.slice((current-1)*perPage,current*perPage);
 const toggleMonth=val=>{setMonthOnly(val);setPage(1);};
 return {visible,page:current,setPage,totalPages,monthOnly,setMonthOnly:toggleMonth,monthCount,totalCount:sorted.length};
}

export function NewsPagination({page,totalPages,onChange}){
 if(totalPages<=1)return null;
 const pages=[];
 for(let i=1;i<=totalPages;i++){
  if(i===1||i===totalPages||Math.abs(i-page)<=1)pages.push(i);
  else if(pages[pages.length-1]!=='…')pages.push('…');
 }
 return <nav className="news-pagination" aria-label="Сторінки новин">
  <button type="button" disabled={page<=1} onClick={()=>onChange(page-1)} aria-label="Попередня сторінка">‹</button>
  {pages.map((p,idx)=>p==='…'?<span key={'e'+idx} className="news-page-dots">…</span>:<button key={p} type="button" className={p===page?'active':''} aria-current={p===page?'page':undefined} onClick={()=>onChange(p)}>{p}</button>)}
  <button type="button" disabled={page>=totalPages} onClick={()=>onChange(page+1)} aria-label="Наступна сторінка">›</button>
 </nav>;
}

export function trimExcerpt(text,content='',max=140){
 const raw=(text||String(content||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ')).replace(/\s+/g,' ').trim();
 if(!raw||raw.length<=max)return raw;
 const cut=raw.slice(0,max);
 const space=cut.lastIndexOf(' ');
 return (space>max*0.5?cut.slice(0,space):cut).replace(/[,:;.\-–—]+$/,'')+'…';
}

function AllNewsPage({posts}){
 const {visible,page,setPage,totalPages,monthOnly,setMonthOnly,monthCount,totalCount}=useNewsPagination(posts);
 return <main className="wrap section"><div className="section-label">ПОДІЇ ТА ІСТОРІЇ</div><div className="news-header-row"><h1 className="page-title">Наші новини</h1><div className="news-filter-tabs"><button type="button" className={!monthOnly?'active':''} onClick={()=>setMonthOnly(false)}>Усі</button><button type="button" className={monthOnly?'active':''} onClick={()=>setMonthOnly(true)}>За цей місяць</button></div></div><div className="news-grid all-news">{visible.map(x=><article key={x.id}>{x.image&&<a href={urlFor(x,'news')}><img src={x.image} alt="" loading="lazy"/></a>}<div className="news-body"><time>{x.date}</time><h3><a href={urlFor(x,'news')}>{x.title}</a></h3><p>{trimExcerpt(x.excerpt,x.content)}</p><a className="text-link" href={urlFor(x,'news')}>Читати далі →</a></div></article>)}</div>{!visible.length&&<p>За цей місяць новин поки немає.</p>}<NewsPagination page={page} totalPages={totalPages} onChange={p=>{setPage(p);window.scrollTo({top:0,behavior:'smooth'});}}/></main>;
}

export function ContentApp(){const [data,setData]=useState(null),[error,setError]=useState('');useEffect(()=>{request('/api/content').then(setData).catch(e=>setError(e.message));},[]);const path=location.pathname.split('/').filter(Boolean);const type=path[0],slug=decodeURIComponent(path.slice(1).join('/'));const teams=data?.teams||[];
const sources={page:data?.pages,news:data?.posts,project:data?.projects,'team-members':data?.doctors,'team-group':data?.teams};
let item=data&&(sources[type]||[]).find(x=>same(x.slug,slug));
useEffect(()=>{
 const baseTitle='Львівський обласний госпіталь ветеранів війн та репресованих ім. Ю. Липи';
 let title=baseTitle;
 if(type==='news'&&!slug)title=`Наші новини — ${baseTitle}`;
 else if(type==='pages')title=`Структура госпіталю — ${baseTitle}`;
 else if(type==='likari')title=`Пошук лікаря — ${baseTitle}`;
 else if(item)title=`${item.title||item.name} — ${baseTitle}`;
 document.title=title;
},[type,slug,item]);
const S=({children})=><Shell teams={teams}>{children}</Shell>;
if(error)return <S><main className="wrap section">Не вдалося завантажити матеріали: {error}</main></S>;if(!data)return <S><main className="wrap section">Завантаження…</main></S>;
if(type==='pages')return <S><main className="wrap section"><div className="section-label">ЛЬВІВСЬКИЙ ОБЛАСНИЙ ГОСПІТАЛЬ</div><h1 className="page-title">Структура госпіталю</h1><div className="directory">{departments.map(([title,slug])=><a href={departmentUrl(slug)} key={slug}>{title}<span>→</span></a>)}</div></main></S>;
if(type==='news'&&!slug)return <S><AllNewsPage posts={data.posts}/></S>;
if(type==='likari'){const params=new URLSearchParams(location.search),q=(params.get('q')||'').trim().toLowerCase(),g=params.get('g')||'';const list=(data.doctors||[]).filter(d=>(!q||d.name.toLowerCase().includes(q))&&(!g||d.groups?.some(x=>same(x.slug,g))));const team=teams.find(t=>same(t.slug,g));return <S><main><Banner crumb="Пошук лікаря" title={q?`Результати пошуку для «${params.get('q').trim()}»`:'Пошук лікаря'}/><div className="wrap section">{team&&<p className="search-scope">Відділення: <a href={urlFor(team,'team-group')}>{team.title}</a></p>}<p className="search-count">Знайдено лікарів: {list.length}</p><DoctorGrid list={list}/></div></main></S>}
if(item && ['platni-poslugy','platni-poslugy-kardioczentr'].includes(item.slug)) return <PaidServices data={data} item={item}/>;
if(type==='material')return <S><main className="wrap section"><h1 className="page-title">Матеріал ще не перенесено</h1><p>Цей матеріал поки недоступний на новому сайті. Зверніться до контакт-центру за номером <a href="tel:0800203050">0 800 20 30 50</a>.</p><a className="text-link" href="/pages">Переглянути підрозділи →</a></main></S>;
if(!item)return <S><main className="wrap section"><h1 className="page-title">Сторінку не знайдено</h1><a className="text-link" href="/">На головну →</a></main></S>;
if(type==='team-group'){const list=(data.doctors||[]).filter(d=>d.groups?.some(x=>same(x.slug,item.slug)));return <S><main><Banner crumb="Наша команда" title={item.title}/><div className="wrap section"><DoctorGrid list={list}/></div></main></S>}
if(type==='team-members')return <S><main><Banner crumb="Наша команда" title={item.name}/><div className="wrap section doctor-profile"><aside>{item.photo&&<img src={item.photo} alt={item.name}/>}<h2>{item.name}</h2>{item.position&&<p className="doctor-position">{item.position}</p>}{item.email&&<a className="doctor-email" href={'mailto:'+item.email}>✉ {item.email}</a>}{item.phone&&<a className="doctor-phone" href={'tel:'+item.phone.replace(/[^\d+]/g,'')}>☎ {item.phone}</a>}{item.groups?.map(g=>{const t=teams.find(x=>same(x.slug,g.slug));return t?<a key={g.slug} href={urlFor(t,'team-group')}>{g.title}</a>:<span key={g.slug}>{g.title}</span>})}</aside><article className="article-body" dangerouslySetInnerHTML={{__html:internalLinks(item.content,data)}}/></div></main></S>;
if(type==='page'&&item.department)return <S><DepartmentPage item={item} data={data}/></S>;
const crumb=type==='news'?'Новини':type==='project'?'Проекти реконструкції':'Інформація';
return <S><main><Banner crumb={crumb} title={item.title} date={item.date}/><article className={"wrap article-body "+(item.slug==='administracziya-gospitalyu'?'administration-page':'')} dangerouslySetInnerHTML={{__html:internalLinks(item.content,data)}}/></main></S>}

function PaidServices({data,item}){const [query,setQuery]=useState('');const department=item.slug.includes('kardioczentr')?'Кардіоцентр':'Госпіталь';const list=(data.services||[]).filter(x=>x.department===department && (x.name+' '+x.category+' '+(x.group||'')).toLowerCase().includes(query.toLowerCase()));const categories=[...new Set(list.map(x=>x.category))];return <Shell teams={data.teams||[]}><main><Banner crumb="Платні послуги" title={`Платні послуги — ${department.toLowerCase()}`}/><div className="wrap section"><p className="paid-intro">{item.intro||<>Ознайомтеся з переліком платних послуг. Для уточнення інформації зателефонуйте до контакт-центру: <a href="tel:0800203050">0 800 20 30 50</a>.</>}</p><div className="paid-switch"><a className={department==='Госпіталь'?'selected':''} href="/page/platni-poslugy">Госпіталь</a><a className={department==='Кардіоцентр'?'selected':''} href="/page/platni-poslugy-kardioczentr">Кардіоцентр</a></div><label className="search-label">Пошук послуги<input className="search" placeholder="Наприклад, консультація або аналіз" value={query} onChange={e=>setQuery(e.target.value)}/></label>{categories.map(category=><section className="price-category" key={category}><h2>{category}</h2><table><thead><tr><th>Послуга</th><th>Вартість, грн</th></tr></thead><tbody>{list.filter(x=>x.category===category).map(x=><tr key={x.id}><td>{x.group&&<small>{x.group} · </small>}{x.name}</td><td>{x.price}</td></tr>)}</tbody></table></section>)}{!list.length&&<p>Послуг за вашим запитом не знайдено.</p>}</div></main></Shell>}

export function ContentPreview({kind,item,data}){
 const safeData=data||{pages:[],posts:[],projects:[],doctors:[],teams:[]};
 if(kind==='services'){
  return <section className="price-category" style={{marginTop:0}}><h2>{item.category||'Розділ послуг'}</h2><table><thead><tr><th>Послуга</th><th>Вартість, грн</th></tr></thead><tbody><tr><td>{item.group&&<small>{item.group} · </small>}{item.name||'Назва послуги'}</td><td>{item.price||'0,00'}</td></tr></tbody></table></section>;
 }
 if(kind==='pages'&&item.department){
  return <DepartmentPage item={item} data={safeData}/>;
 }
 const crumb=kind==='posts'?'Новини':'Інформація';
 return <>
  {kind==='posts'&&<div className="preview-news-card"><div className="section-label" style={{marginBottom:12}}>КАРТКА В СПИСКУ НОВИН</div><div className="news-grid all-news" style={{gridTemplateColumns:'minmax(0,360px)'}}><article>{item.image&&<img src={item.image} alt=""/>}<div className="news-body"><time>{item.date}</time><h3>{item.title||'Без заголовка'}</h3><p>{item.excerpt}</p><span className="text-link">Читати далі →</span></div></article></div></div>}
  <Banner crumb={crumb} title={item.title||'Без заголовка'} date={item.date}/>
  <article className={"wrap article-body "+(item.slug==='administracziya-gospitalyu'?'administration-page':'')} dangerouslySetInnerHTML={{__html:internalLinks(item.content,safeData)}}/>
 </>;
}
