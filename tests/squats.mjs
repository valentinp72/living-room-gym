// Scenario tests for Squats rep counting (XR mode is simulated via scene states).
import { launch } from './lib.mjs';

const [url] = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('a-scene')?.hasLoaded, { timeout: 20000 });

const rep = () => page.evaluate(() => document.querySelector('#repText').getAttribute('value'));
const head = async (y, ms = 150) => { await page.evaluate(y => { document.querySelector('#camera').object3D.position.y = y; }, y); await sleep(ms); };
const state = (name, on) => page.evaluate((n, on) => { const s = document.querySelector('a-scene'); on ? s.addState(n) : s.removeState(n); }, name, on);
const open = async () => {
  await page.evaluate(() => document.querySelector('#btnBack').emit('click'));
  await page.evaluate(() => document.querySelectorAll('#menuButtons > *')[0].emit('click'));
  await sleep(100);
};
const squat = async (bottom, top) => { await head(bottom); await head(top); };

const results = [];
const expect = (name, got, want) => results.push({ ok: got === want, name, got, want });

// 1. Flat page: calibrates after standing still ~1 s, then counts.
await head(1.6, 50); await open();
expect('shows calibration prompt first', await rep(), 'Stand still...');
await sleep(1300);
expect('calibrated on flat page', await rep(), 'Reps: 0');
await squat(1.3, 1.58);
expect('flat page squat counts', await rep(), 'Reps: 1');

// 2. Head moving during calibration: never calibrates.
await open();
for (let i = 0; i < 10; i++) await head(i % 2 ? 1.6 : 1.5, 150);
expect('moving head blocks calibration', await rep(), 'Stand still...');

// 3. Entering VR while on the squats screen (the original bug): the flat-page
//    baseline (1.6) must be dropped and the real height (1.8) used instead.
await head(1.6, 1300);
expect('calibrated before VR', await rep(), 'Reps: 0');
await state('vr-mode', true);
await head(1.8, 100);
expect('entering VR recalibrates', await rep(), 'Stand still...');
await sleep(1300);
await squat(1.62, 1.78);
expect('shallow dip vs real height ignored', await rep(), 'Reps: 0');
await squat(1.5, 1.78);
expect('real squat in VR counts', await rep(), 'Reps: 1');

// 4. Calibrated slightly crouched, then standing tall raises the baseline.
await open();
await head(1.7, 1300);
await head(1.8);
await squat(1.53, 1.79);
expect('baseline follows standing up taller', await rep(), 'Reps: 1');
await squat(1.62, 1.79);
expect('half squat ignored', await rep(), 'Reps: 1');

// 5. Leaving VR recalibrates again.
await state('vr-mode', false);
await head(1.6, 100);
expect('exiting VR recalibrates', await rep(), 'Stand still...');

// 6. AR mode counts as immersive too.
await sleep(1300);
await state('ar-mode', true);
await head(1.7, 100);
expect('entering AR recalibrates', await rep(), 'Stand still...');
await state('ar-mode', false);

for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok ? '' : `  got=${JSON.stringify(r.got)} want=${JSON.stringify(r.want)}`));
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(results.every(r => r.ok) && !errors.length ? 0 : 1);
