import { xrMode } from '../tracking.js';

// Adapts the scene to how it's being viewed (put it on <a-scene>):
//  - AR (the only immersive mode): transparent background so Quest
//    passthrough shows the real room, and elements with class "flat-only"
//    (virtual floor, controller models) hidden. A-Frame 1.5's `background`
//    stays opaque in AR on its own.
//  - VR: refused. The page only offers AR (xr-mode-ui="XRMode: ar"), but a
//    VR session can still start (e.g. the browser entering one by itself).
//    Exercising without seeing the room could hurt, so it's ended at once.
//  - Flat page (desktop debugging): opaque background `color`, virtual floor.
export const xrEnvironment = {
  schema: { color: { type: 'color', default: '#0d1117' } },
  init: function () {
    this.apply = this.apply.bind(this);
    // A-Frame sets the ar-mode / vr-mode state before emitting these.
    this.el.addEventListener('enter-vr', this.apply);
    this.el.addEventListener('exit-vr', this.apply);
  },
  update: function () { this.apply(); },
  apply: function () {
    const scene = this.el;
    const mode = xrMode(scene);
    if (mode === 'vr') {
      console.warn('VR is not supported: exercising without seeing the room is unsafe. Use AR.');
      scene.exitVR();
      return;
    }
    scene.setAttribute('background', { color: this.data.color, transparent: mode === 'ar' });
    scene.querySelectorAll('.flat-only').forEach(e => e.setAttribute('visible', mode !== 'ar'));
  }
};
