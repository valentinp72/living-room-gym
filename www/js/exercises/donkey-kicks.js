import { rot, turn } from '../avatar.js';
import { paced } from './paced.js';
import { allFours } from './all-fours.js';

// Untracked: on all fours, only a leg moves.
const SECONDS_PER_REP = 2;

export default {
  ...paced({ secondsPerRep: SECONDS_PER_REP }),
  id: 'donkey-kicks', name: 'Donkey Kicks', muscle: 'Glutes', color: '#6a1b9a', floor: true,
  instructions: 'On all fours. On each beat, keep the knee bent and push one foot up toward the ceiling, then lower it. Alternate legs.',
  demo(parts, t) {
    const { tilt } = allFours(parts);
    const rep = Math.floor(t / SECONDS_PER_REP);
    const k = Math.sin(Math.PI * (t / SECONDS_PER_REP - rep));   // up and down once per beat
    const s = rep % 2 ? 'L' : 'R';
    rot(parts['hip' + s], 85 * k - tilt);   // thigh swings back to level
    rot(parts['ankle' + s], 90 * (1 - k));  // sole turns to the ceiling
    turn(parts, 90);
  }
};
