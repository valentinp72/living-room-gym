// Standing head height, measured once the head stays still, and measured
// again when entering or leaving AR (the head height changes: on the flat
// page the camera sits at a fixed 1.6 m). Used by headDip() and hold().
import { xrMode } from '../tracking.js';

const STILL_RANGE = 0.03;   // the head must stay within 3 cm...
const STILL_MS = 1000;      // ...for this long

export const newCalibration = () => ({ mode: undefined, min: Infinity, max: -Infinity, ms: 0, baselineY: null });

// Feed the head height every frame. Returns true once c.baselineY is known.
export function calibrate(c, scene, y, dt) {
  const mode = xrMode(scene);
  if (mode !== c.mode) Object.assign(c, newCalibration(), { mode });
  if (c.baselineY !== null) return true;
  c.min = Math.min(c.min, y); c.max = Math.max(c.max, y);
  if (c.max - c.min > STILL_RANGE) { c.min = c.max = y; c.ms = 0; return false; }
  c.ms += dt;
  if (c.ms >= STILL_MS) c.baselineY = c.max;
  return c.baselineY !== null;
}
