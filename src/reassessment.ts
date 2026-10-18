import {createHash,randomUUID} from 'node:crypto';
import {AppError,CareerVistaApp} from './app.ts';
import {ProfilesService} from './profiles.ts';
import {AssessmentsService} from './assessments.ts';
import type {AssessmentInput} from './assessments.ts';
import type {ApiRoute} from './server.ts';
export interface ReassessmentInput {requestId:string;profileVersion:number;trackId:string;jobIds:string[];budget:{amount:number;currency:string};estimatePerJob:number}
export const reassessmentOutcomes=['assessed','insufficient_evidence','provider_failure','malformed_output'] as const;
export interface ReassessmentCompletion {operationId:string;outcome:typeof reassessmentOutcomes[number];assessment?:AssessmentInput;actualCost:number|null}
const messages={pending:'Awaiting your configured agent.',working:'Agent work authorized against saved evidence.',assessed:'New assessment saved; previous reasoning retained.',insufficient_evidence:'Saved evidence is insufficient. No new fit label was created; investigate missing facts.',provider_failure:'Agent/model provider failed. No new fit label was created. Retry in a new batch.',malformed_output:'Agent output was malformed. No new fit label was created. Correct it in a new batch.'};
function object(value:unknown,keys:string[]):asserts value is Record<string,any>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)))throw new AppError('Supply only the documented reassessment fields.');}
function text(value:unknown,name:string):asserts value is string{if(typeof value!=='string'||!value.trim()||value.length>128)throw new AppError(`${name} must be non-empty text up to 128 characters.`);}
function units(value:unknown):number{if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1e6||Math.abs(value*1e6-Math.round(value*1e6))>0.0001)throw new AppError('Costs must be non-negative finite amounts, at most one million, with up to six decimals.');return Math.round(value*1e6);}
function canonical(value:unknown):string{if(Array.isArray(value))return`[${value.map(canonical).join(',')}]`;if(value&&typeof value==='object')return`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical((value as Record<string,unknown>)[key])}`).join(',')}}`;return JSON.stringify(value);}
const digest=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
/** Bounded agent handoff over immutable saved inputs; no collection or model SDK. */
export class ReassessmentsService {
 readonly app:CareerVistaApp;
 constructor(app:CareerVistaApp){this.app=app;}
 private batch(id:string){const row=this.app.database.prepare('SELECT * FROM reassessment_batches WHERE id=?').get(id);if(!row)throw new AppError('Reassessment batch not found.',404,'not_found');return row;}
 private item(id:string,jobId:string){const row=this.app.database.prepare('SELECT * FROM reassessment_items WHERE batch_id=? AND job_id=?').get(id,jobId);if(!row)throw new AppError('Job is not selected in this batch or was permanently deleted.',404,'not_found');return row;}
 get(id:string){
  const row=this.batch(id),budget=JSON.parse(String(row.budget_json)) as ReassessmentInput['budget'];
  const items=this.app.database.prepare('SELECT * FROM reassessment_items WHERE batch_id=? ORDER BY rowid').all(id).map(item=>({id:String(item.id),jobId:String(item.job_id),title:this.app.getJob(String(item.job_id)).title,status:item.status as keyof typeof messages,message:messages[item.status as keyof typeof messages],observationIds:JSON.parse(String(item.observation_ids_json)) as string[],previousAssessmentId:item.previous_assessment_id as string|null,assessmentId:item.assessment_id as string|null}));
  const selected=Number(row.selected_count),estimate=Number(row.estimate_units),committed=selected*estimate-Number(row.completed_estimate_units)+Number(row.actual_known_units)+Number(row.unknown_estimate_units),over=committed>units(budget.amount);
  return{id:String(row.id),profileVersion:Number(row.profile_version),trackId:String(row.track_id),createdAt:String(row.created_at),budget,estimatePerJob:estimate/1e6,selectedCount:selected,deletedCount:selected-items.length,items,status:over?'budget-exhausted':items.some(item=>['pending','working'].includes(item.status))?'pending':'completed',costs:{committed:committed/1e6,known:Number(row.actual_known_units)/1e6,remaining:Math.max(0,units(budget.amount)-committed)/1e6,currency:budget.currency,actualUnavailable:Number(row.unknown_count)>0}};
 }
 list(){return this.app.database.prepare('SELECT id FROM reassessment_batches ORDER BY rowid DESC LIMIT 100').all().map(row=>this.get(String(row.id)));}
 create(input:ReassessmentInput){
  object(input,['requestId','profileVersion','trackId','jobIds','budget','estimatePerJob']);text(input.requestId,'requestId');text(input.trackId,'trackId');object(input.budget,['amount','currency']);const amount=units(input.budget.amount),estimate=units(input.estimatePerJob);
  if(typeof input.budget.currency!=='string'||!/^[A-Z]{3}$/.test(input.budget.currency))throw new AppError('Use an explicit uppercase three-letter budget currency.');
  if(!Number.isSafeInteger(input.profileVersion)||input.profileVersion<1)throw new AppError('Choose an approved profile version.');
  const profile=new ProfilesService(this.app).getProfile(input.profileVersion);if(profile.status!=='approved')throw new AppError('Approve the chosen profile revision before reassessment.');new ProfilesService(this.app).effectivePreferences(input.profileVersion,input.trackId);
  if(!Array.isArray(input.jobIds)||!input.jobIds.length||input.jobIds.length>500||new Set(input.jobIds).size!==input.jobIds.length||input.jobIds.some(id=>typeof id!=='string'||!id))throw new AppError('Select between one and 500 distinct saved job IDs, including excluded jobs if useful.');
  if(estimate*input.jobIds.length>amount)throw new AppError('The selected jobs’ total model estimate exceeds the batch budget. Reduce the selection/estimate or explicitly raise the budget.',409,'budget_exhausted');
  const fingerprint=digest(input),existing=this.app.database.prepare('SELECT id,input_hash FROM reassessment_batches WHERE request_id=?').get(input.requestId);if(existing){if(existing.input_hash!==fingerprint)throw new AppError('This requestId already has different reassessment settings.',409,'idempotency_conflict');return this.get(String(existing.id));}
  const jobs=input.jobIds.map(id=>this.app.getJob(id)),assessments=new AssessmentsService(this.app),id=randomUUID();const db=this.app.database;db.exec('SAVEPOINT reassessment_create');
  try{db.prepare('INSERT INTO reassessment_batches(id,request_id,input_hash,profile_version,track_id,budget_json,estimate_units,selected_count,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(id,input.requestId,fingerprint,input.profileVersion,input.trackId,JSON.stringify(input.budget),estimate,jobs.length,new Date().toISOString());
   for(const job of jobs)db.prepare('INSERT INTO reassessment_items(id,batch_id,job_id,observation_ids_json,previous_assessment_id,status) VALUES (?,?,?,?,?,?)').run(randomUUID(),id,job.id,JSON.stringify(job.observations.map(observation=>observation.id)),assessments.history(job.id).at(-1)?.id??null,'pending');db.exec('RELEASE reassessment_create');
  }catch(error){db.exec('ROLLBACK TO reassessment_create; RELEASE reassessment_create');throw error;}return this.get(id);
 }
 authorize(id:string,jobId:string,input:{operationId:string}){
  object(input,['operationId']);text(input.operationId,'operationId');const batch=this.get(id),item=this.item(id,jobId);
  if(batch.status==='budget-exhausted')throw new AppError('Actual provider costs exceeded the batch budget. No further model work is authorized.',409,'budget_exhausted');
  if(item.authorize_id!==null&&item.authorize_id!==input.operationId)throw new AppError('This item already has an authorization. Retry its original operationId or create a new batch.',409,'idempotency_conflict');
  if(item.authorize_id===null){if(batch.status==='budget-exhausted')throw new AppError('Actual provider costs exceeded the batch budget. No further model work is authorized.',409,'budget_exhausted');if(item.status!=='pending')throw new AppError('This item is complete. Create a new batch to retry it.');this.app.database.prepare("UPDATE reassessment_items SET status='working',authorize_id=? WHERE id=?").run(input.operationId,String(item.id));}
  else if(item.status!=='working')throw new AppError('This item is already complete. Read its saved result instead of repeating model work.',409,'work_complete');
  const profile=new ProfilesService(this.app).getProfile(batch.profileVersion),job=this.app.getJob(jobId),observationIds=JSON.parse(String(item.observation_ids_json)) as string[];
  return{batchId:id,jobId,profile,trackId:batch.trackId,effectivePreferences:new ProfilesService(this.app).effectivePreferences(batch.profileVersion,batch.trackId),observations:job.observations.filter(observation=>observationIds.includes(observation.id)),previousAssessment:new AssessmentsService(this.app).history(jobId).find(assessment=>assessment.id===item.previous_assessment_id)??null,budget:batch.budget,estimatePerJob:batch.estimatePerJob,instructions:'Use only these saved observations and the approved profile. Do not browse/recollect, infer unknowns as failures, or alter personal decisions/applications. Record the actual available model/configuration metadata.'};
 }
 complete(id:string,jobId:string,input:ReassessmentCompletion){
  object(input,['operationId','outcome','assessment','actualCost']);text(input.operationId,'operationId');if(!reassessmentOutcomes.includes(input.outcome))throw new AppError('outcome must be assessed, insufficient_evidence, provider_failure or malformed_output.');if(input.actualCost!==null)units(input.actualCost);
  const item=this.item(id,jobId),batch=this.get(id);if(item.completion_id!==null){if(item.completion_id!==input.operationId||digest(JSON.parse(String(item.completion_json)))!==digest(input))throw new AppError('This completion already records different content. Create a new batch for new work.',409,'idempotency_conflict');return this.get(id);}
  if(item.status!=='working')throw new AppError('Authorize this saved-evidence item before recording a result.');
  if(input.outcome==='assessed'){
   const assessment=input.assessment,ids=JSON.parse(String(item.observation_ids_json)) as string[];
   if(!assessment||assessment.jobId!==jobId||assessment.profileVersion!==batch.profileVersion||assessment.trackId!==batch.trackId||!Array.isArray(assessment.observationIds)||assessment.observationIds.length!==ids.length||assessment.observationIds.some(value=>!ids.includes(value)))throw new AppError('The new assessment must use this job, selected approved profile/track and the complete saved evidence snapshot.');
   if(new AssessmentsService(this.app).history(jobId).some(previous=>previous.submissionId===assessment.submissionId))throw new AppError('Reassessment needs a fresh assessment submissionId; older reasoning is retained.');
  }else if(input.assessment!==undefined)throw new AppError('Failure or insufficient-evidence outcomes cannot create a fit assessment. Send no raw provider output or credentials.');
  const db=this.app.database;db.exec('SAVEPOINT reassessment_complete');
  try{const assessment=input.outcome==='assessed'?new AssessmentsService(this.app).submitAssessment(input.assessment!).assessment:null;
   db.prepare('UPDATE reassessment_items SET status=?,completion_id=?,completion_json=?,assessment_id=? WHERE id=?').run(input.outcome,input.operationId,JSON.stringify(input),assessment?.id??null,String(item.id));
   db.prepare('UPDATE reassessment_batches SET completed_estimate_units=completed_estimate_units+estimate_units,actual_known_units=actual_known_units+?,unknown_estimate_units=unknown_estimate_units+?,unknown_count=unknown_count+? WHERE id=?').run(input.actualCost===null?0:units(input.actualCost),input.actualCost===null?Math.round(batch.estimatePerJob*1e6):0,input.actualCost===null?1:0,id);db.exec('RELEASE reassessment_complete');
  }catch(error){db.exec('ROLLBACK TO reassessment_complete; RELEASE reassessment_complete');throw error;}return this.get(id);
 }
}
export const reassessmentRoutes:ApiRoute=async({app,request,url,json,send})=>{
 const service=new ReassessmentsService(app);if(url.pathname==='/api/v1/reassessments'){if(request.method==='GET'){send(service.list());return true;}if(request.method==='POST'){send(service.create(await json() as ReassessmentInput),201);return true;}}
 const match=/^\/api\/v1\/reassessments\/([^/]+)(?:\/jobs\/([^/]+)\/(input|result))?$/.exec(url.pathname);if(!match)return false;const id=decodeURIComponent(match[1]!);
 if(request.method==='GET'&&!match[2]){send(service.get(id));return true;}if(request.method==='POST'&&match[2]){const job=decodeURIComponent(match[2]);send(match[3]==='input'?service.authorize(id,job,await json() as {operationId:string}):service.complete(id,job,await json() as ReassessmentCompletion));return true;}return false;
};
export type ReassessmentBatch=ReturnType<ReassessmentsService['get']>;
