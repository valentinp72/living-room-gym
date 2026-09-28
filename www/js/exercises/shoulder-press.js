import { rot, turn, showDumbbells } from '../avatar.js';
import { paced } from './paced.js';

// Untracked: the weights go overhead, out of the headset's view.
const SECONDS_PER_REP = 2.5;

export default {
  ...paced({ secondsPerRep: SECONDS_PER_REP }),
  id: 'shoulder-press', name: 'Shoulder Press', muscle: 'Shoulders', equipment: 'weights',
  instructions: 'Stand with a dumbbell in each hand at shoulder height, palms forward. On each beat, press them overhead, then lower them back to your shoulders.',
  demo(parts, t) {
    const c = (1 - Math.cos(t * 2 * Math.PI / SECONDS_PER_REP)) / 2;   // 0 = at the shoulders, 1 = overhead
    // Upper arms from level to up; the forearms stay vertical.
    const upper = 90 + 75 * c;
    rot(parts.shoulderL, 0, 0, -upper); rot(parts.elbowL, 0, 0, -(180 - upper));
    rot(parts.shoulderR, 0, 0, upper); rot(parts.elbowR, 0, 0, 180 - upper);
    showDumbbells(parts);
    turn(parts, 15);
  }
};
