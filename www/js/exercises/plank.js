import { BODY, place, rot, turn } from '../avatar.js';
import { hold, heightOff, keptHeight, faceDownOff } from './hold.js';

// Plank detection from the headset alone (works with controllers, bare hands
// or nothing in hand). In a plank the head is low and faces the floor.
// Forearm plank: the headset is about 25-45 cm above the floor.
// To start, the head must be in a fixed window (wide, since the floor height
// is the Quest's estimate and can be a few cm off). Once holding, the hold
// stops when the head drops (lying down) or rises (sitting back) too far
// from where it started. A plank is still, so this can be much tighter than
// any fixed window.
const START_Y = [0.15, 0.6];
const START_DOWN = 40;   // degrees the face must point down to start...
const HOLD_DOWN = 30;    // ...and to keep holding
const HOLD_DROP = 0.1;   // m below the start height: lying down
const HOLD_RISE = 0.12;  // m above it: sitting back, kneeling up

export default {
  ...hold({
    start: head => heightOff(head.position.y, ...START_Y) || faceDownOff(head, START_DOWN),
    keep: (head, st) => keptHeight(head, st, HOLD_DROP, HOLD_RISE) || faceDownOff(head, HOLD_DOWN),
    prompt: 'Get into plank position',
  }),
  id: 'plank', name: 'Plank Hold', muscle: 'Abs', color: '#ef6c00', floor: true,
  instructions: 'Get into a forearm plank, facing the floor. The timer starts and stops by itself.',
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
