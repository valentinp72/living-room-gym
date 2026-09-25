// Room awareness: building the room from a scan and placing the stage clear
// of walls and furniture (pure logic, run in Node), then the app in a fake
// AR session with a scanned room.
import { launch } from './lib.mjs';
import { installFakeXR } from './fakexr.mjs';
import fs from 'node:fs';

// room.js has no imports, so it loads in Node as-is. (www/ has no
// package.json, so a plain import would treat it as CommonJS.)
const roomSrc = fs.readFileSync(new URL('../www/js/room.js', import.meta.url), 'utf8');
const { buildRoom, placeStage } = await import('data:text/javascript,' + encodeURIComponent(roomSrc));

const [url] = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const check = (name, ok, info = '') => results.push({ ok, name, info });

// ---- Pure logic ----------------------------------------------------------

// Surfaces as the headset reports them (world points).
const wall = (x1, z1, x2, z2) => ({ kind: 'vertical', label: 'wall', points: [[x1, 0, z1], [x1, 2.5, z1], [x2, 2.5, z2], [x2, 0, z2]] });
const top = (x0, z0, x1, z1, y, label = 'table') => ({ kind: 'horizontal', label, points: [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]] });
const box = (x0, z0, x1, z1, y, label = 'storage') => ({ kind: 'mesh', label,
  points: [[x0, 0, z0], [x1, 0, z0], [x1, y, z1], [x0, y, z1]] });
const roomOf = (x0, z0, x1, z1) => [wall(x0, z0, x1, z0), wall(x1, z0, x1, z1), wall(x1, z1, x0, z1), wall(x0, z1, x0, z0)];

// The app's layout (see stageLayout() in app.js): menu panel, exercise panel
// turned 15°, mannequin demo space.
const turned = (cx, cz, half, deg) => {
  const c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180);
  return { a: { x: cx - half * c, z: cz + half * s }, b: { x: cx + half * c, z: cz - half * s } };
};
// The app's screens (see screenLayouts() in app.js): the menu panel alone,
// and the exercise panel (turned 15°) with the mannequin. The last spot
// stands between the user and the exercise panel, so it must never be used.
const MANNEQUIN = { spots: [{ x: 1.3, z: -2.6 }, { x: 1.4, z: -1.9 }, { x: 1.0, z: -2.9 }, { x: 1.5, z: -1.4 },
  { x: 1.7, z: -0.9 }, { x: 0.6, z: -1.2 }], half: 0.95, r: 0.3 };
const screens = { menu: { panels: [turned(0, -2, 1.3, 0)] }, exercise: { panels: [turned(-0.55, -2.1, 1.2, 15)], mannequin: MANNEQUIN } };
const head = { x: 0, z: 0, yaw: 0 };
// Both screens placed; returns the exercise screen's placement, with
// clear / panelsClear covering both (like the app's status line).
const place = surfaces => {
  const room = surfaces && buildRoom(surfaces);
  const menu = placeStage(room, head, screens.menu), ex = placeStage(room, head, screens.exercise);
  return { ...ex, menu, clear: menu.clear && ex.clear, panelsClear: menu.panelsClear && ex.panelsClear };
};
// Where the exercise screen's mannequin ends up, in the world.
const mannequinAt = p => {
  const c = Math.cos(p.yaw), s = Math.sin(p.yaw), m = p.spot;
  return { x: p.x + m.x * c + m.z * s, z: p.z - m.x * s + m.z * c };
};
const home = p => p.spot.x === 1.3 && p.spot.z === -2.6;

