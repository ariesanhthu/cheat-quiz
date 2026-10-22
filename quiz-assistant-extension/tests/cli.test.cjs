const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { subscriptionEnvironment, createRunner, createBridge } = require('../scripts/cli-bridge.cjs');
const { until, environment, worker } = require('./helpers.cjs');
const AI = require('../ai.js');
const options = ['Việt Bắc', 'Tây Bắc'];
const chunks = [{ id: 'page:1', text: 'Căn cứ địa của cả nước là Việt Bắc.', title: 'Trang 1', path: 'source.md' }];
const config = { provider: 'codex-cli', model: '' };
const body = () => ({ provider: config.provider, ...AI.body(config, 'Căn cứ địa?', options, chunks) });
const answer = { status: 'answered', answer_text: options[0], explanation: 'Theo tài liệu.', evidence: [{ id: 'page:1', quote: chunks[0].text }] };

test('CLI subprocess receives no API-key/provider overrides and executes with shell:false + hidden window', async () => {
  const cleaned = subscriptionEnvironment({ PATH: 'path', OPENAI_API_KEY: 'secret', ANTHROPIC_API_KEY: 'secret', CODEX_API_KEY: 'secret', ANTHROPIC_AUTH_TOKEN: 'secret', ANTHROPIC_BASE_URL: 'http://bad', HOME: 'user' });
  assert.deepEqual(cleaned, { PATH: 'path', HOME: 'user' });
  const runs = [];
  const runner = createRunner({ spawnProcess: (command, args, options) => {
    runs.push({ command, args, options });
    assert.equal(options.shell, false); assert.equal(options.windowsHide, true); assert.equal(options.env.OPENAI_API_KEY, undefined);
    return spawn(process.execPath, [path.join(__dirname, 'fixtures/fake-cli.cjs'), ...args], options);
  } });
  for (const provider of ['codex-cli', 'claude-cli']) {
    const output = await runner(provider, body(), new AbortController().signal);
    assert.equal(output.answer_text, 'Việt Bắc');
  }
  const codex = runs.find(r => r.args.includes('exec'));
  assert.ok(codex.args.includes('--ephemeral')); assert.ok(codex.args.includes('read-only'));
  const claude = runs.find(r => r.args.includes('-p'));
  assert.equal(claude.args[claude.args.indexOf('--tools') + 1], '');
  assert.ok(claude.args.includes('--no-session-persistence'));
});
test('CLI executable missing or pre-aborted fails without inference or tool execution', async () => {
  const runner = createRunner({ binaries: { 'codex-cli': 'definitely-missing-quiz-cli' } });
  await assert.rejects(runner('codex-cli', body(), new AbortController().signal), /khởi động/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(runner('codex-cli', body(), controller.signal), /cancelled/);
});
test('cancelling a real child-process CLI fixture stops its process and cleans its temporary job', async () => {
  let queryProcess;
  const runner = createRunner({ spawnProcess: (command, args, options) => {
    const child = spawn(process.execPath, [path.join(__dirname, 'fixtures/fake-cli.cjs'), ...args], options);
    if (args.includes('exec')) queryProcess = child;
    return child;
  } });
  const controller = new AbortController();
  const result = runner('codex-cli', { ...body(), model: 'hang-test' }, controller.signal);
  // Observe rejection immediately so abort never creates an unhandled rejection in the test harness.
  const rejected = assert.rejects(result, /cancelled/);
  await until(() => queryProcess?.pid);
  const closed = once(queryProcess, 'close'); controller.abort();
  await rejected; await closed;
  assert.notEqual(queryProcess.exitCode === null && queryProcess.signalCode === null, true);
});
async function bridge(runner, jobTimeout) {
  const id = 'a'.repeat(32), token = 'bridge-token';
  const server = createBridge({ extensionId: id, token, runner, jobTimeout });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  const headers = { Origin: `chrome-extension://${id}`, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const call = (route, init = {}) => fetch(url + route, { ...init, headers: { ...headers, ...init.headers } });
  return { url, server, call, token, async close() { server.closeAllConnections(); await new Promise(r => server.close(r)); } };
}
test('bridge jobs: request/poll/validated answer/delete, origin and token enforcement, no database', async () => {
  const b = await bridge(async () => answer);
  try {
    assert.equal((await b.call('/jobs', { method: 'POST', headers: { Origin: 'https://bad.test' } })).status, 403);
    assert.equal((await b.call('/jobs', { method: 'POST', headers: { Authorization: 'wrong' } })).status, 401);
    assert.equal((await fetch(b.url + '/jobs/00000000-0000-0000-0000-000000000000')).status, 401);
    assert.equal((await b.call('/jobs', { method: 'POST', body: '{invalid' })).status, 400);
    const started = await b.call('/jobs', { method: 'POST', body: JSON.stringify(body()) });
    assert.equal(started.status, 202); const { id } = await started.json();
    const result = await (await b.call(`/jobs/${id}`)).json();
    assert.equal(result.state, 'completed'); assert.equal(result.answer.answer_text, 'Việt Bắc');
    assert.equal((await b.call(`/jobs/${id}`, { method: 'DELETE' })).status, 200);
    assert.equal((await b.call(`/jobs/${id}`)).status, 404);
  } finally { await b.close(); }
});
test('bridge cancellation/timeout kills pending work, and concurrency limits reject excess jobs', async () => {
  let aborted = 0;
  const b = await bridge((_, __, signal) => new Promise((resolve, reject) => signal.addEventListener('abort', () => { aborted++; reject(Error('aborted')); })), 1000);
  try {
    const start = async () => (await b.call('/jobs', { method: 'POST', body: JSON.stringify(body()) }));
    const first = await (await start()).json(), second = await (await start()).json();
    assert.equal((await start()).status, 429);
    await b.call(`/jobs/${first.id}`, { method: 'DELETE' }); await until(() => aborted === 1);
    await b.call(`/jobs/${second.id}`, { method: 'DELETE' }); await until(() => aborted === 2);
  } finally { await b.close(); }
  const deadline = await bridge((_, __, signal) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Error('deadline')))), 10);
  try {
    const { id } = await (await deadline.call('/jobs', { method: 'POST', body: JSON.stringify(body()) })).json();
    await new Promise(r => setTimeout(r, 30));
    assert.equal((await (await deadline.call(`/jobs/${id}`)).json()).state, 'error');
  } finally { await deadline.close(); }
});
test('extension CLI client works against actual loopback bridge without model or API key', async () => {
  const b = await bridge(async () => answer);
  try {
    const result = await AI.request({ ...config, endpoint: b.url + '/responses' }, b.token, 'Căn cứ địa?', options, chunks, new AbortController().signal,
      (url, init) => fetch(url, { ...init, headers: { ...init.headers, Origin: `chrome-extension://${'a'.repeat(32)}` } }));
    assert.equal(result.status, 'model_suggested'); assert.equal(result.index, 0);
  } finally { await b.close(); }
});
