// Shared test helpers: find a Chrome / Chromium and launch it headless with
// software WebGL (A-Frame needs a GL context, even offscreen).
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const CANDIDATES = [
  '/snap/bin/chromium',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];

// $CHROME wins; otherwise the first browser found on disk.
export function chromePath() {
  const path = process.env.CHROME || CANDIDATES.find(p => fs.existsSync(p));
  if (!path) throw new Error('No Chrome / Chromium found: set CHROME=/path/to/chrome');
  return path;
}

// Test clock. Suites never wait for real time: the first frames() or wait()
// on a page takes over A-Frame's render loop, and from then on the test runs
// the frames itself, FRAME_MS apart, with the scene's clock moved by exactly
// that much. A pose held for wait(page, 1500) is seen by the app for 1.5 s,
// whether the machine draws 60 frames per second or 3 (a CI runner with
// software WebGL): results don't depend on the machine's speed. Only the
// last frame of each call is drawn (the others update the scene graph, like
// a draw would), so waits are also quick.
// $LOW_FPS=N steps at 1000 / N ms instead, to check that the app and the
// suites don't depend on the frame rate.
export const FRAME_MS = 1000 / (Number(process.env.LOW_FPS) || 60);

// Run `n` frames on the page.
export const frames = (page, n = 3) => page.evaluate((n, dt) => {
  const scene = document.querySelector('a-scene');
  let c = window.__testClock;
  if (!c) {
    const r = scene.renderer;
    c = window.__testClock = { loop: scene.render, now: scene.time || 0, dt: 0, draw: true };
    r.setAnimationLoop(null);
    r.setAnimationLoop = cb => { c.loop = cb; };   // A-Frame restarts it on exitVR()
    scene.clock = { elapsedTime: c.now / 1000, getDelta: () => c.dt / 1000 };
    const draw = r.render.bind(r);
    r.render = (s, cam) => {
      if (c.draw) return draw(s, cam);
      s.updateMatrixWorld();
      if (cam.parent === null) cam.updateMatrixWorld();
      if (s.onAfterRender) s.onAfterRender(r, s, cam);   // A-Frame's tock
    };
  }
  const run = draw => {
    c.dt = dt; c.now += dt;
    scene.clock.elapsedTime = c.now / 1000;
    c.draw = draw;
    if (c.loop) c.loop(c.now);
  };
  for (let i = 0; i < n - 1; i++) run(false);
  // The last one is drawn in a real animation frame: drawn outside one, it
  // didn't always reach the screen before a screenshot.
  return new Promise(resolve => requestAnimationFrame(() => { run(true); resolve(); }));
}, n, FRAME_MS);

// Let `ms` of the page's time pass (at least one frame).
export const wait = (page, ms) => frames(page, Math.max(1, Math.round(ms / FRAME_MS)));

// Wait until every a-text has its mesh. A-Frame builds it only once the
// font has downloaded (from the CDN), which the scene's load doesn't wait
// for: on a slow runner, texts measured right away had no mesh yet.
export const textReady = page => page.waitForFunction(
  () => [...document.querySelectorAll('a-text')].every(t => t.getObject3D('text')));

// Pages open with the safety notice already accepted, so suites start on
// the menu; launch({ safetyAccepted: false }) to test the notice itself.
// gpu: render with the machine's graphics card instead of SwiftShader (the
// software renderer, used by default so tests run anywhere, CI included).
// SwiftShader draws A-Frame's text (an MSDF font shader) with boxy outlines
// around every letter: fine for tests, not for pictures.
export async function launch({ safetyAccepted = true, gpu = false } = {}) {
  const browser = await puppeteer.launch({
    executablePath: chromePath(), headless: true,
    args: gpu ? ['--no-sandbox', '--enable-gpu', '--use-angle=gl', '--ignore-gpu-blocklist']
      : ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  });
  // $CPU_THROTTLE=N slows scripts down N times (only the speed changes: see
  // the test clock above).
  const throttle = Number(process.env.CPU_THROTTLE) || 0;
  const newPage = browser.newPage.bind(browser);
  browser.newPage = async () => {
    const page = await newPage();
    // Loads and waits get 2 minutes: a busy runner can take over 30 s (the
    // default) to load the page with software WebGL.
    page.setDefaultTimeout(120000);
    page.setDefaultNavigationTimeout(120000);
    if (safetyAccepted) {
      await page.evaluateOnNewDocument(() => { try { localStorage.setItem('living-room-gym-safety-accepted', '1'); } catch (e) {} });
    }
    if (throttle > 1) await (await page.createCDPSession()).send('Emulation.setCPUThrottlingRate', { rate: throttle });
    return page;
  };
  return browser;
}
