import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, existsSync, cpSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { packageRelease } from '../scripts/package-release.mjs';

test('Windows zip installs, starts and upgrades with its own runtime and preserves data during removal', {skip:process.platform!=='win32'||process.arch!=='x64',timeout:120_000}, async()=>{
  const root=mkdtempSync(join(tmpdir(),'cv windows acceptance '));
  let cli:(...args:string[])=>any = ()=>{};
  try {
    const result=await packageRelease({output:join(root,'output'),version:'0.1.0-windows-test'});
    const extract=join(root,'extracted archive');mkdirSync(extract);execFileSync('tar.exe',['-xf',result.archive,'-C',extract]);
    const bundle=join(extract,'CareerVista-0.1.0-windows-test-windows-x64');
    const manifest=JSON.parse(readFileSync(join(bundle,'release.json'),'utf8'));
    assert.equal(manifest.runtime,'runtime/node.exe');assert.ok(existsSync(join(bundle,'CareerVista.cmd')));
    assert.match(readFileSync(join(bundle,'README.txt'),'utf8'),/LOCALAPPDATA/);
    assert.match(readFileSync(join(bundle,'README.txt'),'utf8'),/agent/);
    for(const [path,digest] of Object.entries({...manifest.files,...manifest.archiveFiles})) assert.equal(createHash('sha256').update(readFileSync(join(bundle,path))).digest('hex'),digest);
    const installRoot=join(root,'private installation with spaces');
    const env={...process.env,PATH:join(root,'no development tools'),NODE_OPTIONS:'',NODE_PATH:''};
    // Invoke the actual cmd wrapper; its runtime, not a developer PATH, starts the app.
    cli=(...args:string[])=>JSON.parse(execFileSync(process.env.ComSpec??'C:\\Windows\\System32\\cmd.exe',['/d','/s','/c',`""${join(bundle,'CareerVista.cmd')}" --root "${installRoot}" ${args.map(arg=>`"${arg}"`).join(' ')}"`],{env,encoding:'utf8',timeout:30_000,windowsVerbatimArguments:true,windowsHide:true}));
    const launched=cli('open','--no-browser');assert.match(launched.url,/^http:\/\/127\.0\.0\.1:/);assert.equal(cli('open','--no-browser').alreadyRunning,true);
    assert.equal((await fetch(launched.url)).status,200);
    const workflow=await(await fetch(`${launched.url}/api/v1/agent-guide/agent-intake`)).json() as {markdown:string};assert.match(workflow.markdown,/one question at a time/i);
    const savedResponse=await fetch(`${launched.url}/api/v1/observations`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ingestionId:'windows-nurse',title:'Nurse',company:'Test clinic',source:'manual',sourceUrl:'https://example.com/windows',capturedAt:'2026-10-19T00:00:00Z',text:'Synthetic Windows evidence retained across upgrades.'})});assert.equal(savedResponse.status,201);
    const saved=await savedResponse.json();assert.equal(cli('stop').stopped,true);
    const restarted=cli('launch','--no-browser');assert.equal((await(await fetch(`${restarted.url}/api/v1/jobs`)).json())[0].id,saved.job.id);cli('stop');
    const upgraded=join(root,'upgraded bundle');cpSync(bundle,upgraded,{recursive:true});const next=JSON.parse(readFileSync(join(upgraded,'release.json'),'utf8'));next.version='0.2.0-windows-test';
    const migration='app/dist/migrations/020-windows-acceptance.sql';writeFileSync(join(upgraded,migration),'CREATE TABLE windows_acceptance (id INTEGER PRIMARY KEY);');next.files[migration]=createHash('sha256').update(readFileSync(join(upgraded,migration))).digest('hex');writeFileSync(join(upgraded,'release.json'),JSON.stringify(next));
    // Same tested lifecycle, with a new verified bundle and forward migration.
    const upgradedResult=JSON.parse(execFileSync(join(bundle,'runtime/node.exe'),[join(bundle,'app/dist/release-launcher.js'),'install','--root',installRoot,'--bundle',upgraded],{env,encoding:'utf8',timeout:30_000,windowsHide:true}));assert.equal(upgradedResult.active,next.version);
    const after=cli('launch','--no-browser');assert.equal((await(await fetch(`${after.url}/api/v1/jobs/${saved.job.id}`)).json()).observations[0].text,'Synthetic Windows evidence retained across upgrades.');cli('stop');
    assert.equal(cli('uninstall').keptData,true);assert.ok(existsSync(join(installRoot,'data/careervista.sqlite')));
    assert.equal(cli('uninstall','--remove-data','--confirm','REMOVE_OWNED_DATA').keptData,false);assert.equal(existsSync(join(installRoot,'data')),false);
  } finally {try{cli('stop');}catch{}rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
