(() => {
  'use strict';
  function version(value) {
    const match = /^v?(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?$/.exec(String(value || ''));
    if (!match) throw Error('Phiên bản Release không hợp lệ.');
    const parts = match.slice(1).map(n => Number(n || 0));
    if (parts.some(n => !Number.isSafeInteger(n) || n > 65535)) throw Error('Phiên bản Release ngoài phạm vi.');
    return parts;
  }
  function newer(candidate, current) {
    const a = version(candidate), b = version(current);
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i];
    return false;
  }
  function release(config, data, current) {
    if (!data || data.draft || data.prerelease) throw Error('Release chưa phải bản ổn định.');
    version(data.tag_name);
    const root = `https://github.com/${config.owner}/${config.repository}`;
    const tag = data.tag_name;
    const url = `${root}/releases/tag/${encodeURIComponent(tag)}`;
    if (data.html_url !== url) throw Error('Release không thuộc repository đã cấu hình.');
    const expectedName = `${config.assetPrefix}${tag.replace(/^v/, '')}.zip`;
    const asset = data.assets?.find(a => a.name === expectedName && a.state === 'uploaded');
    let downloadURL = null;
    if (asset) {
      const expected = `${root}/releases/download/${encodeURIComponent(tag)}/${expectedName}`;
      if (asset.browser_download_url !== expected) throw Error('URL bản cập nhật không hợp lệ.');
      downloadURL = expected;
    }
    return { latestVersion: tag.replace(/^v/, ''), available: newer(tag, current), releaseURL: url, downloadURL };
  }
  async function check(config, current, fetcher = fetch) {
    const response = await fetcher(`https://api.github.com/repos/${config.owner}/${config.repository}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' },
      credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000)
    });
    if (response.status === 404) return { available: false, unpublished: true, latestVersion: null, releaseURL: null, downloadURL: null };
    if (!response.ok) throw Error(response.status === 403 || response.status === 429 ? 'GitHub đang giới hạn lượt kiểm tra. Hãy thử lại sau.' : `GitHub HTTP ${response.status}.`);
    const raw = await response.text(); if (raw.length > 1000000) throw Error('Dữ liệu Release quá lớn.');
    return release(config, JSON.parse(raw), current);
  }
  globalThis.QuizUpdates = { version, newer, release, check };
  if (typeof module !== 'undefined') module.exports = globalThis.QuizUpdates;
})();
