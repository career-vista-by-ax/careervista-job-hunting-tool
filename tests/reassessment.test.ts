import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {CareerVistaApp} from '../src/app.ts';
import {ProfilesService} from '../src/profiles.ts';
import {AssessmentsService} from '../src/assessments.ts';
import type {AssessmentInput,Finding} from '../src/assessments.ts';
import {Applications} from '../src/applications.ts';
import {Reconciliation} from '../src/reconciliation.ts';
import {ReassessmentsService} from '../src/reassessment.ts';
function setup(app:CareerVistaApp){
 const profiles=new ProfilesService(app);const draft=profiles.createDraft({name:'Any profession',demonstratedExperience:['Teaching'],aspirations:['Classroom ownership'],preferences:[{key:'decisionAuthority',kind:'hard',value:'Own teaching decisions'}],tracks:[{id:'teaching',name:'Teaching',titles:['Teacher'],keywords:[],preferences:[]}]});profiles.approve(draft.version);
 const saved=app.saveObservation({ingestionId:'saved-teacher',title:'Teacher',company:'School',source:'employer',sourceUrl:'https://example.com/teacher',capturedAt:'2026-10-18T00:00:00Z',text:'Teaching methods require director approval.'});
 const evidence=[{observationId:saved.observation.id,quote:'Teaching methods require director approval.'}];const concern:Finding={dimension:'decisionAuthority',status:'concern',statement:'Director approval conflicts with ownership.',attribution:'employer_claim',evidence};const unknown={status:'unknown' as const,explanation:'Not stated.',findings:[]};
 const assessment:AssessmentInput={submissionId:'excluded-original',jobId:saved.job.id,profileVersion:draft.version,trackId:'teaching',observationIds:[saved.observation.id],metadata:{agent:'fixture',model:'fixture-model',analysisVersion:'1'},axes:{qualifications:unknown,preferences:{status:'concern',explanation:concern.statement,findings:[concern]},practicalConstraints:unknown},reasonsToPursue:[],concerns:[concern],questions:[],unknowns:[],hardConflicts:[{preferenceKey:'decisionAuthority',observedValue:'Director approval',explanation:concern.statement,attribution:'employer_claim',evidence}],confidence:{level:'low',explanation:'Only one employer claim.'}};
 const original=new AssessmentsService(app).submitAssessment(assessment).assessment;
 const next=profiles.createDraft({...draft,basedOnVersion:draft.version,preferences:[{key:'decisionAuthority',kind:'soft',value:'Own teaching decisions'}]});profiles.approve(next.version);
 return{saved,assessment,original,next};
}
test('reassessment restores eligibility from cached evidence under an approved revision without changing application history',()=>{
 const root=mkdtempSync(join(tmpdir(),'cv-reassess-'));let app=new CareerVistaApp({root});
 try{const {saved,assessment,original,next}=setup(app);new Applications(app).record(saved.job.id,{operationId:'applied',status:'applied',occurredAt:'2026-10-18T03:00:00Z'});
  const service=new ReassessmentsService(app);const batch=service.create({requestId:'batch',profileVersion:next.version,trackId:'teaching',jobIds:[saved.job.id],budget:{amount:1,currency:'AUD'},estimatePerJob:0.1});
  const input=service.authorize(batch.id,saved.job.id,{operationId:'authorize'});assert.equal(input.profile.version,next.version);assert.equal(input.effectivePreferences[0].kind,'soft');assert.equal(input.observations[0].text,saved.observation.text);assert.equal(input.previousAssessment?.id,original.id);
  const updated={...assessment,submissionId:'new-assessment',profileVersion:next.version,metadata:{agent:'fixture',model:'new-fixture-model',analysisVersion:'2'},hardConflicts:[]};
  service.complete(batch.id,saved.job.id,{operationId:'complete',outcome:'assessed',assessment:updated,actualCost:null});
  app.close();app=new CareerVistaApp({root});const history=new AssessmentsService(app).history(saved.job.id);assert.equal(history.length,2);assert.equal(history[0].label,'excluded');assert.equal(history[0].metadata.model,'fixture-model');assert.equal(history[1].label,'investigate');assert.equal(history[1].profileVersion,next.version);assert.equal(history[1].metadata.model,'new-fixture-model');
  assert.equal(new Applications(app).timeline(saved.job.id).status,'applied');assert.equal(app.getJob(saved.job.id).observations.length,1);
  const finished=new ReassessmentsService(app).get(batch.id);assert.equal(finished.items[0].status,'assessed');assert.equal(finished.costs.actualUnavailable,true);
 }finally{app.close();rmSync(root,{recursive:true,force:true});}
});
test('insufficient evidence and provider failures retain earlier exclusions and review decisions after backup recovery',async()=>{
 const root=mkdtempSync(join(tmpdir(),'cv-reassess-failure-')),restoredRoot=mkdtempSync(join(tmpdir(),'cv-reassess-restore-')),app=new CareerVistaApp({root}),restored=new CareerVistaApp({root:restoredRoot});try{const {saved,next}=setup(app);const {FeedbackService}=await import('../src/feedback.ts');const feedback=new FeedbackService(app);feedback.recordDecision(saved.job.id,{operationId:'dismiss',decision:'dismissed',reason:'Personal choice'});const service=new ReassessmentsService(app);assert.throws(()=>service.create({requestId:'over',profileVersion:next.version,trackId:'teaching',jobIds:[saved.job.id],budget:{amount:.01,currency:'AUD'},estimatePerJob:.1}),/exceeds/);for(const outcome of ['insufficient_evidence','provider_failure'] as const){const batch=service.create({requestId:outcome,profileVersion:next.version,trackId:'teaching',jobIds:[saved.job.id],budget:{amount:1,currency:'AUD'},estimatePerJob:.1});assert.throws(()=>service.complete(batch.id,saved.job.id,{operationId:'early',outcome,actualCost:null}),/Authorize/);service.authorize(batch.id,saved.job.id,{operationId:'authorize'});const input={operationId:'complete',outcome,actualCost:null};service.complete(batch.id,saved.job.id,input);service.complete(batch.id,saved.job.id,input);assert.equal(service.get(batch.id).items[0]?.status,outcome);assert.equal(service.get(batch.id).costs.committed,.1);}assert.equal(new AssessmentsService(app).history(saved.job.id).length,1);assert.equal(feedback.history(saved.job.id).decision,'dismissed');const{Backups}=await import('../src/backup.ts');new Backups(restored).restore(new Backups(app).create());assert.equal(new ReassessmentsService(restored).list().length,2);assert.equal(new AssessmentsService(restored).history(saved.job.id)[0]?.label,'excluded');}finally{app.close();restored.close();rmSync(root,{recursive:true,force:true});rmSync(restoredRoot,{recursive:true,force:true});}
});

