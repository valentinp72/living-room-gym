import { BODY, place, rot, turn, showBand, kneeOf } from '../avatar.js';
import { paced } from './paced.js';

// Untracked: the head only sways sideways.
const SECONDS_PER_REP = 1.5;
const DEG = Math.PI / 180;
const THIGH = 35, SHIN = 15;   // half squat: forward tilts from vertical
const WIDE = 8;                // legs apart, degrees

export default {
  ...paced({ secondsPerRep: SECONDS_PER_REP }),
  id: 'band-side-steps', name: 'Band Side Steps', muscle: 'Glutes', color: '#6a1b9a', equipment: 'band',
  instructions: 'Band around your legs just above the knees, in a half squat. On each beat, take a small step to the side, then bring the other foot in. Go a few steps each way.',
  demo(parts, t) {
    const beat = t / SECONDS_PER_REP;
    const k = Math.sin(Math.PI * (beat % 1));        // one step per beat
    const dir = Math.floor(beat / 4) % 2 ? -1 : 1;   // 4 steps one way, then back
    const s = dir > 0 ? 'R' : 'L';                   // the leading leg
    const legH = BODY.shin * Math.cos(SHIN * DEG) + BODY.thigh * Math.cos(THIGH * DEG);
    place(parts.pelvis, dir * 0.05 * k, BODY.ankle + legH * Math.cos(WIDE * DEG) + 0.02 * k,
      BODY.shin * Math.sin(SHIN * DEG) - BODY.thigh * Math.sin(THIGH * DEG));
    for (const side of ['L', 'R']) {
      const out = (side === 'L' ? -1 : 1) * (WIDE + (side === s ? 12 * k : 0));
      rot(parts['hip' + side], -THIGH, 0, out);
      rot(parts['knee' + side], THIGH + SHIN + (side === s ? 25 * k : 0));   // the stepping foot lifts
      rot(parts['ankle' + side], -SHIN, 0, -out);
    }
    rot(parts.spine, 20);
    for (const side of ['L', 'R']) rot(parts['shoulder' + side], -40, 0, side === 'L' ? 10 : -10);   // hands in front
    rot(parts.elbowL, -60); rot(parts.elbowR, -60);
    showBand(parts, 'band1', kneeOf(parts, 'L'), kneeOf(parts, 'R'));
    turn(parts, 10);
  }
};
