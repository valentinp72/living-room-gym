// Geometric checks of the demo mannequin: floor contact, planted feet, no leaking poses.
import { launch, frames } from './lib.mjs';

const [url, shot] = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('a-scene')?.hasLoaded, { timeout: 20000 });

const open = async i => {
  await page.evaluate(() => document.querySelector('#btnBack').emit('click'));
  await page.evaluate(i => document.querySelectorAll('#menuButtons > *')[i].emit('click'), i);
  await sleep(200); await frames(page, 3);   // the app centers the demo on its tick
};

// Pose the mannequin at time t (synchronously, so no tick interferes) and
// measure world-space boxes of body parts, grouped by the joint they hang on.
const measure = t => page.evaluate(async t => {
  const app = document.querySelector('#stage').components['gym-app'];
  const { resetPose } = await import('/js/avatar.js' + new URL(document.querySelector('script[type=module]').src).search);
  const p = app.mannequin;
  resetPose(p);
  app.current.ex.demo(p, t);
  p.root.object3D.updateMatrixWorld(true);
  // Everything in the holder's frame, unscaled: meters of a full-size
  // mannequin standing on y = 0 (the holder shrinks it on the panel).
  const toHolder = new THREE.Matrix4().copy(p.root.parentNode.object3D.matrixWorld).invert();
  // Also in the mannequin's own frame (root: +z = its front, before
  // turn()), for checks against props, which demos place in that frame.
  const toRoot = new THREE.Matrix4().copy(p.root.object3D.matrixWorld).invert();
  // Box of the vertices in a frame (a box rotated afterwards would grow).
  const v = new THREE.Vector3(), m = new THREE.Matrix4();
  const vertexBox = (b, mesh, toFrame) => {
    m.multiplyMatrices(toFrame, mesh.matrixWorld);
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) b.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(m));
  };
  const box = el => {
    const b = new THREE.Box3(), rb = new THREE.Box3();
    // precise: from the vertices (a rotated sphere's box would stick out).
    for (const c of el.children) if (c.classList.contains('part')) b.expandByObject(c.getObject3D('mesh'), true);
    for (const c of el.children) if (c.classList.contains('part')) vertexBox(rb, c.getObject3D('mesh'), toRoot);
    b.applyMatrix4(toHolder);
    return { minY: b.min.y, maxY: b.max.y, cx: (b.min.x + b.max.x) / 2, cz: (b.min.z + b.max.z) / 2,
      minZ: rb.min.z, maxZ: rb.max.z };
  };
  const all = new THREE.Box3().expandByObject(p.root.object3D, true).applyMatrix4(toHolder);
  // Hand centers (the spheres on the elbows).
  const hand = el => { const v = new THREE.Vector3(); el.querySelector(':scope > .part:last-child').object3D.getWorldPosition(v); v.applyMatrix4(toHolder); return { y: r(v.y), z: r(v.z), x: r(v.x) }; };
  const r = n => Math.round(n * 1000) / 1000;
  const parts = {};
  for (const k of ['pelvis', 'spine', 'head', 'elbowL', 'elbowR', 'kneeL', 'kneeR', 'ankleL', 'ankleR']) {
    const b = box(p[k]); parts[k] = Object.fromEntries(Object.entries(b).map(([a, v]) => [a, r(v)]));
  }
  const handR = hand(p.elbowR);
  return { minY: r(all.min.y), maxY: r(all.max.y), parts, handL: hand(p.elbowL), handR, pelvisRot: r(p.pelvis.object3D.rotation.x) };
}, t);

const results = [];
const check = (name, ok, info = '') => results.push({ ok, name, info });

// Every body part of both avatars has a mesh (a part whose geometry failed,
// like an unregistered "capsule", simply doesn't show).
const meshes = await page.evaluate(() => ['#mannequin', '#floorMannequin'].map(sel => {
  const parts = [...document.querySelectorAll(sel + ' .part')];
  return { sel, parts: parts.length, missing: parts.filter(p => !p.getObject3D('mesh')).length };
}));
if (!meshes.every(m => m.parts >= 20 && m.missing === 0)) {
  // Nothing below can be measured without the meshes.
  console.log('FAIL every body part is drawn   ' + JSON.stringify(meshes));
  await browser.close();
  process.exit(1);
}
check('every body part is drawn', true);
const near = (a, b, tol = 0.015) => Math.abs(a - b) <= tol;

