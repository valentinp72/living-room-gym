// Screenshots of the demo poses, from the user's spot and around the mannequin.
// Usage: node views.mjs <url> <outPrefix> [exercise index:seconds ...]
// (default: every exercise at 0, 0.8 and 1.6 s). Not a test: look at them.
import { launch } from './lib.mjs';
const [url, out, ...wanted] = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 700 });
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('a-scene')?.hasLoaded);
await page.evaluate(() => document.querySelector('#camera').setAttribute('look-controls', 'enabled: false'));

// [exercise index, demo time, label]
const count = await page.evaluate(() => document.querySelectorAll('#menuButtons > *').length);
const poses = wanted.length
  ? wanted.map(w => { const [i, t] = w.split(':').map(Number); return [i, t, `${i}-${t}`]; })
  : [...Array(count).keys()].flatMap(i => [0, 0.8, 1.6].map(t => [i, t, `${i}-${t}`]));
// Camera spots relative to the avatar's root, in the avatar's own frame (+z = its front).
const views = { user: null, side: [3, 1.0, 0], front: [0, 1.0, 3], back34: [-2.2, 1.6, -2.2] };
for (const [i, t, name] of poses) {
  await page.evaluate(i => { document.querySelector('#btnBack').emit('click'); document.querySelectorAll('#menuButtons > *')[i].emit('click'); }, i);
  await sleep(100);
  // Freeze the demo at time t.
  await page.evaluate(t => { const a = document.querySelector('#stage').components['gym-app']; a.clock = t; a.freeze = a.freeze || (a.tick = ((orig) => function (tt, d) { orig.call(this, tt, 0); })(a.tick)); }, t);
  await sleep(100);
  for (const [v, off] of Object.entries(views)) {
    await page.evaluate(off => {
      const cam = document.querySelector('#camera').object3D;
      const root = document.querySelector('#mannequin').object3D;
      if (!off) { cam.position.set(0, 1.6, 0); cam.rotation.set(0, 0, 0); return; }
      root.updateMatrixWorld(true);
      // Offsets are full-size meters around the mannequin; it may be scaled.
      const p = new THREE.Vector3(...off).applyMatrix4(root.matrixWorld);
      cam.position.copy(p);
      const target = new THREE.Vector3(0, 0.7, 0).applyMatrix4(root.matrixWorld);
      cam.lookAt(target);
      cam.rotateY(Math.PI);
    }, off);
    await sleep(150);
    await page.screenshot({ path: `${out}-${name}-${v}.png` });
  }
}
await browser.close();
