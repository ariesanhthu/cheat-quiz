"""Build reproducible install/demo ZIPs using only the Python standard library."""
from pathlib import Path
import hashlib
import json
import zipfile

BASE = Path(__file__).resolve().parents[1]
WORKSPACE = BASE.parent
OUT = BASE / 'dist'
VERSION = json.loads((BASE / 'manifest.json').read_text(encoding='utf-8'))['version']
assert VERSION == json.loads((BASE / 'package.json').read_text(encoding='utf-8'))['version']
OUT.mkdir(exist_ok=True)

def archive(name, files):
    target = OUT / name
    with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for file, relative in sorted(files, key=lambda pair: pair[1]):
            info = zipfile.ZipInfo(relative, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            z.writestr(info, file.read_bytes())
    with zipfile.ZipFile(target) as z:
        assert z.testzip() is None
        assert not any('node_modules' in f or 'profile' in f or '.env' in f for f in z.namelist())
    return target

runtime = ['manifest.json', 'bootstrap.js', 'background.js', 'core.js', 'adapter.js', 'content.js', 'ai.js',
           'updates.js', 'update-config.json', 'settings.html', 'settings.js', 'source.html', 'source.js',
           'bank.json', 'knowledge-base.json', 'data-manifest.json', 'README.md', 'RELEASE_NOTES.md',
           'scripts/cli-bridge.cjs', 'scripts/proxy.cjs']
extension = archive(f'quiz-assistant-extension-{VERSION}.zip', [(BASE / f, f) for f in runtime])
demo_files = [(WORKSPACE / f, f) for f in ['page.html', 'page-2.html', 'page-3.html']]
demo_files += [(f, f'page-assets/{f.name}') for f in (WORKSPACE / 'page-assets').iterdir() if f.is_file()]
demo = archive(f'quiz-assistant-demo-{VERSION}.zip', demo_files)
lines = [f'{hashlib.sha256(file.read_bytes()).hexdigest()}  {file.name}' for file in [extension, demo]]
(OUT / 'SHA256SUMS.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8')
for file in [extension, demo]:
    print(f'{file.name}: {file.stat().st_size:,} bytes')