// Squats: sample a full cycle.
await open(0);
const sq = [];
for (let i = 0; i <= 8; i++) sq.push(await measure(i * (2 * Math.PI / 1.6) / 8));
const stand = sq[0], bottom = sq[4];
check('squat: standing on floor', near(stand.minY, 0), `minY=${stand.minY}`);
check('squat: ~1.75 m tall', stand.maxY > 1.65 && stand.maxY < 1.85, `maxY=${stand.maxY}`);
check('squat: never below floor', sq.every(s => s.minY > -0.015), sq.map(s => s.minY).join(' '));
check('squat: feet flat on floor all cycle', sq.every(s => near(s.parts.ankleL.minY, 0) && near(s.parts.ankleR.minY, 0)),
  sq.map(s => s.parts.ankleL.minY).join(' '));
check('squat: feet do not slide', sq.every(s => near(s.parts.ankleL.cx, stand.parts.ankleL.cx) && near(s.parts.ankleL.cz, stand.parts.ankleL.cz)));
check('squat: goes deep (head drops > 35 cm)', stand.parts.head.maxY - bottom.parts.head.maxY > 0.35,
  `drop=${(stand.parts.head.maxY - bottom.parts.head.maxY).toFixed(2)}`);
if (shot) { await page.evaluate(() => { document.querySelector('#stage').components['gym-app'].clock = 1.96; }); await sleep(50); await page.screenshot({ path: shot + '-squat.png' }); }

// Curls: hands rise while the upper arms stay put; feet on floor.
await open(1);
const cu = [];
for (let i = 0; i <= 4; i++) cu.push(await measure(i * Math.PI / 4));
check('curls: on floor', cu.every(c => near(c.minY, 0)), cu.map(c => c.minY).join(' '));
const handTop = c => Math.max(c.parts.elbowL.maxY, c.parts.elbowR.maxY);
check('curls: a forearm reaches up near the shoulder', cu.some(c => handTop(c) > 1.35), cu.map(handTop).join(' '));
check('curls: arms alternate', cu.some(c => Math.abs(c.parts.elbowL.maxY - c.parts.elbowR.maxY) > 0.2));

// Plank: supported by forearms + toes, body off the floor.
await open(2);
const pl = await measure(0);
check('plank: forearms on floor', near(pl.parts.elbowL.minY, 0) && near(pl.parts.elbowR.minY, 0), JSON.stringify(pl.parts.elbowL));
check('plank: toes on floor', near(pl.parts.ankleL.minY, 0, 0.02), JSON.stringify(pl.parts.ankleL));
check('plank: nothing below floor', pl.minY > -0.015, `minY=${pl.minY}`);
check('plank: torso off floor, low and roughly flat', pl.parts.spine.minY > 0.08 && pl.parts.spine.maxY < 0.6, JSON.stringify(pl.parts.spine));
check('plank: knees off floor', pl.parts.kneeL.minY > 0.05, JSON.stringify(pl.parts.kneeL));
if (shot) await page.screenshot({ path: shot + '-plank.png' });

// New exercises: sample a few cycles and check what touches the floor.
// Parts are grouped by the joint they hang on: elbow = forearm + hand,
// knee = shin, ankle = foot, spine = torso.
const cycle = async (i, period = 2 * Math.PI / 2, n = 12) => {
  await open(i);
  const out = [];
  for (let k = 0; k <= n; k++) out.push(await measure(k * period / n));
  return out;
};
const onFloor = (poses, parts, tol = 0.02) => poses.every(p => parts.every(k => near(p.parts[k].minY, 0, tol)));
const lows = (poses, k) => poses.map(p => p.parts[k].minY).join(' ');
const above = poses => poses.every(p => p.minY > -0.015);

const cr = await cycle(3, Math.PI);
check('crunches: nothing below floor', above(cr), cr.map(p => p.minY).join(' '));
check('crunches: feet flat on floor', onFloor(cr, ['ankleL', 'ankleR']), lows(cr, 'ankleL'));
check('crunches: back on floor when down', near(cr[0].parts.spine.minY, 0));
check('crunches: shoulders come up', cr[6].parts.spine.maxY - cr[0].parts.spine.maxY > 0.15);

