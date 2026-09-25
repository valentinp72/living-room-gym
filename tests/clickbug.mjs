// Regression: one trigger pull / pinch must click exactly the button the
// hand points at, whatever the head looks at, inside an XR session.
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
// Enter "AR" the way A-Frame does, so every component sees enter-vr with a session.
await page.evaluate(() => {
  document.querySelector('#camera').setAttribute('look-controls', 'enabled: false');
  const s = document.querySelector('a-scene'); s.addState('ar-mode'); s.emit('enter-vr', { target: s });
});
await sleep(800);   // past the auto-recenter
// Record every exercise start.
await page.evaluate(() => {
  const app = document.querySelector('#stage').components['gym-app'];
  window.starts = [];
  const orig = app.startExercise.bind(app);
  app.startExercise = ex => { starts.push(ex.name); orig(ex); };
});
const lookAt = sel => page.evaluate(sel => {
  const el = Array.isArray(sel) ? document.querySelectorAll(sel[0])[sel[1]] : document.querySelector(sel);
  const cam = document.querySelector('#camera').object3D;
  const p = new THREE.Vector3(); document.querySelector('a-scene').object3D.updateMatrixWorld(true); el.object3D.getWorldPosition(p);
  cam.position.set(0, 1.6, 0); cam.lookAt(p); cam.rotateY(Math.PI); cam.updateMatrixWorld(true);
}, sel);
const point = (side, kind, sel) => page.evaluate((side, kind, sel) => {
  const el = Array.isArray(sel) ? document.querySelectorAll(sel[0])[sel[1]] : document.querySelector(sel);
  const p = new THREE.Vector3(); document.querySelector('a-scene').object3D.updateMatrixWorld(true); el.object3D.getWorldPosition(p);
  Object.assign(fakeXR.hands[side], { kind, lost: false, ray: { from: [side === 'right' ? 0.25 : -0.25, 1.1, -0.3], to: [p.x, p.y, p.z] } });
}, side, kind, sel);
const back = () => page.evaluate(() => document.querySelector('#btnBack').emit('click'));

const results = [];
const expect = (name, got, want) => results.push({ name, ok: JSON.stringify(got) === JSON.stringify(want), got, want });

await page.evaluate(() => document.querySelector('#tabSingle').emit('click'));
for (const kind of ['hand', 'controller']) {
  // Head looks at Squats, hand points at Plank Hold, left hand points at Bicep Curls.
  await lookAt(['#menuButtons > *', 0]);
  await point('right', kind, ['#menuButtons > *', 2]);
  await point('left', kind, ['#menuButtons > *', 1]);
  await sleep(200);
  await page.evaluate(() => { starts.length = 0; fakeSelect('right'); });
  await sleep(200);
  expect(`${kind}: right select opens only Plank`, await page.evaluate(() => starts), ['Plank Hold']);
  await back(); await sleep(200);
}

for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok ? '' : `  got=${JSON.stringify(r.got)} want=${JSON.stringify(r.want)}`));
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(results.every(r => r.ok) && !errors.length ? 0 : 1);
