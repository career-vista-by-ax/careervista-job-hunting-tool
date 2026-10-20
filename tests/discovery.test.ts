import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerVistaApp } from '../src/app.ts';
import { ProfilesService } from '../src/profiles.ts';
import { RunsService } from '../src/runs.ts';
import { SourceCollection, collectionRoutes } from '../src/collection.ts';
import { discover } from '../src/tools/discover.ts';
import { Backups } from '../src/backup.ts';
import { startServer } from '../src/server.ts';

function fixture(app: CareerVistaApp, source='seek', discoveryLimit=5) {
  const profiles=new ProfilesService(app),draft=profiles.createDraft({name:'Engineering',demonstratedExperience:[],aspirations:[],preferences:[],tracks:[{id:'ic',name:'IC',titles:['Principal Analytics Engineer','Staff Analytics Engineer'],keywords:['dbt'],preferences:[]}]});
  profiles.approve(draft.version);
  const runs=new RunsService(app),run=runs.create({requestId:'run',profileVersion:draft.version,trackIds:['ic'],sources:[source],limit:1,discoveryLimit,budget:{amount:0,currency:'AUD'}});
  const collection=new SourceCollection(app),plan=collection.plan(run.id,{operationId:'plan',source,config:source==='employer'?{origin:'https://jobs.lever.co'}:{}});
  return {runs,run,collection,plan};
}
test('discovery screens many previews before a single detailed capture, deduplicates variants and survives restart/recovery',()=>{
  const root=mkdtempSync(join(tmpdir(),'cv-discovery-'));let app=new CareerVistaApp({root});
  try{
    const {run,collection,plan}=fixture(app),search=plan.searches[0]!;
    collection.prepare(run.id,{operationId:'search',workKey:search.workKey,modelWork:false});
    const input={operationId:'discover',searchKey:search.workKey,outcome:'results',deferCapture:true,listings:[1,2,3].map(id=>({url:`https://www.seek.com.au/job/${id}`,title:`Engineer ${id}`,snippet:'Untrusted preview, not full listing evidence.'}))};
    collection.discover(run.id,input);collection.discover(run.id,input);
    assert.equal(collection.get(run.id).listings.length,0);assert.equal(app.listJobs().length,0);
    assert.equal(new RunsService(app).get(run.id).counters.newJobs,0);
    assert.equal(collection.candidates(run.id).length,3);
    const second=plan.searches[1]!;collection.prepare(run.id,{operationId:'search-2',workKey:second.workKey,modelWork:false});
    collection.discover(run.id,{...input,operationId:'variant',searchKey:second.workKey,listings:[{url:'https://au.seek.com/job/1?tracking=duplicate'}]});
    assert.equal(collection.candidates(run.id).length,3);
    const [first,other]=collection.candidates(run.id);
    assert.throws(()=>collection.select(run.id,{operationId:'too-many',decisions:[first!,other!].map(item=>({workKey:item.workKey,disposition:'selected',reason:'Relevant'}))}),/limit/);
    assert.equal(collection.get(run.id).listings.length,0);
    const selection={operationId:'select',decisions:[{workKey:first!.workKey,disposition:'selected',reason:'Prioritise technical ownership.'},{workKey:other!.workKey,disposition:'skipped',reason:'Preview suggests unrelated role.'}]};
    collection.select(run.id,selection);collection.select(run.id,selection);
    assert.throws(()=>collection.select(run.id,{...selection,decisions:[]}),/decisions/);
    assert.throws(()=>collection.select(run.id,{operationId:'change-selected',decisions:[{workKey:first!.workKey,disposition:'skipped',reason:'Changed'}]}),/already queued/);
    collection.prepare(run.id,{operationId:'open',workKey:first!.workKey,modelWork:false});
    assert.throws(()=>collection.capture(run.id,{operationId:'bad-method',workKey:first!.workKey,captureMethod:'stealth-browser'}),/captureMethod/);
    const capture=collection.capture(run.id,{operationId:'capture',workKey:first!.workKey,captureMethod:'headless-browser',title:'Principal Analytics Engineer',company:'Example',text:'Own the dbt platform.',capturedAt:new Date().toISOString()});
    assert.equal(capture.observation.context.method,'headless-browser');
    // Search coverage can continue even after the detailed capture quota has been filled.
    const third=plan.searches[2]!;collection.prepare(run.id,{operationId:'search-3',workKey:third.workKey,modelWork:false});
    collection.discover(run.id,{operationId:'third',searchKey:third.workKey,outcome:'zero-results',deferCapture:true});
    app.close();app=new CareerVistaApp({root});
    assert.equal(new SourceCollection(app).candidates(run.id)[0]!.jobId,capture.job.id);
    const restoredRoot=mkdtempSync(join(tmpdir(),'cv-discovery-restored-'));const restored=new CareerVistaApp({root:restoredRoot});
    try{new Backups(restored).restore(new Backups(app).create());assert.deepEqual(new SourceCollection(restored).candidates(run.id),new SourceCollection(app).candidates(run.id));}finally{restored.close();rmSync(restoredRoot,{recursive:true,force:true});}
    new RunsService(app).forgetJob(capture.job.id);
    assert.equal(new SourceCollection(app).candidates(run.id).some(item=>item.workKey===first!.workKey),false);
  }finally{app.close();rmSync(root,{recursive:true,force:true});}
});
test('preview discovery validates origins and limits, preserves pending evidence, and rejects changed retries',async()=>{
  const root=mkdtempSync(join(tmpdir(),'cv-discovery-http-')),app=new CareerVistaApp({root});
  const server=await startServer(app,{port:0,routes:[collectionRoutes()]});
  try{
    const {run,collection,plan}=fixture(app,'employer',2),search=plan.searches[0]!;
    collection.prepare(run.id,{operationId:'search',workKey:search.workKey,modelWork:false});
    const input={operationId:'discover',searchKey:search.workKey,outcome:'results',deferCapture:true,listings:[{url:'https://evil.example/job',title:'Engineer'}]};
    assert.throws(()=>collection.discover(run.id,input),/approved origin/);
    assert.throws(()=>collection.discover(run.id,{...input,listings:[1,2,3].map(id=>({url:`https://jobs.lever.co/company/${id}`}))}),/limit/);
    const good={...input,listings:[{url:'https://jobs.lever.co/company/1',title:'Engineer',snippet:'dbt'}]};
    const response=await fetch(`${server.url}/api/v1/runs/${run.id}/collection/discover`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(good)});assert.equal(response.status,200);
    const previews=await (await fetch(`${server.url}/api/v1/runs/${run.id}/collection/candidates`)).json();assert.equal(previews[0].preview.title,'Engineer');
    assert.throws(()=>collection.discover(run.id,{...good,listings:[{...good.listings[0],title:'Changed'}]}),/different results/);
    assert.equal(app.listJobs().length,0);
    const candidate=collection.candidates(run.id)[0]!;
    collection.select(run.id,{operationId:'select',decisions:[{workKey:candidate.workKey,disposition:'selected',reason:'Review the full public evidence.'}]});
    collection.prepare(run.id,{operationId:'capture',workKey:candidate.workKey,modelWork:false});
    const capture={operationId:'capture',workKey:candidate.workKey,title:'Engineer',company:'Company',text:'Build dbt models.',capturedAt:new Date().toISOString(),apiContext:{method:'public-api',provider:'lever',endpoint:'https://api.lever.co/v0/postings/company?mode=json'}};
    assert.throws(()=>collection.capture(run.id,{...capture,apiContext:{...capture.apiContext,endpoint:capture.apiContext.endpoint+'&token=secret'}}),/token parameters/);
    assert.equal(app.listJobs().length,0);
    assert.throws(()=>collection.capture(run.id,{...capture,captureMethod:'headless-http'}),/not both/);
    const saved=collection.capture(run.id,capture);assert.equal(saved.observation.context.method,'public-api');assert.equal(saved.observation.context.endpoint,capture.apiContext.endpoint);assert.equal(String(saved.observation.context.contentHash).length,64);
  }finally{await server.close();app.close();rmSync(root,{recursive:true,force:true});}
});
test('public ATS collector fetches once per Greenhouse board, paginates Lever and keeps unknown location eligibility',async()=>{
  const calls:string[]=[];
  const fetcher=(async (url:string)=>{
    calls.push(url);
    if(url.includes('greenhouse'))return Response.json({jobs:[{id:1,title:'Staff Data Engineer',location:{name:'Melbourne'},absolute_url:'https://example.org/jobs/1',content:'&lt;p&gt;Own dbt &amp; data products.&lt;/p&gt;&lt;p&gt;Salary undisclosed.&lt;/p&gt;'},{id:2,title:'Chef',absolute_url:'https://example.org/jobs/2',content:'Cook food.'}]});
    if(url.includes('skip=100'))return Response.json([]);
    return Response.json(Array.from({length:100},(_,id)=>({id,text:'Analytics Engineer',categories:{location:id===0?'Unknown':'Sydney',allLocations:id===0?['Unknown']:['Sydney','Melbourne'],commitment:'Full time'},hostedUrl:`https://jobs.lever.co/company/${id}`,descriptionPlain:'Build dbt models.',lists:[{text:'Requirements',content:'<li>SQL</li><li>Testing</li>'}],additionalPlain:'Work remotely within Australia.',workplaceType:'remote',salaryRange:{currency:'AUD',interval:'year',min:210000,max:250000}})));
  }) as unknown as typeof fetch;
  const result=await discover({boards:[{source:'greenhouse',board:'example',company:'Example'},{source:'lever',board:'company',company:'Company'}],keywords:['dbt','data engineer'],locations:['Melbourne','Australia'],limit:200},fetcher);
  assert.equal(calls.length,3);assert.equal(result.counts.fetched,102);assert.equal(result.candidates.length,101);
  assert.match(result.candidates.find(item=>item.company==='Example')!.text,/Own dbt & data products/);
  assert.doesNotMatch(result.candidates.find(item=>item.company==='Example')!.text,/<p>/);
  assert.match(result.candidates.find(item=>item.company==='Company')!.text,/Requirements\n\n?SQL\nTesting/);
  assert.equal(result.candidates.find(item=>item.company==='Example')!.locationMatch,true);
  // Location match is a ranking hint, never an Australian hiring eligibility verdict.
  assert.equal(result.candidates.find(item=>item.sourceUrl.endsWith('/0'))!.locationMatch,false);
  assert.ok(result.candidates.every(item=>item.contentHash.length===64));
});
test('collector bounds network concurrency, keeps partial success and rejects unknown endpoint configuration',async()=>{
  let inFlight=0,peak=0;
  const fetcher=(async (url:string)=>{inFlight++;peak=Math.max(peak,inFlight);await new Promise(resolve=>setTimeout(resolve,5));inFlight--;return url.includes('/bad/')?new Response('',{status:403}):Response.json({jobs:[]});}) as unknown as typeof fetch;
  const result=await discover({boards:['one','two','three','four','bad'].map(board=>({source:'greenhouse',board,company:board})),keywords:['nurse']},fetcher);
  assert.equal(peak,3);assert.equal(result.reports.filter(report=>report.status==='failed').length,1);assert.equal(result.reports.at(0)!.error,'access-blocked');
  await assert.rejects(discover({boards:[{source:'greenhouse',board:'../../secret',company:'X'}],keywords:['dbt']},fetcher),/board/);
});
