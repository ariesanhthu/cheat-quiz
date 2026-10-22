const { test, expect, chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { once } = require('node:events');
const C = require('../../core.js');
const bank = require('../../bank.json');
const base = path.resolve(__dirname, '../..');
const artifacts = path.join(base, 'artifacts');
const escape = text => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function question(item, id) {
  const options = [...item.options].reverse();
  return `<div class="que multichoice" id="${id}"><div class="content"><div class="formulation"><div class="qtext">${escape(item.q)}</div><fieldset><legend>Answer</legend><div class="answer">${options.map((o, i) => `<div class="r${i % 2}"><input type="radio" id="${id}_${i}" name="${id}" value="${i}" aria-labelledby="${id}_${i}_label"><div id="${id}_${i}_label" data-region="answer-label"><span class="answernumber">${String.fromCharCode(97 + i)}. </span><div class="flex-fill">${escape(C.optionText(o))}</div></div></div>`).join('')}</div><input type="radio" name="${id}" value="-1" hidden checked></fieldset></div></div></div>`;
}
const sample = bank.filter(x => x.answer).slice(0, 12);
function quizHTML() {
  return `<!doctype html><html lang="vi"><meta charset="utf-8"><title>Local quiz regression</title><style>body{font:16px Arial;max-width:900px;margin:24px auto}.que{padding:18px;border:1px solid #ddd;margin-bottom:12px}.r0,.r1{display:flex;gap:8px;margin:8px}.qtext{font-weight:bold}.answernumber{margin-right:8px}legend{font-size:12px}</style><form id="responseform">${sample.map((item, i) => question(item, `q${i}`)).join('')}<button id="next" type="submit">Next page</button><button id="finish" type="submit">Finish attempt</button></form><script>window.submits=0;window.navClicks=0;document.querySelector('form').addEventListener('submit',e=>{window.submits++;e.preventDefault()});for(const id of ['next','finish'])document.getElementById(id).addEventListener('click',()=>window.navClicks++);</script></html>`;
}
let context, extensionId, server, origin, workspace;
const pageErrors = [];
test.beforeAll(async () => {
  fs.mkdirSync(artifacts, { recursive: true });
  workspace = fs.mkdtempSync(path.join(artifacts, 'e2e-'));
  const extension = path.join(workspace, 'extension'); fs.mkdirSync(extension);
  for (const file of ['manifest.json', 'bootstrap.js', 'background.js', 'core.js', 'adapter.js', 'content.js', 'ai.js', 'updates.js', 'update-config.json', 'settings.html', 'settings.js', 'source.html', 'source.js', 'bank.json', 'knowledge-base.json', 'data-manifest.json']) fs.copyFileSync(path.join(base, file), path.join(extension, file));
  server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    if (pathname.startsWith('/page-assets/')) {
      const file = path.resolve(base, '..', '.' + pathname), allowed = path.resolve(base, '../page-assets') + path.sep;
      if (!file.startsWith(allowed)) { res.writeHead(403); res.end(); return; }
      const types = { '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.html': 'text/html' };
      res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
      res.end(fs.readFileSync(file)); return;
    }
    if (pathname === '/moodle') {
      let html = fs.readFileSync(path.join(base, 'tests/fixtures/moodle-original.html'), 'utf8');
      html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '').replace(/<img\b[^>]*>/gi, '');
      res.end(html);
    } else if (['/demo', '/page.html', '/page-2.html', '/page-3.html'].includes(pathname)) res.end(fs.readFileSync(path.join(base, '..', pathname === '/demo' ? 'page.html' : pathname.slice(1)), 'utf8'));
    else res.end(quizHTML());
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); origin = `http://127.0.0.1:${server.address().port}`;
  context = await chromium.launchPersistentContext(path.join(workspace, 'profile'), {
    channel: 'chromium', headless: true, viewport: { width: 1440, height: 1000 },
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
  });
  let sw = context.serviceWorkers()[0]; if (!sw) sw = await context.waitForEvent('serviceworker');
  extensionId = sw.url().split('/')[2];
  context.on('page', page => page.on('pageerror', e => pageErrors.push(e.message)));
});
test.afterAll(async () => {
  if (context) await context.close();
  if (server) { server.closeAllConnections(); await new Promise(r => server.close(r)); }
  if (workspace) {
    const resolved = path.resolve(workspace), allowed = path.resolve(artifacts) + path.sep;
    if (!resolved.startsWith(allowed)) throw Error('Refusing to remove unexpected test workspace');
    fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
async function settingsPage() {
  const p = await context.newPage(); await p.goto(`chrome-extension://${extensionId}/settings.html`);
  await expect(p.locator('#status')).toHaveText('Sẵn sàng.'); return p;
}
async function inject(page) {
  // This is the shipping manifest: no extra host grant or executeScript shortcut.
  await expect(page.locator('[data-quiz-assistant="control"]')).toBeVisible();
  const panel = page.locator('[data-quiz-assistant="control"] section');
  if (!await panel.isVisible()) await page.locator('[data-quiz-assistant="control"] [data-action="toggle"]').click();
}
const control = page => page.locator('[data-quiz-assistant="control"]');
const action = (page, name) => control(page).locator(`[data-action="${name}"]`);
const complete = page => expect(control(page).locator('[role=status]')).toContainText('Hoàn thành');

test('full installed MV3 extension: original questions intact, correct shuffled answers, top-3, rerun, offline, no submit/navigation', async () => {
  const page = await context.newPage(); await page.goto(`${origin}/quiz`);
  const original = await page.locator('.que').evaluateAll(els => els.map(e => e.innerHTML));
  await inject(page); await inject(page);
  await expect(control(page)).toHaveCount(1);
  await action(page, 'run').click(); await complete(page);
  await expect(page.locator('.qa-assistant-result')).toHaveCount(sample.length);
  for (let i = 0; i < sample.length; i++) {
    const options = [...sample[i].options].reverse();
    const index = options.findIndex(o => C.optionNorm(o) === C.optionNorm(sample[i].answer));
    await expect(page.locator(`#q${i} input[value="${index}"]`)).toBeChecked();
  }
  await expect(page.locator('#q0 .qa-assistant-result article')).toHaveCount(3);
  const font = await page.locator('#q0 .qa-assistant-result').evaluate(el => getComputedStyle(el).fontSize);
  expect(font).toBe('12px');
  await action(page, 'run').click(); await complete(page);
  await expect(page.locator('.qa-assistant-result')).toHaveCount(sample.length);
  await context.setOffline(true);
  try { await action(page, 'run').click(); await complete(page); }
  finally { await context.setOffline(false); }
  expect(await page.evaluate(() => ({ submits, navClicks }))).toEqual({ submits: 0, navClicks: 0 });
  expect(page.url()).toBe(`${origin}/quiz`);
  const clean = await page.locator('.que').evaluateAll(els => els.map(e => { const copy = e.cloneNode(true); copy.querySelectorAll('.qa-assistant-result').forEach(n => n.remove()); return copy.innerHTML; }));
  expect(clean).toEqual(original);
  await page.screenshot({ path: path.join(artifacts, 'quiz-results.png'), fullPage: false });
  await page.close();
});
test('settings import is atomic, persists after reload, blocks conflicts beyond top-three, and restores bundled banks', async () => {
  const ui = await settingsPage();
  await expect(ui.locator('#inventory')).toContainText('151 câu');
  const data = Array.from({ length: 8 }, (_, i) => ({ ...sample[0], answer: i === 7 ? sample[0].options[1] : sample[0].answer }));
  const imported = await ui.evaluate(async data => chrome.runtime.sendMessage({ type: 'import', data, append: false }), data);
  expect(imported.count).toBe(8);
  await ui.reload(); await expect(ui.locator('#status')).toHaveText('Sẵn sàng.'); await expect(ui.locator('#inventory')).toContainText('8 câu');
  const invalid = await ui.evaluate(async () => chrome.runtime.sendMessage({ type: 'import', data: [{ q: 'bad', options: ['x'], answer: 4 }] }));
  expect(invalid.error).toBeTruthy();
  const page = await context.newPage(); await page.goto(`${origin}/conflict`); await inject(page);
  await action(page, 'run').click(); await complete(page);
  await expect(page.locator('#q0 input:checked')).toHaveValue('-1');
  await expect(page.locator('#q0 .qa-assistant-result')).toContainText('mâu thuẫn');
  await expect(page.locator('#q0 .qa-assistant-result article')).toHaveCount(3);
  await ui.locator('#reset').click(); await expect(ui.locator('#status')).toContainText('151 câu');
  await page.close(); await ui.close();
});
test('new questions handled once; user choice preserved; same-page URL navigation disarms work', async () => {
  const page = await context.newPage(); await page.goto(`${origin}/dynamic`); await inject(page);
  await page.locator('#q0 input[value="0"]').check();
  await action(page, 'run').click(); await complete(page);
  await expect(page.locator('#q0 input[value="0"]')).toBeChecked();
  await page.locator('#responseform').evaluate((form, html) => form.insertAdjacentHTML('afterbegin', html), question(sample[0], 'dynamic'));
  await expect(page.locator('#dynamic .qa-assistant-result')).toHaveCount(1);
  await expect(page.locator('#dynamic input:checked')).not.toHaveValue('-1');
  await page.evaluate(() => history.pushState({}, '', '/new-location'));
  await expect(control(page).locator('[role=status]')).toContainText('Trang đã đổi');
  await page.locator('#responseform').evaluate((form, html) => form.insertAdjacentHTML('afterbegin', html), question(sample[0], 'after-navigation'));
  await expect(page.locator('#after-navigation .qa-assistant-result')).toHaveCount(0);
  expect(await page.evaluate(() => ({ submits, navClicks }))).toEqual({ submits: 0, navClicks: 0 });
  await page.close();
});
test('worker termination: Chrome local bank survives actual CDP worker shutdown and revives on next request', async () => {
  const ui = await settingsPage();
  const first = await ui.evaluate(async () => chrome.runtime.sendMessage({ type: 'info' }));
  expect(first.count).toBe(151);
  const cdp = await context.newCDPSession(ui);
  const versions = new Map();
  cdp.on('ServiceWorker.workerVersionUpdated', event => event.versions.forEach(v => versions.set(v.versionId, v)));
  await cdp.send('ServiceWorker.enable');
  await expect.poll(() => [...versions.values()].some(v => v.scriptURL.includes(extensionId) && v.runningStatus === 'running')).toBe(true);
  const target = [...versions.values()].find(v => v.scriptURL.includes(extensionId) && v.runningStatus === 'running');
  await cdp.send('ServiceWorker.stopWorker', { versionId: target.versionId });
  await expect.poll(() => versions.get(target.versionId)?.runningStatus).toBe('stopped');
  const after = await ui.evaluate(async () => chrome.runtime.sendMessage({ type: 'info' }));
  expect(after.count).toBe(151); expect(after.bundled).toBe(true);
  await cdp.detach(); await ui.close();
});
test('real Moodle page.html copy: exactly one quiz block, no interaction with messaging settings or navigation', async () => {
  const page = await context.newPage(); await page.goto(`${origin}/moodle`); await inject(page);
  const options = await page.locator('.que .answer .flex-fill').allTextContents();
  const text = await page.locator('.que .qtext').textContent();
  const ui = await settingsPage();
  await ui.evaluate(async data => chrome.runtime.sendMessage({ type: 'import', data, append: false }), [{ q: text, options, answer: 1, verified: true }]);
  await action(page, 'run').click(); await complete(page);
  await expect(page.locator('.qa-assistant-result')).toHaveCount(1);
  await expect(page.locator('.que .answer input[value="1"]')).toBeChecked();
  expect(page.url()).toBe(`${origin}/moodle`);
  await ui.locator('#reset').click(); await expect(ui.locator('#status')).toContainText('151 câu');
  await page.close(); await ui.close();
});
test('in-flight AI: pause/resume, validated source viewer, cancel and actual tab close abort without selecting or navigating', async () => {
  const ui = await settingsPage();
  const settings = await ui.evaluate(async () => (await chrome.runtime.sendMessage({ type: 'info' })).settings);
  await ui.evaluate(async settings => chrome.runtime.sendMessage({ type: 'save-settings', settings: { ...settings, model: 'test-model', autoAI: true, aiAutoSelect: true }, credential: 'fake-e2e-key' }), settings);
  const sw = context.serviceWorkers().find(w => w.url().includes(extensionId));
  await sw.evaluate(() => {
    globalThis.originalFetch = fetch; globalThis.originalPermission = chrome.permissions.contains;
    globalThis.aiAborted = 0; globalThis.aiCalls = 0;
    chrome.permissions.contains = async () => true;
    globalThis.fetch = async (url, init) => {
      if (url !== 'https://api.openai.com/v1/responses') return originalFetch(url, init);
      aiCalls++;
      return new Promise((resolve, reject) => {
        init.signal.addEventListener('abort', () => { aiAborted++; reject(new DOMException('Aborted', 'AbortError')); });
        globalThis.releaseAI = () => {
          const input = JSON.parse(JSON.parse(init.body).input);
          const answer = { status: 'answered', answer_text: input.options[0], explanation: 'Browser fixture response.',
            evidence: [{ id: input.documents[0].id, quote: input.documents[0].text.slice(0, 80) }] };
          resolve(new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(answer) }] }] })));
        };
      });
    };
  });
  async function pendingPage(suffix) {
    const page = await context.newPage(); await page.goto(`${origin}/${suffix}`);
    await page.locator('.que').evaluateAll(els => { for (const el of els.slice(1)) el.remove(); els[0].querySelector('.qtext').textContent = 'Căn cứ địa cách mạng Việt Bắc trong kháng chiến năm 1947 có ý nghĩa gì?'; });
    await inject(page); await action(page, 'run').click();
    await expect(page.locator('#q0 .qa-assistant-result')).toContainText('Đang hỏi AI');
    return page;
  }
  try {
    const page = await pendingPage('ai-pause');
    await expect.poll(() => sw.evaluate(() => aiCalls)).toBe(1);
    await action(page, 'pause').click(); await sw.evaluate(() => releaseAI());
    await expect(control(page).locator('[role=status]')).toContainText('Tạm dừng');
    await expect(page.locator('#q0 input:checked')).toHaveValue('-1');
    await action(page, 'pause').click(); await complete(page);
    await expect(page.locator('#q0 input[value="0"]')).toBeChecked();
    await expect(page.locator('#q0 .qa-assistant-result')).toContainText('AI gợi ý');
    const opened = context.waitForEvent('page');
    await page.locator('#q0 .qa-assistant-result [data-action="source"]').click();
    const source = await opened; await expect(source.locator('#text')).not.toBeEmpty();
    expect(source.url()).toContain(`chrome-extension://${extensionId}/source.html?id=`);
    await source.close();
    expect(await page.evaluate(() => ({ submits, navClicks }))).toEqual({ submits: 0, navClicks: 0 });
    await page.close();
    const cancelled = await pendingPage('ai-cancel');
    await expect.poll(() => sw.evaluate(() => aiCalls)).toBe(2);
    await action(cancelled, 'cancel').click();
    await expect.poll(() => sw.evaluate(() => aiAborted)).toBe(1);
    await expect(cancelled.locator('#q0 input:checked')).toHaveValue('-1');
    await cancelled.close();
    const closed = await pendingPage('ai-close');
    await expect.poll(() => sw.evaluate(() => aiCalls)).toBe(3);
    await closed.close(); await expect.poll(() => sw.evaluate(() => aiAborted)).toBe(2);
  } finally {
    await sw.evaluate(() => { fetch = originalFetch; chrome.permissions.contains = originalPermission; });
    await ui.evaluate(async settings => { await chrome.runtime.sendMessage({ type: 'save-settings', settings }); await chrome.runtime.sendMessage({ type: 'clear-credential' }); }, settings);
    await ui.close();
  }
});
test('no uncaught page errors across extension settings and quiz flows', () => { expect(pageErrors).toEqual([]); });
test('actual Chromium-to-loopback proxy request authenticates Origin/token and completes RAG without upstream network', async () => {
  const { createProxy } = require('../../scripts/proxy.cjs');
  let calls = 0;
  const proxy = createProxy({ apiKey: 'fake-upstream-secret', token: 'e2e-proxy-token', extensionId,
    fetcher: async (_, init) => {
      calls++; expect(init.headers.Authorization).toBe('Bearer fake-upstream-secret');
      const input = JSON.parse(JSON.parse(init.body).input);
      const answer = { status: 'answered', answer_text: input.options[0], explanation: 'Loopback fixture response.', evidence: [{ id: input.documents[0].id, quote: input.documents[0].text.slice(0, 80) }] };
      return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(answer) }] }] }));
    } });
  proxy.listen(0, '127.0.0.1'); await once(proxy, 'listening');
  const ui = await settingsPage();
  const settings = await ui.evaluate(async () => (await chrome.runtime.sendMessage({ type: 'info' })).settings);
  let page;
  const sw = context.serviceWorkers().find(w => w.url().includes(extensionId));
  // Native optional-permission dialogs are outside headless Playwright's DOM.
  await sw.evaluate(() => { globalThis.loopbackPermission = chrome.permissions.contains; chrome.permissions.contains = async () => true; });
  try {
    await ui.evaluate(async ({ settings, port }) => chrome.runtime.sendMessage({ type: 'save-settings', settings: { ...settings, provider: 'proxy', endpoint: `http://127.0.0.1:${port}/responses`, model: 'test-model', autoAI: true, aiAutoSelect: true }, credential: 'e2e-proxy-token' }), { settings, port: proxy.address().port });
    page = await context.newPage(); await page.goto(`${origin}/real-proxy`);
    await page.locator('.que').evaluateAll(els => { for (const el of els.slice(1)) el.remove(); els[0].querySelector('.qtext').textContent = 'Căn cứ địa cách mạng Việt Bắc năm 1947 có ý nghĩa gì?'; });
    await inject(page); await action(page, 'run').click(); await complete(page);
    await expect(page.locator('#q0 .qa-assistant-result')).toContainText('Loopback fixture response.');
    await expect(page.locator('#q0 input[value="0"]')).toBeChecked();
    expect(calls).toBe(1);
    expect(await page.evaluate(() => ({ submits, navClicks }))).toEqual({ submits: 0, navClicks: 0 });
  } finally {
    if (page) await page.close();
    await sw.evaluate(() => { chrome.permissions.contains = loopbackPermission; });
    await ui.evaluate(async settings => { await chrome.runtime.sendMessage({ type: 'save-settings', settings }); await chrome.runtime.sendMessage({ type: 'clear-credential' }); }, settings);
    await ui.close(); proxy.closeAllConnections(); await new Promise(r => proxy.close(r));
  }
  expect(pageErrors).toEqual([]);
});
test('page.html: original Moodle layout, two sample text variants on real local Next pages, no automatic navigation', async () => {
  const page = await context.newPage(); await page.goto(`${origin}/page.html`);
  const samples = [bank.find(x => x.id === 'quiz.json:5'), bank.find(x => x.id === 'quiz.json:11')];
  expect(samples[0].q).toBe(samples[1].q); expect(samples[0].answer).not.toBe(samples[1].answer);
  await expect(page.locator('.que')).toHaveCount(1);
  await expect(page.locator('.navbar')).toBeVisible();
  await expect(page.locator('.que .qtext')).toContainText('300 global websites');
  await page.screenshot({ path: path.join(artifacts, 'moodle-original-layout.png') });
  await page.locator('#mod_quiz-next-nav').click();
  await expect(page).toHaveURL(`${origin}/page-2.html`);
  await expect(page.locator('.qtext')).toHaveText(samples[0].q);
  await expect(control(page)).toHaveCount(1);
  await inject(page); await action(page, 'run').click(); await complete(page);
  await expect(page.locator('.que .answer input[value="2"]')).toBeChecked();
  await expect(page.locator('.qa-assistant-result')).toContainText(samples[0].answer);
  await page.screenshot({ path: path.join(artifacts, 'demo-page-1.png') });
  await page.locator('#mod_quiz-next-nav').click();
  await expect(page).toHaveURL(`${origin}/page-3.html`);
  await expect(page.locator('.que')).toHaveCount(1);
  await expect(control(page)).toHaveCount(1);
  await inject(page); await action(page, 'run').click(); await complete(page);
  await expect(page.locator('.que .answer input[value="1"]')).toBeChecked();
  await expect(page.locator('.qa-assistant-result')).toContainText(samples[1].answer);
  const optionsBox = await page.locator('.que fieldset').boundingBox();
  const resultBox = await page.locator('.que .qa-assistant-result').boundingBox();
  expect(resultBox.y).toBeGreaterThanOrEqual(optionsBox.y + optionsBox.height);
  expect(resultBox.width).toBeGreaterThan(optionsBox.width * 0.9);
  await page.screenshot({ path: path.join(artifacts, 'demo-page-2.png') });
  expect(page.url()).toBe(`${origin}/page-3.html`);
  await page.locator('#mod_quiz-prev-nav').click(); await expect(page).toHaveURL(`${origin}/page-2.html`);
  await expect(page.locator('.que .answer input[value="2"]')).toBeChecked();
  await page.close();
});
test('shipping auto-injection: real mouse highlighting survives a Translate-like listener; corner launcher and native popover remain usable', async () => {
  const page = await context.newPage(); await page.goto(`${origin}/page-2.html`);
  const panel = control(page).locator('section'), toggle = action(page, 'toggle');
  await expect(toggle).toBeVisible(); await expect(panel).toBeHidden();
  const bounds = await toggle.boundingBox(); expect(bounds.x).toBeGreaterThan(1380); expect(bounds.y).toBeLessThan(12);
  await page.evaluate(() => {
    document.addEventListener('mouseup', event => {
      window.translateSawSelection = !!getSelection().toString();
      getSelection().removeAllRanges(); event.stopImmediatePropagation();
    });
  });
  const target = await page.locator('.qtext').boundingBox();
  await page.mouse.move(target.x + 4, target.y + 10); await page.mouse.down();
  await page.mouse.move(target.x + target.width - 4, target.y + target.height - 3, { steps: 15 }); await page.mouse.up();
  await expect(panel).toBeVisible();
  await expect(control(page).locator('article')).toHaveCount(3);
  expect(await page.evaluate(() => window.translateSawSelection)).toBe(true);
  await expect(page.locator('.que input[value="2"]')).not.toBeChecked();
  await action(page, 'close').click(); await expect(panel).toBeHidden(); await expect(toggle).toBeVisible();
  await toggle.click(); await expect(panel).toBeVisible(); await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(action(page, 'updates')).toContainText('1.1.0');
  await page.keyboard.press('Escape'); await expect(panel).toBeHidden();
  await expect(toggle).toBeFocused(); expect(page.url()).toBe(`${origin}/page-2.html`);
  await page.close();
});

