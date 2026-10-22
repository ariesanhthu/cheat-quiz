const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { detect } = require('../scripts/detect-chrome.cjs');
const { createHandler, serve } = require('../scripts/native-host.cjs');
const { worker, environment, until } = require('./helpers.cjs');
const bank = require('../bank.json');
const data = { q: 'Căn cứ địa của cả nước?', options: ['Việt Bắc', 'Tây Bắc'], chunks: [{ id: 'p1', title: 'Trang 1', text: 'Căn cứ địa của cả nước là Việt Bắc.' }] };
const answer = body => { const input = JSON.parse(body.input); return { status: 'answered', answer_text: input.options[0], explanation: 'Theo tài liệu.', evidence: [{ id: input.documents[0].id, quote: input.documents[0].text }] }; };
test('installer detects unpacked Chrome extension IDs without manifest metadata or PowerShell JSON key restrictions', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'quiz-detect-'));
  try {
    const profile = path.join(directory, 'Profile 1'), extension = path.join(directory, 'unpacked');
    fs.mkdirSync(profile); fs.mkdirSync(extension);
    fs.writeFileSync(path.join(extension, 'manifest.json'), JSON.stringify({ name: 'Local Quiz Assistant' }));
    fs.writeFileSync(path.join(profile, 'Secure Preferences'), JSON.stringify({ '': 'empty key', extensions: { settings: {
      ['a'.repeat(32)]: { path: extension }, ['b'.repeat(32)]: { manifest: { name: 'Other extension' } }
    } } }));
    fs.writeFileSync(path.join(profile, 'Preferences'), 'broken');
    assert.deepEqual(detect(directory), ['a'.repeat(32)]);
  } finally { if (!path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep + 'quiz-detect-')) throw Error('Unsafe temporary path'); fs.rmSync(directory, { recursive: true, force: true }); }
});
function handler(extra = {}) { return createHandler({ account: { rpc: async method => method === 'account/read' ? { account: { type: 'chatgpt', planType: 'plus', email: 'private@example.test' } } : { authUrl: 'https://auth.openai.com/authorize?state=test' }, close() {} }, runner: async (_, body) => answer(body), ...extra }); }
test('native host reports real account state without exposing credentials; only explicit login returns an auth URL', async () => {
  const h = handler();
  try {
    const status = await h.handle({ id: 1, method: 'status' }); assert.equal(status.loggedIn, true); assert.equal(status.email, undefined);
    assert.equal((await h.handle({ id: 2, method: 'login' })).authURL, 'https://auth.openai.com/authorize?state=test');
    const malicious = handler({ account: { rpc: async () => ({ authUrl: 'https://evil.test' }), close() {} } });
    await assert.rejects(malicious.handle({ id: 3, method: 'login' }), /URL/); malicious.close();
  } finally { h.close(); }
});
test('native ask/test use subscription runner and validated evidence; invalid payloads and invented quotes are blocked', async () => {
  const h = handler();
  try {
    assert.equal((await h.handle({ id: 1, method: 'ask', params: data })).index, 0);
    assert.equal((await h.handle({ id: 2, method: 'test' })).ok, true);
    await assert.rejects(h.handle({ id: 3, method: 'ask', params: { ...data, chunks: [] } }));
    await assert.rejects(h.handle({ id: 4, method: 'exec', params: {} }));
    const invalid = handler({ runner: async () => ({ status: 'answered', answer_text: 'Việt Bắc', explanation: '', evidence: [{ id: 'p1', quote: 'This was invented' }] }) });
    await assert.rejects(invalid.handle({ id: 5, method: 'ask', params: data })); invalid.close();
  } finally { h.close(); }
});
test('native cancellation kills only the requested task and two concurrent jobs cap background work', async () => {
  const h = handler({ runner: async (_, body, signal) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Error('cancelled')), { once: true })) });
  const first = h.handle({ id: 1, method: 'ask', params: data }); const second = h.handle({ id: 2, method: 'ask', params: data });
  const firstRejected = assert.rejects(first, /cancelled/), secondRejected = assert.rejects(second, /cancelled/);
  await assert.rejects(h.handle({ id: 3, method: 'ask', params: data }), /đang xử lý/);
  await h.handle({ id: 4, method: 'cancel', params: { requestId: 1 } }); await firstRejected;
  h.close(); await secondRejected;
});
test('native protocol supports split and coalesced binary frames without stdout logs', async () => {
  const input = new PassThrough(), output = new PassThrough(); let result = Buffer.alloc(0);
  output.on('data', chunk => { result = Buffer.concat([result, chunk]); }); const h = serve(input, output, handler());
  const body = Buffer.from(JSON.stringify({ id: 1, method: 'status' })), prefix = Buffer.alloc(4); prefix.writeUInt32LE(body.length);
  const frame = Buffer.concat([prefix, body]); input.write(frame.subarray(0, 2)); input.write(Buffer.concat([frame.subarray(2), frame]));
  await until(() => result.length > 8);
  const size = result.readUInt32LE(); assert.equal(JSON.parse(result.subarray(4, 4 + size)).result.loggedIn, true);
  assert.equal(result.readUInt32LE(size + 4), size); input.end(); h.close();
});
function nativeEnvironment() {
  const env = environment(); let calls = [];
  env.connectNative = () => {
    let listener;
    return { onMessage: { addListener: fn => { listener = fn; } }, onDisconnect: { addListener() {} },
      postMessage(message) { calls.push(message); queueMicrotask(() => {
        const input = message.params;
        const result = message.method === 'status' ? { loggedIn: true, plan: 'plus' } : message.method === 'login' ? { authURL: 'https://auth.openai.com/authorize?state=test' } : message.method === 'ask' ?
          { status: 'model_suggested', answer: input.options[0], explanation: 'Native fixture.', evidence: [{ id: input.chunks[0].id, quote: input.chunks[0].text.slice(0, 80) }] } : { ok: true };
        listener({ id: message.id, result });
      }); }
    };
  };
  return { env, calls };
}
test('popup mode persists, native AI needs no key/token/HTTP permission, and asking never opens a browser tab', async () => {
  const { env, calls } = nativeEnvironment(), w = worker(env), popup = { ...w.ui, url: w.ui.url.replace('settings.html', 'popup.html') };
  assert.ok((await w.send({ type: 'set-mode', mode: 'chatgpt' })).error);
  assert.equal((await w.send({ type: 'set-mode', mode: 'chatgpt' }, popup)).ok, true);
  assert.equal((await w.send({ type: 'native-status' }, popup)).loggedIn, true);
  env.permissions = false;
  const query = { q: 'Căn cứ địa cách mạng Việt Bắc trong kháng chiến năm 1947 có ý nghĩa gì?', options: bank[0].options };
  assert.equal((await w.send({ type: 'search', ...query })).config.autoAI, true);
  const response = await w.send({ type: 'ai', ...query, requestId: 'native-test' });
  assert.equal(response.decision.status, 'model_suggested'); assert.equal(env.network.length, 0); assert.equal(env.opened, undefined);
  assert.equal(calls.filter(c => c.method === 'ask').length, 1);
  await w.send({ type: 'native-login' }, popup); assert.ok(env.opened.url.startsWith('https://auth.openai.com/'));
  await w.send({ type: 'set-mode', mode: 'tfidf' }, popup); assert.equal(env.local.data.settings.autoAI, false);
  assert.ok((await w.send({ type: 'native-login' })).error);
});
test('top-one full match returns one result; top-k is reserved for both fields unmatched', async () => {
  const w = worker(), item = bank[0];
  const exact = await w.send({ type: 'search', q: item.q, options: item.options });
  assert.equal(exact.results.length, 1); assert.equal(exact.fallback, false);
  const partial = await w.send({ type: 'search', q: item.q, options: ['khác a', 'khác b'] });
  assert.equal(partial.fallback, false); assert.ok(partial.results.length <= 1);
  const unknown = await w.send({ type: 'search', q: 'Sự phát triển Việt Bắc năm 1947?', options: ['mới a', 'mới b'] });
  assert.equal(unknown.fallback, true); assert.equal(unknown.results.length, 3);
});
test('running state survives new documents and worker restart, is isolated by tab/site, and Stop or tab close clears it', async () => {
  const env = environment(); let w = worker(env); const sender = w.tab(4);
  assert.equal((await w.send({ type: 'set-running', enabled: true }, sender)).enabled, true);
  w = worker(env);
  assert.equal((await w.send({ type: 'running-state' }, sender)).enabled, true);
  assert.equal((await w.send({ type: 'running-state' }, w.tab(5))).enabled, false);
  assert.equal((await w.send({ type: 'running-state' }, { ...sender, url: 'https://other.test/quiz' })).enabled, false);
  await w.send({ type: 'set-running', enabled: false }, sender);
  assert.equal((await w.send({ type: 'running-state' }, sender)).enabled, false);
  await w.send({ type: 'set-running', enabled: true }, sender); await w.listeners.removed(4);
  assert.equal((await w.send({ type: 'running-state' }, sender)).enabled, false);
  const file = { ...sender, url: 'file:///C:/demo/page.html' };
  await w.send({ type: 'set-running', enabled: true }, file);
  assert.equal((await w.send({ type: 'running-state' }, { ...file, url: 'file:///C:/demo/page-2.html' })).enabled, true);
  assert.equal((await w.send({ type: 'running-state' }, { ...file, url: 'file:///C:/other/page.html' })).enabled, false);
});
test('late cancel from a previous document cannot abort AI for the new page of the same tab', async () => {
  const { env, calls } = nativeEnvironment(); let reply;
  env.connectNative = () => ({ onMessage: { addListener: fn => { reply = fn; } }, onDisconnect: { addListener() {} }, postMessage: m => calls.push(m) });
  const w = worker(env); await w.send({ type: 'set-mode', mode: 'chatgpt' }, w.ui);
  const query = { type: 'ai', q: 'Căn cứ địa cách mạng Việt Bắc trong kháng chiến năm 1947?', options: bank[0].options };
  const oldPage = { ...w.tab(1), documentId: 'old' }, newPage = { ...w.tab(1), documentId: 'new' };
  const first = w.send({ ...query, requestId: 'old' }, oldPage), second = w.send({ ...query, requestId: 'new' }, newPage);
  await until(() => calls.filter(m => m.method === 'ask').length === 2);
  await w.send({ type: 'cancel' }, oldPage); assert.ok((await first).error);
  const requests = calls.filter(m => m.method === 'ask'), next = requests[1];
  assert.equal(calls.filter(m => m.method === 'cancel').length, 1);
  reply({ id: next.id, result: { status: 'model_suggested', answer: next.params.options[0], explanation: 'New page reply',
    evidence: [{ id: next.params.chunks[0].id, quote: next.params.chunks[0].text.slice(0, 80) }] } });
  assert.equal((await second).decision.status, 'model_suggested');
});
