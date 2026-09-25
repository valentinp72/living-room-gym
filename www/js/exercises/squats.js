export default {
  id: 'squats', name: 'Squats', muscle: 'Legs', color: '#2e7d32',
  instructions: 'Stand still to calibrate, then squat down and stand back up for each rep.',
  state: () => ({ baselineY: null, down: false, reps: 0 }),
  update(ctx, st) {
    if (!ctx.camera.object3D) return;
    const y = ctx.camera.object3D.position.y;
    if (st.baselineY === null) { st.baselineY = y; return; }
    if (!st.down && y < st.baselineY - 0.25) st.down = true;
    else if (st.down && y > st.baselineY - 0.08) { st.down = false; st.reps++; }
  },
  label: st => 'Reps: ' + st.reps,
  demo(parts, t) {
    const c = (Math.sin(t * 1.3) + 1) / 2;
    parts.root.setAttribute('position', { x: 1.6, y: 1.1 - c * 0.3, z: -2 });
    parts.hipL.setAttribute('rotation', { x: c * 40, y: 0, z: 0 });
    parts.hipR.setAttribute('rotation', { x: c * 40, y: 0, z: 0 });
  }
};
