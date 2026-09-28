// Training sets end to end: steps, targets, rests, skip, sounds, paced exercises, validation.
import { launch, frames, wait } from './lib.mjs';
import { installFakeXR } from './fakexr.mjs';
const [url, shot] = process.argv.slice(2);
// The page's time, not real time (see the test clock in lib.mjs).
const sleep = ms => wait(page, ms);
const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 900 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
// Record sounds: a stand-in AudioContext logs each tone. currentTime stays 0,
// so the first tone of every play() starts at exactly 0.01 s.
await page.evaluateOnNewDocument(() => {
  window.__tones = [];
  window.AudioContext = class {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    resume() {}
    createOscillator() {
      const o = { type: '', frequency: { value: 0 }, connect: g => g, stop() {},
        start: t => __tones.push({ f: o.frequency.value, first: Math.abs(t - 0.01) < 1e-9 }) };
      return o;
    }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect: d => d }; }
  };
});
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('a-scene')?.hasLoaded);
await installFakeXR(page);
await page.evaluate(() => document.querySelector('#camera').setAttribute('look-controls', 'enabled: false'));

const NAMES = { 880: 'rep', 1320: 'ding', 3300: null, 660: 'done', 520: 'count', 1040: 'go', 523: 'finish', 587: 'holdOn', 415: 'holdOff' };
// Sounds played since the last call, by name.
const sounds = () => page.evaluate(NAMES => {
  const out = [];
  for (const t of __tones) if (t.first && NAMES[t.f] !== null) out.push(NAMES[t.f] || t.f);
  __tones.length = 0; return out;
}, NAMES);
const ui = () => page.evaluate(() => ({
  title: document.querySelector('#exerciseTitle').getAttribute('value'),
  instr: document.querySelector('#instrText').getAttribute('value'),
  rep: document.querySelector('#repText').getAttribute('value'),
  skip: document.querySelector('#btnSkip').classList.contains('clickable'),
  mannequin: document.querySelector('#mannequin').getAttribute('visible'),
  bg: document.querySelector('#exerciseBg').getAttribute('material').color,
  counter: document.querySelector('#repText').getAttribute('color'),
  // Right elbow bend (degrees): the curls demo bends it up to 140, idle keeps it at 12.
  elbow: Math.round(-THREE.MathUtils.radToDeg(
    document.querySelector('#stage').components['gym-app'].mannequin.elbowR.object3D.rotation.x)),
  // The "UP NEXT" card (rest only) and its mannequin's right elbow.
  next: document.querySelector('#nextCard').object3D.visible,
  nextElbow: Math.round(-THREE.MathUtils.radToDeg(
    document.querySelector('#stage').components['gym-app'].nextMannequin.elbowR.object3D.rotation.x)),
}));
const head = async (y, pitch = 0, ms = 120) => { await page.evaluate((y, p) => { const o = document.querySelector('#camera').object3D; o.position.set(0, y, 0); o.rotation.set(p * Math.PI / 180, 0, 0, 'YXZ'); }, y, pitch); await sleep(ms); await frames(page, 2); };
const hands = async y => { await page.evaluate(y => { fakeXR.hands.left.pos[1] = fakeXR.hands.right.pos[1] = y; }, y); await sleep(120); await frames(page, 2); };
const click = sel => page.evaluate(s => document.querySelector(s).emit('click'), sel);

