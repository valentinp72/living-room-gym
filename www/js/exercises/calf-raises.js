import { PELVIS_Y, BODY, place, rot, turn } from '../avatar.js';
import { paced } from './paced.js';

// Untracked: the head only rises a few centimeters, too little to tell
// from normal head movement.
const SECONDS_PER_REP = 2;
const DEG = Math.PI / 180;

export default {
  ...paced({ secondsPerRep: SECONDS_PER_REP }),
  id: 'calf-raises', name: 'Calf Raises', muscle: 'Legs',
  instructions: 'Stand straight. On each beat, rise up on your toes, then lower your heels back down.',
  demo(parts, t) {
    const a = 35 * (1 - Math.cos(t * 2 * Math.PI / SECONDS_PER_REP)) / 2 * DEG;   // foot angle
    // Roll over the toes: the front bottom edge of the foot (0.16 ahead of
    // and BODY.ankle below the ankle joint) stays where it is.
    const ankleY = BODY.ankle * Math.cos(a) + 0.16 * Math.sin(a);
    const ankleZ = 0.16 - (0.16 * Math.cos(a) - BODY.ankle * Math.sin(a));
    place(parts.pelvis, 0, PELVIS_Y - BODY.ankle + ankleY, ankleZ);
    for (const s of ['L', 'R']) rot(parts['ankle' + s], a / DEG);
    turn(parts, 70);
  }
};
