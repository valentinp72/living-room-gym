// Demo mannequin: box/sphere body parts hung on joint pivots.
//
// Conventions (see CLAUDE.md): meters, +Y up, the mannequin faces its own +Z.
// A limb hangs along -Y from its pivot, so a NEGATIVE x rotation swings it
// forward (+Z) and a positive one swings it backward.
//
// Joint tree, with the standing pose (pivot positions relative to their parent):
//   root                 on the floor, between the feet; places + turns the whole body
//   └ pelvis             hip height (PELVIS_Y); move/rotate it to squat or lie down
//     ├ spine            torso, bends at the pelvis (+x = lean forward)
//     │ ├ head
//     │ ├ shoulderL/R  → elbowL/R
//     └ hipL/R         → kneeL/R → ankleL/R

const DEG = Math.PI / 180;

// Segment lengths (meters), for a ~1.75 m tall figure.
export const BODY = {
  thigh: 0.44,      // hip -> knee
  shin: 0.44,       // knee -> ankle
  ankle: 0.06,      // ankle -> sole
  shoulderY: 0.47,  // pelvis -> shoulder line
  upperArm: 0.30,   // shoulder -> elbow
  forearm: 0.27,    // elbow -> wrist
  armThick: 0.07,
};
export const PELVIS_Y = BODY.ankle + BODY.shin + BODY.thigh;

// Where the mannequin stands on the stage (right of the exercise panel, see
// index.html; the user is at the stage origin), and how far it is turned
// from facing the user by default. 45° gives a three-quarter view.
const HOME = { x: 1.3, z: -2.6 };
const DEFAULT_TURN = 45;

// Rotate an entity's pivot, in degrees. Uses object3D directly: it runs
// every frame for every joint, and nothing reads these back as attributes.
export function rot(el, x = 0, y = 0, z = 0) {
  el.object3D.rotation.set(x * DEG, y * DEG, z * DEG);
}
export function place(el, x = 0, y = 0, z = 0) {
  el.object3D.position.set(x, y, z);
}

// Turn the whole body `deg` degrees away from facing the user (the user is
// at the stage origin). 0 = facing the user, 90 = right side towards the user.
export function turn(parts, deg) {
  const toUser = Math.atan2(-HOME.x, -HOME.z) / DEG;
  rot(parts.root, 0, toUser + deg, 0);
}

// Back to standing straight, arms down. Called before every demo frame, so a
// demo only sets the joints it moves and no pose leaks between exercises.
export function resetPose(parts) {
  place(parts.root, HOME.x, 0, HOME.z);
  turn(parts, DEFAULT_TURN);
  place(parts.pelvis, 0, PELVIS_Y, 0);
  for (const name of JOINTS) rot(parts[name]);
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

const SKIN = '#e0e0e0', ARM = '#c0c0c0', LEG = '#9e9e9e';

export function buildMannequin(parentEl) {
  function node(parent, pos, id) {
    const e = document.createElement('a-entity');
    if (id) e.setAttribute('id', id);
    e.setAttribute('position', pos);
    parent.appendChild(e);
    return e;
  }
  function box(parent, color, w, h, d, pos) {
    const e = document.createElement('a-box');
    Object.entries({ color, width: w, height: h, depth: d, position: pos })
      .forEach(([k, v]) => e.setAttribute(k, v));
    parent.appendChild(e);
  }
  function sphere(parent, color, radius, pos) {
    const e = document.createElement('a-sphere');
    Object.entries({ color, radius, position: pos }).forEach(([k, v]) => e.setAttribute(k, v));
    parent.appendChild(e);
  }

  const B = BODY;
  const root = node(parentEl, `${HOME.x} 0 ${HOME.z}`, 'mannequin');
  root.setAttribute('visible', false);
  const pelvis = node(root, `0 ${PELVIS_Y} 0`);

  const spine = node(pelvis, '0 0 0');
  box(spine, SKIN, 0.32, 0.55, 0.18, '0 0.225 0');
  const head = node(spine, `0 ${B.shoulderY + 0.08} 0`);
  sphere(head, SKIN, 0.11, '0 0.11 0');
  box(head, '#9e9e9e', 0.08, 0.03, 0.03, '0 0.12 0.105');   // "eyes": shows which way it faces

  const arm = side => {
    const shoulder = node(spine, `${side * 0.2} ${B.shoulderY} 0`);
    box(shoulder, ARM, B.armThick, B.upperArm, B.armThick, `0 ${-B.upperArm / 2} 0`);
    const elbow = node(shoulder, `0 ${-B.upperArm} 0`);
    box(elbow, ARM, B.armThick, B.forearm, B.armThick, `0 ${-B.forearm / 2} 0`);
    sphere(elbow, SKIN, 0.045, `0 ${-B.forearm - 0.03} 0`);
    return [shoulder, elbow];
  };
  const leg = side => {
    const hip = node(pelvis, `${side * 0.09} 0 0`);
    box(hip, LEG, 0.12, B.thigh, 0.12, `0 ${-B.thigh / 2} 0`);
    const knee = node(hip, `0 ${-B.thigh} 0`);
    box(knee, LEG, 0.1, B.shin, 0.1, `0 ${-B.shin / 2} 0`);
    const ankle = node(knee, `0 ${-B.shin} 0`);
    box(ankle, LEG, 0.1, B.ankle, 0.22, `0 ${-B.ankle / 2} 0.05`);
    return [hip, knee, ankle];
  };
  const [shoulderL, elbowL] = arm(-1);
  const [shoulderR, elbowR] = arm(1);
  const [hipL, kneeL, ankleL] = leg(-1);
  const [hipR, kneeR, ankleR] = leg(1);

  return { root, pelvis, spine, head, shoulderL, shoulderR, elbowL, elbowR,
    hipL, hipR, kneeL, kneeR, ankleL, ankleR };
}