let p = place(null);
check('no scan: straight ahead, mannequin at home', p.turn === 0 && p.pull === 0 && p.shift === 0 && home(p) && p.clear && p.x === 0 && p.z === 0, JSON.stringify(p));
check('no scan: menu straight ahead', p.menu.turn === 0 && p.menu.pull === 0 && p.menu.shift === 0 && p.menu.spot === null, JSON.stringify(p.menu));
// The last spot stands between the user and the exercise panel: never used.
p = place([...roomOf(-5, -5, 5, 5), top(0.3, -3.8, 2.6, -1.3, 0.75), top(-2.6, -3.8, -0.3, -1.3, 0.75)]);
check('never a spot that blocks the exercise panel', !(p.spot.x === 0.6 && p.spot.z === -1.2), JSON.stringify(p));
p = place(roomOf(-5, -5, 5, 5));
check('big room: straight ahead', p.turn === 0 && p.pull === 0 && p.shift === 0 && home(p) && p.clear, JSON.stringify(p));
// Ordinary rooms fit, standing in the middle or off to one side.
p = place(roomOf(-2, -2, 2, 2));
check('4 x 4 m room, standing in the middle: fits', p.clear, JSON.stringify(p));
p = place(roomOf(-1.2, -3, 2.3, 1));
check('3.5 x 4 m room, off center: fits', p.clear, JSON.stringify(p));
// 3 x 3 m, standing in the middle: 1.5 m to every wall is too little for
// the exercise panel (2.4 m wide).
p = place(roomOf(-1.5, -1.5, 1.5, 1.5));
check('3 x 3 m room, in the middle: move', !p.panelsClear && p.menu.panelsClear, JSON.stringify(p));
// 3 x 3.5 m, near the left wall: everything fits, the mannequin smaller.
p = place(roomOf(-0.6, -1.75, 2.4, 1.75));
check('3 x 3.5 m room, near a wall: fits, smaller mannequin', p.clear && p.scale < 1, JSON.stringify(p));
// 3 x 3.5 m, at one end: the panel needs the stage slid right, into the
// mannequin's space: it may clip.
p = place(roomOf(-1.5, -3.2, 1.5, 0.3));
check('3 x 3.5 m room, at one end: panels fit, mannequin cramped', p.panelsClear && !p.clear, JSON.stringify(p));
p = place(roomOf(-2, -2, 2, 2));
check('4 x 4 m room: full size mannequin', p.scale === 1, JSON.stringify(p));

// Wall 3 m ahead: the mannequin (2.6 m away, 0.9 m of space) doesn't fit; bring things closer.
p = place(roomOf(-3, -3, 3, 3));
check('wall 3 m ahead: still facing it', p.clear && Math.abs(p.turn) <= 30, JSON.stringify(p));

// Wall 1.2 m ahead, open room behind: turn around.
p = place(roomOf(-3, -1.2, 3, 5));
check('wall right in front: turns away from it', p.clear && Math.abs(p.turn) >= 90, JSON.stringify(p));

// Table where the mannequin would stand.
const table = top(0.9, -3, 1.7, -2.2, 0.75);
p = place([...roomOf(-5, -5, 5, 5), table]);
const m = mannequinAt(p);
check('table in the way: mannequin moved clear of it', p.clear && (p.turn !== 0 || p.pull > 0 || !home(p)) &&
  !(m.x > 0.9 - 0.9 && m.x < 1.7 + 0.9 && m.z > -3 - 0.9 && m.z < -2.2 + 0.9 && Math.hypot(Math.max(0.9 - m.x, 0, m.x - 1.7), Math.max(-3 - m.z, 0, m.z + 2.2)) < 0.9),
  JSON.stringify({ p, m }));

// A cupboard (mesh volume) right where the menu panel hangs.
p = place([...roomOf(-5, -5, 5, 5), box(-0.5, -2.4, 0.5, -1.7, 1.9)]);
check('cupboard in the way: moved', p.clear && (p.turn !== 0 || p.pull > 0 || p.shift !== 0), JSON.stringify(p));

// A closet: nowhere fits.
p = place(roomOf(-0.6, -0.6, 0.6, 0.6));
check('closet: reports not clear', !p.clear && !p.panelsClear, JSON.stringify(p));

// buildRoom: what counts.
const room = buildRoom([top(-5, -5, 5, 5, 0, 'floor'), top(-5, -5, 5, 5, 2.6, 'ceiling'), top(0, 0, 1, 1, 0.05, 'other'),
  table, wall(0, 0, 2, 0), box(-10, -10, 10, 10, 2.5, 'global mesh'), box(0, 0, 1, 2, 0.5, 'couch')]);
check('buildRoom: floor, ceiling, rug and room mesh skipped', room.walls.length === 1 && room.obstacles.length === 2,
  JSON.stringify(room.obstacles.map(o => o.label)));
check('buildRoom: wall = floor segment', JSON.stringify(room.walls[0].a) === '{"x":0,"z":0}' && JSON.stringify(room.walls[0].b) === '{"x":2,"z":0}',
  JSON.stringify(room.walls[0]));

// ---- In the app (fake AR session) -----------------------------------------

const browser = await launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('a-scene')?.hasLoaded, { timeout: 20000 });
await installFakeXR(page);
await page.evaluate(() => document.querySelector('#camera').setAttribute('look-controls', 'enabled: false'));

