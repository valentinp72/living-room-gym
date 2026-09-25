import { xrMode } from '../tracking.js';
import { BODY, place, rot, turn } from '../avatar.js';

// Head height in meters, relative to the calibrated standing height.
const DOWN = 0.25;          // head this far below standing = bottom of the squat
const UP = 0.08;            // back within this of standing = rep done
const STILL_RANGE = 0.03;   // calibration: head must stay within 3 cm...
const STILL_MS = 1000;      // ...for this long

const newCalibration = () => ({ min: Infinity, max: -Infinity, ms: 0 });

export default {
  id: 'squats', name: 'Squats', muscle: 'Legs', color: '#2e7d32',
  instructions: 'Stand still to calibrate, then squat down and stand back up for each rep.',
  unit: 'reps',
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
  count: st => st.reps,
  label: st => st.baselineY === null ? 'Stand still...' : 'Reps: ' + st.reps,
  demo(parts, t) {
    const c = (1 - Math.cos(t * 1.6)) / 2;   // 0 = standing, 1 = bottom of the squat
    const thigh = 95 * c, shin = 35 * c;     // forward tilt from vertical, degrees
    const rad = Math.PI / 180;
    // Keep the feet planted: put the pelvis where the thighs and shins end up.
    place(parts.pelvis, 0,
      BODY.ankle + BODY.shin * Math.cos(shin * rad) + BODY.thigh * Math.cos(thigh * rad),
      BODY.shin * Math.sin(shin * rad) - BODY.thigh * Math.sin(thigh * rad));
    for (const s of ['L', 'R']) {
      rot(parts['hip' + s], -thigh);
      rot(parts['knee' + s], thigh + shin);
      rot(parts['ankle' + s], -shin);
      rot(parts['shoulder' + s], -90 - 45 * c);   // arms held level in front
    }
    rot(parts.spine, 45 * c);                     // lean the chest forward
    turn(parts, 60);
  }
};
