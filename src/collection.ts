import {vacancyIdentity} from './reconciliation-state.ts';
import {customAdapters} from './custom-sources.ts';
import {createHash,randomUUID} from 'node:crypto';
import {AppError,CareerVistaApp} from './app.ts';
import {ProfilesService} from './profiles.ts';
import {RunsService} from './runs.ts';
import {seekAdapter} from './sources/seek.ts';
import {linkedinAdapter} from './sources/linkedin.ts';
import {employerAdapter} from './sources/employer.ts';
import type {ApiRoute} from './server.ts';
export interface CollectionAdapter {id:string;name:string;searchUrl(keyword:string,config:{location?:string;origin?:string}):string;listingUrl(input:string):string;acceptsPage(input:string):boolean}
export interface SourcePlan {id:string;runId:string;source:string;config:{location?:string;origin?:string};searches:{workKey:string;trackId:string;keyword:string;url:string}[];createdAt:string}
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
 constructor(app:CareerVistaApp,adapters?:CollectionAdapter[]){this.app=app;this.adapters=adapters??[seekAdapter,linkedinAdapter,employerAdapter,...customAdapters(app)];}
 destinations(jobId:string):Destination[]{this.app.getJob(jobId);const members=vacancyIdentity(this.app.database,jobId).memberJobIds;return this.app.database.prepare(`SELECT destinations_json FROM collection_captures WHERE job_id IN (${members.map(()=>'?').join(',')}) ORDER BY rowid`).all(...members).flatMap(row=>JSON.parse(String(row.destinations_json)) as Destination[]);}
 private adapter(source:string){const adapter=this.adapters.find(item=>item.id===source);if(!adapter)throw new AppError('This source has no registered supervised collection adapter. Use manual capture.');return adapter;}
 get(runId:string){new RunsService(this.app).get(runId);const db=this.app.database;return {plans:db.prepare('SELECT plan_json FROM collection_plans WHERE run_id=? ORDER BY rowid').all(runId).map(row=>JSON.parse(String(row.plan_json)) as SourcePlan),events:db.prepare('SELECT search_key AS searchKey,outcome,found_count AS foundCount,created_at AS createdAt FROM collection_events WHERE run_id=? ORDER BY rowid').all(runId),listings:db.prepare('SELECT plan_id AS planId,search_key AS searchKey,work_key AS workKey,source,url,job_id AS jobId FROM collection_listings WHERE run_id=? ORDER BY rowid').all(runId).map(row=>({planId:String(row.planId),searchKey:String(row.searchKey),workKey:String(row.workKey),source:String(row.source),url:String(row.url),jobId:row.jobId===null?null:String(row.jobId)}))};}
 plan(runId:string,input:unknown):SourcePlan{
  record(input);only(input,['operationId','source','config']);text(input.operationId,'operationId',128);text(input.source,'source',128);record(input.config);only(input.config,['location','origin']);if(input.config.location!==undefined)text(input.config.location,'location');if(input.config.origin!==undefined)text(input.config.origin,'origin');
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
  for(const search of plan.searches){const prior=run.work.find(work=>work.workKey===search.workKey);runs.enqueue(runId,{operationId:key('queue-search',search.workKey),workKey:search.workKey,trackId:search.trackId,source:plan.source,url:search.url,...(!prior || prior.kind==='search'?{workKind:'search'}:{})});}
  return plan;
 }
 prepare(runId:string,input:unknown){record(input);only(input,['operationId','workKey','modelWork','reservationId']);text(input.workKey,'workKey',128);const state=this.get(runId);if(!state.plans.some(plan=>plan.searches.some(search=>search.workKey===input.workKey))&&!state.listings.some(listing=>listing.workKey===input.workKey))throw new AppError('Plan this source search or discover its listing before browser work.');return new RunsService(this.app).authorize(runId,input);}
 discover(runId:string,input:unknown){
  record(input);only(input,['operationId','searchKey','outcome','listings','deferCapture']);text(input.operationId,'operationId',128);text(input.searchKey,'searchKey',128);
  if(!['results','zero-results','access-failure','unsupported-content'].includes(input.outcome))throw new AppError('Distinguish results, zero-results, access-failure and unsupported-content explicitly.');
  const state=this.get(runId),plan=state.plans.find(plan=>plan.searches.some(search=>search.workKey===input.searchKey));if(!plan)throw new AppError('Unknown planned source search.');const search=plan.searches.find(search=>search.workKey===input.searchKey)!;
  const adapter=this.adapter(plan.source),runs=new RunsService(this.app),run=runs.get(runId),work=run.work.find(work=>work.workKey===search.workKey)!;
  const db=this.app.database,existing=db.prepare('SELECT input_hash FROM collection_events WHERE run_id=? AND operation_id=?').get(runId,input.operationId);
  if(existing&&existing.input_hash!==digest(input))throw new AppError('Discovery identifier already has different results.',409,'idempotency_conflict');
  if(!existing&&run.status!=='running')throw new AppError('Resume the paused source run before reporting browser results.');
  if(!existing&&work.status!=='working')throw new AppError('Authorize this search before opening the browser or reporting results.');
  if(input.deferCapture!==undefined&&typeof input.deferCapture!=='boolean')throw new AppError('deferCapture must be boolean.');
  const limit=input.deferCapture?(run.discoveryLimit??200):run.limit;
  const listings=input.listings??[];if(!Array.isArray(listings)||listings.length>limit)throw new AppError('Discovery batch exceeds its limit. Use deferCapture for previews within the separate discovery limit.');
  if(input.outcome==='results'&&!listings.length)throw new AppError('Results need at least one observed listing URL; use zero-results only for a successful empty search.');
  if(input.outcome!=='results'&&listings.length)throw new AppError('Zero-results/access-failure cannot contain discovered listings.');
  const candidates=new Map<string,{url:string;preview:Record<string,string>}>();
  for(const listing of listings){
   record(listing);only(listing,input.deferCapture?['url','title','company','location','snippet']:['url']);
   const preview:Record<string,string>={};
   for(const field of ['title','company','location','snippet'])if(listing[field]!==undefined){text(listing[field],field,field==='snippet'?2000:500);preview[field]=listing[field];}
   const canonicalUrl=adapter.listingUrl(url(listing.url));
   if(plan.source==='employer'&&new URL(canonicalUrl).origin!==new URL(plan.config.origin!).origin)throw new AppError('Employer candidate must belong to the approved origin. Use a separate approved source plan for another origin.');
   candidates.set(canonicalUrl,{url:canonicalUrl,preview});
  }
  const canonicalUrls=[...candidates.keys()];
  if(input.deferCapture){
   const prior=new Set(this.candidates(runId).map(item=>item.url));
   if(prior.size+canonicalUrls.filter(value=>!prior.has(value)).length>(run.discoveryLimit??200))throw new AppError('Run discovery limit reached. Review saved candidates before starting another run.',409,'discovery_limit');
   for(const candidate of candidates.values())db.prepare('INSERT OR IGNORE INTO collection_candidates(run_id,work_key,plan_id,search_key,source,url,preview_json) VALUES (?,?,?,?,?,?,?)').run(runId,key(runId,plan.source,candidate.url),plan.id,search.workKey,plan.source,candidate.url,JSON.stringify(candidate.preview));
  }else{
   for(const listingUrl of canonicalUrls){const workKey=key(runId,plan.source,listingUrl);const prior=run.work.find(work=>work.workKey===workKey);runs.enqueue(runId,{operationId:key('queue-listing',workKey),workKey,trackId:prior?.trackId??search.trackId,source:plan.source,url:listingUrl});db.prepare('INSERT OR IGNORE INTO collection_listings VALUES (?,?,?,?,?,?,NULL)').run(runId,plan.id,search.workKey,workKey,plan.source,listingUrl);}
  }
  if(!existing)db.prepare('INSERT INTO collection_events VALUES (?,?,?,?,?,?,?)').run(runId,input.operationId,digest(input),search.workKey,input.outcome,canonicalUrls.length,new Date().toISOString());
  runs.checkpoint(runId,{operationId:key('search-checkpoint',input.operationId),workKey:search.workKey,status:['access-failure','unsupported-content'].includes(input.outcome)?'failed':'searched',...(input.outcome==='access-failure'?{errorCode:'unavailable'}:input.outcome==='unsupported-content'?{errorCode:'malformed_output'}:{})});
  return this.get(runId);
 }
 candidates(runId:string){
  const run=new RunsService(this.app).get(runId);
  return this.app.database.prepare('SELECT * FROM collection_candidates WHERE run_id=? ORDER BY rowid').all(runId).map(row=>({workKey:String(row.work_key),searchKey:String(row.search_key),planId:String(row.plan_id),source:String(row.source),url:String(row.url),preview:JSON.parse(String(row.preview_json)) as Record<string,string>,disposition:String(row.disposition),reason:row.reason===null?null:String(row.reason),jobId:run.work.find(work=>work.workKey===row.work_key)?.jobId??null}));
 }
 select(runId:string,input:unknown){
  record(input);only(input,['operationId','decisions']);text(input.operationId,'operationId',128);
  if(!Array.isArray(input.decisions)||!input.decisions.length||input.decisions.length>500)throw new AppError('Supply 1–500 candidate decisions.');
  const db=this.app.database,runs=new RunsService(this.app),run=runs.get(runId),state=this.get(runId),candidates=this.candidates(runId);
  const receipt=db.prepare('SELECT input_hash FROM collection_selections WHERE run_id=? AND operation_id=?').get(runId,input.operationId);
  if(receipt){if(receipt.input_hash!==digest(input))throw new AppError('Selection identifier already has different decisions.',409,'idempotency_conflict');return this.candidates(runId);}
  if(run.status!=='running')throw new AppError('Resume the run before screening candidates.');
  const seen=new Set<string>();
  const decisions=input.decisions.map((decision:unknown)=>{
   record(decision);only(decision,['workKey','disposition','reason']);text(decision.workKey,'workKey',128);text(decision.reason,'reason',2000);
   if(seen.has(decision.workKey))throw new AppError('Each candidate needs one decision per batch.');seen.add(decision.workKey);
   if(!['selected','skipped'].includes(decision.disposition))throw new AppError('Choose selected or skipped; previews are not fit assessments.');
   const candidate=candidates.find(item=>item.workKey===decision.workKey);if(!candidate)throw new AppError('Unknown candidate. Discover it before selection.');
   if(candidate.disposition==='selected'&&decision.disposition==='skipped')throw new AppError('This candidate is already queued. Preserve its selection and checkpoint its listing instead.');
   return {candidate,disposition:decision.disposition as 'selected'|'skipped',reason:decision.reason};
  });
  const selected=new Set([...candidates.filter(item=>item.disposition==='selected').map(item=>item.workKey),...decisions.filter(item=>item.disposition==='selected').map(item=>item.candidate.workKey)]);
  const detailed=new Set([...state.listings.map(item=>item.workKey),...selected]);
  if(detailed.size>run.limit)throw new AppError('Selection exceeds the detailed listing limit. Prioritise the strongest candidates.',409,'listing_limit');
  const newWork=decisions.filter(item=>item.disposition==='selected'&&!run.work.some(work=>work.workKey===item.candidate.workKey));
  if(run.work.length+newWork.length>Math.min(5000,Math.max(200,run.limit*20)))throw new AppError('Run queue cap reached. Review partial results.');
  for(const {candidate,disposition} of decisions)if(disposition==='selected'){
   const plan=state.plans.find(plan=>plan.id===candidate.planId)!,search=plan.searches.find(search=>search.workKey===candidate.searchKey)!;
   const prior=run.work.find(work=>work.workKey===candidate.workKey);
   runs.enqueue(runId,{operationId:key('queue-listing',candidate.workKey),workKey:candidate.workKey,trackId:prior?.trackId??search.trackId,source:candidate.source,url:candidate.url});
  }
  db.exec('BEGIN IMMEDIATE');
  try{
   for(const {candidate,disposition,reason} of decisions){
    if(disposition==='selected')db.prepare('INSERT OR IGNORE INTO collection_listings VALUES (?,?,?,?,?,?,NULL)').run(runId,candidate.planId,candidate.searchKey,candidate.workKey,candidate.source,candidate.url);
    db.prepare('UPDATE collection_candidates SET disposition=?,reason=? WHERE run_id=? AND work_key=?').run(disposition,reason,runId,candidate.workKey);
   }
   db.prepare('INSERT INTO collection_selections VALUES (?,?,?)').run(runId,input.operationId,digest(input));db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  return this.candidates(runId);
 }
 capture(runId:string,input:unknown){
  record(input);only(input,['operationId','workKey','capturedAt','title','company','location','text','links','partial','apiContext']);text(input.operationId,'operationId',128);text(input.workKey,'workKey',128);
  const state=this.get(runId),listing=state.listings.find(item=>item.workKey===input.workKey);if(!listing)throw new AppError('Discover this listing through its approved source plan before capture.');
  const runs=new RunsService(this.app),run=runs.get(runId),work=run.work.find(item=>item.workKey===listing.workKey)!;
  const db=this.app.database,existing=db.prepare('SELECT * FROM collection_captures WHERE run_id=? AND work_key=?').get(runId,input.workKey);
  const {operationId,...content}=input;
  if(existing){if(existing.input_hash!==digest(content))throw new AppError('This source capture already has different content. Save a new observation revision instead of overwriting it.',409,'idempotency_conflict');const job=this.app.getJob(String(existing.job_id));db.prepare('UPDATE collection_listings SET job_id=? WHERE run_id=? AND work_key=?').run(job.id,runId,work.workKey);runs.checkpoint(runId,{operationId:key('capture-checkpoint',runId,work.workKey),workKey:work.workKey,status:existing.completion==='complete'?'collected':'failed',jobId:job.id,...(existing.completion==='partial'?{errorCode:'malformed_output'}:{})});return {job,observation:job.observations.find(item=>item.id===existing.observation_id)!,completion:String(existing.completion),destinations:JSON.parse(String(existing.destinations_json)) as Destination[]};}
  if(run.status!=='running')throw new AppError('Resume the paused source run before capture.');
  if(work.status!=='working')throw new AppError('Authorize this listing before browser capture.');
  let context:Record<string,unknown>={method:'supervised-browser',planId:listing.planId,workKey:listing.workKey};
  if(input.apiContext!==undefined){
   record(input.apiContext);only(input.apiContext,['method','provider','endpoint']);
   const {method,provider,endpoint}=input.apiContext;
   if(method!=='public-api'||!['greenhouse','lever'].includes(provider))throw new AppError('API context requires method public-api and provider greenhouse or lever.');
   const endpointUrl=new URL(url(endpoint));
   const validEndpoint=endpointUrl.protocol==='https:'&&(provider==='greenhouse'?endpointUrl.hostname==='boards-api.greenhouse.io'&&/^\/v1\/boards\/[a-zA-Z0-9_-]+\/jobs(?:\/\d+)?$/.test(endpointUrl.pathname):['api.lever.co','api.eu.lever.co'].includes(endpointUrl.hostname)&&/^\/v0\/postings\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)?$/.test(endpointUrl.pathname));
   if(!validEndpoint||endpointUrl.hash||[...endpointUrl.searchParams].some(([name,value])=>!['content','mode','limit','skip'].includes(name)||!['true','false','json'].includes(value)&&!/^\d{1,6}$/.test(value)))throw new AppError('Use a documented public job API endpoint without credentials or token parameters.');
   context={...context,method,provider,endpoint:endpointUrl.href,contentHash:createHash('sha256').update(typeof input.text==='string'?input.text:'').digest('hex')};
  }
  const saved=this.app.saveObservation({ingestionId:work.ingestionId,source:String(listing.source),sourceUrl:String(listing.url),capturedAt:input.capturedAt,title:input.title,company:input.company,...(input.location!==undefined?{location:input.location}:{}),text:input.text,context});
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
export function collectionRoutes(adapters?:CollectionAdapter[]):ApiRoute{return async({app,request,url,json,send})=>{
 const destination=/^\/api\/v1\/jobs\/([^/]+)\/destinations$/.exec(url.pathname);if(request.method==='GET'&&destination){send(new SourceCollection(app,adapters).destinations(decodeURIComponent(destination[1]!)));return true;}
 const match=/^\/api\/v1\/runs\/([^/]+)\/collection(?:\/(plans|prepare|discover|capture|candidates|select))?$/.exec(url.pathname);if(!match)return false;const runId=decodeURIComponent(match[1]!),service=new SourceCollection(app,adapters);
 if(request.method==='GET'&&match[2]==='candidates'){send(service.candidates(runId));return true;}
 if(request.method==='GET'&&!match[2]){send(service.get(runId));return true;}
 if(request.method==='POST'&&match[2]&&match[2]!=='candidates'){const methods={plans:'plan',prepare:'prepare',discover:'discover',capture:'capture',select:'select'} as const;send(service[methods[match[2] as keyof typeof methods]](runId,await json()));return true;}return false;
};}
