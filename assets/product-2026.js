(() => {
  'use strict';
  const dialog=document.querySelector('#productLightbox');
  const image=document.querySelector('#productLightboxImage');
  document.addEventListener('click',event=>{
    if(event.target.closest('.pd-lightbox-close')){dialog?.close();return;}
    const trigger=event.target.closest('.pd-zoom');
    if(!trigger||!dialog||!image)return;
    const active=document.querySelector('#pdMainImage');
    if(!active?.src)return;
    image.src=active.src;
    image.alt=active.alt;
    dialog.showModal();
  });
  dialog?.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
})();
