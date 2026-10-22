const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { C, source, until, delay, q, fixture, page } = require('./helpers.cjs');

test('scan real Moodle sample with nested fieldset, aria labels and clear-choice sentinel', () => {
  const dom = new JSDOM(source('tests/fixtures/moodle-original.html'), { runScripts: 'outside-only' });
  try {
    dom.window.eval(source('core.js')); dom.window.eval(source('adapter.js'));
    const questions = dom.window.QuizAdapter.questions();
    assert.equal(questions.length, 1); assert.equal(questions[0].inputs.length, 4);
    assert.equal(questions[0].unsupported, false);
    assert.ok(questions[0].options.every(x => x.length > 30 && !/^[a-d]\. /.test(x)));
    assert.ok(!questions[0].inputs.some(i => i.value === '-1'));
  } finally { dom.window.close(); }
});
test('repeat injection/run preserves original DOM, creates one small result and clicks only the correct radio', async () => {
  const p = page();
  try {
    const block = p.w.document.querySelector('.que'), original = block.innerHTML;
    const nodes = [...block.querySelectorAll('*')];
    p.w.eval(source('content.js')); p.button('run').click(); p.button('run').click();
    await until(() => p.status().startsWith('Hoàn thành'));
    assert.equal(p.w.document.querySelectorAll('[data-quiz-assistant="control"]').length, 1);
    assert.equal(block.querySelectorAll('.qa-assistant-result').length, 1);
    assert.equal(block.querySelector('input[value="1"]').checked, true);
    assert.equal(p.submits, 0); assert.equal(p.navigations, 0);
    for (const node of nodes) assert.ok(node.isConnected);
    const result = block.querySelector('.qa-assistant-result');
    assert.ok(result.shadowRoot.textContent.includes('12px'));
    p.button('run').click(); await until(() => p.requests.filter(r => r.type === 'search').length === 2);
    await until(() => p.status().startsWith('Hoàn thành'));
    assert.equal(block.querySelectorAll('.qa-assistant-result').length, 1);
    p.w.__quizAssistant.destroy(); assert.equal(block.innerHTML, original); assert.deepEqual(p.errors, []);
  } finally { p.close(); }
});
for (const mode of ['selected', 'disabled', 'fieldset-disabled', 'inert', 'hidden', 'css-hidden', 'checkbox', 'image', 'duplicate-options', 'no-label', 'no-name', 'duplicate-group']) {
  test(`answer application rejects unsafe/unsupported case: ${mode}`, async () => {
    const p = page({ html: fixture() + (mode === 'duplicate-group' ? fixture({ id: 'q2', name: 'q1' }) : '') });
    try {
      const doc = p.w.document, x = doc.querySelector('.que'), target = x.querySelector('input[value="1"]');
      if (mode === 'selected') x.querySelector('input[value="0"]').checked = true;
      if (mode === 'disabled') target.disabled = true;
      if (mode === 'fieldset-disabled') target.closest('fieldset').disabled = true;
      if (mode === 'inert') x.setAttribute('inert', '');
      if (mode === 'hidden') x.hidden = true;
      if (mode === 'css-hidden') x.style.display = 'none';
      if (mode === 'checkbox') { const cb = doc.createElement('input'); cb.type = 'checkbox'; x.append(cb); }
      if (mode === 'image') x.querySelector('.qtext').append(doc.createElement('img'));
      if (mode === 'duplicate-options') x.querySelectorAll('.flex-fill')[0].textContent = 'No';
      if (mode === 'no-label') doc.getElementById('q1_1_label').remove();
      if (mode === 'no-name') x.querySelectorAll('input').forEach(i => i.removeAttribute('name'));
      p.button('run').click(); await until(() => p.status().startsWith('Hoàn thành'));
      assert.equal(target.checked, false); assert.equal(p.submits, 0); assert.equal(p.navigations, 0);
      if (mode === 'selected') assert.equal(x.querySelector('input[value="0"]').checked, true);
      assert.deepEqual(p.errors, []);
    } finally { p.close(); }
  });
}
test('explicit overwrite replaces existing selection, but a user edit during lookup always wins', async () => {
  const p = page({ config: { overwrite: true } });
  try {
    p.w.document.querySelector('input[value="0"]').checked = true;
    p.button('run').click(); await until(() => p.status().startsWith('Hoàn thành'));
    assert.equal(p.w.document.querySelector('input[value="1"]').checked, true);
  } finally { p.close(); }
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const b = page({ config: { overwrite: true }, responder: async m => { if (m.type === 'search') await pending; } });
  try {
    b.button('run').click(); await until(() => b.requests.some(m => m.type === 'search'));
    const input = b.w.document.querySelector('input[value="0"]'); input.click();
    release(); await until(() => b.status().startsWith('Hoàn thành'));
    await delay(250);
    assert.equal(input.checked, true); assert.equal(b.w.document.querySelector('input[value="1"]').checked, false);
    assert.equal(b.requests.filter(m => m.type === 'search').length, 1);
  } finally { release(); b.close(); }
});
for (const mode of ['cancel', 'close', 'destroy', 'navigate', 'pagehide', 'replace-input', 'changed-question', 'detached']) {
  test(`late response cannot apply after ${mode}`, async () => {
    let release;
    const wait = new Promise(r => { release = r; });
    const p = page({ responder: async m => { if (m.type === 'search') await wait; } });
    try {
      const doc = p.w.document, old = doc.querySelector('input[value="1"]');
      p.button('run').click(); await until(() => p.requests.some(m => m.type === 'search'));
      if (mode === 'cancel') p.button('cancel').click();
      if (mode === 'close') p.button('close').click();
      if (mode === 'destroy') p.w.__quizAssistant.destroy();
      if (mode === 'navigate') p.w.history.pushState({}, '', '/another-page');
      if (mode === 'pagehide') p.w.dispatchEvent(new p.w.Event('pagehide'));
      if (mode === 'replace-input') { old.replaceWith(old.cloneNode(true)); p.button('cancel').click(); }
      if (mode === 'changed-question') { doc.querySelector('.qtext').textContent = 'Changed question'; p.button('cancel').click(); }
      if (mode === 'detached') doc.querySelector('.que').remove();
      await delay(1); release(); await delay(80);
      assert.equal(old.checked, false); assert.equal(p.submits, 0); assert.equal(p.navigations, 0);
      assert.deepEqual(p.errors, []);
    } finally { release(); p.close(); }
  });
}
test('pause blocks an in-flight result until resume; cancel releases a paused loop', async () => {
  let release;
  const wait = new Promise(r => { release = r; });
  const p = page({ responder: async m => { if (m.type === 'search') await wait; } });
  try {
    p.button('run').click(); await until(() => p.requests.some(m => m.type === 'search'));
    p.button('pause').click(); await delay(1); release(); await delay(80);
    assert.equal(p.w.document.querySelector('input[value="1"]').checked, false);
    p.button('pause').click(); await until(() => p.status().startsWith('Hoàn thành'));
    assert.equal(p.w.document.querySelector('input[value="1"]').checked, true);
  } finally { release(); p.close(); }
});
test('dynamic questions and changed text are processed once, without observing our own results forever', async () => {
  const p = page();
  try {
    p.button('run').click(); await until(() => p.status().startsWith('Hoàn thành'));
    p.w.document.getElementById('responseform').insertAdjacentHTML('afterbegin', fixture({ id: 'q2' }));
    await until(() => p.w.document.querySelectorAll('.qa-assistant-result').length === 2);
    await until(() => p.w.document.querySelector('#q2 input[value="1"]').checked);
    await delay(400); assert.equal(p.requests.filter(m => m.type === 'search').length, 2);
    p.w.document.querySelector('#q2 .qtext').textContent = 'Another question in 1945';
    await until(() => p.requests.filter(m => m.type === 'search').length === 3);
    await delay(250); assert.equal(p.requests.filter(m => m.type === 'search').length, 3);
    assert.equal(p.w.document.querySelectorAll('.qa-assistant-result').length, 2);
    p.button('cancel').click(); await delay(1);
    p.w.document.getElementById('responseform').insertAdjacentHTML('afterbegin', fixture({ id: 'q3' }));
    await delay(250); assert.equal(p.requests.filter(m => m.type === 'search').length, 3);
  } finally { p.close(); }
});
test('worker rejection or invalid context renders an error and does not crash the page', async () => {
  for (const error of ['Extension context invalidated.', 'Receiving end does not exist.', 'Offline']) {
    const p = page({ responder: async m => { if (m.type === 'search') throw Error(error); } });
    try {
      p.button('run').click(); await until(() => p.status().startsWith('Hoàn thành'));
      assert.equal(p.w.document.querySelector('input[value="1"]').checked, false);
      assert.ok(p.status().includes('lỗi 1')); assert.deepEqual(p.errors, []);
    } finally { p.close(); }
  }
});
test('top-three is displayed with all candidate options and untrusted markup stays text', async () => {
  const items = C.validate(Array.from({ length: 3 }, (_, i) => ({ q, options: ['Yes', 'No'], answer: i % 2, source: `<img src=x onerror=alert(1)>${i}`, verified: true })));
  const search = C.engine(items);
  const p = page({ responder: async m => {
    if (m.type === 'search') { const results = search(m.q, m.options, 20000); return { results, decision: C.decide(m.q, m.options, results), config: {} }; }
  } });
  try {
    p.button('run').click(); await until(() => p.status().startsWith('Hoàn thành'));
    const root = p.w.document.querySelector('.qa-assistant-result').shadowRoot;
    assert.equal(root.querySelectorAll('article').length, 3); assert.equal(root.querySelectorAll('details').length, 3);
    assert.equal(root.querySelectorAll('img,script').length, 0);
    assert.equal(p.w.document.querySelector('input[value="1"]').checked, false);
  } finally { p.close(); }
});
test('persistent corner launcher supports fallback toggle, close, Escape and passive reinjection', async () => {
  const p = page();
  try {
    const box = p.host().shadowRoot.querySelector('section');
    assert.equal(box.hidden, true);
    assert.equal(p.button('toggle').getAttribute('aria-expanded'), 'false');
    p.button('toggle').click(); assert.equal(box.hidden, false);
    p.w.eval(source('bootstrap.js')); p.w.eval(source('content.js'));
    assert.equal(box.hidden, false); assert.equal(p.w.document.querySelectorAll('[data-quiz-assistant="control"]').length, 1);
    p.button('close').click(); assert.equal(box.hidden, true); assert.ok(p.button('toggle').isConnected);
    p.button('toggle').click(); p.w.document.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(box.hidden, true); assert.equal(p.button('toggle').getAttribute('aria-expanded'), 'false');
    assert.equal(p.submits, 0); assert.equal(p.navigations, 0);
  } finally { p.close(); }
});

