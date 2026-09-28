// Automatic plank timing from the head pose, plus the floor counter.
import { launch, frames, wait } from './lib.mjs';
const [url, shot] = process.argv.slice(2);
// The page's time, not real time (see the test clock in lib.mjs).
const sleep = ms => wait(page, ms);
const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 900 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('a-scene')?.hasLoaded);
await page.evaluate(() => document.querySelector('#camera').setAttribute('look-controls', 'enabled: false'));

const head = (y, pitch, yaw = 0) => page.evaluate((y, pitch, yaw) => {
  const o = document.querySelector('#camera').object3D;
  o.position.set(0, y, 0); o.rotation.set(pitch * Math.PI / 180, yaw * Math.PI / 180, 0, 'YXZ');
}, y, pitch, yaw);
const stand = () => head(1.6, 0);
const plank = () => head(0.38, -80);
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

// It fits in view (regression: 1 m wide, 40 cm from the eyes, it didn't):
// the angle between its left and right edges, seen from the eyes.
const span = () => page.evaluate(() => {
  const o = document.querySelector('#floorLabel').object3D, h = document.querySelector('#camera').object3D;
  o.updateMatrixWorld(true); h.updateMatrixWorld(true);
  const eye = h.getWorldPosition(new THREE.Vector3());
  const w = document.querySelector('#floorLabel a-plane').getAttribute('width') / 2;
  const [l, r] = [-w, w].map(x => o.localToWorld(new THREE.Vector3(x, 0, 0)).sub(eye));
  return Math.round(l.angleTo(r) * 180 / Math.PI);
});
await plank(); await sleep(1200); await frames(page, 2);
let deg = await span();
check('floor counter fits in view (about 50 deg wide)', deg >= 45 && deg <= 55, deg + ' deg');
await head(0.25, -85); await frames(page, 2); deg = await span();
check('floor counter fits in view, head lower', deg >= 45 && deg <= 55, deg + ' deg');
await stand(); await frames(page, 2);

// Poses that are not a plank.
for (const [name, y, pitch] of [['kneeling upright', 0.75, 0], ['standing, looking down', 1.6, -85],
  ['lying on the back', 0.2, 80], ['sitting, head tilted', 0.85, -70],
  ['almost sitting, face down', 0.68, -70], ['lying face down', 0.1, -85]]) {
  await head(y, pitch); await sleep(1500);
  const l = await label();
  check('not a plank: ' + name, !l.startsWith('Hold') && secs(l, 'Best') === best, l);
}

// Looser than before (regression: a real forearm plank was missed): a low
// head, looking 45° down instead of straight at the floor, still counts.
await stand(); await sleep(300);
await head(0.22, -45); await sleep(1600);
check('low head looking ahead: a plank', secs(await label(), 'Hold') !== null, await label());
// Once holding: a small sag or rise, or 32° down, keeps it.
await head(0.3, -32); await sleep(700);
await head(0.15, -80); await sleep(700);
check('holding: small moves keep it', secs(await label(), 'Hold') > 2.5, await label());
await stand(); await sleep(1400);
const done2 = await label();

// The hold follows the head height it started at (regression: lying down or
// almost sitting up still counted): 10 cm lower or 12 cm higher ends it.
for (const [name, y] of [['lying down', 0.24], ['sitting back', 0.53]]) {
  await plank(); await sleep(1500);
  const before = secs(await label(), 'Hold');
  await head(y, -80); await sleep(1400);
  const l = await label();
  check('hold ends: ' + name, before !== null && !l.startsWith('Hold'), `${before} then ${l}`);
  await stand(); await sleep(300);
}
const done3 = await label();

// When low but not in position, the label says what's off, with the value.
for (const [name, y, pitch, want] of [['too high', 0.85, -80, /^Head lower \(85 cm\)/],
  ['looking ahead', 0.4, -10, /^Face the floor \(10 deg\)/], ['too low', 0.07, -80, /^Head too low \(7 cm\)/]]) {
  await head(y, pitch); await sleep(300);
  const l = await label();
  check('hint: ' + name, want.test(l) && l.includes('Best: '), l);
}
await stand(); await sleep(300);
check('standing: no hint', await label() === done3, await label());

// A second, shorter hold keeps the best.
await plank(); await sleep(2000); await stand(); await sleep(1300);
const again = await label();
check('second hold: best kept', secs(again, 'Best') === secs(done3, 'Best') && secs(again, 'Last') < secs(again, 'Best'), again);

for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok ? '' : '   ' + r.info));
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(results.every(r => r.ok) && !errors.length ? 0 : 1);
