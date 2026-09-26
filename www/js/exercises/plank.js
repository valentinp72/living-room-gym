import { BODY, place, rot, turn } from '../avatar.js';
import { gazeY } from '../tracking.js';

// Plank detection from the headset alone (works with controllers, bare hands
// or nothing in hand). In a plank the head is low and faces the floor.
// Forearm plank: the headset is about 25-45 cm above the floor.
// To start, the head must be in a fixed window (wide, since the floor height
// is the Quest's estimate and can be a few cm off). Once holding, the height
// during the first second is the reference, and the hold stops when the
// head drops (lying down) or rises (sitting back) too far from it. A plank
// is still, so this can be much tighter than any fixed window.
const START = { minY: 0.15, maxY: 0.6, minDown: 40 };
const HOLD_DROP = 0.1;   // m below the reference: lying down
const HOLD_RISE = 0.12;  // m above it: sitting back, kneeling up
const HOLD_DOWN = 30;    // degrees the face must keep pointing down
const ENTER = 1.0;       // seconds in position before the timer starts (counted)
const EXIT = 1.0;        // seconds out of position before it stops (not counted)
const TRYING_Y = 0.9;    // below this, say what's missing instead of the prompt

// How far the face points down, in degrees (90 = straight at the floor,
// 0 = at the horizon, negative = up, e.g. lying on the back).
const lookDown = head => -Math.asin(Math.max(-1, Math.min(1, gazeY(head)))) * 180 / Math.PI;

// null when in plank position, else what's wrong (shown to the user).
// ref: the head height of the plank being held, or null to start one.
function whatsOff(head, ref) {
  const y = head.position.y;
  const cm = Math.round(y * 100) + ' cm';
  const minY = ref === null ? START.minY : ref - HOLD_DROP;
  const maxY = ref === null ? START.maxY : ref + HOLD_RISE;
  if (y > maxY) return 'Head lower (' + cm + ')';
  if (y < minY) return 'Head too low (' + cm + ')';
  const down = lookDown(head);
  if (down < (ref === null ? START.minDown : HOLD_DOWN)) return 'Face the floor (' + Math.round(down) + ' deg)';
  return null;
}

const fmt = s => s.toFixed(1) + 's';

export default {
  id: 'plank', name: 'Plank Hold', muscle: 'Abs', color: '#ef6c00',
  instructions: 'Get into a forearm plank, facing the floor. The timer starts and stops by itself.',
  unit: 'seconds',
  state: () => ({ holding: false, time: 0, inFor: 0, outFor: 0, last: null, best: 0, total: 0, off: null,
    ref: null, refSum: 0 }),
  update(ctx, st, dt) {
    if (!ctx.camera.object3D) return;
    const s = dt / 1000;
    const head = ctx.camera.object3D;
    const off = whatsOff(head, st.holding ? st.ref : null);
    const ok = !off;
    st.off = head.position.y > TRYING_Y ? null : off;   // standing: just the prompt
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
  label(st) {
    if (st.holding) return 'Hold: ' + fmt(st.time) + (st.best ? '\nBest: ' + fmt(st.best) : '');
    if (st.off) return st.off + (st.best ? '\nBest: ' + fmt(st.best) : '');
    if (st.last === null) return 'Get into plank position';
    return 'Last: ' + fmt(st.last) + '    Best: ' + fmt(st.best);
  },
  demo(parts) {
    // Forearm plank, face down: the straight body tilts TILT degrees from
    // vertical (90 would be flat). TILT is chosen so that, with the shoulders
    // resting on vertical upper arms, the toes just touch the floor.
    const TILT = 83;
    const rad = Math.PI / 180;
    const shoulderH = BODY.upperArm + BODY.forearmR;
    place(parts.pelvis, 0, shoulderH - BODY.shoulderY * Math.cos(TILT * rad), -0.1);
    rot(parts.pelvis, TILT);
    for (const s of ['L', 'R']) {
      rot(parts['shoulder' + s], -TILT);   // upper arms vertical
      rot(parts['elbow' + s], -90);        // forearms flat on the floor
    }
    rot(parts.head, -10);                  // look at the floor just ahead
    turn(parts, 90);                       // side view
  }
};
