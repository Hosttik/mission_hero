import { mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const out = resolve('dist');
await mkdir(out, { recursive: true });
for (const name of ['index.html', 'app.js', 'engine.js', 'VERSION']) {
  await copyFile(resolve(name), resolve(out, name));
}
console.log('Built static GitHub Pages site in dist/');
