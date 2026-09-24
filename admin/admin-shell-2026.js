(()=>{
  'use strict';
  const $=s=>document.querySelector(s);
  const links=[...document.querySelectorAll('[data-admin-open]')];
  function active(view){links.forEach(x=>x.classList.toggle('is-current',x.dataset.adminOpen===view))}
  links.forEach(link=>link.addEventListener('click',()=>{
    const view=link.dataset.adminOpen;
    if(view==='orders'){$('#ordersTab')?.click();active('orders')}
    else{
      $('#catalogTab')?.click();
      active(view==='catalog'?'catalog':view);
      if(view==='prices')$('#settingsOpen')?.click();
      if(view==='delivery')$('#deliverySettingsOpen')?.click();
    }
  }));
  $('#catalogTab')?.addEventListener('click',()=>active('catalog'));
  $('#ordersTab')?.addEventListener('click',()=>active('orders'));
  const badge=$('#ordersBadge'),side=$('#sideOrdersBadge');
  if(badge&&side){
    const sync=()=>{side.hidden=badge.classList.contains('hide');side.textContent=badge.textContent};
    new MutationObserver(sync).observe(badge,{attributes:true,childList:true,characterData:true});sync();
  }
})();
