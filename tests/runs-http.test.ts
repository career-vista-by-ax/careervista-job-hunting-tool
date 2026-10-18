import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerVistaApp } from '../src/app.ts';
import { ProfilesService } from '../src/profiles.ts';
import { runsRoute } from '../src/runs.ts';
import { startServer } from '../src/server.ts';

test('agent HTTP run transport reserves budget before work and exposes durable actionable failure checkpoints', async () => {
 const root = mkdtempSync(join(tmpdir(),'cv-runs-http-')); const app = new CareerVistaApp({root});
 const profileService = new ProfilesService(app);
 const profile = profileService.createDraft({name:'Electrician',demonstratedExperience:[],aspirations:[],preferences:[],tracks:[{id:'trade',name:'Electrical trades',titles:['Electrician'],keywords:[],preferences:[]}]}); profileService.approve(profile.version);
 const server = await startServer(app,{port:0,routes:[runsRoute]});
 const post = (path:string,input:unknown) => fetch(server.url + '/api/v1' + path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
 try {
  const created = await post('/runs',{requestId:'http-run',profileVersion:profile.version,trackIds:['trade'],sources:['custom'],budget:{amount:1,currency:'USD'}});
  assert.equal(created.status,201); const run = await created.json() as {id:string;limit:number}; assert.equal(run.limit,25);
  const base = `/runs/${run.id}`;
  await post(base+'/queue',{operationId:'q',workKey:'listing',trackId:'trade',source:'custom',url:'https://example.com/electrician'});
  const denied = await post(base+'/authorize',{operationId:'denied',workKey:'listing',modelWork:true}); assert.equal(denied.status,400);
  const reserved = await post(base+'/reservations',{operationId:'r',workKey:'listing',estimate:0.5,currency:'USD'});
  const result = await reserved.json() as {reservations:{id:string}[]};
  assert.equal((await post(base+'/authorize',{operationId:'a',workKey:'listing',modelWork:true,reservationId:result.reservations[0]!.id})).status,200);
  const failed = {operationId:'f',workKey:'listing',status:'failed',errorCode:'provider_failure'};
  await post(base+'/checkpoints',failed); await post(base+'/checkpoints',failed);
  await post(base+'/costs',{operationId:'cost',reservationId:result.reservations[0]!.id,actual:0.2});
  const detail = await (await fetch(server.url+'/api/v1'+base)).json() as {counters:{failed:number};costs:{known:number;reserved:number};errors:{message:string}[]};
  assert.equal(detail.counters.failed,1); assert.equal(detail.costs.known,0.2); assert.equal(detail.costs.reserved,0); assert.match(detail.errors[0]!.message,/provider|Provider/);
  const bad = await post(base+'/control',{operationId:'bad-secret',action:'pause',password:'never-retain'}); assert.equal(bad.status,400);
  assert.ok(!JSON.stringify(await (await fetch(server.url+'/api/v1'+base)).json()).includes('never-retain'));
  assert.equal((await post('/runs/storage/cleanup',{})).status,200);
 } finally {await server.close();app.close();rmSync(root,{recursive:true,force:true});}
});
