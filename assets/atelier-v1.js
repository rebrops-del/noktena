(()=>{
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const MAX_LINK='https://max.ru/u/f9LHodD0cOKZqie3BJvn11xgsNvxJK_kFOqYtKyFuZ2uMitoxZIwNaH8-NY';

  const ARTICLES={
    firmness:{
      label:'Матрасы · 5 минут чтения',
      title:'Как выбрать жёсткость матраса и не ошибиться',
      html:`<p>Жёсткость — это не оценка качества. Она описывает ощущение поверхности и то, насколько сильно матрас сопротивляется нагрузке. Два человека могут выбрать разные варианты и оба будут правы.</p><h3>Начните не с технологии, а с ощущения</h3><p>Если вы привыкли к мягкой поверхности, очень жёсткий матрас может ощущаться непривычно. Если нравится более плотная опора, слишком мягкая модель, наоборот, может показаться «проваливающейся». Поэтому сначала определите привычное ощущение: мягче, средне или плотнее.</p><h3>Учитывайте вес и привычную позу</h3><p>При большей нагрузке обычно важнее стабильная поддержка и плотные слои. Для сна на боку часто ценится более адаптивная поверхность, чтобы плечо и таз не испытывали излишнего давления. Для сна на спине обычно ищут баланс между комфортом и устойчивой опорой.</p><h3>Смотрите на конструкцию целиком</h3><p>Пружинный блок, пена, кокосовое волокно, латекс и другие слои работают вместе. Один и тот же материал в разной толщине может заметно менять ощущение модели. Сравнивайте не название наполнителя, а всю конструкцию и заявленную жёсткость сторон.</p><p>Если у вас есть медицинские ограничения или конкретные рекомендации врача по спальному месту, они должны иметь приоритет над общими советами по выбору.</p>`
    },
    bed:{
      label:'Кровати · 4 минуты чтения',
      title:'Почему размер спального места — это только половина выбора кровати',
      html:`<p>На карточке кровати обычно первым делом смотрят на спальное место: 140×200, 160×200 или 180×200. Но для реальной комнаты не менее важны внешние габариты.</p><h3>Проверьте ширину и глубину корпуса</h3><p>Изголовье, боковые царги и форма корпуса добавляют сантиметры к размеру матраса. Перед заказом полезно измерить не только место под матрас, но и свободный проход вокруг кровати, расстояние до шкафа, тумб и двери.</p><h3>Подумайте о сценарии использования</h3><p>Если под кроватью нужен большой объём хранения, подъёмный механизм может быть удобнее выдвижных ящиков. Если кровать стоит в узкой комнате, важна глубина корпуса и то, не мешает ли открывание соседней мебели.</p><h3>Собирайте спальню как комплект</h3><p>Кровать, матрас и высота посадки должны работать вместе. Высокий матрас заметно меняет общий силуэт кровати и высоту спального места. Поэтому лучше выбирать их не изолированно, а как одну систему.</p>`
    },
    sofa:{
      label:'Диваны · 4 минуты чтения',
      title:'Диван для ежедневного сна: что проверить до покупки',
      html:`<p>Для гостиной диван может быть прежде всего местом отдыха, а для ежедневного сна требования становятся строже. Важно заранее понять, как часто он будет раскладываться и сколько места займёт в разложенном виде.</p><h3>Измерьте пространство в двух состояниях</h3><p>Проверьте габариты дивана в сложенном и разложенном виде. Оставьте место для прохода и убедитесь, что механизм можно использовать без перестановки другой мебели.</p><h3>Обратите внимание на поверхность для сна</h3><p>Чем ровнее и стабильнее спальное место, тем проще использовать диван регулярно. Если есть выраженные стыки или перепады, стоит заранее оценить, насколько это подходит именно вам.</p><h3>Не забудьте про доставку</h3><p>Перед заказом полезно знать ширину дверных проёмов, размеры лифта и особенности лестничных пролётов. Для крупного дивана это может быть не менее важно, чем его размеры в комнате.</p>`
    },
    delivery:{
      label:'Сервис · 3 минуты чтения',
      title:'Как заранее рассчитать доставку, подъём и сборку',
      html:`<p>Чем точнее данные при оформлении заказа, тем понятнее итоговая стоимость и тем меньше уточнений перед доставкой.</p><h3>Подъём считается по каждому товару</h3><p>Если в заказе несколько позиций, для каждой можно отдельно выбрать способ подъёма и количество единиц. Например, кровать можно поднять на грузовом лифте, а часть матрасов — по лестнице.</p><h3>При подъёме по лестнице важен этаж</h3><p>Стоимость зависит от количества товаров и этажа. Если лифт есть, но крупный товар в него не помещается, лучше сразу выбрать лестницу для этой позиции.</p><h3>Сборка относится только к кроватям</h3><p>Если в корзине есть кровать, можно добавить услугу сборки и указать количество кроватей для сборки. Стоимость автоматически попадёт в итог заказа.</p>`
    }
  };

  function addHeroPanel(){
    const visual=$('.hero-visual');
    if(!visual||$('.atelier-hero-panel',visual))return;
    visual.insertAdjacentHTML('beforeend',`<div class="atelier-hero-panel atelier-reveal"><div><b>Персональный подбор без лишней сложности</b><span>Размер · комфорт · бюджет · доставка — соберём решение под вашу спальню</span></div><span class="atelier-hero-number">Матрасы · Кровати · Диваны</span></div>`);
  }

  function addSignature(){
    const hero=$('.hero');
    if(!hero||$('#atelierSignature'))return;
    hero.insertAdjacentHTML('afterend',`<section class="atelier-signature atelier-home-only" id="atelierSignature"><div class="wrap"><div class="atelier-section-head atelier-reveal"><div><div class="atelier-kicker">Коллекция для спальни</div><h2>Не просто товар. Спокойное пространство, в которое хочется возвращаться.</h2></div><p>Начните с того, что нужно сейчас. В каждом разделе можно сравнить размеры, комплектацию и стоимость, а затем оформить всё в одной корзине.</p></div><div class="atelier-category-grid"><a class="atelier-category atelier-reveal" href="#mattresses"><span class="atelier-category-index">01 · Основа сна</span><h3>Матрасы</h3><p>Сравните жёсткость, состав и размер. Фильтр сразу показывает стоимость выбранного размера.</p><span class="atelier-category-link">Смотреть коллекцию <i>→</i></span></a><a class="atelier-category atelier-reveal" href="#beds"><span class="atelier-category-index">02 · Архитектура спальни</span><h3>Кровати</h3><p>Подберите спальное место, внешний размер, цвет и комплектацию под интерьер комнаты.</p><span class="atelier-category-link">Смотреть коллекцию <i>→</i></span></a><a class="atelier-category atelier-reveal" href="#sofas"><span class="atelier-category-index">03 · Комфорт каждый день</span><h3>Диваны</h3><p>Модели для отдыха и сна с понятными характеристиками, размерами и вариантами подъёма.</p><span class="atelier-category-link">Смотреть коллекцию <i>→</i></span></a></div></div></section>`);
  }

  function addJournal(){
    const hits=$('#homeHits');
    if(!hits||$('#atelierJournal'))return;
    hits.insertAdjacentHTML('afterend',`<section class="atelier-journal atelier-home-only" id="atelierJournal"><div class="wrap"><div class="atelier-section-head atelier-reveal"><div><div class="atelier-kicker">Журнал НОКТЕНА</div><h2>Выбор становится проще, когда понятно, на что смотреть.</h2></div><p>Короткие практические материалы без перегруженной терминологии. Откройте интересующую тему — статья останется прямо на странице.</p></div><div class="atelier-article-grid"><article class="atelier-article atelier-reveal"><div class="atelier-article-meta">Матрасы</div><h3>Как выбрать жёсткость матраса и не ошибиться</h3><p>Вес, привычная поза сна, конструкция и личные ощущения — четыре ориентира, которые действительно помогают сравнить модели.</p><button class="atelier-read" type="button" data-atelier-article="firmness">Читать материал <span>→</span></button></article><article class="atelier-article atelier-reveal"><div class="atelier-article-meta">Кровати</div><h3>Почему спального места недостаточно для выбора кровати</h3><p>Как проверить ширину, глубину, проходы, подъёмный механизм и итоговую высоту спального места.</p><button class="atelier-read" type="button" data-atelier-article="bed">Читать материал <span>→</span></button></article><article class="atelier-article atelier-reveal"><div class="atelier-article-meta">Диваны</div><h3>Диван для ежедневного сна: что проверить заранее</h3><p>Разложенный размер, поверхность для сна, механизм и маршрут доставки до комнаты.</p><button class="atelier-read" type="button" data-atelier-article="sofa">Читать материал <span>→</span></button></article><article class="atelier-article atelier-reveal"><div class="atelier-article-meta">Сервис</div><h3>Как рассчитать доставку, подъём и сборку</h3><p>Что происходит, если в корзине несколько товаров и для каждого нужен свой способ подъёма.</p><button class="atelier-read" type="button" data-atelier-article="delivery">Читать материал <span>→</span></button></article></div></div></section>`);
  }

  function addConcierge(){
    const footer=$('.footer');
    if(!footer||$('#atelierConcierge'))return;
    footer.insertAdjacentHTML('beforebegin',`<section class="atelier-concierge atelier-home-only" id="atelierConcierge"><div class="wrap"><div class="atelier-concierge-box atelier-reveal"><div><h2>Сложно выбрать? Не сравнивайте десятки карточек в одиночку.</h2><p>Напишите размер спального места, привычную жёсткость или цвет, ориентир по бюджету — менеджер поможет сузить выбор до нескольких подходящих вариантов.</p></div><div class="atelier-concierge-actions"><a class="atelier-concierge-primary" href="${MAX_LINK}" target="_blank" rel="noopener">Получить подбор в MAX</a><a class="atelier-concierge-secondary" href="#mattresses">Смотреть матрасы</a></div></div></div></section>`);
  }

  function upgradeFooter(){
    const foot=$('.footer .foot');
    if(!foot||foot.classList.contains('premium-footer-grid'))return;
    foot.className='premium-footer-grid';
    foot.innerHTML=`<div class="premium-footer-brand"><b>НОКТЕНА</b><p>Товары для сна и отдыха: матрасы, кровати и диваны. Екатеринбургский филиал, региональный склад — г. Берёзовский.</p><p class="premium-footer-note">Перед оформлением менеджер подтверждает актуальное наличие, комплектацию и условия доставки.</p></div><div><h3>Покупателям</h3><a href="#mattresses">Матрасы</a><a href="#beds">Кровати</a><a href="#sofas">Диваны</a><a href="#guide">Как выбрать</a><a href="#delivery">Доставка и подъём</a></div><div><h3>Связаться</h3><a href="tel:+79321207635">+7 (932) 120-76-35</a><a href="mailto:noktena@mail.ru">noktena@mail.ru</a><a href="${MAX_LINK}" target="_blank" rel="noopener">Написать в MAX</a></div>`;
  }

  function addDialog(){
    if($('#atelierDialog'))return;
    document.body.insertAdjacentHTML('beforeend',`<dialog class="atelier-dialog" id="atelierDialog"><div class="atelier-dialog-inner"><div class="atelier-dialog-top"><div><div class="atelier-dialog-label" id="atelierDialogLabel"></div><h2 id="atelierDialogTitle"></h2></div><button class="atelier-dialog-close" type="button" aria-label="Закрыть">×</button></div><div class="atelier-dialog-content" id="atelierDialogContent"></div></div></dialog>`);
    const dialog=$('#atelierDialog');
    $('.atelier-dialog-close',dialog)?.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
  }

  function bindArticles(){
    addDialog();
    document.addEventListener('click',e=>{
      const button=e.target.closest('[data-atelier-article]');
      if(!button)return;
      const article=ARTICLES[button.dataset.atelierArticle];
      if(!article)return;
      $('#atelierDialogLabel').textContent=article.label;
      $('#atelierDialogTitle').textContent=article.title;
      $('#atelierDialogContent').innerHTML=article.html;
      const dialog=$('#atelierDialog');
      if(typeof dialog.showModal==='function')dialog.showModal();
    });
  }

  function checkoutPolish(){
    if(!document.body.classList.contains('checkout-body'))return;
    const grid=$('#checkoutApp');
    if(grid&&!$('#atelierCheckoutAssurance'))grid.insertAdjacentHTML('beforebegin',`<div class="atelier-checkout-eyebrow">Оформление заказа НОКТЕНА</div><div class="atelier-checkout-assurance" id="atelierCheckoutAssurance"><span>Наличие подтвердит менеджер</span><span>Подъём считается по каждому товару</span><span>Сборка доступна для кроватей</span></div>`);
  }

  function productPolish(){
    if(!$('#productRoot'))return;
    const observer=new MutationObserver(()=>{
      const price=$('.pd-price-row');
      if(price&&!$('.atelier-product-promise'))price.insertAdjacentHTML('afterend',`<div class="atelier-product-promise"><b>Перед подтверждением заказа</b>Проверим выбранный размер, цвет, комплектацию и актуальное наличие. После этого согласуем доставку и дополнительные услуги.</div>`);
    });
    observer.observe($('#productRoot'),{childList:true,subtree:true});
  }

  function reveal(){
    const nodes=$$('.atelier-reveal');
    if(!('IntersectionObserver' in window)){nodes.forEach(x=>x.classList.add('is-visible'));return}
    const io=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');io.unobserve(entry.target)}}),{threshold:.08,rootMargin:'0px 0px -35px'});
    nodes.forEach(x=>io.observe(x));
  }

  function boot(){
    document.body.classList.add('atelier-ready');
    if($('.hero')){addHeroPanel();addSignature();addJournal();addConcierge();upgradeFooter();bindArticles()}
    checkoutPolish();productPolish();
    requestAnimationFrame(reveal);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
