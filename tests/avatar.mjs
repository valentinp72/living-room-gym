// Geometric checks of the demo mannequin: floor contact, planted feet, no leaking poses.
import { launch } from './lib.mjs';

const [url, shot] = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('a-scene')?.hasLoaded, { timeout: 20000 });

const open = async i => {
  await page.evaluate(() => document.querySelector('#btnBack').emit('click'));
  await page.evaluate(i => document.querySelectorAll('#menuButtons > *')[i].emit('click'), i);
  await sleep(200);
};

// Pose the mannequin at time t (synchronously, so no tick interferes) and
// measure world-space boxes of body parts, grouped by the joint they hang on.
const measure = t => page.evaluate(async t => {
  const app = document.querySelector('#stage').components['gym-app'];
  const { resetPose } = await import('/js/avatar.js');
  const p = app.mannequin;
  resetPose(p);
  app.current.ex.demo(p, t);
  p.root.object3D.updateMatrixWorld(true);
  const box = el => {
    const b = new THREE.Box3();
    for (const c of el.children) if (c.tagName !== 'A-ENTITY') b.expandByObject(c.getObject3D('mesh'));
    return { minY: b.min.y, maxY: b.max.y, cx: (b.min.x + b.max.x) / 2, cz: (b.min.z + b.max.z) / 2 };
  };
  const all = new THREE.Box3().expandByObject(p.root.object3D);
  const r = n => Math.round(n * 1000) / 1000;
  const parts = {};
  for (const k of ['spine', 'head', 'elbowL', 'elbowR', 'kneeL', 'kneeR', 'ankleL', 'ankleR']) {
    const b = box(p[k]); parts[k] = Object.fromEntries(Object.entries(b).map(([a, v]) => [a, r(v)]));
  }
  return { minY: r(all.min.y), maxY: r(all.max.y), parts, pelvisRot: r(p.pelvis.object3D.rotation.x) };
}, t);

const results = [];
const check = (name, ok, info = '') => results.push({ ok, name, info });
const near = (a, b, tol = 0.015) => Math.abs(a - b) <= tol;

// Squats: sample a full cycle.
await open(0);
const sq = [];
for (let i = 0; i <= 8; i++) sq.push(await measure(i * (2 * Math.PI / 1.6) / 8));
const stand = sq[0], bottom = sq[4];
check('squat: standing on floor', near(stand.minY, 0), `minY=${stand.minY}`);
check('squat: ~1.75 m tall', stand.maxY > 1.65 && stand.maxY < 1.85, `maxY=${stand.maxY}`);
check('squat: never below floor', sq.every(s => s.minY > -0.015), sq.map(s => s.minY).join(' '));
check('squat: feet flat on floor all cycle', sq.every(s => near(s.parts.ankleL.minY, 0) && near(s.parts.ankleR.minY, 0)),
  sq.map(s => s.parts.ankleL.minY).join(' '));
check('squat: feet do not slide', sq.every(s => near(s.parts.ankleL.cx, stand.parts.ankleL.cx) && near(s.parts.ankleL.cz, stand.parts.ankleL.cz)));
check('squat: goes deep (head drops > 35 cm)', stand.parts.head.maxY - bottom.parts.head.maxY > 0.35,
  `drop=${(stand.parts.head.maxY - bottom.parts.head.maxY).toFixed(2)}`);
if (shot) { await page.evaluate(() => { document.querySelector('#stage').components['gym-app'].clock = 1.96; }); await sleep(50); await page.screenshot({ path: shot + '-squat.png' }); }

// Curls: hands rise while the upper arms stay put; feet on floor.
await open(1);
const cu = [];
for (let i = 0; i <= 4; i++) cu.push(await measure(i * Math.PI / 4));
check('curls: on floor', cu.every(c => near(c.minY, 0)), cu.map(c => c.minY).join(' '));
const handTop = c => Math.max(c.parts.elbowL.maxY, c.parts.elbowR.maxY);
check('curls: a forearm reaches up near the shoulder', cu.some(c => handTop(c) > 1.35), cu.map(handTop).join(' '));
check('curls: arms alternate', cu.some(c => Math.abs(c.parts.elbowL.maxY - c.parts.elbowR.maxY) > 0.2));

// Plank: supported by forearms + toes, body off the floor.
await open(2);
const pl = await measure(0);
check('plank: forearms on floor', near(pl.parts.elbowL.minY, 0) && near(pl.parts.elbowR.minY, 0), JSON.stringify(pl.parts.elbowL));
check('plank: toes on floor', near(pl.parts.ankleL.minY, 0, 0.02), JSON.stringify(pl.parts.ankleL));
check('plank: nothing below floor', pl.minY > -0.015, `minY=${pl.minY}`);
check('plank: torso off floor, low and roughly flat', pl.parts.spine.minY > 0.08 && pl.parts.spine.maxY < 0.6, JSON.stringify(pl.parts.spine));
check('plank: knees off floor', pl.parts.kneeL.minY > 0.05, JSON.stringify(pl.parts.kneeL));
if (shot) await page.screenshot({ path: shot + '-plank.png' });

// No pose carry-over: squats right after the plank starts standing upright.
await open(0);
const after = await measure(0);
check('no pose leak after plank', after.pelvisRot === 0 && near(after.minY, 0) && near(after.maxY, stand.maxY), JSON.stringify({ r: after.pelvisRot, minY: after.minY }));

await open(1);
if (shot) { await page.evaluate(() => { document.querySelector('#stage').components['gym-app'].clock = 0.8; }); await sleep(50); await page.screenshot({ path: shot + '-curls.png' }); }

for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok ? '' : '   ' + r.info));
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(results.every(r => r.ok) && !errors.length ? 0 : 1);
