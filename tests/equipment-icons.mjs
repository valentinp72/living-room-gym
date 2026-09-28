// Equipment icons for the menu (www/img/equipment/<kind>.png: chair, band,
// weights), white line drawings on a transparent background, rendered from
// the SVGs below. Not a test: run it when an icon changes, then look at them.
// Usage: node equipment-icons.mjs <outDir>, e.g.
//   node tests/equipment-icons.mjs www/img/equipment
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './lib.mjs';

const [outDir] = process.argv.slice(2);
if (!outDir) { console.error('Usage: node equipment-icons.mjs <outDir>'); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const SIZE = 128;

// 100 x 100 drawings, stroked in white.
const LINE = 'fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"';
const ICONS = {
  // Side view: backrest and seat (filled), two legs.
  chair: `<g fill="#fff"><rect x="24" y="8" width="12" height="54" rx="5"/><rect x="24" y="50" width="54" height="12" rx="5"/></g>
    <g ${LINE}><path d="M31 60 L28 92 M71 60 L74 92"/></g>`,
  // An elastic band with a handle at each end.
  band: `<g ${LINE}><rect x="6" y="36" width="18" height="28" rx="7"/><rect x="76" y="36" width="18" height="28" rx="7"/>
    <path d="M24 50 C33 32, 41 32, 50 50 S67 68, 76 50"/></g>`,
  // A dumbbell: bar and two plates on each side.
  weights: `<g ${LINE}><path d="M28 50 H72"/></g>
    <g fill="#fff"><rect x="8" y="30" width="10" height="40" rx="4"/><rect x="18" y="24" width="10" height="52" rx="4"/>
    <rect x="72" y="24" width="10" height="52" rx="4"/><rect x="82" y="30" width="10" height="40" rx="4"/></g>`,
};

const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: SIZE, height: SIZE });
for (const [kind, svg] of Object.entries(ICONS)) {
  await page.setContent(`<html><body style="margin:0;background:transparent">
    <svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 100 100">${svg}</svg></body></html>`);
  const file = path.join(outDir, kind + '.png');
  await page.screenshot({ path: file, omitBackground: true });
  console.log('wrote', file);
}
await browser.close();
