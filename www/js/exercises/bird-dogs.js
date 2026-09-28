import { BODY, rot, turn, armTo, HAND } from '../avatar.js';
import { paced } from './paced.js';
import { allFours } from './all-fours.js';

// Untracked: on all fours, the head barely moves.
const SECONDS_PER_REP = 3;
const DEG = Math.PI / 180;

export default {
  ...paced({ secondsPerRep: SECONDS_PER_REP }),
  id: 'bird-dogs', name: 'Bird Dogs', muscle: 'Back', floor: true,
  instructions: 'On all fours. On each beat, reach one arm forward and the opposite leg back, hold, then return. Alternate sides.',
  demo(parts, t) {
    const { tilt, shoulder } = allFours(parts);
    const rep = Math.floor(t / SECONDS_PER_REP);
    const k = Math.sin(Math.PI * (t / SECONDS_PER_REP - rep));   // out and back once per beat
    const arm = rep % 2 ? 'L' : 'R', leg = rep % 2 ? 'R' : 'L';
    // The arm swings from straight down to straight ahead.
    const a = -90 * k * DEG, reach = BODY.upperArm + HAND;
    armTo(parts, arm, shoulder, tilt, { y: shoulder.y - reach * Math.cos(a), z: shoulder.z - reach * Math.sin(a) }, -1);
    // The leg swings from the thigh straight down to straight back, unbending.
    rot(parts['hip' + leg], 90 * k - tilt);
    rot(parts['knee' + leg], 90 * (1 - k));
    rot(parts['ankle' + leg], 90 * (1 - k));
    turn(parts, 90);
  }
};
