// Demo mannequin: rounded body parts (capsules, spheres) hung on joint pivots.
// buildMannequin() puts one inside any holder entity, which places and
// scales it: the exercise panel has one (#demoAvatar), and so does the floor
// counter (#floorAvatar). Every demo poses it as if it were full size,
// standing on the holder's floor (y = 0) and seen from the holder's +Z.
//
// Conventions (see CLAUDE.md): meters, +Y up, the mannequin faces its own +Z.
// A limb hangs along -Y from its pivot, so a NEGATIVE x rotation swings it
// forward (+Z) and a positive one swings it backward.
//
// L / R joints are named as seen from the viewer: facing them (turn 0), the
// L side is on their left, so it is the mannequin's own right side. It only
// matters for one-sided exercises (see mirror()).
//
// Joint tree, with the standing pose (pivot positions relative to their parent):
//   root                 on the floor, between the feet; turns the whole body
//   └ pelvis             hip height (PELVIS_Y); move/rotate it to squat or lie down
//     ├ spine            torso, bends at the pelvis (+x = lean forward)
//     │ ├ head
//     │ ├ shoulderL/R  → elbowL/R
//     └ hipL/R         → kneeL/R → ankleL/R

import { capsuleGeometry } from './components/capsule.js';

// The rounded body parts need the "capsule" geometry. It's registered here,
// by its only user, so the two files can't get out of step: with a stale
// main.js (browser cache) that didn't register it, only the spheres showed.
if (!AFRAME.geometries.capsule) AFRAME.registerGeometry('capsule', capsuleGeometry);

const DEG = Math.PI / 180;

// Segment lengths (meters), for a ~1.75 m tall figure.
export const BODY = {
  thigh: 0.44,      // hip -> knee
  shin: 0.44,       // knee -> ankle
  ankle: 0.06,      // ankle -> sole
  shoulderY: 0.47,  // pelvis -> shoulder line
  upperArm: 0.30,   // shoulder -> elbow
  forearm: 0.27,    // elbow -> wrist
  forearmR: 0.032,  // forearm radius (a forearm plank rests on it)
  torsoDepth: 0.18,  // front to back, so lying down the back is torsoDepth / 2 above the floor
};
export const PELVIS_Y = BODY.ankle + BODY.shin + BODY.thigh;

// How far it is turned from facing the viewer by default: a three-quarter view.
const DEFAULT_TURN = 30;

// Rotate an entity's pivot, in degrees. Uses object3D directly: it runs
// every frame for every joint, and nothing reads these back as attributes.
export function rot(el, x = 0, y = 0, z = 0) {
  el.object3D.rotation.set(x * DEG, y * DEG, z * DEG);
}
export function place(el, x = 0, y = 0, z = 0) {
  el.object3D.position.set(x, y, z);
}

// Turn the whole body `deg` degrees away from facing the viewer (who looks
// at the holder from its +Z side). 0 = facing the viewer, 90 = side view.
export function turn(parts, deg) {
  rot(parts.root, 0, deg, 0);
}

// Swap the body's left and right (after posing), so one demo shows both
// sides of a one-sided exercise (side plank, split squats). It flips the
// root's own x axis; resetPose() undoes it.
export function mirror(parts) {
  parts.root.object3D.scale.x = -1;
}

// Side-view posing (inverse kinematics) in the mannequin's own y/z plane:
// points are { y, z } relative to `root` (y up from the floor, +z = where
// the standing mannequin faces). An X angle `a` (degrees) points a limb
// hanging from its joint along (y: -cos a, z: -sin a): 0 = straight down,
// -90 = toward +z. Bodies (pelvis / spine) point along (y: cos a, z: sin a):
// 0 = upright, 90 = lying face down with the head toward +z, -90 = lying
// face up with the head toward -z.

// Angle of a limb going from point a to point b.
export const limbAngle = (a, b) => Math.atan2(a.z - b.z, a.y - b.y) / DEG;

