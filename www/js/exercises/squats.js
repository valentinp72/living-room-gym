import { BODY, place, rot, turn } from '../avatar.js';
import { headDip } from './head-dip.js';

export default {
  ...headDip({ down: 0.25 }),
  id: 'squats', name: 'Squats', muscle: 'Legs', color: '#2e7d32',
  instructions: 'Stand still to calibrate, then squat down and stand back up for each rep.',
  demo(parts, t) {
    const c = (1 - Math.cos(t * 1.6)) / 2;   // 0 = standing, 1 = bottom of the squat
    const thigh = 95 * c, shin = 35 * c;     // forward tilt from vertical, degrees
    const rad = Math.PI / 180;
    // Keep the feet planted: put the pelvis where the thighs and shins end up.
    place(parts.pelvis, 0,
      BODY.ankle + BODY.shin * Math.cos(shin * rad) + BODY.thigh * Math.cos(thigh * rad),
      BODY.shin * Math.sin(shin * rad) - BODY.thigh * Math.sin(thigh * rad));
    for (const s of ['L', 'R']) {
      rot(parts['hip' + s], -thigh);
      rot(parts['knee' + s], thigh + shin);
      rot(parts['ankle' + s], -shin);
      rot(parts['shoulder' + s], -90 - 45 * c);   // arms held level in front
    }
    rot(parts.spine, 45 * c);                     // lean the chest forward
    turn(parts, 60);
  }
};
