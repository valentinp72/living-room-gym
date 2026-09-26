import { BODY, rot, turn, lieOnBack, legTo, along, LYING_Y } from '../avatar.js';
import { paced } from './paced.js';

// Untracked: the head stays on the floor, only the hips move.
const SECONDS_PER_REP = 3;
const FEET = { y: BODY.ankle, z: 0.45 };   // ankle joints, feet flat
const LIFT = 32;                           // torso angle at the top, degrees
const NECK = BODY.shoulderY + 0.08;        // pelvis -> head joint (see buildMannequin)

export default {
  ...paced({ secondsPerRep: SECONDS_PER_REP }),
  id: 'glute-bridges', name: 'Glute Bridges', muscle: 'Glutes', color: '#6a1b9a',
  instructions: 'Lie on your back, knees bent, feet flat. On each beat, squeeze your glutes and lift your hips, then lower them.',
  demo(parts, t) {
    const c = (1 - Math.cos(t * 2 * Math.PI / SECONDS_PER_REP)) / 2;   // one bridge per beat
    // The upper back and head stay on the floor; the torso pivots up around
    // the base of the neck.
    const neck = { y: LYING_Y, z: -NECK };
    const tilt = -90 - LIFT * c;                  // pelvis -> shoulders slopes down
    const pelvis = along(neck, tilt + 180, NECK);
    lieOnBack(parts, pelvis);
    rot(parts.pelvis, tilt);
    for (const s of ['L', 'R']) {
      legTo(parts, s, pelvis, tilt, FEET);
      rot(parts['shoulder' + s], -90 - tilt);     // arms flat on the floor
    }
    rot(parts.head, 15 + LIFT * c);               // head stays on the floor
    turn(parts, 90);
  }
};
