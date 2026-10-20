import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerVistaApp } from '../src/app.ts';
import { ProfilesService, profileRoutes } from '../src/profiles.ts';
import { RunsService, runsRoute } from '../src/runs.ts';
import { collectionRoutes, SourceCollection } from '../src/collection.ts';
import type { AssessmentInput } from '../src/assessments.ts';
import { assessmentRoutes } from '../src/assessments.ts';
import { startServer } from '../src/server.ts';
import { LocalAgentTasks, AgentTaskError } from '../src/tools/agent-tasks.ts';

async function fixture() {
  const root=mkdtempSync(join(tmpdir(),'cv-agent-tasks-')),app=new CareerVistaApp({root});
  const profiles=new ProfilesService(app);
  const profile=profiles.createDraft({name:'Engineering',demonstratedExperience:['SQL'],aspirations:[],preferences:[],tracks:[{id:'ic',name:'IC',titles:['Analytics Engineer','Data Engineer'],keywords:[],preferences:[]}]});
  const server=await startServer(app,{port:0,routes:[profileRoutes(profiles),runsRoute,collectionRoutes(),assessmentRoutes]});
  const client=new LocalAgentTasks(server.url);
  const run={requestId:'task-search',profileVersion:profile.version,trackIds:['ic'],sources:['seek'],limit:1,discoveryLimit:20,budget:{amount:1,currency:'AUD'}};
  const settings={run,plans:[{source:'seek',config:{location:'Melbourne'}}]};
  return {app,profiles,profile,client,run,settings,close:async()=>{await server.close();app.close();rmSync(root,{recursive:true,force:true});}};
}

test('task client plans approved work, reserves once, screens previews and returns evidence IDs without dumping full text',async()=>{
  const f=await fixture();
  try {
    await assert.rejects(f.client.execute('plan-search',f.settings),/Approve/);
    assert.equal(new RunsService(f.app).list().length,0);
    f.profiles.approve(f.profile.version);
    const first=await f.client.execute('plan-search',f.settings) as any;
    const altered=structuredClone(f.settings);Object.assign(altered.plans[0]!,{operationId:'extra-caller-field'});
    const again=await f.client.execute('plan-search',altered) as any;
    assert.equal(again.run.id,first.run.id);
    assert.equal(new RunsService(f.app).get(first.run.id).work.length,2);
    const runId=first.run.id,searchKey=first.plans[0].searches[0].workKey;
    const preparation={runId,operationId:'search-work',workKey:searchKey,modelWork:true,estimate:0.1,currency:'AUD'};
    const prepared=await f.client.execute('prepare-work',preparation) as any;
    await f.client.execute('prepare-work',preparation);
    const state=new RunsService(f.app).get(runId);
    assert.equal(state.reservations.length,1);assert.equal(state.work[0]!.attempts,1);
    assert.equal(prepared.reservationId,state.reservations[0]!.id);
    const previews={runId,operationId:'previews',searchKey,outcome:'results' as const,listings:[1,2].map(id=>({url:`https://au.seek.com/job/${id}`,title:'Analytics Engineer',snippet:'x'.repeat(1000)}))};
    await f.client.execute('save-previews',previews);await f.client.execute('save-previews',previews);
    assert.equal(f.app.listJobs().length,0);
    const context=await f.client.execute('search-context',{runId,limit:1}) as any;
    assert.equal(context.totalCandidates,2);assert.equal(context.nextOffset,1);
    assert.equal(context.candidates[0].preview.snippet.length,500);
    const second=await f.client.execute('search-context',{runId,offset:1,limit:1}) as any;
    assert.equal(second.nextOffset,null);assert.notEqual(second.candidates[0].workKey,context.candidates[0].workKey);
    const workKey=context.candidates[0].workKey;
    await assert.rejects(f.client.execute('screen-candidates',{runId,operationId:'over-limit',decisions:[context.candidates[0],second.candidates[0]].map(item=>({workKey:item.workKey,disposition:'selected',reason:'Review'}))}),/limit/);
    await f.client.execute('screen-candidates',{runId,operationId:'screen',decisions:[{workKey,disposition:'selected',reason:'Relevant technical scope.'}]});
    const capture={operationId:'capture',workKey,capturedAt:new Date().toISOString(),title:'Analytics Engineer',company:'Example',text:'Readable original evidence. '.repeat(1000),captureMethod:'headless-browser' as const};
    await assert.rejects(f.client.execute('capture-evidence',{runId,capture}),/Authorize/);
    await f.client.execute('prepare-work',{runId,operationId:'listing-work',workKey,modelWork:false});
    const saved=await f.client.execute('capture-evidence',{runId,capture}) as any;
    assert.ok(saved.jobId);assert.ok(saved.observationId);assert.equal(saved.method,'headless-browser');
    assert.equal(JSON.stringify(saved).includes(capture.text),false);
    assert.deepEqual(await f.client.execute('capture-evidence',{runId,capture}),saved);
    assert.equal(new SourceCollection(f.app).get(runId).listings[0]!.jobId,saved.jobId);
    const unknown={status:'unknown' as const,explanation:'The evidence does not establish this dimension.',findings:[]};
    const assessment:AssessmentInput={submissionId:'assessment',jobId:saved.jobId,profileVersion:f.profile.version,trackId:'ic',observationIds:[saved.observationId],metadata:{agent:'fixture',analysisVersion:'1'},axes:{qualifications:unknown,preferences:unknown,practicalConstraints:unknown},reasonsToPursue:[],concerns:[],questions:[],unknowns:[{dimension:'qualifications',explanation:'Unverified requirements.'}],hardConflicts:[],confidence:{level:'low',explanation:'Limited evidence.'}};
    const assessed=await f.client.execute('save-assessment',{assessment}) as any;
    assert.ok(assessed.assessmentId);assert.equal(assessed.jobId,saved.jobId);assert.equal(assessed.replayed,false);
    assert.equal((await f.client.execute('save-assessment',{assessment}) as any).replayed,true);
    // Context is pinned to the run even when another profile becomes active.
    const revised=f.profiles.createDraft({...f.profile,basedOnVersion:f.profile.version,name:'Later profile'});f.profiles.approve(revised.version);
    assert.equal((await f.client.execute('search-context',{runId}) as any).profile.version,f.profile.version);
  } finally {await f.close();}
});

