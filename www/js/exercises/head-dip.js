import { newCalibration, calibrate } from './calibration.js';

// Building block for exercises where the head goes down and back up from a
// still top position (squats, lunges, chair dips...). It calibrates the top
// head height once the head stays still (see calibration.js). A rep = head
// `down` meters below the top, then back within `up` of it.
//   still -> counter text while calibrating
//   export default { ...headDip({ down: 0.25 }), id, name, muscle,
//     instructions, demo }
export function headDip({ down, up = 0.08, still = 'Stand still...' }) {
  return {
    unit: 'reps',
    state: () => ({ calib: newCalibration(), down: false, reps: 0 }),
    update(ctx, st, dt) {
      if (!ctx.camera.object3D) return;
      const y = ctx.camera.object3D.position.y;
      const c = st.calib;
      if (!calibrate(c, ctx.scene, y, dt)) { st.down = false; return; }
      if (!st.down) {
        // Standing up straighter than during calibration raises the top.
        if (y > c.baselineY) c.baselineY = y;
        if (y < c.baselineY - down) st.down = true;
      } else if (y > c.baselineY - up) { st.down = false; st.reps++; }
    },
    count: st => st.reps,
    label: st => st.calib.baselineY === null ? still : 'Reps: ' + st.reps,
  };
}
