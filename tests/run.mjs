// Serves ../www on a free local port and runs the test suites against it, one
// after the other. Usage: node run.mjs [suite ...]   (default: all suites)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WWW = path.join(HERE, '..', 'www');
const SUITES = ['workout', 'desktop', 'clickbug', 'pointer', 'buttons', 'ar',
  'recenter', 'plank', 'curls', 'squats', 'exercises', 'avatar', 'textfit'];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

// Minimal static server (module scripts need HTTP, not file://).
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(WWW, rel.endsWith('/') ? rel + 'index.html' : rel);
  if (!file.startsWith(WWW) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end(); return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

const run = suite => new Promise(resolve => {
  const child = spawn(process.execPath, [path.join(HERE, suite + '.mjs'), url], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { out += d; });
  child.on('close', code => resolve({ suite, ok: code === 0, out }));
});

const wanted = process.argv.slice(2);
const unknown = wanted.filter(s => !SUITES.includes(s));
if (unknown.length) { console.error('Unknown suite(s):', unknown.join(', ')); process.exit(2); }

const results = [];
for (const suite of wanted.length ? wanted : SUITES) {
  const r = await run(suite);
  results.push(r);
  // Print the full output only on failure, or with VERBOSE=1.
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${suite}`);
  if (!r.ok || process.env.VERBOSE) console.log(r.out.replace(/^/gm, '      '));
}
server.close();
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} suites passed`);
process.exit(failed ? 1 : 0);
