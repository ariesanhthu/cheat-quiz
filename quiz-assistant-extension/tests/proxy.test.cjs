const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createProxy } = require('../scripts/proxy.cjs');
test('proxy binds to allowed extension, token and route; strips arbitrary tools and never leaks upstream key', async () => {
  const id = 'a'.repeat(32), requests = [];
  const server = createProxy({ apiKey: 'upstream-private-key', token: 'session-token', extensionId: id, fetcher: async (url, init) => {
    requests.push({ url, init }); return new Response(JSON.stringify({ status: 'completed', output: [] }));
  } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  const headers = { Origin: `chrome-extension://${id}`, Authorization: 'Bearer session-token', 'Content-Type': 'application/json' };
  try {
    assert.equal((await fetch(`${url}/responses`, { method: 'OPTIONS', headers })).status, 204);
    assert.equal((await fetch(`${url}/responses`, { method: 'POST', headers: { ...headers, Origin: 'https://evil.test' } })).status, 403);
    assert.equal((await fetch(`${url}/responses`, { method: 'POST', headers: { ...headers, Authorization: 'wrong' } })).status, 401);
    assert.equal((await fetch(`${url}/other`, { method: 'POST', headers })).status, 404);
    assert.equal((await fetch(`${url}/responses`, { method: 'POST', headers, body: '{invalid' })).status, 400);
    const body = { model: 'model', input: 'data', instructions: 'instructions', text: { format: { type: 'json_schema' } }, tools: [{ type: 'web_search' }], store: true };
    const response = await fetch(`${url}/responses`, { method: 'POST', headers, body: JSON.stringify(body) });
    assert.equal(response.status, 200); assert.equal((await response.text()).includes('upstream-private-key'), false);
    assert.equal(requests.length, 1); assert.equal(requests[0].init.headers.Authorization, 'Bearer upstream-private-key');
    const upstream = JSON.parse(requests[0].init.body); assert.equal(upstream.store, false); assert.equal(upstream.tools, undefined);
  } finally { server.closeAllConnections(); await new Promise(r => server.close(r)); }
});
test('proxy refuses startup without explicit secrets/extension identity', () => {
  for (const config of [{}, { apiKey: 'a', token: 'b', extensionId: 'bad' }]) assert.throws(() => createProxy(config));
});
