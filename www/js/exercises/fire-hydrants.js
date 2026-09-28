import { rot, turn } from '../avatar.js';
import { paced } from './paced.js';
import { allFours } from './all-fours.js';

// Untracked: on all fours, only a leg moves.
const SECONDS_PER_REP = 2.5;
const LIFT = 60;                       // leg lifted out to the side, degrees

export default {
  ...paced({ secondsPerRep: SECONDS_PER_REP }),
  id: 'fire-hydrants', name: 'Fire Hydrants', muscle: 'Glutes', floor: true,
  instructions: 'On all fours. On each beat, lift one bent knee out to the side, then lower it. Alternate legs.',
  demo(parts, t) {
    const rep = Math.floor(t / SECONDS_PER_REP);
    const lift = LIFT * Math.sin(Math.PI * (t / SECONDS_PER_REP - rep));   // up and down once per beat
    const { tilt } = allFours(parts);
    for (const s of ['L', 'R']) {
      // With XYZ Euler angles the z turn happens in the world's frame here,
      // so it swings the thigh straight out to the side.
      const side = s === 'L' ? -1 : 1;
      const out = (rep % 2 === 0) === (s === 'R') ? lift : 0;   // alternate legs
      rot(parts['hip' + s], -tilt, 0, side * out);
    }
    turn(parts, 150);   // three-quarter view from behind: the side lift shows
  }
};
