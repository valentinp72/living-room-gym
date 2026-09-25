import { BODY, place, rot, turn } from '../avatar.js';

export default {
  id: 'plank', name: 'Plank Hold', muscle: 'Abs', color: '#ef6c00',
  instructions: 'Press Start/Stop (or A / X on a controller), get into plank position, and press it again when you stop.',
  manual: true,
  state: () => ({ running: false, time: 0 }),
  update(ctx, st, dt) { if (st.running) st.time += dt / 1000; },
  label: st => 'Hold: ' + st.time.toFixed(1) + 's',
  demo(parts) {
    // Forearm plank, face down: the straight body tilts TILT degrees from
    // vertical (90 would be flat). TILT is chosen so that, with the shoulders
    // resting on vertical upper arms, the toes just touch the floor.
    const TILT = 83;
    const rad = Math.PI / 180;
    const shoulderH = BODY.upperArm + BODY.armThick / 2;
    place(parts.pelvis, 0, shoulderH - BODY.shoulderY * Math.cos(TILT * rad), -0.1);
    rot(parts.pelvis, TILT);
    for (const s of ['L', 'R']) {
      rot(parts['shoulder' + s], -TILT);   // upper arms vertical
      rot(parts['elbow' + s], -90);        // forearms flat on the floor
    }
    rot(parts.head, -10);                  // look at the floor just ahead
    turn(parts, 90);                       // side view
  }
};
