import { xrMode } from '../tracking.js';

// Adapts the scene to how it's being viewed (put it on <a-scene>):
//  - AR (the main mode): transparent background so Quest passthrough shows
//    the real room, and elements with class "vr-only" (virtual floor, ...)
//    hidden. A-Frame 1.5's `background` stays opaque in AR on its own.
//  - VR and AR: elements with class "flat-only" (desktop gaze cursor) hidden.
//  - Flat page / VR: opaque background `color`.
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
    scene.setAttribute('background', { color: this.data.color, transparent: mode === 'ar' });
    scene.querySelectorAll('.vr-only').forEach(e => e.setAttribute('visible', mode !== 'ar'));
    scene.querySelectorAll('.flat-only').forEach(e => e.setAttribute('visible', mode === null));
  }
};