const lr = await cycle(4, 3);
check('leg raises: nothing below floor', above(lr), lr.map(p => p.minY).join(' '));
check('leg raises: back stays on floor', lr.every(p => near(p.parts.spine.minY, 0)));
check('leg raises: feet go up high', lr[6].parts.ankleL.maxY > 0.8, lr[6].parts.ankleL.maxY);

for (const [i, name, support, depth] of [[5, 'push-ups', ['elbowL', 'elbowR', 'ankleL', 'ankleR'], 0.2],
  [6, 'knee push-ups', ['elbowL', 'elbowR', 'kneeL', 'kneeR'], 0.15]]) {
  const pu = await cycle(i, Math.PI);
  check(name + ': nothing below floor', above(pu), pu.map(p => p.minY).join(' '));
  check(name + ': hands + ' + support[2].slice(0, -1) + 's on floor', onFloor(pu, support),
    support.map(k => k + ' ' + lows(pu, k)).join(' | '));
  check(name + ': chest goes down', pu[0].parts.spine.minY - pu[6].parts.spine.minY > depth,
    pu[0].parts.spine.minY + ' -> ' + pu[6].parts.spine.minY);
  check(name + ': hands stay planted', pu.every(p => near(p.handL.z, pu[0].handL.z) && near(p.handL.x, pu[0].handL.x)),
    pu.map(p => p.handL.z).join(' '));
}

const lu = await cycle(7, 2 * Math.PI / 1.6);
check('lunges: nothing below floor', above(lu), lu.map(p => p.minY).join(' '));
check('lunges: both feet on floor', onFloor(lu, ['ankleL', 'ankleR']), lows(lu, 'ankleL') + ' | ' + lows(lu, 'ankleR'));
check('lunges: feet do not slide', lu.every(p => near(p.parts.ankleL.cz, lu[0].parts.ankleL.cz) && near(p.parts.ankleR.cz, lu[0].parts.ankleR.cz)));
check('lunges: head drops > 30 cm', lu[0].parts.head.maxY - lu[6].parts.head.maxY > 0.3, lu[0].parts.head.maxY - lu[6].parts.head.maxY);
check('lunges: back knee near floor', lu[6].parts.kneeR.minY < 0.12, lu[6].parts.kneeR.minY);

const ca = await cycle(8, 2);
check('calf raises: toes on floor', onFloor(ca, ['ankleL', 'ankleR'], 0.015), lows(ca, 'ankleL'));
check('calf raises: body rises', ca[6].parts.head.maxY - ca[0].parts.head.maxY > 0.05);

const gb = await cycle(9, 3);
check('glute bridges: nothing below floor', above(gb), gb.map(p => p.minY).join(' '));
check('glute bridges: feet flat on floor', onFloor(gb, ['ankleL', 'ankleR']), lows(gb, 'ankleL'));
check('glute bridges: shoulders stay down', gb.every(p => near(p.parts.head.minY, gb[0].parts.head.minY, 0.03)));
check('glute bridges: hips go up', gb[6].parts.spine.maxY > 0.3, gb[6].parts.spine.maxY);

const fh = await cycle(10, 5, 20);
check('fire hydrants: nothing below floor', above(fh), fh.map(p => p.minY).join(' '));
check('fire hydrants: hands on floor', onFloor(fh, ['elbowL', 'elbowR']), lows(fh, 'elbowL'));
check('fire hydrants: a knee always down', fh.every(p => near(p.parts.kneeL.minY, 0) || near(p.parts.kneeR.minY, 0)));
check('fire hydrants: each knee lifts', fh.some(p => p.parts.kneeL.minY > 0.15) && fh.some(p => p.parts.kneeR.minY > 0.15),
  lows(fh, 'kneeL') + ' | ' + lows(fh, 'kneeR'));

// Exercises added with equipment and more floor work. openId: by id.
const cycleOf = async (id, period, n = 12) => {
  const i = await page.evaluate(id => document.querySelector('#stage').components['gym-app'].pages.single.items.findIndex(e => e.id === id), id);
  return cycle(i, period, n);
};
const flat = (poses, parts) => onFloor(poses, parts, 0.015);
const someOnFloor = (poses, parts) => poses.every(p => parts.some(k => near(p.parts[k].minY, 0, 0.02)));
const SEAT = 0.45;
const range = (poses, f) => { const v = poses.map(f); return [Math.min(...v), Math.max(...v)].map(n => +n.toFixed(3)); };

