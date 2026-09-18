(() => {
  'use strict';

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
  }

  let queued = false;
  function normalizeAll() {
    queued = false;
    document.querySelectorAll('.f-card').forEach(normalizeCard);
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(normalizeAll);
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', schedule, { once: true });
  window.addEventListener('load', schedule, { once: true });
  schedule();
})();