// Point `dist` along a body tilted `deg` from `from` (e.g. the shoulders
// from the pelvis).
export const along = (from, deg, dist) =>
  ({ y: from.y + dist * Math.cos(deg * DEG), z: from.z + dist * Math.sin(deg * DEG) });

// Middle joint (knee / elbow) of a two-segment limb from a to b. `bend`
// picks the side: +1 bends toward +z when the limb points down (knees
// forward), -1 the other way. Out of reach, the limb is straight.
export function middleJoint(a, b, l1, l2, bend) {
  const dz = b.z - a.z, dy = b.y - a.y;
  const d = Math.min(Math.hypot(dz, dy), l1 + l2 - 1e-6);
  const uz = dz / Math.hypot(dz, dy), uy = dy / Math.hypot(dz, dy);
  const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  return { y: a.y + uy * x + bend * uz * h, z: a.z + uz * x - bend * uy * h };
}

// Pose leg `s` ('L' / 'R') so its ankle joint lands on `ankle`, with the
// pelvis at `hip` tilted `pelvisDeg`. The foot ends up `footDeg` from flat
// (positive = toes down, heel up). Knees bend forward.
export function legTo(parts, s, hip, pelvisDeg, ankle, footDeg = 0) {
  const knee = middleJoint(hip, ankle, BODY.thigh, BODY.shin, 1);
  const thigh = limbAngle(hip, knee), shin = limbAngle(knee, ankle);
  rot(parts['hip' + s], thigh - pelvisDeg);
  rot(parts['knee' + s], shin - thigh);
  rot(parts['ankle' + s], footDeg - shin);
}

// Pose arm `s` so the hand's center lands on `hand`. The shoulder is at
// `shoulder` on a torso tilted `torsoDeg` (pelvis + spine). bend: as in
// middleJoint(); -1 for push-ups (elbows toward the feet).
export const HAND = BODY.forearm + 0.03;   // elbow -> center of the hand
export const HAND_R = 0.042;               // hand radius
export function armTo(parts, s, shoulder, torsoDeg, hand, bend) {
  const elbow = middleJoint(shoulder, hand, BODY.upperArm, HAND, bend);
  const upper = limbAngle(shoulder, elbow), fore = limbAngle(elbow, hand);
  rot(parts['shoulder' + s], upper - torsoDeg);
  rot(parts['elbow' + s], fore - upper);
}

// Lying on the back (pelvis tilted -90, head toward -z): the torso's back
// rests on the floor, and the head is raised a little so it doesn't sink.
export const LYING_Y = BODY.torsoDepth / 2;
export function lieOnBack(parts, pelvis = { y: LYING_Y, z: 0 }) {
  place(parts.pelvis, 0, pelvis.y, pelvis.z);
  rot(parts.pelvis, -90);
  rot(parts.head, 15);
}

// Height of the pelvis above the floor for a straight body tilted `deg`
// face down, standing on its toes (ankles straight): the lowest point is the
// front bottom edge of the foot box.
export const onToesY = deg =>
  (BODY.thigh + BODY.shin + BODY.ankle) * Math.cos(deg * DEG) + 0.16 * Math.sin(deg * DEG);

// Back to standing straight, arms down. Called before every demo frame, so a
// demo only sets the joints it moves and no pose leaks between exercises.
// The root is shifted sideways by parts.shiftX (see centerDemo()).
export function resetPose(parts) {
  place(parts.root, parts.shiftX || 0);
  turn(parts, DEFAULT_TURN);
  parts.root.object3D.scale.x = 1;   // see mirror()
  place(parts.pelvis, 0, PELVIS_Y, 0);
  for (const name of JOINTS) {
    rot(parts[name]);
    parts[name].object3D.rotation.order = 'XYZ';   // a demo may change it
  }
  hideProps(parts);
}

