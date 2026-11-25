import React,{useEffect,useState} from 'react';
import Header from './Header';
import Footer from './Footer';
import {values,about,stats,projects,departments} from './homeData';
const base='/wp-content/uploads/';
const booking='https://portal-doctor3.eleks.com/web/HospitalVeteransYuriiaLypy/registration.html';
const slides=[
 {image:'2024/05/slider0004.jpg',title:'ЗАХИЩАЄМО ЖИТТЯ,',accent:'ДАРУЄМО НАДІЮ',description:'● Компетентність  ● Відповідальність  ● Підтримка',doctor:'лікар-ортопед-травматолог відділення артрології, вертебрології та нейрохірургії Комнацький Микола Ігорович'},
 {image:'2024/04/slider02-1.jpg',title:'МИ ЗАВЖДИ',accent:'ТУРБУЄМОСЬ ПРО ПАЦІЄНТА',kicker:'Цілодобова підтримка',description:'Наша команда - колектив професіоналів',doctor:'Лікар з ультразвукової діагностики Ткаченко Ірина Леонідівна'},
 {image:'2024/04/slider003.jpg',title:'КОЖНИЙ ПАЦІЄНТ -',accent:'НАША НАЙВИЩА ТУРБОТА',description:'комфортні умови для наших відвідувачів',doctor:'завідувач неврологічним відділенням Бартошик Юлія Володимирівна'},
 {image:'2023/04/soldier.jpeg',title:'МИ ЦІНУЄМО ЗДОРОВ`Я',accent:'КОЖНОГО ЗАХИСНИКА!',description:'Госпіталь забезпечує всебічну підтримку та реабілітацію поранених військових',doctor:''}
];
const benefits=[['✚','КВАЛІФІКОВАНИЙ ПЕРСОНАЛ','Медперсонал з високим рівнем професійної підготовки'],['♥','ЕКСТРЕНА ДОПОМОГА','Цілодобовий прийом пацієнтів'],['♟','КОНСУЛЬТАЦІЇ СПЕЦІАЛІСТІВ','Завжди доступні спеціалісти'],['⚗','ЛАБОРАТОРІЯ','Швидке і якісне виконання аналізів'],['✚','КОМФОРТНІ УМОВИ','Оновлені зручні палати для пацієнтів']];
const page=slug=>'/page/'+encodeURIComponent(slug);
export default function Home(){
 const [slide,setSlide]=useState(0),[posts,setPosts]=useState([]),[teams,setTeams]=useState([]),[open,setOpen]=useState(departments[0].slug);
 useEffect(()=>{fetch('/api/content').then(r=>r.json()).then(d=>{setPosts(d.posts.slice(0,4));setTeams(d.teams||[])}).catch(()=>{});},[]);
 useEffect(()=>{const timer=setInterval(()=>setSlide(x=>(x+1)%slides.length),7000);return()=>clearInterval(timer)},[]);
 const change=amount=>setSlide(i=>(i+amount+slides.length)%slides.length);
 const s=slides[slide];
 return <><Header teams={teams}/><main className="original-home">
 <section className="reference-hero" style={{backgroundImage:`url('${base+s.image}')`}}><div className="reference-hero-inner"><div className="reference-hero-copy"><h1>{s.title}<span>{s.accent}</span></h1>{s.kicker&&<p className="hero-kicker">{s.kicker}</p>}<p>{s.description}</p><a className="reference-hero-button" href={booking}>Онлайн-запис на прийом</a><small>{s.doctor}</small></div></div><button className="slide-arrow previous" aria-label="Попередній слайд" onClick={()=>change(-1)}>❮</button><button className="slide-arrow next" aria-label="Наступний слайд" onClick={()=>change(1)}>❯</button></section>
 <div className="reference-wrap"><a className="contact-line" href="tel:0800203050">☎ &nbsp; НАШ КОНТАКТ-ЦЕНТР - 0-800-20-30-50</a>
 <section className="home-values" aria-label="Наші переваги">{values.map(v=><div key={v.title}><h2>{v.title}</h2><p>{v.text}</p></div>)}</section>
 <section className="reference-actions" aria-label="Запис та контакти"><div className="action-pair"><a href="tel:+380322590267">☎ &nbsp; РЕЄСТРАТУРА<br/> &nbsp;&nbsp;&nbsp;&nbsp; ПОЛІКЛІНІКИ</a><a href="tel:+380322961140">☎ &nbsp; НЕВІДКЛАДНА<br/> &nbsp;&nbsp;&nbsp;&nbsp; ДОПОМОГА</a></div><a className="red-action" href={booking}>▦ &nbsp; ОНЛАЙН-ЗАПИС НА ПРИЙОМ</a><a href="tel:+380954051611">☎ &nbsp; ЗАПИС НА СКРИНІНГ 40+</a><a className="pmg-action" href="/page/zapys-na-poslugy-za-programoyu-pmg">☎ &nbsp; ЗАПИС НА ПОСЛУГИ ЗА ПРОГРАМОЮ ПМГ</a></section>
 <section className="benefit-list">{benefits.map(([icon,title,description])=><div key={title}><span className="benefit-icon">{icon}</span><div><h2>{title}</h2><p>{description}</p></div></div>)}</section>
 <a href="/page/programa-interreg-next-polshha-ukrayina-2021-2027" className="reference-partner"><img src={base+'2025/02/surlap_ua_rgb-scaled.jpg'} alt="Interreg NEXT Польща–Україна, співфінансується Європейським Союзом, SURLAP"/></a>
 <section className="home-about" aria-label="Про госпіталь"><ul>{about.map(x=><li key={x}>{x}</li>)}</ul></section>
 <section className="home-stats"><h2>Результати попереднього року</h2><div>{stats.map(x=><p key={x.label}><strong>{x.value}</strong><span>{x.label}</span></p>)}</div></section>
 <section className="reference-news" id="news"><h2>НАШІ НОВИНИ</h2>{posts.map(post=><article key={post.id} className={post.image?'with-image':''}>{post.image&&<a className="reference-news-image" href={'/news/'+encodeURIComponent(post.slug)}><img src={post.image} alt="" loading="lazy"/></a>}<div><h3><a href={'/news/'+encodeURIComponent(post.slug)}>{post.title}</a></h3><time>▦ &nbsp;{post.date.split('-').reverse().join('.')}</time><p>{post.excerpt}</p><a className="reference-read" href={'/news/'+encodeURIComponent(post.slug)}>ЧИТАТИ ДАЛІ &nbsp;»</a></div></article>)}<a href="/news" className="all-news-link">Усі новини →</a></section></div>
 <section className="reference-projects"><div className="reference-wrap"><p>Ми постійно вдосконалюємось</p><h2>Наші здійснені проекти реконструкції госпіталю</h2><span className="project-divider"/><div className="project-cards">{projects.map(p=><a key={p.slug} href={'/project/'+encodeURIComponent(p.slug)}>{p.image&&<img src={base+p.image} alt="" loading="lazy"/>}<span>{p.title}</span></a>)}</div></div></section>
 <section className="reference-departments"><div className="reference-wrap"><h2>ОСНОВНІ ПІДРОЗДІЛИ</h2><div className="reference-accordion">{departments.map(d=><div className={'accordion-item '+(open===d.slug?'active':'')} key={d.slug}><button aria-expanded={open===d.slug} onClick={()=>setOpen(open===d.slug?'':d.slug)}><span>{open===d.slug?'−':'+'}</span>{d.title}</button>{open===d.slug&&<div className="accordion-detail">{d.image&&<img src={base+d.image} alt={d.title}/>}<div><p>{d.text}</p><a href={page(d.slug)}>Читати більше »</a></div></div>}</div>)}</div></div></section>
 <div className="reference-wrap accessibility-action"><a href="mailto:logivr@gmail.com">ЗАПИС ДЛЯ ЛЮДЕЙ З ВАДАМИ СЛУХУ ТА ЗОРУ</a></div></main>
 <Footer/></>
}
