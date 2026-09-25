// Measures the rendered size of every a-text on the exercise panel on each
// screen (every exercise, and a training set with its longest instructions),
// and of the menu button labels. Fails if a text sticks out of its panel or
// button, or if the instructions run into the counter.
import { launch } from './lib.mjs';
const [url] = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await launch();
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('a-scene')?.hasLoaded);
const measure = () => page.evaluate(() => [...document.querySelectorAll('#exercisePanel a-text[id]')].map(t => {
  const mesh = t.getObject3D('text'); mesh.geometry.computeBoundingBox();
  const b = mesh.geometry.boundingBox; const s = mesh.scale.x;
  const w = new THREE.Box3().setFromObject(mesh); const inv = new THREE.Matrix4().copy(document.querySelector('#exercisePanel').object3D.matrixWorld).invert(); w.applyMatrix4(inv);
  return { id: t.id, width: +((b.max.x - b.min.x) * s).toFixed(2), left: +w.min.x.toFixed(2), right: +w.max.x.toFixed(2),
    bottom: +w.min.y.toFixed(2), top: +w.max.y.toFixed(2), text: t.getAttribute('value').slice(0, 40) };
}));
const out = [];
const n = await page.evaluate(() => document.querySelectorAll('#menuButtons > *').length);
for (let i = 0; i < n; i++) {
  await page.evaluate(i => { document.querySelector('#btnBack').emit('click'); document.querySelectorAll('#menuButtons > *')[i].emit('click'); }, i);
  await sleep(300); out.push(...await measure());
}
await page.evaluate(() => { document.querySelector('#btnBack').emit('click'); const app = document.querySelector('#stage').components['gym-app']; app.startWorkout({ id: 'x', name: 'X', level: 'L', rest: 20, steps: [{ exercise: 'squats', reps: 1 }, { exercise: 'plank', seconds: 20 }] }); });
await sleep(300); out.push(...await measure());
await page.evaluate(() => document.querySelector('#btnSkip').emit('click')); await sleep(300); out.push(...await measure());
// A training set step with every exercise's instructions (the "10 reps. " prefix makes them longest).
for (let i = 0; i < n; i++) {
  await page.evaluate(i => {
    document.querySelector('#btnBack').emit('click');
    const app = document.querySelector('#stage').components['gym-app'];
    const id = app.pages.single.items[i].id, unit = app.pages.single.items[i].unit;
    app.startWorkout({ id: 'x', name: 'X', level: 'L', rest: 20, steps: [{ exercise: id, [unit === 'reps' ? 'reps' : 'seconds']: 100 }] });
  }, i);
  await sleep(200); out.push(...await measure());
}
// Instructions must stay above the counter.
const overlaps = [];
for (let i = 0; i < out.length; i++) {
  const o = out[i], rep = out.slice(i).find(r => r.id === 'repText');
  if (o.id === 'instrText' && rep && o.bottom < rep.top + 0.03) overlaps.push(o);
  if (o.id === 'repText' && o.bottom < -0.62) overlaps.push({ ...o, text: 'counter runs into the buttons: ' + o.text });
}
// Menu labels inside their buttons.
await page.evaluate(() => document.querySelector('#btnBack').emit('click')); await sleep(200);
const labels = await page.evaluate(() => [...document.querySelectorAll('#menuPanel .button')].map(btn => {
  const t = btn.querySelector('a-text'), mesh = t.getObject3D('text');
  const w = new THREE.Box3().setFromObject(mesh).applyMatrix4(new THREE.Matrix4().copy(btn.object3D.matrixWorld).invert());
  const half = btn.getAttribute('geometry').width / 2;
  return { text: t.getAttribute('value'), ok: w.min.x > -half + 0.02 && w.max.x < half - 0.02, left: +w.min.x.toFixed(2), right: +w.max.x.toFixed(2), half };
}));
for (const l of labels) console.log(`${l.ok ? 'inside  ' : 'OUTSIDE '} [${l.left}, ${l.right}] in ±${l.half} button: ${l.text}`);
for (const o of overlaps) console.log(`OVERLAP instructions (bottom ${o.bottom}) run into the counter: ${o.text}`);
for (const o of out) console.log(`${o.left < -1.2 || o.right > 1.2 ? "OUTSIDE " : "inside  "} [${o.left}, ${o.right}] ${String(o.width).padEnd(5)} ${o.id.padEnd(14)} ${o.text}`);
await browser.close();
process.exit(out.some(o => o.left < -1.2 || o.right > 1.2) || overlaps.length || labels.some(l => !l.ok) ? 1 : 0);
