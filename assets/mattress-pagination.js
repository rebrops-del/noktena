(() => {
  'use strict';
  const PAGE_SIZE=12;
  let page=1;
  let timer=null;
  const grid=document.getElementById('grid');
  if(!grid)return;
  const holder=document.createElement('div');
  holder.id='mattressPagination';
  holder.className='f-pagination';
  grid.insertAdjacentElement('afterend',holder);

  function pagesMarkup(total,current){
    const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
    if(pages<=1)return '';
    const nums=[];
    const from=Math.max(1,current-2),to=Math.min(pages,current+2);
    if(from>1)nums.push(1);
    if(from>2)nums.push('…');
    for(let i=from;i<=to;i++)nums.push(i);
    if(to<pages-1)nums.push('…');
    if(to<pages)nums.push(pages);
    return `<button class="f-page" data-mattress-page="${current-1}" ${current<=1?'disabled':''}>←</button>${nums.map(n=>n==='…'?'<span class="f-page" style="display:grid;place-items:center;border:0;cursor:default">…</span>':`<button class="f-page ${n===current?'is-active':''}" data-mattress-page="${n}">${n}</button>`).join('')}<button class="f-page" data-mattress-page="${current+1}" ${current>=pages?'disabled':''}>→</button>`;
  }

  function apply(){
    const cards=Array.from(grid.children).filter(el=>el.classList.contains('card'));
    const pages=Math.max(1,Math.ceil(cards.length/PAGE_SIZE));
    page=Math.min(Math.max(1,page),pages);
    const from=(page-1)*PAGE_SIZE,to=page*PAGE_SIZE;
    cards.forEach((card,i)=>{card.style.display=(i>=from&&i<to)?'':'none'});
    holder.innerHTML=pagesMarkup(cards.length,page);
    holder.style.display=cards.length>PAGE_SIZE?'flex':'none';
  }

  function schedule(reset=false){
    if(reset)page=1;
    clearTimeout(timer);
    timer=setTimeout(apply,30);
  }

  const observer=new MutationObserver(()=>schedule(false));
  observer.observe(grid,{childList:true});

  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-mattress-page]');
    if(!btn||btn.disabled)return;
    page=Number(btn.dataset.mattressPage)||1;
    apply();
    document.getElementById('catalog')?.scrollIntoView({behavior:'smooth',block:'start'});
  });

  ['q','cat','size','max'].forEach(id=>document.getElementById(id)?.addEventListener('input',()=>schedule(true)));
  ['cat','size','max'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>schedule(true)));
  window.addEventListener('hashchange',()=>{if(location.hash==='#mattresses')schedule(false)});
  schedule(false);
})();
