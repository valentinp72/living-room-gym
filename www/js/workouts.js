/* ---------------------------------------------------------------------
 * TRAINING SETS
 * A training set is a fixed list of steps done in order, with a rest
 * between steps. Difficulty is just configuration: a harder variant of a
 * set is another entry with more reps / seconds and less rest.
 *   id, name         -> shown in the menu, with the equipment its steps need
 *   level            -> 'Easy', 'Medium' or 'Hard' (LEVELS): the menu tab
 *                       it's listed under
 *   rest             -> seconds of rest between steps (0 = none)
 *   steps            -> [{ exercise: <exercise id>, reps: n }
 *                        | { exercise: <exercise id>, seconds: n }]
 *                       reps for exercises with unit 'reps', seconds for
 *                       unit 'seconds' (see exercises/index.js)
 * ------------------------------------------------------------------- */
export const LEVELS = ['Easy', 'Medium', 'Hard'];

export const WORKOUTS = [
  // ----- Easy: short sets, long rests -----
  {
    id: 'full-body-starter', name: 'Full body starter', level: 'Easy',
    rest: 20,
    steps: [
      { exercise: 'squats', reps: 10 },
      { exercise: 'curls', reps: 10 },
      { exercise: 'plank', seconds: 20 },
    ],
  },
  {
    id: 'lower-body-easy', name: 'Legs and glutes', level: 'Easy',
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
    id: 'core-easy', name: 'Abs', level: 'Easy',
    rest: 20,
    steps: [
      { exercise: 'crunches', reps: 10 },
      { exercise: 'leg-raises', reps: 8 },
      { exercise: 'plank', seconds: 20 },
      { exercise: 'crunches', reps: 10 },
    ],
  },
  {
    id: 'upper-body-easy', name: 'Chest and arms', level: 'Easy',
    rest: 25,
    steps: [
      { exercise: 'knee-push-ups', reps: 8 },
      { exercise: 'curls', reps: 10 },
      { exercise: 'knee-push-ups', reps: 8 },
      { exercise: 'curls', reps: 10 },
    ],
  },
  {
    id: 'chair-easy', name: 'Chair basics', level: 'Easy',
    rest: 25,
    steps: [
      { exercise: 'chair-squats', reps: 10 },
      { exercise: 'incline-push-ups', reps: 8 },
      { exercise: 'glute-bridges', reps: 10 },
      { exercise: 'chair-dips', reps: 6 },
      { exercise: 'bird-dogs', reps: 8 },
    ],
  },
  // ----- Medium: more reps, shorter rests -----
  {
    id: 'full-body-medium', name: 'Full body', level: 'Medium',
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
  {
    id: 'core-medium', name: 'Core', level: 'Medium',
    rest: 15,
    steps: [
      { exercise: 'crunches', reps: 15 },
      { exercise: 'mountain-climbers', reps: 20 },
      { exercise: 'side-plank-left', seconds: 20 },
      { exercise: 'side-plank-right', seconds: 20 },
      { exercise: 'leg-raises', reps: 10 },
      { exercise: 'bird-dogs', reps: 10 },
      { exercise: 'plank', seconds: 40 },
    ],
  },
  {
    id: 'lower-body-medium', name: 'Legs and glutes', level: 'Medium',
    rest: 15,
    steps: [
      { exercise: 'squats', reps: 15 },
      { exercise: 'lunges', reps: 16 },
      { exercise: 'wall-sit', seconds: 40 },
      { exercise: 'donkey-kicks', reps: 16 },
      { exercise: 'glute-bridges', reps: 15 },
      { exercise: 'calf-raises', reps: 20 },
    ],
  },
  {
    id: 'band-medium', name: 'Band workout', level: 'Medium',
    rest: 20,
    steps: [
      { exercise: 'band-pull-aparts', reps: 15 },
      { exercise: 'band-side-steps', reps: 16 },
      { exercise: 'band-rows', reps: 15 },
      { exercise: 'squats', reps: 15 },
      { exercise: 'band-pull-aparts', reps: 15 },
      { exercise: 'glute-bridges', reps: 15 },
    ],
  },
  {
    id: 'dumbbells-medium', name: 'Dumbbell full body', level: 'Medium',
    rest: 20,
    steps: [
      { exercise: 'goblet-squats', reps: 12 },
      { exercise: 'shoulder-press', reps: 10 },
      { exercise: 'bent-over-rows', reps: 12 },
      { exercise: 'romanian-deadlifts', reps: 12 },
      { exercise: 'curls', reps: 12 },
      { exercise: 'lateral-raises', reps: 10 },
    ],
  },
  // ----- Hard: long sets, short rests -----
  {
    id: 'full-body-hard', name: 'Full body challenge', level: 'Hard',
    rest: 12,
    steps: [
      { exercise: 'jumping-jacks', reps: 30 },
      { exercise: 'push-ups', reps: 15 },
      { exercise: 'split-squats-left', reps: 10 },
      { exercise: 'split-squats-right', reps: 10 },
      { exercise: 'mountain-climbers', reps: 30 },
      { exercise: 'chair-dips', reps: 15 },
      { exercise: 'plank', seconds: 60 },
    ],
  },
  {
    id: 'core-hard', name: 'Core crusher', level: 'Hard',
    rest: 10,
    steps: [
      { exercise: 'crunches', reps: 25 },
      { exercise: 'leg-raises', reps: 15 },
      { exercise: 'side-plank-left', seconds: 30 },
      { exercise: 'side-plank-right', seconds: 30 },
      { exercise: 'mountain-climbers', reps: 40 },
      { exercise: 'bird-dogs', reps: 16 },
      { exercise: 'plank', seconds: 75 },
    ],
  },
  {
    id: 'legs-hard', name: 'Leg day', level: 'Hard',
    rest: 12,
    steps: [
      { exercise: 'goblet-squats', reps: 20 },
      { exercise: 'romanian-deadlifts', reps: 15 },
      { exercise: 'split-squats-left', reps: 10 },
      { exercise: 'split-squats-right', reps: 10 },
      { exercise: 'wall-sit', seconds: 60 },
      { exercise: 'calf-raises', reps: 30 },
      { exercise: 'lunges', reps: 20 },
    ],
  },
  {
    id: 'upper-body-hard', name: 'Upper body', level: 'Hard',
    rest: 12,
    steps: [
      { exercise: 'push-ups', reps: 20 },
      { exercise: 'bent-over-rows', reps: 15 },
      { exercise: 'shoulder-press', reps: 15 },
      { exercise: 'chair-dips', reps: 15 },
      { exercise: 'lateral-raises', reps: 12 },
      { exercise: 'curls', reps: 15 },
    ],
  },
  {
    id: 'cardio-hard', name: 'Cardio blast', level: 'Hard',
    rest: 10,
    steps: [
      { exercise: 'jumping-jacks', reps: 40 },
      { exercise: 'mountain-climbers', reps: 30 },
      { exercise: 'squats', reps: 20 },
      { exercise: 'push-ups', reps: 12 },
      { exercise: 'jumping-jacks', reps: 40 },
      { exercise: 'mountain-climbers', reps: 30 },
    ],
  },
];
