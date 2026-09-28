/* ---------------------------------------------------------------------
 * EXERCISE REGISTRY
 * To add a new exercise, create a file in this folder that default-exports
 * an object with:
 *   id, name, muscle, color, instructions
 *   unit                -> 'reps' or 'seconds': what count() returns and
 *                          what training sets give as the target
 *   state()             -> fresh per-session state object
 *   update(ctx, st, dt) -> read ctx.scene/camera/hands each frame
 *                          (hands: see readHands() in tracking.js),
 *                          mutate st (reps, time, etc.)
 *   count(st)           -> progress toward a training-set target, in `unit`
 *   label(st)           -> string shown as the live counter
 *   holding(st) (optional) -> for holds: is the timer running? The app
 *                          plays a sound when it starts and when it stops
 *                          (hold() provides it)
 *   moves(st) (optional) -> moves done so far; each new one gets a ding
 *                          and a counter pop. Default: whole reps, or
 *                          every 10 s for 'seconds' (see movesOf below)
 *   equipment (optional) -> 'chair', 'band' or 'weights' (nothing = none)
 *   floor (optional)    -> true for exercises done on the floor. The menu
 *                          groups exercises: Standing, Floor (no equipment),
 *                          then by equipment (see groupOf below)
 *   paced (optional)    -> true for untracked exercises built with paced()
 *                          (exercises/paced.js): the app ticks each rep
 *   demo(parts, t)       -> pose the mannequin each frame (t = seconds
 *                          since the exercise screen opened) to show the move.
 *                          The pose is reset to standing before every call,
 *                          so only set the joints that move (see avatar.js
 *                          for the joint names, rot/place/turn helpers and
 *                          rotation directions)
 * then import it below and add it to EXERCISES (menu order: a grid, row by row).
 * One-sided exercises come as a left and a right one: the file exports both
 * as an array ([left, right], ids ending in -left / -right), spread into
 * EXERCISES, and the demo shows the other side with mirror() (avatar.js).
 * Building blocks: paced() (untracked, app-paced reps), headDip() (head goes
 * down and up from a still top position: squats, lunges, dips), pushUpReps()
 * (face down), hold() (timed holds: plank, side plank, wall sit). Demo
 * helpers: squatPose() (squats.js), pushUpDemo() (push-ups.js), allFours()
 * (all-fours.js), and the props in avatar.js (showChair(), showDumbbells(),
 * showBand(), showWall()).
 * Nothing else in the app needs to change.
 * ------------------------------------------------------------------- */
import squats from './squats.js';
import curls from './curls.js';
import plank from './plank.js';
import crunches from './crunches.js';
import legRaises from './leg-raises.js';
import pushUps from './push-ups.js';
import kneePushUps from './knee-push-ups.js';
import lunges from './lunges.js';
import calfRaises from './calf-raises.js';
import gluteBridges from './glute-bridges.js';
import fireHydrants from './fire-hydrants.js';
import jumpingJacks from './jumping-jacks.js';
import wallSit from './wall-sit.js';
import sidePlank from './side-plank.js';
import mountainClimbers from './mountain-climbers.js';
import birdDogs from './bird-dogs.js';
import donkeyKicks from './donkey-kicks.js';
import chairDips from './chair-dips.js';
import inclinePushUps from './incline-push-ups.js';
import chairSquats from './chair-squats.js';
import splitSquats from './split-squats.js';
import bandPullAparts from './band-pull-aparts.js';
import bandRows from './band-rows.js';
import bandSideSteps from './band-side-steps.js';
import gobletSquats from './goblet-squats.js';
import romanianDeadlifts from './romanian-deadlifts.js';
import shoulderPress from './shoulder-press.js';
import bentOverRows from './bent-over-rows.js';
import lateralRaises from './lateral-raises.js';

export const EXERCISES = [squats, curls, plank, crunches, legRaises, pushUps, kneePushUps,
  lunges, calfRaises, gluteBridges, fireHydrants,
  jumpingJacks, wallSit, ...sidePlank, mountainClimbers, birdDogs, donkeyKicks,
  chairDips, inclinePushUps, chairSquats, ...splitSquats,
  bandPullAparts, bandRows, bandSideSteps,
  gobletSquats, romanianDeadlifts, shoulderPress, bentOverRows, lateralRaises];

// Menu groups for single exercises, in menu order.
export const GROUPS = [
  { id: 'standing', name: 'Standing' },
  { id: 'floor', name: 'Floor' },
  { id: 'chair', name: 'Chair' },
  { id: 'band', name: 'Band' },
  { id: 'weights', name: 'Weights' },
];
export const groupOf = ex => ex.equipment || (ex.floor ? 'floor' : 'standing');
export const EQUIPMENT_NAMES = { chair: 'chair', band: 'band', weights: 'dumbbells' };

// Moves done so far, for the per-move ding (see tickMoves() in app.js).
export const HOLD_DING_SECONDS = 10;
export function movesOf(ex, st) {
  if (ex.moves) return ex.moves(st);
  const n = ex.count(st);
  return Math.floor(ex.unit === 'seconds' ? n / HOLD_DING_SECONDS : n);
}
