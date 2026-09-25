export default {
  id: 'plank', name: 'Plank Hold', muscle: 'Abs', color: '#ef6c00',
  instructions: 'Get into plank position, then press Start/Stop below to time your hold.',
  manual: true,
  state: () => ({ running: false, time: 0 }),
  update(ctx, st, dt) { if (st.running) st.time += dt / 1000; },
  label: st => 'Hold: ' + st.time.toFixed(1) + 's',
  demo(parts) {
    parts.root.setAttribute('position', { x: 1.6, y: 0.55, z: -2 });
    parts.root.setAttribute('rotation', { x: -90, y: 0, z: 0 });
  }
};