test('capture snapshots survive another extension stopping mouseup and clearing the selection', async () => {
  const p = page();
  try {
    const target = p.w.document.querySelector('.qtext');
    const range = p.w.document.createRange(); range.selectNodeContents(target);
    p.w.getSelection().addRange(range);
    p.w.document.addEventListener('mouseup', event => { p.w.getSelection().removeAllRanges(); event.stopImmediatePropagation(); });
    target.dispatchEvent(new p.w.MouseEvent('mouseup', { bubbles: true }));
    await until(() => p.host().shadowRoot.querySelector('[data-action="use-answer"]'));
    assert.equal(p.requests.filter(m => m.type === 'search').length, 1);
    assert.equal(p.w.document.querySelector('input[value="1"]').checked, false);
    assert.equal(p.host().shadowRoot.querySelector('section').hidden, false);
    assert.deepEqual(p.errors, []);
  } finally { p.close(); }
});

test('manual highlight reuses one panel, includes use-answer, and ignores interaction inside extension', async () => {
  const p = page();
  try {
    const range = p.w.document.createRange(); range.selectNodeContents(p.w.document.querySelector('.qtext'));
    p.w.getSelection().addRange(range);
    p.w.document.querySelector('.qtext').dispatchEvent(new p.w.MouseEvent('mouseup', { bubbles: true }));
    await until(() => p.host().shadowRoot.querySelector('[data-action="use-answer"]'));
    p.host().shadowRoot.querySelector('[data-action="use-answer"]').click();
    await until(() => p.w.document.querySelector('input[value="1"]').checked);
    assert.equal(p.submits, 0); assert.equal(p.navigations, 0);
  } finally { p.close(); }
});
test('AI failure preserves local top-three; AI cannot auto-select without explicit setting', async () => {
  for (const allow of [false, true, 'failure']) {
    const p = page({ config: { autoAI: true, aiAutoSelect: allow === true }, responder: async m => {
      if (m.type === 'search') return { results: [], decision: { status: 'needs_review' }, config: { autoSelect: true, autoAI: true, aiAutoSelect: allow === true } };
      if (m.type === 'ai') return allow === 'failure' ? { error: 'AI HTTP 429' } : { decision: { status: 'model_suggested', answer: 'No', index: 1, evidence: [] } };
    } });
    try {
      p.button('run').click(); await until(() => p.status().startsWith('Hoàn thành'));
      assert.equal(p.w.document.querySelector('input[value="1"]').checked, allow === true);
      assert.equal(p.requests.filter(m => m.type === 'ai').length, 1); assert.equal(p.submits, 0);
    } finally { p.close(); }
  }
});
test('verified local match never invokes automatic AI', async () => {
  const p = page({ config: { autoAI: true, aiAutoSelect: true } });
  try { p.button('run').click(); await until(() => p.status().startsWith('Hoàn thành')); assert.equal(p.requests.filter(m => m.type === 'ai').length, 0); }
  finally { p.close(); }
});
test('cancel releases a hung search immediately and allows a new run before the old reply arrives', async () => {
  let release, calls = 0;
  const wait = new Promise(r => { release = r; });
  const p = page({ responder: async m => { if (m.type === 'search' && ++calls === 1) await wait; } });
  try {
    p.button('run').click(); await until(() => calls === 1);
    p.button('cancel').click(); await delay(10);
    p.button('run').click(); await until(() => p.status().startsWith('Hoàn thành'));
    assert.equal(p.w.document.querySelector('input[value="1"]').checked, true);
    release(); await delay(20); assert.equal(p.w.document.querySelectorAll('.qa-assistant-result').length, 1);
  } finally { release(); p.close(); }
});
test('AI double-click and retry cannot create concurrent requests for one question; cancel blocks the late answer', async () => {
  let release;
  const wait = new Promise(r => { release = r; });
  const p = page({ responder: async m => {
    if (m.type === 'search') return { results: [], decision: { status: 'needs_review' }, config: { autoAI: true, aiAutoSelect: true } };
    if (m.type === 'ai') { await wait; return { decision: { status: 'model_suggested', answer: 'No', index: 1 } }; }
  } });
  try {
    p.button('run').click(); await until(() => p.requests.some(m => m.type === 'ai'));
    const result = p.w.document.querySelector('.qa-assistant-result').shadowRoot;
    result.querySelector('[data-action="ask-ai"]').click(); result.querySelector('[data-action="retry"]').click();
    await delay(20); assert.equal(p.requests.filter(m => m.type === 'ai').length, 1);
    p.button('cancel').click(); await delay(10); release(); await delay(30);
    assert.equal(p.w.document.querySelector('input[value="1"]').checked, false);
  } finally { release(); p.close(); }
});
test('runtime deadline produces a per-question error without touching inputs', async () => {
  const p = page({ responder: async m => { if (m.type === 'search') return new Promise(() => {}); } });
  const originalTimer = p.w.setTimeout.bind(p.w);
  p.w.setTimeout = (fn, ms, ...args) => originalTimer(fn, ms === 15000 ? 10 : ms, ...args);
  try {
    p.button('run').click(); await until(() => p.status().startsWith('Hoàn thành'));
    assert.ok(p.status().includes('lỗi 1')); assert.equal(p.w.document.querySelector('input[value="1"]').checked, false);
    assert.equal(p.submits, 0); assert.deepEqual(p.errors, []);
  } finally { p.close(); }
});
test('cloned dynamic question adopts its existing result placeholder instead of inserting a duplicate', async () => {
  const p = page();
  try {
    p.button('run').click(); await until(() => p.status().startsWith('Hoàn thành'));
    const old = p.w.document.querySelector('.que');
    const clone = old.cloneNode(true); old.replaceWith(clone);
    await until(() => p.requests.filter(m => m.type === 'search').length === 2);
    await until(() => clone.querySelector('.qa-assistant-result')?.shadowRoot);
    assert.equal(clone.querySelectorAll('.qa-assistant-result').length, 1);
    assert.equal(p.submits, 0);
  } finally { p.close(); }
});
test('synchronous extension invalidation during navigation, closing and destruction never escapes into page handlers', async () => {
  const p = page();
  try {
    p.w.chrome.runtime.sendMessage = () => { throw Error('Extension context invalidated.'); };
    p.w.dispatchEvent(new p.w.Event('pagehide'));
    p.button('close').click(); await delay(10);
    assert.doesNotThrow(() => p.w.__quizAssistant.destroy());
    assert.deepEqual(p.errors, []); assert.equal(p.submits, 0);
  } finally { p.close(); }
});
test('replacing the page body keeps the observer and controls functional for new questions', async () => {
  const p = page();
  try {
    p.button('run').click(); await until(() => p.status().startsWith('Hoàn thành'));
    const body = p.w.document.createElement('body'); body.innerHTML = `<form id="responseform">${fixture({ id: 'replacement' })}</form>`;
    p.w.document.body.replaceWith(body);
    await until(() => p.w.document.querySelector('#replacement input[value="1"]').checked);
    assert.equal(p.w.document.querySelectorAll('.qa-assistant-result').length, 1);
    assert.ok(p.host().isConnected); assert.deepEqual(p.errors, []);
  } finally { p.close(); }
});
