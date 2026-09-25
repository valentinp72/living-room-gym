// Automatic plank timing from the head pose, plus the floor counter.
import { launch } from './lib.mjs';
const [url, shot] = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 900 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('a-scene')?.hasLoaded, { timeout: 20000 });
await page.evaluate(() => document.querySelector('#camera').setAttribute('look-controls', 'enabled: false'));

const head = (y, pitch, yaw = 0) => page.evaluate((y, pitch, yaw) => {
  const o = document.querySelector('#camera').object3D;
  o.position.set(0, y, 0); o.rotation.set(pitch * Math.PI / 180, yaw * Math.PI / 180, 0, 'YXZ');
}, y, pitch, yaw);
const stand = () => head(1.6, 0);
const plank = () => head(0.45, -80);
const label = () => page.evaluate(() => document.querySelector('#repText').getAttribute('value'));
const secs = (text, key) => { const m = text.match(new RegExp(key + ': ([\\d.]+)s')); return m ? parseFloat(m[1]) : null; };
const floor = () => page.evaluate(() => {
  const o = document.querySelector('#floorLabel').object3D;
  return { visible: o.visible, text: document.querySelector('#floorLabelText').getAttribute('value'),
    pos: [o.position.x, o.position.y, o.position.z].map(n => Math.round(n * 100) / 100) };
});

const results = [];
const check = (name, ok, info) => results.push({ name, ok, info });

await stand();
await page.evaluate(() => document.querySelectorAll('#menuButtons > *')[2].emit('click'));
await sleep(200);
check('prompt before first hold', await label() === 'Get into plank position', await label());
check('no Start/Stop button', await page.evaluate(() => !document.querySelector('#btnToggle')), '');
check('floor counter hidden while standing', (await floor()).visible === false, JSON.stringify(await floor()));

// Hold: nothing for the first second, then the timer runs (counting that second).
await plank(); await sleep(500);
check('not started before 1 s', await label() === 'Get into plank position', await label());
await sleep(1000);
let t = secs(await label(), 'Hold');
check('started after 1 s, counting it', t !== null && t >= 1.2 && t <= 2.0, await label());
const f = await floor();
check('floor counter under the face', f.visible && f.text === (await label()) && f.pos[1] === 0.01 && f.pos[2] === -0.2, JSON.stringify(f));
if (shot) {
  await page.evaluate(() => { const o = document.querySelector('#camera').object3D; o.position.set(0, 0.45, 0); o.rotation.set(-80 * Math.PI / 180, 0, 0, 'YXZ'); });
  await sleep(100); await page.screenshot({ path: shot + '-floor.png' });
}

// A 0.5 s wobble (head up) doesn't end the hold.
await head(0.9, -20); await sleep(500); await plank(); await sleep(1000);
t = secs(await label(), 'Hold');
check('short wobble keeps the hold going', t !== null && t >= 3.0 && t <= 4.0, await label());

// Standing up ends it; the 1 s exit delay isn't counted.
await stand(); await sleep(1400);
const done = await label();
const last = secs(done, 'Last'), best = secs(done, 'Best');
check('stand up: last = best ≈ hold time', last !== null && last === best && last >= 3.0 && last <= 4.3, done);
check('floor counter hidden again', (await floor()).visible === false, '');

// Poses that are not a plank.
for (const [name, y, pitch] of [['kneeling upright', 0.75, 0], ['standing, looking down', 1.6, -85],
  ['lying flat on the floor', 0.15, -85], ['sitting, head tilted', 0.85, -70]]) {
  await head(y, pitch); await sleep(1500);
  check('not a plank: ' + name, await label() === done, await label());
}

// A second, shorter hold keeps the best.
await plank(); await sleep(2000); await stand(); await sleep(1300);
const again = await label();
check('second hold: best kept', secs(again, 'Best') === best && secs(again, 'Last') < best, again);

for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok ? '' : '   ' + r.info));
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(results.every(r => r.ok) && !errors.length ? 0 : 1);
