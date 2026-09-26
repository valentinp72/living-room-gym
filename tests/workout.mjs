// Training sets end to end: steps, targets, rests, skip, sounds, paced exercises, validation.
import { launch } from './lib.mjs';
import { installFakeXR } from './fakexr.mjs';
const [url, shot] = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
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
await page.waitForFunction(() => document.querySelector('a-scene')?.hasLoaded, { timeout: 20000 });
await installFakeXR(page);
await page.evaluate(() => document.querySelector('#camera').setAttribute('look-controls', 'enabled: false'));

const NAMES = { 880: 'rep', 660: 'done', 520: 'count', 1040: 'go', 523: 'finish' };
// Sounds played since the last call, by name.
const sounds = () => page.evaluate(NAMES => {
  const out = [];
  for (const t of __tones) if (t.first) out.push(NAMES[t.f] || t.f);
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
}));
const head = async (y, pitch = 0, ms = 120) => { await page.evaluate((y, p) => { const o = document.querySelector('#camera').object3D; o.position.set(0, y, 0); o.rotation.set(p * Math.PI / 180, 0, 0, 'YXZ'); }, y, pitch); await sleep(ms); };
const hands = async y => { await page.evaluate(y => { fakeXR.hands.left.pos[1] = fakeXR.hands.right.pos[1] = y; }, y); await sleep(120); };
const click = sel => page.evaluate(s => document.querySelector(s).emit('click'), sel);

