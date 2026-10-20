import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerVistaApp } from '../src/app.ts';
import { startServer } from '../src/server.ts';

test('an independent agent discovers installed workflow and API guides without webpage onboarding or arbitrary file access', async () => {
  const root=mkdtempSync(join(tmpdir(),'cv-agent-guide-'));const app=new CareerVistaApp({root});const server=await startServer(app,{port:0});
  try {
    const index=await(await fetch(`${server.url}/api/v1/agent-guide`)).json() as {workflow:string;guides:{name:string;path:string}[]};
    assert.ok(index.guides.some(item=>item.name==='user-consent'));assert.ok(index.guides.some(item=>item.name==='profiles'));assert.ok(index.guides.some(item=>item.name==='assessments'));
    for(const item of index.guides){const response=await fetch(`${server.url}${item.path}`);assert.equal(response.status,200,item.name);const guide=await response.json() as {name:string;markdown:string};assert.equal(guide.name,item.name);assert.ok(guide.markdown.length>100);}
    const consent=await(await fetch(`${server.url}/api/v1/agent-guide/user-consent`)).json() as {markdown:string};
    assert.equal(consent.markdown,readFileSync(new URL('../docs/user-consent.md',import.meta.url),'utf8'));
    for(const skill of ['careervista-job-search','careervista-capture','ax-cv','ax-30-secs']) {
      assert.equal(readFileSync(new URL(`../agent-skills/v1/${skill}/references/user-consent.md`,import.meta.url),'utf8'),consent.markdown,`${skill} must carry the same notice when installed independently`);
    }
    const workflow=await(await fetch(`${server.url}${index.workflow}`)).json() as {markdown:string};
    assert.match(workflow.markdown,/principal analytics engineer/);assert.match(workflow.markdown,/demonstratedExperience/);assert.match(workflow.markdown,/reasonsToPursue/);
    const cvSkill=await(await fetch(`${server.url}/api/v1/agent-guide/ax-cv`)).json() as {markdown:string};
    assert.equal(cvSkill.markdown,readFileSync(new URL('../agent-skills/v1/ax-cv/SKILL.md',import.meta.url),'utf8'));
    assert.equal((await fetch(`${server.url}/api/v1/agent-guide/package.json`)).status,404);
    assert.equal((await fetch(`${server.url}/api/v1/agent-guide/%2e%2e%2fpackage.json`)).status,404);
    assert.equal((await fetch(`${server.url}${index.workflow}`,{headers:{Origin:'https://example.com'}})).status,403);
    assert.deepEqual(app.listJobs(),[]);
  }finally{await server.close();app.close();rmSync(root,{recursive:true,force:true});}
});