test('GitHub update settings: check, opt-in alarm, restart persistence, safe release link, unchanged bank', async () => {
  const ui = await settingsPage();
  const sw = context.serviceWorkers().find(w => w.url().includes(extensionId));
  await sw.evaluate(() => {
    globalThis.updateFetch = fetch; globalThis.updatePermission = chrome.permissions.contains;
    chrome.permissions.contains = async () => true;
    globalThis.fetch = async (url, init) => {
      if (!String(url).startsWith('https://api.github.com/')) return updateFetch(url, init);
      return new Response(JSON.stringify({ tag_name: 'v1.2.0', html_url: 'https://github.com/ariesanhthu/cheat-quiz/releases/tag/v1.2.0', assets: [] }));
    };
  });
  await ui.evaluate(() => { chrome.permissions.request = async () => true; });
  try {
    await ui.locator('#checkUpdates').click(); await expect(ui.locator('#updateStatus')).toContainText('v1.2.0');
    await ui.locator('#autoUpdates').check();
    await expect.poll(() => ui.evaluate(async () => !!(await chrome.alarms.get('qa-check-updates')))).toBe(true);
    await ui.reload(); await expect(ui.locator('#autoUpdates')).toBeChecked();
    await expect(ui.locator('#inventory')).toContainText('151');
    await ui.locator('#autoUpdates').uncheck();
    await expect.poll(() => ui.evaluate(async () => !!(await chrome.alarms.get('qa-check-updates')))).toBe(false);
    const popup = context.waitForEvent('page'); await ui.locator('#downloadUpdate').click();
    const release = await popup; await release.waitForURL('https://github.com/ariesanhthu/cheat-quiz/releases/tag/v1.2.0'); await release.close();
  } finally {
    await sw.evaluate(async () => { globalThis.fetch = updateFetch; chrome.permissions.contains = updatePermission; await chrome.storage.local.remove(['updateState', 'updatePreferences']); });
    await ui.close();
  }
});