const results = [];
const check = (name, ok, info = '') => results.push({ name, ok, info });
const eq = (name, got, want) => check(name, JSON.stringify(got) === JSON.stringify(want), `got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);

// Menu.
const menu = await page.evaluate(() => [...document.querySelectorAll('#workoutButtons > *')].map(b => b.querySelector('a-text').getAttribute('value')));
eq('menu lists the training sets', menu, ['Full body starter (Easy)', 'Legs and glutes (Easy)', 'Abs (Easy)',
  'Chest and arms (Easy)', 'Full body (Medium)']);
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
for (let i = 0; i < 6; i++) { await head(1.25); await head(1.58); }
await sleep(150);
u = await ui();
eq('squats done: chime', await sounds(), ['done']);
eq('then rest', u.title, 'REST');
eq('rest explains what comes next', u.instr, 'Relax. Next: Bicep Curls, 10 reps. It starts after the countdown.');
check('rest countdown shown', /^(19|20)s$/.test(u.rep), u.rep);
eq('rest look: blue panel, cyan counter', [u.bg, u.counter], ['#0b3d5c', '#80deea']);
let elbows = [];
for (let i = 0; i < 8; i++) { elbows.push((await ui()).elbow); await sleep(150); }
check('rest: mannequin idles, no curls demo', u.mannequin === true && elbows.every(e => e >= 10 && e <= 14), JSON.stringify(elbows));
if (shot) await page.screenshot({ path: shot + '-rest1.png' });

// Skip the rest.
await click('#btnSkip'); await sleep(150);
eq('skip rest: go sound', await sounds(), ['go']);
u = await ui();
eq('step 2 title', u.title, '2/3  BICEP CURLS');
eq('exercise look back', [u.bg, u.counter], ['#000000', '#ffeb3b']);
elbows = [];
for (let i = 0; i < 8; i++) { elbows.push((await ui()).elbow); await sleep(150); }
check('curls demo during the step', Math.max(...elbows) > 60, JSON.stringify(elbows));

// Step 2: 10 curls with each arm (bare hands).
await page.evaluate(() => { for (const s of ['left', 'right']) Object.assign(fakeXR.hands[s], { kind: 'hand', lost: false, pos: [0, 0.8, -0.2] }); });
await sleep(150);
for (let i = 0; i < 10; i++) { await hands(1.35); await hands(0.8); }
await sleep(150);
eq('curls done: chime', await sounds(), ['done']);
eq('rest again', (await ui()).title, 'REST');

// Full 20 s rest: 3-2-1 countdown then go; "GET READY" for the last 3 s.
await sleep(15500);
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
eq('finish: fanfare only', await sounds(), ['finish']);
eq('complete screen', [u.title, u.rep, u.skip, u.mannequin], ['TRAINING COMPLETE', 'Well done!', false, false]);
await head(1.6);
await click('#btnBack'); await sleep(100);

// Skipping an exercise goes to the rest screen, silently (regression: the
// skipped exercise stayed on screen, still running, during the rest).
await page.evaluate(() => { document.querySelector('#btnBack').emit('click'); document.querySelector('#workoutButtons > *').emit('click'); });
await sleep(200); await sounds();
await click('#btnSkip'); await sleep(200);
u = await ui();
eq('skip exercise: rest screen', [u.title, u.bg, u.counter], ['REST', '#0b3d5c', '#80deea']);
eq('skip exercise: rest says what comes next', u.instr, 'Relax. Next: Bicep Curls, 10 reps. It starts after the countdown.');
check('skip exercise: rest countdown', /^(19|20)s$/.test(u.rep), u.rep);
eq('skip exercise: no sound', await sounds(), []);
elbows = [];
for (let i = 0; i < 6; i++) { elbows.push((await ui()).elbow); await sleep(150); }
check('skip exercise: mannequin idles', elbows.every(e => e >= 10 && e <= 14), JSON.stringify(elbows));

// Single exercise: no Skip, no target.
await page.evaluate(() => document.querySelectorAll('#menuButtons > *')[0].emit('click')); await sleep(150);
u = await ui();
check('single exercise: no skip', !u.skip && u.title === 'SQUATS - Legs', JSON.stringify(u));
await click('#btnBack');

// Paced exercises: a tick per rep, single and in a training set (rest 0: done + go).
await page.evaluate(async () => {
  const { EXERCISES } = await import('/js/exercises/index.js');
  const { paced } = await import('/js/exercises/paced.js');
  EXERCISES.push({ ...paced({ secondsPerRep: 0.4 }), id: 'paced-test', name: 'Paced test', muscle: 'Test',
    color: '#888', instructions: 'Follow the beat.', demo() {} });
});
await sounds();
const app = fn => page.evaluate(fn);
await app(async () => {
  const { exerciseById } = await import('/js/workout-runner.js');
  document.querySelector('#stage').components['gym-app'].startExercise(exerciseById('paced-test'));
});
await sleep(1300);
eq('paced single exercise: 3 ticks in 1.3 s', await sounds(), ['rep', 'rep', 'rep']);
await click('#btnBack');
await app(() => document.querySelector('#stage').components['gym-app'].startWorkout(
  { id: 't', name: 'T', level: 'Test', color: '#888', rest: 0,
    steps: [{ exercise: 'paced-test', reps: 2 }, { exercise: 'paced-test', reps: 2 }] }));
await sleep(2200);
eq('paced training set (no rest)', await sounds(), ['rep', 'rep', 'done', 'go', 'rep', 'rep', 'finish']);

// Broken training sets are rejected with a clear message.
const errs = await app(async () => {
  const { validateWorkout } = await import('/js/workout-runner.js');
  const bad = [
    { id: 'a', steps: [] },
    { id: 'b', steps: [{ exercise: 'pushups', reps: 5 }] },
    { id: 'c', steps: [{ exercise: 'plank', reps: 5 }] },
    { id: 'd', steps: [{ exercise: 'squats', reps: 0 }] },
  ];
  return bad.map(w => { try { validateWorkout(w); return 'accepted'; } catch (e) { return e.message; } });
});
eq('validation messages', errs, ['Training set "a" has no steps',
  'Training set "b", step 1: unknown exercise "pushups"',
  'Training set "c", step 1: "plank" needs seconds, got reps',
  'Training set "d", step 1: target must be > 0']);

for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok ? '' : '   ' + r.info));
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(results.every(r => r.ok) && !errors.length ? 0 : 1);
