import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, rmdirSync, realpathSync, lstatSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const args = process.argv.slice(2), mode = args[0], targetIndex = args.indexOf('--target');
if (!['--install', '--uninstall'].includes(mode) || targetIndex < 0 || !args[targetIndex + 1]) throw new Error('Usage: node scripts/register-agent-skills.mjs --install|--uninstall --target <host-skills-directory>');
const target = resolve(args[targetIndex + 1]);
mkdirSync(target, { recursive: true });
const canonical = realpathSync(target), name = 'careervista-capture', folder = join(canonical, name);
const manifestPath = join(canonical, '.careervista-skills-v1.json');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const filenames = ['SKILL.md', 'interface.md'];
const source = fileURLToPath(new URL('../agent-skills/v1/careervista-capture/', import.meta.url));
let manifest;
if (existsSync(manifestPath)) {
  if (lstatSync(manifestPath).isSymbolicLink()) throw new Error('Registration manifest must be a regular file.');
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.owner !== 'careervista' || manifest.version !== 1 || manifest.target !== canonical || !manifest.files || Object.keys(manifest.files).some(file => !filenames.includes(file))) throw new Error('Unrecognised registration manifest; preserve it and inspect manually.');
}
if (existsSync(folder) && lstatSync(folder).isSymbolicLink()) throw new Error('Owned skill directory must not be a symlink.');
if (mode === '--install') {
  if (existsSync(folder) && !manifest) throw new Error('Existing skill entry is not owned by this registration. Choose another target or inspect manually.');
  for (const file of filenames) if (existsSync(join(folder, file)) && (!manifest?.files[file] || lstatSync(join(folder, file)).isSymbolicLink() || hash(readFileSync(join(folder, file))) !== manifest.files[file])) throw new Error(`Preserving changed or unrelated file: ${file}`);
  mkdirSync(folder, { recursive: true });
  const next = { owner: 'careervista', version: 1, target: canonical, files: {} };
  // Register intended content before writing so an interrupted setup remains attributable.
  for (const file of filenames) next.files[file] = hash(readFileSync(join(source, file)));
  writeFileSync(manifestPath, JSON.stringify(next, null, 2), { mode: 0o600 });
  for (const file of filenames) writeFileSync(join(folder, file), readFileSync(join(source, file)), { mode: 0o600 });
  console.log(`Registered CareerVista capture skill v1 in ${folder}. Reload your agent host's skills.`);
} else if (manifest) {
  const retained = [];
  for (const file of Object.keys(manifest.files)) {
    const path = join(folder, file);
    if (!existsSync(path)) { delete manifest.files[file]; continue; }
    if (lstatSync(path).isSymbolicLink() || hash(readFileSync(path)) !== manifest.files[file]) { retained.push(file); continue; }
    unlinkSync(path); delete manifest.files[file];
  }
  if (Object.keys(manifest.files).length) writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), { mode: 0o600 });
  else { unlinkSync(manifestPath); try { rmdirSync(folder); } catch {} }
  console.log(retained.length ? `Preserved modified files: ${retained.join(', ')}. Ownership manifest retained.` : 'Removed unchanged owned skill files. Other skills and browser sessions were preserved.');
} else console.log('No CareerVista registration found. Nothing removed.');
