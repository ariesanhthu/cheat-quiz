const { test } = require('node:test');
const assert = require('node:assert/strict');
const { worker, environment, until, delay, item } = require('./helpers.cjs');
const bank = require('../bank.json');
const bundled = bank[0];
const search = { type: 'search', q: bundled.q, options: bundled.options };
const config = { autoSelect: true, overwrite: false, autoAI: true, aiAutoSelect: false, threshold: 0.94, margin: 0.08,
  provider: 'openai', model: 'test-model', endpoint: 'http://127.0.0.1:8787/responses' };
async function setupAI(w) {
  const response = await w.send({ type: 'save-settings', settings: config, credential: 'private-session-key' }, w.ui);
  assert.ok(response.ok);
}
function aiResponse(init) {
  const payload = JSON.parse(init.body), input = JSON.parse(payload.input);
  const answer = { status: 'answered', answer_text: input.options[0], explanation: 'Dẫn chứng kiểm thử.',
    evidence: [{ id: input.documents[0].id, quote: input.documents[0].text.slice(0, 60) }] };
  return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(answer) }] }] }));
}
test('packaged banks work offline; worker restart recovers Chrome local data and rebuilds its in-memory index', async () => {
  const env = environment();
  const first = worker(env);
  const result = await first.send(search);
  assert.equal(result.results.length, 3); assert.equal(result.decision.status, 'matched');
  assert.equal(result.config.autoSelect, true); assert.equal(env.network.length, 0);
  const restarted = worker(env);
  const after = await restarted.send(search);
  assert.deepEqual(JSON.parse(JSON.stringify(after)), JSON.parse(JSON.stringify(result)));
  assert.equal(env.resources.filter(x => x === 'bank.json').length, 1);
});
test('import append/replace, rebuild, clear and reset persist across fresh workers', async () => {
  const env = environment(); let w = worker(env);
  assert.equal((await w.send({ type: 'info' }, w.ui)).count, 151);
  assert.equal((await w.send({ type: 'import', data: [item], append: true, trust: true }, w.ui)).count, 152);
  assert.equal((await w.send({ type: 'rebuild' }, w.ui)).count, 152);
  w = worker(env); assert.equal((await w.send({ type: 'info' }, w.ui)).count, 152);
  assert.equal((await w.send({ type: 'import', data: [item], append: false }, w.ui)).count, 1);
  assert.equal((await w.send({ type: 'clear' }, w.ui)).count, 0);
  w = worker(env); assert.equal((await w.send({ type: 'info' }, w.ui)).count, 0);
  assert.equal((await w.send(search)).results.length, 0);
  assert.equal((await w.send({ type: 'reset' }, w.ui)).count, 151);
});
test('concurrent writes serialize and a concurrent search sees committed data', async () => {
  const w = worker();
  await w.send({ type: 'clear' }, w.ui);
  const imports = Array.from({ length: 5 }, (_, i) => w.send({ type: 'import', data: [{ ...item, id: `sample-${i}` }], append: true }, w.ui));
  const result = w.send({ type: 'search', q: item.q, options: item.options });
  const results = await Promise.all(imports);
  assert.deepEqual(results.map(r => r.count), [1, 2, 3, 4, 5]);
  assert.equal((await result).decision.status, 'matched');
  assert.equal((await w.send({ type: 'info' }, w.ui)).count, 5);
});
test('invalid import or failed write leaves prior bank available and future writes recover', async () => {
  const env = environment(), w = worker(env);
  await w.send(search);
  const invalid = await w.send({ type: 'import', data: [{ q: 'bad', options: ['x'], answer: 30 }] }, w.ui);
  assert.ok(invalid.error); assert.equal((await w.send({ type: 'info' }, w.ui)).count, 151);
  const original = env.local.set;
  env.local.set = async () => { throw Error('Chrome storage quota exceeded'); };
  const failed = await w.send({ type: 'clear' }, w.ui);
  assert.ok(failed.error);
  env.local.set = original;
  assert.equal((await w.send(search)).decision.status, 'matched');
  assert.equal((await w.send({ type: 'rebuild' }, w.ui)).count, 151);
});
test('user banks are stored as plain JSON in Chrome local storage, without a database or vector index', async () => {
  const env = environment();
  env.local.data.questionBank = { bank: [item], bundled: false };
  const w = worker(env), info = await w.send({ type: 'info' }, w.ui);
  assert.equal(info.count, 1); assert.equal(info.bundled, false);
  assert.equal(env.local.data.questionBank.index, undefined);
  assert.ok(!JSON.stringify(env.local.data).includes('vectors'));
});
test('tab content cannot mutate banks/settings/read secrets; malformed and foreign messages rejected', async () => {
  const w = worker();
  for (const type of ['info', 'import', 'clear', 'reset', 'rebuild', 'save-settings', 'clear-credential']) {
    assert.ok((await w.send({ type, data: [] })).error);
  }
  for (const message of [null, {}, { type: 'unknown' }, { type: 'search', q: 'q' }, { type: 'search', q: '', options: [] },
    { type: 'search', q: 'x'.repeat(20001), options: [] }, { type: 'search', q: 'q', options: [null] }]) assert.ok((await w.send(message)).error);
  assert.equal(await w.send(search, { id: 'foreign' }), undefined);
});
test('configuration range/credential validation, session-only keys and provider binding', async () => {
  const w = worker();
  assert.equal((await w.send({ type: 'info' }, { ...w.ui, tab: { id: 99 } })).count, 151);
  for (const altered of [{ threshold: 0 }, { margin: 0 }, { autoAI: 'yes' }, { provider: 'other' }, { endpoint: 'https://evil.test' }, { model: '\nBad' }]) {
    assert.ok((await w.send({ type: 'save-settings', settings: { ...config, ...altered } }, w.ui)).error);
  }
  await setupAI(w);
  assert.equal(JSON.stringify(w.env.local.data).includes('private-session-key'), false);
  const info = await w.send({ type: 'info' }, w.ui);
  assert.equal(info.hasCredential, true); assert.equal(JSON.stringify(info).includes('private-session-key'), false);
  await w.send({ type: 'save-settings', settings: { ...config, provider: 'proxy' } }, w.ui);
  assert.equal((await w.send({ type: 'info' }, w.ui)).hasCredential, false);
  await w.send({ type: 'clear-credential' }, w.ui);
  assert.deepEqual(w.env.session.data, {});
});
test('without configured AI the worker returns ordinary TF-IDF even if autoAI was previously enabled', async () => {
  const w = worker();
  await w.send({ type: 'save-settings', settings: config }, w.ui);
  const result = await w.send(search);
  assert.equal(result.config.autoAI, false); assert.equal(result.decision.status, 'matched');
  assert.equal(w.env.network.length, 0);
});
test('real AI route retrieves bounded knowledge context and returns only validated citations', async () => {
  const w = worker(environment(), async (_, init) => aiResponse(init));
  await setupAI(w);
  const result = await w.send({ type: 'ai', q: 'Căn cứ địa cách mạng là ở đâu?', options: ['Việt Bắc', 'Tây Bắc'], requestId: 'ai-1' });
  assert.equal(result.decision.status, 'model_suggested'); assert.equal(result.decision.index, 0);
  assert.ok(result.decision.evidence[0].path.startsWith('LICH-SU-DANG-NGUYEN-VAN/trang/'));
  assert.equal(JSON.stringify(result).includes('private-session-key'), false);
  assert.equal(w.env.network.length, 1);
});
test('source viewer only opens known packaged evidence pages, never arbitrary URLs', async () => {
  const w = worker();
  assert.ok((await w.send({ type: 'open-source', id: 'https://evil.test' })).error);
  const id = require('../knowledge-base.json').chunks[0].id;
  assert.equal((await w.send({ type: 'open-source', id })).ok, true);
  assert.ok(w.env.opened.url.startsWith('chrome-extension://'));
  assert.ok(w.env.opened.url.includes('source.html?id='));
});
test('missing credential, missing permission and offline API produce safe errors', async () => {
  const w = worker();
  const message = { type: 'ai', q: 'Lịch sử Đảng', options: ['Yes', 'No'], requestId: '1' };
  assert.ok((await w.send(message)).error);
  await setupAI(w); w.env.permissions = false;
  assert.match((await w.send(message)).error, /cấp quyền/);
  w.env.permissions = true;
  assert.ok((await w.send(message)).error);
});
test('cancellation and closing a tab abort only that owner; duplicate request IDs are rejected', async () => {
  const w = worker(environment(), async (_, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
  await setupAI(w);
  const message = { type: 'ai', q: 'Lịch sử Đảng', options: ['Yes', 'No'], requestId: 'same' };
  const first = w.send(message, w.tab(1));
  const second = w.send(message, w.tab(2));
  await until(() => w.env.network.length === 2);
  assert.match((await w.send(message, w.tab(1))).error, /đang chạy/);
  await w.send({ type: 'cancel' }, w.tab(1));
  assert.ok((await first).error);
  assert.equal(w.env.network[1].init.signal.aborted, false);
  w.listeners.removed(2); assert.ok((await second).error);
});
test('AI deadline aborts a stuck network request and releases its request slot', async () => {
  const env = environment(); env.aiTimeout = 20;
  const w = worker(env, async (_, init) => new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
  await setupAI(w);
  const query = { type: 'ai', q: 'Lịch sử Đảng Việt Nam', options: ['Yes', 'No'], requestId: 'deadline' };
  const result = await w.send(query);
  assert.match(result.error, /quá thời gian/);
  const next = await w.send(query);
  assert.match(next.error, /quá thời gian/);
  assert.ok(env.network.every(r => r.init.signal.aborted));
});
