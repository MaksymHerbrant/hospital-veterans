import React from 'react';
export default function BenefitIcon({type}){
 const shared={fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round'};
 return <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" {...shared}>
 {type==='staff'&&<><circle cx="16" cy="9" r="4"/><path d="M8 26v-2a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7v2z"/><circle cx="5.5" cy="12" r="2.5"/><circle cx="26.5" cy="12" r="2.5"/><path d="M3 22v-1a5 5 0 0 1 5-5h1M29 22v-1a5 5 0 0 0-5-5h-1"/></>}
 {type==='heart'&&<><path d="M16 27S4 20 4 11.8C4 5 12 3 16 9c4-6 12-4 12 2.8C28 20 16 27 16 27z"/><path d="M5 16h6l2-4 3 8 3-7 2 3h6"/></>}
 {type==='doctor'&&<><circle cx="16" cy="8" r="4"/><path d="M7 27v-3a9 9 0 0 1 18 0v3zM11 17v4a3 3 0 0 0 6 0v-4M22 17v4"/><circle cx="22" cy="23" r="2"/></>}
 {type==='lab'&&<><path d="M12 4h8M14 4v9L7 25a2 2 0 0 0 2 3h14a2 2 0 0 0 2-3l-7-12V4"/><path d="M10 21h12"/></>}
 {type==='hospital'&&<><path d="M5 28h22M8 28V8h16v20M13 8V4h6v4M16 11v5M13.5 13.5h5M12 19h1M19 19h1M12 23h1M19 23h1M15 28v-5h2v5"/></>}
 </svg>
}
