import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerVistaApp } from '../src/app.ts';
import { ProfilesService } from '../src/profiles.ts';
import { Applications } from '../src/applications.ts';
import { FeedbackService } from '../src/feedback.ts';

function setup() {
  const root=mkdtempSync(join(tmpdir(),'cv-feedback-')); const app=new CareerVistaApp({root});
  const saved=app.saveObservation({ingestionId:'teacher',source:'employer',sourceUrl:'https://example.com/teacher',capturedAt:'2026-10-18T00:00:00Z',title:'Teacher',company:'School',text:'Teach students with shared curriculum decisions. Based in Sydney. Advanced teaching certificate required.'});
  const profiles=new ProfilesService(app); const profile=profiles.approve(profiles.createDraft({name:'Teaching',demonstratedExperience:['Teaching'],aspirations:['Teach locally'],preferences:[{key:'location',kind:'soft',value:'Melbourne'}],tracks:[{id:'teaching',name:'Teaching',titles:['Teacher'],keywords:['education'],preferences:[]}]}).version);
  return {root,app,saved,profile,profiles,feedback:new FeedbackService(app)};
}

test('explicit review decisions and optional explanations remain separate from profile and application state across restart',()=>{
  const context=setup();let app=context.app;
  try {
    const {feedback,saved,profile}=context;
    assert.equal(feedback.history(saved.job.id).decision,'unreviewed');
    const first=feedback.recordDecision(saved.job.id,{operationId:'save-1',decision:'saved'});
    assert.equal(feedback.recordDecision(saved.job.id,{operationId:'save-1',decision:'saved'}).replayed,true);
    feedback.recordDecision(saved.job.id,{operationId:'dismiss-1',decision:'dismissed',reason:'A commute preference for this particular school.'});
    assert.equal(feedback.history(saved.job.id).events.length,2);assert.equal(first.event.reason,'');
    assert.equal(new ProfilesService(app).getActiveProfile()?.version,profile.version);
    assert.deepEqual(new Applications(app).timeline(saved.job.id).events,[]);
    app.close();app=new CareerVistaApp({root:context.root});
    assert.equal(new FeedbackService(app).history(saved.job.id).decision,'dismissed');
    assert.equal(new FeedbackService(app).history(saved.job.id).events[1]?.reason,'A commute preference for this particular school.');
  }finally{app.close();rmSync(context.root,{recursive:true,force:true});}
});

test('proposals remain reviewable, hard exclusions need distinct confirmation, and reversal preserves unrelated newer edits',()=>{
 const {root,app,saved,profile,profiles,feedback}=setup();
 try{
  const decision=feedback.recordDecision(saved.job.id,{operationId:'reason-1',decision:'dismissed',reason:'This role needs five on-site days; I prefer a hybrid week.'}).event;
  const suggestion={submissionId:'suggest-soft',baseProfileVersion:profile.version,feedbackIds:[decision.id],change:{key:'workArrangement',kind:'soft' as const,value:'Hybrid'},explanation:'Propose a general preference from the commute feedback; user must decide whether it generalises.'};
  const pending=feedback.propose(suggestion).proposal;
  assert.equal(pending.status,'pending');assert.equal(pending.feedback[0]?.reason,decision.reason);assert.equal(profiles.getActiveProfile()?.version,profile.version);
  assert.equal(feedback.reject(pending.id,{operationId:'reject-soft',confirmed:true}).proposal.status,'rejected');
  assert.equal(profiles.getActiveProfile()?.version,profile.version);
  const hard=feedback.propose({...suggestion,submissionId:'suggest-hard',change:{...suggestion.change,kind:'hard'}}).proposal;
  assert.throws(()=>feedback.accept(hard.id,{operationId:'accept-hard',confirmed:true}),/confirm.*hard exclusion/i);
  assert.equal(profiles.listProfiles().length,1);
  const accepted=feedback.accept(hard.id,{operationId:'accept-hard',confirmed:true,confirmHardExclusion:true});
  assert.equal(accepted.proposal.status,'accepted');assert.equal(accepted.profile?.status,'approved');
  assert.equal(profiles.getActiveProfile()?.preferences.find(pref=>pref.key==='workArrangement')?.kind,'hard');
  assert.equal(feedback.accept(hard.id,{operationId:'accept-hard',confirmed:true,confirmHardExclusion:true}).replayed,true);
  const active=profiles.getActiveProfile()!;
  const later=profiles.approve(profiles.createDraft({...active,basedOnVersion:active.version,preferences:[...active.preferences,{key:'benefits',kind:'soft',value:'Professional development'}]}).version);
  const reversed=feedback.reverse(hard.id,{operationId:'reverse-hard',confirmed:true});
  assert.equal(reversed.proposal.status,'reversed');assert.ok(reversed.profile!.version>later.version);
  assert.equal(profiles.getActiveProfile()?.preferences.some(pref=>pref.key==='workArrangement'),false);
  assert.equal(profiles.getActiveProfile()?.preferences.find(pref=>pref.key==='benefits')?.value,'Professional development');
  assert.deepEqual(feedback.getProposal(hard.id).events.map(event=>event.action),['accepted','reversed']);
  assert.equal(feedback.history(saved.job.id).decision,'dismissed');assert.equal(profiles.getProfile(profile.version).preferences.length,1);
 }finally{app.close();rmSync(root,{recursive:true,force:true});}
});

