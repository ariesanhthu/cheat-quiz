/* Shared deterministic retrieval and answer policy. No DOM or network access. */
(() => {
  'use strict';
  const VERSION = 4;
  const norm = value => String(value ?? '').normalize('NFC').toLocaleLowerCase('vi')
    .replace(/[^\p{L}\p{N}<>=!]+/gu, ' ').trim().replace(/\s+/g, ' ');
  const optionText = value => String(value ?? '').replace(/^\s*[a-hA-H][.)\]:]\s*/, '').trim();
  const optionNorm = value => norm(optionText(value));
  const questionNorm = value => norm(String(value ?? '').replace(/^\s*(?:câu\s+\d+[.:)]\s*|\d{1,3}[.)]\s+)/iu, ''));
  const tokens = value => {
    const words = norm(value).split(' ').filter(Boolean);
    return [...words, ...words.slice(1).map((word, i) => `${words[i]} ${word}`)];
  };
  const optionKey = options => JSON.stringify(options.map(optionNorm).sort());
  const key = (q, options) => JSON.stringify([questionNorm(q), optionKey(options)]);
  function validate(data, defaults = {}) {
    if (!Array.isArray(data) || data.length > 20000) throw Error('Kho phải là mảng, tối đa 20.000 câu.');
    return data.map((x, i) => {
      if (!x || typeof x !== 'object') throw Error(`Câu ${i + 1} không hợp lệ.`);
      const q = x.q ?? x.question;
      const options = x.options;
      if (typeof q !== 'string' || !norm(q) || q.length > 20000 || !Array.isArray(options) ||
          options.length > 100 || options.some(o => typeof o !== 'string' || !optionNorm(o) || o.length > 20000)) {
        throw Error(`Câu ${i + 1}: câu hỏi hoặc phương án không hợp lệ.`);
      }
      let answer = x.correct_answer_text ?? (typeof x.answer === 'string' ? x.answer : null);
      if (answer === null && x.answer != null && typeof x.answer !== 'string') {
        const ids = [].concat(x.answer);
        if (ids.some(n => !Number.isInteger(n) || n < 0 || n >= options.length)) throw Error(`Câu ${i + 1}: chỉ số đáp án sai.`);
        answer = ids.length === 1 ? options[ids[0]] : null;
      }
      if (answer !== null && (typeof answer !== 'string' || !optionNorm(answer) || answer.length > 20000)) throw Error(`Câu ${i + 1}: đáp án sai định dạng.`);
      if (answer && options.length && !options.some(o => optionNorm(o) === optionNorm(answer))) throw Error(`Câu ${i + 1}: đáp án không thuộc các phương án.`);
      return {
        id: String(x.id ?? `${defaults.source || 'import'}:${i + 1}`), q, options: [...options], answer,
        verified: x.verified === true || (x.verified == null && defaults.verified === true),
        source: String(x.source || defaults.source || 'Kho đã nhập').slice(0, 300)
      };
    });
  }
  function compile(texts) {
    const docs = texts.map(tokens), df = new Map();
    for (const doc of docs) for (const t of new Set(doc)) df.set(t, (df.get(t) || 0) + 1);
    const vector = ts => {
      const counts = new Map();
      for (const t of ts) counts.set(t, (counts.get(t) || 0) + 1);
      const values = new Map(); let size = 0;
      for (const [t, count] of counts) {
        const weight = (1 + Math.log(count)) * (1 + Math.log((docs.length + 1) / ((df.get(t) || 0) + 1)));
        values.set(t, weight); size += weight * weight;
      }
      return { values, size: Math.sqrt(size) };
    };
    return { df, count: docs.length, vectors: docs.map(vector) };
  }
  function cosine(index, query) {
    const counts = new Map();
    for (const t of tokens(query)) counts.set(t, (counts.get(t) || 0) + 1);
    let size = 0;
    const values = [...counts].map(([t, n]) => {
      const weight = (1 + Math.log(n)) * (1 + Math.log((index.count + 1) / ((index.df.get(t) || 0) + 1)));
      size += weight * weight; return [t, weight];
    });
    size = Math.sqrt(size);
    return index.vectors.map(v => {
      let dot = 0; for (const [t, w] of values) dot += w * (v.values.get(t) || 0);
      return size && v.size ? Math.min(1, dot / size / v.size) : 0;
    });
  }
  function engine(bank, stored) {
    const questionIndex = stored?.version === VERSION ? stored.questions : compile(bank.map(x => questionNorm(x.q)));
    const optionsIndex = stored?.version === VERSION ? stored.options : compile(bank.map(x => x.options.map(optionNorm).sort().join(' ; ')));
    const search = (q, options = [], limit = 3) => {
      const questions = cosine(questionIndex, questionNorm(q));
      const answers = options.length ? cosine(optionsIndex, options.map(optionNorm).sort().join(' ; ')) : [];
      return bank.map((item, i) => ({ item, questionScore: questions[i], optionScore: answers[i] || 0,
        exact: questionNorm(q) === questionNorm(item.q) && options.length > 0 && optionKey(options) === optionKey(item.options),
        score: options.length ? 0.65 * questions[i] + 0.35 * (answers[i] || 0) : questions[i]
      })).filter(r => r.score > 0).sort((a, b) => Number(b.exact) - Number(a.exact) || b.score - a.score || a.item.id.localeCompare(b.item.id)).slice(0, limit);
    };
    search.index = { version: VERSION, questions: questionIndex, options: optionsIndex };
    return search;
  }
  const critical = q => JSON.stringify([
    norm(q).match(/\d+/g) || [],
    norm(q).match(/\b(?:not|no|never|except|false)\b|không|chưa|chẳng|ngoại trừ|\bsai\b|[<>=!]+/gu) || []
  ]);
  function decide(q, options, results, config = {}) {
    const review = reason => ({ status: 'needs_review', answer: results[0]?.item.answer || null, reason });
    if (!options.length) return review('Không có phương án để đối chiếu.');
    const top = results[0];
    if (!top?.item.answer) return review('Kho chưa có đáp án.');
    const answer = optionNorm(top.item.answer);
    const matches = options.map((o, i) => optionNorm(o) === answer ? i : -1).filter(i => i >= 0);
    if (matches.length !== 1) return review('Đáp án không ánh xạ duy nhất vào phương án trên trang.');
    const exact = questionNorm(q) === questionNorm(top.item.q) && optionKey(options) === optionKey(top.item.options);
    if (results.some(r => questionNorm(q) === questionNorm(r.item.q) && optionKey(options) === optionKey(r.item.options) &&
      r.item.answer && optionNorm(r.item.answer) !== answer)) return review('Kho có đáp án mâu thuẫn cho cùng câu hỏi và bộ phương án.');
    if (!top.item.verified) return review('Nguồn chưa được đánh dấu tin cậy.');
    if (!exact) {
      const threshold = Number.isFinite(config.threshold) ? config.threshold : 0.94;
      const margin = Number.isFinite(config.margin) ? config.margin : 0.08;
      if (top.questionScore < threshold || top.optionScore < threshold || critical(questionNorm(q)) !== critical(questionNorm(top.item.q))) return review('Chưa đủ tương đồng hoặc khác số / phủ định.');
      if (results.some(r => r !== top && r.item.answer && optionNorm(r.item.answer) !== answer && top.score - r.score < margin)) return review('Nhiều kết quả gần nhau có đáp án khác nhau.');
    }
    return { status: 'matched', index: matches[0], answer: top.item.answer, reason: exact ? 'Khớp câu hỏi và bộ phương án trong kho.' : 'Khớp theo ngưỡng cấu hình; cần tự kiểm tra độ đúng.' };
  }
  function parseCSV(input) {
    const rows = []; let row = [], value = '', quoted = false;
    const source = input.replace(/^\uFEFF/, '');
    for (let i = 0; i < source.length; i++) {
      const c = source[i];
      if (c === '"') { if (quoted && source[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
      else if (c === ',' && !quoted) { row.push(value); value = ''; }
      else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && source[i + 1] === '\n') i++; row.push(value); if (row.some(Boolean)) rows.push(row); row = []; value = ''; }
      else value += c;
    }
    if (quoted) throw Error('CSV thiếu dấu đóng ngoặc kép.');
    row.push(value); if (row.some(Boolean)) rows.push(row);
    const headers = rows.shift()?.map(h => h.trim()) || [];
    if (!headers.includes('q') && !headers.includes('question')) throw Error('CSV cần cột q hoặc question.');
    return rows.map(cells => {
      if (cells.length !== headers.length) throw Error('CSV có số cột không khớp.');
      const x = Object.fromEntries(headers.map((h, i) => [h, cells[i]]));
      const options = x.options ? JSON.parse(x.options) : headers.filter(h => /^option_[a-z]$/.test(h)).map(h => x[h]).filter(Boolean);
      return { ...x, options, answer: x.answer === '' || x.answer == null ? null : Number(x.answer), verified: x.verified === 'true' };
    });
  }
  globalThis.QuizCore = { VERSION, norm, tokens, optionText, optionNorm, questionNorm, optionKey, key, validate, engine, decide, compile, cosine, parseCSV };
  if (typeof module !== 'undefined') module.exports = globalThis.QuizCore;
})();
