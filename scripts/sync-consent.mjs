import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const source = readFileSync(new URL('../docs/user-consent.md', import.meta.url), 'utf8');
const check = process.argv.includes('--check');
for (const skill of ['careervista-job-search', 'careervista-capture', 'ax-cv', 'ax-30-secs']) {
  const directory = new URL(`../agent-skills/v1/${skill}/references/`, import.meta.url);
  const path = new URL('user-consent.md', directory);
  if (check) {
    if (readFileSync(path, 'utf8') !== source) throw new Error(`${skill} consent is out of date; run node scripts/sync-consent.mjs.`);
  } else {
    mkdirSync(directory, { recursive: true });
    writeFileSync(path, source);
  }
}
console.log(check ? 'All standalone skill consent notices match the source.' : 'Updated standalone skill consent notices.');
