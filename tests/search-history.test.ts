import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CareerVistaApp} from '../src/app.ts';
import {JobStorage,jobStorageRoutes} from '../src/job-storage.ts';
import {WorkspaceService,workspaceRoutes} from '../src/workspace.ts';
import {AssessmentsService} from '../src/assessments.ts';
import {ProfilesService} from '../src/profiles.ts';
import {Applications,applicationRoutes} from '../src/applications.ts';
import {ApplicationFiles,applicationFileRoutes} from '../src/application-files.ts';
import {LanguageService,languageRoutes} from '../src/language.ts';
import {RunsService} from '../src/runs.ts';
import {Backups} from '../src/backup.ts';
import {ResetService} from '../src/reset.ts';
import {startServer} from '../src/server.ts';
function listing(app:CareerVistaApp,id='teacher',url=`https://example.com/${id}`){return app.saveObservation({ingestionId:id,source:'manual',sourceUrl:url,capturedAt:'2026-10-20T00:00:00Z',text:'Teach children.',title:'Teacher',company:'School'});}
function profile(app:CareerVistaApp){const service=new ProfilesService(app);const result=service.createDraft({name:'Teaching',demonstratedExperience:[],aspirations:[],preferences:[],tracks:[{id:'teacher',name:'Teacher',titles:['Teacher'],keywords:[],preferences:[]}]});service.approve(result.version);return result;}

test('archive starts an empty current search while preserving application history, language and historic profiles',()=>{
 const root=mkdtempSync(join(tmpdir(),'cv-history-'));let app=new CareerVistaApp({root});
 try{
  const {job}=listing(app);const p=profile(app);const runs=new RunsService(app);const run=runs.create({requestId:'old',profileVersion:p.version,trackIds:['teacher'],sources:['manual'],limit:2,budget:{amount:0,currency:'AUD'}});
  new LanguageService(app).set({language:'zh-CN'});new Applications(app).record(job.id,{operationId:'applied',status:'applied',occurredAt:'2026-10-20T00:00:00Z',followUpOn:'2026-10-22'});
  const service=new JobStorage(app),archived=service.archive({operationId:'archive',name:'October search'});
  assert.equal(new WorkspaceService(app).query().rows.length,0);assert.equal(new WorkspaceService(app).query({collection:archived.id}).rows[0]?.id,job.id);
  assert.equal(new Applications(app).attention('2026-10-22')[0]?.job.id,job.id);assert.equal(new ProfilesService(app).getActiveProfile(),null);
  assert.equal(new ProfilesService(app).getProfile(p.version).name,p.name);assert.equal(new LanguageService(app).get().language,'zh-CN');assert.equal(runs.get(run.id).status,'cancelled');
  assert.equal(service.archive({operationId:'archive',name:'October search'}).id,archived.id);
  listing(app,'next-search');assert.equal(new WorkspaceService(app).query().rows.length,1);assert.equal(new WorkspaceService(app).query({collection:'all'}).rows.length,2);
  app.close();app=new CareerVistaApp({root});assert.equal(new JobStorage(app).list()[0]?.jobCount,1);assert.equal(new Applications(app).timeline(job.id).events.length,1);
 }finally{app.close();rmSync(root,{recursive:true,force:true});}
});

test('recoverable deletion preserves evidence and suppresses repeat captures until restored, including tracking URL variants',()=>{
 const root=mkdtempSync(join(tmpdir(),'cv-trash-'));const app=new CareerVistaApp({root});
 try{
  const {job}=listing(app,'trash','https://example.com/job/42?utm_source=one');const storage=new JobStorage(app);storage.trash(job.id);
  assert.equal(new WorkspaceService(app).query().rows.length,0);assert.equal(new WorkspaceService(app).query({collection:'trash'}).rows[0]?.id,job.id);
  assert.throws(()=>listing(app,'recapture','https://example.com/job/42?utm_source=two#top'),error=>{assert.equal((error as {code:string}).code,'job_in_trash');return true;});
  assert.equal(app.getJob(job.id).observations.length,1);assert.equal(new Applications(app).attention('2026-10-30').length,0);
  storage.restore(job.id);assert.equal(new WorkspaceService(app).query().rows[0]?.id,job.id);assert.equal(new WorkspaceService(app).query({collection:'trash'}).rows.length,0);
  assert.doesNotThrow(()=>listing(app,'new-after-restore','https://example.com/job/42'));
 }finally{app.close();rmSync(root,{recursive:true,force:true});}
});