const results = [];
const check = (name, ok, info = '') => results.push({ name, ok, info });
const eq = (name, got, want) => check(name, JSON.stringify(got) === JSON.stringify(want), `got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);

// Menu.
// (Tests import app modules with the page's own ?v= version, if any, so they
// get the same module instances as the app: see .github/scripts/cache-bust.mjs.)
const menu = await page.evaluate(() => [...document.querySelectorAll('#workoutButtons > *')].map(b => b.querySelector('a-text').getAttribute('value')));
eq('menu: training sets start with the easy ones', menu.slice(0, 5), ['Full body starter', 'Legs and glutes', 'Abs',
  'Chest and arms', 'Chair basics']);
// Equipment shows as icons, not words (no "Dumbbell full body\nwith dumbbells").
check('menu: no equipment words on the labels', menu.includes('Dumbbell full body') && !menu.some(l => l.includes('with')), JSON.stringify(menu));
const icons = sel => page.evaluate(sel => [...document.querySelector(sel).querySelectorAll('a-plane')]
  .map(p => p.getAttribute('material').src).filter(Boolean).map(s => s.src || s), sel);
const legDay = await page.evaluate(() => [...document.querySelectorAll('#workoutButtons > *')].findIndex(b => b.querySelector('a-text').getAttribute('value').startsWith('Leg day')) + 1);
eq('menu: equipment icons', await icons(`#workoutButtons > :nth-child(${legDay})`), ['img/equipment/weights.png', 'img/equipment/chair.png']);
eq('menu: icon on the equipment setting', await icons('#kit-band'), ['img/equipment/band.png']);
// Only the chosen level's sets are shown (and clickable).
const shownSets = () => page.evaluate(() => [...document.querySelectorAll('#workoutButtons > *')]
  .filter(b => b.getAttribute('visible') && b.classList.contains('clickable')).map(b => b.querySelector('a-text').getAttribute('value').split('\n')[0]));
eq('menu: easy sets shown first', await shownSets(), ['Full body starter', 'Legs and glutes', 'Abs', 'Chest and arms', 'Chair basics']);
await click('#group-hard'); await sleep(100);
eq('menu: hard sets', await shownSets(), ['Full body challenge', 'Core crusher', 'Leg day', 'Upper body', 'Cardio blast']);
await click('#group-easy'); await sleep(100);
// Equipment setting: sets needing what the user doesn't have are hidden,
// and the rest close up.
await click('#kit-chair'); await sleep(100);
eq('equipment: no chair hides Chair basics', await shownSets(), ['Full body starter', 'Legs and glutes', 'Abs', 'Chest and arms']);
eq('equipment: button says so', await page.evaluate(() => document.querySelector('#kit-chair a-text').getAttribute('value')), 'Chair: no');
await click('#group-hard'); await sleep(100);
eq('equipment: hard sets without a chair', await shownSets(), ['Core crusher', 'Cardio blast']);
const firstPos = await page.evaluate(() => {
  const b = [...document.querySelectorAll('#workoutButtons > *')].find(b => b.classList.contains('clickable'));
  return b.getAttribute('position').x;
});
check('equipment: shown sets move up to the first slot', firstPos < 0, firstPos);
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('a-scene')?.hasLoaded);
await installFakeXR(page);
await page.evaluate(() => document.querySelector('#camera').setAttribute('look-controls', 'enabled: false'));
eq('equipment: remembered after a reload', await shownSets(), ['Full body starter', 'Legs and glutes', 'Abs', 'Chest and arms']);
await click('#kit-chair'); await sleep(100);
eq('equipment: chair back', (await shownSets()).length, 5);
// Every level has sets, and harder levels have shorter rests and more work.
const levels = await page.evaluate(async () => {
  const { WORKOUTS } = await import('/js/workouts.js' + new URL(document.querySelector('script[type=module]').src).search);
  const out = {};
  for (const w of WORKOUTS) (out[w.level] = out[w.level] || []).push({ rest: w.rest, reps: w.steps.reduce((n, s) => n + (s.reps || s.seconds / 2), 0) });
  const avg = (l, k) => out[l].reduce((n, w) => n + w[k], 0) / out[l].length;
  return ['Easy', 'Medium', 'Hard'].map(l => ({ l, n: out[l].length, rest: avg(l, 'rest'), work: avg(l, 'reps') }));
});
check('levels: each has sets', levels.every(l => l.n >= 3), JSON.stringify(levels));
check('levels: rests get shorter, work longer', levels[0].rest > levels[1].rest && levels[1].rest > levels[2].rest &&
  levels[0].work < levels[1].work && levels[1].work < levels[2].work, JSON.stringify(levels));
// Every training set is valid (validateWorkout runs on load; a throw would be a page error).
if (shot) await page.screenshot({ path: shot + '-menu.png' });

