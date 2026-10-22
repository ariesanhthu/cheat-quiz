(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let tabId, busy = false, poll;
  async function send(message) { const result = await chrome.runtime.sendMessage(message); if (!result || result.error) throw Error(result?.error || 'Mất kết nối extension.'); return result; }
  const mode = () => document.querySelector('[name=mode]:checked').value;
  function paint() { $('account').hidden = mode() !== 'chatgpt'; $('local').hidden = mode() !== 'tfidf'; }
  async function account() {
    try { const state = await send({ type: 'native-status' });
      $('accountStatus').textContent = state.loggedIn ? `Đã kết nối ChatGPT${state.plan ? ` · ${state.plan}` : ''}` : 'Chưa đăng nhập ChatGPT.';
      $('login').textContent = state.loggedIn ? 'Kết nối lại' : 'Đăng nhập'; $('setup').open = false;
    } catch (error) { $('accountStatus').textContent = error.message; $('setup').open = true; }
  }
  async function task(fn) { if (busy) return; busy = true; document.querySelectorAll('button,input').forEach(el => { el.disabled = true; });
    try { await fn(); } catch (error) { $('status').textContent = error.message; }
    finally { busy = false; document.querySelectorAll('button,input').forEach(el => { el.disabled = false; }); }
  }
  for (const input of document.querySelectorAll('[name=mode]')) input.addEventListener('change', () => task(async () => {
    paint(); await send({ type: 'set-mode', mode: mode() }); $('status').textContent = mode() === 'chatgpt' ? 'AI chạy nền khi kho chưa có đáp án.' : 'Sẵn sàng tra kho trên máy.';
    if (mode() === 'chatgpt') await account();
  }));
  $('login').onclick = () => task(async () => { $('status').textContent = 'Đang mở đăng nhập ChatGPT…'; await send({ type: 'native-login' }); $('status').textContent = 'Hoàn tất đăng nhập, rồi mở lại popup để Chạy.'; });
  $('test').onclick = () => task(async () => { $('status').textContent = 'Đang hỏi thử ChatGPT ở nền…'; const result = await send({ type: 'native-test' }); $('status').textContent = result.message; await account(); });
  async function pageCommand(action, data = {}) {
    if (!Number.isInteger(tabId)) throw Error('Mở trang quiz rồi bấm lại icon.');
    try { return await chrome.tabs.sendMessage(tabId, { type: 'page-command', action, ...data }); }
    catch { throw Error('Tải lại tab quiz. Với file HTML, bật Allow access to file URLs trong Details extension.'); }
  }
  $('run').onclick = () => task(async () => {
    await send({ type: 'set-mode', mode: mode() });
    if (mode() === 'chatgpt') { const state = await send({ type: 'native-status' }); if (!state.loggedIn) throw Error('Bấm Đăng nhập ChatGPT trước khi chạy.'); }
    const result = await pageCommand('run'); if (result?.error) throw Error(result.error); $('status').textContent = 'Đang chạy nền. Kết quả hiện dưới câu hỏi.';
    clearInterval(poll); poll = setInterval(async () => { try { const state = await pageCommand('status'); $('status').textContent = state.status; } catch {} }, 700);
  });
  $('cancel').onclick = () => task(async () => { await pageCommand('cancel'); clearInterval(poll); $('status').textContent = 'Đã dừng.'; });
  $('factCheck').onchange = () => task(async () => {
    const enabled = $('factCheck').checked;
    await chrome.storage.local.set({ factCheckEnabled: enabled }); await pageCommand('fact-check', { enabled });
    $('status').textContent = enabled ? 'Đã mở đối chiếu bên phải.' : 'Đã ẩn đối chiếu. Tool vẫn chạy nền.';
  });
  window.addEventListener('pagehide', () => clearInterval(poll));
  task(async () => {
    $('version').textContent = `v${chrome.runtime.getManifest().version}`; $('extensionId').textContent = chrome.runtime.id;
    const [info, tabs] = await Promise.all([send({ type: 'info' }), chrome.tabs.query({ active: true, currentWindow: true })]); tabId = tabs[0]?.id;
    document.querySelector(`[name=mode][value=${info.settings.provider === 'chatgpt-native' && info.settings.autoAI ? 'chatgpt' : 'tfidf'}]`).checked = true;
    paint(); $('status').textContent = 'Sẵn sàng.'; if (mode() === 'chatgpt') await account();
    $('factCheck').checked = (await chrome.storage.local.get('factCheckEnabled')).factCheckEnabled === true;
  });
})();