// Standing exercises: nothing below the floor, feet on the floor.
for (const [id, period, feet] of [['jumping-jacks', 1.5, ['ankleL', 'ankleR']], ['goblet-squats', 2 * Math.PI / 1.6, ['ankleL', 'ankleR']],
  ['romanian-deadlifts', 2 * Math.PI / 1.6, ['ankleL', 'ankleR']], ['shoulder-press', 2.5, ['ankleL', 'ankleR']],
  ['bent-over-rows', 2.5, ['ankleL', 'ankleR']], ['lateral-raises', 3, ['ankleL', 'ankleR']],
  ['band-pull-aparts', 2.5, ['ankleL', 'ankleR']], ['wall-sit', 4, ['ankleL', 'ankleR']]]) {
  const po = await cycleOf(id, period);
  check(id + ': nothing below floor', above(po), po.map(p => p.minY).join(' '));
  check(id + ': feet flat on floor', flat(po, feet), feet.map(k => lows(po, k)).join(' | '));
}
const rdl = await cycleOf('romanian-deadlifts', 2 * Math.PI / 1.6);
check('romanian deadlifts: head drops > 35 cm', rdl[0].parts.head.maxY - rdl[6].parts.head.maxY > 0.35, rdl[0].parts.head.maxY - rdl[6].parts.head.maxY);
check('romanian deadlifts: feet do not slide', rdl.every(p => near(p.parts.ankleL.cz, rdl[0].parts.ankleL.cz) && near(p.parts.ankleL.cx, rdl[0].parts.ankleL.cx)));
const ws = await cycleOf('wall-sit', 4);
check('wall sit: thighs level (knees at hip height)', ws.every(p => near(p.parts.kneeL.maxY, p.parts.pelvis.maxY - 0.02, 0.06)), range(ws, p => p.parts.kneeL.maxY - p.parts.pelvis.maxY));
check('wall sit: back against the wall (z = -0.1)', ws.every(p => p.parts.spine.minZ > -0.1 && p.parts.spine.minZ < -0.07), range(ws, p => p.parts.spine.minZ));
const bs = await cycleOf('band-side-steps', 3, 12);
check('band side steps: nothing below floor', above(bs), bs.map(p => p.minY).join(' '));
check('band side steps: a foot always on the floor', someOnFloor(bs, ['ankleL', 'ankleR']), lows(bs, 'ankleL') + ' | ' + lows(bs, 'ankleR'));

// Floor exercises: what touches the floor.
const sp = await cycleOf('side-plank-right', 4);
check('side plank: nothing below floor', above(sp), sp.map(p => p.minY).join(' '));
check('side plank: on the forearm and foot', flat(sp, ['elbowR', 'ankleR']), lows(sp, 'elbowR') + ' | ' + lows(sp, 'ankleR'));
check('side plank: hips off the floor', sp.every(p => p.parts.pelvis.minY > 0.12), range(sp, p => p.parts.pelvis.minY));
// The left one is the mirror image (see mirror() in avatar.js): the same
// contacts, with the head on the other side.
const spl = await cycleOf('side-plank-left', 4);
check('side plank (left): nothing below floor', above(spl), spl.map(p => p.minY).join(' '));
check('side plank (left): on the forearm and foot', flat(spl, ['elbowR', 'ankleR']), lows(spl, 'elbowR') + ' | ' + lows(spl, 'ankleR'));
check('side plank (left): head on the other side', spl.every((p, k) => near(p.parts.head.cx, -sp[k].parts.head.cx, 0.01) && Math.abs(p.parts.head.cx) > 0.3),
  range(sp, p => p.parts.head.cx) + ' vs ' + range(spl, p => p.parts.head.cx));
