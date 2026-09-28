// Serves ../www (or $WWW) on a free local port and runs the test suites against it,
// $JOBS at a time (default 3; each suite has its own browser), longest first.
// Usage: node run.mjs [suite ...]   (default: all suites)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// $WWW: another copy of the app to test, e.g. the one about to be deployed.
const WWW = path.resolve(process.env.WWW || path.join(HERE, '..', 'www'));
// Slowest first (see the times it prints), so parallel runs end together.
const SUITES = ['workout', 'exercises', 'curls', 'buttons', 'desktop', 'plank', 'textfit',
  'squats', 'recenter', 'avatar', 'clickbug', 'pointer', 'ar'];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg',
  '.webmanifest': 'application/manifest+json' };

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
  const start = Date.now();
  const child = spawn(process.execPath, [path.join(HERE, suite + '.mjs'), url], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { out += d; });
  child.on('close', code => resolve({ suite, ok: code === 0, out, seconds: (Date.now() - start) / 1000 }));
});

const wanted = process.argv.slice(2);
const unknown = wanted.filter(s => !SUITES.includes(s));
if (unknown.length) { console.error('Unknown suite(s):', unknown.join(', ')); process.exit(2); }

// SUITES lists the slow ones first, so they start early.
const queue = [...(wanted.length ? wanted : SUITES)];
const results = [];
const worker = async () => {
  while (queue.length) {
    const r = await run(queue.shift());
    results.push(r);
    // Print the full output only on failure, or with VERBOSE=1.
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.suite.padEnd(10)} ${r.seconds.toFixed(0).padStart(4)} s`);
    if (!r.ok || process.env.VERBOSE) console.log(r.out.replace(/^/gm, '      '));
  }
};
await Promise.all(Array.from({ length: Math.max(1, Number(process.env.JOBS) || 3) }, worker));
server.close();
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} suites passed`);
process.exit(failed ? 1 : 0);
