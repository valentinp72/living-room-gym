// Building block for timed holds detected from the headset (plank, side
// plank, wall sit). Each frame, a check says whether the head is in
// position, or what's off (shown to the user, e.g. "Head lower (85 cm)").
// The timer starts after ENTER seconds in position (and counts them) and
// stops after EXIT seconds out of it (without counting them).
//   start(head, st) -> null if the head is in position to start a hold,
//                      else a short hint
//   keep(head, st)  -> the same while holding. st.ref is then the head's
//                      average height over the first ENTER seconds: a hold is
//                      still, so keep() can allow only a small drift from it.
//   calibrate       -> true: first measure the standing head height
//                      (st.standY, see calibration.js), e.g. for a wall sit
//   prompt          -> counter text before the first hold
//   export default { ...hold({ start, keep, prompt }), id, name, muscle,
//     instructions, demo }
import { newCalibration, calibrate } from './calibration.js';
import { gazeY } from '../tracking.js';

const ENTER = 1.0;       // seconds in position before the timer starts (counted)
const EXIT = 1.0;        // seconds out of position before it stops (not counted)
const TRYING_Y = 0.9;    // head below this: show what's off instead of the prompt

const fmt = s => s.toFixed(1) + 's';

export function hold({ start, keep, prompt, calibrate: needsStand = false, tryingY = TRYING_Y }) {
  return {
    unit: 'seconds',
    state: () => ({ holding: false, time: 0, inFor: 0, outFor: 0, last: null, best: 0, total: 0,
      off: null, ref: null, refSum: 0, calib: newCalibration(), standY: null }),
    update(ctx, st, dt) {
      const head = ctx.camera.object3D;
      if (!head) return;
      const s = dt / 1000;
      if (needsStand && !calibrate(st.calib, ctx.scene, head.position.y, dt)) {
        st.standY = null; st.holding = false; st.inFor = 0;
        return;
      }
      if (needsStand) st.standY = st.calib.baselineY;
      const off = st.holding ? keep(head, st) : start(head, st);
      const ok = !off;
      // Standing (or, with a calibration, back up near standing height): just the prompt.
      const trying = needsStand ? head.position.y < st.standY - 0.12 : head.position.y < tryingY;
      st.off = trying ? off : null;
      if (!st.holding) {
        st.inFor = ok ? st.inFor + s : 0;
        st.refSum = ok ? st.refSum + head.position.y * s : 0;
        if (st.inFor >= ENTER) {
          st.holding = true; st.time = st.inFor; st.outFor = 0;
          st.ref = st.refSum / st.inFor;   // average head height over that second
        }
        return;
      }
      st.time += s;
      st.outFor = ok ? 0 : st.outFor + s;
      if (st.outFor >= EXIT) {
        st.holding = false;
        st.time -= st.outFor;
        st.last = st.time;
        st.best = Math.max(st.best, st.time);
        st.total += st.time;
        st.inFor = 0;
        st.refSum = 0;
        st.ref = null;
      }
    },
    // Seconds held, over all holds.
    count: st => st.total + (st.holding ? st.time : 0),
    // Is the timer running? (the app plays a sound when it starts or stops)
    holding: st => st.holding,
    label(st) {
      if (needsStand && st.standY === null) return 'Stand still...';
      if (st.holding) return 'Hold: ' + fmt(st.time) + (st.best ? '\nBest: ' + fmt(st.best) : '');
      if (st.off) return st.off + (st.best ? '\nBest: ' + fmt(st.best) : '');
      if (st.last === null) return prompt;
      return 'Last: ' + fmt(st.last) + '    Best: ' + fmt(st.best);
    },
  };
}

// Common checks, returning a hint or null.
export const cm = y => Math.round(y * 100) + ' cm';
export function heightOff(y, minY, maxY) {
  if (y > maxY) return 'Head lower (' + cm(y) + ')';
  if (y < minY) return 'Head too low (' + cm(y) + ')';
  return null;
}
// Once holding: the head within `drop` below and `rise` above st.ref.
export const keptHeight = (head, st, drop, rise) => heightOff(head.position.y, st.ref - drop, st.ref + rise);

// How far the face points down, in degrees (90 = straight at the floor,
// 0 = at the horizon, negative = up, e.g. lying on the back).
export const lookDown = head => -Math.asin(Math.max(-1, Math.min(1, gazeY(head)))) * 180 / Math.PI;
export function faceDownOff(head, minDeg) {
  const down = lookDown(head);
  return down < minDeg ? 'Face the floor (' + Math.round(down) + ' deg)' : null;
}
