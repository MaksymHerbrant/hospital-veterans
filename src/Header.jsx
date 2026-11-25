import React,{useState} from 'react';

export const departments = [
 ['Адміністрація госпіталю','administracziya-gospitalyu'],
 ['Консультативна поліклініка','konsultatyvna-poliklinika'],
 ['Кардіологічний центр','kardiologichnyj-czentr'],
 ['Відділення екстреної медичної допомоги','viddilennya-ekstrenoyi-medychnoyi-dopomogy'],
 ['Центр ментального здоров’я','czentr-mentalnogo-zdorov%ca%bcya'],
 ['Хірургічне відділення','hirurgichne-viddilennya'],
 ['Інсультне відділення','insultne-viddilennya'],
 ['Відділення інтервенційної радіології','viddilennya-intervenczijnoyi-radiologiyi'],
 ['Відділення анестезіології та інтенсивної терапії','viddilennya-anesteziologiyi-ta-intensyvnoyi-terapiyi'],
 ['Кардіологічне відділення','cardiologichne-viddilennya'],
 ['Відділення ендоскопії','viddilennya-endoskopiij'],
 ['Відділення кістково-гнійної хірургії','viddilennya-kistkovo-gnijnoyi-hirurgiyi'],
 ['Рентгенологічне відділення','rentgenologichne-viddilennya'],
 ['Нейрореабілітаційне відділення','nejroreabilitaczijne-viddilennya'],
 ['Відділення термічної травми та реконструктивної хірургії','viddilennya-termichnoyi-travmy-ta-rekonstruktyvnoyi-hirurgiyi'],
 ['Ортопедо-травмалогічне відділення','ortopedo-travmalogichne-viddilennya'],
 ['Неврологічне відділення','nevrologichne-viddilennya'],
 ['Відділення реабілітації','viddilennya-reabilitacziyi'],
 ['Відділення хірургії голови та шиї','viddilennya-hirurgiyi-golovy-ta-shyyi'],
 ['Відділення артрології, вертебрології та нейрохірургії','viddilennya-artrologiyi-vertebrologiyi-ta-nejrohirurgiyi'],
 ['Нейрохірургічна служба','nejrohirurgichna-sluzhba'],
 ['Терапевтичне відділення','terapevtychne-viddilennya'],
 ['Ендокринологічне відділення','endokrynologichne-viddilennya'],
 ['Реабілітаційне відділення смт Дубляни','reabilitaczijne-viddilennya-smt-dublyany'],
 ['Клініко-діагностична лабораторія','kliniko-diagnostychna-laboratoriya'],
];
export const departmentUrl=slug=>'/page/'+encodeURIComponent(slug);
const booking='https://portal-doctor3.eleks.com/web/HospitalVeteransYuriiaLypy/registration.html';
export default function Header({teams=[]}){
 const [menu,setMenu]=useState(false),[expanded,setExpanded]=useState('');
 const params=new URLSearchParams(location.search),onSearch=location.pathname==='/likari';
 const [search,setSearch]=useState(onSearch);
 const toggle=name=>setExpanded(current=>current===name?'':name);
 return <><div className="top"><div className="wrap top-inner"><span>✚ &nbsp; МИ ПРАЦЮЄМО 24/7</span><span>Контакт-центр госпіталю &nbsp; <a href="tel:0800203050">0 800 20 30 50</a><i/> Екстрена медична допомога &nbsp; <a href="tel:0683107417">068 310 74 17</a></span></div></div><header className="site-header"><div className="wrap header"><a className="brand" href="/"><img src="/wp-content/uploads/2023/09/logo-color-lightblue-00badf.png" alt="Логотип госпіталю"/><span><strong>Львівський обласний госпіталь</strong><small>ветеранів війн та репресованих ім. Ю. Липи</small></span></a><div className="header-contact"><span className="phone-icon">☎</span><span><small>Контакт-центр</small><a href="tel:0800203050">0 800 20 30 50</a></span></div><button type="button" className="search-toggle" onClick={()=>setSearch(!search)} aria-expanded={search} aria-controls="doctor-search"><span aria-hidden="true">⌕</span><b>Пошук лікаря</b></button><a className="button header-btn" href={booking}>Онлайн-запис на прийом <span>↗</span></a><a className="mobile-bookmark" href={booking} aria-label="Онлайн-запис на прийом">♟</a><button className="menu-toggle" onClick={()=>setMenu(!menu)} aria-label={menu?'Закрити меню':'Відкрити меню'} aria-expanded={menu}>☰</button></div>{search&&<form id="doctor-search" className="doctor-search" action="/likari" method="get" role="search"><div className="wrap"><label>Пошук лікаря<input name="q" defaultValue={onSearch?params.get('q')||'':''} placeholder="Пошук за прізвищем" autoFocus={!onSearch}/></label><label>Відділення<select name="g" defaultValue={onSearch?params.get('g')||'':''} key={teams.length}><option value="">Всі відділення</option>{teams.map(t=><option key={t.slug} value={t.slug}>{t.title}</option>)}</select></label><button className="button">Знайти</button></div></form>}<nav className={menu?'open':''} aria-label="Основна навігація"><div className="wrap nav-inner"><a className={location.pathname==='/'?'active':''} href="/">Головна</a><a href="/news">Новини</a><div className={'dropdown department-menu '+(expanded==='departments'?'expanded':'')}><div className="dropdown-title"><a href="/pages">Структура госпіталю</a><button type="button" onClick={()=>toggle('departments')} aria-label="Показати підрозділи" aria-expanded={expanded==='departments'}>⌄</button></div><div className="dropdown-content mega-menu">{departments.map(([title,slug])=><a key={slug} href={departmentUrl(slug)}>{title}</a>)}</div></div><div className={'dropdown '+(expanded==='services'?'expanded':'')}><div className="dropdown-title"><a href="/page/platni-poslugy">Платні послуги</a><button type="button" onClick={()=>toggle('services')} aria-label="Показати платні послуги" aria-expanded={expanded==='services'}>⌄</button></div><div className="dropdown-content"><a href="/page/platni-poslugy">Госпіталь</a><a href="/page/platni-poslugy-kardioczentr">Кардіоцентр</a></div></div><a href="/page/publichna-informacziya">Публічна інформація</a><a href="/page/programa-interreg-next-polshha-ukrayina-2021-2027">Співпраця</a><a href="/page/kontakty">Контакти</a><a className="nav-book" href={booking}>Записатися ↗</a></div></nav></header></>;
}
