import { launch } from '/home/valentin/git/vr-muscle/tests/lib.mjs';
const b = await launch(); const page = await b.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
await page.goto(process.argv[2], { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('a-scene')?.hasLoaded);
await new Promise(r => setTimeout(r, 500));
console.log(await page.evaluate(() => { const parts = [...document.querySelectorAll('#mannequin .part')]; return { parts: parts.length, withMesh: parts.filter(p => p.getObject3D('mesh')).length }; }), errs.slice(0, 2));
await b.close();