test('Codex/Claude CLI providers: Chrome storage settings, real loopback jobs and child-process fixtures complete without an API key', async () => {
  const { createBridge, createRunner } = require('../../scripts/cli-bridge.cjs');
  const { spawn } = require('node:child_process');
  const runner = createRunner({ spawnProcess: (command, args, options) => spawn(process.execPath, [path.join(base, 'tests/fixtures/fake-cli.cjs'), ...args], options) });
  const bridge = createBridge({ token: 'cli-e2e-token', extensionId, runner });
  bridge.listen(0, '127.0.0.1'); await once(bridge, 'listening');
  const ui = await settingsPage();
  const settings = await ui.evaluate(async () => (await chrome.runtime.sendMessage({ type: 'info' })).settings);
  const sw = context.serviceWorkers().find(w => w.url().includes(extensionId));
  await sw.evaluate(() => { globalThis.loopbackPermission = chrome.permissions.contains; chrome.permissions.contains = async () => true; });
  try {
    for (const provider of ['codex-cli', 'claude-cli']) {
      await ui.evaluate(async ({ settings, provider, port }) => chrome.runtime.sendMessage({ type: 'save-settings', settings: { ...settings, provider, endpoint: `http://127.0.0.1:${port}/responses`, model: '', autoAI: true, aiAutoSelect: true }, credential: 'cli-e2e-token' }), { settings, provider, port: bridge.address().port });
      const page = await context.newPage();
      try {
        await page.goto(`${origin}/${provider}`);
        await page.locator('.que').evaluateAll(els => { for (const el of els.slice(1)) el.remove(); els[0].querySelector('.qtext').textContent = 'Căn cứ địa cách mạng Việt Bắc năm 1947 có ý nghĩa gì?'; });
        await inject(page); await action(page, 'run').click(); await complete(page);
        await expect(page.locator('#q0 .qa-assistant-result')).toContainText('Fake CLI result.');
        await expect(page.locator('#q0 input[value="0"]')).toBeChecked();
        expect(page.url()).toBe(`${origin}/${provider}`);
        expect(await page.evaluate(() => ({ submits, navClicks }))).toEqual({ submits: 0, navClicks: 0 });
      } finally { await page.close(); }
    }
  } finally {
    await sw.evaluate(() => { chrome.permissions.contains = loopbackPermission; });
    await ui.evaluate(async settings => { await chrome.runtime.sendMessage({ type: 'save-settings', settings }); await chrome.runtime.sendMessage({ type: 'clear-credential' }); }, settings);
    await ui.close(); bridge.closeAllConnections(); await new Promise(r => bridge.close(r));
  }
  expect(pageErrors).toEqual([]);
});
