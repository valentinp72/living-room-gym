import { pushUpReps, pushUpDemo } from './push-ups.js';

// Easier push-ups, on the knees. Same detection as push-ups.
export default {
  ...pushUpReps(),
  id: 'knee-push-ups', name: 'Knee Push-ups', muscle: 'Chest', color: '#c62828',
  instructions: 'On your knees, hands under your shoulders, body straight from knees to head. Lower your chest, then push back up.',
  demo: (parts, t) => pushUpDemo(parts, t, true),
};
