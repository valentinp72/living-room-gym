import { rot, turn, showDumbbells } from '../avatar.js';
import { headDip } from './head-dip.js';
import { squatPose } from './squats.js';

export default {
  ...headDip({ down: 0.25 }),
  id: 'goblet-squats', name: 'Goblet Squats', muscle: 'Legs', color: '#2e7d32', equipment: 'weights',
  instructions: 'Hold one dumbbell against your chest with both hands. Stand still to calibrate, then squat down and stand back up.',
  demo(parts, t) {
    const c = (1 - Math.cos(t * 1.6)) / 2;   // 0 = standing, 1 = bottom of the squat
    squatPose(parts, 95 * c, 35 * c, 40 * c);
    // Hands together in front of the chest, elbows down.
    for (const s of ['L', 'R']) {
      rot(parts['shoulder' + s], -25 - 20 * c, 0, s === 'L' ? 22 : -22);
      rot(parts['elbow' + s], -120);
    }
    showDumbbells(parts, 'R');   // one dumbbell, held across both hands
    turn(parts, 60);
  }
};
