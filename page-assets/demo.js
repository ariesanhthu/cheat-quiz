/* Local fixture behavior only. No theme/layout changes and no Moodle network requests. */
(() => {
  'use strict';
  const form = document.getElementById('responseform');
  if (!form) return;
  const key = `qa-moodle-demo-${form.dataset.localQuizPage}`;
  function save() {
    try { sessionStorage.setItem(key, JSON.stringify([...form.querySelectorAll('input[type=radio]:checked')].map(i => [i.name, i.value]))); } catch {}
  }
  try {
    const stored = JSON.parse(sessionStorage.getItem(key) || '[]');
    if (Array.isArray(stored)) for (const input of form.querySelectorAll('input[type=radio]')) {
      if (stored.some(pair => Array.isArray(pair) && pair[0] === input.name && pair[1] === input.value)) input.checked = true;
    }
  } catch {}
  form.addEventListener('change', save);
  form.addEventListener('submit', event => {
    event.preventDefault(); event.stopImmediatePropagation();
    const target = event.submitter?.dataset.localTarget;
    if (!['page.html', 'page-2.html', 'page-3.html'].includes(target)) return;
    save(); location.assign(new URL(target, location.href).href);
  }, true);
  document.addEventListener('click', event => {
    const toggle = event.target.closest('[data-toggler="drawers"]');
    if (!toggle) return;
    const drawer = document.getElementById(toggle.dataset.target);
    if (drawer) {
      drawer.classList.toggle('show');
      const open = drawer.classList.contains('show'); toggle.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle(drawer.classList.contains('drawer-right') ? 'drawer-open-right' : 'drawer-open-index', open);
    }
  });
})();
