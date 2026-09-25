// XR pointing (bare hands and controllers): ray visibility and select-to-click, on a fake XR session.
import { launch } from './lib.mjs';
import { installFakeXR } from './fakexr.mjs';
const [url] = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('a-scene')?.hasLoaded, { timeout: 20000 });
await installFakeXR(page);

// Point one side at an element's center (sel, or [sel, index]) from near the chest.
const point = (side, kind, target) => page.evaluate((side, kind, target) => {
  const el = Array.isArray(target) ? document.querySelectorAll(target[0])[target[1]] : document.querySelector(target);
  document.querySelector('a-scene').object3D.updateMatrixWorld(true);
  const p = new THREE.Vector3(); el.object3D.getWorldPosition(p);
  const from = [side === 'right' ? 0.25 : -0.25, 1.2, -0.3];
  Object.assign(fakeXR.hands[side], { kind, lost: false, ray: { from, to: [p.x, p.y, p.z] } });
}, side, kind, target);
const lose = side => page.evaluate(s => { fakeXR.hands[s].lost = true; }, side);
const pinch = async side => { await sleep(150); await page.evaluate(s => fakeSelect(s), side); await sleep(100); };
const screen = () => page.evaluate(() => document.querySelector('#exercisePanel').getAttribute('visible') ? document.querySelector('#exerciseTitle').getAttribute('value') : 'menu');
const pointers = () => page.evaluate(() => ['#leftPointer', '#rightPointer'].map(s => document.querySelector(s).object3D.visible));

const results = [];
const expect = (name, got, want) => results.push({ name, ok: JSON.stringify(got) === JSON.stringify(want), got, want });

await sleep(150);
expect('no hands: no pointer rays', await pointers(), [false, false]);
await point('right', 'hand', '#tabSingle');
await sleep(150);
expect('tracked right hand: right ray shown', await pointers(), [false, true]);
await pinch('right');
expect('pinch switches the menu tab', await page.evaluate(() => document.querySelector('#menuButtons').getAttribute('visible')), true);
await point('right', 'hand', ['#menuButtons > *', 0]);
await pinch('right');
expect('pinch opens Squats', await screen(), 'SQUATS - Legs');
await point('right', 'hand', '#btnBack');
await pinch('left');
expect('left pinch does not click with right ray', await screen(), 'SQUATS - Legs');
await pinch('right');
expect('pinch Back returns to menu', await screen(), 'menu');
// Controllers use the same pointer: ray shown, trigger clicks once.
await point('right', 'controller', ['#menuButtons > *', 1]);
await sleep(150);
expect('controller: ray shown', await pointers(), [false, true]);
await pinch('right');
expect('controller trigger opens Bicep Curls', await screen(), 'BICEP CURLS - Arms');
await point('right', 'controller', '#btnBack'); await pinch('right');
expect('controller trigger on Back', await screen(), 'menu');
await page.evaluate(() => { fakeXR.hands.right.lost = true; });
// Left hand works too, and pinching Recenter moves the stage.
await point('left', 'hand', '#btnRecenterMenu');
await page.evaluate(() => { const o = document.querySelector('#camera').object3D; o.position.set(1, 1.6, 1); o.rotation.set(0, Math.PI / 2, 0); });
await pinch('left');
const st = await page.evaluate(() => { const o = document.querySelector('#stage').object3D; return [o.position.x, o.position.z].map(n => Math.round(n * 100) / 100); });
expect('left pinch on Recenter', st, [1, 1]);
await lose('left'); await sleep(150);
expect('lost hand hides its ray', await pointers(), [false, false]);

for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok ? '' : `  got=${JSON.stringify(r.got)} want=${JSON.stringify(r.want)}`));
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(results.every(r => r.ok) && !errors.length ? 0 : 1);
