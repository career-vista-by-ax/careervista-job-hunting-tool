import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {CareerVistaApp} from '../src/app.ts';
import {Applications} from '../src/applications.ts';
import {Reconciliation} from '../src/reconciliation.ts';
import {Backups} from '../src/backup.ts';
import {Compensation} from '../src/compensation.ts';
import {Availability} from '../src/availability.ts';
import {WorkspaceService} from '../src/workspace.ts';
const captured=(app:CareerVistaApp,id:string,url:string,text:string)=>app.saveObservation({ingestionId:id,source:id,sourceUrl:url,capturedAt:'2026-10-18T01:00:00Z',title:'Teacher',company:'School',text});
test('confirmed cross-source duplicates review once with all evidence and application history retained; reversal restores separate vacancies',()=>{
 const root=mkdtempSync(join(tmpdir(),'cv-reconcile-'));let app=new CareerVistaApp({root});try{
 const a=captured(app,'employer','https://example.com/job/1','Teacher. Salary AUD 90000.');const b=captured(app,'board','https://board.example/job/77','Teacher. Salary AUD 95000.');const service=new Reconciliation(app);
 for(const [saved,amount] of [[a,90000],[b,95000]] as const)new Compensation(app).record(saved.job.id,{operationId:`pay-${amount}`,kind:'advertised',attribution:'Saved source',amount:{min:amount,max:amount,currency:'AUD',period:'year',basis:'unknown',superannuation:'unknown',contractUnit:null},evidence:[{observationId:saved.observation.id,quote:`Salary AUD ${amount}.`}]});
 new Availability(app).record(a.job.id,{operationId:'closed-source',sourceUrl:'https://example.com/job/1',checkedAt:'2026-10-18T02:00:00Z',result:'confirmed_closed',text:'Vacancy closed',quote:'Vacancy closed'});
 new Applications(app).record(b.job.id,{operationId:'applied',status:'applied',occurredAt:'2026-10-18T02:00:00Z'});
 assert.equal(service.candidates(a.job.id)[0]?.confidence,'review');
 const linked=service.decide({operationId:'link',leftJobId:a.job.id,rightJobId:b.job.id,decision:'link',reason:'Confirmed same employer vacancy',userConfirmed:true});
 assert.equal(app.listJobs().length,1);assert.equal(app.getJob(a.job.id).observations.length,2);assert.equal(new Applications(app).timeline(a.job.id).status,'applied');assert.equal(new Compensation(app).history(a.job.id).records.length,2);assert.equal(new Availability(app).history(a.job.id).status,'unknown');assert.equal(new WorkspaceService(app).summaries()[0]?.memberJobIds.length,2);assert.equal(service.detail(a.job.id).histories.find(item=>item.jobId===b.job.id)?.applications.events.length,1);
 assert.equal(service.decide({operationId:'link',leftJobId:a.job.id,rightJobId:b.job.id,decision:'link',reason:'Confirmed same employer vacancy',userConfirmed:true}).replayed,true);
 app.close();app=new CareerVistaApp({root});const reopened=new Reconciliation(app);assert.equal(app.listJobs().length,1);
 reopened.reverse({operationId:'reverse',eventId:linked.event.id,reason:'Distinct teaching positions confirmed',userConfirmed:true});assert.equal(app.listJobs().length,2);assert.equal(app.getJob(b.job.id).observations.length,1);assert.equal(new Applications(app).timeline(b.job.id).events.length,1);
 }finally{app.close();rmSync(root,{recursive:true,force:true});}
});