// Props (chair, dumbbells, band, wall): built with the mannequin, hidden
// until a demo shows them. Hidden props are taken out of the scene graph,
// not just made invisible, so they never count in bounding boxes
// (centerDemo(), tests).
function hideProps(parts) {
  for (const prop of Object.values(parts.props)) {
    if (prop.el.object3D.parent) prop.el.object3D.removeFromParent();
  }
}
function showProp(parts, name) {
  const prop = parts.props[name];
  if (!prop.el.object3D.parent) prop.parent.add(prop.el.object3D);
  return prop.el;
}

// A chair (seat top CHAIR_SEAT_Y high, CHAIR_SIZE square, backrest on its
// own -z side) with the middle of its seat at root { x, z }, turned `yaw`
// degrees. yaw 0: the front edge of the seat faces +z.
export const CHAIR_SEAT_Y = 0.45;
export const CHAIR_SIZE = 0.42;
export function showChair(parts, z, yaw = 0, x = 0) {
  const chair = showProp(parts, 'chair');
  place(chair, x, 0, z);
  rot(chair, 0, yaw, 0);
}

// Dumbbells in one or both hands ('L', 'R' or 'LR'), across the palm.
export function showDumbbells(parts, sides = 'LR') {
  for (const s of sides) showProp(parts, 'dumbbell' + s);
}

// A wall behind the mannequin, its surface at root z = `z`.
export function showWall(parts, z) {
  place(showProp(parts, 'wall'), 0, 0.7, z - 0.02);
}

// Elastic band pieces (band1, band2) stretched between two points of the
// body, given as { el, at } where `at` is a point in el's own frame (e.g. a
// hand: { el: parts.elbowR, at: [0, -HAND, 0] }). Call it after posing the
// body: it reads the joints' current transforms.
export function showBand(parts, name, a, b) {
  const band = showProp(parts, name);
  const root = parts.root.object3D;
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const pa = new THREE.Vector3(...a.at).applyMatrix4(a.el.object3D.matrixWorld).applyMatrix4(toRoot);
  const pb = new THREE.Vector3(...b.at).applyMatrix4(b.el.object3D.matrixWorld).applyMatrix4(toRoot);
  const o = band.object3D;
  o.position.addVectors(pa, pb).multiplyScalar(0.5);
  const dir = pb.sub(pa);
  o.scale.set(1, Math.max(dir.length(), 1e-3), 1);   // the band is 1 m long, along +y
  o.quaternion.setFromUnitVectors(UP, dir.normalize());
}
const UP = new THREE.Vector3(0, 1, 0);
// Points for showBand(): the middle of a hand, a knee, the front of a foot.
export const handOf = (parts, s) => ({ el: parts['elbow' + s], at: [0, -HAND, 0] });
export const kneeOf = (parts, s) => ({ el: parts['knee' + s], at: [0, 0, 0] });
export const footOf = (parts, s) => ({ el: parts['ankle' + s], at: [0, -BODY.ankle / 2, 0.13] });

// Center a demo sideways in its holder: poses lying down stick out further
// on one side (the legs are longer than the torso and head). Samples
// `pose(parts, t)` over a few seconds and sets parts.shiftX so the middle of
// everything it covers is at the holder's x = 0.
export function centerDemo(parts, pose, seconds = 6) {
  parts.shiftX = 0;
  const holder = parts.root.parentNode.object3D;
  holder.updateMatrixWorld(true);
  const toHolder = new THREE.Matrix4().copy(holder.matrixWorld).invert();
  const all = new THREE.Box3(), box = new THREE.Box3();
  for (let t = 0; t <= seconds; t += 0.5) {
    resetPose(parts);
    pose(parts, t);
    parts.root.object3D.updateMatrixWorld(true);
    all.union(box.setFromObject(parts.root.object3D).applyMatrix4(toHolder));
  }
  parts.shiftX = -(all.min.x + all.max.x) / 2;
}

