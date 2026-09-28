import { BODY, place, rot, turn, legTo, showWall } from '../avatar.js';
import { hold, heightOff, keptHeight } from './hold.js';
import { gazeY } from '../tracking.js';

// Wall sit, from the headset: it first measures the standing head height,
// then the hold starts when the head is 18 to 80 cm below it, looking ahead
// (not bent over). Once holding, the head must stay within 10 cm of where it
// started. Sitting on a real chair would count too. A 30 cm minimum was too
// deep: on a Quest it took an almost floor-level sit to start.
const START_DROP = [0.18, 0.8];  // m below standing height
const HOLD_DRIFT = 0.1;
const LOOK_AHEAD = -0.6;         // gaze y above this = not bent over

const lookAhead = head => gazeY(head) > LOOK_AHEAD ? null : 'Look ahead';

export default {
  ...hold({
    calibrate: true,
    start: (head, st) => heightOff(head.position.y, st.standY - START_DROP[1], st.standY - START_DROP[0]) || lookAhead(head),
    keep: (head, st) => keptHeight(head, st, HOLD_DRIFT, HOLD_DRIFT) || lookAhead(head),
    prompt: 'Slide down the wall',
  }),
  id: 'wall-sit', name: 'Wall Sit', muscle: 'Legs', color: '#2e7d32',
  instructions: 'Stand still to calibrate, back to a wall. Slide down until your thighs are level, and hold. The timer starts and stops by itself.',
  demo(parts, t) {
    const breath = Math.sin(t * 1.6) * 0.005;
    const hip = { y: BODY.ankle + BODY.shin + breath, z: 0 };   // thighs level
    place(parts.pelvis, 0, hip.y, hip.z);
    for (const s of ['L', 'R']) {
      legTo(parts, s, hip, 0, { y: BODY.ankle, z: BODY.thigh });   // shins vertical
      rot(parts['shoulder' + s], -90);                              // arms straight ahead
    }
    showWall(parts, -0.1);   // the back rests on it
    turn(parts, 60);
  }
};
