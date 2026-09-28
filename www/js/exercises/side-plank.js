import { BODY, place, rot, turn, mirror } from '../avatar.js';
import { hold, heightOff, keptHeight } from './hold.js';
import { gazeY } from '../tracking.js';

// Side plank, one exercise per side (left: on the left forearm), from the
// headset: the head is low, tilted sideways (the top of the head points to
// the side) and looks ahead, neither at the floor (plank) nor at the ceiling
// (lying on the back). The side comes from which way the head tilts: lying
// on the right side, the head's right points down. Once holding, the head
// must stay close to where it started. The tilt limits are loose (37° to
// start, 26° to keep): on a Quest the first version (53°) never started,
// people hold their head more upright than the body.
const START_Y = [0.25, 0.8];
const HOLD_DROP = 0.1, HOLD_RISE = 0.12;
const DEG = Math.PI / 180;
const UP = new THREE.Vector3(), RIGHT = new THREE.Vector3();

// maxUpY: how upright the head may be (y of its up vector); maxGaze: how
// far the gaze may point up or down (|gaze y|).
function sidewaysOff(head, side, maxUpY, maxGaze) {
  const g = gazeY(head);
  if (g < -maxGaze) return 'Face forward, not down';
  if (g > maxGaze) return 'Face forward, not up';
  const rightDown = RIGHT.set(1, 0, 0).applyQuaternion(head.quaternion).y < 0;
  if (UP.set(0, 1, 0).applyQuaternion(head.quaternion).y > maxUpY || rightDown !== (side === 'right')) {
    return 'Lie on your ' + side + ' side';
  }
  return null;
}

// Lying on the left side, the body rolled TILT degrees from vertical, on
// the left forearm and the side of the left foot (elbowR / ankleR: see
// demoLeft()).
const TILT = 73;
const s = Math.sin(TILT * DEG), c = Math.cos(TILT * DEG);
const SHOULDER_H = BODY.upperArm + BODY.forearmR;   // lower shoulder above the floor
// Pelvis height: the lower shoulder (0.19 to the side, shoulderY up in the
// pelvis frame) ends up SHOULDER_H above the floor, plus a little so the
// lower shin clears the floor.
const PELVIS_Y = SHOULDER_H + 0.19 * s - BODY.shoulderY * c + 0.012;

const sidePlank = side => ({
  ...hold({
    start: head => heightOff(head.position.y, ...START_Y) || sidewaysOff(head, side, 0.8, 0.6),
    keep: (head, st) => keptHeight(head, st, HOLD_DROP, HOLD_RISE) || sidewaysOff(head, side, 0.9, 0.75),
    prompt: 'Get into a side plank',
  }),
  id: 'side-plank-' + side, name: `Side Plank (${side === 'left' ? 'Left' : 'Right'})`, muscle: 'Abs', floor: true,
  instructions: `Lie on your ${side} side, on your ${side} forearm, feet stacked. Lift your hips so your body is straight, and hold.`,
  demo(parts, t) {
    demoLeft(parts, t);
    if (side === 'right') mirror(parts);
  },
});

// Both sides: left, then right (see EXERCISES).
export default [sidePlank('left'), sidePlank('right')];

// On the left side. The mannequin's joints are named as seen from the
// viewer: facing them, its R side is its own left (see avatar.js).
function demoLeft(parts, t) {
  place(parts.pelvis, 0, PELVIS_Y + Math.sin(t * 1.6) * 0.004, 0);
  rot(parts.pelvis, 0, 0, -TILT);         // head toward +x
  rot(parts.shoulderR, 0, 0, TILT);       // upper arm straight down
  rot(parts.elbowR, -90);                 // forearm flat on the floor
  rot(parts.hipL, 0, 0, 5);               // top foot on the bottom one
  turn(parts, 0);
}
