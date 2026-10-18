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
