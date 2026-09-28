// Desktop: real mouse clicks on the panels (cursor rayOrigin: mouse).
import { launch, frames, wait } from './lib.mjs';
const [url] = process.argv.slice(2);
// The page's time, not real time (see the test clock in lib.mjs).
const sleep = ms => wait(page, ms);
const browser = await launch({ safetyAccepted: false });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 800 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('a-scene')?.hasLoaded);
await sleep(300);
// Screen position of an element's center.
const screenOf = sel => page.evaluate(sel => {
  const el = Array.isArray(sel) ? document.querySelectorAll(sel[0])[sel[1]] : document.querySelector(sel);
  const scene = document.querySelector('a-scene'); scene.object3D.updateMatrixWorld(true);
  const p = new THREE.Vector3(); el.object3D.getWorldPosition(p); p.project(scene.camera);
  const r = scene.canvas.getBoundingClientRect();
  return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height];
}, sel);
// Frames between steps: the mouse cursor re-aims its ray on scene ticks, and
// a click can change the layout (group chips).
const click = async sel => { await frames(page, 2); const [x, y] = await screenOf(sel); await page.mouse.move(x, y); await sleep(100); await frames(page, 3); await page.mouse.down(); await page.mouse.up(); await sleep(250); await frames(page, 2); };
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
await page.waitForFunction(() => document.querySelector('a-scene')?.hasLoaded);
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
// Every exercise button opens its own exercise: the first of each group
// with the mouse (a real click is slow on a runner drawing a few frames per
// second), all of them with a click event.
const names = await page.evaluate(() => [...document.querySelectorAll('#menuButtons > *')].map(b => b.querySelector('a-text').getAttribute('value')));
const firsts = await page.evaluate(() => {
  const buttons = document.querySelector('#stage').components['gym-app'].pages.single.buttons;
  return buttons.map((b, i) => i).filter(i => buttons.findIndex(b => b.group === buttons[i].group) === i);
});
for (const i of firsts) {
  await clickItem(i);
  const got = await title(); results.push({ ok: got.startsWith(names[i].toUpperCase() + ' - '), name: 'mouse opens ' + names[i], got });
  await click('#btnBack');
}
for (const [i, name] of names.entries()) {
  const got = await page.evaluate(i => {
    document.querySelectorAll('#menuButtons > *')[i].emit('click');
    const t = document.querySelector('#exerciseTitle').getAttribute('value');
    document.querySelector('#btnBack').emit('click');
    return t;
  }, i);
  results.push({ ok: got.startsWith(name.toUpperCase() + ' - '), name: 'button opens ' + name, got });
}
results.push({ ok: await visible('#menuButtons'), name: 'Back keeps the tab' });
await click('#tabSets');
results.push({ ok: await visible('#workoutButtons') && !(await visible('#menuButtons')), name: 'mouse switches back' });
// Installable web app: the manifest is linked and valid, and every icon and
// screenshot it lists exists, at the size it says.
const manifest = await page.evaluate(async () => {
  const link = document.querySelector('link[rel=manifest]');
  if (!link) return { error: 'no <link rel=manifest>' };
  const res = await fetch(link.href);
  if (!res.ok) return { error: 'manifest ' + res.status };
  const m = await res.json();
  const size = src => new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth + 'x' + img.naturalHeight);
    img.onerror = () => resolve('missing');
    img.src = new URL(src, link.href);
  });
  const bad = [];
  for (const f of [...m.icons, ...m.screenshots]) {
    const got = await size(f.src);
    if (got !== f.sizes) bad.push(`${f.src}: ${got}, says ${f.sizes}`);
  }
  return { name: m.name, start: m.start_url, display: m.display, maskable: m.icons.some(i => i.purpose === 'maskable'),
    big: m.icons.some(i => i.sizes === '512x512'), bad };
});
results.push({ ok: manifest.name === 'Living Room Gym' && manifest.start === './' && manifest.display === 'standalone' &&
  manifest.maskable && manifest.big && !manifest.bad?.length, name: 'web app manifest, icons and screenshots', got: JSON.stringify(manifest) });
for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok ? '' : ' got=' + r.got));
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(results.every(r => r.ok) && !errors.length ? 0 : 1);
