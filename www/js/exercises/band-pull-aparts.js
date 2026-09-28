import { rot, turn, showBand, handOf } from '../avatar.js';
import { paced } from './paced.js';

// Untracked: holding a band, controllers don't fit in the hands.
const SECONDS_PER_REP = 2.5;

export default {
  ...paced({ secondsPerRep: SECONDS_PER_REP }),
  id: 'band-pull-aparts', name: 'Band Pull-Aparts', muscle: 'Back', equipment: 'band',
  instructions: 'Hold the band in front of you at shoulder height, arms straight. On each beat, pull it apart until your arms are out to the sides, then come back slowly.',
  demo(parts, t) {
    const c = (1 - Math.cos(t * 2 * Math.PI / SECONDS_PER_REP)) / 2;   // 0 = arms forward, 1 = out to the sides
    // Arms level: forward (x -90), then swung out to the sides (z).
    rot(parts.shoulderL, -90, 0, -80 * c);
    rot(parts.shoulderR, -90, 0, 80 * c);
    showBand(parts, 'band1', handOf(parts, 'L'), handOf(parts, 'R'));
    turn(parts, 15);
  }
};
