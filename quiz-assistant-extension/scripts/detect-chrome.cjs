'use strict';
const fs = require('node:fs');
const path = require('node:path');
function detect(root = path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/User Data')) {
  const ids = new Set(); if (!fs.existsSync(root)) return [];
  for (const profile of fs.readdirSync(root, { withFileTypes: true }).filter(e => e.isDirectory() && /^(Default$|Profile )/.test(e.name))) {
    for (const file of ['Preferences', 'Secure Preferences']) {
      try {
        const prefs = JSON.parse(fs.readFileSync(path.join(root, profile.name, file), 'utf8'));
        for (const [id, entry] of Object.entries(prefs.extensions?.settings || {})) {
          if (!/^[a-p]{32}$/.test(id)) continue;
          let name = entry.manifest?.name;
          if (!name && entry.path && path.isAbsolute(entry.path)) {
            try { name = JSON.parse(fs.readFileSync(path.join(entry.path, 'manifest.json'), 'utf8')).name; } catch {}
          }
          if (name === 'Local Quiz Assistant') ids.add(id);
        }
      } catch { /* An open Chrome profile can be between preference writes. */ }
    }
  }
  return [...ids];
}
if (require.main === module) process.stdout.write(JSON.stringify(detect()));
module.exports = { detect };
