const { test } = require('node:test');
const assert = require('node:assert/strict');
global.QuizCore = require('../core.js');
const AI = require('../ai.js');
const chunks = [{ id: 'page:1', text: 'Căn cứ địa của cả nước là Việt Bắc.', title: 'Trang 1', path: 'page.md' }];
const options = ['A. Việt Bắc', 'B. Tây Bắc'];
const answer = { status: 'answered', answer_text: 'Việt Bắc', explanation: 'Theo tài liệu.', evidence: [{ id: 'page:1', quote: 'Căn cứ địa của cả nước là Việt Bắc.' }] };
const envelope = a => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(a) }] }] });
const config = { provider: 'openai', model: 'test-model' };
test('retrieval finds real relevant material with bounded payload and source IDs', () => {
  const { chunks } = require('../knowledge-base.json');
  const index = QuizCore.compile(chunks.map(c => c.text));
  const results = AI.retrieve(chunks, index, 'Nguyễn Ái Quốc đọc Luận cương Lênin tháng 7 năm 1920', []);
  assert.ok(results.length > 0 && results.length <= 6);
  assert.ok(results.reduce((s, c) => s + c.text.length, 0) <= 14000);
  assert.ok(results.some(c => /1920|LÊNIN|Lênin|Lê-nin/.test(c.text)));
});
test('structured answer maps by text, carries source and stays model_suggested', () => {
  const result = AI.verify(answer, options, chunks);
  assert.equal(result.status, 'model_suggested'); assert.equal(result.index, 0); assert.equal(result.evidence[0].path, 'page.md');
});
test('invented citations, empty evidence, duplicate answers and invalid output never match', () => {
  assert.throws(() => AI.verify({ ...answer, evidence: [{ id: 'fake', quote: 'Căn cứ địa' }] }, options, chunks));
  assert.throws(() => AI.verify({ ...answer, evidence: [{ id: 'page:1', quote: 'Trích dẫn bịa đặt' }] }, options, chunks));
  assert.throws(() => AI.verify({}, options, chunks));
  assert.throws(() => AI.verify({ ...answer, evidence: [null] }, options, chunks));
  for (const result of [AI.verify({ ...answer, evidence: [] }, options, chunks), AI.verify(answer, ['Việt Bắc', 'Việt Bắc'], chunks),
    AI.verify({ ...answer, answer_text: 'A' }, options, chunks), AI.verify({ ...answer, status: 'needs_review' }, options, chunks)]) assert.equal(result.status, 'needs_review');
});
test('only OpenAI or a loopback proxy endpoint can receive a credential', () => {
  assert.equal(AI.endpoint(config), 'https://api.openai.com/v1/responses');
  assert.equal(AI.endpoint({ provider: 'proxy' }), 'http://127.0.0.1:8787/responses');
  for (const endpoint of ['https://evil.example/responses', 'http://127.0.0.1@evil.test/responses', 'http://localhost:8787/responses', 'http://127.0.0.1:8787/other', 'http://127.0.0.1/responses?key=123']) assert.throws(() => AI.endpoint({ provider: 'proxy', endpoint }));
});
test('request sends only question/options/context, with structured schema and no cookies', async () => {
  let count = 0;
  const result = await AI.request(config, 'secret-test', 'Căn cứ địa?', options, chunks, new AbortController().signal, async (url, init) => {
    count++; assert.equal(url, 'https://api.openai.com/v1/responses'); assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'error');
    const body = JSON.parse(init.body); assert.equal(body.store, false); assert.equal(body.text.format.strict, true);
    assert.ok(!init.body.includes('secret-test')); assert.ok(!init.body.includes('sesskey')); assert.ok(!init.body.includes('<html'));
    return new Response(JSON.stringify(envelope(answer)), { status: 200 });
  });
  assert.equal(result.index, 0); assert.equal(count, 1);
});
test('401, 429, 500, offline, malformed JSON, refusal and incomplete output fail without retry', async () => {
  for (const response of [new Response('', { status: 401 }), new Response('', { status: 429 }), new Response('', { status: 500 }),
    new Response('{broken'), new Response(JSON.stringify({ status: 'incomplete', output: [] })),
    new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] }))]) {
    let calls = 0;
    await assert.rejects(AI.request(config, 'test', 'q', options, chunks, null, async () => { calls++; return response; }));
    assert.equal(calls, 1);
  }
  await assert.rejects(AI.request(config, 'test', 'q', options, chunks, null, async () => { throw Error('Offline'); }));
  await assert.rejects(AI.request(config, '', 'q', options, chunks, null, async () => { throw Error('should not call'); }), /Chưa cấu hình/);
  await assert.rejects(AI.request(config, 'key', 'q', options, [], null), /ngữ cảnh/);
});
test('abort signal terminates a pending AI request', async () => {
  const controller = new AbortController();
  const promise = AI.request(config, 'key', 'q', options, chunks, controller.signal, async (_, init) => new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
  controller.abort(); await assert.rejects(promise, { name: 'AbortError' });
});
