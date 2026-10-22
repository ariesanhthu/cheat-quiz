/* MV3 worker: user data in chrome.storage.local; TF-IDF index only in memory. */
importScripts('core.js', 'ai.js', 'updates.js');
'use strict';
const DEFAULTS = { autoSelect: true, overwrite: false, autoAI: false, aiAutoSelect: false,
  threshold: 0.94, margin: 0.08, provider: 'openai', model: '', endpoint: 'http://127.0.0.1:8787/responses' };
let loaded, knowledge, writes = Promise.resolve();
const tasks = new Map();
let updateRequest;
async function updateInfo() {
  const stored = await chrome.storage.local.get('updateState');
  const preferences = await chrome.storage.local.get('updatePreferences');
  const currentVersion = chrome.runtime.getManifest().version;
  const status = { ...stored.updateState };
  status.available = !!status.latestVersion && QuizUpdates.newer(status.latestVersion, currentVersion);
  return { currentVersion, autoCheck: preferences.updatePreferences?.autoCheck === true, status };
}
async function checkUpdate(force = false) {
  if (updateRequest) return updateRequest;
  updateRequest = (async () => {
    const info = await updateInfo();
    if (!await chrome.permissions.contains({ origins: ['https://api.github.com/*'] })) return { ...info, requiresPermission: true };
    if (info.status.checkedAt && Date.now() - info.status.checkedAt < (force ? 30000 : 6 * 60 * 60 * 1000)) return info;
    try {
      const result = await QuizUpdates.check(await resource('update-config.json'), info.currentVersion);
      await chrome.storage.local.set({ updateState: { ...result, checkedAt: Date.now(), error: null } });
    } catch {
      await chrome.storage.local.set({ updateState: { ...info.status, checkedAt: Date.now(), error: 'Không kiểm tra được GitHub. Bạn vẫn dùng bản hiện tại bình thường.' } });
    }
    return updateInfo();
  })();
  try { return await updateRequest; } finally { updateRequest = null; }
}
async function scheduleUpdates() {
  const { autoCheck } = await updateInfo();
  if (autoCheck) await chrome.alarms.create('qa-check-updates', { periodInMinutes: 360 });
  else await chrome.alarms.clear('qa-check-updates');
}
async function record(value) {
  if (value === undefined) return (await chrome.storage.local.get('questionBank')).questionBank;
  // Persist JSON data only; Maps/vectors are rebuilt in memory after a worker restart.
  const { bank, revision, bundled } = value;
  try { await chrome.storage.local.set({ questionBank: { bank, revision, bundled } }); }
  catch { throw Error('Không lưu được vào Chrome local storage (có thể đã đầy). Kho cũ vẫn được giữ.'); }
}
async function resource(name) {
  const response = await fetch(chrome.runtime.getURL(name));
  if (!response.ok) throw Error(`Không đọc được ${name}.`);
  return response.json();
}
async function load() {
  if (!loaded) loaded = (async () => {
    let stored = await record();
    const manifest = await resource('data-manifest.json');
    const revision = JSON.stringify(manifest.sources);
    if (!stored || (stored.bundled && stored.revision !== revision)) {
      const bank = QuizCore.validate(await resource('bank.json'));
      const search = QuizCore.engine(bank);
      stored = { bank, index: search.index, revision, bundled: true };
      await record(stored);
      return { ...stored, search };
    }
    const search = QuizCore.engine(stored.bank);
    return { ...stored, search };
  })().catch(error => { loaded = null; throw error; });
  return loaded;
}
async function getKnowledge() {
  if (!knowledge) knowledge = resource('knowledge-base.json').then(kb => ({ chunks: kb.chunks, index: QuizCore.compile(kb.chunks.map(c => c.text)) })).catch(e => { knowledge = null; throw e; });
  return knowledge;
}
async function settings() { return { ...DEFAULTS, ...(await chrome.storage.local.get('settings')).settings }; }
function sanitizeSettings(value) {
  if (!value || typeof value !== 'object') throw Error('Cấu hình không hợp lệ.');
  const result = {};
  for (const k of ['autoSelect', 'overwrite', 'autoAI', 'aiAutoSelect']) {
    if (typeof value[k] !== 'boolean') throw Error(`Cấu hình ${k} phải là boolean.`);
    result[k] = value[k];
  }
  for (const k of ['threshold', 'margin']) {
    if (!Number.isFinite(value[k]) || value[k] < (k === 'threshold' ? 0.85 : 0.01) || value[k] > 1) throw Error(`Ngưỡng ${k} ngoài phạm vi.`);
    result[k] = value[k];
  }
  if (!['openai', 'proxy', 'codex-cli', 'claude-cli'].includes(value.provider)) throw Error('Provider không hợp lệ.');
  if (typeof value.model !== 'string' || value.model.length > 150 || !/^[\w.:-]*$/.test(value.model)) throw Error('Model không hợp lệ.');
  result.provider = value.provider; result.model = value.model;
  result.endpoint = String(value.endpoint || DEFAULTS.endpoint);
  QuizAI.endpoint({ ...result, provider: 'proxy' });
  return result;
}
function query(message) {
  if (typeof message.q !== 'string' || !message.q.trim() || message.q.length > 20000 ||
    !Array.isArray(message.options) || message.options.length > 100 || message.options.some(o => typeof o !== 'string' || o.length > 20000)) throw Error('Câu hỏi gửi lên không hợp lệ.');
  return { q: message.q, options: message.options };
}
const owner = sender => `${sender.tab?.id ?? 'settings'}:${sender.frameId ?? 0}`;
function abortOwner(sender, requestId) {
  for (const [id, task] of tasks) if (task.owner === owner(sender) && (!requestId || task.requestId === requestId)) task.controller.abort();
}
async function route(message, sender) {
  if (!message || typeof message.type !== 'string') throw Error('Yêu cầu không hợp lệ.');
  // Chrome supplies sender.tab for extension pages opened as tabs as well.
  const trustedUI = sender.url === chrome.runtime.getURL('settings.html');
  if (message.type === 'update-info') return updateInfo();
  if (message.type === 'check-updates') return checkUpdate(true);
  if (message.type === 'open-update') {
    const info = await updateInfo();
    const config = await resource('update-config.json');
    const root = `https://github.com/${config.owner}/${config.repository}/releases`;
    const candidate = info.status.downloadURL || info.status.releaseURL || `${root}/latest`;
    const allowed = new Set([`${root}/latest`]);
    if (info.status.latestVersion) {
      QuizUpdates.version(info.status.latestVersion);
      for (const tag of [info.status.latestVersion, `v${info.status.latestVersion}`]) {
        allowed.add(`${root}/tag/${tag}`);
        allowed.add(`${root}/download/${tag}/${config.assetPrefix}${info.status.latestVersion}.zip`);
      }
    }
    if (!allowed.has(candidate)) throw Error('Địa chỉ cập nhật không hợp lệ.');
    const url = new URL(candidate);
    if (url.origin !== 'https://github.com' || url.username || url.password || url.hash || url.search) throw Error('Địa chỉ cập nhật không hợp lệ.');
    await chrome.tabs.create({ url: url.href }); return { ok: true };
  }
  if (message.type === 'cancel') { abortOwner(sender, message.requestId); return { cancelled: true }; }
  if (message.type === 'search') {
    const { q, options } = query(message);
    await writes;
    const [data, config, session] = await Promise.all([load(), settings(), chrome.storage.session.get('credential')]);
    const all = data.search(q, options, 20000);
    const aiAvailable = !!session.credential && session.credential.endpoint === QuizAI.endpoint(config) &&
      (!!config.model || config.provider.endsWith('-cli'));
    return { results: all.slice(0, 3), decision: QuizCore.decide(q, options, all, config), config: {
      autoSelect: config.autoSelect, overwrite: config.overwrite, autoAI: config.autoAI && aiAvailable, aiAutoSelect: config.aiAutoSelect,
      aiTimeout: config.provider.endsWith('-cli') ? 95000 : 28000
    } };
  }
  if (message.type === 'ai') {
    const { q, options } = query(message);
    if (typeof message.requestId !== 'string' || message.requestId.length > 150) throw Error('Thiếu mã yêu cầu.');
    const id = `${owner(sender)}:${message.requestId}`;
    if (tasks.has(id)) throw Error('Yêu cầu AI đang chạy.');
    const controller = new AbortController();
    const task = { owner: owner(sender), requestId: message.requestId, controller };
    tasks.set(id, task);
    let deadline = 25000, timer = setTimeout(() => controller.abort(), deadline), keepAlive;
    try {
      const config = await settings();
      if (config.provider.endsWith('-cli')) {
        deadline = 90000; clearTimeout(timer); timer = setTimeout(() => controller.abort(), deadline);
        keepAlive = setInterval(() => { chrome.runtime.getPlatformInfo().catch(() => {}); }, 10000);
      }
      const secret = (await chrome.storage.session.get('credential')).credential;
      const credential = secret?.endpoint === QuizAI.endpoint(config) ? secret.value : null;
      const permission = config.provider === 'openai' ? 'https://api.openai.com/*' : 'http://127.0.0.1/*';
      if (!await chrome.permissions.contains({ origins: [permission] })) throw Error('Hãy cấp quyền AI trong Cài đặt.');
      if (controller.signal.aborted) throw Error('Đã hủy yêu cầu AI.');
      const kb = await getKnowledge();
      const chunks = QuizAI.retrieve(kb.chunks, kb.index, q, options);
      const decision = await QuizAI.request(config, credential, q, options, chunks, controller.signal);
      if (controller.signal.aborted) throw Error('Đã hủy yêu cầu AI.');
      return { decision };
    } catch (e) {
      if (controller.signal.aborted) throw Error(`AI đã hủy hoặc quá thời gian ${deadline / 1000} giây.`);
      // Never relay remote error bodies or credentials into a page.
      throw Error(e instanceof SyntaxError ? 'AI trả JSON không hợp lệ.' : e.message === 'Failed to fetch' ? 'Không kết nối được AI.' : e.message);
    } finally { clearTimeout(timer); if (keepAlive) clearInterval(keepAlive); tasks.delete(id); }
  }
  if (message.type === 'open-settings') { await chrome.runtime.openOptionsPage(); return { ok: true }; }
  if (message.type === 'open-source') {
    if (typeof message.id !== 'string' || message.id.length > 200) throw Error('Mã nguồn không hợp lệ.');
    const kb = await getKnowledge();
    if (!kb.chunks.some(c => c.id === message.id)) throw Error('Không tìm thấy trang nguồn.');
    await chrome.tabs.create({ url: `${chrome.runtime.getURL('source.html')}?id=${encodeURIComponent(message.id)}` });
    return { ok: true };
  }
  if (!trustedUI) throw Error('Thao tác này chỉ được phép trong trang Cài đặt.');
  if (message.type === 'set-auto-updates') {
    if (typeof message.enabled !== 'boolean') throw Error('Cấu hình cập nhật không hợp lệ.');
    if (message.enabled && !await chrome.permissions.contains({ origins: ['https://api.github.com/*'] })) throw Error('Chưa cấp quyền kiểm tra GitHub.');
    await chrome.storage.local.set({ updatePreferences: { autoCheck: message.enabled } });
    await scheduleUpdates(); return message.enabled ? checkUpdate(true) : updateInfo();
  }
  if (message.type === 'info') {
    await writes;
    const [data, config, manifest, session] = await Promise.all([load(), settings(), resource('data-manifest.json'), chrome.storage.session.get('credential')]);
    return { count: data.bank.length, labelled: data.bank.filter(x => x.answer).length, bundled: data.bundled,
      manifest, settings: config, hasCredential: !!session.credential && session.credential.endpoint === QuizAI.endpoint(config) };
  }
  if (message.type === 'save-settings') {
    const config = sanitizeSettings(message.settings);
    if (typeof message.credential === 'string' && message.credential.trim()) {
      if (message.credential.length > 1000 || /[\r\n]/.test(message.credential)) throw Error('Khóa / token sai định dạng.');
      await chrome.storage.session.set({ credential: { value: message.credential.trim(), endpoint: QuizAI.endpoint(config) } });
    }
    await chrome.storage.local.set({ settings: config });
    return { ok: true };
  }
  if (message.type === 'clear-credential') { await chrome.storage.session.remove('credential'); return { ok: true }; }
  if (['import', 'reset', 'rebuild', 'clear'].includes(message.type)) {
    const mutate = async () => {
      const existing = await load();
      let bank;
      if (message.type === 'reset') bank = QuizCore.validate(await resource('bank.json'));
      else if (message.type === 'clear') bank = [];
      else if (message.type === 'rebuild') bank = existing.bank;
      else {
        const imported = QuizCore.validate(message.data, { source: message.source, verified: message.trust === true });
        bank = message.append === true ? [...existing.bank, ...imported] : imported;
        if (bank.length > 20000) throw Error('Tổng kho vượt quá 20.000 câu.');
      }
      const search = QuizCore.engine(bank);
      const stored = { bank, index: search.index, revision: existing.revision, bundled: message.type === 'reset' || (message.type === 'rebuild' && existing.bundled) };
      await record(stored);
      loaded = Promise.resolve({ ...stored, search });
      return { count: bank.length };
    };
    const result = writes.then(mutate);
    writes = result.catch(() => {});
    return result;
  }
  throw Error('Loại yêu cầu không được hỗ trợ.');
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return false;
  const respond = value => { try { reply(value); } catch { /* The requesting tab may already be closed. */ } };
  (async () => {
    try { respond(await route(message, sender)); }
    catch (e) { respond({ error: e.message || 'Lỗi không xác định.' }); }
  })();
  return true;
});
chrome.runtime.onInstalled.addListener(async () => {
  // Also attach to tabs that were already open when the extension was installed/reloaded.
  try {
    const tabs = await chrome.tabs.query({});
    await Promise.allSettled(tabs.filter(tab => Number.isInteger(tab.id)).map(async tab => {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['bootstrap.js', 'core.js', 'adapter.js', 'content.js'] });
    }));
  } catch { /* Restricted pages and file URLs without access remain managed by Chrome. */ }
  try { await scheduleUpdates(); } catch { /* Storage may be temporarily unavailable during an update. */ }
});
chrome.runtime.onStartup.addListener(async () => { try { await scheduleUpdates(); } catch {} });
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== 'qa-check-updates') return;
  try { if ((await updateInfo()).autoCheck) await checkUpdate(); } catch {}
});
chrome.tabs.onRemoved.addListener(tabId => {
  for (const task of tasks.values()) if (task.owner.startsWith(`${tabId}:`)) task.controller.abort();
});
chrome.action.onClicked.addListener(async tab => {
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['core.js', 'adapter.js', 'content.js'] });
    await chrome.action.setBadgeText({ tabId: tab.id, text: '' });
    await chrome.action.setTitle({ tabId: tab.id, title: 'Mở Quiz Assistant' });
  } catch {
    await chrome.action.setBadgeText({ tabId: tab.id, text: '!' }).catch(() => {});
    await chrome.action.setTitle({ tabId: tab.id, title: 'Không truy cập được trang. Hãy mở trang quiz và nhấn lại.' }).catch(() => {});
  }
});
