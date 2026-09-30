(() => {
  'use strict';
  const config=window.NoktenaHomeBanners;
  const section=document.getElementById('homeBanners');
  if(!config||!section)return;
  const payload=(window.NOKTENA_CATALOG_BOOTSTRAP?.rows||[]).find(row=>row.product_key===config.KEY)?.payload;
  const contacts=(window.NOKTENA_CATALOG_BOOTSTRAP?.rows||[]).find(row=>row.product_key==='settings:contacts_v1')?.payload;
  const banners=config.fromPayload(payload).filter(item=>item.enabled&&item.title);
  if(!banners.length)return;
  const slides=document.getElementById('homeBannersSlides');
  const controls=document.getElementById('homeBannersControls');
  const counter=document.getElementById('homeBannersCounter');
  const cards=[];
  for(const banner of banners){
    const card=document.createElement('article');card.className='home-banner';
    const copy=document.createElement('div');copy.className='home-banner-copy';
    if(banner.label){const label=document.createElement('span');label.className='home-banner-label';label.textContent=banner.label;copy.append(label)}
    const title=document.createElement('h2');title.textContent=banner.title;copy.append(title);
    if(banner.description){const description=document.createElement('p');description.textContent=banner.description;copy.append(description)}
    const href=config.resolveLink(banner.link,contacts);
    if(banner.button&&href){
      const link=document.createElement('a');link.className='home-banner-button';link.href=href;link.textContent=banner.button;
      if(link.protocol==='https:'&&link.origin!==location.origin){link.target='_blank';link.rel='noopener noreferrer'}
      const arrow=document.createElement('span');arrow.setAttribute('aria-hidden','true');arrow.textContent=' ↗';link.append(arrow);copy.append(link);
    }
    card.append(copy);
    if(banner.image){
      const visual=document.createElement('div');visual.className='home-banner-visual';
      const image=document.createElement('img');image.src=banner.image;image.alt=banner.alt||banner.title;image.loading='lazy';image.decoding='async';
      image.addEventListener('error',()=>{visual.remove();card.classList.add('home-banner-no-image')},{once:true});
      visual.append(image);card.append(visual);
    }else card.classList.add('home-banner-no-image');
    cards.push(card);slides.append(card);
  }
  let current=0;
  function show(index){
    current=(index+cards.length)%cards.length;
    cards.forEach((card,i)=>{card.hidden=i!==current});
    counter.textContent=`${current+1} / ${cards.length}`;
  }
  section.hidden=false;
  controls.hidden=cards.length<2;
  show(0);
  document.getElementById('homeBannerPrevious').addEventListener('click',()=>show(current-1));
  document.getElementById('homeBannerNext').addEventListener('click',()=>show(current+1));
})();
