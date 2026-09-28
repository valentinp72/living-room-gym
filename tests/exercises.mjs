// Rep detection for the headset-tracked floor and standing exercises
// (crunches, push-ups, knee push-ups, lunges), paced exercises, and the
// counter shown above the face when lying on the back.
import { launch, frames } from './lib.mjs';
const [url] = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('a-scene')?.hasLoaded, { timeout: 20000 });
await page.evaluate(() => document.querySelector('#camera').setAttribute('look-controls', 'enabled: false'));

// Head pose: height (m), pitch (degrees, + = looking up) and roll
// (degrees, head tilted toward a shoulder).
const head = async (y, pitch = 0, ms = 120, roll = 0) => {
  await page.evaluate((y, pitch, roll) => {
    const o = document.querySelector('#camera').object3D;
    o.position.set(0, y, 0); o.rotation.set(pitch * Math.PI / 180, 0, roll * Math.PI / 180, 'YXZ');
  }, y, pitch, roll);
  await sleep(ms);
  await frames(page, 2);
};
const secs = (text, key) => { const m = text.match(new RegExp(key + ': ([\\d.]+)s')); return m ? parseFloat(m[1]) : null; };
const label = () => page.evaluate(() => document.querySelector('#repText').getAttribute('value'));
const open = async id => {
  await page.evaluate(id => {
    document.querySelector('#btnBack').emit('click');
    const app = document.querySelector('#stage').components['gym-app'];
    const i = app.pages.single.items.findIndex(ex => ex.id === id);
    document.querySelectorAll('#menuButtons > *')[i].emit('click');
  }, id);
  await sleep(100);
};

const results = [];
const expect = (name, got, want) => results.push({ ok: got === want, name, got, want });
const check = (name, ok, got) => results.push({ ok, name, got, want: '(see check)' });

// Crunches: lying on the back = head low, looking up.
await head(1.6); await open('crunches');
expect('crunches: asks to lie down', await label(), 'Lie on your back');
await head(0.2, 80);
expect('crunches: lying = ready', await label(), 'Reps: 0');
for (let i = 0; i < 3; i++) { await head(0.38, 50); await head(0.2, 80); }
expect('crunches: 3 crunches', await label(), 'Reps: 3');
await head(0.27, 70); await head(0.2, 80);
expect('crunches: head nod ignored', await label(), 'Reps: 3');
// Counter floats above the face, facing it.
const above = await page.evaluate(() => {
  const o = document.querySelector('#floorLabel').object3D, h = document.querySelector('#camera').object3D;
  return { visible: o.visible, dy: +(o.position.y - h.position.y).toFixed(2), same: o.quaternion.angleTo(h.quaternion) < 1e-3 };
});
expect('crunches: counter above the face', JSON.stringify(above), JSON.stringify({ visible: true, dy: 0.69, same: true }));
// Standing and looking up while bobbing: never a crunch.
await head(1.6); await open('crunches');
for (let i = 0; i < 3; i++) { await head(1.6, 60); await head(1.3, 60); }
expect('crunches: standing, looking up: nothing', await label(), 'Lie on your back');
// Sitting up and lying down again isn't a crunch either.
await head(0.2, 80); await head(1.0, 0); await head(0.2, 80);
expect('crunches: sitting up resets', await label(), 'Reps: 0');

// Push-ups (and knee push-ups): face down, head low.
for (const id of ['push-ups', 'knee-push-ups']) {
  await head(1.6); await open(id);
  expect(id + ': asks for position', await label(), 'Get into push-up position');
  await head(0.6, -75);
  for (let i = 0; i < 4; i++) { await head(0.35, -80); await head(0.6, -75); }
  expect(id + ': 4 push-ups', await label(), 'Reps: 4');
  await head(0.5, -75); await head(0.6, -75);
  expect(id + ': shallow dip ignored', await label(), 'Reps: 4');
}
// Looking down while standing / bending over: not a push-up.
await head(1.6); await open('push-ups');
for (let i = 0; i < 3; i++) { await head(1.6, -80); await head(1.2, -80); }
expect('push-ups: standing, looking down: nothing', await label(), 'Get into push-up position');
// Looking up for a moment (under 0.5 s) at the bottom keeps the rep.
await head(0.6, -75); await head(0.35, -80);
// The glance itself: 200 ms, without waiting for frames (it must stay under 0.5 s).
await page.evaluate(() => document.querySelector('#camera').object3D.rotation.set(0, 0, 0, 'YXZ')); await sleep(200);
await head(0.35, -80); await head(0.6, -75);
expect('push-ups: short glance keeps the rep', await label(), 'Reps: 1');

// Lunges: same head-dip detection as squats.
await head(1.6); await open('lunges');
expect('lunges: calibrates first', await label(), 'Stand still...');
await sleep(1300);
await head(1.3); await head(1.58);
await head(1.3); await head(1.58);
expect('lunges: 2 lunges', await label(), 'Reps: 2');

// Paced: the app counts at its tempo (calf raises: one every 2 s).
await head(1.6); await open('calf-raises');
await sleep(2300);
expect('calf raises: paced', await label(), 'Follow the beat: 1');

