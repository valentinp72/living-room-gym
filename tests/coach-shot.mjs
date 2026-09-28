// Renders the coach alone, on a transparent background, for pictures made
// from the app itself (menu pictures: thumbnails.mjs, app icons: icons.mjs).
import { launch, frames } from './lib.mjs';

// Opens the app at `url` on a square viewport of `size` pixels, ready to
// shoot. Returns { browser, page, ids } (ids: every exercise, menu order).
export async function openCoach(url, size) {
  const browser = await launch();
  const page = await browser.newPage();
  await page.setViewport({ width: size, height: size });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('a-scene')?.hasLoaded);
  const ids = await page.evaluate(() => {
    document.querySelector('#hint').style.display = 'none';
    document.documentElement.style.background = document.body.style.background = 'transparent';
    const scene = document.querySelector('a-scene');
    scene.removeAttribute('xr-environment');
    scene.object3D.background = null;
    scene.renderer.setClearColor(0x000000, 0);   // transparent
    for (const el of document.querySelectorAll('.flat-only')) el.object3D.visible = false;
    const cam = document.querySelector('#camera');
    cam.setAttribute('look-controls', 'enabled: false');
    // A narrow lens from further away: close up, near limbs looked huge.
    cam.setAttribute('camera', 'fov', 20);
    // Freeze time: poses stay as set by the clock (see shootCoach()).
    const app = document.querySelector('#stage').components['gym-app'];
    const tick = app.tick;
    app.tick = function (t) { tick.call(this, t, 0); };
    window.app = app;
    return app.pages.single.items.map(e => e.id);
  });
  return { browser, page, ids };
}

// Shoots exercise `id`'s demo to `file` (PNG, transparent). At time `t`, or
// by default at its most telling moment: the time, over the first 6 s, when
// the pose is furthest from standing (joints bent, pelvis moved). `fill`:
// how much of the picture the pose's largest side takes.
export async function shootCoach(page, id, file, { t = null, fill = 0.8 } = {}) {
  await page.evaluate(async (id, t, fill) => {
    const { resetPose } = await import('/js/avatar.js' + new URL(document.querySelector('script[type=module]').src).search);
    const ex = app.pages.single.items.find(e => e.id === id);
    app.startExercise(ex);
    // Only the coach (and its props).
    for (const el of document.querySelectorAll('#exercisePanel > *')) if (el.id !== 'demoAvatar') el.object3D.visible = false;
    document.querySelector('#floorLabel').object3D.visible = false;
    const p = app.mannequin, JOINTS = ['spine', 'head', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR'];
    if (t === null) {
      resetPose(p);
      const standY = p.pelvis.object3D.position.y;
      let bestScore = -1;
      for (let s = 0; s <= 6; s += 0.05) {
        resetPose(p); ex.demo(p, s);
        const r = o => Math.abs(o.rotation.x) + Math.abs(o.rotation.y) + Math.abs(o.rotation.z);
        const score = JOINTS.reduce((sum, k) => sum + r(p[k].object3D), 0) + r(p.pelvis.object3D) +
          3 * Math.abs(p.pelvis.object3D.position.y - standY);
        if (score > bestScore + 1e-6) { bestScore = score; t = s; }
      }
    }
    app.clock = t;
    app.tick(0);
    // Frame it: from the front and a little above (as the user sees it),
    // far enough for the whole pose to fit.
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
    o.position.copy(c).addScaledVector(dir, extent / 2 / fill / Math.tan(fov / 2));
    o.lookAt(c); o.rotateY(Math.PI);   // lookAt points an object's +z; a camera looks along -z
  }, id, t, fill);
  await frames(page, 3);
  await page.screenshot({ path: file, omitBackground: true });
}
