// Short feedback sounds, generated with Web Audio (no files to load).
//   rep     paced exercises: one tick per rep (the beat)
//   ding    a tracked move is done (a rep, one arm's curl, 10 s of a hold)
//   holdOn  a hold's timer starts: in position, counting
//   holdOff a hold's timer stops: out of position, not counted any more
//   done    a step's target is reached
//   count   rest countdown: 3, 2, 1
//   go      the next step starts
//   finish  the training set is complete
// Browsers only allow audio after a user gesture, so call unlockAudio()
// from click handlers (a trigger pull / pinch counts as one).

const SOUNDS = {
  // [frequency Hz, start s, duration s, volume (default 0.3)]
  rep: [[880, 0, 0.07]],
  // A little bell: a high tone with a quieter overtone, fading out.
  ding: [[1320, 0, 0.45, 0.25], [3300, 0, 0.18, 0.06]],
  done: [[660, 0, 0.12], [990, 0.12, 0.22]],
  // Rising and falling pairs, clear without looking at the counter.
  holdOn: [[587, 0, 0.1], [880, 0.1, 0.18]],
  holdOff: [[415, 0, 0.14], [311, 0.14, 0.3, 0.35]],
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
  for (const [freq, start, dur, vol = 0.3] of SOUNDS[name]) {
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    // Quick fade in/out to avoid clicks.
    gain.gain.setValueAtTime(0, t0 + start);
    gain.gain.linearRampToValueAtTime(vol, t0 + start + 0.01);
    gain.gain.linearRampToValueAtTime(0, t0 + start + dur);
    osc.connect(gain).connect(a.destination);
    osc.start(t0 + start);
    osc.stop(t0 + start + dur + 0.02);
  }
}
