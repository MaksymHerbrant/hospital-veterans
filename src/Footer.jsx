import React from 'react';

// Однаковий підвал на всіх сторінках, як на оригінальному сайті.
export default function Footer(){
 return <footer className="reference-footer"><div className="reference-wrap"><div className="footer-boxes"><a href="tel:+380322961140"><b>☎</b><span>Контакти приймальні<strong>(0322) 961-140</strong></span></a><a href="mailto:logivr@gmail.com"><b>✉</b><span>Для листування<strong>logivr@gmail.com</strong></span></a><div><b>♟</b><span>Ми в соцмережах<strong><a href="https://www.facebook.com/shpytal">Facebook</a> &nbsp; <a href="https://instagram.com/hospital.veterans.vynnyky?igshid=MzMyNGUyNmU2YQ==">Instagram</a></strong></span></div></div><div className="reference-copyright"><span>Copyright © 2024 Львівський обласний госпіталь</span><span><a href="/page/publichna-oferta">Публічна оферта</a> &nbsp;|&nbsp; <a href="/news">Новини</a> &nbsp;|&nbsp; <a href="/page/kontakty">Контакти</a></span></div></div></footer>;
}