// Head-dip exercises added with equipment: calibrate at the top, then the
// head goes down by their depth and back.
for (const [id, top, depth, still] of [['chair-squats', 1.6, 0.33, 'Stand still...'], ['split-squats-left', 1.6, 0.23, 'Stand still...'],
  ['goblet-squats', 1.6, 0.28, 'Stand still...'], ['romanian-deadlifts', 1.6, 0.33, 'Stand still...'],
  ['chair-dips', 1.0, 0.17, 'Hold still at the top...']]) {
  await head(top); await open(id);
  expect(id + ': calibrates first', await label(), still);
  await sleep(1300);
  for (let i = 0; i < 2; i++) { await head(top - depth); await head(top - 0.02); }
  expect(id + ': 2 reps', await label(), 'Reps: 2');
  await head(top - depth + 0.06); await head(top - 0.02);
  expect(id + ': too shallow ignored', await label(), 'Reps: 2');
}

// Incline push-ups: face down toward the chair, head higher than on the floor.
await head(1.6); await open('incline-push-ups');
await head(1.1, -60);
for (let i = 0; i < 3; i++) { await head(0.95, -65); await head(1.1, -60); }
expect('incline push-ups: 3 reps', await label(), 'Reps: 3');
await head(1.6); await open('incline-push-ups');
for (let i = 0; i < 3; i++) { await head(1.6, -80); await head(1.4, -80); }
expect('incline push-ups: standing, looking down: nothing', await label(), 'Get into push-up position');

// Wall sit: after the standing calibration, head 18-80 cm lower and looking ahead.
await head(1.6); await open('wall-sit');
expect('wall sit: calibrates first', await label(), 'Stand still...');
await sleep(1300);
expect('wall sit: prompt', await label(), 'Slide down the wall');
await head(1.15, 0, 1600);
check('wall sit: holding', secs(await label(), 'Hold') >= 0.5, await label());
// A shallower sit counts too (regression: 30 cm lower was needed, too deep).
await head(1.6, 0, 1400); await head(1.4, 0, 1600);
check('wall sit: 20 cm lower counts', secs(await label(), 'Hold') >= 0.5, await label());
await head(1.6, 0, 1400);
check('wall sit: standing up ends the hold', /^Head lower/.test(await label()) || /^Last: /.test(await label()), await label());
await head(1.6, 0, 300);
await head(1.15, -80, 1600);
check('wall sit: bent over is not a wall sit', /^Look ahead/.test(await label()), await label());

// Side plank: head low, tilted to the side, looking ahead. A positive roll
// puts the head's right up: lying on the left side.
await head(1.6); await open('side-plank-left');
expect('side plank: prompt', await label(), 'Get into a side plank');
await head(0.5, 0, 1600, 70);
check('side plank: holding', secs(await label(), 'Hold') >= 0.5, await label());
await head(0.3, 0, 1400, 70);
check('side plank: dropping the hips ends it', !/^Hold/.test(await label()), await label());
await head(1.6, 0, 300);
await head(0.4, -80, 1600);
check('side plank: a regular plank is not one', /^Face forward/.test(await label()), await label());
await head(0.2, 80, 1600, 0);
check('side plank: lying on the back is not one', !/^Hold/.test(await label()), await label());
// One exercise per side: the other side doesn't count, and says so.
await head(1.6, 0, 300);
await head(0.5, 0, 1600, -70);
check('side plank (left): on the right side, a hint', (await label()).startsWith('Lie on your left side'), await label());
await head(1.6, 0, 300); await open('side-plank-right');
await head(0.5, 0, 1600, -70);
check('side plank (right): holding', secs(await label(), 'Hold') >= 0.5, await label());
await head(1.6, 0, 300);
await head(0.5, 0, 1600, 70);
check('side plank (right): on the left side, a hint', (await label()).startsWith('Lie on your right side'), await label());
// Regression (Quest): a head held more upright than the body, looking a bit
// down, still counts, and the counter floats in front of the face instead of
// lying on the floor (looking down at it made the side plank fail).
await head(1.6, 0, 300); await open('side-plank-left');
await head(0.45, -25, 1600, 45);
check('side plank: head tilted only 45 deg, looking a bit down', secs(await label(), 'Hold') >= 0.5, await label());
const faceLabel = () => page.evaluate(() => {
  const o = document.querySelector('#floorLabel').object3D, h = document.querySelector('#camera').object3D;
  return { visible: o.visible, dist: +o.position.distanceTo(h.position).toFixed(2), facing: o.quaternion.angleTo(h.quaternion) < 1e-3 };
});
expect('side plank: counter in front of the face', JSON.stringify(await faceLabel()), JSON.stringify({ visible: true, dist: 0.7, facing: true }));

// Near the exercise panel (leaning over a chair toward it), the counter shows
// by the face (regression: the panel was too close to read).
await head(1.6, 0, 300); await open('incline-push-ups');
expect('near panel: no face counter from the usual spot', (await faceLabel()).visible, false);
await page.evaluate(() => { const o = document.querySelector('#camera').object3D; o.position.set(0, 1.1, -1.5); o.rotation.set(-0.8, 0, 0, 'YXZ'); });
await sleep(150);
expect('near panel: counter by the face', JSON.stringify(await faceLabel()), JSON.stringify({ visible: true, dist: 0.7, facing: true }));

for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok ? '' : `  got=${JSON.stringify(r.got)} want=${JSON.stringify(r.want)}`));
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(results.every(r => r.ok) && !errors.length ? 0 : 1);