test('task client retains partial plans, server access waits and budget rejection without automatic scope changes',async()=>{
  const f=await fixture();
  try {
    f.profiles.approve(f.profile.version);
    const planned=await f.client.execute('plan-search',{run:{...f.run,sources:['seek','unsupported-board']},plans:[...f.settings.plans,{source:'unsupported-board',config:{}}]}) as any;
    assert.equal(planned.partial,true);assert.equal(planned.plans.length,1);assert.equal(planned.failures.length,1);assert.equal(planned.failures[0].source,'unsupported-board');
    const runId=planned.run.id,workKey=planned.plans[0].searches[0].workKey,runs=new RunsService(f.app);
    await assert.rejects(f.client.execute('prepare-work',{runId,operationId:'too-expensive',workKey,modelWork:true,estimate:2,currency:'AUD'}),/budget/i);
    assert.equal(runs.get(runId).status,'budget-exhausted');
    runs.control(runId,{operationId:'resume-budget',action:'resume'});
    await f.client.execute('prepare-work',{runId,operationId:'search',workKey,modelWork:false});
    runs.control(runId,{operationId:'login',action:'wait-signin',workKey,sessionRef:'host-browser',pageUrl:'https://www.seek.com.au/login'});
    await assert.rejects(f.client.execute('save-previews',{runId,operationId:'blocked-result',searchKey:workKey,outcome:'results',listings:[{url:'https://au.seek.com/job/9'}]}),/paused/);
    assert.equal(runs.get(runId).status,'waiting-user-signin');
  } finally {await f.close();}
});

test('task client keeps career payloads on loopback and rejects redirects rather than following them',async()=>{
  for(const origin of ['https://example.org','http://example.org','http://user:secret@127.0.0.1:4318','http://127.0.0.1:4318/path']) assert.throws(()=>new LocalAgentTasks(origin),AgentTaskError);
  let calls=0;
  const client=new LocalAgentTasks('http://127.0.0.1:4318',async(_url,options)=>{calls++;assert.equal(options?.redirect,'error');throw new TypeError('redirect');});
  await assert.rejects(client.execute('search-context',{}),/Local API request failed/);
  assert.equal(calls,1);
});
