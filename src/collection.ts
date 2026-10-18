import {createHash,randomUUID} from 'node:crypto';
import {AppError,CareerVistaApp} from './app.ts';
import {ProfilesService} from './profiles.ts';
import {RunsService} from './runs.ts';
import {seekAdapter} from './sources/seek.ts';
import type {ApiRoute} from './server.ts';
export interface CollectionAdapter {id:string;name:string;searchUrl(keyword:string,config:{location?:string}):string;listingUrl(input:string):string;acceptsPage(input:string):boolean}
export interface SourcePlan {id:string;runId:string;source:string;config:{location?:string};searches:{workKey:string;trackId:string;keyword:string;url:string}[];createdAt:string}
export interface Destination {kind:'employer'|'application';url:string;label:string}
const digest=(input:unknown):string=>createHash('sha256').update(canonical(input)).digest('hex');
function canonical(input:unknown):string {if(Array.isArray(input))return `[${input.map(canonical).join(',')}]`;if(input&&typeof input==='object')return `{${Object.keys(input).sort().map(key=>`${JSON.stringify(key)}:${canonical((input as Record<string,unknown>)[key])}`).join(',')}}`;return JSON.stringify(input);}
const key=(...parts:string[])=>`source-${digest(parts).slice(0,40)}`;
function record(input:unknown):asserts input is Record<string,any>{if(!input||typeof input!=='object'||Array.isArray(input))throw new AppError('Supply a collection JSON object.');}
function text(value:unknown,name:string,max=8000):asserts value is string{if(typeof value!=='string'||!value.trim()||value.length>max)throw new AppError(`${name} must be non-empty text up to ${max} characters.`);}
function only(input:Record<string,any>,fields:string[]){if(Object.keys(input).some(name=>!fields.includes(name)))throw new AppError('Unsupported collection fields. Supply no credentials, cookies or raw provider errors.');}
function url(input:unknown):string{text(input,'url');let value:URL;try{value=new URL(input);}catch{throw new AppError('Supply a complete HTTP(S) URL.');}if(!['http:','https:'].includes(value.protocol)||value.username||value.password)throw new AppError('URL must use HTTP(S) without credentials.');return value.href;}
export class SourceCollection {
 readonly app:CareerVistaApp;readonly adapters:CollectionAdapter[];
 constructor(app:CareerVistaApp,adapters:CollectionAdapter[]=[seekAdapter]){this.app=app;this.adapters=adapters;}
 destinations(jobId:string):Destination[]{this.app.getJob(jobId);return this.app.database.prepare('SELECT destinations_json FROM collection_captures WHERE job_id=? ORDER BY rowid').all(jobId).flatMap(row=>JSON.parse(String(row.destinations_json)) as Destination[]);}
 private adapter(source:string){const adapter=this.adapters.find(item=>item.id===source);if(!adapter)throw new AppError('This source has no registered supervised collection adapter. Use manual capture.');return adapter;}
 get(runId:string){new RunsService(this.app).get(runId);const db=this.app.database;return {plans:db.prepare('SELECT plan_json FROM collection_plans WHERE run_id=? ORDER BY rowid').all(runId).map(row=>JSON.parse(String(row.plan_json)) as SourcePlan),events:db.prepare('SELECT search_key AS searchKey,outcome,found_count AS foundCount,created_at AS createdAt FROM collection_events WHERE run_id=? ORDER BY rowid').all(runId),listings:db.prepare('SELECT plan_id AS planId,search_key AS searchKey,work_key AS workKey,source,url,job_id AS jobId FROM collection_listings WHERE run_id=? ORDER BY rowid').all(runId).map(row=>({planId:String(row.planId),searchKey:String(row.searchKey),workKey:String(row.workKey),source:String(row.source),url:String(row.url),jobId:row.jobId===null?null:String(row.jobId)}))};}
 plan(runId:string,input:unknown):SourcePlan{
  record(input);only(input,['operationId','source','config']);text(input.operationId,'operationId',128);text(input.source,'source',128);record(input.config);only(input.config,['location']);if(input.config.location!==undefined)text(input.config.location,'location');
  const runs=new RunsService(this.app),run=runs.get(runId),adapter=this.adapter(input.source);if(!run.sources.includes(adapter.id))throw new AppError('Select this source in the run before planning searches.');
  const db=this.app.database,existing=db.prepare('SELECT input_hash,plan_json FROM collection_plans WHERE run_id=? AND operation_id=?').get(runId,input.operationId);
  let plan:SourcePlan;
  if(existing){if(existing.input_hash!==digest(input))throw new AppError('Collection plan identifier already has different settings.',409,'idempotency_conflict');plan=JSON.parse(String(existing.plan_json));}
  else{
   if(run.status!=='running')throw new AppError('Resume the run before planning browser work.');
   const profile=new ProfilesService(this.app).getProfile(run.profileVersion),id=randomUUID();
   const searches=profile.tracks.filter(track=>run.trackIds.includes(track.id)).flatMap(track=>[...new Set([...track.titles,...track.keywords])].map(keyword=>({workKey:key(id,track.id,keyword),trackId:track.id,keyword,url:adapter.searchUrl(keyword,input.config)})));
   if(searches.length>100)throw new AppError('This plan exceeds 100 approved searches. Choose fewer tracks or approve a smaller set of variants. No variants have been silently discarded.');
   plan={id,runId,source:adapter.id,config:structuredClone(input.config),searches,createdAt:new Date().toISOString()};
   db.prepare('INSERT INTO collection_plans VALUES (?,?,?,?,?,?)').run(id,runId,input.operationId,digest(input),adapter.id,JSON.stringify(plan));
  }
  for(const search of plan.searches)runs.enqueue(runId,{operationId:key('queue-search',search.workKey),workKey:search.workKey,trackId:search.trackId,source:plan.source,url:search.url});
  return plan;
 }
 prepare(runId:string,input:unknown){record(input);only(input,['operationId','workKey','modelWork','reservationId']);text(input.workKey,'workKey',128);const state=this.get(runId);if(!state.plans.some(plan=>plan.searches.some(search=>search.workKey===input.workKey))&&!state.listings.some(listing=>listing.workKey===input.workKey))throw new AppError('Plan this source search or discover its listing before browser work.');return new RunsService(this.app).authorize(runId,input);}
 discover(runId:string,input:unknown){
  record(input);only(input,['operationId','searchKey','outcome','listings']);text(input.operationId,'operationId',128);text(input.searchKey,'searchKey',128);
  if(!['results','zero-results','access-failure'].includes(input.outcome))throw new AppError('Distinguish results, zero-results and access-failure explicitly.');
  const state=this.get(runId),plan=state.plans.find(plan=>plan.searches.some(search=>search.workKey===input.searchKey));if(!plan)throw new AppError('Unknown planned source search.');const search=plan.searches.find(search=>search.workKey===input.searchKey)!;
  const adapter=this.adapter(plan.source),runs=new RunsService(this.app),run=runs.get(runId),work=run.work.find(work=>work.workKey===search.workKey)!;
  const db=this.app.database,existing=db.prepare('SELECT input_hash FROM collection_events WHERE run_id=? AND operation_id=?').get(runId,input.operationId);
  if(existing&&existing.input_hash!==digest(input))throw new AppError('Discovery identifier already has different results.',409,'idempotency_conflict');
  if(!existing&&work.status!=='working')throw new AppError('Authorize this search before opening the browser or reporting results.');
  const listings=input.listings??[];if(!Array.isArray(listings)||listings.length>run.limit)throw new AppError('Submit at most the run listing limit in one discovery page. Keep remaining results for a later approved search.');
  if(input.outcome==='results'&&!listings.length)throw new AppError('Results need at least one observed listing URL; use zero-results only for a successful empty search.');
  if(input.outcome!=='results'&&listings.length)throw new AppError('Zero-results/access-failure cannot contain discovered listings.');
  const canonicalUrls=[...new Set(listings.map(listing=>{record(listing);only(listing,['url']);return adapter.listingUrl(url(listing.url));}))];
  if(!existing)db.prepare('INSERT INTO collection_events VALUES (?,?,?,?,?,?,?)').run(runId,input.operationId,digest(input),search.workKey,input.outcome,canonicalUrls.length,new Date().toISOString());
  for(const listingUrl of canonicalUrls){const workKey=key(runId,plan.source,listingUrl);runs.enqueue(runId,{operationId:key('queue-listing',workKey),workKey,trackId:search.trackId,source:plan.source,url:listingUrl});db.prepare('INSERT OR IGNORE INTO collection_listings VALUES (?,?,?,?,?,?,NULL)').run(runId,plan.id,search.workKey,workKey,plan.source,listingUrl);}
  runs.checkpoint(runId,{operationId:key('search-checkpoint',input.operationId),workKey:search.workKey,status:input.outcome==='access-failure'?'failed':'searched',...(input.outcome==='access-failure'?{errorCode:'unavailable'}:{})});
  return this.get(runId);
 }
 capture(runId:string,input:unknown){
  record(input);only(input,['operationId','workKey','capturedAt','title','company','location','text','links','partial']);text(input.operationId,'operationId',128);text(input.workKey,'workKey',128);
  const state=this.get(runId),listing=state.listings.find(item=>item.workKey===input.workKey);if(!listing)throw new AppError('Discover this listing through its approved source plan before capture.');
  const runs=new RunsService(this.app),run=runs.get(runId),work=run.work.find(item=>item.workKey===listing.workKey)!;
  const db=this.app.database,existing=db.prepare('SELECT * FROM collection_captures WHERE run_id=? AND work_key=?').get(runId,input.workKey);
  const {operationId,...content}=input;
  if(existing){if(existing.input_hash!==digest(content))throw new AppError('This source capture already has different content. Save a new observation revision instead of overwriting it.',409,'idempotency_conflict');const job=this.app.getJob(String(existing.job_id));db.prepare('UPDATE collection_listings SET job_id=? WHERE run_id=? AND work_key=?').run(job.id,runId,work.workKey);runs.checkpoint(runId,{operationId:key('capture-checkpoint',runId,work.workKey),workKey:work.workKey,status:existing.completion==='complete'?'collected':'failed',jobId:job.id,...(existing.completion==='partial'?{errorCode:'malformed_output'}:{})});return {job,observation:job.observations.find(item=>item.id===existing.observation_id)!,completion:String(existing.completion),destinations:JSON.parse(String(existing.destinations_json)) as Destination[]};}
  if(work.status!=='working')throw new AppError('Authorize this listing before browser capture.');
  const saved=this.app.saveObservation({ingestionId:work.ingestionId,source:String(listing.source),sourceUrl:String(listing.url),capturedAt:input.capturedAt,title:input.title,company:input.company,...(input.location!==undefined?{location:input.location}:{}),text:input.text,context:{method:'supervised-browser',planId:listing.planId,workKey:listing.workKey}});
  let completion='complete',destinations:Destination[]=[];
  try{
   if(input.partial!==undefined&&typeof input.partial!=='boolean')throw new AppError('partial must be boolean.');
   if(input.partial)completion='partial';const links=input.links??[];if(!Array.isArray(links)||links.length>20)throw new AppError('Supply at most 20 observed destinations.');
   destinations=links.map(link=>{record(link);only(link,['kind','url','label']);if(!['employer','application'].includes(link.kind))throw new AppError('Destination kind must be employer or application.');text(link.label,'destination label');if(!saved.observation.text.includes(link.label))throw new AppError('Destination label must appear in the saved readable evidence.');return {kind:link.kind,url:url(link.url),label:link.label};});
  }catch{completion='partial';destinations=[];}
  db.prepare('INSERT INTO collection_captures VALUES (?,?,?,?,?,?,?)').run(runId,work.workKey,digest(content),saved.job.id,saved.observation.id,completion,JSON.stringify(destinations));
  db.prepare('UPDATE collection_listings SET job_id=? WHERE run_id=? AND work_key=?').run(saved.job.id,runId,work.workKey);
  runs.checkpoint(runId,{operationId:key('capture-checkpoint',runId,work.workKey),workKey:work.workKey,status:completion==='complete'?'collected':'failed',jobId:saved.job.id,...(completion==='partial'?{errorCode:'malformed_output'}:{})});
  return {...saved,completion,destinations};
 }
}
export function collectionRoutes(adapters:CollectionAdapter[]=[seekAdapter]):ApiRoute{return async({app,request,url,json,send})=>{
 const destination=/^\/api\/v1\/jobs\/([^/]+)\/destinations$/.exec(url.pathname);if(request.method==='GET'&&destination){send(new SourceCollection(app,adapters).destinations(decodeURIComponent(destination[1]!)));return true;}
 const match=/^\/api\/v1\/runs\/([^/]+)\/collection(?:\/(plans|prepare|discover|capture))?$/.exec(url.pathname);if(!match)return false;const runId=decodeURIComponent(match[1]!),service=new SourceCollection(app,adapters);
 if(request.method==='GET'&&!match[2]){send(service.get(runId));return true;}
 if(request.method==='POST'&&match[2]){const methods={plans:'plan',prepare:'prepare',discover:'discover',capture:'capture'} as const;send(service[methods[match[2] as keyof typeof methods]](runId,await json()));return true;}return false;
};}