test('revision suggestions retain contradictory evidence, keep-separate decisions block transitive merges, and backup/deletion preserve group integrity',async()=>{
 const {DataLifecycle}=await import('../src/datalifecycle.ts');const root=mkdtempSync(join(tmpdir(),'cv-reconcile-history-'));const app=new CareerVistaApp({root:join(root,'source')});const restored=new CareerVistaApp({root:join(root,'restore')});try{
 const a=captured(app,'revision-1','https://example.com/jobs/1','Teacher. Qualification A. AUD 90000.');const b=captured(app,'revision-2','https://example.com/jobs/1','Teacher. Qualification B. AUD 95000.');const c=captured(app,'third','https://example.com/jobs/2','Teacher. Another vacancy.');const service=new Reconciliation(app);
 assert.equal(service.candidates(a.job.id).find(candidate=>candidate.jobId===b.job.id)?.kind,'possible_revision');
 assert.throws(()=>service.decide({operationId:'unconfirmed',leftJobId:a.job.id,rightJobId:b.job.id,decision:'link',reason:'Guess',userConfirmed:false}),/confirmation/);
 const separate=service.decide({operationId:'separate',leftJobId:a.job.id,rightJobId:c.job.id,decision:'keep_separate',reason:'Different requisition',userConfirmed:true});
 service.decide({operationId:'revision',leftJobId:a.job.id,rightJobId:b.job.id,decision:'link',reason:'Same requisition with updated wording',userConfirmed:true});
 assert.throws(()=>service.decide({operationId:'conflict',leftJobId:b.job.id,rightJobId:c.job.id,decision:'link',reason:'Attempt conflict',userConfirmed:true}),/kept separate/);
 const detail=service.detail(a.job.id);assert.equal(detail.job.observations.length,2);assert.match(detail.differences.join(' '),/text differs/);
 assert.equal(app.saveObservation({ingestionId:'revision-2',source:'revision-2',sourceUrl:'https://example.com/jobs/1',capturedAt:'2026-10-18T01:00:00Z',title:'Teacher',company:'School',text:'Teacher. Qualification B. AUD 95000.'}).replayed,true);
 new Backups(restored).restore(new Backups(app).create());assert.equal(restored.listJobs().length,2);assert.deepEqual(new Reconciliation(restored).detail(a.job.id),detail);
 const lifecycle=new DataLifecycle(restored);assert.equal(lifecycle.previewDeletion([a.job.id]).jobs.length,2);lifecycle.deleteJobs({jobIds:[a.job.id],confirmation:'DELETE_SELECTED_JOBS'});assert.equal(restored.listJobs().length,1);assert.equal(restored.getJob(c.job.id).observations[0]?.text,'Teacher. Another vacancy.');
 assert.equal(service.history().some(event=>event.id===separate.event.id),true);
 }finally{app.close();restored.close();rmSync(root,{recursive:true,force:true});}
});

test('versioned reconciliation routes require explicit decisions and retain idempotent original observation IDs',async()=>{
 const {startServer}=await import('../src/server.ts');const {reconciliationRoutes}=await import('../src/reconciliation.ts');const root=mkdtempSync(join(tmpdir(),'cv-reconciliation-http-'));const app=new CareerVistaApp({root});const server=await startServer(app,{port:0,routes:[reconciliationRoutes]});try{
 const a=captured(app,'http-a','https://example.com/a','Teacher at School.');const b=captured(app,'http-b','https://example.com/b','Teacher at School.');
 const candidates=await(await fetch(`${server.url}/api/v1/jobs/${a.job.id}/reconciliation/candidates`)).json() as {confidence:string}[];assert.equal(candidates[0]?.confidence,'high');assert.equal(app.listJobs().length,2);
 const body={operationId:'http-link',leftJobId:a.job.id,rightJobId:b.job.id,decision:'link',reason:'User checked employer requisition',userConfirmed:true};const post=(payload:unknown)=>fetch(`${server.url}/api/v1/reconciliation/decisions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 assert.equal((await post(body)).status,201);assert.equal((await post(body)).status,200);assert.equal((await post({...body,reason:'Changed'})).status,409);
 const jobs=await(await fetch(`${server.url}/api/v1/jobs`)).json() as {id:string;sources:string[]}[];assert.equal(jobs.length,1);assert.deepEqual([...jobs[0]!.sources].sort(),['http-a','http-b']);
 const job=await(await fetch(`${server.url}/api/v1/jobs/${jobs[0]!.id}`)).json() as {observations:{id:string}[]};assert.deepEqual(job.observations.map(item=>item.id).sort(),[a.observation.id,b.observation.id].sort());
 }finally{await server.close();app.close();rmSync(root,{recursive:true,force:true});}
});
