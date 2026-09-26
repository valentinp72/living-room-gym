import { rot, turn, lieOnBack } from '../avatar.js';
import { paced } from './paced.js';

// Untracked: lying on the back, only the legs move.
const SECONDS_PER_REP = 3;

export default {
  ...paced({ secondsPerRep: SECONDS_PER_REP }),
  id: 'leg-raises', name: 'Leg Raises', muscle: 'Abs', color: '#ef6c00', floor: true,
  instructions: 'Lie on your back, legs straight. On each beat, raise your legs up, then lower them slowly without touching the floor.',
  demo(parts, t) {
    const c = (1 - Math.cos(t * 2 * Math.PI / SECONDS_PER_REP)) / 2;   // one raise per beat
    lieOnBack(parts);
    for (const s of ['L', 'R']) rot(parts['hip' + s], -80 * c);
    turn(parts, 90);
  }
};
