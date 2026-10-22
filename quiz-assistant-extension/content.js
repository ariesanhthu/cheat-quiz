(() => {
  'use strict';
  const passive = globalThis.__quizAssistantPassive === true;
  delete globalThis.__quizAssistantPassive;
  if (globalThis.__quizAssistant) { if (!passive) globalThis.__quizAssistant.toggle(); return; }
  const C = QuizCore, A = QuizAdapter;
  let dead = false, running = false, paused = false, armed = false, epoch = 0, applying = false;
  let selectionGeneration = 0, requestSequence = 0, locationKey = location.href, observerTimer, selectionTimer, pointerDown = false;
  let counts = { done: 0, total: 0, applied: 0, review: 0, errors: 0 };
  const processed = new WeakMap(), revisions = new WeakMap(), operations = new WeakMap(), activeQuestions = new WeakSet(), resultsHosts = new Set(), pending = new Map();
  const host = document.createElement('div'); host.dataset.quizAssistant = 'control';
  const root = host.attachShadow({ mode: 'open' }); document.documentElement.append(host);
  const style = document.createElement('style');
  style.textContent = ':host{all:initial;position:fixed;right:4px;top:8px;width:40px;height:40px;z-index:2147483647;font:13px/1.45 Arial,sans-serif;color:#172033;pointer-events:none}*{box-sizing:border-box}section{position:fixed;inset:auto;right:8px;top:56px;margin:0;background:#fff;color:#172033;border:1px solid #c8d4e5;border-radius:12px;padding:14px;width:360px;max-width:calc(100vw - 16px);max-height:calc(100dvh - 72px);overflow:auto;overscroll-behavior:contain;box-shadow:0 8px 32px #10213c2b;pointer-events:auto}section::backdrop{background:transparent;pointer-events:none}header{font-weight:700;font-size:15px;cursor:move;touch-action:none;padding:2px 0 8px;border-bottom:1px solid #e4eaf2}button{font:inherit;margin:3px;padding:7px 9px;cursor:pointer;border:1px solid #cbd5e1;border-radius:7px;background:#f8fafc;color:#172033}button:focus-visible{outline:3px solid #8bb4ff;outline-offset:2px}button:disabled{opacity:.5;cursor:default}button[data-action=run]{background:#235fc4;color:#fff;border-color:#235fc4}button[data-action=toggle]{position:relative;width:36px;height:36px;padding:0;margin:0;pointer-events:auto;border:1px solid #fff9;border-radius:11px;background:#235fc4;color:#fff;font:bold 20px Arial;box-shadow:0 2px 8px #10213c40}button[data-action=toggle]::after{content:"";position:absolute;right:3px;bottom:3px;width:6px;height:6px;border:1px solid #fff;border-radius:50%;background:#a8c9ff}button[data-action=toggle][aria-expanded=true]::after{background:#40d5a1}p{white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0}small{font-size:11px;color:#53657d}article{border-top:1px solid #e1e8f1;padding-top:7px;margin-top:8px;font-size:12px}[hidden]{display:none!important}';
  root.append(style);
  const box = document.createElement('section'); root.append(box);
  box.id = 'qa-assistant-panel'; box.setAttribute('aria-label', 'Quiz Assistant'); box.setAttribute('role', 'dialog');
  const nativePopover = 'popover' in HTMLElement.prototype && typeof box.showPopover === 'function';
  if (nativePopover) box.setAttribute('popover', 'manual'); else box.hidden = true;
  const launcher = document.createElement('button'); launcher.type = 'button'; launcher.textContent = 'Q'; launcher.dataset.action = 'toggle';
  launcher.title = 'Quiz Assistant · bật / tắt'; launcher.setAttribute('aria-label', 'Bật / tắt Quiz Assistant');
  launcher.setAttribute('aria-controls', box.id); launcher.setAttribute('aria-expanded', 'false'); root.insertBefore(launcher, box);
  function isPanelOpen() { return nativePopover ? box.matches(':popover-open') : !box.hidden; }
  function showPanel() {
    if (dead || isPanelOpen()) return;
    if (nativePopover) box.showPopover(); else box.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    refreshVersion();
  }
  function closePanel() {
    cancel('Đã tắt bảng · bôi đen để tra cứu lại');
    if (nativePopover && isPanelOpen()) box.hidePopover(); else if (!nativePopover) box.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
  }
  function togglePanel() { if (isPanelOpen()) closePanel(); else showPanel(); }
  if (nativePopover && 'commandForElement' in HTMLButtonElement.prototype) {
    launcher.setAttribute('commandfor', box.id); launcher.setAttribute('command', 'toggle-popover');
    // Native command events do not bubble; listen on the target, not the document.
    box.addEventListener('command', event => { if (event.command === 'toggle-popover' && isPanelOpen()) cancel('Đã tắt bảng'); });
  } else launcher.addEventListener('click', togglePanel);
  if (nativePopover) box.addEventListener('toggle', () => {
    launcher.setAttribute('aria-expanded', String(isPanelOpen()));
    if (isPanelOpen()) refreshVersion();
  });
  const header = document.createElement('header'); header.textContent = 'Quiz Assistant'; box.append(header);
  const status = document.createElement('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); box.append(status);
  const actions = document.createElement('div'); box.append(actions);
  function button(parent, text, action, fn) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.dataset.action = action;
    b.addEventListener('click', async () => { try { await fn(); } catch (error) { status.textContent = error.message; } });
    parent.append(b); return b;
  }
  const manual = document.createElement('div'); box.append(manual);
  function progress(label) {
    status.textContent = `${label}: ${counts.done}/${counts.total} · đã chọn ${counts.applied} · cần kiểm tra ${counts.review} · lỗi ${counts.errors}`;
  }
  async function send(message, timeout = 15000) {
    let timer;
    try {
      const response = await Promise.race([chrome.runtime.sendMessage(message), new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('Hết thời gian chờ extension. Hãy thử lại.')), timeout);
      })]);
      if (!response || response.error) throw Error(response?.error || 'Mất kết nối extension. Hãy tải lại trang.');
      return response;
    } catch (error) {
      if (/context invalidated|receiving end|message port|message channel/i.test(error.message)) throw Error('Extension vừa khởi động lại. Hãy tải lại trang rồi mở tiện ích.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  function cancel(label = 'Đã hủy') {
    epoch++; armed = false; paused = false; selectionGeneration++;
    for (const finish of pending.values()) finish();
    pending.clear();
    try { Promise.resolve(chrome.runtime.sendMessage({ type: 'cancel' })).catch(() => {}); }
    catch { /* Extension reload can invalidate this context synchronously. */ }
    status.textContent = label;
  }
  const alive = token => !dead && token === epoch && location.href === locationKey;
  async function ready(token) {
    while (paused && alive(token)) await new Promise(resolve => setTimeout(resolve, 50));
    return alive(token);
  }
  function operation(x, token) {
    const id = ++requestSequence; operations.set(x.el, id);
    const revision = revisions.get(x.el) || 0;
    return () => alive(token) && operations.get(x.el) === id && (revisions.get(x.el) || 0) === revision && !!A.current(x);
  }
  async function askAI(x, token, timeout) {
    const requestId = `${Date.now()}-${++requestSequence}`;
    let finish;
    const cancelled = new Promise(resolve => { finish = () => resolve(null); });
    pending.set(requestId, finish);
    try {
      const response = await Promise.race([send({ type: 'ai', q: x.q, options: x.options, requestId }, timeout || 28000), cancelled]);
      return alive(token) ? response?.decision : null;
    } finally { pending.delete(requestId); }
  }
  async function cancellable(promise) {
    const id = `local-${++requestSequence}`;
    let cancelPending;
    const cancelled = new Promise((_, reject) => { cancelPending = () => reject(Error('Đã hủy tra cứu.')); });
    pending.set(id, cancelPending);
    try { return await Promise.race([promise, cancelled]); }
    finally { pending.delete(id); }
  }
  function resultHost(x) {
    // Keep results inside the question's block column. A Moodle .que can be a flex row.
    const mount = x.el.querySelector('.formulation') || x.el;
    let h = [...resultsHosts].find(n => n.parentElement === mount);
    if (!h) h = [...mount.children].find(n => n.matches('.qa-assistant-result[data-quiz-assistant="result"]'));
    if (!h) {
      h = document.createElement('div'); h.className = 'qa-assistant-result'; h.dataset.quizAssistant = 'result';
      mount.append(h);
    }
    if (!h.shadowRoot) h.attachShadow({ mode: 'open' });
    resultsHosts.add(h);
    h.dataset.qaQuestionKey = x.key;
    return h;
  }
  function paragraph(parent, value, tag = 'p') {
    const p = document.createElement(tag); p.textContent = value; parent.append(p); return p;
  }
  function candidates(parent, results, use) {
    for (const [i, r] of results.slice(0, 3).entries()) {
      const article = document.createElement('article'); parent.append(article);
      paragraph(article, `${i + 1}. ${r.item.q}`);
      paragraph(article, `Đáp án: ${r.item.answer ? C.optionText(r.item.answer) : 'Chưa có trong kho'}`);
      paragraph(article, `${r.item.source} · tương đồng văn bản ${(r.score * 100).toFixed(1)}% (không phải xác suất đúng)`, 'small');
      const details = document.createElement('details'); article.append(details);
      details.open = true;
      paragraph(details, 'Các phương án trong kho', 'summary');
      for (const option of r.item.options) paragraph(details, `${C.optionNorm(option) === C.optionNorm(r.item.answer) ? '✓ ' : '• '}${C.optionText(option)}`);
      if (use && r.item.answer) button(article, 'Dùng đáp án này', 'use-answer', () => use(r));
    }
  }
  function useCandidate(x, candidate) {
    const matches = x.options.map((o, i) => C.optionNorm(o) === C.optionNorm(candidate.item.answer) ? i : -1).filter(i => i >= 0);
    const applied = matches.length === 1 && A.apply(x, { status: 'matched', index: matches[0], answer: candidate.item.answer }, { overwrite: false });
    status.textContent = applied ? 'Đã chọn đáp án được yêu cầu.' : 'Không chọn được: câu đã đổi, đã có lựa chọn hoặc đáp án không khớp duy nhất.';
  }
  function render(x, results, decision, applied, note) {
    if (!A.current(x)) return;
    const h = resultHost(x), r = h.shadowRoot; r.replaceChildren();
    const css = document.createElement('style');
    css.textContent = ':host{display:block;margin:6px 0;font:12px/1.45 Arial,sans-serif;color:#23334b}section{background:#f0f5ff;border-left:3px solid #5485db;padding:7px 10px}p{margin:3px 0;white-space:pre-wrap;overflow-wrap:anywhere}small{font-size:11px}article{margin-top:7px;border-top:1px solid #d3deee;padding-top:4px}button{font:12px Arial;margin:4px;padding:4px 7px;background:#fff;color:#234;border:1px solid #bbc;border-radius:4px;cursor:pointer}a{color:#175bb1}'; r.append(css);
    const section = document.createElement('section'); r.append(section);
    paragraph(section, `Gợi ý: ${decision.answer ? C.optionText(decision.answer) : 'Chưa tìm thấy đáp án'}`);
    paragraph(section, applied ? 'Đã tự chọn phương án bên trên.' : note || (decision.status === 'matched' ? 'Có đáp án khớp; giữ lựa chọn hiện tại hoặc tự chọn đang tắt.' : 'Cần kiểm tra.'));
    paragraph(section, decision.reason || '');
    if (decision.explanation) paragraph(section, `AI: ${decision.explanation}`);
    for (const e of decision.evidence || []) {
      paragraph(section, `“${e.quote}”`);
      button(section, `Xem nguồn: ${e.title}`, 'source', () => send({ type: 'open-source', id: e.id }));
    }
    candidates(section, results, candidate => useCandidate(x, candidate));
    button(section, 'Kiểm tra lại', 'retry', () => processQuestion(A.scan(x.el), epoch, false));
    button(section, 'Hỏi AI + giáo trình', 'ask-ai', () => processQuestion(A.scan(x.el), epoch, true));
  }
  async function processQuestion(x, token, forceAI = false) {
    if (activeQuestions.has(x.el)) return;
    activeQuestions.add(x.el);
    try { return await executeQuestion(x, token, forceAI); }
    finally { activeQuestions.delete(x.el); }
  }
  async function executeQuestion(x, token, forceAI) {
    if (!await ready(token)) return;
    const valid = operation(x, token);
    if (x.unsupported) {
      render(x, [], { status: 'unsupported', reason: 'Chỉ hỗ trợ câu chọn một phương án có nhãn văn bản đầy đủ; hình ảnh và checkbox cần kiểm tra.' }, false);
      return { review: true };
    }
    const response = await cancellable(send({ type: 'search', q: x.q, options: x.options }));
    if (!await ready(token) || !valid()) return { review: true };
    let decision = response.decision;
    const config = response.config || {};
    if (!decision) throw Error('Extension trả kết quả không hợp lệ.');
    let aiError;
    if (forceAI || (decision.status !== 'matched' && config.autoAI)) {
      render(x, response.results, decision, false, 'Đang hỏi AI với ngữ cảnh giáo trình…');
      try {
        const suggested = await askAI(x, token, config.aiTimeout);
        if (!await ready(token) || !valid()) return { review: true };
        if (suggested) decision = suggested;
      } catch (e) { aiError = e.message; }
    }
    if (!await ready(token) || !valid()) return { review: true };
    applying = true;
    let applied;
    try { applied = config.autoSelect !== false && A.apply(x, decision, { overwrite: config.overwrite === true, allowAI: config.aiAutoSelect === true }); }
    finally { applying = false; }
    const alreadySelected = decision.status === 'matched' && x.inputs[decision.index]?.checked;
    render(x, response.results, decision, applied, aiError ? `AI lỗi: ${aiError}. Giữ gợi ý từ kho.` :
      alreadySelected && !applied ? 'Phương án khớp đã được chọn từ trước.' : undefined);
    return { applied, review: !applied && !alreadySelected, error: !!aiError };
  }
  async function run(fresh = true) {
    if (running || dead) return;
    if (fresh) showPanel();
    if (location.href !== locationKey) { cancel('Trang đã đổi.'); locationKey = location.href; }
    if (fresh) { epoch++; armed = true; paused = false; counts = { done: 0, total: 0, applied: 0, review: 0, errors: 0 }; }
    const token = epoch; running = true;
    try {
      const questions = A.questions().filter(x => fresh || processed.get(x.el) !== x.signature);
      counts.total += questions.length;
      for (const x of questions) {
        if (!await ready(token)) break;
        progress('Đang xử lý');
        try {
          const result = await processQuestion(x, token);
          if (!alive(token)) break;
          if (result) {
            counts.done++; counts.applied += Number(!!result.applied); counts.review += Number(!!result.review); counts.errors += Number(!!result.error);
            processed.set(x.el, x.signature);
          }
        } catch (e) {
          if (!alive(token)) break;
          counts.done++; counts.errors++;
          render(x, [], { status: 'error', reason: `Lỗi: ${e.message}` }, false);
          processed.set(x.el, x.signature);
        }
      }
      if (alive(token)) progress('Hoàn thành · đang theo dõi câu mới');
    } catch (e) { if (alive(token)) status.textContent = `Lỗi: ${e.message}`; }
    finally {
      running = false;
      if (armed && alive(token) && A.questions().some(x => processed.get(x.el) !== x.signature)) scheduleScan();
    }
  }
  button(actions, 'Chạy trên trang', 'run', () => run());
  const pauseButton = button(actions, 'Tạm dừng', 'pause', () => {
    if (!armed && !running) return;
    paused = !paused; pauseButton.textContent = paused ? 'Tiếp tục' : 'Tạm dừng';
    progress(paused ? 'Tạm dừng' : 'Đang xử lý');
    if (!paused) scheduleScan();
  });
  button(actions, 'Hủy', 'cancel', () => cancel());
  button(actions, 'Cài đặt', 'settings', () => send({ type: 'open-settings' }));
  button(box, 'Đóng bảng', 'close', closePanel);
  const versionButton = button(box, 'Phiên bản · cập nhật', 'updates', () => send({ type: 'open-settings' }));
  async function refreshVersion() {
    try {
      const info = await send({ type: 'update-info' });
      if (dead || !info.currentVersion) return;
      versionButton.textContent = `v${info.currentVersion}${info.status?.available ? ` · Có bản v${info.status.latestVersion}` : ' · Cập nhật'}`;
    } catch { /* Offline update metadata must never block local lookup. */ }
  }
  function selectionSnapshot() {
    const selected = window.getSelection();
    const q = selected?.toString().trim();
    if (!q || q.length < 3 || q.length > 20000 || !selected.rangeCount) return null;
    const range = selected.getRangeAt(0).cloneRange(), node = range.commonAncestorContainer;
    const element = node.nodeType === 1 ? node : node.parentElement;
    if (!element?.isConnected || element.closest('[data-quiz-assistant],input,textarea,[contenteditable="true"]')) return null;
    const question = element?.closest('.que') || element?.closest('fieldset');
    const x = question ? A.scan(question) : null;
    return { q, range, x };
  }
  async function selection(snapshot) {
    const { q, range, x } = snapshot;
    const generation = ++selectionGeneration;
    showPanel(); manual.replaceChildren(); paragraph(manual, 'Đang tra cứu vùng bôi đen…');
    try {
      const response = await cancellable(send({ type: 'search', q: x?.q || q, options: x?.options || [] }));
      if (dead || generation !== selectionGeneration || location.href !== locationKey) return;
      manual.replaceChildren();
      if (!response.results.length) paragraph(manual, 'Chưa có kết quả phù hợp trong kho.');
      candidates(manual, response.results, x ? r => useCandidate(x, r) : null);
      button(manual, 'Sao chép đáp án', 'copy', async () => {
        try { await navigator.clipboard.writeText(response.results[0]?.item.answer || ''); }
        catch { status.textContent = 'Trình duyệt không cho phép sao chép. Bạn có thể chọn và sao chép văn bản.'; }
      });
      if (x) button(manual, 'Hỏi AI + giáo trình', 'manual-ai', () => processQuestion(x, epoch, true));
      button(manual, 'Đóng gợi ý', 'close-manual', () => { selectionGeneration++; manual.replaceChildren(); });
      const rect = range.getBoundingClientRect?.();
      if (rect?.height) {
        const width = box.getBoundingClientRect().width || 360, height = Math.min(box.getBoundingClientRect().height || 360, innerHeight - 24);
        box.style.left = `${Math.max(8, Math.min(rect.right + 8, innerWidth - width - 8))}px`;
        box.style.top = `${Math.max(8, Math.min(rect.bottom + 8, innerHeight - height - 8))}px`; box.style.right = 'auto';
      }
    } catch (e) { if (!dead && generation === selectionGeneration) status.textContent = e.message; }
  }
  function onSelection(event) {
    pointerDown = false;
    if (event.composedPath().includes(host)) return;
    const snapshot = selectionSnapshot();
    if (!snapshot) return;
    // Snapshot before another extension's bubble listener can clear or replace Selection.
    clearTimeout(selectionTimer); selectionTimer = setTimeout(() => selection(snapshot), 140);
  }
  function onPointerDown(event) { if (!event.composedPath().includes(host)) { pointerDown = true; clearTimeout(selectionTimer); selectionGeneration++; } }
  function onSelectionChange(event) { if (!pointerDown) onSelection(event); }
  function onKeyDown(event) { if (event.key === 'Escape' && isPanelOpen()) { closePanel(); launcher.focus({ preventScroll: true }); } }
  function onChange(event) {
    if (applying || !event.target.matches?.('input[type="radio"],input[type="checkbox"]')) return;
    const el = event.target.closest('.que') || event.target.closest('fieldset');
    if (el) revisions.set(el, (revisions.get(el) || 0) + 1);
  }
  function scheduleScan() {
    clearTimeout(observerTimer);
    observerTimer = setTimeout(() => { if (armed && !paused && !running && !dead) run(false); }, 150);
  }
  const observer = new MutationObserver(mutations => {
    for (const h of resultsHosts) if (!h.isConnected) resultsHosts.delete(h);
    if (!armed) return;
    const external = mutations.some(m => !m.target.closest?.('[data-quiz-assistant]') &&
      (m.type !== 'childList' || [...m.addedNodes, ...m.removedNodes].some(n => n.nodeType !== 1 || !n.matches?.('[data-quiz-assistant]'))));
    if (external) scheduleScan();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['value', 'name', 'aria-labelledby', 'disabled'] });
  const onNavigation = () => { cancel('Trang đã đổi · nhấn Chạy để xử lý trang hiện tại'); locationKey = location.href; };
  const navigationTimer = setInterval(() => { if (location.href !== locationKey) onNavigation(); }, 500);
  window.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('mouseup', onSelection, true); window.addEventListener('pointerup', onSelection, true);
  window.addEventListener('keyup', onSelection, true); window.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('selectionchange', onSelectionChange);
  document.addEventListener('change', onChange, true);
  window.addEventListener('pagehide', onNavigation); window.addEventListener('popstate', onNavigation); window.addEventListener('hashchange', onNavigation);
  let drag;
  header.addEventListener('pointerdown', e => {
    const rect = box.getBoundingClientRect(); drag = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    header.setPointerCapture?.(e.pointerId);
  });
  header.addEventListener('pointermove', e => {
    if (!drag) return;
    box.style.left = `${Math.max(0, Math.min(innerWidth - 80, e.clientX - drag.x))}px`;
    box.style.top = `${Math.max(0, Math.min(innerHeight - 60, e.clientY - drag.y))}px`; box.style.right = 'auto';
  });
  header.addEventListener('pointerup', () => {
    if (!drag) return; drag = null;
    (async () => { try { await chrome.storage.local.set({ controlPosition: { left: box.style.left, top: box.style.top } }); } catch {} })();
  });
  (async () => { try { const { controlPosition: p } = await chrome.storage.local.get('controlPosition');
    if (dead || !p || !/^\d+(?:\.\d+)?px$/.test(p.left) || !/^\d+(?:\.\d+)?px$/.test(p.top)) return;
    box.style.left = `${Math.min(parseFloat(p.left), Math.max(0, innerWidth - 80))}px`;
    box.style.top = `${Math.min(parseFloat(p.top), Math.max(0, innerHeight - 60))}px`; box.style.right = 'auto';
  } catch {} })();
  globalThis.__quizAssistant = {
    show: showPanel,
    toggle: togglePanel,
    destroy() {
      cancel(); dead = true; observer.disconnect(); clearInterval(navigationTimer); clearTimeout(observerTimer); clearTimeout(selectionTimer);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('mouseup', onSelection, true); window.removeEventListener('pointerup', onSelection, true);
      window.removeEventListener('keyup', onSelection, true); window.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('selectionchange', onSelectionChange); document.removeEventListener('change', onChange, true);
      window.removeEventListener('pagehide', onNavigation); window.removeEventListener('popstate', onNavigation); window.removeEventListener('hashchange', onNavigation);
      host.remove(); for (const h of resultsHosts) h.remove(); resultsHosts.clear(); delete globalThis.__quizAssistant;
    }
  };
  status.textContent = 'Bôi đen câu hỏi để tra cứu, hoặc chạy trên trang.';
})();
