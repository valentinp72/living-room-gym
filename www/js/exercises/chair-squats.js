import { rot, turn, showChair, CHAIR_SIZE } from '../avatar.js';
import { headDip } from './head-dip.js';
import { squatPose, squatPelvis } from './squats.js';

// Sit down on a chair and stand back up: a squat with a safety net. The
// head drops more than in a squat (the user sits).
const THIGH = 80, SHIN = 25;   // at the bottom, sitting on the front of the seat
const SEAT_Z = squatPelvis(THIGH, SHIN).z - CHAIR_SIZE / 2 + 0.1;   // middle of the seat

export default {
  ...headDip({ down: 0.3 }),
  id: 'chair-squats', name: 'Chair Squats', muscle: 'Legs', color: '#2e7d32', equipment: 'chair',
  instructions: 'Stand in front of a sturdy chair. Stand still to calibrate, then sit down lightly on the edge of the seat and stand back up, without using your hands.',
  demo(parts, t) {
    const c = (1 - Math.cos(t * 1.6)) / 2;   // 0 = standing, 1 = sitting
    squatPose(parts, THIGH * c, SHIN * c, 40 * c);
    for (const s of ['L', 'R']) rot(parts['shoulder' + s], -90 - 40 * c);   // arms forward for balance
    // At the bottom the hips rest on the front of the seat.
    showChair(parts, SEAT_Z);
    turn(parts, 75);
  }
};
