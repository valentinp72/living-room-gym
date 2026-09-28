import { BODY, rot, turn, lieOnBack, legTo, LYING_Y } from '../avatar.js';
import { gazeY } from '../tracking.js';

// Crunches, from the headset alone: lying on the back (head low, looking
// up), each crunch lifts the head and shoulders off the floor.
const LYING_MAX_Y = 0.45;   // head below this (m) and...
const FACE_UP = 0.5;        // ...gaze pointing up (gaze y above this) = lying on the back
const MAX_Y = 0.8;          // head above this = sitting up / standing: not crunching
const RISE = 0.12;          // head rises this far above its lying height...
const DROP = 0.08;          // ...then comes back down this far = 1 rep

export default {
  id: 'crunches', name: 'Crunches', muscle: 'Abs', floor: true,
  instructions: 'Lie on your back, knees bent, feet flat. Lift your head and shoulders off the floor, then lower them.',
  unit: 'reps',
  state: () => ({ reps: 0, ready: false, up: false, low: null, high: null }),
  update(ctx, st) {
    const head = ctx.camera.object3D;
    if (!head) return;
    const y = head.position.y;
    if (y > MAX_Y) { st.up = false; st.low = null; return; }
    const lying = y < LYING_MAX_Y && gazeY(head) > FACE_UP;
    if (lying) st.ready = true;
    if (!st.up) {
      // The low point only counts while really lying down.
      if (lying) st.low = st.low === null ? y : Math.min(st.low, y);
      if (st.low !== null && y - st.low > RISE) { st.up = true; st.high = y; }
    } else {
      st.high = Math.max(st.high, y);
      if (st.high - y > DROP) { st.up = false; st.low = null; st.reps++; }
    }
  },
  count: st => st.reps,
  label: st => st.ready ? 'Reps: ' + st.reps : 'Lie on your back',
  demo(parts, t) {
    const c = (1 - Math.cos(t * 2)) / 2;   // 0 = lying, 1 = top of the crunch
    const pelvis = { y: LYING_Y + 0.015 * c, z: 0 };
    lieOnBack(parts, pelvis);
    rot(parts.spine, 30 * c);              // curl the shoulders up
    rot(parts.head, 15 + 15 * c);          // chin toward the chest
    for (const s of ['L', 'R']) {
      legTo(parts, s, pelvis, -90, { y: BODY.ankle, z: 0.5 });   // knees bent, feet flat
      rot(parts['shoulder' + s], -40 * c); // hands reach toward the knees
    }
    turn(parts, 90);
  }
};
