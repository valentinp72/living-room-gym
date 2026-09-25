// Short feedback sounds, generated with Web Audio (no files to load).
//   rep     paced exercises: one tick per rep
//   done    a step's target is reached
//   count   rest countdown: 3, 2, 1
//   go      the next step starts
//   finish  the training set is complete
// Browsers only allow audio after a user gesture, so call unlockAudio()
// from click handlers (a trigger pull / pinch counts as one).

const SOUNDS = {
  // [frequency Hz, start s, duration s]
  rep: [[880, 0, 0.07]],
  done: [[660, 0, 0.12], [990, 0.12, 0.22]],
  count: [[520, 0, 0.12]],
  go: [[1040, 0, 0.3]],
  finish: [[523, 0, 0.14], [659, 0.14, 0.14], [784, 0.28, 0.14], [1047, 0.42, 0.4]],
};

let ctx = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function unlockAudio() { audio(); }

export function play(name) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + 0.01;
  for (const [freq, start, dur] of SOUNDS[name]) {
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    // Quick fade in/out to avoid clicks.
    gain.gain.setValueAtTime(0, t0 + start);
    gain.gain.linearRampToValueAtTime(0.3, t0 + start + 0.01);
    gain.gain.linearRampToValueAtTime(0, t0 + start + dur);
    osc.connect(gain).connect(a.destination);
    osc.start(t0 + start);
    osc.stop(t0 + start + dur + 0.02);
  }
}
