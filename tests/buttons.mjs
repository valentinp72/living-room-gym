// Casts the right controller's ray at each visible button from several body
// positions (standing, kneeling, lying in plank) and checks what it hits first.
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

// Name a clickable entity by its label text (or id).
const nameFn = `el => el ? (el.id || el.querySelector('a-text')?.getAttribute('value')) : 'nothing'`;
// Aim the right XR pointer from `from` at the center of `target` and return what its ray hits first.
const aim = async (from, targetSel) => {
  const target = await page.evaluate((from, targetSel, nameFn) => {
    const name = eval(nameFn);
    const target = typeof targetSel === 'string' ? document.querySelector(targetSel) : document.querySelectorAll(targetSel[0])[targetSel[1]];
    document.querySelector('a-scene').object3D.updateMatrixWorld(true);
    const tp = new THREE.Vector3(); target.object3D.getWorldPosition(tp);
    Object.assign(fakeXR.hands.right, { kind: 'controller', lost: false, ray: { from, to: [tp.x, tp.y, tp.z] } });
    return name(target);
  }, from, targetSel, nameFn);
  // Two animation frames: at least one full scene tick has moved the
  // pointer (a fixed sleep could miss one on a busy machine and read the
  // previous aim).
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const hit = await page.evaluate(nameFn => {
    const name = eval(nameFn);
    const el = document.querySelector('#rightPointer');
    el.object3D.updateMatrixWorld(true);
    const rc = el.components.raycaster; rc.refreshObjects(); rc.checkIntersections();
    return name(rc.intersectedEls[0]);
  }, nameFn);
  return { target, hit };
};

const open = i => page.evaluate(i => { document.querySelector('#btnBack').emit('click'); document.querySelectorAll('#menuButtons > *')[i].emit('click'); }, i);
const spots = { standing: [0.2, 1.1, -0.3], kneeling: [0.2, 0.6, -0.3], plank: [0.15, 0.12, 0.1], plankFar: [0.15, 0.1, -0.6] };
const results = [];
const check = r => results.push({ ...r, ok: r.hit === r.target });

// Exercise screen buttons, for every exercise (hidden menu buttons sit in front of them).
for (const ex of [0, 1, 2]) {
  await open(ex); await sleep(150);
  for (const [spot, from] of Object.entries(spots))
    for (const b of ['#btnBack', '#btnRecenter']) check({ screen: 'exercise ' + ex, spot, ...(await aim(from, b)) });
}
// Menu buttons (exercise panel hidden), on both tabs and in every group:
// the hidden tab's and groups' buttons sit exactly where the shown ones are.
await page.evaluate(() => document.querySelector('#btnBack').emit('click')); await sleep(150);
for (const [tab, page_, list] of [['#tabSets', 'sets', '#workoutButtons'], ['#tabSingle', 'single', '#menuButtons']]) {
  await page.evaluate(t => document.querySelector(t).emit('click'), tab); await sleep(100);
  const groups = await page.evaluate(p => document.querySelector('#stage').components['gym-app'].pages[p].groups.map(g => g.id), page_);
  for (const g of groups) {
    await page.evaluate(g => document.querySelector('#group-' + g).emit('click'), g); await sleep(50);
    const shown = await page.evaluate((p, g) => document.querySelector('#stage').components['gym-app'].pages[p].buttons
      .map((b, i) => b.group === g ? i : -1).filter(i => i >= 0), page_, g);
    for (const [spot, from] of Object.entries(spots)) {
      for (const i of shown) check({ screen: 'menu', spot, ...(await aim(from, [list + ' > *', i])) });
    }
  }
  for (const [spot, from] of Object.entries(spots)) {
    for (const t of ['#tabSets', '#tabSingle', ...groups.map(g => '#group-' + g)]) check({ screen: 'menu', spot, ...(await aim(from, t)) });
  }
}
for (const [spot, from] of Object.entries(spots)) check({ screen: 'menu', spot, ...(await aim(from, '#btnRecenterMenu')) });

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.screen.padEnd(11)} ${r.spot.padEnd(9)} aim=${r.target.padEnd(20)} hit=${r.hit}`);
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(results.every(r => r.ok) && !errors.length ? 0 : 1);
