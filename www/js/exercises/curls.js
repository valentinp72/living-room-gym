import { rot, turn } from '../avatar.js';

// Hand height is measured relative to the eyes, in meters. Thresholds are
// relative to each arm's own lowest/highest point so they fit any body size.
const RISE = 0.3;       // hand must rise this far above its lowest point...
const TOP = -0.45;      // ...and reach at least chest height (below the eyes)
const DROP = 0.3;       // then fall this far below its highest point = 1 rep

const newArm = () => ({ reps: 0, tracked: false, up: false, low: null, high: null });

function stepArm(arm, hand, headY) {
  arm.tracked = hand.tracked;
  if (!arm.tracked) {
    // Forget the partial movement; the rep count is kept.
    arm.up = false; arm.low = null; arm.high = null;
    return;
  }
  const rel = hand.position.y - headY;
  if (!arm.up) {
    arm.low = arm.low === null ? rel : Math.min(arm.low, rel);
    if (rel > TOP && rel - arm.low > RISE) { arm.up = true; arm.high = rel; }
  } else {
    arm.high = Math.max(arm.high, rel);
    if (arm.high - rel > DROP) { arm.up = false; arm.low = rel; arm.reps++; }
  }
}

export default {
  id: 'curls', name: 'Bicep Curls', muscle: 'Arms', color: '#1565c0',
  instructions: 'Hold a controller in each hand, or use your bare hands. Curl your hand up toward your shoulder, then lower it.',
  state: () => ({ left: newArm(), right: newArm() }),
  update(ctx, st) {
    if (!ctx.camera.object3D) return;
    const headY = ctx.camera.object3D.position.y;
    stepArm(st.left, ctx.hands.left, headY);
    stepArm(st.right, ctx.hands.right, headY);
  },
  label(st) {
    const text = 'Left: ' + st.left.reps + '    Right: ' + st.right.reps;
    return st.left.tracked || st.right.tracked ? text : text + '\nShow your hands or controllers';
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
