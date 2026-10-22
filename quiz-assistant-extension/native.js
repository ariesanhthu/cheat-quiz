(() => {
  'use strict';
  let port, sequence = 0;
  const pending = new Map();
  function connect() {
    if (port) return port;
    const current = chrome.runtime.connectNative('vn.quizassistant.ai'); port = current;
    current.onMessage.addListener(message => {
      const request = pending.get(message.id); if (!request) return;
      pending.delete(message.id); clearTimeout(request.timer);
      message.error ? request.reject(Error(message.error)) : request.resolve(message.result);
    });
    current.onDisconnect.addListener(() => {
      void chrome.runtime.lastError;
      if (port === current) port = null;
      for (const request of pending.values()) { clearTimeout(request.timer); request.reject(Error('Chưa có bộ kết nối AI. Mở popup → Cài kết nối một lần.')); }
      pending.clear();
    });
    return current;
  }
  async function request(method, params = {}, signal, timeout = 100000) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const current = connect(), id = ++sequence;
    return new Promise((resolve, reject) => {
      const finish = (fn, value) => { signal?.removeEventListener('abort', abort); fn(value); };
      const abort = () => { const entry = pending.get(id); if (!entry) return; clearTimeout(entry.timer); pending.delete(id);
        try { current.postMessage({ id: ++sequence, method: 'cancel', params: { requestId: id } }); } catch {}
        finish(reject, new DOMException('Aborted', 'AbortError'));
      };
      const timer = setTimeout(() => { abort(); }, timeout);
      pending.set(id, { resolve: value => finish(resolve, value), reject: error => finish(reject, error), timer });
      signal?.addEventListener('abort', abort, { once: true });
      try { current.postMessage({ id, method, params }); } catch (error) { pending.delete(id); clearTimeout(timer); finish(reject, error); }
    });
  }
  globalThis.QuizNative = { request };
})();
