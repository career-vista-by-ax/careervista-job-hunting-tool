import {readFileSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,join,isAbsolute} from 'node:path';
const registration=JSON.parse(readFileSync(new URL('../installation.json',import.meta.url),'utf8'));
if(typeof registration.root!=='string'||!isAbsolute(registration.root)||typeof registration.installationId!=='string')throw new Error('Skill registration is missing its installation identity. Register the skill again.');
const manifest=JSON.parse(readFileSync(join(registration.root,'state/installation.json'),'utf8'));
if(manifest.format!=='careervista-installation'||manifest.id!==registration.installationId||manifest.root!==registration.root||typeof manifest.active!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(manifest.active)||manifest.active.includes('..'))throw new Error('The registered installation is missing, uninstalled or has changed identity.');
const release=manifest.releases[manifest.active];
if(!release||!['runtime/node','runtime/node.exe'].includes(release.runtime)||release.entry!=='app/dist/main.js')throw new Error('Unsupported active package.');
const base=join(registration.root,'releases',manifest.active);
for(const name of [release.runtime,'app/dist/lifecycle.js']){
 const path=join(base,name);if(lstatSync(path).isSymbolicLink()||createHash('sha256').update(readFileSync(path)).digest('hex')!==release.files[name])throw new Error('The active package failed verification. Repair the installation before launching.');
}
const result=execFileSync(join(base,release.runtime),[join(base,'app/dist/lifecycle.js'),'launch','--root',registration.root],{encoding:'utf8',timeout:20000});
const value=JSON.parse(result);const url=new URL(value.url);
if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password)throw new Error('Launcher did not return a local app URL.');
console.log(JSON.stringify({url:url.origin,alreadyRunning:value.alreadyRunning,root:registration.root}));
