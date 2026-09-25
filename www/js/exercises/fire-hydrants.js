import { BODY, place, rot, turn, along, armTo, HAND_R } from '../avatar.js';
import { paced } from './paced.js';

// Untracked: on all fours, only a leg moves.
const SECONDS_PER_REP = 2.5;
const KNEE_Y = 0.05;                   // knee joint height (half the shin box)
const PELVIS = { y: KNEE_Y + BODY.thigh, z: 0 };
const TILT = 71;                       // back slightly sloped: arms are longer than thighs
const LIFT = 60;                       // leg lifted out to the side, degrees

export default {
  ...paced({ secondsPerRep: SECONDS_PER_REP }),
  id: 'fire-hydrants', name: 'Fire Hydrants', muscle: 'Glutes', color: '#6a1b9a',
  instructions: 'On all fours. On each beat, lift one bent knee out to the side, then lower it. Alternate legs.',
  demo(parts, t) {
    const rep = Math.floor(t / SECONDS_PER_REP);
    const lift = LIFT * Math.sin(Math.PI * (t / SECONDS_PER_REP - rep));   // up and down once per beat
    place(parts.pelvis, 0, PELVIS.y, PELVIS.z);
    rot(parts.pelvis, TILT);
    const shoulder = along(PELVIS, TILT, BODY.shoulderY);
    for (const s of ['L', 'R']) {
      armTo(parts, s, shoulder, TILT, { y: HAND_R, z: shoulder.z }, -1);   // arms straight down
      // Thighs straight down, shins flat on the floor, tops of the feet down.
      // With XYZ Euler angles the z turn happens in the world's frame here,
      // so it swings the thigh straight out to the side.
      const side = s === 'L' ? -1 : 1;
      const out = (rep % 2 === 0) === (s === 'R') ? lift : 0;   // alternate legs
      rot(parts['hip' + s], -TILT, 0, side * out);
      rot(parts['knee' + s], 90);
      rot(parts['ankle' + s], 90);
    }
    rot(parts.head, -25);
    turn(parts, 150);   // three-quarter view from behind: the side lift shows
  }
};
