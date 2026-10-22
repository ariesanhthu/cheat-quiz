/* Optional local relay. No dependencies. Never serves the API key to the extension. */
'use strict';
const http = require('node:http');
function createProxy({ apiKey, token, extensionId, fetcher = fetch }) {
  if (!apiKey || !token || !/^[a-p]{32}$/.test(extensionId || '')) throw Error('Cần OPENAI_API_KEY, QA_PROXY_TOKEN và QA_EXTENSION_ID (32 ký tự a-p).');
  return http.createServer(async (req, res) => {
    const origin = `chrome-extension://${extensionId}`;
    if (req.headers.origin !== origin) { res.writeHead(403); res.end(); return; }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (req.url !== '/responses' || req.method !== 'POST') { res.writeHead(404); res.end(); return; }
    if (req.headers.authorization !== `Bearer ${token}`) { res.writeHead(401); res.end(); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 24000);
    res.on('close', () => { if (!res.writableEnded) controller.abort(); });
    try {
      let input = '';
      for await (const chunk of req) { input += chunk; if (Buffer.byteLength(input) > 100000) { res.writeHead(413); res.end(); return; } }
      const body = JSON.parse(input);
      if (typeof body.model !== 'string' || typeof body.input !== 'string' || body.text?.format?.type !== 'json_schema') throw Error('Invalid body');
      // Only known request fields can reach the upstream API; never forward tools or URLs.
      const response = await fetcher('https://api.openai.com/v1/responses', { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        credentials: 'omit', redirect: 'error', signal: controller.signal,
        body: JSON.stringify({ model: body.model, instructions: body.instructions, input: body.input, text: body.text, store: false, max_output_tokens: 1800 }) });
      if (!response.ok) { res.writeHead(response.status); res.end(JSON.stringify({ error: `Upstream HTTP ${response.status}` })); return; }
      const text = await response.text();
      if (text.length > 1000000) throw Error('Response too large');
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(text);
    } catch { if (!res.headersSent) res.writeHead(controller.signal.aborted ? 504 : 400); res.end(JSON.stringify({ error: 'Proxy request failed' })); }
    finally { clearTimeout(timer); }
  });
}
if (require.main === module) {
  try {
    const server = createProxy({ apiKey: process.env.OPENAI_API_KEY, token: process.env.QA_PROXY_TOKEN, extensionId: process.env.QA_EXTENSION_ID });
    server.listen(8787, '127.0.0.1', () => console.log('Quiz proxy listening at http://127.0.0.1:8787 (localhost only)'));
    server.on('error', error => { console.error(`Proxy không khởi động được: ${error.code}`); process.exitCode = 1; });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { createProxy };