const mc = await cycleOf('mountain-climbers', 2, 16);
check('mountain climbers: nothing below floor', above(mc), mc.map(p => p.minY).join(' '));
check('mountain climbers: hands on floor', flat(mc, ['elbowL', 'elbowR']), lows(mc, 'elbowL'));
check('mountain climbers: a foot always down', someOnFloor(mc, ['ankleL', 'ankleR']), lows(mc, 'ankleL') + ' | ' + lows(mc, 'ankleR'));
check('mountain climbers: each knee comes forward', ['kneeL', 'kneeR'].every(k => mc.some(p => p.parts[k].maxZ > mc[0].parts.kneeL.maxZ + 0.3)), range(mc, p => p.parts.kneeL.maxZ) + ' | ' + range(mc, p => p.parts.kneeR.maxZ));
for (const [id, period] of [['bird-dogs', 6], ['donkey-kicks', 4]]) {
  const po = await cycleOf(id, period, 16);
  check(id + ': nothing below floor', above(po), po.map(p => p.minY).join(' '));
  check(id + ': a hand always down', someOnFloor(po, ['elbowL', 'elbowR']), lows(po, 'elbowL') + ' | ' + lows(po, 'elbowR'));
  check(id + ': a knee always down', someOnFloor(po, ['kneeL', 'kneeR']), lows(po, 'kneeL') + ' | ' + lows(po, 'kneeR'));
  check(id + ': each leg lifts', ['kneeL', 'kneeR'].every(k => po.some(p => p.parts[k].minY > 0.2)), lows(po, 'kneeL') + ' | ' + lows(po, 'kneeR'));
}
const br = await cycleOf('band-rows', 2.5);
check('band rows: nothing below floor', above(br), br.map(p => p.minY).join(' '));
check('band rows: sitting, legs on the floor', flat(br, ['pelvis']) && onFloor(br, ['kneeL', 'kneeR'], 0.03), lows(br, 'pelvis') + ' | ' + lows(br, 'kneeL'));

