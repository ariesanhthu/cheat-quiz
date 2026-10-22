const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../core.js');
const bank = C.validate(require('../bank.json'));
const search = C.engine(bank);

test('all five supplied banks are preserved, including unanswered questions and option variants', () => {
  const manifest = require('../data-manifest.json');
  assert.equal(manifest.sources.length, 5);
  assert.equal(bank.length, 151); assert.equal(bank.filter(x => x.answer).length, 149);
  for (const source of manifest.sources) {
    const original = JSON.parse(fs.readFileSync(path.join(__dirname, '../..', source.name), 'utf8'));
    const actual = bank.filter(x => x.source === source.name);
    assert.equal(actual.length, original.length);
    original.forEach((x, i) => { assert.equal(actual[i].q, x.q); assert.deepEqual(actual[i].options, x.options); });
  }
});
test('every real question: correct option after shuffle/relabel or explicitly blocked conflict', () => {
  let matched = 0, conflict = 0, unanswered = 0;
  for (const item of bank) {
    const options = [...item.options].reverse().map((o, i) => `${String.fromCharCode(65 + i)}. ${C.optionText(o)}`);
    const results = search(item.q, options, 20000);
    const decision = C.decide(item.q, options, results);
    if (!item.answer) { unanswered++; assert.notEqual(decision.status, 'matched'); continue; }
    assert.equal(results[0].exact, true, item.id);
    const answers = new Set(bank.filter(b => C.key(b.q, b.options) === C.key(item.q, options) && b.answer).map(b => C.optionNorm(b.answer)));
    if (answers.size > 1 || options.filter(o => C.optionNorm(o) === C.optionNorm(item.answer)).length !== 1) {
      conflict++; assert.equal(decision.status, 'needs_review', item.id);
    } else {
      matched++; assert.equal(decision.status, 'matched', item.id);
      assert.equal(C.optionNorm(options[decision.index]), C.optionNorm(item.answer), item.id);
    }
  }
  console.log(`Real-bank regression: ${matched} mapped, ${conflict} conflicts blocked, ${unanswered} unanswered.`);
});
test('same question, different answers/options: rank the exact option variant, keep top three', () => {
  const q = 'Một trong những nhiệm vụ của môn học Lịch sử Đảng Cộng sản Việt Nam là gì?';
  const variants = bank.filter(x => C.questionNorm(x.q) === C.questionNorm(q));
  assert.ok(variants.length >= 3);
  for (const variant of variants) {
    const result = search(q, variant.options);
    assert.equal(result.length, 3);
    assert.equal(C.optionKey(result[0].item.options), C.optionKey(variant.options));
    assert.equal(C.optionNorm(C.decide(q, variant.options, search(q, variant.options, 20000)).answer), C.optionNorm(variant.answer));
  }
});
test('a conflict outside displayed top-three cannot escape the decision policy', () => {
  const items = C.validate(Array.from({ length: 12 }, (_, i) => ({ q: 'Question?', options: ['Yes', 'No'], answer: i === 11 ? 1 : 0, verified: true })));
  const all = C.engine(items)('Question?', ['Yes', 'No'], 20000);
  assert.equal(all.length, 12);
  assert.equal(C.decide('Question?', ['Yes', 'No'], all).status, 'needs_review');
});
test('numbers, dates, negation and comparison operators stay significant', () => {
  const q = 'Which statement about the very long historical passage in this question is NOT correct in 1930 < 1945?';
  const options = ['Yes', 'No'];
  const s = C.engine(C.validate([{ q, options, answer: 1, verified: true }]));
  for (const altered of [q.replace('1930', '1931'), q.replace('NOT ', ''), q.replace('<', '>')]) {
    assert.equal(C.decide(altered, options, s(altered, options, 20000), { threshold: 0.85 }).status, 'needs_review');
  }
  assert.notEqual(C.norm('2/9/1945'), C.norm('29/1945'));
  assert.notEqual(C.norm('không đúng'), C.norm('đúng'));
});
test('NFC, HTML-like strings and option prefixes are normalized without executing markup', () => {
  assert.equal(C.norm('ĐẢNG'.normalize('NFD')), C.norm('đảng'));
  assert.equal(C.optionNorm('B. Việt Bắc.'), C.optionNorm('Việt Bắc'));
  assert.notEqual(C.optionNorm('A company'), C.optionNorm('company'));
  assert.equal(C.questionNorm('6. Đâu là nơi?'), C.questionNorm('Đâu là nơi?'));
  assert.notEqual(C.questionNorm('2.5 is a decimal'), C.questionNorm('3.5 is a decimal'));
  assert.notEqual(C.questionNorm('1930. Sự kiện nào?'), C.questionNorm('1945. Sự kiện nào?'));
});
test('unverified, empty, duplicate and absent options are never applied', () => {
  const item = { q: 'Test question', options: ['A', 'B'], answer: 0 };
  const untrusted = C.engine(C.validate([item]));
  assert.equal(C.decide(item.q, item.options, untrusted(item.q, item.options)).status, 'needs_review');
  const trusted = C.engine(C.validate([{ ...item, verified: true }]));
  for (const options of [[], ['B'], ['A', 'A']]) assert.equal(C.decide(item.q, options, trusted(item.q, options)).status, 'needs_review');
  assert.deepEqual(C.engine([])('q', ['x']), []);
});
test('validation fails atomically for malformed banks', () => {
  for (const input of [null, {}, [null], [{ q: '', options: [] }], [{ q: 'q', options: [''] }], [{ q: 'q', options: ['x'], answer: 1 }],
    [{ q: 'q', options: ['x'], answer: -1 }], [{ q: 'q', options: ['x'], answer: 0.5 }], [{ q: 'q', options: ['x'], correct_answer_text: 'missing' }], Array(20001)]) {
    assert.throws(() => C.validate(input));
  }
  assert.equal(C.validate([{ q: 'q', options: [], answer: null }])[0].answer, null);
  assert.equal(C.validate([{ q: 'q', options: ['a', 'b'], answer: [0, 1] }])[0].answer, null);
});
test('persisted index reload produces identical rankings', () => {
  const hydrated = C.engine(bank, structuredClone(search.index));
  for (const item of bank) assert.deepEqual(hydrated(item.q, item.options), search(item.q, item.options));
});
test('CSV supports quoted commas, JSON arrays, multiline cells, BOM and explicit trust', () => {
  const csv = '\uFEFFq,option_a,option_b,answer,verified\r\n"Câu hỏi, có dấu phẩy\nvà xuống dòng",Một,Hai,1,true\r\n';
  const items = C.validate(C.parseCSV(csv));
  assert.equal(items[0].answer, 'Hai'); assert.equal(items[0].verified, true);
  const jsonOptions = 'question,options,correct_answer_text\nq,"[""A"",""B""]",B';
  assert.equal(C.validate(C.parseCSV(jsonOptions))[0].answer, 'B');
  for (const input of ['q,options\n"unfinished', 'wrong,header\na,b', 'q,option_a\nq,a,b']) assert.throws(() => C.parseCSV(input));
});
test('knowledge chunks retain exact page text, provenance and deterministic corpus size', () => {
  const { chunks } = require('../knowledge-base.json');
  assert.equal(chunks.length, 433); assert.equal(new Set(chunks.map(c => c.id)).size, chunks.length);
  for (const c of chunks) {
    assert.ok(c.text.length > 0 && c.text.length <= 3000);
    const raw = fs.readFileSync(path.join(__dirname, '..', c.path), 'utf8');
    const verbatim = [...raw.matchAll(/```text\r?\n([\s\S]*?)```/g)].map(m => m[1].trim()).filter(Boolean).join('\n\n');
    assert.ok(verbatim.includes(c.text), c.id);
    assert.ok(c.title && c.source);
  }
});
