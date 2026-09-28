import { BODY, place, rot, turn, mirror, legTo, showChair, CHAIR_SEAT_Y, CHAIR_SIZE } from '../avatar.js';
import { headDip } from './head-dip.js';

// Bulgarian split squat: the back foot rests on a chair (the top of the
// foot on the seat), the front leg squats. One exercise per front leg (the
// headset can't tell which, so only the instructions and demo differ).
const FRONT = { y: BODY.ankle, z: 0.3 };            // front ankle joint
const BACK = { y: CHAIR_SEAT_Y + 0.005, z: -0.62 };  // back ankle joint, foot on the seat, sole up
const PELVIS_Z = -0.05;
const TOP = 0.86, BOTTOM = 0.56;                     // pelvis heights

const other = side => side === 'left' ? 'right' : 'left';
const splitSquats = side => ({
  ...headDip({ down: 0.2 }),
  id: 'split-squats-' + side, name: `Split Squats (${side === 'left' ? 'Left' : 'Right'})`, muscle: 'Legs', equipment: 'chair',
  instructions: `${side === 'left' ? 'Left' : 'Right'} leg in front. Back to a sturdy chair, ${other(side)} foot resting on the seat behind you. Stand still to calibrate, then bend your front knee to lower yourself, and push back up.`,
  demo(parts, t) {
    demoRight(parts, t);
    if (side === 'left') mirror(parts);
  },
});

// Both legs: left, then right (see EXERCISES).
export default [splitSquats('left'), splitSquats('right')];

// Right leg in front. The mannequin's joints are named as seen from the
// viewer: facing them, its L side is its own right (see avatar.js).
function demoRight(parts, t) {
  const c = (1 - Math.cos(t * 1.6)) / 2;   // 0 = up, 1 = low
  const hip = { y: TOP + (BOTTOM - TOP) * c, z: PELVIS_Z };
  place(parts.pelvis, 0, hip.y, hip.z);
  legTo(parts, 'L', hip, 0, FRONT);
  legTo(parts, 'R', hip, 0, BACK, 180);   // foot pointing back, sole up
  for (const s of ['L', 'R']) rot(parts['shoulder' + s], 0, 0, s === 'L' ? -10 : 10);
  showChair(parts, BACK.z + 0.02 - CHAIR_SIZE / 2);   // front edge just behind the ankle
  turn(parts, 80);
}
