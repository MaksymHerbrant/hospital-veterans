import React, {useEffect,useState} from 'react';
import Header, {departments,departmentUrl} from './Header';
import Footer from './Footer';
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
function DoctorCard({doctor}){return <a className="doctor-card" href={urlFor(doctor,'team-members')}>{doctor.photo?<img src={doctor.photo} alt={doctor.name} loading="lazy"/>:<span className="doctor-photo-empty" aria-hidden="true">✚</span>}<strong>{doctor.name}</strong>{doctor.position&&<span>{doctor.position}</span>}{doctor.groups?.length>0&&<small>{doctor.groups.map(g=>g.title).join(', ')}</small>}</a>}
function DoctorGrid({list}){return list.length?<div className="doctor-grid">{list.map(d=><DoctorCard key={d.id} doctor={d}/>)}</div>:<p>Лікарів за вашим запитом не знайдено. Спробуйте інше прізвище або оберіть «Всі відділення».</p>}

export function ContentApp(){const [data,setData]=useState(null),[error,setError]=useState('');useEffect(()=>{request('/api/content').then(setData).catch(e=>setError(e.message));},[]);const path=location.pathname.split('/').filter(Boolean);const type=path[0],slug=decodeURIComponent(path.slice(1).join('/'));const teams=data?.teams||[];
const sources={page:data?.pages,news:data?.posts,project:data?.projects,'team-members':data?.doctors,'team-group':data?.teams};
let item=data&&(sources[type]||[]).find(x=>same(x.slug,slug));
const S=({children})=><Shell teams={teams}>{children}</Shell>;
if(error)return <S><main className="wrap section">Не вдалося завантажити матеріали: {error}</main></S>;if(!data)return <S><main className="wrap section">Завантаження…</main></S>;
if(type==='pages')return <S><main className="wrap section"><div className="section-label">ЛЬВІВСЬКИЙ ОБЛАСНИЙ ГОСПІТАЛЬ</div><h1 className="page-title">Структура госпіталю</h1><div className="directory">{departments.map(([title,slug])=><a href={departmentUrl(slug)} key={slug}>{title}<span>→</span></a>)}</div></main></S>;
if(type==='news'&&!slug)return <S><main className="wrap section"><div className="section-label">ПОДІЇ ТА ІСТОРІЇ</div><h1 className="page-title">Наші новини</h1><div className="news-grid all-news">{data.posts.map(x=><article key={x.id}>{x.image&&<a href={urlFor(x,'news')}><img src={x.image} alt="" loading="lazy"/></a>}<div className="news-body"><time>{x.date}</time><h3><a href={urlFor(x,'news')}>{x.title}</a></h3><p>{x.excerpt}</p><a className="text-link" href={urlFor(x,'news')}>Читати далі →</a></div></article>)}</div></main></S>;
if(type==='likari'){const params=new URLSearchParams(location.search),q=(params.get('q')||'').trim().toLowerCase(),g=params.get('g')||'';const list=(data.doctors||[]).filter(d=>(!q||d.name.toLowerCase().includes(q))&&(!g||d.groups?.some(x=>same(x.slug,g))));const team=teams.find(t=>same(t.slug,g));return <S><main><Banner crumb="Пошук лікаря" title={q?`Результати пошуку для «${params.get('q').trim()}»`:'Пошук лікаря'}/><div className="wrap section">{team&&<p className="search-scope">Відділення: <a href={urlFor(team,'team-group')}>{team.title}</a></p>}<p className="search-count">Знайдено лікарів: {list.length}</p><DoctorGrid list={list}/></div></main></S>}
if(item && ['platni-poslugy','platni-poslugy-kardioczentr'].includes(item.slug)) return <PaidServices data={data} item={item}/>;
if(type==='material')return <S><main className="wrap section"><h1 className="page-title">Матеріал ще не перенесено</h1><p>Цей матеріал поки недоступний на новому сайті. Зверніться до контакт-центру за номером <a href="tel:0800203050">0 800 20 30 50</a>.</p><a className="text-link" href="/pages">Переглянути підрозділи →</a></main></S>;
if(!item)return <S><main className="wrap section"><h1 className="page-title">Сторінку не знайдено</h1><a className="text-link" href="/">На головну →</a></main></S>;
if(type==='team-group'){const list=(data.doctors||[]).filter(d=>d.groups?.some(x=>same(x.slug,item.slug)));return <S><main><Banner crumb="Наша команда" title={item.title}/><div className="wrap section"><DoctorGrid list={list}/></div></main></S>}
if(type==='team-members')return <S><main><Banner crumb="Наша команда" title={item.name}/><div className="wrap section doctor-profile"><aside>{item.photo&&<img src={item.photo} alt={item.name}/>}<h2>{item.name}</h2>{item.position&&<p className="doctor-position">{item.position}</p>}{item.groups?.map(g=>{const t=teams.find(x=>same(x.slug,g.slug));return t?<a key={g.slug} href={urlFor(t,'team-group')}>{g.title}</a>:<span key={g.slug}>{g.title}</span>})}</aside><article className="article-body" dangerouslySetInnerHTML={{__html:internalLinks(item.content,data)}}/></div></main></S>;
const crumb=type==='news'?'Новини':type==='project'?'Проекти реконструкції':'Інформація';
return <S><main><Banner crumb={crumb} title={item.title} date={item.date}/><article className="wrap article-body" dangerouslySetInnerHTML={{__html:internalLinks(item.content,data)}}/></main></S>}

function PaidServices({data,item}){const [query,setQuery]=useState('');const department=item.slug.includes('kardioczentr')?'Кардіоцентр':'Госпіталь';const list=(data.services||[]).filter(x=>x.department===department && (x.name+' '+x.category+' '+(x.group||'')).toLowerCase().includes(query.toLowerCase()));const categories=[...new Set(list.map(x=>x.category))];return <Shell teams={data.teams||[]}><main><Banner crumb="Платні послуги" title={`Платні послуги — ${department.toLowerCase()}`}/><div className="wrap section"><p className="paid-intro">{item.intro||<>Ознайомтеся з переліком платних послуг. Для уточнення інформації зателефонуйте до контакт-центру: <a href="tel:0800203050">0 800 20 30 50</a>.</>}</p><div className="paid-switch"><a className={department==='Госпіталь'?'selected':''} href="/page/platni-poslugy">Госпіталь</a><a className={department==='Кардіоцентр'?'selected':''} href="/page/platni-poslugy-kardioczentr">Кардіоцентр</a></div><label className="search-label">Пошук послуги<input className="search" placeholder="Наприклад, консультація або аналіз" value={query} onChange={e=>setQuery(e.target.value)}/></label>{categories.map(category=><section className="price-category" key={category}><h2>{category}</h2><table><thead><tr><th>Послуга</th><th>Вартість, грн</th></tr></thead><tbody>{list.filter(x=>x.category===category).map(x=><tr key={x.id}><td>{x.group&&<small>{x.group} · </small>}{x.name}</td><td>{x.price}</td></tr>)}</tbody></table></section>)}{!list.length&&<p>Послуг за вашим запитом не знайдено.</p>}</div></main></Shell>}
