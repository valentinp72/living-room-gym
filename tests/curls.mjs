// Scenario tests for Bicep Curls rep counting (controller tracking is stubbed).
import { launch } from './lib.mjs';
import { installFakeXR } from './fakexr.mjs';

const [url, shot] = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('a-scene')?.hasLoaded, { timeout: 20000 });
await installFakeXR(page);

const rep = () => page.evaluate(() => document.querySelector('#repText').getAttribute('value'));
// Fake WebXR hand state: '#rightHand' / '#leftHand' map to fakeXR sides.
const sideOf = sel => sel === '#rightHand' ? 'right' : 'left';
const track = (sel, on, kind) => page.evaluate((s, on, kind) => {
  const h = fakeXR.hands[s]; h.lost = !on; if (kind) h.kind = kind;
}, sideOf(sel), on, kind);
const hand = async (sel, y) => { await page.evaluate((s, y) => { fakeXR.hands[s].pos[1] = y; }, sideOf(sel), y); await sleep(120); };
const open = async () => {
  await page.evaluate(() => document.querySelector('#btnBack').emit('click'));
  await page.evaluate(() => document.querySelectorAll('#menuButtons > *')[1].emit('click'));
  await sleep(150);
};
// Eyes at 1.6 m: arm down = 0.8 (-0.8), curl top = 1.35 (-0.25).
const curl = async (sel, top = 1.35, bottom = 0.8) => { await hand(sel, top); await hand(sel, bottom); };

const results = [];
const expect = (name, got, want) => results.push({ ok: got === want, name, got, want });
await page.evaluate(() => { document.querySelector('#camera').object3D.position.y = 1.6; });

// 1. No controllers (desktop): moving hands counts nothing.
await open();
await hand('#rightHand', 0.8); await curl('#rightHand');
expect('untracked: no reps + waiting hint', await rep(), 'Left: 0    Right: 0\nShow your hands or controllers');

// 2. Both tracked: arms are counted separately.
await track('#rightHand', true); await track('#leftHand', true);
await hand('#rightHand', 0.8); await hand('#leftHand', 0.8);
await open();
await curl('#rightHand');
await curl('#leftHand'); await curl('#leftHand');
expect('per-arm counting', await rep(), 'Left: 2    Right: 1');
if (shot) await page.screenshot({ path: shot + '-curls.png' });

// 3. Both arms curl together: one rep each, not double counted on one side.
await open();
await page.evaluate(() => { fakeXR.hands.left.pos[1] = fakeXR.hands.right.pos[1] = 1.35; }); await sleep(120);
await page.evaluate(() => { fakeXR.hands.left.pos[1] = fakeXR.hands.right.pos[1] = 0.8; }); await sleep(120);
expect('simultaneous curl', await rep(), 'Left: 1    Right: 1');

// 4. Half curl (hand only reaches -0.55, belly height) is not a rep.
await open();
await curl('#rightHand', 1.05);
expect('half curl ignored', await rep(), 'Left: 0    Right: 0');

// 5. Shallow wiggle at the top doesn't add reps; full curl still counts once.
await open();
await hand('#rightHand', 1.35); await hand('#rightHand', 1.2); await hand('#rightHand', 1.35); await hand('#rightHand', 0.8);
expect('wiggle at top = 1 rep', await rep(), 'Left: 0    Right: 1');

// 6. Tracking lost mid-rep: frozen/moving position is ignored, count kept.
await open();
await curl('#rightHand');
await hand('#rightHand', 1.35);
await track('#rightHand', false);
await hand('#rightHand', 0.8); await hand('#rightHand', 1.35); await hand('#rightHand', 0.8);
expect('lost tracking keeps count, adds none', await rep(), 'Left: 0    Right: 1');
await track('#rightHand', true);
await hand('#rightHand', 0.8); await curl('#rightHand');
expect('tracking regained counts again', await rep(), 'Left: 0    Right: 2');

// 7. Taller user (eyes 1.85, arm down 1.0, top 1.6) and shorter (eyes 1.45).
await page.evaluate(() => { document.querySelector('#camera').object3D.position.y = 1.85; });
await hand('#rightHand', 1.0); await open();
await curl('#rightHand', 1.6, 1.0);
expect('tall user', await rep(), 'Left: 0    Right: 1');
await page.evaluate(() => { document.querySelector('#camera').object3D.position.y = 1.45; });
await hand('#rightHand', 0.72); await open();
await curl('#rightHand', 1.22, 0.72);
expect('short user', await rep(), 'Left: 0    Right: 1');

// 8. Bare hands (wrist joint, no grip space) and mixed hand + controller.
await page.evaluate(() => { document.querySelector('#camera').object3D.position.y = 1.6; });
await track('#rightHand', true, 'hand'); await track('#leftHand', true, 'hand');
await hand('#rightHand', 0.8); await hand('#leftHand', 0.8); await open();
await curl('#rightHand'); await curl('#leftHand');
expect('bare hands', await rep(), 'Left: 1    Right: 1');
await page.evaluate(() => { fakeXR.hands.right.grip = true; });
await track('#leftHand', true, 'controller'); await open();
await curl('#rightHand'); await curl('#rightHand'); await curl('#leftHand');
expect('hand (grip space) + controller', await rep(), 'Left: 1    Right: 2');

for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok ? '' : `  got=${JSON.stringify(r.got)} want=${JSON.stringify(r.want)}`));
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(results.every(r => r.ok) && !errors.length ? 0 : 1);
