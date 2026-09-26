import { PELVIS_Y, BODY, place, rot, turn, legTo, showDumbbells } from '../avatar.js';
import { headDip } from './head-dip.js';

// Hinge at the hips with a flat back: the head drops a lot, like a squat.
const TILT = 75;          // torso forward at the bottom, degrees
const BACK = 0.16;        // hips push back...
const BEND = 0.05;        // ...and knees soften

export default {
  ...headDip({ down: 0.3 }),
  id: 'romanian-deadlifts', name: 'Romanian Deadlifts', muscle: 'Glutes', color: '#6a1b9a', equipment: 'weights',
  instructions: 'A dumbbell in each hand, knees soft. Stand still to calibrate, then push your hips back and lower the weights along your legs with a flat back, and stand back up.',
  demo(parts, t) {
    const c = (1 - Math.cos(t * 1.6)) / 2;   // 0 = standing, 1 = bottom
    const tilt = TILT * c;
    const hip = { y: PELVIS_Y - BEND * c, z: -BACK * c };
    place(parts.pelvis, 0, hip.y, hip.z);
    rot(parts.pelvis, tilt);
    for (const s of ['L', 'R']) {
      legTo(parts, s, hip, tilt, { y: BODY.ankle, z: 0 });   // feet stay under the standing hips
      rot(parts['shoulder' + s], -tilt);                     // arms hang straight down
    }
    rot(parts.head, -15 * c);
    showDumbbells(parts);
    turn(parts, 80);
  }
};