for(const direction of ['link','reverse'] as const)test(`${direction} changes block cached authorization without dropping evidence or starting work`,()=>{
 const root=mkdtempSync(join(tmpdir(),'cv-reassess-scope-')),app=new CareerVistaApp({root});
 try{
  const {saved,next}=setup(app),other=app.saveObservation({ingestionId:'other',source:'employer',sourceUrl:'https://example.com/other',capturedAt:'2026-10-18T00:00:00Z',title:'Teacher',company:'School',text:'Additional teacher evidence.'});
  const service=new ReassessmentsService(app),reconciliation=new Reconciliation(app);
  const link=direction==='reverse'?reconciliation.decide({operationId:'link',leftJobId:saved.job.id,rightJobId:other.job.id,decision:'link',reason:'Same vacancy',userConfirmed:true}):null;
  const jobId=app.getJob(saved.job.id).id,batch=service.create({requestId:'scope',profileVersion:next.version,trackId:'teaching',jobIds:[jobId],budget:{amount:1,currency:'AUD'},estimatePerJob:.1});
  if(link)reconciliation.reverse({operationId:'reverse',eventId:link.event.id,reason:'Separate vacancies',userConfirmed:true});
  else reconciliation.decide({operationId:'link',leftJobId:saved.job.id,rightJobId:other.job.id,decision:'link',reason:'Same vacancy',userConfirmed:true});
  assert.throws(()=>service.authorize(batch.id,jobId,{operationId:'authorize'}),{code:'scope_conflict'});
  assert.equal(service.get(batch.id).items[0]!.status,'pending');
  assert.deepEqual(service.get(batch.id).items[0]!.observationIds,batch.items[0]!.observationIds);
  assert.equal(service.get(batch.id).costs.known,0);
 }finally{app.close();rmSync(root,{recursive:true,force:true});}
});

for(const direction of ['link','reverse'] as const)test(`${direction} after authorization rejects fit results but permits explicit costed failure completion`,()=>{
 const root=mkdtempSync(join(tmpdir(),'cv-reassess-working-scope-'));let app=new CareerVistaApp({root});
 try{
  const {saved,assessment,next}=setup(app),other=app.saveObservation({ingestionId:'other',source:'employer',sourceUrl:'https://example.com/other',capturedAt:'2026-10-18T00:00:00Z',title:'Teacher',company:'School',text:'Additional teacher evidence.'});
  const service=new ReassessmentsService(app),reconciliation=new Reconciliation(app);
  const linked=direction==='reverse'?reconciliation.decide({operationId:'link',leftJobId:saved.job.id,rightJobId:other.job.id,decision:'link',reason:'Same vacancy',userConfirmed:true}):null;
  const jobId=app.getJob(saved.job.id).id,batch=service.create({requestId:'working-scope',profileVersion:next.version,trackId:'teaching',jobIds:[jobId],budget:{amount:1,currency:'AUD'},estimatePerJob:.1});
  const handoff=service.authorize(batch.id,jobId,{operationId:'authorize'});
  assert.equal(handoff.observations.length,direction==='reverse'?2:1);
  if(linked)reconciliation.reverse({operationId:'reverse',eventId:linked.event.id,reason:'Different vacancies',userConfirmed:true});
  else reconciliation.decide({operationId:'link',leftJobId:saved.job.id,rightJobId:other.job.id,decision:'link',reason:'Same vacancy',userConfirmed:true});
  app.close();app=new CareerVistaApp({root});const resumed=new ReassessmentsService(app);
  assert.throws(()=>resumed.authorize(batch.id,jobId,{operationId:'authorize'}),{code:'scope_conflict'});
  const updated={...assessment,jobId,submissionId:'drift-result',profileVersion:next.version,observationIds:handoff.observations.map(item=>item.id),hardConflicts:[]};
  assert.throws(()=>resumed.complete(batch.id,jobId,{operationId:'assess',outcome:'assessed',assessment:updated,actualCost:.03}),{code:'scope_conflict'});
  assert.equal(new AssessmentsService(app).history(saved.job.id).length,1);
  const outcome=direction==='reverse'?'insufficient_evidence':'provider_failure';
  const failure={operationId:'finish',outcome,actualCost:.03};
  const finished=resumed.complete(batch.id,jobId,failure);
  assert.equal(finished.items[0]!.status,outcome);
  assert.deepEqual(finished.items[0]!.observationIds,batch.items[0]!.observationIds);
  assert.equal(finished.costs.known,.03);assert.equal(finished.costs.committed,.03);
  assert.deepEqual(resumed.complete(batch.id,jobId,failure),finished);
 }finally{app.close();rmSync(root,{recursive:true,force:true});}
});
