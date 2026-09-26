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

// Pages open with the safety notice already accepted, so suites start on
// the menu; launch({ safetyAccepted: false }) to test the notice itself.
export async function launch({ safetyAccepted = true } = {}) {
  const browser = await puppeteer.launch({
    executablePath: chromePath(), headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  });
  if (safetyAccepted) {
    const newPage = browser.newPage.bind(browser);
    browser.newPage = async () => {
      const page = await newPage();
      await page.evaluateOnNewDocument(() => { try { localStorage.setItem('living-room-gym-safety-accepted', '1'); } catch (e) {} });
      return page;
    };
  }
  return browser;
}
