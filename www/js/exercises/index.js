/* ---------------------------------------------------------------------
 * EXERCISE REGISTRY
 * To add a new exercise, create a file in this folder that default-exports
 * an object with:
 *   id, name, muscle, color, instructions
 *   state()             -> fresh per-session state object
 *   update(ctx, st, dt) -> read ctx.scene/camera/hands each frame
 *                          (hands: see readHands() in tracking.js),
 *                          mutate st (reps, time, etc.)
 *   label(st)           -> string shown as the live counter
 *   demo(parts, t)       -> pose the mannequin each frame (t = seconds
 *                          since the exercise screen opened) to show the move.
 *                          The pose is reset to standing before every call,
 *                          so only set the joints that move (see avatar.js
 *                          for the joint names, rot/place/turn helpers and
 *                          rotation directions)
 *   manual (optional)    -> true if it needs a Start/Stop button instead
 *                          of automatic rep detection (e.g. timed holds)
 * then import it below and add it to EXERCISES (menu order).
 * Nothing else in the app needs to change.
 * ------------------------------------------------------------------- */
import squats from './squats.js';
import curls from './curls.js';
import plank from './plank.js';

export const EXERCISES = [squats, curls, plank];
