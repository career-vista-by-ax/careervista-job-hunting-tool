import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CareerVistaApp} from '../src/app.ts';
import {CompanyResearch} from '../src/company.ts';
import {Backups} from '../src/backup.ts';
test('company investigation retains conflicting attributed reports and uncertain names without declaring culture facts',()=>{
 const root=mkdtempSync(join(tmpdir(),'cv-company-')),restoreRoot=mkdtempSync(join(tmpdir(),'cv-company-restore-'));let app=new CareerVistaApp({root});const restored=new CareerVistaApp({root:restoreRoot});
 try {
  const {job}=app.saveObservation({ingestionId:'nurse',source:'employer',sourceUrl:'https://hospital.test/careers/1',capturedAt:'2026-10-18T00:00:00Z',title:'Registered nurse',company:'Care Hospital',text:'Registered nurse. Flexible shifts.'});
  const service=new CompanyResearch(app),request=service.request(job.id,{operationId:'request',topics:['benefits','workplace'],sources:['https://reports.test/care-hospital']});
  const first=service.capture(job.id,{operationId:'first',requestId:request.id,sourceUrl:'https://reports.test/care-hospital',capturedAt:'2026-10-18T01:00:00Z',topic:'workplace',kind:'external_report',companyName:'Care Hospital',linkage:'confirmed',linkageReason:'Report identifies the same hospital and street address.',context:'Anonymous nursing review, date unknown',text:'Our team chose its own shifts.',quote:'Our team chose its own shifts.'});
  service.capture(job.id,{operationId:'second',requestId:request.id,sourceUrl:'https://reports.test/care-hospital',capturedAt:'2026-10-18T02:00:00Z',topic:'workplace',kind:'external_report',companyName:'Care Hospital',linkage:'uncertain',linkageReason:'Same name; city is not identified.',context:'Another anonymous report',text:'Managers set all shifts.',quote:'Managers set all shifts.'});
  service.summarize(job.id,{operationId:'summary',requestId:request.id,agent:'Codex controlled fixture',summary:'Reports conflict about scheduling; company match for the second report is uncertain.',evidenceIds:service.history(job.id).reports.map(r=>r.id),unknowns:['Which team and site this vacancy belongs to']});
  assert.equal(first.report.kind,'external_report');assert.equal(service.history(job.id).reports.length,2);assert.equal(service.history(job.id).reports[1]?.linkage,'uncertain');assert.equal(service.history(job.id).summaries[0]?.unknowns.length,1);
  assert.throws(()=>service.summarize(job.id,{operationId:'unbacked',requestId:request.id,agent:'fixture',summary:'Verified autonomy',evidenceIds:['missing'],unknowns:[]}));
  const backup=new Backups(app).create();new Backups(restored).restore(backup);assert.deepEqual(new CompanyResearch(restored).history(job.id),service.history(job.id));
  app.close();app=new CareerVistaApp({root});assert.equal(new CompanyResearch(app).history(job.id).reports[0]?.text,'Our team chose its own shifts.');
 }finally{app.close();restored.close();rmSync(root,{recursive:true,force:true});rmSync(restoreRoot,{recursive:true,force:true});}
});
test('company sources pause for human participation and unavailable or mismatched reports do not become supporting evidence',()=>{
 const root=mkdtempSync(join(tmpdir(),'cv-company-access-')),app=new CareerVistaApp({root});
 try{const {job}=app.saveObservation({ingestionId:'chef',source:'employer',sourceUrl:'https://restaurant.test/chef',capturedAt:'2026-10-18T00:00:00Z',title:'Chef',company:'Harbour Kitchen',text:'Chef required.'});const service=new CompanyResearch(app),request=service.request(job.id,{operationId:'r',topics:['salary'],sources:['https://reviews.test/harbour']});const pause={operationId:'pause',requestId:request.id,sourceUrl:'https://reviews.test/harbour',status:'authentication' as const,sessionRef:'opaque-browser-session-1'};service.access(job.id,pause);assert.deepEqual(service.access(job.id,pause),service.history(job.id).access[0]);
 const report={operationId:'capture',requestId:request.id,sourceUrl:pause.sourceUrl,capturedAt:'2026-10-18T01:00:00Z',topic:'salary' as const,kind:'external_report' as const,companyName:'Harbour Kitchen',linkage:'mismatch' as const,linkageReason:'Report is for a different country and business.',context:'Anonymous salary report',text:'Chef salary $40/hour.',quote:'$40/hour'};
 assert.throws(()=>service.capture(job.id,report),/Wait for user/);assert.throws(()=>service.access(job.id,{...pause,operationId:'wrong',status:'resumed',sessionRef:'other',userConfirmed:true}),/same paused/);
 service.access(job.id,{...pause,operationId:'resume',status:'resumed',userConfirmed:true});const {report:saved}=service.capture(job.id,report);assert.throws(()=>service.summarize(job.id,{operationId:'s',requestId:request.id,agent:'fixture',summary:'Salary known',evidenceIds:[saved.id],unknowns:[]}),/mismatched/);
 service.access(job.id,{operationId:'blocked',requestId:request.id,sourceUrl:pause.sourceUrl,status:'unavailable'});assert.equal(service.history(job.id).access.at(-1)?.status,'unavailable');assert.equal(service.history(job.id).reports.length,1);
 assert.throws(()=>service.capture(job.id,{...report,operationId:'unexpected-source',sourceUrl:'https://unselected.test/report'}),/new reviewed/);
 }finally{app.close();rmSync(root,{recursive:true,force:true});}
});
