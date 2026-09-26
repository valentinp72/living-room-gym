// Scene appearance per display mode, and VR being refused (AR / VR sessions
// are simulated with the
// same state + event sequence A-Frame uses).
import { launch } from './lib.mjs';
const [url, shot] = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 800 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('a-scene')?.hasLoaded, { timeout: 20000 });
await sleep(300);

const look = () => page.evaluate(() => {
  const s = document.querySelector('a-scene');
  const bg = s.object3D.background;
  return {
    background: bg ? '#' + bg.getHexString() : 'transparent',
    floor: document.querySelector('.flat-only').object3D.visible,
    // Which buttons exist (headless Chrome can't do AR, so A-Frame hides
    // the AR one here; on a Quest it shows).
    arButton: !!document.querySelector('.a-enter-ar'),
    vrButton: !!document.querySelector('.a-enter-vr'),
  };
});
const enter = mode => page.evaluate(m => { const s = document.querySelector('a-scene'); s.addState(m + '-mode'); s.emit('enter-vr', { target: s }); }, mode);
const exit = () => page.evaluate(() => { const s = document.querySelector('a-scene'); s.removeState('vr-mode'); s.removeState('ar-mode'); s.emit('exit-vr', { target: s }); });

const results = [];
const expect = (name, got, want) => results.push({ name, ok: JSON.stringify(got) === JSON.stringify(want), got, want });

expect('flat page: AR button only', await look(), { background: '#0d1117', floor: true, arButton: true, vrButton: false });
if (shot) await page.screenshot({ path: shot + '-flat.png' });
await enter('ar'); await sleep(100);
const ar = await look();
expect('AR: passthrough', { background: ar.background, floor: ar.floor }, { background: 'transparent', floor: false });
// Squats in AR: the exercise flow still works with passthrough on.
await page.evaluate(() => document.querySelectorAll('#menuButtons > *')[0].emit('click'));
await sleep(200);
if (shot) await page.screenshot({ path: shot + '-ar.png', omitBackground: true });
await exit(); await sleep(100);
const back = await look();
expect('back to flat', { background: back.background, floor: back.floor }, { background: '#0d1117', floor: true });
// A VR session (e.g. started by the browser) is ended right away.
await page.evaluate(() => { const s = document.querySelector('a-scene'); window.exits = 0; s.exitVR = () => { window.exits++; return Promise.resolve(); }; });
await enter('vr'); await sleep(100);
expect('VR: session ended at once', await page.evaluate(() => window.exits), 1);
await exit();
await enter('ar'); await sleep(100);
expect('AR: not ended', await page.evaluate(() => window.exits), 1);
await exit();

for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok ? '' : `  got=${JSON.stringify(r.got)} want=${JSON.stringify(r.want)}`));
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(results.every(r => r.ok) && !errors.length ? 0 : 1);
