// Runs a training set (see workouts.js): each step until its target is
// reached, a rest between steps, then done. Pure logic: the app feeds it
// frames and turns the returned events into sounds and UI.
import { EXERCISES } from './exercises/index.js';
import { LEVELS } from './workouts.js';

export const exerciseById = id => EXERCISES.find(e => e.id === id);

export const targetOf = step => (step.reps !== undefined ? step.reps : step.seconds);

// "10 reps" / "30 s"
export const describeStep = step => (step.reps !== undefined ? step.reps + ' reps' : step.seconds + ' s');

// Throws on a training set that can't run, so configuration mistakes show
// up as soon as the app loads.
export function validateWorkout(w) {
  if (!w.steps || !w.steps.length) throw new Error(`Training set "${w.id}" has no steps`);
  if (!LEVELS.includes(w.level)) throw new Error(`Training set "${w.id}": level must be one of ${LEVELS.join(', ')}`);
  w.steps.forEach((step, i) => {
    const ex = exerciseById(step.exercise);
    const where = `Training set "${w.id}", step ${i + 1}`;
    if (!ex) throw new Error(`${where}: unknown exercise "${step.exercise}"`);
    const unit = step.reps !== undefined ? 'reps' : step.seconds !== undefined ? 'seconds' : null;
    if (unit !== ex.unit) throw new Error(`${where}: "${ex.id}" needs ${ex.unit}, got ${unit || 'no target'}`);
    if (!(targetOf(step) > 0)) throw new Error(`${where}: target must be > 0`);
  });
}

// Equipment a training set needs ('chair', 'band', 'weights'), in step order.
export const equipmentOf = w => [...new Set(w.steps.map(s => exerciseById(s.exercise).equipment).filter(Boolean))];

function beginStep(run, index) {
  run.index = index;
  run.phase = 'exercise';
  run.ex = exerciseById(run.workout.steps[index].exercise);
  run.st = run.ex.state();
}

function endStep(run, events) {
  if (run.index + 1 >= run.workout.steps.length) {
    run.phase = 'done';
    events.push('finished');
  } else if (run.workout.rest > 0) {
    run.phase = 'rest';
    run.restLeft = run.workout.rest;
  } else {
    beginStep(run, run.index + 1);
    events.push('go');
  }
}

// run.phase: 'exercise' (run.ex / run.st are the current step's), 'rest'
// (run.restLeft seconds left), or 'done'.
export function createRun(workout) {
  const run = { workout, index: 0, phase: null, ex: null, st: null, restLeft: 0 };
  beginStep(run, 0);
  return run;
}

export const currentStep = run => run.workout.steps[run.index];
export const nextStep = run => run.workout.steps[run.index + 1];

// Advance by dt milliseconds. Returns the events that happened, in order:
//   'stepDone' target reached   'count' rest countdown (3, 2, 1)
//   'go' next step starts       'finished' last step done
//   'skipped' (skip() only) a step was skipped
export function updateRun(run, ctx, dt) {
  const events = [];
  if (run.phase === 'exercise') {
    run.ex.update(ctx, run.st, dt);
    if (run.ex.count(run.st) >= targetOf(currentStep(run))) {
      events.push('stepDone');
      endStep(run, events);
    }
  } else if (run.phase === 'rest') {
    const before = Math.ceil(run.restLeft);
    run.restLeft -= dt / 1000;
    const after = Math.ceil(run.restLeft);
    if (after < before && after >= 1 && after <= 3) events.push('count');
    if (run.restLeft <= 0) {
      beginStep(run, run.index + 1);
      events.push('go');
    }
  }
  return events;
}

// Skip the current step (or the rest). Returns events like updateRun, plus
// 'skipped' for a skipped step: the screen must change even when the next
// phase (a rest) has no event of its own.
export function skip(run) {
  const events = [];
  if (run.phase === 'exercise') { events.push('skipped'); endStep(run, events); }
  else if (run.phase === 'rest') { beginStep(run, run.index + 1); events.push('go'); }
  return events;
}
