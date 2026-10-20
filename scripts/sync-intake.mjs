import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// One policy source, carried by both independently installable skills.
const source = readFileSync(new URL('../docs/agent-intake.md', import.meta.url), 'utf8');
const check = process.argv.includes('--check');
for (const skill of ['careervista-job-search', 'careervista-capture']) {
  const directory = new URL(`../agent-skills/v1/${skill}/`, import.meta.url);
  const path = new URL('intake.md', directory);
  if (check) {
    if (readFileSync(path, 'utf8') !== source) throw new Error(`${skill} intake is out of date; run node scripts/sync-intake.mjs.`);
  } else {
    mkdirSync(directory, { recursive: true });
    writeFileSync(path, source);
  }
}
console.log(check ? 'Standalone skill intake policies match docs/agent-intake.md.' : 'Updated standalone skill intake policies.');
