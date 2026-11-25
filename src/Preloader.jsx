import React,{useEffect,useState} from 'react';
export default function Preloader(){
 const [visible,setVisible]=useState(true);
 useEffect(()=>{let timer;const stop=()=>{timer=setTimeout(()=>setVisible(false),250)};if(document.readyState==='complete')stop();else window.addEventListener('load',stop,{once:true});const fallback=setTimeout(()=>setVisible(false),1800);return()=>{window.removeEventListener('load',stop);clearTimeout(timer);clearTimeout(fallback)}},[]);
 return <div className={'site-preloader '+(!visible?'is-hidden':'')} aria-hidden={!visible}><img src="/assets/loader.gif" alt=""/><span className="visually-hidden">Завантаження сайту</span></div>;
}
