import { BODY, place, rot, turn, armTo, legTo, showChair, CHAIR_SEAT_Y, CHAIR_SIZE, HAND_R } from '../avatar.js';
import { headDip } from './head-dip.js';

// Dips on the edge of a chair: the head goes down and up with the
// shoulders, less than in a squat.
const HANDS = { y: CHAIR_SEAT_Y + HAND_R, z: -0.04 };   // on the front edge of the seat
const TORSO_Z = 0.1;                                  // back just in front of the seat
const TOP = 1.06, BOTTOM = 0.84;                      // shoulder heights
const FEET = { y: BODY.ankle, z: 0.62 };

export default {
  ...headDip({ down: 0.15, up: 0.06, still: 'Hold still at the top...' }),
  id: 'chair-dips', name: 'Chair Dips', muscle: 'Arms', color: '#1565c0', equipment: 'chair',
  instructions: 'Sturdy chair that cannot slide. Hands on the seat edge behind you, feet forward. Hold still at the top, then bend your elbows to go down and push back up.',
  demo(parts, t) {
    const c = (1 - Math.cos(t * 2)) / 2;   // 0 = arms straight, 1 = low
    const shoulder = { y: TOP + (BOTTOM - TOP) * c, z: TORSO_Z };
    const pelvis = { y: shoulder.y - BODY.shoulderY, z: TORSO_Z };
    place(parts.pelvis, 0, pelvis.y, pelvis.z);
    for (const s of ['L', 'R']) {
      armTo(parts, s, shoulder, 0, HANDS, -1);   // elbows bend backward
      legTo(parts, s, pelvis, 0, FEET);
    }
    showChair(parts, -CHAIR_SIZE / 2);           // front edge at z = 0
    turn(parts, 75);
  }
};