// Step 1: 10 squats.
await head(1.6, 0, 50);
await page.evaluate(() => document.querySelector('#workoutButtons > *').emit('click'));
await sleep(1400);   // calibration
let u = await ui();
eq('step 1 title', u.title, '1/3  SQUATS');
check('step 1 target in instructions', u.instr.startsWith('10 reps.'), u.instr);
check('skip shown in a training set', u.skip);
for (let i = 0; i < 4; i++) { await head(1.25); await head(1.58); }
check('progress 4 / 10', (await ui()).rep.endsWith('\n4 / 10'), (await ui()).rep);
if (shot) await page.screenshot({ path: shot + '-step.png' });
eq('a ding per squat', await sounds(), ['ding', 'ding', 'ding', 'ding']);
// The counter pops on each rep, then eases back. The scale is recorded on
// every frame: on a slow runner one frame can outlast the whole pop.
await page.evaluate(() => {
  const app = document.querySelector('#stage').components['gym-app'];
  window.popScales = [];
  const pop = app.popCounter;
  app.popCounter = function (delta) { pop.call(this, delta); popScales.push(this.repText.object3D.scale.x); };
});
await head(1.25); await head(1.58);
await sleep(500); await frames(page, 3);
const [popped, settled] = await page.evaluate(() => [Math.max(...popScales), popScales[popScales.length - 1]]);
check('counter pops on a rep', popped > 1.1 && settled === 1, `popped=${popped} settled=${settled}`);
await sounds();
const confetti = () => page.evaluate(() => {
  const c = document.querySelector('#confetti').components.confetti;
  return { live: c.live().length, visible: c.mesh.visible, minY: Math.min(...c.live().map(p => p.pos.y)) };
});
eq('no confetti yet', (await confetti()).live, 0);
for (let i = 0; i < 5; i++) { await head(1.25); await head(1.58); }
await sleep(150);
u = await ui();
eq('squats done: dings, the last rep chimes', await sounds(), [...Array(4).fill('ding'), 'done']);
let c = await confetti();
check('step done: confetti burst', c.live === 90 && c.visible, JSON.stringify(c));
await sleep(3500);
c = await confetti();
check('confetti gone after a few seconds', c.live === 0 && !c.visible, JSON.stringify(c));
eq('then rest', u.title, 'REST');
eq('rest explains what comes next', u.instr, 'Relax. Next: Bicep Curls, 10 reps. It starts after the countdown.');
check('rest countdown shown', /^(19|20)s$/.test(u.rep), u.rep);
eq('rest look: blue panel, cyan counter', [u.bg, u.counter], ['#0b3d5c', '#80deea']);
let elbows = [], nextElbows = [];
for (let i = 0; i < 8; i++) { const v = await ui(); elbows.push(v.elbow); nextElbows.push(v.nextElbow); await sleep(150); }
check('rest: mannequin idles, no curls demo', u.mannequin === true && elbows.every(e => e >= 10 && e <= 14), JSON.stringify(elbows));
check('rest: "up next" card shown', u.next, u.next);
check('rest: the card previews curls', Math.max(...nextElbows) > 60, JSON.stringify(nextElbows));
if (shot) await page.screenshot({ path: shot + '-rest1.png' });

// Skip the rest.
await click('#btnSkip'); await sleep(150);
eq('skip rest: go sound', await sounds(), ['go']);
u = await ui();
eq('step 2 title', u.title, '2/3  BICEP CURLS');
eq('exercise look back', [u.bg, u.counter], ['#000000', '#ffeb3b']);
eq('no "up next" card during an exercise', u.next, false);
elbows = [];
for (let i = 0; i < 8; i++) { elbows.push((await ui()).elbow); await sleep(150); }
check('curls demo during the step', Math.max(...elbows) > 60, JSON.stringify(elbows));

