// Screenshots for the README, from the desktop preview (a dark virtual room:
// passthrough can't be captured here). Not a test.
// Usage: node screenshots.mjs <url> <outDir>, with www/ served, e.g.
//   python3 -m http.server --directory www 8000
//   node tests/screenshots.mjs http://127.0.0.1:8000/ docs/screenshots
// Needs ImageMagick (montage, convert) for the contact sheet and the GIF, and
// a graphics card: the software renderer garbles the text (see launch()).
// NO_GPU=1 forces the software renderer anyway.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { launch, frames } from './lib.mjs';

const [url, outDir] = process.argv.slice(2);
if (!url || !outDir) { console.error('Usage: node screenshots.mjs <url> <outDir>'); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await launch({ safetyAccepted: false, gpu: !process.env.NO_GPU });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('a-scene')?.hasLoaded, { timeout: 20000 });
const renderer = await page.evaluate(() => {
  const gl = document.querySelector('a-scene').renderer.getContext(), d = gl.getExtension('WEBGL_debug_renderer_info');
  return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
console.log('renderer:', renderer);
if (/swiftshader/i.test(renderer) && !process.env.NO_GPU) console.warn('warning: software rendering, text will look garbled');
await page.evaluate(() => {
  document.querySelector('#hint').style.display = 'none';
  document.querySelector('#camera').setAttribute('look-controls', 'enabled: false');
  // Freeze time: the tick runs with no time passing, so poses and counters
  // stay as set (the demo clock is set by hand below).
  const app = document.querySelector('#stage').components['gym-app'];
  const tick = app.tick;
  app.tick = function (t) { tick.call(this, t, 0); };
  window.app = app;
});
// JPEG keeps the README light (these are dark scenes without transparency).
const shot = async name => {
  await frames(page, 3); await sleep(150);
  await page.screenshot({ path: path.join(outDir, name + '.jpg'), type: 'jpeg', quality: 88 });
  console.log('wrote', name);
};
// Camera: at eye height where the user stands, or custom.
const camera = (pos = [0, 1.6, 0], rot = [0, 0, 0]) => page.evaluate((pos, rot) => {
  const o = document.querySelector('#camera').object3D;
  o.position.set(...pos); o.rotation.set(...rot.map(d => d * Math.PI / 180), 'YXZ');
}, pos, rot);
const set = fn => page.evaluate(fn);

// 1. Safety notice (first launch).
await camera([0, 1.45, -0.6]);
await shot('safety');

// 2. Menu: training sets, then single exercises (floor group).
await page.evaluate(() => document.querySelector('#btnSafetyOk').emit('click'));
await camera([0, 1.45, -0.55]);
await shot('menu-sets');
await set(() => { document.querySelector('#tabSingle').emit('click'); document.querySelector('#group-floor').emit('click'); });
await shot('menu-exercises');

// 3. A training set step: chair dips, 4 of 6, with the avatar mid-dip.
await set(() => {
  const set = app.pages.sets.items.find(w => w.id === 'chair-easy');
  app.startWorkout(set);
  app.run.index = 3; app.run.phase = 'exercise';
  app.run.ex = app.pages.single.items.find(e => e.id === 'chair-dips'); app.run.st = app.run.ex.state();
  Object.assign(app.run.st.calib, { mode: null, baselineY: 1.0 }); app.run.st.reps = 4;
  app.showStep(); app.clock = 1.4;
});
await camera([0, 1.5, -0.6]);
await shot('exercise');

// 4. The same step, with confetti (as when a step is done).
await set(() => app.throwConfetti(260));
await page.evaluate(() => { const c = document.querySelector('#confetti').components.confetti; for (let i = 0; i < 14; i++) c.tick(0, 33); });
await shot('confetti');
await page.evaluate(() => { const c = document.querySelector('#confetti').components.confetti; c.tick(0, 5000); });

// 5. Rest between steps.
await set(() => { app.run.phase = 'rest'; app.run.restLeft = 14.2; app.showStep(); });
await shot('rest');

// 6. Plank: the counter and small avatar on the floor, seen from the plank.
await set(() => {
  document.querySelector('#btnBack').emit('click');
  app.startExercise(app.pages.single.items.find(e => e.id === 'plank'));
  Object.assign(app.current.st, { holding: true, time: 23.4, best: 41.2, ref: 0.35 });
});
await camera([0.1, 0.55, 0.05], [-68, -6, 0]);
await shot('plank-floor');

// 7. The coach: close-ups of demos, in one contact sheet.
const demos = [['squats', 2], ['push-ups', 1.5], ['side-plank-right', 0], ['bird-dogs', 1.5],
  ['split-squats-left', 2], ['incline-push-ups', 1.5], ['band-rows', 1.25], ['shoulder-press', 1.25]];
const tiles = [];
await page.setViewport({ width: 480, height: 480 });
// Only the avatar and its frame: hide the panel's texts and buttons.
await set(() => {
  for (const el of document.querySelectorAll('#exercisePanel > *')) {
    if (!['demoAvatar', 'demoFrame'].includes(el.id)) el.object3D.visible = false;
  }
  document.querySelector('#floorLabel').object3D.visible = false;
});
for (const [id, t] of demos) {
  await set(() => document.querySelector('#btnBack').emit('click'));
  await page.evaluate((id, t) => {
    app.startExercise(app.pages.single.items.find(e => e.id === id)); app.clock = t;
    for (const el of document.querySelectorAll('#exercisePanel > *')) {
      if (!['demoAvatar', 'demoFrame'].includes(el.id)) el.object3D.visible = false;
    }
  }, id, t);
  await page.evaluate(() => {
    const cam = document.querySelector('#camera').object3D, holder = document.querySelector('#demoAvatar').object3D;
    holder.updateMatrixWorld(true);
    const target = new THREE.Vector3(0, 0.8, 0).applyMatrix4(holder.matrixWorld);
    cam.position.copy(new THREE.Vector3(0, 1.0, 2.1).applyMatrix4(holder.matrixWorld)); cam.lookAt(target); cam.rotateY(Math.PI);
  });
  const file = path.join(outDir, `.tile-${id}.png`);
  await frames(page, 3); await sleep(100);
  await page.screenshot({ path: file });
  tiles.push(file);
}
execFileSync('montage', [...tiles, '-tile', '4x', '-geometry', '260x260+4+4', '-background', '#0d1117', '-quality', '88', path.join(outDir, 'coach.jpg')]);
tiles.forEach(f => fs.unlinkSync(f));
console.log('wrote coach');

// 8. An animated demo (squats), as a GIF.
await set(() => document.querySelector('#btnBack').emit('click'));
await page.evaluate(() => app.startExercise(app.pages.single.items.find(e => e.id === 'squats')));
const gifFrames = [];
for (let i = 0; i < 24; i++) {
  await page.evaluate(t => { app.clock = t; }, i * (2 * Math.PI / 1.6) / 24);
  await page.evaluate(() => {
    const cam = document.querySelector('#camera').object3D, holder = document.querySelector('#demoAvatar').object3D;
    holder.updateMatrixWorld(true);
    const target = new THREE.Vector3(0, 0.85, 0).applyMatrix4(holder.matrixWorld);
    cam.position.copy(new THREE.Vector3(0.3, 1.0, 2.0).applyMatrix4(holder.matrixWorld)); cam.lookAt(target); cam.rotateY(Math.PI);
  });
  const file = path.join(outDir, `.gif-${String(i).padStart(2, '0')}.png`);
  await frames(page, 2);
  await page.screenshot({ path: file });
  gifFrames.push(file);
}
execFileSync('convert', ['-delay', '16', '-loop', '0', ...gifFrames, '-resize', '280x', '-layers', 'Optimize', path.join(outDir, 'squats.gif')]);
gifFrames.forEach(f => fs.unlinkSync(f));
console.log('wrote squats.gif');

await browser.close();
