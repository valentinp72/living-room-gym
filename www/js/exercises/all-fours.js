import { BODY, place, rot, along, armTo, HAND_R } from '../avatar.js';

// On all fours (fire hydrants, bird dogs, donkey kicks): hands under the
// shoulders, knees under the hips, shins and the tops of the feet flat on
// the floor. Seen from the side, the back slopes a little (arms are longer
// than thighs). Returns the pose's key points, for demos that move a limb.
const KNEE_Y = 0.05;                        // knee joint height (half the shin)
export const ALL_FOURS = { pelvis: { y: KNEE_Y + BODY.thigh, z: 0 }, tilt: 71 };
ALL_FOURS.shoulder = along(ALL_FOURS.pelvis, ALL_FOURS.tilt, BODY.shoulderY);

export function allFours(parts) {
  const { pelvis, tilt, shoulder } = ALL_FOURS;
  place(parts.pelvis, 0, pelvis.y, pelvis.z);
  rot(parts.pelvis, tilt);
  for (const s of ['L', 'R']) {
    armTo(parts, s, shoulder, tilt, { y: HAND_R, z: shoulder.z }, -1);   // arms straight down
    rot(parts['hip' + s], -tilt);          // thighs straight down
    rot(parts['knee' + s], 90);            // shins flat on the floor
    rot(parts['ankle' + s], 90);           // tops of the feet down
  }
  rot(parts.head, -25);
  return ALL_FOURS;
}
