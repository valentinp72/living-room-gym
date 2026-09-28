import { BODY, turn, along, legTo } from '../avatar.js';
import { paced } from './paced.js';
import { pushUpDemo } from './push-ups.js';

// Untracked: the head stays still, only the legs move.
const SECONDS_PER_REP = 1;

export default {
  ...paced({ secondsPerRep: SECONDS_PER_REP }),
  id: 'mountain-climbers', name: 'Mountain Climbers', muscle: 'Abs', floor: true,
  instructions: 'In a high plank, arms straight. On each beat, drive one knee toward your chest, then put it back. Alternate legs.',
  demo(parts, t) {
    const { pelvis, tilt } = pushUpDemo(parts, 0, false);   // top of a push-up
    const rep = Math.floor(t / SECONDS_PER_REP);
    const k = Math.sin(Math.PI * (t / SECONDS_PER_REP - rep));   // in and out once per beat
    const s = rep % 2 ? 'L' : 'R';
    // The ankle goes from its place (leg straight, on the toes) to under
    // the hips, off the floor; the knee comes up toward the chest.
    const back = along(pelvis, tilt + 180, BODY.thigh + BODY.shin);
    const tuck = { y: 0.2, z: pelvis.z + 0.05 };
    // An arc, so the toes clear the floor on the way.
    const ankle = { y: back.y + (tuck.y - back.y) * k + 0.12 * Math.sin(Math.PI * k), z: back.z + (tuck.z - back.z) * k };
    legTo(parts, s, pelvis, tilt, ankle, tilt * (1 - k) + 40 * k);   // on the toes, then off the floor
    turn(parts, 90);
  }
};
