'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (!['/', '/page.html', '/page-2.html', '/page-3.html'].includes(url.pathname) && !/^\/page-assets\/[a-zA-Z0-9._-]+$/.test(url.pathname)) { res.writeHead(404); res.end(); return; }
  const requested = url.pathname === '/' ? 'page.html' : url.pathname.slice(1);
  const file = path.resolve(__dirname, '../..', requested);
  const root = path.resolve(__dirname, '../..') + path.sep;
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (error, html) => {
    if (error) { res.writeHead(500); res.end('Cannot read demo page'); return; }
    const types = { '.css': 'text/css', '.js': 'text/javascript', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.bin': 'application/octet-stream' };
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(html);
  });
server.listen(8789, '127.0.0.1', () => console.log('Demo: http://127.0.0.1:8789/page.html'));
server.on('error', e => { console.error(`Demo server: ${e.code}`); process.exitCode = 1; });