// Step 2: 10 curls with each arm (bare hands).
await page.evaluate(() => { for (const s of ['left', 'right']) Object.assign(fakeXR.hands[s], { kind: 'hand', lost: false, pos: [0, 0.8, -0.2] }); });
await sleep(150); await frames(page, 2);   // the detectors see the hands low first
for (let i = 0; i < 10; i++) { await hands(1.35); await hands(0.8); }
await sleep(150);
// Both arms curl together here: one ding per pair (alternating arms get one each).
eq('curls done: dings, the last one chimes', await sounds(), [...Array(9).fill('ding'), 'done']);
eq('rest again', (await ui()).title, 'REST');

// End of the 20 s rest: 3-2-1 countdown then go; "GET READY" for the
// last 3 s. Jump to 4.5 s left rather than wait 15 s.
await page.evaluate(() => { document.querySelector('#stage').components['gym-app'].run.restLeft = 4.5; });
await frames(page, 2);
eq('still resting at 4-5 s left', (await ui()).title, 'REST');
await sleep(2500);
eq('get ready for the last 3 s', (await ui()).title, 'GET READY');
if (shot) await page.screenshot({ path: shot + '-rest.png' });
await sleep(2500);
eq('rest countdown + go', await sounds(), ['count', 'count', 'count', 'go']);
eq('step 3 title', (await ui()).title, '3/3  PLANK HOLD');

// Step 3: 20 s plank (1 s entry delay counted).
await head(0.45, -80, 0);
await sleep(10000);
check('plank progress on the floor counter', /\n(9|10|11) \/ 20 s$/.test(await page.evaluate(() => document.querySelector('#floorLabelText').getAttribute('value'))),
  await page.evaluate(() => document.querySelector('#floorLabelText').getAttribute('value')));
if (shot) await page.screenshot({ path: shot + '-plank.png' });
await sleep(10600);
u = await ui();
eq('plank: in position, a ding at 10 s, fanfare at the end', await sounds(), ['holdOn', 'ding', 'finish']);
c = await confetti();
check('finish: big confetti burst, above the floor', c.live === 260 && c.minY >= 0.003, JSON.stringify(c));
eq('complete screen', [u.title, u.rep, u.skip, u.mannequin, u.next], ['TRAINING COMPLETE', 'Well done!', false, false, false]);
await head(1.6);
await click('#btnBack'); await sleep(100);

// Skipping the last step still finishes with the fanfare and confetti
// (regression: no celebration when the last step was skipped).
await page.evaluate(() => {
  document.querySelector('#btnBack').emit('click');
  document.querySelector('#stage').components['gym-app'].startWorkout({ id: 'x', name: 'X', level: 'Easy', rest: 5, steps: [{ exercise: 'squats', reps: 5 }] });
});
await sleep(100); await sounds();
await click('#btnSkip'); await sleep(150);
eq('skip last step: fanfare', await sounds(), ['finish']);
c = await confetti();
check('skip last step: big confetti', c.live >= 260, JSON.stringify(c));
eq('skip last step: complete screen', (await ui()).title, 'TRAINING COMPLETE');
await sleep(3500);

// Skipping an exercise goes to the rest screen, silently (regression: the
// skipped exercise stayed on screen, still running, during the rest).
await page.evaluate(() => { document.querySelector('#btnBack').emit('click'); document.querySelector('#workoutButtons > *').emit('click'); });
await sleep(200); await sounds();
await click('#btnSkip'); await sleep(200); await frames(page, 2);
u = await ui();
eq('skip exercise: rest screen', [u.title, u.bg, u.counter], ['REST', '#0b3d5c', '#80deea']);
eq('skip exercise: rest says what comes next', u.instr, 'Relax. Next: Bicep Curls, 10 reps. It starts after the countdown.');
check('skip exercise: rest countdown', /^(19|20)s$/.test(u.rep), u.rep);
eq('skip exercise: no sound', await sounds(), []);
elbows = [];
for (let i = 0; i < 6; i++) { elbows.push((await ui()).elbow); await sleep(150); }
check('skip exercise: mannequin idles', elbows.every(e => e >= 10 && e <= 14), JSON.stringify(elbows));

