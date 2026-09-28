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
// The rest before every exercise ("Next: <name>, 100 reps"): instructions,
// then the countdown, then the "UP NEXT" card, without overlaps.
const restClashes = [];
for (let i = 0; i < n; i++) {
  await page.evaluate(i => {
    document.querySelector('#btnBack').emit('click');
    const app = document.querySelector('#stage').components['gym-app'];
    const { id, unit } = app.pages.single.items[i];
    app.startWorkout({ id: 'x', name: 'X', level: 'L', rest: 20, steps: [{ exercise: 'squats', reps: 1 }, { exercise: id, [unit === 'reps' ? 'reps' : 'seconds']: 100 }] });
    document.querySelector('#btnSkip').emit('click');
  }, i);
  await sleep(200);
  const texts = await measure();
  out.push(...texts);
  const rep = texts.find(t => t.id === 'repText');
  const cardTop = await page.evaluate(() => {
    const f = document.querySelector('#nextFrame');
    return f.parentNode.object3D.position.y + f.getAttribute('height') / 2;
  });
  if (rep.bottom < cardTop + 0.02) restClashes.push(`${rep.text}: countdown bottom ${rep.bottom}, card top ${cardTop.toFixed(2)}`);
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
  // Plus the plank's longest "what's off" hint, after a first hold.
  const plank = app.pages.single.items.find(e => e.id === 'plank');
  const hint = { ...plank, name: 'Plank hint', state: () => ({ ...plank.state(), off: 'Face the floor (-80 deg)', best: 30 }) };
  for (const ex of [...app.pages.single.items, hint]) {
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
// Every text on a button (name, muscle), clear of its edges and of the
// exercise's picture (an a-plane with a src).
const labels = await page.evaluate(() => [...document.querySelectorAll('#menuPanel .button')].flatMap(btn => {
  const half = btn.getAttribute('geometry').width / 2, halfH = btn.getAttribute('geometry').height / 2;
  const pic = [...btn.querySelectorAll('a-plane')].find(p => p.getAttribute('material').src);
  const minX = pic ? pic.object3D.position.x + pic.getAttribute('width') / 2 : -half + 0.02;
  return [...btn.querySelectorAll('a-text')].map(t => {
    const w = new THREE.Box3().setFromObject(t.getObject3D('text')).applyMatrix4(new THREE.Matrix4().copy(btn.object3D.matrixWorld).invert());
    return { text: t.getAttribute('value'), ok: w.min.x > minX && w.max.x < half - 0.02 && w.min.y > -halfH + 0.01 && w.max.y < halfH - 0.01,
      left: +w.min.x.toFixed(2), right: +w.max.x.toFixed(2), half };
  });
}));
// Every exercise has its picture (tests/thumbnails.mjs makes them).
const missingPictures = await page.evaluate(async () => {
  const app = document.querySelector('#stage').components['gym-app'];
  const missing = [];
  for (const ex of app.pages.single.items) if (!(await fetch(`img/exercises/${ex.id}.png`)).ok) missing.push(ex.id);
  return missing;
});
// The menu panel stays clear of the floor and within reach of the eyes.
const menuSpan = await page.evaluate(() => {
  const b = new THREE.Box3().setFromObject(document.querySelector('#menuBg').object3D);
  return { bottom: +b.min.y.toFixed(2), top: +b.max.y.toFixed(2) };
});
const menuOk = menuSpan.bottom > 0.2 && menuSpan.top < 2.7;
// The safety notice's text stays inside its panel, above its button.
const safety = await page.evaluate(() => {
  const panel = document.querySelector('#safetyPanel').object3D;
  panel.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(panel.matrixWorld).invert();
  const t = new THREE.Box3().setFromObject(document.querySelector('#safetyText').getObject3D('text')).applyMatrix4(inv);
  const bg = document.querySelector('#safetyBg');
  const w = bg.getAttribute('width') / 2, h = bg.getAttribute('height') / 2;
  const btnTop = document.querySelector('#btnSafetyOk').object3D.position.y + 0.13;
  return { ok: t.min.x > -w + 0.05 && t.max.x < w - 0.05 && t.max.y < h && t.min.y > btnTop + 0.03,
    box: [t.min.x, t.max.x, t.min.y, t.max.y].map(v => +v.toFixed(2)) };
});
console.log(`${safety.ok ? 'inside  ' : 'OUTSIDE '} safety notice text ${JSON.stringify(safety.box)}`);
console.log(`${menuOk ? 'inside  ' : 'OUTSIDE '} menu panel from ${menuSpan.bottom} to ${menuSpan.top} m above the floor`);
for (const l of labels) console.log(`${l.ok ? 'inside  ' : 'OUTSIDE '} [${l.left}, ${l.right}] in ±${l.half} button: ${l.text}`);
for (const m of missingPictures) console.log(`MISSING picture img/exercises/${m}.png (run tests/thumbnails.mjs)`);
for (const c of restClashes) console.log(`OVERLAP rest countdown runs into the "up next" card: ${c}`);
for (const o of overlaps) console.log(`OVERLAP instructions (bottom ${o.bottom}) run into the counter: ${o.text}`);
for (const o of out) console.log(`${outside(o) ? "OUTSIDE " : "inside  "} [${o.left}, ${o.right}] ${String(o.width).padEnd(5)} ${o.id.padEnd(14)} ${o.text}`);
await browser.close();
process.exit(out.some(outside) || overlaps.length || restClashes.length || missingPictures.length || labels.some(l => !l.ok) || !menuOk || !safety.ok || floorTexts.some(f => !f.ok) ? 1 : 0);
