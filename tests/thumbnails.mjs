// Pictures of the coach for the single exercises menu (one per exercise,
// www/img/exercises/<id>.png, transparent background). Not a test: run it
// when an exercise is added or its demo changes, then look at them.
// Usage: node thumbnails.mjs <url> <outDir>, with www/ served, e.g.
//   python3 -m http.server --directory www 8000
//   node tests/thumbnails.mjs http://127.0.0.1:8000/ www/img/exercises
// Each picture shows the demo at its most telling moment: the time, over
// the first 6 s, when the pose is furthest from standing.
import fs from 'node:fs';
import path from 'node:path';
import { launch, frames } from './lib.mjs';

const [url, outDir] = process.argv.slice(2);
if (!url || !outDir) { console.error('Usage: node thumbnails.mjs <url> <outDir>'); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const SIZE = 160;   // pixels

const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: SIZE, height: SIZE });
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('a-scene')?.hasLoaded, { timeout: 20000 });
const ids = await page.evaluate(() => {
  document.querySelector('#hint').style.display = 'none';
  document.documentElement.style.background = document.body.style.background = 'transparent';
  const scene = document.querySelector('a-scene');
  scene.removeAttribute('xr-environment');
  scene.object3D.background = null;
  scene.renderer.setClearColor(0x000000, 0);   // transparent
  for (const el of document.querySelectorAll('.flat-only')) el.object3D.visible = false;
  document.querySelector('#camera').setAttribute('look-controls', 'enabled: false');
  // A narrow lens from further away: close up, near limbs looked huge.
  document.querySelector('#camera').setAttribute('camera', 'fov', 20);
  // Freeze time: poses stay as set by the clock below.
  const app = document.querySelector('#stage').components['gym-app'];
  const tick = app.tick;
  app.tick = function (t) { tick.call(this, t, 0); };
  window.app = app;
  return app.pages.single.items.map(e => e.id);
});

for (const id of ids) {
  await page.evaluate(async id => {
    const { resetPose } = await import('/js/avatar.js' + new URL(document.querySelector('script[type=module]').src).search);
    const ex = app.pages.single.items.find(e => e.id === id);
    app.startExercise(ex);
    // Only the coach (and its props).
    for (const el of document.querySelectorAll('#exercisePanel > *')) if (el.id !== 'demoAvatar') el.object3D.visible = false;
    document.querySelector('#floorLabel').object3D.visible = false;
    // The most telling moment: joints bent the most, pelvis moved the most.
    const p = app.mannequin, JOINTS = ['spine', 'head', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR'];
    resetPose(p);
    const standY = p.pelvis.object3D.position.y;
    let best = 0, bestScore = -1;
    for (let t = 0; t <= 6; t += 0.05) {
      resetPose(p); ex.demo(p, t);
      const r = o => Math.abs(o.rotation.x) + Math.abs(o.rotation.y) + Math.abs(o.rotation.z);
      const score = JOINTS.reduce((s, k) => s + r(p[k].object3D), 0) + r(p.pelvis.object3D) +
        3 * Math.abs(p.pelvis.object3D.position.y - standY);
      if (score > bestScore + 1e-6) { bestScore = score; best = t; }
    }
    app.clock = best;
    app.tick(0);
    // Frame it: the camera looks at the coach from the front and a little
    // above (as the user sees it), far enough for the whole pose to fit.
    const holder = document.querySelector('#demoAvatar').object3D;
    holder.updateMatrixWorld(true);
    p.root.object3D.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(p.root.object3D, true);
    const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const extent = Math.max(size.x, size.y, size.z);
    const cam = document.querySelector('#camera');
    const fov = cam.getAttribute('camera').fov * Math.PI / 180;
    const dir = new THREE.Vector3(0, 0.35, 1).normalize().transformDirection(holder.matrixWorld);
    const o = cam.object3D;
    o.position.copy(c).addScaledVector(dir, extent * 0.62 / Math.tan(fov / 2));
    o.lookAt(c); o.rotateY(Math.PI);   // lookAt points an object's +z; a camera looks along -z
  }, id);
  await frames(page, 3);
  const file = path.join(outDir, id + '.png');
  await page.screenshot({ path: file, omitBackground: true });
  console.log('wrote', file);
}
await browser.close();
