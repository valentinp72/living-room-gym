// Recenter: the stage (panels + mannequin) moves in front of the user's head.
import { launch, frames } from './lib.mjs';
import { installFakeXR } from './fakexr.mjs';
const [url, shot] = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 900 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('a-scene')?.hasLoaded, { timeout: 20000 });
await page.evaluate(() => document.querySelector('#camera').setAttribute('look-controls', 'enabled: false'));

// Head pose: position + yaw/pitch in degrees (YXZ like a head: turn, then nod).
const head = (x, y, z, yaw, pitch = 0) => page.evaluate((x, y, z, yaw, pitch) => {
  const o = document.querySelector('#camera').object3D;
  o.position.set(x, y, z);
  o.rotation.set(pitch * Math.PI / 180, yaw * Math.PI / 180, 0, 'YXZ');
  o.updateMatrixWorld(true);
}, x, y, z, yaw, pitch);
// Where the menu panel is, seen from the head: distance ahead / to the side / height.
const menuFromHead = () => page.evaluate(() => {
  const s = document.querySelector('a-scene'); s.object3D.updateMatrixWorld(true);
  const cam = document.querySelector('#camera').object3D;
  const p = new THREE.Vector3(); document.querySelector('#menuPanel').object3D.getWorldPosition(p);
  const yaw = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ').y;
  const rel = p.clone().sub(cam.position).applyAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
  const r = n => Math.round(n * 100) / 100;
  return { ahead: r(-rel.z), side: r(rel.x), height: r(p.y) };
});
const click = sel => page.evaluate(s => document.querySelector(s).emit('click'), sel);
const stage = () => page.evaluate(() => { const o = document.querySelector('#stage').object3D; return [o.position.x, o.position.z, o.rotation.y].map(n => Math.round(n * 100) / 100); });

const results = [];
const expect = (name, got, want) => results.push({ name, ok: JSON.stringify(got) === JSON.stringify(want), got, want });

// 1. Turned 90° left and moved: Recenter puts the menu 2 m ahead again.
await head(1, 1.7, 2, 90);
await click('#btnRecenterMenu');
// The menu's own height is set by buildMenu() to fit its contents.
const menuY = await page.evaluate(() => Math.round(document.querySelector('#menuPanel').object3D.position.y * 100) / 100);
expect('menu button: menu 2 m ahead, centered', await menuFromHead(), { ahead: 2, side: 0, height: menuY });
// 2. Turned back-right, from the exercise screen.
await page.evaluate(() => document.querySelectorAll('#menuButtons > *')[2].emit('click'));
await head(-0.5, 1.6, -1, -135);
await click('#btnRecenter');
expect('exercise button: recenters too', await menuFromHead(), { ahead: 2, side: 0, height: menuY });
if (shot) await page.screenshot({ path: shot + '-exercise.png' });
// 3. Looking straight down in a plank (head low, top of head pointing +x): uses head-top direction.
await head(0, 0.4, 0, -90, -90);
await page.evaluate(() => document.querySelector('#rightHand').emit('bbuttondown'));
expect('B in plank: faces the head-top direction', await stage(), [0, 0, -1.57]);
// 4. Y button.
await head(0.3, 1.6, 0.3, 180);
await page.evaluate(() => document.querySelector('#leftHand').emit('ybuttondown'));
expect('Y button', await stage(), [0.3, 0.3, 3.14]);
// 5. Entering XR recenters on its own after a short delay; leaving resets.
await page.evaluate(() => { const s = document.querySelector('a-scene'); s.addState('ar-mode'); s.emit('enter-vr', { target: s }); });
await head(2, 1.65, 1, 45);
await sleep(900);
expect('auto recenter on entering AR', await stage(), [2, 1, 0.79]);
// 6. On the menu, in AR, the menu follows the user (regression: pointing at a
// menu behind you with a bare hand was awkward).
await click('#btnBack'); await sleep(100);
await head(2, 1.65, 1, 165); await sleep(700);
expect('menu follow: not at once', await stage(), [2, 1, 0.79]);
await sleep(1300);
expect('menu follow: turned away 120 deg', await stage(), [2, 1, 2.88]);
await head(2, 1.65, 1, 200); await sleep(2000);
expect('menu follow: a 35 deg turn keeps it', await stage(), [2, 1, 2.88]);
await head(4, 1.65, 1, 165); await sleep(2000);
expect('menu follow: walked 2 m away', await stage(), [4, 1, 2.88]);
await page.evaluate(() => document.querySelectorAll('#menuButtons > *')[0].emit('click'));
await head(4, 1.65, 1, 0); await sleep(2000);
expect('menu follow: never during an exercise', await stage(), [4, 1, 2.88]);
// 7. The Quest's own recenter (reference space 'reset') recenters the stage.
await installFakeXR(page);
await frames(page, 3);   // the app hooks the reference space on a tick
await page.evaluate(() => fakeXR.ref.dispatchEvent(new Event('reset')));
await sleep(400); await frames(page, 3);
expect('system recenter', await stage(), [4, 1, 0]);
await page.evaluate(() => { const s = document.querySelector('a-scene'); s.removeState('ar-mode'); s.emit('exit-vr', { target: s }); });
expect('reset on exit', await stage(), [0, 0, 0]);

for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok ? '' : `  got=${JSON.stringify(r.got)} want=${JSON.stringify(r.want)}`));
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(results.every(r => r.ok) && !errors.length ? 0 : 1);
