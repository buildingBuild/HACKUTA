// TEMPORARY: server/src and web/src live outside sandbox/, so Node/Vite can't
// find sandbox/node_modules from there. Link server/node_modules and
// web/node_modules to it (junctions on Windows, gitignored via .git/info/exclude).
// Remove these links once Joe's scaffold has its own package.json files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(here, 'node_modules');

for (const dir of ['server', 'web']) {
  const link = path.join(here, '..', dir, 'node_modules');
  if (fs.existsSync(link)) {
    console.log(`skip: ${link} already exists`);
    continue;
  }
  fs.symlinkSync(target, link, 'junction');
  console.log(`linked ${link} -> ${target}`);
}
