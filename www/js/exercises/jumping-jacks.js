import { BODY, place, rot, turn } from '../avatar.js';
import { paced } from './paced.js';

// Untracked: controllers overhead are out of the headset's view.
const SECONDS_PER_REP = 1.5;
const DEG = Math.PI / 180;

export default {
  ...paced({ secondsPerRep: SECONDS_PER_REP }),
  id: 'jumping-jacks', name: 'Jumping Jacks', muscle: 'Cardio', color: '#00838f',
  instructions: 'On each beat, jump your feet apart while raising your arms overhead, then jump back. Make sure you have room around you.',
  demo(parts, t) {
    const c = (1 - Math.cos(t * 2 * Math.PI / SECONDS_PER_REP)) / 2;   // 0 = together, 1 = apart
    const legs = 14 * c, arms = 10 + 150 * c;
    // Feet stay flat on the floor as the legs spread.
    place(parts.pelvis, 0, BODY.ankle + (BODY.thigh + BODY.shin) * Math.cos(legs * DEG), 0);
    rot(parts.hipL, 0, 0, -legs); rot(parts.ankleL, 0, 0, legs);
    rot(parts.hipR, 0, 0, legs); rot(parts.ankleR, 0, 0, -legs);
    rot(parts.shoulderL, 0, 0, -arms);
    rot(parts.shoulderR, 0, 0, arms);
    turn(parts, 10);
  }
};
