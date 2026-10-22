const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '..');
const manifest = require('../manifest.json');
for (const file of ['bootstrap.js', 'core.js', 'ai.js', 'adapter.js', 'content.js', 'background.js', 'updates.js', 'native.js', 'popup.js', 'settings.js', 'source.js', 'scripts/native-host.cjs', 'scripts/detect-chrome.cjs', 'scripts/proxy.cjs', 'scripts/cli-bridge.cjs', 'scripts/build-data.cjs', 'scripts/build-demo.cjs']) {
  execFileSync(process.execPath, ['--check', path.join(base, file)], { stdio: 'inherit' });
}
for (const file of [manifest.background.service_worker, manifest.options_page, manifest.action.default_popup, 'native.js', 'SETUP.cmd', 'scripts/install-native.ps1', 'bank.json', 'knowledge-base.json', 'data-manifest.json', 'update-config.json', ...manifest.content_scripts.flatMap(c => c.js)]) {
  if (!fs.existsSync(path.join(base, file))) throw Error(`Missing extension resource ${file}`);
}
if (manifest.permissions.some(p => ['tabs', 'webNavigation', 'cookies', 'debugger'].includes(p))) throw Error('Unexpected broad permission');
if (manifest.host_permissions?.length) throw Error('Host permissions should be optional');
if (/indexedDB|sqlite|mongoose|mongodb/i.test(fs.readFileSync(path.join(base, 'background.js'), 'utf8'))) throw Error('User storage must remain in chrome.storage.local');
console.log('Syntax, packaged resources and permission checks passed.');
