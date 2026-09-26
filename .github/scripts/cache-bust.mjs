// Cache busting for the deployed copy of the app (the source in www/ stays
// untouched and build-free). GitHub Pages lets browsers cache files for up
// to 10 minutes, and browsers cache each ES module separately: right after
// a deploy, a visitor could run a mix of old and new modules. Adding the
// version to every local link (?v=<version>) makes each deploy load as a
// whole.
// Usage: node cache-bust.mjs <dir> <version>   (rewrites files in <dir>)
import fs from 'node:fs';
import path from 'node:path';

const [dir, version] = process.argv.slice(2);
if (!dir || !version) { console.error('Usage: node cache-bust.mjs <dir> <version>'); process.exit(2); }
const v = encodeURIComponent(version);

// import x from './a.js' / export ... from '../b.js' / import './c.js' / import('./d.js')
const JS_IMPORT = /(\bfrom\s*|\bimport\s*\(?\s*)(['"])(\.{1,2}\/[^'"?]+?\.js)\2/g;
// <script src="js/main.js">, <link href="css/app.css"> (local files only)
const HTML_LINK = /\b(src|href)="(?![a-z]+:|\/\/|#)([^"?]+\.(?:js|css))"/g;

const files = [];
const walk = d => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else files.push(p);
  }
};
walk(dir);

let links = 0;
for (const file of files) {
  const ext = path.extname(file);
  if (ext !== '.js' && ext !== '.html') continue;
  const before = fs.readFileSync(file, 'utf8');
  const after = ext === '.js'
    ? before.replace(JS_IMPORT, (m, lead, q, spec) => { links++; return `${lead}${q}${spec}?v=${v}${q}`; })
    : before.replace(HTML_LINK, (m, attr, url) => { links++; return `${attr}="${url}?v=${v}"`; });
  if (after !== before) fs.writeFileSync(file, after);
}
console.log(`cache-bust: ${links} links in ${files.length} files now carry ?v=${version}`);