// Chair exercises: the seat's top is at y = 0.45 in the mannequin's frame.
const cd = await cycleOf('chair-dips', Math.PI);
check('chair dips: nothing below floor', above(cd), cd.map(p => p.minY).join(' '));
check('chair dips: hands on the seat', cd.every(p => near(p.parts.elbowL.minY, SEAT, 0.015)), lows(cd, 'elbowL'));
check('chair dips: feet flat on floor', flat(cd, ['ankleL', 'ankleR']), lows(cd, 'ankleL'));
check('chair dips: hips stay in front of the seat', cd.every(p => p.parts.pelvis.minZ > -0.005 && p.parts.spine.minZ > -0.005), range(cd, p => p.parts.pelvis.minZ));
check('chair dips: shoulders go down > 18 cm', cd[0].parts.head.maxY - cd[6].parts.head.maxY > 0.18);
const ip = await cycleOf('incline-push-ups', Math.PI);
check('incline push-ups: nothing below floor', above(ip), ip.map(p => p.minY).join(' '));
check('incline push-ups: hands on the seat', ip.every(p => near(p.parts.elbowL.minY, SEAT, 0.015)), lows(ip, 'elbowL'));
check('incline push-ups: toes on the floor', onFloor(ip, ['ankleL', 'ankleR']), lows(ip, 'ankleL'));
check('incline push-ups: head stays above the seat', ip.every(p => p.parts.head.minY > SEAT + 0.1), lows(ip, 'head'));
check('incline push-ups: chest goes down', ip[0].parts.spine.maxY - ip[6].parts.spine.maxY > 0.2);
const cs = await cycleOf('chair-squats', 2 * Math.PI / 1.6);
check('chair squats: feet flat on floor', flat(cs, ['ankleL', 'ankleR']), lows(cs, 'ankleL'));
check('chair squats: sits on the seat at the bottom', near(cs[6].parts.pelvis.minY, SEAT, 0.02), cs[6].parts.pelvis.minY);
check('chair squats: never through the seat', cs.every(p => p.parts.pelvis.minY > SEAT - 0.02), lows(cs, 'pelvis'));
const ss = await cycleOf('split-squats-left', 2 * Math.PI / 1.6);
check('split squats: nothing below floor', above(ss), ss.map(p => p.minY).join(' '));
check('split squats: front foot flat on floor', flat(ss, ['ankleL']), lows(ss, 'ankleL'));
check('split squats: back foot on the seat', ss.every(p => near(p.parts.ankleR.minY, SEAT, 0.02)), lows(ss, 'ankleR'));
check('split squats: back knee stays up', ss.every(p => p.parts.kneeR.minY > 0.08), lows(ss, 'kneeR'));
check('split squats: goes down > 25 cm', ss[0].parts.head.maxY - ss[6].parts.head.maxY > 0.25);
const ssr = await cycleOf('split-squats-right', 2 * Math.PI / 1.6);
check('split squats (right): nothing below floor', above(ssr), ssr.map(p => p.minY).join(' '));
check('split squats (right): back foot on the seat', ssr.every(p => near(p.parts.ankleR.minY, SEAT, 0.02)), lows(ssr, 'ankleR'));
// The front foot (+z in the mannequin's frame, turn undone but mirror kept)
// is on the body's left (+x) for the left one, on its right for the right one.
const frontFootX = id => page.evaluate(async id => {
  const app = document.querySelector('#stage').components['gym-app'];
  const { resetPose } = await import('/js/avatar.js' + new URL(document.querySelector('script[type=module]').src).search);
  const p = app.mannequin, ex = app.pages.single.items.find(e => e.id === id);
  resetPose(p); ex.demo(p, 0);
  p.root.object3D.updateMatrixWorld(true);
  const root = p.root.object3D, toHolder = new THREE.Matrix4().copy(root.parent.matrixWorld).invert();
  const unturn = root.quaternion.clone().invert();
  const feet = ['ankleL', 'ankleR'].map(k => p[k].object3D.getWorldPosition(new THREE.Vector3())
    .applyMatrix4(toHolder).sub(root.position).applyQuaternion(unturn));
  return +(feet[0].z > feet[1].z ? feet[0].x : feet[1].x).toFixed(3);
}, id);
// The mannequin faces +z, so its own left is +x (its L joints, named from
// the viewer, are on its right).
const [ssx, ssrx] = [await frontFootX('split-squats-left'), await frontFootX('split-squats-right')];
check('split squats: left foot in front on the left one, right foot on the right one', ssx > 0.05 && ssrx < -0.05, [ssx, ssrx]);
// Side plank: the forearm on the floor is the left one on the left side.
const lowElbowX = id => page.evaluate(async id => {
  const app = document.querySelector('#stage').components['gym-app'];
  const { resetPose } = await import('/js/avatar.js' + new URL(document.querySelector('script[type=module]').src).search);
  const p = app.mannequin, ex = app.pages.single.items.find(e => e.id === id);
  resetPose(p); ex.demo(p, 0);
  p.root.object3D.updateMatrixWorld(true);
  const root = p.root.object3D, toHolder = new THREE.Matrix4().copy(root.parent.matrixWorld).invert();
  const elbows = ['elbowL', 'elbowR'].map(k => p[k].object3D.getWorldPosition(new THREE.Vector3()).applyMatrix4(toHolder));
  // The lower one's side of the body: elbowL is on -x, elbowR on +x (its
  // own left), swapped by mirror(). > 0 = the left forearm.
  return (elbows[0].y < elbows[1].y ? -1 : 1) * root.scale.x;
}, id);
const [spx, sprx] = [await lowElbowX('side-plank-left'), await lowElbowX('side-plank-right')];
check('side plank: on the left forearm on the left one, the right forearm on the right one', spx > 0 && sprx < 0, [spx, sprx]);

