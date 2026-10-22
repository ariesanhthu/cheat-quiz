/* Chrome native messaging host. No listener port, API key, or quiz database. */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createRunner, subscriptionEnvironment } = require('./cli-bridge.cjs');
const AI = require('../ai.js');
function findCodex() {
  if (process.env.QA_CODEX_BIN) return process.env.QA_CODEX_BIN;
  if (process.platform === 'win32') {
    for (const directory of (process.env.PATH || '').split(path.delimiter)) {
      const file = path.join(directory, 'codex.exe'); if (fs.existsSync(file)) return file;
    }
    for (const editor of ['.vscode', '.vscode-insiders', '.cursor']) {
      const directory = path.join(os.homedir(), editor, 'extensions');
      if (!fs.existsSync(directory)) continue;
      for (const name of fs.readdirSync(directory).filter(n => n.startsWith('openai.chatgpt-')).sort().reverse()) {
        const file = path.join(directory, name, 'bin/windows-x86_64/codex.exe'); if (fs.existsSync(file)) return file;
      }
    }
  }
  return 'codex';
}
function accountClient({ binary = findCodex(), spawnProcess = spawn } = {}) {
  let child, ready, sequence = 0, buffer = '';
  const pending = new Map();
  function fail() {
    child = null; ready = null;
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(Error('Không mở được Codex. Chạy SETUP lại để cài bộ kết nối.')); }
    pending.clear();
  }
  function raw(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(Error('Codex chưa phản hồi. Thử kết nối lại.')); }, 20000);
      pending.set(id, { resolve, reject, timer }); child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
    });
  }
  async function rpc(method, params = {}) {
    if (!ready) ready = (async () => {
      child = spawnProcess(binary, ['app-server', '--listen', 'stdio://'], {
        env: subscriptionEnvironment(), cwd: os.tmpdir(), shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']
      });
      child.on('error', fail); child.on('close', fail); child.stdin.on('error', fail);
      child.stderr.resume();
      child.stdout.on('data', chunk => {
        buffer += chunk; if (buffer.length > 1000000) { child?.kill(); fail(); return; }
        let line;
        while ((line = buffer.indexOf('\n')) >= 0) {
          const value = buffer.slice(0, line); buffer = buffer.slice(line + 1);
          try {
            const message = JSON.parse(value), request = pending.get(message.id);
            if (request) { clearTimeout(request.timer); pending.delete(message.id);
              message.error ? request.reject(Error('Codex không xử lý được yêu cầu đăng nhập.')) : request.resolve(message.result); }
            else if (message.id != null && message.method) child.stdin.write(JSON.stringify({ id: message.id, error: { code: -32601, message: 'Not supported' } }) + '\n');
          } catch { /* Logs are never forwarded to the extension. */ }
        }
      });
      await raw('initialize', { clientInfo: { name: 'quiz_assistant', title: 'Quiz Assistant', version: '1.2.0' }, capabilities: { experimentalApi: false } });
      child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
    })();
    await ready; return raw(method, params);
  }
  return { rpc, close: () => { child?.kill(); fail(); } };
}
function createHandler({ account = accountClient(), runner = createRunner({ binaries: { 'codex-cli': findCodex() } }) } = {}) {
  const tasks = new Map();
  return {
    async handle(message) {
      if (!message || !Number.isInteger(message.id) || !['status', 'login', 'ask', 'test', 'cancel'].includes(message.method)) throw Error('Yêu cầu native không hợp lệ.');
      if (message.method === 'cancel') { tasks.get(message.params?.requestId)?.abort(); return { ok: true }; }
      if (message.method === 'status') {
        const result = await account.rpc('account/read', { refreshToken: false });
        return { installed: true, loggedIn: result.account?.type === 'chatgpt', plan: result.account?.type === 'chatgpt' ? result.account.planType : null };
      }
      if (message.method === 'login') {
        const result = await account.rpc('account/login/start', { type: 'chatgpt' });
        const url = new URL(result.authUrl);
        if (url.protocol !== 'https:' || !['auth.openai.com', 'chatgpt.com'].includes(url.hostname) || url.username || url.password) throw Error('URL đăng nhập Codex không hợp lệ.');
        return { authURL: url.href };
      }
      if (tasks.size >= 2) throw Error('AI đang xử lý. Chờ câu trước hoàn tất.');
      let data = message.params;
      if (message.method === 'test') data = { q: 'Căn cứ địa của cả nước?', options: ['Việt Bắc', 'Tây Bắc'],
        chunks: [{ id: 'connection-test', title: 'Thử kết nối', text: 'Căn cứ địa của cả nước là Việt Bắc.' }] };
      if (!data || typeof data.q !== 'string' || data.q.length > 20000 || !Array.isArray(data.options) || data.options.length > 100 ||
        data.options.some(o => typeof o !== 'string' || o.length > 20000) || !Array.isArray(data.chunks) || !data.chunks.length || data.chunks.length > 6 ||
        data.chunks.some(c => typeof c?.id !== 'string' || typeof c?.text !== 'string') || data.chunks.reduce((n, c) => n + c.text.length, 0) > 14000) throw Error('Dữ liệu AI không hợp lệ.');
      const controller = new AbortController(); tasks.set(message.id, controller);
      const timer = setTimeout(() => controller.abort(), 90000);
      try {
        const raw = await runner('codex-cli', AI.body({ provider: 'codex-cli', model: '' }, data.q, data.options, data.chunks), controller.signal);
        const decision = AI.verify(raw, data.options, data.chunks);
        if (controller.signal.aborted) throw Error('Đã hủy AI.');
        if (message.method === 'test') {
          if (decision.status !== 'model_suggested' || decision.index !== 0) throw Error('AI chưa trả lời đúng bài thử kết nối.');
          return { ok: true, message: 'ChatGPT đã trả lời được. Sẵn sàng chạy nền.' };
        }
        return decision;
      } finally { clearTimeout(timer); tasks.delete(message.id); }
    },
    close() { for (const task of tasks.values()) task.abort(); account.close(); }
  };
}
function serve(input = process.stdin, output = process.stdout, handler = createHandler()) {
  let buffer = Buffer.alloc(0);
  function reply(value) { const body = Buffer.from(JSON.stringify(value)); const header = Buffer.alloc(4); header.writeUInt32LE(body.length); output.write(Buffer.concat([header, body])); }
  input.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 4) {
      const size = buffer.readUInt32LE(0); if (size > 200000 || !size) { handler.close(); input.destroy(); return; }
      if (buffer.length < size + 4) return;
      let message;
      try { message = JSON.parse(buffer.subarray(4, size + 4).toString()); } catch { handler.close(); input.destroy(); return; }
      buffer = buffer.subarray(size + 4);
      (async () => { try { reply({ id: message.id, result: await handler.handle(message) }); }
        catch (error) { reply({ id: message.id, error: error.message }); } })();
    }
  });
  input.on('end', () => handler.close()); input.on('error', () => handler.close());
  return handler;
}
if (require.main === module) serve();
module.exports = { findCodex, accountClient, createHandler, serve };
