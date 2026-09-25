// Rep detection for the headset-tracked floor and standing exercises
// (crunches, push-ups, knee push-ups, lunges), paced exercises, and the
// counter shown above the face when lying on the back.
import { launch } from './lib.mjs';
const [url] = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('a-scene')?.hasLoaded, { timeout: 20000 });
await page.evaluate(() => document.querySelector('#camera').setAttribute('look-controls', 'enabled: false'));

// Head pose: height (m) and pitch (degrees, + = looking up).
const head = async (y, pitch = 0, ms = 120) => {
  await page.evaluate((y, pitch) => {
    const o = document.querySelector('#camera').object3D;
    o.position.set(0, y, 0); o.rotation.set(pitch * Math.PI / 180, 0, 0, 'YXZ');
  }, y, pitch);
  await sleep(ms);
};
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
await head(0.6, -75); await head(0.35, -80); await head(0.35, 0, 200); await head(0.35, -80); await head(0.6, -75);
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

for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok ? '' : `  got=${JSON.stringify(r.got)} want=${JSON.stringify(r.want)}`));
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(results.every(r => r.ok) && !errors.length ? 0 : 1);