test('saved review overrides an agent low-fit recommendation without changing its assessment or creating preferences',async()=>{
 const {AssessmentsService}=await import('../src/assessments.ts');const {WorkspaceService}=await import('../src/workspace.ts');
 const {root,app,saved,profile,feedback}=setup();
 try{
  const finding={dimension:'qualifications',status:'concern',statement:'The advanced certificate is not demonstrated in the approved profile.',attribution:'employer_claim',evidence:[{observationId:saved.observation.id,quote:'Advanced teaching certificate required.'}]};
  const concern={status:'concern',explanation:'Evidence-backed concern requiring investigation.',findings:[finding]};const unknown={status:'unknown',explanation:'Not established',findings:[]};
  const assessments=new AssessmentsService(app);const assessment=assessments.submitAssessment({submissionId:'low-fit',jobId:saved.job.id,profileVersion:profile.version,trackId:'teaching',observationIds:[saved.observation.id],metadata:{agent:'fixture',analysisVersion:'1'},axes:{qualifications:concern,preferences:{...concern,findings:[{...finding,dimension:'location',statement:'Sydney differs from the soft Melbourne preference.',evidence:[{observationId:saved.observation.id,quote:'Based in Sydney.'}]}]},practicalConstraints:unknown},reasonsToPursue:[],concerns:[finding],questions:[],unknowns:[],hardConflicts:[],confidence:{level:'medium',explanation:'Requires user verification.'}} as never).assessment;
  assert.equal(assessment.label,'low_fit');
  feedback.recordDecision(saved.job.id,{operationId:'pursue-anyway',decision:'saved',reason:'Worth discussing despite the recommendation.'});
  assert.equal(assessments.history(saved.job.id)[0]?.label,'low_fit');
  assert.equal(new WorkspaceService(app).query({review:'saved'}).rows[0]?.id,saved.job.id);
  assert.equal(new ProfilesService(app).getActiveProfile()?.version,profile.version);
 }finally{app.close();rmSync(root,{recursive:true,force:true});}
});

test('public feedback HTTP applies only explicit actions and private backups preserve complete proposal history',async()=>{
 const {startServer}=await import('../src/server.ts');const {feedbackRoutes}=await import('../src/feedback.ts');const {Backups}=await import('../src/backup.ts');const {DataLifecycle}=await import('../src/datalifecycle.ts');
 const {root,app,saved,profile,feedback}=setup();const destination=new CareerVistaApp({root:join(root,'restored')});const server=await startServer(app,{port:0,routes:[feedbackRoutes]});
 try{
  const post=(path:string,body:unknown)=>fetch(`${server.url}/api/v1${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const response=await post(`/jobs/${saved.job.id}/reviews`,{operationId:'http-feedback',decision:'saved',reason:'Prefer local schools generally.'});assert.equal(response.status,201);const decision=await response.json() as {event:{id:string}};
  const proposed=await post('/preference-proposals',{submissionId:'http-proposal',baseProfileVersion:profile.version,feedbackIds:[decision.event.id],change:{key:'location',kind:'soft',value:'Within walking distance'},explanation:'An explicit proposal to generalise the local preference.'});assert.equal(proposed.status,201);const body=await proposed.json() as {proposal:{id:string}};
  assert.equal((await post(`/preference-proposals/${body.proposal.id}/accept`,{operationId:'http-accept',confirmed:false})).status,400);
  assert.equal((await post(`/preference-proposals/${body.proposal.id}/accept`,{operationId:'http-accept',confirmed:true})).status,200);
  new Backups(destination).restore(new Backups(app).create());assert.deepEqual(new FeedbackService(destination).getProposal(body.proposal.id),feedback.getProposal(body.proposal.id));
  assert.equal((await fetch(`${server.url}/api/v1/preference-proposals?status=accepted`)).status,200);
  new DataLifecycle(app).deleteJobs({jobIds:[saved.job.id],confirmation:'DELETE_SELECTED_JOBS'});
  assert.throws(()=>feedback.getProposal(body.proposal.id),/not found/i);
  assert.equal(new FeedbackService(destination).history(saved.job.id).decision,'saved');
 }finally{await server.close();destination.close();app.close();rmSync(root,{recursive:true,force:true});}
});

test('reversing a track override requires confirmation when it exposes an inherited hard exclusion',()=>{
 const {root,app,saved,profiles,profile,feedback}=setup();
 try{
  const baseline=profiles.approve(profiles.createDraft({...profile,basedOnVersion:profile.version,preferences:[{key:'location',kind:'hard',value:'Melbourne'}]}).version);
  const decision=feedback.recordDecision(saved.job.id,{operationId:'flexible-location',decision:'saved',reason:'I may consider schools elsewhere for this track.'}).event;
  const proposal=feedback.propose({submissionId:'track-relaxation',baseProfileVersion:baseline.version,feedbackIds:[decision.id],trackId:'teaching',change:{key:'location',kind:'soft',value:'Anywhere'},explanation:'Explicit track-specific relaxation.'}).proposal;
  feedback.accept(proposal.id,{operationId:'accept-relaxation',confirmed:true});
  assert.throws(()=>feedback.reverse(proposal.id,{operationId:'reverse-inherited',confirmed:true}),/confirm.*hard exclusion/i);
  assert.equal(feedback.reverse(proposal.id,{operationId:'reverse-inherited',confirmed:true,confirmHardExclusion:true}).proposal.status,'reversed');
 }finally{app.close();rmSync(root,{recursive:true,force:true});}
});
