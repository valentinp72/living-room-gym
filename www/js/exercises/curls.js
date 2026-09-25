import { isHandTracked } from '../tracking.js';

// Hand height is measured relative to the eyes, in meters. Thresholds are
// relative to each arm's own lowest/highest point so they fit any body size.
const RISE = 0.3;       // hand must rise this far above its lowest point...
const TOP = -0.45;      // ...and reach at least chest height (below the eyes)
const DROP = 0.3;       // then fall this far below its highest point = 1 rep

const newArm = () => ({ reps: 0, tracked: false, up: false, low: null, high: null });

function stepArm(arm, handEl, headY) {
  arm.tracked = isHandTracked(handEl);
  if (!arm.tracked) {
    // Forget the partial movement; the rep count is kept.
    arm.up = false; arm.low = null; arm.high = null;
    return;
  }
  const rel = handEl.object3D.position.y - headY;
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
  instructions: 'Hold a controller in each hand. Curl your hand up toward your shoulder, then lower it.',
  state: () => ({ left: newArm(), right: newArm() }),
  update(ctx, st) {
    if (!ctx.camera.object3D) return;
    const headY = ctx.camera.object3D.position.y;
    stepArm(st.left, ctx.lHand, headY);
    stepArm(st.right, ctx.rHand, headY);
  },
  label(st) {
    const text = 'Left: ' + st.left.reps + '    Right: ' + st.right.reps;
    return st.left.tracked || st.right.tracked ? text : text + '\nWaiting for controllers';
  },
  demo(parts, t) {
    const ang = -((Math.sin(t * 2) + 1) / 2) * 110;
    parts.shoulderL.setAttribute('rotation', { x: ang, y: 0, z: 0 });
    parts.shoulderR.setAttribute('rotation', { x: ang, y: 0, z: 0 });
  }
};
