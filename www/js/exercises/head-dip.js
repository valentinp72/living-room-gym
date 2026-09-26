import { xrMode } from '../tracking.js';

// Building block for standing exercises where the head goes down and back
// up (squats, lunges). It calibrates the standing head height once the head
// stays still, and recalibrates when entering / leaving AR (the head
// height changes). A rep = head `down` meters below standing, then back
// within `up` of it.
//   export default { ...headDip({ down: 0.25 }), id, name, muscle, color,
//     instructions, demo }
const STILL_RANGE = 0.03;   // calibration: head must stay within 3 cm...
const STILL_MS = 1000;      // ...for this long

const newCalibration = () => ({ min: Infinity, max: -Infinity, ms: 0 });

export function headDip({ down, up = 0.08 }) {
  return {
    unit: 'reps',
    state: () => ({ mode: undefined, calib: newCalibration(), baselineY: null, down: false, reps: 0 }),
    update(ctx, st, dt) {
      if (!ctx.camera.object3D) return;
      const y = ctx.camera.object3D.position.y;

      // Entering or leaving AR moves the head to a different height: recalibrate.
      const mode = xrMode(ctx.scene);
      if (mode !== st.mode) {
        st.mode = mode; st.calib = newCalibration(); st.baselineY = null; st.down = false;
      }

      if (st.baselineY === null) {
        const c = st.calib;
        c.min = Math.min(c.min, y); c.max = Math.max(c.max, y);
        if (c.max - c.min > STILL_RANGE) { c.min = c.max = y; c.ms = 0; return; }
        c.ms += dt;
        if (c.ms >= STILL_MS) st.baselineY = c.max;
        return;
      }

      if (!st.down) {
        // Standing up straighter than during calibration raises the baseline.
        if (y > st.baselineY) st.baselineY = y;
        if (y < st.baselineY - down) st.down = true;
      } else if (y > st.baselineY - up) { st.down = false; st.reps++; }
    },
    count: st => st.reps,
    label: st => st.baselineY === null ? 'Stand still...' : 'Reps: ' + st.reps,
  };
}
