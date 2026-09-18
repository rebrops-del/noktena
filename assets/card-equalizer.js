(() => {
  'use strict';

  function loadPolishLayer(){
    if(!document.querySelector('link[data-noktena-copy-polish]')){
      const css=document.createElement('link');
      css.rel='stylesheet';
      css.href='assets/catalog-content-polish.css?v=20260918-1';
      css.dataset.noktenaCopyPolish='1';
      document.head.appendChild(css);
    }
    if(!document.querySelector('script[data-noktena-copy-polish]')){
      const js=document.createElement('script');
      js.src='assets/catalog-content-polish.js?v=20260918-1';
      js.defer=true;
      js.dataset.noktenaCopyPolish='1';
      document.head.appendChild(js);
    }
  }

  function insertAfter(reference, node) {
    if (!reference || !reference.parentNode) return;
    reference.parentNode.insertBefore(node, reference.nextSibling);
  }

  function placeholder(tag, className, html = '') {
    const el = document.createElement(tag);
    el.className = `${className} f-equalizer-placeholder`;
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = html;
    return el;
  }

  function polishLabels(card) {
    const detailsLabel = card.querySelector('.f-card-details summary span:first-child');
    if (detailsLabel) detailsLabel.textContent = 'Характеристики модели';

    const more = card.querySelector('.product-more-link');
    if (more) {
      const textSpan = more.querySelector('span:first-child');
      if (textSpan) textSpan.textContent = 'Смотреть модель';
    }

    const maxText = card.querySelector('.max-btn span:last-child');
    if (maxText && /MAX/i.test(maxText.textContent || '')) maxText.textContent = 'Консультация в MAX';
  }

  function normalizeCard(card) {
    const body = card.querySelector('.f-card-body');
    if (!body) return;

    const title = body.querySelector('h3');
    if (!title) return;

    let summary = body.querySelector('.f-card-summary');
    if (!summary) {
      summary = placeholder('p', 'f-card-summary');
      insertAfter(title, summary);
    }

    let specs = body.querySelector('.f-premium-specs');
    if (!specs) {
      specs = placeholder(
        'div',
        'f-premium-specs',
        '<div><span>&nbsp;</span><b>&nbsp;</b></div><div><span>&nbsp;</span><b>&nbsp;</b></div><div><span>&nbsp;</span><b>&nbsp;</b></div>'
      );
      insertAfter(summary, specs);
    }

    let details = body.querySelector('.f-card-details');
    if (!details) {
      details = placeholder('div', 'f-card-details');
      insertAfter(specs, details);
    }

    let option = body.querySelector('.f-option');
    if (!option) {
      option = placeholder('div', 'f-option');
      insertAfter(details, option);
    }

    polishLabels(card);
  }

  function polishMattressCard(card) {
    const more = card.querySelector('.product-more-link');
    if (more && more.firstChild && more.firstChild.nodeType === Node.TEXT_NODE) {
      more.firstChild.textContent = 'Смотреть модель ';
    }
    const maxText = card.querySelector('.max-btn span:last-child');
    if (maxText && /MAX/i.test(maxText.textContent || '')) maxText.textContent = 'Консультация в MAX';
  }

  let queued = false;
  function normalizeAll() {
    queued = false;
    document.querySelectorAll('.f-card').forEach(normalizeCard);
    document.querySelectorAll('.card').forEach(polishMattressCard);
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(normalizeAll);
  }

  loadPolishLayer();
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', schedule, { once: true });
  window.addEventListener('load', schedule, { once: true });
  schedule();
})();
