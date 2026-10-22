const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const core = require('../core.js');
const base = path.resolve(__dirname, '..');
const bank = [], sources = [];
for (const name of ['quiz.json', 'quiz2.json', 'quiz3.json', 'quiz4.json', 'quiz5.json']) {
  const raw = fs.readFileSync(path.join(base, '..', name), 'utf8').replace(/^\uFEFF/, '');
  const items = core.validate(JSON.parse(raw), { source: name, verified: true });
  bank.push(...items); sources.push({ name, count: items.length, sha256: crypto.createHash('sha256').update(raw).digest('hex') });
}
const kbRoot = path.join(base, 'LICH-SU-DANG-NGUYEN-VAN');
const chunks = [], pages = [];
for (const chapter of fs.readdirSync(path.join(kbRoot, 'trang')).sort()) {
  for (const file of fs.readdirSync(path.join(kbRoot, 'trang', chapter)).filter(x => x.endsWith('.md')).sort()) {
    const relative = `trang/${chapter}/${file}`;
    const raw = fs.readFileSync(path.join(kbRoot, relative), 'utf8');
    const text = [...raw.matchAll(/```text\r?\n([\s\S]*?)```/g)].map(m => m[1].trim()).filter(Boolean).join('\n\n');
    const title = raw.split(/\r?\n/)[0].replace(/^#\s*/, '');
    const source = raw.match(/Nguồn:\s*([^\r\n]+)/)?.[1] || title;
    pages.push({ path: relative, title, characters: text.length });
    if (!text) continue;
    for (let start = 0, part = 1; start < text.length; start += 2600, part++) {
      chunks.push({ id: `${chapter}/${file.replace('.md', '')}:${part}`, title, source, path: `LICH-SU-DANG-NGUYEN-VAN/${relative}`, text: text.slice(start, start + 3000) });
      if (start + 3000 >= text.length) break;
    }
  }
}
const write = (name, value) => fs.writeFileSync(path.join(base, name), JSON.stringify(value, null, 2) + '\n');
write('bank.json', bank);
write('knowledge-base.json', { version: 1, chunks });
write('data-manifest.json', { sources, questions: bank.length, labelled: bank.filter(x => x.answer).length, pages: pages.length, chunks: chunks.length,
  knowledgeSha256: crypto.createHash('sha256').update(JSON.stringify(chunks)).digest('hex') });
fs.mkdirSync(path.join(kbRoot, 'references'), { recursive: true });
write('LICH-SU-DANG-NGUYEN-VAN/references/page-index.json', pages);
console.log(`Built ${bank.length} questions (${bank.filter(x => x.answer).length} labelled); ${chunks.length} knowledge chunks from ${pages.length} pages.`);
