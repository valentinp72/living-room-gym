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
 *   moves(st) (optional) -> moves done so far; each new one gets a ding
 *                          and a counter pop. Default: whole reps, or
 *                          every 10 s for 'seconds' (see movesOf below)
 *   paced (optional)    -> true for untracked exercises built with paced()
 *                          (exercises/paced.js): the app ticks each rep
 *   demo(parts, t)       -> pose the mannequin each frame (t = seconds
 *                          since the exercise screen opened) to show the move.
 *                          The pose is reset to standing before every call,
 *                          so only set the joints that move (see avatar.js
 *                          for the joint names, rot/place/turn helpers and
 *                          rotation directions)
 * then import it below and add it to EXERCISES (menu order: a grid, row by row).
 * Building blocks: paced() (untracked, app-paced reps), headDip() (standing,
 * head goes down and up: squats, lunges), pushUpReps() (face down).
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

export const EXERCISES = [squats, curls, plank, crunches, legRaises, pushUps, kneePushUps,
  lunges, calfRaises, gluteBridges, fireHydrants];

// Moves done so far, for the per-move ding (see tickMoves() in app.js).
export const HOLD_DING_SECONDS = 10;
export function movesOf(ex, st) {
  if (ex.moves) return ex.moves(st);
  const n = ex.count(st);
  return Math.floor(ex.unit === 'seconds' ? n / HOLD_DING_SECONDS : n);
}
