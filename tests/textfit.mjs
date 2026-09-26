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
// Where each text may go on the exercise panel (2.9 m wide): the title across
// the top, the instructions and counter in the left column, which ends 5 cm
// before the demo avatar's frame.
const frameLeft = await page.evaluate(() => {
  const f = document.querySelector('#demoFrame');
  return f.object3D.position.x - f.getAttribute('width') / 2;
});
const outside = o => o.id === 'exerciseTitle' ? o.left < -1.4 || o.right > 1.4 : o.left < -1.4 || o.right > frameLeft - 0.05;
// Instructions must stay above the counter.
const overlaps = [];
for (let i = 0; i < out.length; i++) {
  const o = out[i], rep = out.slice(i).find(r => r.id === 'repText');
  if (o.id === 'instrText' && rep && o.bottom < rep.top + 0.03) overlaps.push(o);
  if (o.id === 'repText' && o.bottom < -0.72) overlaps.push({ ...o, text: 'counter runs into the buttons: ' + o.text });
}
// Floor counter: every exercise's counter text (as in a training set, with
// the progress line) fits left of the small avatar and inside the plate.
const floorTexts = await page.evaluate(async () => {
  const app = document.querySelector('#stage').components['gym-app'];
  const t = document.querySelector('#floorLabelText'), label = document.querySelector('#floorLabel');
  const avatarLeft = document.querySelector('#floorAvatar').object3D.position.x - 0.2;   // lying: ~0.2 m each side
  const plate = label.querySelector('a-plane');
  const w = plate.getAttribute('width') / 2, h = plate.getAttribute('height') / 2;
  const out = [];
  for (const ex of app.pages.single.items) {
    t.setAttribute('value', ex.label(ex.state()) + '\n10 / 10' + (ex.unit === 'seconds' ? ' s' : ''));
    await new Promise(r => setTimeout(r, 50));
    label.object3D.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(t.getObject3D('text'))
      .applyMatrix4(new THREE.Matrix4().copy(label.object3D.matrixWorld).invert());
    out.push({ name: ex.name, ok: b.min.x > -w && b.max.x < avatarLeft && b.min.y > -h && b.max.y < h,
      box: [b.min.x, b.max.x, b.min.y, b.max.y].map(v => +v.toFixed(2)) });
  }
  return out;
});
for (const f of floorTexts) console.log(`${f.ok ? 'inside  ' : 'OUTSIDE '} floor counter ${JSON.stringify(f.box)} ${f.name}`);
// Menu labels inside their buttons.
await page.evaluate(() => document.querySelector('#btnBack').emit('click')); await sleep(200);
const labels = await page.evaluate(() => [...document.querySelectorAll('#menuPanel .button')].map(btn => {
  const t = btn.querySelector('a-text'), mesh = t.getObject3D('text');
  const w = new THREE.Box3().setFromObject(mesh).applyMatrix4(new THREE.Matrix4().copy(btn.object3D.matrixWorld).invert());
  const half = btn.getAttribute('geometry').width / 2;
  return { text: t.getAttribute('value'), ok: w.min.x > -half + 0.02 && w.max.x < half - 0.02, left: +w.min.x.toFixed(2), right: +w.max.x.toFixed(2), half };
}));
// The menu panel stays clear of the floor and within reach of the eyes.
const menuSpan = await page.evaluate(() => {
  const b = new THREE.Box3().setFromObject(document.querySelector('#menuBg').object3D);
  return { bottom: +b.min.y.toFixed(2), top: +b.max.y.toFixed(2) };
});
const menuOk = menuSpan.bottom > 0.2 && menuSpan.top < 2.7;
console.log(`${menuOk ? 'inside  ' : 'OUTSIDE '} menu panel from ${menuSpan.bottom} to ${menuSpan.top} m above the floor`);
for (const l of labels) console.log(`${l.ok ? 'inside  ' : 'OUTSIDE '} [${l.left}, ${l.right}] in ±${l.half} button: ${l.text}`);
for (const o of overlaps) console.log(`OVERLAP instructions (bottom ${o.bottom}) run into the counter: ${o.text}`);
for (const o of out) console.log(`${outside(o) ? "OUTSIDE " : "inside  "} [${o.left}, ${o.right}] ${String(o.width).padEnd(5)} ${o.id.padEnd(14)} ${o.text}`);
await browser.close();
process.exit(out.some(outside) || overlaps.length || labels.some(l => !l.ok) || !menuOk || floorTexts.some(f => !f.ok) ? 1 : 0);
