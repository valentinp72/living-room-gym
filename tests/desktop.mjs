// Desktop: real mouse clicks on the panels (cursor rayOrigin: mouse).
import { launch } from './lib.mjs';
const [url] = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await launch({ safetyAccepted: false });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 800 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('a-scene')?.hasLoaded, { timeout: 20000 });
await sleep(300);
// Screen position of an element's center.
const screenOf = sel => page.evaluate(sel => {
  const el = Array.isArray(sel) ? document.querySelectorAll(sel[0])[sel[1]] : document.querySelector(sel);
  const scene = document.querySelector('a-scene'); scene.object3D.updateMatrixWorld(true);
  const p = new THREE.Vector3(); el.object3D.getWorldPosition(p); p.project(scene.camera);
  const r = scene.canvas.getBoundingClientRect();
  return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height];
}, sel);
const click = async sel => { const [x, y] = await screenOf(sel); await page.mouse.move(x, y); await sleep(100); await page.mouse.down(); await page.mouse.up(); await sleep(250); };
// Exercises are grouped (Standing, Floor, Chair...): pick the button's group first.
const groupOf = i => page.evaluate(i => document.querySelector('#stage').components['gym-app'].pages.single.buttons[i].group, i);
const clickItem = async i => { await click('#group-' + await groupOf(i)); await click(['#menuButtons > *', i]); };
const title = () => page.evaluate(() => document.querySelector('#exercisePanel').getAttribute('visible') ? document.querySelector('#exerciseTitle').getAttribute('value') : 'menu');
const results = [];
// First visit: the safety notice, not the menu; the mouse accepts it, and
// it's not shown again after a reload.
const visibleNow = sel => page.evaluate(s => document.querySelector(s).getAttribute('visible'), sel);
results.push({ ok: await visibleNow('#safetyPanel') && !(await visibleNow('#menuPanel')), name: 'safety notice first' });
results.push({ ok: !(await page.evaluate(() => [...document.querySelectorAll('#menuPanel .button')].some(b => b.classList.contains('clickable')))),
  name: 'menu not clickable behind the notice' });
await click('#btnSafetyOk');
results.push({ ok: !(await visibleNow('#safetyPanel')) && await visibleNow('#menuPanel'), name: 'I understand opens the menu' });
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('a-scene')?.hasLoaded, { timeout: 20000 });
await sleep(300);
results.push({ ok: !(await visibleNow('#safetyPanel')) && await visibleNow('#menuPanel'), name: 'notice remembered after a reload' });
// The menu opens on the training sets; exercises are on the other tab.
const visible = sel => page.evaluate(s => document.querySelector(s).getAttribute('visible'), sel);
results.push({ ok: await visible('#workoutButtons') && !(await visible('#menuButtons')), name: 'menu opens on training sets' });
await click('#tabSingle');
results.push({ ok: !(await visible('#workoutButtons')) && await visible('#menuButtons'), name: 'mouse switches tab' });
for (const [i, want] of [[2, 'PLANK HOLD - Abs'], [1, 'BICEP CURLS - Arms'], [0, 'SQUATS - Legs']]) {
  await clickItem(i);
  const got = await title(); results.push({ ok: got === want, name: 'mouse opens ' + want, got });
  await click('#btnBack');
  const m = await title(); results.push({ ok: m === 'menu', name: 'mouse Back', got: m });
}
// Every exercise button opens its own exercise.
const names = await page.evaluate(() => [...document.querySelectorAll('#menuButtons > *')].map(b => b.querySelector('a-text').getAttribute('value')));
for (const [i, name] of names.entries()) {
  await clickItem(i);
  const got = await title(); results.push({ ok: got.startsWith(name.toUpperCase() + ' - '), name: 'mouse opens ' + name, got });
  await click('#btnBack');
}
results.push({ ok: await visible('#menuButtons'), name: 'Back keeps the tab' });
await click('#tabSets');
results.push({ ok: await visible('#workoutButtons') && !(await visible('#menuButtons')), name: 'mouse switches back' });
for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok ? '' : ' got=' + r.got));
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(results.every(r => r.ok) && !errors.length ? 0 : 1);
