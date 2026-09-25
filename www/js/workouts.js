/* ---------------------------------------------------------------------
 * TRAINING SETS
 * A training set is a fixed list of steps done in order, with a rest
 * between steps. Difficulty is just configuration: a harder variant of a
 * set is another entry with more reps / seconds and less rest.
 *   id, name, level  -> shown in the menu as "name (level)"
 *   color            -> menu button color
 *   rest             -> seconds of rest between steps (0 = none)
 *   steps            -> [{ exercise: <exercise id>, reps: n }
 *                        | { exercise: <exercise id>, seconds: n }]
 *                       reps for exercises with unit 'reps', seconds for
 *                       unit 'seconds' (see exercises/index.js)
 * ------------------------------------------------------------------- */
export const WORKOUTS = [
  {
    id: 'full-body-starter', name: 'Full body starter', level: 'Easy', color: '#00838f',
    rest: 20,
    steps: [
      { exercise: 'squats', reps: 10 },
      { exercise: 'curls', reps: 10 },
      { exercise: 'plank', seconds: 20 },
    ],
  },
  {
    id: 'lower-body-easy', name: 'Legs and glutes', level: 'Easy', color: '#2e7d32',
    rest: 20,
    steps: [
      { exercise: 'squats', reps: 10 },
      { exercise: 'lunges', reps: 10 },
      { exercise: 'fire-hydrants', reps: 10 },
      { exercise: 'glute-bridges', reps: 10 },
      { exercise: 'calf-raises', reps: 15 },
    ],
  },
  {
    id: 'core-easy', name: 'Abs', level: 'Easy', color: '#ef6c00',
    rest: 20,
    steps: [
      { exercise: 'crunches', reps: 10 },
      { exercise: 'leg-raises', reps: 8 },
      { exercise: 'plank', seconds: 20 },
      { exercise: 'crunches', reps: 10 },
    ],
  },
  {
    id: 'upper-body-easy', name: 'Chest and arms', level: 'Easy', color: '#c62828',
    rest: 25,
    steps: [
      { exercise: 'knee-push-ups', reps: 8 },
      { exercise: 'curls', reps: 10 },
      { exercise: 'knee-push-ups', reps: 8 },
      { exercise: 'curls', reps: 10 },
    ],
  },
  {
    id: 'full-body-medium', name: 'Full body', level: 'Medium', color: '#4527a0',
    rest: 15,
    steps: [
      { exercise: 'squats', reps: 15 },
      { exercise: 'push-ups', reps: 10 },
      { exercise: 'lunges', reps: 16 },
      { exercise: 'crunches', reps: 15 },
      { exercise: 'glute-bridges', reps: 15 },
      { exercise: 'plank', seconds: 40 },
    ],
  },
];
