import { BODY, place, rot, turn, along, armTo, onToesY, HAND, HAND_R } from '../avatar.js';
import { gazeY } from '../tracking.js';

// Push-ups (full or on the knees), from the headset alone: face down with
// the head low, each push-up takes the head down and back up.
const MAX_Y = 0.9;        // head above this (m) = not in push-up position
const FACE_DOWN = -0.5;   // gaze y below this = looking at the floor
const DOWN = 0.15;        // head goes this far below its highest point...
const UP = 0.12;          // ...then back up this far = 1 rep
const GRACE_MS = 500;     // out of position this long forgets a rep in progress

export function pushUpReps() {
  return {
    unit: 'reps',
    state: () => ({ reps: 0, ready: false, down: false, high: null, low: null, outMs: 0 }),
    update(ctx, st, dt) {
      const head = ctx.camera.object3D;
      if (!head) return;
      const y = head.position.y;
      if (y > MAX_Y || gazeY(head) > FACE_DOWN) {
        st.outMs += dt;
        if (st.outMs > GRACE_MS) { st.down = false; st.high = st.low = null; }
        return;
      }
      st.outMs = 0;
      st.ready = true;
      if (!st.down) {
        st.high = st.high === null ? y : Math.max(st.high, y);
        if (st.high - y > DOWN) { st.down = true; st.low = y; }
      } else {
        st.low = Math.min(st.low, y);
        if (y - st.low > UP) { st.down = false; st.high = y; st.reps++; }
      }
    },
    count: st => st.reps,
    label: st => st.ready ? 'Reps: ' + st.reps : 'Get into push-up position',
  };
}

// Shoulder height at the top (arms straight) and at the bottom.
const TOP_Y = BODY.upperArm + HAND + HAND_R;
const BOTTOM_Y = 0.3;
const KNEE_Y = 0.06;   // knee joint height when kneeling (half the thigh box)

// Body tilt (degrees from vertical) that puts the shoulders at height h:
// solved numerically, the tilt -> height curve only goes down.
function tiltFor(h, heightAt) {
  let lo = 20, hi = 89.9;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (heightAt(mid) > h) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// Push-up demo; `knees` = on the knees instead of the toes. The body stays
// straight from the toes (or knees) to the head, the hands stay planted.
export function pushUpDemo(parts, t, knees) {
  const c = (1 - Math.cos(t * 2)) / 2;   // 0 = arms straight, 1 = chest low
  const h = TOP_Y + (BOTTOM_Y - TOP_Y) * c;
  const trunk = BODY.thigh + BODY.shoulderY;   // knee -> shoulder
  const heightAt = knees
    ? deg => KNEE_Y + trunk * Math.cos(deg * Math.PI / 180)
    : deg => onToesY(deg) + BODY.shoulderY * Math.cos(deg * Math.PI / 180);
  const tilt = tiltFor(h, heightAt);
  const top = tiltFor(TOP_Y, heightAt);
  const pelvis = knees ? along({ y: KNEE_Y, z: 0 }, tilt, BODY.thigh) : { y: onToesY(tilt), z: 0 };
  place(parts.pelvis, 0, pelvis.y, pelvis.z);
  rot(parts.pelvis, tilt);
  // Hands under the shoulders as they are at the top.
  const handZ = (knees ? along({ y: KNEE_Y, z: 0 }, top, trunk) : along({ y: onToesY(top), z: 0 }, top, BODY.shoulderY)).z;
  const shoulder = along(pelvis, tilt, BODY.shoulderY);
  for (const s of ['L', 'R']) {
    armTo(parts, s, shoulder, tilt, { y: HAND_R, z: handZ }, -1);
    if (knees) {
      rot(parts['knee' + s], 90 - tilt);   // shins flat on the floor
      rot(parts['ankle' + s], 90);         // tops of the feet down
    }
  }
  rot(parts.head, -20);                    // look at the floor ahead
  turn(parts, 90);
}

export default {
  ...pushUpReps(),
  id: 'push-ups', name: 'Push-ups', muscle: 'Chest', color: '#c62828',
  instructions: 'Hands under your shoulders, body straight. Lower your chest to the floor, then push back up.',
  demo: (parts, t) => pushUpDemo(parts, t, false),
};
