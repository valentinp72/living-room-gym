export default {
  id: 'curls', name: 'Bicep Curls', muscle: 'Arms', color: '#1565c0',
  instructions: 'Hold a controller in each hand. Curl your hand up toward your shoulder, then lower it.',
  state: () => ({ leftUp: false, rightUp: false, reps: 0 }),
  update(ctx, st) {
    [['rHand', 'rightUp'], ['lHand', 'leftUp']].forEach(([handKey, flagKey]) => {
      const hand = ctx[handKey];
      if (!hand || !hand.object3D || !ctx.camera.object3D) return;
      const rel = hand.object3D.position.y - ctx.camera.object3D.position.y;
      if (!st[flagKey] && rel > -0.15) st[flagKey] = true;
      else if (st[flagKey] && rel < -0.45) { st[flagKey] = false; st.reps++; }
    });
  },
  label: st => 'Reps: ' + st.reps,
  demo(parts, t) {
    const ang = -((Math.sin(t * 2) + 1) / 2) * 110;
    parts.shoulderL.setAttribute('rotation', { x: ang, y: 0, z: 0 });
    parts.shoulderR.setAttribute('rotation', { x: ang, y: 0, z: 0 });
  }
};