// On the panel: every demo (and the resting idle pose) stays inside the
// avatar's frame as the user sees it (projected onto the panel from eye
// height, 1.6 m, at the stage origin), and in front of the panel so nothing
// cuts through it. The same for the smaller "UP NEXT" card shown during a
// rest (next = true), which must also stay clear of the card's title.
const inFrame = (i, t, next = false) => page.evaluate(async (i, t, next) => {
  const app = document.querySelector('#stage').components['gym-app'];
  const { resetPose, idle, centerDemo } = await import('/js/avatar.js' + new URL(document.querySelector('script[type=module]').src).search);
  const pose = i === null ? idle : app.pages.single.items[i].demo;
  const p = next ? app.nextMannequin : app.mannequin;
  if (next) { if (app.nextCentered !== pose) { centerDemo(p, pose); app.nextCentered = pose; } }
  else if (app.centered !== pose) app.centerAvatars(pose);
  resetPose(p);
  pose(p, t);
  const panel = document.querySelector('#exercisePanel').object3D, frame = document.querySelector(next ? '#nextFrame' : '#demoFrame');
  panel.updateMatrixWorld(true);
  const toPanel = new THREE.Matrix4().copy(panel.matrixWorld).invert();
  const b = new THREE.Box3().expandByObject(p.root.object3D, true).applyMatrix4(toPanel);
  // Project the box's corners onto the panel plane (z = 0) from the eye.
  const eye = new THREE.Vector3(0, 1.6, 0).applyMatrix4(toPanel);
  const seen = new THREE.Box3();
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
    const k = eye.z / (eye.z - z);
    seen.expandByPoint(new THREE.Vector3(eye.x + (x - eye.x) * k, eye.y + (y - eye.y) * k, 0));
  }
  const f = frame.object3D.getWorldPosition(new THREE.Vector3()).applyMatrix4(toPanel);
  const w = frame.getAttribute('width') / 2, h = frame.getAttribute('height') / 2;
  const top = f.y + h - (next ? 0.12 : 0);   // under the "UP NEXT" title
  const ok = seen.min.x > f.x - w && seen.max.x < f.x + w && seen.min.y > f.y - h && seen.max.y < top && b.min.z > 0.005;
  return { ok, box: [seen.min.x, seen.max.x, seen.min.y, seen.max.y, b.min.z].map(v => +v.toFixed(2)) };
}, i, t, next);
const count = await page.evaluate(() => document.querySelectorAll('#menuButtons > *').length);
await open(0);
for (const i of [...Array(count).keys(), null]) {
  const bad = [];
  for (let k = 0; k < 16; k++) {
    const r = await inFrame(i, k * 0.4);
    if (!r.ok) bad.push(`t=${(k * 0.4).toFixed(1)} ${JSON.stringify(r.box)}`);
  }
  const name = i === null ? 'idle' : await page.evaluate(i => document.querySelector('#stage').components['gym-app'].pages.single.items[i].name, i);
  check(`in the frame: ${name}`, !bad.length, bad.slice(0, 2).join(' | '));
}
for (let i = 0; i < count; i++) {
  const bad = [];
  for (let k = 0; k < 16; k++) {
    const r = await inFrame(i, k * 0.4, true);
    if (!r.ok) bad.push(`t=${(k * 0.4).toFixed(1)} ${JSON.stringify(r.box)}`);
  }
  const name = await page.evaluate(i => document.querySelector('#stage').components['gym-app'].pages.single.items[i].name, i);
  check(`in the "up next" card: ${name}`, !bad.length, bad.slice(0, 2).join(' | '));
}

// The small avatar on the floor counter: only while the head is low, and in
// the same pose as the panel's.
const floorAvatar = () => page.evaluate(() => {
  const app = document.querySelector('#stage').components['gym-app'];
  return { shown: document.querySelector('#floorLabel').object3D.visible,
    same: app.floorMannequin.pelvis.object3D.rotation.x === app.mannequin.pelvis.object3D.rotation.x &&
      app.floorMannequin.pelvis.object3D.position.y === app.mannequin.pelvis.object3D.position.y };
});
await page.evaluate(() => document.querySelector('#camera').setAttribute('look-controls', 'enabled: false'));
await open(2);
await page.evaluate(() => { const o = document.querySelector('#camera').object3D; o.position.set(0, 1.6, 0); o.rotation.set(0, 0, 0); });
await sleep(150); await frames(page, 3);
check('floor avatar: hidden while standing', !(await floorAvatar()).shown);
await page.evaluate(() => { const o = document.querySelector('#camera').object3D; o.position.set(0, 0.45, 0); o.rotation.set(-1.4, 0, 0, 'YXZ'); });
await sleep(150); await frames(page, 3);
const fa = await floorAvatar();
check('floor avatar: shown in a plank, same pose', fa.shown && fa.same, JSON.stringify(fa));
await page.evaluate(() => { const o = document.querySelector('#camera').object3D; o.position.set(0, 1.6, 0); o.rotation.set(0, 0, 0); });
await sleep(100);

// No pose carry-over: squats right after the plank starts standing upright.
await open(2); await measure(0);
await open(0);
const after = await measure(0);
check('no pose leak after plank', after.pelvisRot === 0 && near(after.minY, 0) && near(after.maxY, stand.maxY), JSON.stringify({ r: after.pelvisRot, minY: after.minY }));

await open(1);
if (shot) { await page.evaluate(() => { document.querySelector('#stage').components['gym-app'].clock = 0.8; }); await sleep(50); await page.screenshot({ path: shot + '-curls.png' }); }

for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok ? '' : '   ' + r.info));
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(results.every(r => r.ok) && !errors.length ? 0 : 1);
