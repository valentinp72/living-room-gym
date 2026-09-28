// App icons for the web app manifest (www/manifest.webmanifest): the coach
// mid jumping jack, arms up, on a dark tile with a soft glow.
//   icon-512.png, icon-192.png         rounded tile, transparent corners
//   icon-maskable-512.png              full square, the coach in the middle
//                                      60% (launchers crop it to their shape)
// Not a test: run it when the coach's look changes, then look at them.
// Usage: node icons.mjs <url> <outDir>, with www/ served, e.g.
//   node tests/icons.mjs http://127.0.0.1:8000/ www/img
// Needs ImageMagick (magick or convert).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { openCoach, shootCoach } from './coach-shot.mjs';

const [url, outDir] = process.argv.slice(2);
if (!url || !outDir) { console.error('Usage: node icons.mjs <url> <outDir>'); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const BG = '#10202b', GLOW = '#1d5a63';   // dark blue-green tile, teal glow (the coach's shirt)

const { browser, page } = await openCoach(url, 512);
const coach = path.join(outDir, '.coach.png');
await shootCoach(page, 'jumping-jacks', coach, { t: 0.75, fill: 0.95 });   // arms up
await browser.close();

const im = (...args) => execFileSync('convert', args);
const tile = (size, coachSize, rounded, out) => {
  const r = rounded ? Math.round(size * 0.22) : 0;
  im('-size', `${size}x${size}`, 'xc:none',
    '-fill', BG, '-draw', rounded ? `roundrectangle 0,0 ${size - 1},${size - 1} ${r},${r}` : `rectangle 0,0 ${size - 1},${size - 1}`,
    '(', '-size', `${size}x${size}`, `radial-gradient:${GLOW}-none`, ')', '-compose', 'over', '-composite',
    '(', coach, '-resize', `${coachSize}x${coachSize}`, ')', '-gravity', 'center', '-compose', 'over', '-composite',
    ...(rounded ? ['(', '-size', `${size}x${size}`, 'xc:none', '-fill', 'white', '-draw', `roundrectangle 0,0 ${size - 1},${size - 1} ${r},${r}`, ')',
      '-compose', 'dst-in', '-composite'] : []),
    out);
  console.log('wrote', out);
};
tile(512, 440, true, path.join(outDir, 'icon-512.png'));
tile(192, 165, true, path.join(outDir, 'icon-192.png'));
tile(512, 300, false, path.join(outDir, 'icon-maskable-512.png'));
fs.unlinkSync(coach);
