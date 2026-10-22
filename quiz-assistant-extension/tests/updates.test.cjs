const { test } = require('node:test');
const assert = require('node:assert/strict');
const U = require('../updates.js');
const config = require('../update-config.json');
const { worker, environment } = require('./helpers.cjs');
const root = `https://github.com/${config.owner}/${config.repository}`;
function release(tag = 'v1.2.0') {
  const name = `${config.assetPrefix}${tag.slice(1)}.zip`;
  return { tag_name: tag, html_url: `${root}/releases/tag/${tag}`, draft: false, prerelease: false,
    assets: [{ name, state: 'uploaded', browser_download_url: `${root}/releases/download/${tag}/${name}` }] };
}
test('versions compare numerically, including older/equal versions and Chrome four-part versions', () => {
  assert.equal(U.newer('v1.10.0', '1.9.9'), true);
  assert.equal(U.newer('1.1.0', '1.1.0.0'), false);
  assert.equal(U.newer('1.0.99', '1.1.0'), false);
  assert.equal(U.newer('1.1.0.1', '1.1.0'), true);
  for (const v of ['1.2', 'v1.2.0-beta', '../v1.2.0', '1.65536.0', 'https://evil.test/1.2.0']) assert.throws(() => U.version(v));
});
test('release metadata accepts only stable versions and exact repository ZIP URLs', () => {
  assert.equal(U.release(config, release(), '1.1.0').available, true);
  assert.equal(U.release(config, { ...release(), assets: [] }, '1.1.0').downloadURL, null);
  for (const change of [{ draft: true }, { prerelease: true }, { html_url: 'https://evil.test/' }, { tag_name: '../v1.2.0' }]) {
    assert.throws(() => U.release(config, { ...release(), ...change }, '1.1.0'));
  }
  const data = release(); data.assets[0].browser_download_url = 'https://evil.test/update.zip';
  assert.throws(() => U.release(config, data, '1.1.0'));
});
test('GitHub checks are GET-only, omit credentials and quiz data, and handle unavailable or malformed releases', async () => {
  const result = await U.check(config, '1.1.0', async (url, init) => {
    assert.equal(url, `https://api.github.com/repos/${config.owner}/${config.repository}/releases/latest`);
    assert.equal(init.credentials, 'omit'); assert.equal(init.body, undefined); assert.equal(init.redirect, 'error');
    return new Response(JSON.stringify(release()));
  });
  assert.equal(result.latestVersion, '1.2.0');
  assert.equal((await U.check(config, '1.1.0', async () => new Response('', { status: 404 }))).unpublished, true);
  for (const response of [new Response('', { status: 429 }), new Response('bad-json'), new Response('x'.repeat(1000001))]) {
    await assert.rejects(U.check(config, '1.1.0', async () => response));
  }
});
test('updates are opt-in, permission-gated and coalesced; scheduled checks persist across worker restart', async () => {
  const env = environment(); env.permissions = false;
  let w = worker(env, async () => new Response(JSON.stringify(release())));
  assert.equal((await w.send({ type: 'update-info' })).autoCheck, false);
  assert.equal((await w.send({ type: 'check-updates' })).requiresPermission, true);
  assert.equal(env.network.length, 0);
  assert.ok((await w.send({ type: 'set-auto-updates', enabled: true }, w.ui)).error);
  env.permissions = true;
  assert.ok((await w.send({ type: 'set-auto-updates', enabled: true })).error);
  const result = await w.send({ type: 'set-auto-updates', enabled: true }, w.ui);
  assert.equal(result.autoCheck, true); assert.equal(result.status.available, true);
  assert.equal(env.alarm.periodInMinutes, 360); assert.equal(env.network.length, 1);
  await Promise.all(Array.from({ length: 5 }, () => w.send({ type: 'check-updates' })));
  assert.equal(env.network.length, 1);
  w = worker(env); await w.listeners.startup();
  assert.equal(env.alarm.name, 'qa-check-updates');
  await w.listeners.alarm({ name: 'qa-check-updates' }); assert.equal(env.network.length, 1);
  assert.equal((await w.send({ type: 'update-info' })).status.latestVersion, '1.2.0');
  await w.send({ type: 'open-update' }); assert.equal(env.opened.url, release().assets[0].browser_download_url);
  await w.send({ type: 'set-auto-updates', enabled: false }, w.ui); assert.equal(env.alarm, null);
});
test('network failure keeps the last release and bank; malicious persisted download URLs cannot open a tab', async () => {
  const env = environment();
  const valid = U.release(config, release(), '1.1.0');
  await env.local.set({ updateState: { ...valid, checkedAt: 1 }, questionBank: { bank: [], revision: 'test', bundled: false } });
  const w = worker(env, async () => { throw Error('offline'); });
  const result = await w.send({ type: 'check-updates' });
  assert.ok(result.status.error); assert.equal(result.status.latestVersion, valid.latestVersion);
  assert.equal(env.local.data.questionBank.revision, 'test');
  for (const downloadURL of ['https://evil.test/u.zip', `${root}/releases/download/v1.2.0/../../evil.zip`]) {
    await env.local.set({ updateState: { ...valid, downloadURL } });
    assert.ok((await w.send({ type: 'open-update' })).error); assert.equal(env.opened, undefined);
  }
});
