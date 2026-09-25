import { BODY, place, rot, turn } from '../avatar.js';

// Plank detection from the headset alone (works with controllers, bare hands
// or nothing in hand). In a plank the head is low and face down.
const MIN_Y = 0.25;      // head height above the floor (m): lower = lying flat
const MAX_Y = 0.8;       // higher = kneeling / sitting up
const MAX_UP_Y = 0.5;    // head tilted > 60° from upright (up vector's y = cos(tilt))
const ENTER = 1.0;       // seconds in position before the timer starts (counted)
const EXIT = 1.0;        // seconds out of position before it stops (not counted)

const UP = new THREE.Vector3();

function inPlank(head) {
  if (head.position.y < MIN_Y || head.position.y > MAX_Y) return false;
  return UP.set(0, 1, 0).applyQuaternion(head.quaternion).y < MAX_UP_Y;
}

const fmt = s => s.toFixed(1) + 's';

export default {
  id: 'plank', name: 'Plank Hold', muscle: 'Abs', color: '#ef6c00',
  instructions: 'Get into a forearm plank, facing the floor. The timer starts and stops by itself.',
  unit: 'seconds',
  state: () => ({ holding: false, time: 0, inFor: 0, outFor: 0, last: null, best: 0, total: 0 }),
  update(ctx, st, dt) {
    if (!ctx.camera.object3D) return;
    const s = dt / 1000;
    const ok = inPlank(ctx.camera.object3D);
    if (!st.holding) {
      st.inFor = ok ? st.inFor + s : 0;
      if (st.inFor >= ENTER) { st.holding = true; st.time = st.inFor; st.outFor = 0; }
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
    }
  },
  // Seconds held, over all holds.
  count: st => st.total + (st.holding ? st.time : 0),
  label(st) {
    if (st.holding) return 'Hold: ' + fmt(st.time) + (st.best ? '\nBest: ' + fmt(st.best) : '');
    if (st.last === null) return 'Get into plank position';
    return 'Last: ' + fmt(st.last) + '    Best: ' + fmt(st.best);
  },
  demo(parts) {
    // Forearm plank, face down: the straight body tilts TILT degrees from
    // vertical (90 would be flat). TILT is chosen so that, with the shoulders
    // resting on vertical upper arms, the toes just touch the floor.
    const TILT = 83;
    const rad = Math.PI / 180;
    const shoulderH = BODY.upperArm + BODY.armThick / 2;
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
