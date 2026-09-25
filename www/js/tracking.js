// Shared helpers for reading headset / controller tracking.

// True when a controller entity (laser-controls, oculus-touch-controls, ...)
// has a live WebXR pose this frame. A-Frame keeps an untracked controller at
// its last known position (or 0,0,0 if never seen), so positions alone can't
// be trusted.
export function isHandTracked(handEl) {
  const tc = handEl && handEl.components['tracked-controls-webxr'];
  return !!(tc && tc.controller && tc.pose);
}
