// Measures the rendered width of every a-text on the exercise panel against the
// panel (2.4 m) on each screen, and fails if any text sticks out.
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
  return { id: t.id, width: +((b.max.x - b.min.x) * s).toFixed(2), left: +w.min.x.toFixed(2), right: +w.max.x.toFixed(2), text: t.getAttribute('value').slice(0, 40) };
}));
const out = [];
for (const [i, sel] of [[0], [1], [2]]) {
  await page.evaluate(i => { document.querySelector('#btnBack').emit('click'); document.querySelectorAll('#menuButtons > *')[i].emit('click'); }, i);
  await sleep(300); out.push(...await measure());
}
await page.evaluate(() => { document.querySelector('#btnBack').emit('click'); const app = document.querySelector('#stage').components['gym-app']; app.startWorkout({ id: 'x', name: 'X', level: 'L', rest: 20, steps: [{ exercise: 'squats', reps: 1 }, { exercise: 'plank', seconds: 20 }] }); });
await sleep(300); out.push(...await measure());
await page.evaluate(() => document.querySelector('#btnSkip').emit('click')); await sleep(300); out.push(...await measure());
for (const o of out) console.log(`${o.left < -1.2 || o.right > 1.2 ? "OUTSIDE " : "inside  "} [${o.left}, ${o.right}] ${String(o.width).padEnd(5)} ${o.id.padEnd(14)} ${o.text}`);
await browser.close();
process.exit(out.some(o => o.left < -1.2 || o.right > 1.2) ? 1 : 0);
