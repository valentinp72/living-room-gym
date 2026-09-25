// Shared helpers for reading headset / controller tracking.

// True when a controller entity (laser-controls, oculus-touch-controls, ...)
// has a live WebXR pose this frame. A-Frame keeps an untracked controller at
// its last known position (or 0,0,0 if never seen), so positions alone can't
// be trusted.
export function isHandTracked(handEl) {
  const tc = handEl && handEl.components['tracked-controls-webxr'];
  return !!(tc && tc.controller && tc.pose);
}

// Which immersive mode the scene is in: 'vr', 'ar' or null (flat page).
// Head positions from different modes aren't comparable (on the flat page
// the camera sits at a fixed 1.6 m), so calibrations should be redone when
// this changes.
export function xrMode(sceneEl) {
  if (sceneEl.is('ar-mode')) return 'ar';
  if (sceneEl.is('vr-mode')) return 'vr';
  return null;
}
