// Pictures of the coach for the single exercises menu (one per exercise,
// www/img/exercises/<id>.png, transparent background), each at its demo's
// most telling moment (see shootCoach()). Not a test: run it when an
// exercise is added or its demo changes, then look at them.
// Usage: node thumbnails.mjs <url> <outDir>, with www/ served, e.g.
//   python3 -m http.server --directory www 8000
//   node tests/thumbnails.mjs http://127.0.0.1:8000/ www/img/exercises
import fs from 'node:fs';
import path from 'node:path';
import { openCoach, shootCoach } from './coach-shot.mjs';

const [url, outDir] = process.argv.slice(2);
if (!url || !outDir) { console.error('Usage: node thumbnails.mjs <url> <outDir>'); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });

const { browser, page, ids } = await openCoach(url, 160);
for (const id of ids) {
  const file = path.join(outDir, id + '.png');
  await shootCoach(page, id, file);
  console.log('wrote', file);
}
await browser.close();
