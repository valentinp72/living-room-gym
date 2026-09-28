import { rot, turn } from '../avatar.js';

// Each arm has two detectors; a rep counts when either sees a full curl.
// - Height: the hand's height relative to the eyes, in meters. Works for bare
//   hands and controllers, but only while the headset really sees them.
// - Tilt: where the controller points (its laser), in degrees above the
//   horizontal, measured forward (0 = pointing ahead, 90 = up, 180 = behind).
//   It comes from the controller's motion sensors, so it keeps working when
//   the hands are out of the headset's view and the position is only guessed.
// Both use the same rule, relative to the arm's own lowest / highest point so
// it fits any body size: rise by RISE to at least TOP, then drop by DROP.
const HEIGHT = { RISE: 0.3, TOP: -0.45, DROP: 0.3 };   // TOP = chest height
const TILT = { RISE: 70, TOP: 30, DROP: 70 };          // TOP = forearm well above horizontal
const LOST_MS = 1000;   // a rep in progress survives tracking gaps this short

const newDetector = () => ({ up: false, low: null, high: null });
const newArm = () => ({ reps: 0, tracked: false, lostMs: 0, height: newDetector(), tilt: newDetector() });

// Feeds one value to a detector; true when it completes a rep.
function detect(d, v, { RISE, TOP, DROP }) {
  if (!d.up) {
    d.low = d.low === null ? v : Math.min(d.low, v);
    if (v > TOP && v - d.low > RISE) { d.up = true; d.high = v; }
    return false;
  }
  d.high = Math.max(d.high, v);
  if (d.high - v > DROP) { d.up = false; d.low = v; return true; }
  return false;
}

// Restart a detector from the bottom, at value v (or unknown).
function rearm(d, v) { d.up = false; d.low = v; d.high = null; }

// Horizontal direction the user faces. The top of the head points forward
// when looking down at the hands, so adding it keeps this valid then too.
const fwd = new THREE.Vector3(), up = new THREE.Vector3();
function facing(camera) {
  const q = camera.object3D.quaternion;
  fwd.set(0, 0, -1).applyQuaternion(q).add(up.set(0, 1, 0).applyQuaternion(q));
  fwd.y = 0;
  return fwd.normalize();
}

function stepArm(arm, hand, headY, forward, dtMs) {
  arm.tracked = hand.tracked || hand.rayTracked;
  if (!arm.tracked) {
    // Short gaps (hand leaving the view for a moment) keep the rep in
    // progress; after that it's forgotten. The rep count is always kept.
    arm.lostMs += dtMs;
    if (arm.lostMs > LOST_MS) { rearm(arm.height, null); rearm(arm.tilt, null); }
    return;
  }
  arm.lostMs = 0;
  // Only trust a position the headset actually sees.
  const height = hand.tracked && !hand.emulated ? hand.position.y - headY : null;
  // Only controllers: a bare hand's ray goes from the shoulder through the hand.
  const r = hand.ray;
  const tilt = hand.kind === 'controller' && hand.rayTracked
    ? Math.atan2(r.y, r.x * forward.x + r.z * forward.z) * 180 / Math.PI : null;
  const done = (height !== null && detect(arm.height, height, HEIGHT))
    || (tilt !== null && detect(arm.tilt, tilt, TILT));
  if (done) {
    // One curl can trip both detectors: restart both so it counts once.
    arm.reps++;
    rearm(arm.height, height);
    rearm(arm.tilt, tilt);
  }
}

export default {
  id: 'curls', name: 'Bicep Curls', muscle: 'Arms',
  instructions: 'Hold a controller in each hand, or use bare hands in view of the headset. Curl your hand up to your shoulder, then lower it.',
  unit: 'reps',
  state: () => ({ left: newArm(), right: newArm() }),
  update(ctx, st, dtMs) {
    if (!ctx.camera.object3D) return;
    const headY = ctx.camera.object3D.position.y;
    const forward = facing(ctx.camera);
    stepArm(st.left, ctx.hands.left, headY, forward, dtMs);
    stepArm(st.right, ctx.hands.right, headY, forward, dtMs);
  },
  // One rep = one curl with each arm.
  count: st => Math.min(st.left.reps, st.right.reps),
  // A ding for each arm's curl.
  moves: st => st.left.reps + st.right.reps,
  label(st) {
    const text = 'Left: ' + st.left.reps + '    Right: ' + st.right.reps;
    if (!st.left.tracked && !st.right.tracked) return text + '\nShow your hands or controllers';
    if (!st.left.tracked) return text + '\nLeft hand not seen';
    if (!st.right.tracked) return text + '\nRight hand not seen';
    return text;
  },
  demo(parts, t) {
    // Alternate arms: 0 = arm straight down, 1 = hand at the shoulder.
    const l = (1 - Math.cos(t * 2)) / 2;
    const r = (1 + Math.cos(t * 2)) / 2;
    rot(parts.elbowL, -10 - 130 * l);
    rot(parts.elbowR, -10 - 130 * r);
    rot(parts.shoulderL, -5);   // elbows stay by the sides
    rot(parts.shoulderR, -5);
    turn(parts, 60);
  }
};
