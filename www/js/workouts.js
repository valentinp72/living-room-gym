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
];
