import { BODY, place, rot, turn, along, armTo, showBand, handOf, footOf } from '../avatar.js';
import { paced } from './paced.js';

// Untracked: seated, only the arms move.
const SECONDS_PER_REP = 2.5;
const PELVIS = { y: 0.07, z: 0 };   // sitting on the floor
const LEAN = -5;                    // torso upright, slightly back

export default {
  ...paced({ secondsPerRep: SECONDS_PER_REP }),
  id: 'band-rows', name: 'Band Rows', muscle: 'Back', color: '#00695c', equipment: 'band', floor: true,
  instructions: 'Sit with your legs straight, the band around your feet, one end in each hand. On each beat, pull your elbows back and squeeze your shoulder blades, then extend your arms.',
  demo(parts, t) {
    const c = (1 - Math.cos(t * 2 * Math.PI / SECONDS_PER_REP)) / 2;   // 0 = arms extended, 1 = pulled
    place(parts.pelvis, 0, PELVIS.y, PELVIS.z);
    rot(parts.spine, LEAN);
    for (const s of ['L', 'R']) rot(parts['hip' + s], -90);   // legs straight ahead on the floor
    const shoulder = along(PELVIS, LEAN, BODY.shoulderY);
    const hand = { y: shoulder.y - 0.15 - 0.15 * c, z: shoulder.z + 0.56 - 0.5 * c };
    for (const s of ['L', 'R']) {
      armTo(parts, s, shoulder, LEAN, hand, -1);   // elbows go back
      showBand(parts, s === 'L' ? 'band1' : 'band2', handOf(parts, s), footOf(parts, s));
    }
    turn(parts, 90);
  }
};
