(()=>{
  'use strict';
  const toggle=document.querySelector('.menu-toggle');
  const menu=document.getElementById('mobileMenu');
  if(!toggle||!menu)return;
  const close=()=>{menu.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Открыть меню')};
  toggle.addEventListener('click',()=>{
    const opening=menu.hidden;
    menu.hidden=!opening;
    toggle.setAttribute('aria-expanded',String(opening));
    toggle.setAttribute('aria-label',opening?'Закрыть меню':'Открыть меню');
  });
  menu.addEventListener('click',e=>{if(e.target.closest('a'))close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  document.addEventListener('click',e=>{if(!menu.hidden&&!menu.contains(e.target)&&!toggle.contains(e.target))close()});
  window.addEventListener('resize',()=>{if(window.innerWidth>980)close()});
})();
