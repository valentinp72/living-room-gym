import { BODY, place, rot, turn } from '../avatar.js';
import { headDip } from './head-dip.js';

// Where the pelvis is with the thighs `thigh` and shins `shin` degrees
// forward from vertical and the feet planted under the standing hips.
export function squatPelvis(thigh, shin) {
  const rad = Math.PI / 180;
  return {
    y: BODY.ankle + BODY.shin * Math.cos(shin * rad) + BODY.thigh * Math.cos(thigh * rad),
    z: BODY.shin * Math.sin(shin * rad) - BODY.thigh * Math.sin(thigh * rad),
  };
}

// Squat legs, seen from the side (see squatPelvis()), chest leaning `lean`
// degrees forward. Returns the pelvis position.
export function squatPose(parts, thigh, shin, lean) {
  const pelvis = squatPelvis(thigh, shin);
  place(parts.pelvis, 0, pelvis.y, pelvis.z);
  for (const s of ['L', 'R']) {
    rot(parts['hip' + s], -thigh);
    rot(parts['knee' + s], thigh + shin);
    rot(parts['ankle' + s], -shin);
  }
  rot(parts.spine, lean);
  return pelvis;
}

export default {
  ...headDip({ down: 0.25 }),
  id: 'squats', name: 'Squats', muscle: 'Legs', color: '#2e7d32',
  instructions: 'Stand still to calibrate, then squat down and stand back up for each rep.',
  demo(parts, t) {
    const c = (1 - Math.cos(t * 1.6)) / 2;   // 0 = standing, 1 = bottom of the squat
    squatPose(parts, 95 * c, 35 * c, 45 * c);
    for (const s of ['L', 'R']) rot(parts['shoulder' + s], -90 - 45 * c);   // arms held level in front
    turn(parts, 60);
  }
};