// Holds sound when their timer starts and stops (out of position: not
// counted any more), so the user knows without seeing the counter.
await page.evaluate(() => { document.querySelector('#btnBack').emit('click'); document.querySelectorAll('#menuButtons > *')[2].emit('click'); });
await head(1.6); await sounds();
await head(0.45, -80, 1500);
eq('hold: a sound when the timer starts', await sounds(), ['holdOn']);
await head(1.6, 0, 1500);
eq('hold: a sound when it stops', await sounds(), ['holdOff']);
await click('#btnBack');

// Single exercise: no Skip, no target.
await page.evaluate(() => document.querySelectorAll('#menuButtons > *')[0].emit('click')); await sleep(150);
u = await ui();
check('single exercise: no skip, no "up next" card', !u.skip && !u.next && u.title === 'SQUATS - Legs', JSON.stringify(u));
await click('#btnBack');

// Paced exercises: a tick per rep, single and in a training set (rest 0: done + go).
await page.evaluate(async () => {
  const { EXERCISES } = await import('/js/exercises/index.js' + new URL(document.querySelector('script[type=module]').src).search);
  const { paced } = await import('/js/exercises/paced.js' + new URL(document.querySelector('script[type=module]').src).search);
  EXERCISES.push({ ...paced({ secondsPerRep: 0.4 }), id: 'paced-test', name: 'Paced test', muscle: 'Test',
    instructions: 'Follow the beat.', demo() {} });
});
await sounds();
const app = fn => page.evaluate(fn);
await app(async () => {
  const { exerciseById } = await import('/js/workout-runner.js' + new URL(document.querySelector('script[type=module]').src).search);
  document.querySelector('#stage').components['gym-app'].startExercise(exerciseById('paced-test'));
});
// One tick per rep counted (a rep every 0.4 s: at least 3 by now).
await sleep(1300); await frames(page, 2);
// Reps and sounds read together, so no frame comes in between.
const [pacedReps, ticks] = await page.evaluate(NAMES => {
  const { ex, st } = document.querySelector('#stage').components['gym-app'].current;
  const out = __tones.filter(t => t.first && NAMES[t.f] !== null).map(t => NAMES[t.f] || t.f);
  __tones.length = 0;
  return [ex.count(st), out];
}, NAMES);
check('paced single exercise: a tick per rep', pacedReps >= 3 && ticks.length === pacedReps && ticks.every(t => t === 'rep'),
  `reps=${pacedReps} sounds=${JSON.stringify(ticks)}`);
await click('#btnBack');
await app(() => document.querySelector('#stage').components['gym-app'].startWorkout(
  { id: 't', name: 'T', level: 'Test', rest: 0,
    steps: [{ exercise: 'paced-test', reps: 2 }, { exercise: 'paced-test', reps: 2 }] }));
await sleep(2200);
eq('paced training set (no rest)', await sounds(), ['rep', 'rep', 'done', 'go', 'rep', 'rep', 'finish']);

// Broken training sets are rejected with a clear message.
const errs = await app(async () => {
  const { validateWorkout } = await import('/js/workout-runner.js' + new URL(document.querySelector('script[type=module]').src).search);
  const bad = [
    { id: 'a', level: 'Easy', steps: [] },
    { id: 'b', level: 'Easy', steps: [{ exercise: 'pushups', reps: 5 }] },
    { id: 'c', level: 'Easy', steps: [{ exercise: 'plank', reps: 5 }] },
    { id: 'd', level: 'Easy', steps: [{ exercise: 'squats', reps: 0 }] },
    { id: 'e', level: 'Expert', steps: [{ exercise: 'squats', reps: 5 }] },
  ];
  return bad.map(w => { try { validateWorkout(w); return 'accepted'; } catch (e) { return e.message; } });
});
eq('validation messages', errs, ['Training set "a" has no steps',
  'Training set "b", step 1: unknown exercise "pushups"',
  'Training set "c", step 1: "plank" needs seconds, got reps',
  'Training set "d", step 1: target must be > 0',
  'Training set "e": level must be one of Easy, Medium, Hard']);

for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok ? '' : '   ' + r.info));
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(results.every(r => r.ok) && !errors.length ? 0 : 1);