test('application answers, contacts, original document bytes and follow-ups survive archive, backup, restore and reset',()=>{
 const root=mkdtempSync(join(tmpdir(),'cv-application-records-'));const app=new CareerVistaApp({root:join(root,'source')}),restored=new CareerVistaApp({root:join(root,'restored')});
 try{
  const {job}=listing(app);const files=new ApplicationFiles(app);const input={operationId:'cv',name:'CV used.txt',kind:'resume',contentBase64:Buffer.from('Exact submitted CV copy').toString('base64')};
  const saved=files.save(job.id,input);assert.equal(files.save(job.id,input).replayed,true);assert.equal(files.get(String(saved.file.id)).bytes.toString(),'Exact submitted CV copy');
  assert.throws(()=>files.save(job.id,{...input,operationId:'html',name:'bad.html'}),/PDF/);assert.throws(()=>files.save(job.id,{...input,contentBase64:Buffer.from('Different').toString('base64')}),/different/);
  const applications=new Applications(app);applications.record(job.id,{operationId:'application',status:'applied',occurredAt:'2026-10-20T00:00:00Z',followUpOn:'2026-10-22',details:{salaryAmount:'210000–230000',salaryCurrency:'AUD',salaryBasis:'base_excluding_super',salaryPeriod:'annual',contacts:[{name:'Recruiter',role:'Talent',email:'recruiter@example.com',phone:'0400000000',notes:'Call after interview'}],questions:[{question:'Why this role?',answer:'My actual answer'}]},documents:[{kind:'resume',label:'CV used.txt',reference:`application-file:${saved.file.id}`}]});
  applications.record(job.id,{operationId:'interview',status:'interview',occurredAt:'2026-10-21T00:00:00Z',followUpOn:'2026-10-28',details:{stage:'Technical round 2',salaryAmount:'230000',salaryCurrency:'AUD'}});
  assert.equal(applications.timeline(job.id).events[0]?.details.contacts?.[0]?.email,'recruiter@example.com');assert.equal(applications.timeline(job.id).events[0]?.details.salaryAmount,'210000–230000');
  const other=listing(app,'other').job;assert.throws(()=>applications.record(other.id,{operationId:'wrong-doc',status:'applied',occurredAt:'2026-10-20T00:00:00Z',documents:[{kind:'resume',label:'CV',reference:`application-file:${saved.file.id}`}]}),/belong/);
  new JobStorage(app).archive({operationId:'archive',name:'Past search'});new Backups(restored).restore(new Backups(app).create());
  assert.equal(new ApplicationFiles(restored).get(String(saved.file.id)).bytes.toString(),'Exact submitted CV copy');assert.equal(new Applications(restored).attention('2026-10-28').length,1);
  const reset=new ResetService(restored);reset.reset({token:reset.confirm({confirmation:'RESET_ALL_DATA'}).token,confirmation:'DELETE'});assert.equal(new JobStorage(restored).list().length,0);assert.throws(()=>new ApplicationFiles(restored).get(String(saved.file.id)),/not found/);
 }finally{app.close();restored.close();rmSync(root,{recursive:true,force:true});}
});

test('history, application copies and language are available through protected HTTP routes',async()=>{
 const root=mkdtempSync(join(tmpdir(),'cv-history-http-'));const app=new CareerVistaApp({root});const server=await startServer(app,{port:0,routes:[jobStorageRoutes,workspaceRoutes,applicationRoutes,applicationFileRoutes,languageRoutes]});
 const post=(path:string,body:unknown,origin=server.url)=>fetch(server.url+'/api/v1'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
 try{
  const {job}=listing(app);assert.equal((await post('/settings/language',{language:'zh-Hant'})).status,200);assert.equal((await post('/settings/language',{language:'unknown'})).status,400);
  assert.equal((await post('/archives',{operationId:'archive',name:'History'},'https://evil.example')).status,403);
  const response=await post(`/jobs/${job.id}/application-files`,{operationId:'file',name:'copy.txt',kind:'letter',contentBase64:Buffer.from('Exact bytes').toString('base64')});assert.equal(response.status,201);const result=await response.json() as {file:{id:string}};
  const download=await fetch(`${server.url}/api/v1/application-files/${result.file.id}`);assert.equal(await download.text(),'Exact bytes');assert.match(download.headers.get('content-disposition')??'',/attachment/);
  assert.equal((await post(`/jobs/${job.id}/storage/trash`,{})).status,200);const workspace=await(await fetch(server.url+'/api/v1/workspace?collection=trash')).json() as {rows:unknown[]};assert.equal(workspace.rows.length,1);
  assert.equal((await post(`/jobs/${job.id}/storage/restore`,{})).status,200);
 }finally{await server.close();app.close();rmSync(root,{recursive:true,force:true});}
});


test('bilingual recommendations retain exact English lineage and survive backup without translating evidence',()=>{
 const root=mkdtempSync(join(tmpdir(),'cv-language-'));const app=new CareerVistaApp({root:join(root,'source')}),restored=new CareerVistaApp({root:join(root,'restore')});
 try{
  const {job,observation}=listing(app),p=profile(app),unknown={status:'unknown' as const,explanation:'The requirements need clarification.',findings:[]};
  const assessment=new AssessmentsService(app).submitAssessment({submissionId:'assessment',jobId:job.id,profileVersion:p.version,trackId:'teacher',observationIds:[observation.id],metadata:{agent:'test',analysisVersion:'1'},axes:{qualifications:unknown,preferences:unknown,practicalConstraints:unknown},reasonsToPursue:[{dimension:'impact',status:'supports',statement:'The role involves teaching children.',attribution:'model_inference',evidence:[{observationId:observation.id,quote:'Teach children.'}]}],concerns:[],questions:[],unknowns:[],hardConflicts:[],confidence:{level:'low',explanation:'Only a short listing is available.'}}).assessment;
  const service=new LanguageService(app);service.set({language:'zh-Hant'});
  const input={operationId:'translation',assessmentId:assessment.id,language:'zh-Hant',entries:[{english:'The role involves teaching children.',translated:'這份工作包括教導兒童。'}]};
  service.save(job.id,input);assert.equal(service.save(job.id,input).replayed,true);
  assert.throws(()=>service.save(job.id,{...input,operationId:'unrelated',entries:[{english:'An invented statement.',translated:'無來源'}]}),/exact English/);
  assert.equal(app.getJob(job.id).observations[0]?.text,'Teach children.');assert.equal(new AssessmentsService(app).history(job.id)[0]?.reasonsToPursue[0]?.statement,'The role involves teaching children.');
  new Backups(restored).restore(new Backups(app).create());assert.equal(new LanguageService(restored).get().language,'zh-Hant');assert.equal(new LanguageService(restored).translations(job.id)[0]?.entries[0]?.translated,'這份工作包括教導兒童。');
 }finally{app.close();restored.close();rmSync(root,{recursive:true,force:true});}
});
