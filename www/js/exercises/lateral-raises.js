import { rot, turn, showDumbbells } from '../avatar.js';
import { paced } from './paced.js';

// Untracked: the arms go out to the sides, out of the headset's view.
const SECONDS_PER_REP = 3;

export default {
  ...paced({ secondsPerRep: SECONDS_PER_REP }),
  id: 'lateral-raises', name: 'Lateral Raises', muscle: 'Shoulders', equipment: 'weights',
  instructions: 'A light dumbbell in each hand, arms at your sides, elbows slightly bent. On each beat, raise your arms out to shoulder height, then lower them slowly.',
  demo(parts, t) {
    const c = (1 - Math.cos(t * 2 * Math.PI / SECONDS_PER_REP)) / 2;   // 0 = down, 1 = level
    const out = 8 + 80 * c;
    rot(parts.shoulderL, 0, 0, -out);
    rot(parts.shoulderR, 0, 0, out);
    rot(parts.elbowL, -15); rot(parts.elbowR, -15);
    showDumbbells(parts);
    turn(parts, 10);
  }
};
