import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const version = readFileSync('VERSION', 'utf8').trim();
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const changelog = readFileSync('CHANGELOG.md', 'utf8');
const valid = /^([0-9]+)\.([0-9]+)\.([0-9]+)$/.exec(version);
if (!valid) throw new Error('VERSION must use X.Y.Z SemVer');
if (pkg.version !== version) throw new Error('VERSION and package.json must match');
if (!changelog.includes('## [' + version + ']')) throw new Error('CHANGELOG.md lacks release section ' + version);
const previousRef = process.argv[2];
if (previousRef && !/^0+$/.test(previousRef)) {
  let previous = '';
  try { previous = execFileSync('git', ['show', previousRef + ':VERSION'], { encoding:'utf8' }).trim(); } catch {}
  if (previous) {
    const old = /^([0-9]+)\.([0-9]+)\.([0-9]+)$/.exec(previous);
    if (!old) throw new Error('Previous version is invalid');
    const numeric = value => value.slice(1).map(Number);
    const cur = numeric(valid), prev = numeric(old);
    const increased = cur[0]>prev[0] || cur[0]===prev[0]&&(cur[1]>prev[1]||cur[1]===prev[1]&&cur[2]>prev[2]);
    if (!increased) throw new Error('Every new deploy must increase VERSION: ' + previous + ' → ' + version);
  }
}
console.log('Release check OK:', version);
