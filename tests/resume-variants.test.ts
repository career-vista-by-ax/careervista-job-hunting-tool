import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CareerVistaApp} from '../src/app.ts';
import {ResumeService,resumeRoutes} from '../src/resume.ts';
import {ResumeVariants,resumeVariantRoutes} from '../src/resume-variants.ts';
import {Backups} from '../src/backup.ts';
import {DataLifecycle} from '../src/datalifecycle.ts';
import {startServer} from '../src/server.ts';

function base(app:CareerVistaApp,id='base') {
  const resumes=new ResumeService(app);
  const source=resumes.importResume({importId:id,label:'Parsed CV',format:'txt',text:'Jordan Example\nOwned the dbt analytics platform and coached engineers.'}).resume;
  const payload=resumes.reviewPayload(source.id,{operationId:`${id}-review`,text:resumes.payloadPreview(source.id).text,confirmed:true});
  return {source,payload};
}
test('parsed base CV and independently versioned CV/letter recommendations remain reusable after restart and backup',()=>{
  const root=mkdtempSync(join(tmpdir(),'cv-reusable-'));let app=new CareerVistaApp({root:join(root,'source')});const restored=new CareerVistaApp({root:join(root,'restored')});
  try{
    const {source,payload}=base(app);const drafts=new ResumeVariants(app);
    const input={operationId:'cv-1',baseResumeId:source.id,payloadId:payload.id,kind:'resume' as const,label:'Staff analytics CV',text:'Owned the dbt analytics platform and coached engineers.',changeSummary:'Prioritised confirmed analytics ownership.',metadata:{agent:'test-host',analysisVersion:'1'}};
    const first=drafts.save(input);assert.equal(drafts.save(input).replayed,true);
    const second=drafts.save({...input,operationId:'cv-2',parentVariantId:first.variant.id,text:'Experience\nOwned the dbt analytics platform and coached engineers.',changeSummary:'Added a clearer section heading.'}).variant;
    const letter=drafts.save({...input,operationId:'letter-1',kind:'cover_letter',label:'Cover letter draft',text:'My experience includes owning the dbt analytics platform.',changeSummary:'Separate letter based on confirmed experience.'}).variant;
    const advice=drafts.save({...input,operationId:'advice-1',kind:'recommendations',label:'Recommendations',text:'Ask whether the confirmed coaching experience included hiring responsibilities; do not claim it yet.',changeSummary:'Unverified suggestion retained as advice.'}).variant;
    assert.equal(new ResumeService(app).getResume(source.id).text,source.text);assert.equal(drafts.get(first.variant.id).text,input.text);
    assert.throws(()=>drafts.save({...input,text:'Overwritten'}),/operationId/);
    assert.equal(drafts.list(source.id).length,4);assert.ok(drafts.list().every(item=>!('text' in item)));
    app.close();app=new CareerVistaApp({root:join(root,'source')});
    assert.equal(new ResumeService(app).agentPayload(payload.id).text,payload.text);
    assert.equal(new ResumeVariants(app).get(second.id).parentVariantId,first.variant.id);
    new Backups(restored).restore(new Backups(app).create());
    for(const variant of [first.variant,second,letter,advice])assert.deepEqual(new ResumeVariants(restored).get(variant.id),variant);
  }finally{app.close();restored.close();rmSync(root,{recursive:true,force:true});}
});
test('drafts require reviewed base lineage and survive job deletion as reusable documents',()=>{
  const root=mkdtempSync(join(tmpdir(),'cv-draft-lineage-'));const app=new CareerVistaApp({root});
  try{
    const first=base(app),other=base(app,'other');const variants=new ResumeVariants(app);
    const job=app.saveObservation({ingestionId:'staff-job',title:'Staff Analytics Engineer',company:'Synthetic employer',source:'manual',sourceUrl:'https://example.com/staff',capturedAt:'2026-10-19T00:00:00Z',text:'Own the dbt platform.'}).job;
    const input={operationId:'draft',baseResumeId:first.source.id,payloadId:first.payload.id,jobId:job.id,kind:'resume' as const,label:'Staff CV',text:'Owned the dbt analytics platform.',changeSummary:'Emphasised existing evidence.',metadata:{agent:'test-host',analysisVersion:'1'}};
    assert.throws(()=>variants.save({...input,payloadId:first.source.id}),/reviewed payload/i);
    assert.throws(()=>variants.save({...input,payloadId:other.payload.id}),/belong/);
    const parent=variants.save({...input,operationId:'other-parent',baseResumeId:other.source.id,payloadId:other.payload.id}).variant;
    assert.throws(()=>variants.save({...input,parentVariantId:parent.id}),/same base/);
    const saved=variants.save(input).variant;
    new DataLifecycle(app).deleteJobs({jobIds:[job.id],confirmation:'DELETE_SELECTED_JOBS'});
    assert.equal(variants.get(saved.id).jobId,null);assert.equal(variants.get(saved.id).targetJob?.title,job.title);
    assert.equal(variants.save(input).replayed,true,'An unchanged retry remains safe after its job was removed.');
    assert.equal(new ResumeService(app).getResume(first.source.id).text,first.source.text);
  }finally{app.close();rmSync(root,{recursive:true,force:true});}
});
test('variant HTTP API retrieves reusable drafts while list responses omit full text',async()=>{
  const root=mkdtempSync(join(tmpdir(),'cv-draft-http-'));const app=new CareerVistaApp({root});const server=await startServer(app,{port:0,routes:[resumeVariantRoutes,resumeRoutes]});
  try{
    const {source,payload}=base(app);const input={operationId:'letter',baseResumeId:source.id,payloadId:payload.id,kind:'cover_letter',label:'Letter',text:'Synthetic letter for review.',changeSummary:'First draft.',metadata:{agent:'test-host',analysisVersion:'1'}};
    const post=()=>fetch(`${server.url}/api/v1/resume-variants`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
    const response=await post();assert.equal(response.status,201);const {variant}=await response.json();assert.equal(variant.status,'draft');assert.equal((await post()).status,200);
    const listing=await(await fetch(`${server.url}/api/v1/resume-variants?baseResumeId=${source.id}`)).json();assert.equal(listing[0].text,undefined);
    assert.equal((await(await fetch(`${server.url}/api/v1/resume-variants/${variant.id}`)).json()).text,input.text);
  }finally{await server.close();app.close();rmSync(root,{recursive:true,force:true});}
});
