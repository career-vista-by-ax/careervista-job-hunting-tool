import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,existsSync,cpSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {packageRelease} from '../scripts/package-release.mjs';

test('the native Mac archive contains the tested runtime, full notices, compiled UI and versioned skills without build tools',{skip:process.platform!=='darwin'||process.arch!=='arm64'},async()=>{
 assert.equal(process.versions.node,'26.12.0','Run distribution acceptance with the exact pinned Node binary.');
 const root=mkdtempSync(join(tmpdir(),'cv-release-'));
 try{
  const dist=join(root,'compiled');execFileSync(process.execPath,['node_modules/typescript/bin/tsc','--outDir',dist]);
  cpSync('src/migrations',join(dist,'migrations'),{recursive:true});for(const name of ['index.html','style.css'])cpSync(`src/public/${name}`,join(dist,'public',name));
  const runtimeRoot=dirname(dirname(process.execPath));
  const result=await packageRelease({runtimeRoot,dist,output:join(root,'output'),version:'0.1.0-test'});
  await assert.rejects(packageRelease({runtimeRoot,dist,output:join(root,'output'),version:'0.1.0-test'}),/exists/);
  const extract=join(root,'extracted release');mkdirSync(extract);execFileSync('/usr/bin/tar',['-xzf',result.archive,'-C',extract]);
  const bundle=join(extract,'CareerVista-0.1.0-test-macos-arm64');
  const release=JSON.parse(readFileSync(join(bundle,'release.json'),'utf8'));
  assert.equal(release.nodeVersion,'26.12.0');assert.equal(readFileSync(join(bundle,'runtime/LICENSE'),'utf8'),readFileSync(join(runtimeRoot,'LICENSE'),'utf8'));
  assert.ok(release.files['app/dist/public/workspace-ui.js']);assert.ok(release.files['agent-skills/v1/careervista-capture/SKILL.md']);
  for(const [path,digest]of Object.entries(release.files))assert.equal(createHash('sha256').update(readFileSync(join(bundle,path))).digest('hex'),digest);
  assert.equal(existsSync(join(bundle,'node_modules')),false);assert.equal(existsSync(join(bundle,'runtime/npm')),false);
  assert.match(readFileSync(join(bundle,'CareerVista.command'),'utf8'),/runtime\/node/);
  for(const [path,digest]of Object.entries(release.archiveFiles))assert.equal(createHash('sha256').update(readFileSync(join(bundle,path))).digest('hex'),digest);
  const profile=join(root,'offline.sb');writeFileSync(profile,'(version 1)(allow default)(deny network*)(allow network-bind (local ip "localhost:*"))(allow network-inbound (local ip "localhost:*"))(allow network-outbound (remote ip "localhost:*"))');
  const env={...process.env,PATH:join(root,'no-development-tools'),NODE_OPTIONS:'',NODE_PATH:''};
  const external=execFileSync('/usr/bin/sandbox-exec',['-f',profile,join(bundle,'runtime/node'),'-e',`fetch('http://1.1.1.1',{signal:AbortSignal.timeout(1000)}).then(()=>process.exit(1)).catch(error=>console.log(error.cause?.code))`],{env,encoding:'utf8'}).trim();assert.match(external,/EPERM|EACCES/,'The acceptance sandbox must block external network access.');
  const installRoot=join(root,'separate private installation'),launcher=join(bundle,'CareerVista.command');
  const cli=(...args:string[])=>JSON.parse(execFileSync('/usr/bin/sandbox-exec',['-f',profile,launcher,'--root',installRoot,...args],{env,encoding:'utf8',timeout:20000}));
  let launched:any;
  try{
   launched=cli('--no-browser');assert.match(launched.url,/^http:\/\/127\.0\.0\.1:/);
   const screen=await fetch(launched.url);assert.equal(screen.status,200);assert.match(await screen.text(),/workspace-controls/);
   assert.equal((await fetch(`${launched.url}/workspace-ui.js`)).status,200);
   const cvSkill=await(await fetch(`${launched.url}/api/v1/agent-guide/ax-cv`)).json();assert.equal(cvSkill.markdown,readFileSync(join(bundle,'agent-skills/v1/ax-cv/SKILL.md'),'utf8'));
   const saved=await fetch(`${launched.url}/api/v1/observations`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ingestionId:'offline-nurse',title:'Nurse',company:'Offline clinic',source:'manual',sourceUrl:'https://example.com/nurse',capturedAt:'2026-10-18T00:00:00Z',text:'Original synthetic evidence retained without external access.'})});assert.equal(saved.status,201);
   const listing=await saved.json();assert.equal(cli('--no-browser').alreadyRunning,true);
   const before=cli('storage').totalBytes;assert.equal(before,0);
   assert.equal(cli('stop').stopped,true);
   launched=cli('launch','--no-browser');assert.equal((await(await fetch(`${launched.url}/api/v1/jobs/${listing.job.id}`)).json()).observations[0].text,'Original synthetic evidence retained without external access.');
   cli('stop');
   const broken=join(root,'corrupted bundle');cpSync(bundle,broken,{recursive:true});writeFileSync(join(broken,'app/dist/main.js'),'corrupted');
   assert.throws(()=>execFileSync(join(broken,'CareerVista.command'),['install','--root',installRoot],{env,encoding:'utf8',stdio:['ignore','pipe','pipe']}),/checksum/);
   assert.equal(cli('status').installed,true);assert.equal(cli('install').installed,true);
   assert.equal(cli('uninstall').keptData,true);assert.ok(existsSync(join(installRoot,'data/careervista.sqlite')));
   assert.equal(cli('install').installed,true);launched=cli('launch','--no-browser');assert.equal((await(await fetch(`${launched.url}/api/v1/jobs`)).json())[0].id,listing.job.id);
   cli('stop');
   const upgraded=join(root,'upgraded bundle');cpSync(bundle,upgraded,{recursive:true});const upgradedManifest=JSON.parse(readFileSync(join(upgraded,'release.json'),'utf8'));upgradedManifest.version='0.2.0-test';
   const migration='app/dist/migrations/020-upgrade-acceptance.sql';writeFileSync(join(upgraded,migration),'CREATE TABLE upgrade_acceptance (id INTEGER PRIMARY KEY);');upgradedManifest.files[migration]=createHash('sha256').update(readFileSync(join(upgraded,migration))).digest('hex');writeFileSync(join(upgraded,'release.json'),JSON.stringify(upgradedManifest));
   const upgradeCli=(...args:string[])=>JSON.parse(execFileSync('/usr/bin/sandbox-exec',['-f',profile,join(upgraded,'CareerVista.command'),'--root',installRoot,...args],{env,encoding:'utf8',timeout:20000}));
   launched=upgradeCli('upgrade','--no-browser');assert.equal(upgradeCli('status').active,'0.2.0-test');assert.equal(upgradeCli('upgrade','--no-browser').alreadyRunning,true);assert.equal((await(await fetch(`${launched.url}/api/v1/jobs`)).json())[0].id,listing.job.id);upgradeCli('stop');
   const failedUpgrade=join(root,'invalid migration bundle');cpSync(upgraded,failedUpgrade,{recursive:true});const failedManifest=JSON.parse(readFileSync(join(failedUpgrade,'release.json'),'utf8'));failedManifest.version='0.3.0-test';const failedMigration='app/dist/migrations/021-invalid-upgrade.sql';writeFileSync(join(failedUpgrade,failedMigration),'CREATE TABLE rolled_back (id INTEGER); INVALID SQL;');failedManifest.files[failedMigration]=createHash('sha256').update(readFileSync(join(failedUpgrade,failedMigration))).digest('hex');writeFileSync(join(failedUpgrade,'release.json'),JSON.stringify(failedManifest));
   assert.throws(()=>execFileSync(join(failedUpgrade,'CareerVista.command'),['install','--root',installRoot],{env,encoding:'utf8',stdio:['ignore','pipe','pipe']}),/migration|syntax|SQL/i);assert.equal(upgradeCli('status').active,'0.2.0-test');
   launched=upgradeCli('launch','--no-browser');assert.equal((await(await fetch(`${launched.url}/api/v1/jobs`)).json())[0].id,listing.job.id);upgradeCli('stop');
   assert.throws(()=>cli('install'),/newer|unknown|Downgrade|migration/i);assert.equal(upgradeCli('status').active,'0.2.0-test');
   assert.equal(cli('uninstall','--remove-data','--confirm','REMOVE_OWNED_DATA').keptData,false);assert.equal(existsSync(join(installRoot,'data')),false);
   assert.equal(existsSync(join(installRoot,'releases',release.version)),false);assert.ok(existsSync(join(bundle,'runtime/node')),'Extracted download is a separate copy.');
  }finally{try{cli('stop');}catch{}}

 }finally{rmSync(root,{recursive:true,force:true});}
});
