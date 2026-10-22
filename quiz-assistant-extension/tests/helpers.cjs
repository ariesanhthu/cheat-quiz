const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const C = require('../core.js');
const base = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(base, name), 'utf8');
const delay = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, timeout = 2000) {
  const start = Date.now();
  while (!fn()) { if (Date.now() - start > timeout) throw Error('Timed out waiting for condition'); await delay(5); }
}
const q = 'Which statement is NOT correct in 1930?';
const options = ['Yes', 'No'];
const item = { q, options, answer: 1, verified: true, source: 'fixture' };
function fixture({ id = 'q1', question = q, values = options, name = id, extra = '' } = {}) {
  return `<div class="que multichoice" id="${id}"><div class="content"><div class="formulation"><div class="qtext">${question}</div><fieldset><legend>Answer</legend><div class="answer">${values.map((o, i) => `<div class="r${i % 2}"><input type="radio" name="${name}" value="${i}" id="${id}_${i}" aria-labelledby="${id}_${i}_label"><div id="${id}_${i}_label" data-region="answer-label"><span class="answernumber">${String.fromCharCode(97 + i)}. </span><div class="flex-fill">${o}</div></div></div>`).join('')}</div><input type="radio" name="${name}" value="-1" checked hidden></fieldset>${extra}</div></div></div>`;
}
function page({ html = fixture(), responder, config = {} } = {}) {
  const dom = new JSDOM(`<!doctype html><body><form id="responseform">${html}<button id="next" type="submit">Next page</button><button id="finish" type="submit">Finish attempt</button></form>`, { url: 'https://example.test/quiz', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, requests = [], errors = [];
  const search = C.engine(C.validate([item]));
  let submits = 0, navigations = 0;
  w.document.querySelector('form').addEventListener('submit', e => { submits++; e.preventDefault(); });
  for (const id of ['next', 'finish']) w.document.getElementById(id).addEventListener('click', () => { navigations++; });
  w.addEventListener('error', e => errors.push(e.error));
  w.chrome = { runtime: { getURL: p => `chrome-extension://test/${p}`, sendMessage: async m => {
    requests.push(m);
    if (responder) { const result = await responder(m); if (result !== undefined) return result; }
    if (m.type === 'search') { const results = search(m.q, m.options, 20000); return { results: results.slice(0, 3), decision: C.decide(m.q, m.options, results), config: { autoSelect: true, ...config } }; }
    return { ok: true };
  } }, storage: { local: { get: async () => ({}), set: async () => {} } } };
  for (const name of ['core.js', 'adapter.js', 'content.js']) w.eval(source(name));
  const host = () => w.document.querySelector('[data-quiz-assistant="control"]');
  const button = action => host().shadowRoot.querySelector(`[data-action="${action}"]`);
  const status = () => host()?.shadowRoot.querySelector('[role="status"]').textContent;
  return { w, dom, requests, errors, host, button, status, get submits() { return submits; }, get navigations() { return navigations; }, close() { w.__quizAssistant?.destroy(); dom.window.close(); } };
}
function area(initial = {}) {
  const data = structuredClone(initial);
  return { data, get: async key => key == null ? structuredClone(data) : { [key]: structuredClone(data[key]) },
    set: async value => Object.assign(data, structuredClone(value)), remove: async key => { delete data[key]; } };
}
function environment() { return { local: area(), session: area(), resources: [], network: [], permissions: true }; }
function worker(env = environment(), customFetch) {
  const listeners = {}, id = 'a'.repeat(32), settingsURL = `chrome-extension://${id}/settings.html`;
  const chrome = { runtime: { id, getManifest: () => ({ version: '1.1.0' }), getURL: p => `chrome-extension://${id}/${p}`, getPlatformInfo: async () => ({}), openOptionsPage: async () => {}, onStartup: { addListener: fn => { listeners.startup = fn; } }, onInstalled: { addListener: fn => { listeners.installed = fn; } }, onMessage: { addListener: fn => { listeners.message = fn; } } },
    alarms: { create: async (name, info) => { env.alarm = { name, ...info }; }, clear: async () => { env.alarm = null; }, onAlarm: { addListener: fn => { listeners.alarm = fn; } } },
    storage: { local: env.local, session: env.session }, permissions: { contains: async () => env.permissions },
    tabs: { query: async () => [], onRemoved: { addListener: fn => { listeners.removed = fn; } }, create: async value => { env.opened = value; } },
    action: { onClicked: { addListener: fn => { listeners.action = fn; } }, setBadgeText: async () => {}, setTitle: async () => {} }, scripting: { executeScript: async () => {} } };
  let context;
  const sandbox = { chrome, setInterval, clearInterval, AbortSignal, crypto: require('node:crypto').webcrypto, setTimeout: (fn, ms) => setTimeout(fn, ms === 25000 && env.aiTimeout ? env.aiTimeout : ms), clearTimeout, URL, AbortController, DOMException, console,
    fetch: async (url, init) => {
      if (String(url).startsWith(`chrome-extension://${id}/`)) {
        const name = String(url).slice(`chrome-extension://${id}/`.length); env.resources.push(name);
        return new Response(source(name), { status: 200 });
      }
      env.network.push({ url, init });
      if (!customFetch) throw Error('No network allowed');
      return customFetch(url, init);
    }, importScripts: (...files) => files.forEach(file => vm.runInContext(source(file), context, { filename: file })) };
  context = vm.createContext(sandbox); vm.runInContext(source('background.js'), context, { filename: 'background.js' });
  const ui = { id, url: settingsURL };
  const tab = (tabId = 1) => ({ id, frameId: 0, tab: { id: tabId, url: 'https://example.test/quiz' }, url: 'https://example.test/quiz' });
  function send(message, sender = tab()) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Worker did not reply')), 3000);
      const accepted = listeners.message(message, sender, response => { clearTimeout(timer); resolve(response); });
      if (accepted === false) { clearTimeout(timer); resolve(undefined); }
    });
  }
  return { env, context, listeners, send, ui, tab };
}
module.exports = { C, source, delay, until, q, options, item, fixture, page, area, environment, worker };