// Resting between exercises: standing relaxed, breathing slowly. Clearly
// not an exercise, so the user doesn't start the next one too early.
export function idle(parts, t) {
  const breath = (1 - Math.cos(t * 1.6)) / 2;   // ~4 s per breath
  rot(parts.spine, -2 * breath);                // chest lifts a little
  rot(parts.head, 4 - 3 * breath);
  rot(parts.shoulderL, 0, 0, -8 - 2 * breath);  // arms loose, slightly out
  rot(parts.shoulderR, 0, 0, 8 + 2 * breath);
  rot(parts.elbowL, -12);
  rot(parts.elbowR, -12);
  turn(parts, 20);
}

const JOINTS = ['pelvis', 'spine', 'head', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR',
  'hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR'];

// Soft, friendly colors: light "skin", a teal shirt, dark shorts and shoes.
const SKIN = '#e8ecf2', SHIRT = '#4db6ac', SHORTS = '#455a64', SHOES = '#37474f', EYES = '#37474f';
// Props: a light wooden chair, dark dumbbells, an orange band, a pale wall.
const WOOD = '#a1887f', IRON = '#546e7a', BAND = '#ff7043', WALL = '#90a4ae';

// Builds a mannequin inside `parentEl`, with its root entity's id `id`.
// Every body part has class "part" (tests measure them).
export function buildMannequin(parentEl, id) {
  function node(parent, pos, nodeId) {
    const e = document.createElement('a-entity');
    if (nodeId) e.setAttribute('id', nodeId);
    e.setAttribute('position', pos);
    parent.appendChild(e);
    return e;
  }
  function part(parent, color, geometry, pos, extra = {}) {
    const e = document.createElement('a-entity');
    e.classList.add('part');
    e.setAttribute('geometry', geometry);
    e.setAttribute('material', { color, roughness: 0.85 });
    e.setAttribute('position', pos);
    for (const [k, v] of Object.entries(extra)) e.setAttribute(k, v);
    parent.appendChild(e);
  }
  // A limb from its joint down to `length` below, capped at both ends so the
  // joints look round.
  const limb = (parent, color, radius, length) =>
    part(parent, color, { primitive: 'capsule', radius, length }, `0 ${-length / 2} 0`);
  const ball = (parent, color, radius, pos) => part(parent, color, { primitive: 'sphere', radius }, pos);

  const B = BODY;
  const root = node(parentEl, '0 0 0', id);
  const pelvis = node(root, `0 ${PELVIS_Y} 0`);
  // Hips: a short capsule across the body, joining the thighs.
  part(pelvis, SHORTS, { primitive: 'capsule', radius: 0.08, length: 0.12 }, '0 0.01 0',
    { rotation: '0 0 90', scale: `1 1 ${B.torsoDepth / 2 / 0.08}` });

  const spine = node(pelvis, '0 0 0');
  // Torso: a capsule, flattened front to back.
  part(spine, SHIRT, { primitive: 'capsule', radius: 0.125, length: 0.27 }, '0 0.25 0',
    { scale: `1.1 1 ${B.torsoDepth / 2 / 0.125}` });
  part(spine, SKIN, { primitive: 'cylinder', radius: 0.04, height: 0.1 }, `0 ${B.shoulderY + 0.04} 0`);   // neck
  const head = node(spine, `0 ${B.shoulderY + 0.08} 0`);
  ball(head, SKIN, 0.1, '0 0.1 0');
  // Small eyes: show which way it faces.
  for (const x of [-0.035, 0.035]) ball(head, EYES, 0.013, `${x} 0.115 0.092`);

  const arm = side => {
    const shoulder = node(spine, `${side * 0.19} ${B.shoulderY} 0`);
    ball(shoulder, SHIRT, 0.05, '0 0 0');
    limb(shoulder, SKIN, 0.037, B.upperArm);
    const elbow = node(shoulder, `0 ${-B.upperArm} 0`);
    limb(elbow, SKIN, B.forearmR, B.forearm);
    ball(elbow, SKIN, HAND_R, `0 ${-HAND} 0`);
    return [shoulder, elbow];
  };
  const leg = side => {
    const hip = node(pelvis, `${side * 0.09} 0 0`);
    limb(hip, SHORTS, 0.06, B.thigh);
    const knee = node(hip, `0 ${-B.thigh} 0`);
    limb(knee, SKIN, 0.047, B.shin);
    const ankle = node(knee, `0 ${-B.shin} 0`);
    // Foot: a capsule lying along +Z, its sole B.ankle below the ankle
    // joint and its toes 0.16 ahead of it (see onToesY()).
    const r = B.ankle / 2;
    part(ankle, SHOES, { primitive: 'capsule', radius: r, length: 0.22 - 2 * r }, `0 ${-r} 0.05`, { rotation: '90 0 0' });
    return [hip, knee, ankle];
  };
  const [shoulderL, elbowL] = arm(-1);
  const [shoulderR, elbowR] = arm(1);
  const [hipL, kneeL, ankleL] = leg(-1);
  const [hipR, kneeR, ankleR] = leg(1);

  // Props (class "prop", not "part": they aren't body parts).
  function prop(parent, color, geometry, pos, extra = {}) {
    const e = document.createElement('a-entity');
    e.classList.add('prop');
    e.setAttribute('geometry', geometry);
    e.setAttribute('material', { color, roughness: 0.85 });
    e.setAttribute('position', pos);
    for (const [k, v] of Object.entries(extra)) e.setAttribute(k, v);
    parent.appendChild(e);
    return e;
  }
  const S = CHAIR_SIZE, Y = CHAIR_SEAT_Y;
  const chair = node(root, '0 0 0');
  prop(chair, WOOD, { primitive: 'box', width: S, height: 0.04, depth: S }, `0 ${Y - 0.02} 0`);
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    prop(chair, WOOD, { primitive: 'box', width: 0.035, height: Y - 0.04, depth: 0.035 },
      `${x * (S / 2 - 0.03)} ${(Y - 0.04) / 2} ${z * (S / 2 - 0.03)}`);
  }
  prop(chair, WOOD, { primitive: 'box', width: S, height: 0.42, depth: 0.03 }, `0 ${Y + 0.21} ${-S / 2 + 0.015}`);
  // Dumbbells: on the hand balls, across the palm (along x).
  const dumbbell = handBall => {
    const d = node(handBall, '0 0 0');
    prop(d, IRON, { primitive: 'cylinder', radius: 0.012, height: 0.2 }, '0 0 0', { rotation: '0 0 90' });
    for (const x of [-0.09, 0.09]) prop(d, IRON, { primitive: 'cylinder', radius: 0.045, height: 0.05 }, `${x} 0 0`, { rotation: '0 0 90' });
    return d;
  };
  const band = () => {
    const b = node(root, '0 0 0');
    prop(b, BAND, { primitive: 'cylinder', radius: 0.01, height: 1 }, '0 0 0');
    return b;
  };
  const wall = node(root, '0 0.7 0');
  prop(wall, WALL, { primitive: 'box', width: 0.9, height: 1.4, depth: 0.04 }, '0 0 0', { material: { color: WALL, opacity: 0.55, transparent: true } });
  const hand = elbow => elbow.querySelector(':scope > .part:last-child');
  const props = {};
  const keep = (name, el) => { props[name] = { el, parent: el.parentNode.object3D }; };
  keep('chair', chair);
  keep('dumbbellL', dumbbell(hand(elbowL)));
  keep('dumbbellR', dumbbell(hand(elbowR)));
  keep('band1', band());
  keep('band2', band());
  keep('wall', wall);

  const parts = { root, pelvis, spine, head, shoulderL, shoulderR, elbowL, elbowR,
    hipL, hipR, kneeL, kneeR, ankleL, ankleR, props };
  return parts;
}
