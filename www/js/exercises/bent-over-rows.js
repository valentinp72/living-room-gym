import { PELVIS_Y, BODY, place, rot, turn, along, armTo, legTo, showDumbbells, HAND } from '../avatar.js';
import { paced } from './paced.js';

// Untracked: bent over, only the arms move.
const SECONDS_PER_REP = 2.5;
const TILT = 55;                                   // torso forward, degrees
const HIP = { y: PELVIS_Y - 0.07, z: -0.14 };      // hips back, knees bent

export default {
  ...paced({ secondsPerRep: SECONDS_PER_REP }),
  id: 'bent-over-rows', name: 'Bent-over Rows', muscle: 'Back', equipment: 'weights',
  instructions: 'A dumbbell in each hand. Bend forward from the hips, back flat, knees soft. On each beat, pull the weights up to your ribs, then lower them.',
  demo(parts, t) {
    const c = (1 - Math.cos(t * 2 * Math.PI / SECONDS_PER_REP)) / 2;   // 0 = arms hanging, 1 = pulled up
    place(parts.pelvis, 0, HIP.y, HIP.z);
    rot(parts.pelvis, TILT);
    const shoulder = along(HIP, TILT, BODY.shoulderY);
    const reach = BODY.upperArm + HAND - 0.01;
    // From straight below the shoulder to beside the lower ribs.
    const hand = { y: shoulder.y - reach + (reach - 0.2) * c, z: shoulder.z - 0.25 * c };
    for (const s of ['L', 'R']) {
      legTo(parts, s, HIP, TILT, { y: BODY.ankle, z: 0 });
      armTo(parts, s, shoulder, TILT, hand, -1);   // elbows go up and back
    }
    rot(parts.head, -20);
    showDumbbells(parts);
    turn(parts, 80);
  }
};
