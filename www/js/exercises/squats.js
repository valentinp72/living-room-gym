import { xrMode } from '../tracking.js';

// Head height in meters, relative to the calibrated standing height.
const DOWN = 0.25;          // head this far below standing = bottom of the squat
const UP = 0.08;            // back within this of standing = rep done
const STILL_RANGE = 0.03;   // calibration: head must stay within 3 cm...
const STILL_MS = 1000;      // ...for this long

const newCalibration = () => ({ min: Infinity, max: -Infinity, ms: 0 });

export default {
  id: 'squats', name: 'Squats', muscle: 'Legs', color: '#2e7d32',
  instructions: 'Stand still to calibrate, then squat down and stand back up for each rep.',
  state: () => ({ mode: undefined, calib: newCalibration(), baselineY: null, down: false, reps: 0 }),
  update(ctx, st, dt) {
    if (!ctx.camera.object3D) return;
    const y = ctx.camera.object3D.position.y;

    // Entering or leaving VR/AR moves the head to a different height: recalibrate.
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
      if (y < st.baselineY - DOWN) st.down = true;
    } else if (y > st.baselineY - UP) { st.down = false; st.reps++; }
  },
  label: st => st.baselineY === null ? 'Stand still...' : 'Reps: ' + st.reps,
  demo(parts, t) {
    const c = (Math.sin(t * 1.3) + 1) / 2;
    parts.root.setAttribute('position', { x: 1.6, y: 1.1 - c * 0.3, z: -2 });
    parts.hipL.setAttribute('rotation', { x: c * 40, y: 0, z: 0 });
    parts.hipR.setAttribute('rotation', { x: c * 40, y: 0, z: 0 });
  }
};
