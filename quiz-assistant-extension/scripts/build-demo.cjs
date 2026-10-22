/* Keep the supplied Moodle DOM/theme. Change only quiz text, local assets and navigation. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { JSDOM } = require('jsdom');
const C = require('../core.js');
const base = path.resolve(__dirname, '..'), workspace = path.resolve(base, '..');
const assets = path.join(workspace, 'page-assets');
const sourcePath = path.join(base, 'tests/fixtures/moodle-original.html');
const source = fs.readFileSync(sourcePath, 'utf8');
const bank = require('../bank.json');
const items = [bank.find(x => x.id === 'quiz.json:0') || bank[0], bank.find(x => x.id === 'quiz.json:5'), bank.find(x => x.id === 'quiz.json:11')];
const pages = ['page.html', 'page-2.html', 'page-3.html'];
const origin = 'https://courses.ctda.hcmus.edu.vn';
fs.mkdirSync(assets, { recursive: true });
const manifestPath = path.join(assets, 'assets.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
const pending = new Map();
async function cache(rawURL, name) {
  const url = new URL(rawURL, origin); const fragment = url.hash; url.hash = '';
  const address = url.href;
  if (pending.has(address)) return (await pending.get(address)) + fragment;
  const task = (async () => {
    const known = manifest[address];
    if (known && fs.existsSync(path.join(assets, known.file))) return known.file;
    const response = await fetch(address, { signal: AbortSignal.timeout(25000) });
    if (!response.ok) {
      if (![403, 404].includes(response.status)) throw Error(`Cannot cache theme asset HTTP ${response.status}: ${address}`);
      // A missing asset on the original site stays missing; do not substitute a new visual.
      const file = `${crypto.createHash('sha256').update(address).digest('hex').slice(0, 18)}.missing`;
      fs.writeFileSync(path.join(assets, file), ''); manifest[address] = { file, status: response.status, type: 'application/octet-stream' };
      return file;
    }
    const type = response.headers.get('content-type') || '';
    if (type.includes('text/html')) throw Error(`Theme asset returned an HTML login page: ${address}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const extension = type.includes('css') ? '.css' : type.includes('woff2') ? '.woff2' : type.includes('woff') ? '.woff' :
      type.includes('svg') ? '.svg' : type.includes('png') ? '.png' : type.includes('jpeg') ? '.jpg' : type.includes('gif') ? '.gif' :
      type.includes('font') || /\.(?:ttf|otf)(?:\?|$)/.test(address) ? '.ttf' : '.bin';
    const file = name || `${crypto.createHash('sha256').update(address).digest('hex').slice(0, 18)}${extension}`;
    fs.writeFileSync(path.join(assets, file), bytes);
    manifest[address] = { file, type, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
    return file;
  })();
  pending.set(address, task);
  return (await task) + fragment;
}
async function batch(tasks, limit = 6) {
  for (let i = 0; i < tasks.length; i += limit) await Promise.all(tasks.slice(i, i + limit).map(fn => fn()));
}
(async () => {
  const dom = new JSDOM(source), doc = dom.window.document;
  // Preserve all original layout nodes. Disable remote Moodle JS/autosave in this local fixture.
  doc.querySelectorAll('script').forEach(n => n.remove());
  for (const el of doc.querySelectorAll('*')) for (const attr of [...el.attributes]) if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
  const styles = [...doc.querySelectorAll('link[rel="stylesheet"]')];
  for (const [i, link] of styles.entries()) {
    const remote = new URL(link.getAttribute('href'), origin).href;
    const name = await cache(remote, i === 0 ? 'moodle-yui.css' : 'moodle-theme.css');
    const cssPath = path.join(assets, name), rawCSSPath = cssPath + '.original';
    if (!fs.existsSync(rawCSSPath)) fs.copyFileSync(cssPath, rawCSSPath);
    let css = fs.readFileSync(rawCSSPath, 'utf8');
    const references = [...new Set([...css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)].map(m => m[2]).filter(u => u && !u.startsWith('data:') && !u.startsWith('#')))];
    const replacements = new Map();
    await batch(references.map(ref => async () => { replacements.set(ref, await cache(new URL(ref, remote).href)); }));
    css = css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/g, (match, quote, url) => replacements.has(url) ? `url("${replacements.get(url)}")` : match);
    fs.writeFileSync(cssPath, css); link.setAttribute('href', `page-assets/${name}`);
  }
  await batch([...doc.querySelectorAll('img[src],link[rel="shortcut icon"]')].map(el => async () => {
    const attr = el.tagName === 'IMG' ? 'src' : 'href', url = el.getAttribute(attr);
    if (!url || url.startsWith('data:')) return;
    el.setAttribute(attr, `page-assets/${await cache(url)}`);
  }));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(assets, 'moodle-baseline.html'), dom.serialize());
  const prepared = dom.serialize(); dom.window.close();
  for (const [pageIndex, item] of items.entries()) {
    const pageDOM = new JSDOM(prepared), page = pageDOM.window.document;
    const block = page.querySelector('.que'), form = page.getElementById('responseform');
    const radios = [...block.querySelectorAll('.answer input[type="radio"]')];
    if (item) {
      const qtext = block.querySelector('.qtext'); (qtext.firstElementChild || qtext).textContent = item.q;
      const options = [...item.options].reverse();
      radios.forEach((input, i) => { const label = page.getElementById(input.getAttribute('aria-labelledby')); label.querySelector('.flex-fill').textContent = C.optionText(options[i]); });
    }
    block.querySelector('.qno').textContent = String(pageIndex + 1);
    block.dataset.demoQuestion = String(pageIndex + 1);
    page.title = page.title.replace(/page \d+ of \d+/, `page ${pageIndex + 1} of 3`);
    form.setAttribute('action', pages[Math.min(2, pageIndex + 1)]); form.setAttribute('method', 'get');
    form.dataset.localQuizPage = String(pageIndex + 1);
    // Hidden attempt/session fields are not part of the visual layout and must not be posted.
    form.querySelectorAll('input[type="hidden"]').forEach(n => n.remove());
    for (const input of form.querySelectorAll('input[type="radio"]')) input.checked = input.value === '-1';
    for (const [index, link] of [...page.querySelectorAll('a[data-quiz-page]')].entries()) {
      link.setAttribute('href', pages[index % pages.length]);
      link.classList.toggle('thispage', index === pageIndex);
      if (index === pageIndex) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    }
    page.querySelectorAll('a.endtestlink').forEach(a => a.setAttribute('href', pages[2]));
    const previous = page.getElementById('mod_quiz-prev-nav'), next = page.getElementById('mod_quiz-next-nav');
    previous.dataset.localTarget = pages[Math.max(0, pageIndex - 1)];
    next.dataset.localTarget = pages[Math.min(2, pageIndex + 1)];
    previous.disabled = pageIndex === 0; next.disabled = pageIndex === 2;
    const script = page.createElement('script'); script.src = 'page-assets/demo.js'; page.body.append(script);
    fs.writeFileSync(path.join(workspace, pages[pageIndex]), pageDOM.serialize()); pageDOM.window.close();
  }
  console.log(`Preserved original Moodle DOM/theme. Built ${pages.join(', ')}; ${Object.keys(manifest).length} original assets cached locally.`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