const enter = (mode, planes) => page.evaluate((mode, planes) => {
  fakeXR.planes = planes;
  const s = document.querySelector('a-scene');
  s.addState(mode + '-mode'); s.emit('enter-vr', { target: s });
}, mode, planes);
const exit = () => page.evaluate(() => {
  const s = document.querySelector('a-scene');
  s.removeState('ar-mode'); s.removeState('vr-mode'); s.emit('exit-vr', { target: s });
});
const status = () => page.evaluate(() => document.querySelector('#roomText').getAttribute('value'));
// World position of the menu panel's center.
const menuAt = () => page.evaluate(() => {
  const v = new THREE.Vector3(); document.querySelector('#menuPanel').object3D.getWorldPosition(v);
  return { x: +v.x.toFixed(2), z: +v.z.toFixed(2) };
});
const flat = s => s.map(x => x.kind === 'vertical' ? { orientation: 'vertical', semanticLabel: x.label, points: x.points }
  : { orientation: 'horizontal', semanticLabel: x.label, points: x.points });

// Wall 1.5 m ahead (the menu would be behind it), open room behind the user.
await enter('ar', flat(roomOf(-3, -1.5, 3, 5)));
await sleep(1800);
const at = await menuAt();
check('AR with a scan: menu in front of the wall', at.z > -1.5 + 0.1, JSON.stringify(at));
check('AR with a scan: status line', /^Room scan: 4 walls and 0 objects avoided$/.test(await status()), await status());

// The scan arriving late (after the first recenter) triggers one recenter.
await exit(); await sleep(200);
await enter('ar', []);
await sleep(1000);
const before = await menuAt();
await page.evaluate(planes => { fakeXR.planes = planes; }, flat(roomOf(-3, -1.5, 3, 5)));
await sleep(1500);
const after = await menuAt();
check('late scan: recenters with it', before.z < -1.5 && after.z > -1.5 + 0.1, JSON.stringify({ before, after }));

// No scan at all: a hint after a few seconds.
await exit(); await sleep(200);
await enter('ar', []);
await sleep(1500);
check('no scan: quiet at first', await status() === '', await status());
await sleep(2500);
check('no scan: suggests Space Setup', /Space Setup/.test(await status()), await status());

// Too small: tells the user to move.
await exit(); await sleep(200);
await enter('ar', flat(roomOf(-0.6, -0.6, 0.6, 0.6)));
await sleep(1800);
check('closet: asks to move', /Not enough free space/.test(await status()), await status());

// 3 x 3.5 m, near a wall: fits with a smaller mannequin.
await exit(); await sleep(200);
await enter('ar', flat(roomOf(-0.6, -1.75, 2.4, 1.75)));
await sleep(1800);
check('3 x 3.5 m: fits', /^Room scan/.test(await status()), await status());
await page.evaluate(() => document.querySelectorAll('#menuButtons > *')[0].emit('click')); await sleep(200);
const man = await page.evaluate(() => {
  const o = document.querySelector('#mannequin').object3D, v = new THREE.Vector3(); o.getWorldPosition(v);
  return { scale: +o.scale.x.toFixed(2), x: +v.x.toFixed(2), z: +v.z.toFixed(2) };
});
check('3 x 3.5 m: smaller mannequin inside the room', man.scale < 1 && man.x > -0.6 && man.x < 2.4 && man.z > -1.75 && man.z < 1.75, JSON.stringify(man));
await page.evaluate(() => document.querySelector('#btnBack').emit('click')); await sleep(100);
// At one end of that size of room: the panels fit, the mannequin may clip.
await exit(); await sleep(200);
await enter('ar', flat(roomOf(-1.5, -3.2, 1.5, 0.3)));
await sleep(1800);
check('3 x 3.5 m at one end: tight space note', /^Tight space/.test(await status()), await status());
await page.evaluate(() => document.querySelector('#btnBack').emit('click')); await sleep(100);

// VR: the real room is out of sight, no status.
await exit(); await sleep(200);
await enter('vr', flat(roomOf(-0.6, -0.6, 0.6, 0.6)));
await sleep(1800);
check('VR: no status line', await status() === '', await status());
await exit(); await sleep(200);
await page.evaluate(() => document.querySelectorAll('#menuButtons > *')[0].emit('click')); await sleep(200);
check('flat page: no status line, stage and mannequin reset', await status() === '' &&
  JSON.stringify(await page.evaluate(() => [document.querySelector('#stage').object3D.position.toArray(),
    document.querySelector('#mannequin').object3D.position.toArray(), document.querySelector('#mannequin').object3D.scale.x])) === '[[0,0,0],[1.3,0,-2.6],1]');

for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok ? '' : '   ' + r.info));
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(results.every(r => r.ok) && !errors.length ? 0 : 1);
