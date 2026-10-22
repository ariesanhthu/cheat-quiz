(() => {
  'use strict';
  const text = el => el?.textContent?.replace(/\s+/g, ' ').trim() || '';
  function optionLabel(input) {
    const doc = input.ownerDocument;
    const ids = (input.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
    const labels = ids.map(id => doc.getElementById(id)).filter(Boolean);
    const fill = labels.map(e => e.matches('.flex-fill') ? e : e.querySelector('.flex-fill')).find(Boolean);
    if (fill) return text(fill);
    if (labels.length) return labels.map(text).join(' ').replace(/^\s*[a-h][.)]\s*/i, '');
    const label = input.labels?.[0];
    if (label) return text(label.querySelector('.flex-fill') || label);
    return text(input.closest('.r0,.r1,[data-region="answer"]')?.querySelector('.flex-fill'));
  }
  function scan(el) {
    const inputs = [...el.querySelectorAll('input[type="radio"]')].filter(i => i.value !== '-1' && (i.closest('.que') || i.closest('fieldset')) === el);
    const q = text(el.querySelector('.qtext') || el.querySelector('legend'));
    const options = inputs.map(optionLabel);
    const groups = new Set(inputs.map(i => i.name));
    const unsupported = !q || !inputs.length || options.some(o => !o) || groups.size !== 1 || !inputs[0]?.name ||
      !!el.querySelector('input[type="checkbox"],.qtext img,.qtext canvas,.qtext svg,.answer img,.answer canvas,.answer svg');
    return { el, q, inputs, options, unsupported, key: QuizCore.key(q, options),
      signature: JSON.stringify([q, options, inputs.map(i => [i.name, i.value])]) };
  }
  function questions(doc = document) {
    return [...doc.querySelectorAll('.que,fieldset')].filter(e => !e.parentElement?.closest('.que,fieldset'))
      .filter(e => e.matches('.que,[data-quiz-question]') || e.closest('#responseform,form[data-quiz]')).map(scan)
      .filter(x => x.q && (x.inputs.length || x.el.matches('.que')));
  }
  function current(old) {
    if (!old.el.isConnected) return null;
    const now = scan(old.el);
    return now.signature === old.signature && now.inputs.every((input, i) => input === old.inputs[i]) ? now : null;
  }
  function apply(old, decision, { overwrite = false, allowAI = false, userTouched = false } = {}) {
    const now = current(old);
    if (!now || now.unsupported || userTouched || !(decision.status === 'matched' || (allowAI && decision.status === 'model_suggested'))) return false;
    if (!overwrite && now.inputs.some(i => i.checked)) return false;
    if (!Number.isInteger(decision.index)) return false;
    const input = now.inputs[decision.index];
    if (!input || QuizCore.optionNorm(now.options[decision.index]) !== QuizCore.optionNorm(decision.answer) || input.disabled || input.matches(':disabled') || input.closest('[inert],[hidden]') || input.value === '-1') return false;
    for (let node = input; node; node = node.parentElement) {
      const css = input.ownerDocument.defaultView.getComputedStyle(node);
      if (css.display === 'none' || css.visibility === 'hidden' || css.visibility === 'collapse') return false;
    }
    // Reject duplicate names across different question blocks: one click could clear a different answer.
    if ([...input.ownerDocument.querySelectorAll('input[type="radio"]')].some(i => i !== input && i.name === input.name && i.form === input.form && !now.inputs.includes(i) && i.value !== '-1')) return false;
    input.click();
    return input.isConnected && input.checked;
  }
  globalThis.QuizAdapter = { text, optionLabel, scan, questions, current, apply };
  if (typeof module !== 'undefined') module.exports = globalThis.QuizAdapter;
})();
