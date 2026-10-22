(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const booleans = ['autoSelect', 'overwrite', 'autoAI', 'aiAutoSelect'];
  const values = ['threshold', 'margin', 'provider', 'model', 'endpoint'];
  const status = $('status'); let busy = false;
  async function send(message) {
    const response = await chrome.runtime.sendMessage(message);
    if (!response || response.error) throw Error(response?.error || 'Mất kết nối extension.');
    return response;
  }
  async function refresh(fill = false) {
    const info = await send({ type: 'info' });
    $('inventory').textContent = `${info.count} câu · ${info.labelled} có đáp án · ${info.manifest.pages} trang giáo trình / ${info.manifest.chunks} đoạn retrieve. ${info.bundled ? 'Đang dùng 5 bộ quiz đi kèm.' : 'Đang dùng kho tùy chỉnh.'}`;
    $('credentialStatus').textContent = info.hasCredential ? 'Đã có khóa / token trong phiên hiện tại.' : 'Chưa có khóa / token phiên.';
    if (fill) {
      for (const k of booleans) $(k).checked = info.settings[k];
      for (const k of values) $(k).value = info.settings[k];
    }
  }
  function showUpdate(info) {
    const update = info.status || {};
    $('autoUpdates').checked = info.autoCheck === true;
    $('updateStatus').textContent = `Đang dùng v${info.currentVersion}. ` + (info.requiresPermission ? 'Cấp quyền GitHub để kiểm tra bản mới.' :
      update.error || (update.unpublished ? 'Repository chưa có Release ổn định.' : update.available ? `Có bản mới v${update.latestVersion}.` :
        update.checkedAt ? 'Bạn đang dùng bản mới nhất.' : 'Chưa kiểm tra GitHub.'));
  }
  $('checkUpdates').onclick = async () => {
    try {
      // Permission request stays in this direct extension-page user gesture.
      const granted = await chrome.permissions.request({ origins: ['https://api.github.com/*'] });
      if (!granted) { $('updateStatus').textContent = 'Chưa cấp quyền. Tiện ích vẫn dùng bình thường.'; return; }
      await task(async () => { showUpdate(await send({ type: 'check-updates' })); status.textContent = 'Đã kiểm tra phiên bản.'; });
    } catch (error) { status.textContent = error.message; }
  };
  $('autoUpdates').onchange = async () => {
    const enabled = $('autoUpdates').checked;
    try {
      if (enabled && !await chrome.permissions.request({ origins: ['https://api.github.com/*'] })) { $('autoUpdates').checked = false; return; }
      showUpdate(await send({ type: 'set-auto-updates', enabled }));
    } catch (error) { $('autoUpdates').checked = false; status.textContent = error.message; }
  };
  $('downloadUpdate').onclick = () => task(async () => { await send({ type: 'open-update' }); status.textContent = 'Đã mở bản phát hành GitHub.'; });
  async function task(fn) {
    if (busy) return;
    busy = true; document.querySelectorAll('button').forEach(b => { b.disabled = true; });
    status.textContent = 'Đang xử lý…';
    try { await fn(); }
    catch (error) { status.textContent = `Lỗi: ${error.message}`; }
    finally { busy = false; document.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
  }
  $('import').onclick = () => task(async () => {
    const file = $('file').files[0];
    if (!file) throw Error('Hãy chọn file.');
    if (file.size > 10000000) throw Error('File tối đa 10 MB.');
    const text = (await file.text()).replace(/^\uFEFF/, '');
    const data = file.name.toLowerCase().endsWith('.csv') ? QuizCore.parseCSV(text) : JSON.parse(text);
    QuizCore.validate(data);
    const result = await send({ type: 'import', data, source: file.name, append: $('append').checked, trust: $('trust').checked });
    await refresh(); status.textContent = `Đã nhập. Tổng kho: ${result.count} câu.`;
  });
  for (const type of ['reset', 'clear', 'rebuild']) $(type).onclick = () => task(async () => {
    const result = await send({ type }); await refresh(); status.textContent = `Đã cập nhật kho: ${result.count} câu.`;
  });
  $('settings').onsubmit = event => {
    event.preventDefault();
    task(async () => {
      const settings = Object.fromEntries([...booleans.map(k => [k, $(k).checked]), ...values.map(k => [k, $(k).value.trim()])]);
      settings.threshold = Number(settings.threshold); settings.margin = Number(settings.margin);
      await send({ type: 'save-settings', settings, credential: $('credential').value });
      $('credential').value = ''; await refresh(); status.textContent = 'Đã lưu cài đặt.';
    });
  };
  $('grant').onclick = () => {
    // Called directly during a user gesture; permissions.request cannot follow an await.
    const origin = $('provider').value === 'openai' ? 'https://api.openai.com/*' : 'http://127.0.0.1/*';
    (async () => { try { const granted = await chrome.permissions.request({ origins: [origin] });
      status.textContent = granted ? 'Đã cấp quyền kết nối AI.' : 'Quyền chưa được cấp. TF-IDF vẫn dùng được.';
    } catch (e) { status.textContent = `Lỗi quyền: ${e.message}`; } })();
  };
  $('clearCredential').onclick = () => task(async () => { await send({ type: 'clear-credential' }); await refresh(); status.textContent = 'Đã quên khóa / token phiên.'; });
  task(async () => { await refresh(true); showUpdate(await send({ type: 'update-info' })); status.textContent = 'Sẵn sàng.'; });
})();
