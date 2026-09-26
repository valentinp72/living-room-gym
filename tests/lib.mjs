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

// Wait until the scene has rendered `n` more frames. Use it after setting a
// pose, instead of (or on top of) a fixed sleep: on a slow machine (a CI
// runner renders only a few frames per second) a pose held for a fixed time
// can fall between two frames and never be seen by the app.
export const frames = (page, n = 3) => page.evaluate(n => new Promise(resolve => {
  const step = () => (--n <= 0 ? resolve() : requestAnimationFrame(step));
  requestAnimationFrame(step);
}), n);

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
  // $LOW_FPS=N renders pages at about N frames per second, like a slow CI
  // runner with software WebGL, to check that suites don't depend on the
  // frame rate. $CPU_THROTTLE=N also slows scripts down N times.
  const lowFps = Number(process.env.LOW_FPS) || 0;
  const throttle = Number(process.env.CPU_THROTTLE) || 0;
  const newPage = browser.newPage.bind(browser);
  browser.newPage = async () => {
    const page = await newPage();
    if (safetyAccepted) {
      await page.evaluateOnNewDocument(() => { try { localStorage.setItem('living-room-gym-safety-accepted', '1'); } catch (e) {} });
    }
    if (lowFps > 0) {
      await page.evaluateOnNewDocument(fps => {
        let last = 0;
        window.requestAnimationFrame = cb => setTimeout(() => { last = performance.now(); cb(last); }, 1000 / fps);
      }, lowFps);
    }
    if (throttle > 1) await (await page.createCDPSession()).send('Emulation.setCPUThrottlingRate', { rate: throttle });
    return page;
  };
  return browser;
}
