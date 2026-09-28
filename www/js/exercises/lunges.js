import { PELVIS_Y, place, rot, turn, legTo } from '../avatar.js';
import { headDip } from './head-dip.js';

// Lunge demo: split stance, left foot in front. The back foot is on its toes.
const FRONT = { y: 0.06, z: 0.28 };   // ankle joints
const BACK = { y: 0.15, z: -0.42 };
const BACK_FOOT = 40;                 // back heel up, degrees
const PELVIS_Z = -0.05;
const TOP = PELVIS_Y - 0.08, BOTTOM = 0.5;   // pelvis heights

export default {
  ...headDip({ down: 0.25 }),
  id: 'lunges', name: 'Lunges', muscle: 'Legs',
  instructions: 'Stand still to calibrate. Step back and lower your back knee toward the floor, then stand up. Alternate legs.',
  demo(parts, t) {
    const c = (1 - Math.cos(t * 1.6)) / 2;   // 0 = up, 1 = back knee near the floor
    const hip = { y: TOP + (BOTTOM - TOP) * c, z: PELVIS_Z };
    place(parts.pelvis, 0, hip.y, hip.z);
    legTo(parts, 'L', hip, 0, FRONT);
    legTo(parts, 'R', hip, 0, BACK, BACK_FOOT);
    for (const s of ['L', 'R']) rot(parts['shoulder' + s], 0, 0, s === 'L' ? -10 : 10);
    turn(parts, 80);
  }
};
