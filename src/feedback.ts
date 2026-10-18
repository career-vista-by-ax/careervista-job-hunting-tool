import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { AppError, CareerVistaApp } from './app.ts';
import { ProfilesService } from './profiles.ts';
import type { Preference, Profile, ProfileInput } from './profiles.ts';
import type { ApiRoute } from './server.ts';

export type ReviewDecision = 'saved' | 'dismissed' | 'unreviewed';
export interface DecisionInput { operationId:string;decision:ReviewDecision;reason?:string }
export interface Decision { id:string;jobId:string;operationId:string;decision:ReviewDecision;reason:string;createdAt:string }
export interface PreferenceProposalInput { submissionId:string;baseProfileVersion:number;feedbackIds:string[];trackId?:string;change:Preference;explanation:string }
export interface ProposalActionInput {operationId:string;confirmed:boolean;confirmHardExclusion?:boolean}
export interface ProposalEvent {id:string;proposalId:string;operationId:string;action:'accepted'|'rejected'|'reversed';profileVersion:number|null;createdAt:string}
export interface PreferenceProposal extends PreferenceProposalInput {id:string;createdAt:string;status:'pending'|'accepted'|'rejected'|'reversed';events:ProposalEvent[];feedback:Decision[]}
function text(value:unknown,label:string){if(typeof value!=='string'||!value.trim()||value.length>8000)throw new AppError(`${label} must be non-empty text up to 8000 characters.`);}
function object(value:unknown,label:string,keys:string[]){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)))throw new AppError(`${label} must use only documented fields.`);}
export class FeedbackService {
 readonly app:CareerVistaApp;
 constructor(app:CareerVistaApp){this.app=app;}
 history(jobId:string){
  this.app.getJob(jobId);
  const events=this.app.database.prepare('SELECT id,job_id AS jobId,operation_id AS operationId,decision,reason,created_at AS createdAt FROM review_decisions WHERE job_id=? ORDER BY rowid').all(jobId) as unknown as Decision[];
  return{jobId,decision:events.at(-1)?.decision??'unreviewed',events};
 }
 recordDecision(jobId:string,input:DecisionInput){
  this.app.getJob(jobId);object(input,'Review decision',['operationId','decision','reason']);text(input.operationId,'operationId');
  if(!['saved','dismissed','unreviewed'].includes(input.decision))throw new AppError('decision must be saved, dismissed or unreviewed.');
  if(input.reason!==undefined&&(typeof input.reason!=='string'||input.reason.length>8000))throw new AppError('reason must be optional text up to 8000 characters.');
  const existing=this.app.database.prepare('SELECT id,job_id,decision,reason FROM review_decisions WHERE operation_id=?').get(input.operationId);
  if(existing){if(existing.job_id!==jobId||existing.decision!==input.decision||existing.reason!==(input.reason??''))throw new AppError('This review identifier already has different content. Use a new operationId.',409,'idempotency_conflict');return{event:this.history(jobId).events.find(event=>event.id===existing.id)!,replayed:true};}
  const id=randomUUID();this.app.database.prepare('INSERT INTO review_decisions VALUES (?,?,?,?,?,?)').run(id,jobId,input.operationId,input.decision,input.reason??'',new Date().toISOString());
  return{event:this.history(jobId).events.find(event=>event.id===id)!,replayed:false};
 }
 private decision(id:string):Decision {
  const row=this.app.database.prepare('SELECT job_id FROM review_decisions WHERE id=?').get(id);
  if(!row)throw new AppError('Supporting feedback decision not found.',404,'not_found');
  return this.history(String(row.job_id)).events.find(event=>event.id===id)!;
 }
 getProposal(id:string):PreferenceProposal {
  const db=this.app.database,row=db.prepare('SELECT input_json,created_at FROM preference_proposals WHERE id=?').get(id);
  if(!row)throw new AppError('Preference proposal not found.',404,'not_found');
  const input=JSON.parse(String(row.input_json)) as PreferenceProposalInput;
  const events=db.prepare('SELECT id,proposal_id AS proposalId,operation_id AS operationId,action,profile_version AS profileVersion,created_at AS createdAt FROM preference_proposal_events WHERE proposal_id=? ORDER BY rowid').all(id) as unknown as ProposalEvent[];
  return{...input,id,createdAt:String(row.created_at),events,status:events.at(-1)?.action??'pending',feedback:input.feedbackIds.map(id=>this.decision(id))};
 }
 proposals(status?:PreferenceProposal['status']) {
  if(status!==undefined&&!['pending','accepted','rejected','reversed'].includes(status))throw new AppError('status must be pending, accepted, rejected or reversed.');
  return this.app.database.prepare('SELECT id FROM preference_proposals ORDER BY rowid DESC').all().map(row=>this.getProposal(String(row.id))).filter(item=>status===undefined||item.status===status);
 }
 private scope(profile:Profile,trackId?:string):Preference[]{
  if(trackId===undefined)return profile.preferences;
  const track=profile.tracks.find(track=>track.id===trackId);
  if(!track)throw new AppError('Search track not found in this profile revision.',404,'not_found');
  return track.preferences;
 }
 private changed(profile:Profile,trackId:string|undefined,key:string,value:Preference|undefined):ProfileInput {
  const input:ProfileInput={name:profile.name,demonstratedExperience:profile.demonstratedExperience,aspirations:profile.aspirations,preferences:profile.preferences,tracks:profile.tracks,basedOnVersion:profile.version};
  const replace=(prefs:Preference[])=>[...prefs.filter(pref=>pref.key!==key),...(value?[value]:[])];
  this.scope(profile,trackId);
  if(trackId===undefined)input.preferences=replace(profile.preferences);
  else input.tracks=profile.tracks.map(track=>track.id===trackId?{...track,preferences:replace(track.preferences)}:track);
  return input;
 }
 propose(input:PreferenceProposalInput){
  object(input,'Preference proposal',['submissionId','baseProfileVersion','feedbackIds','trackId','change','explanation']);text(input.submissionId,'submissionId');text(input.explanation,'Proposal explanation');
  if(!Number.isSafeInteger(input.baseProfileVersion)||input.baseProfileVersion<1)throw new AppError('baseProfileVersion must identify an approved revision.');
  if(input.trackId!==undefined)text(input.trackId,'trackId');
  const profiles=new ProfilesService(this.app),profile=profiles.getProfile(input.baseProfileVersion);
  if(profile.status!=='approved')throw new AppError('Proposals must be based on an approved preference profile.');
  if(!Array.isArray(input.feedbackIds)||!input.feedbackIds.length||input.feedbackIds.length>100||new Set(input.feedbackIds).size!==input.feedbackIds.length)throw new AppError('feedbackIds must contain 1–100 distinct saved review decisions.');
  const feedback=input.feedbackIds.map(id=>{text(id,'feedbackId');return this.decision(id);});
  if(!feedback.some(event=>event.reason.trim()))throw new AppError('A general preference proposal needs an explicit feedback explanation; a save/dismiss alone does not imply a preference.');
  object(input.change,'Proposed preference',['key','kind','value']);text(input.change.key,'Preference key');
  const db=this.app.database;
  // Reuse the public profile validation inside a rollback-only savepoint. No pending
  // proposal creates a profile revision or active criteria.
  db.exec('SAVEPOINT proposal_validation');
  try{profiles.createDraft(this.changed(profile,input.trackId,input.change.key,input.change));}
  finally{db.exec('ROLLBACK TO proposal_validation; RELEASE proposal_validation');}
  const previous=this.scope(profile,input.trackId).find(pref=>pref.key===input.change.key);
  if(isDeepStrictEqual(previous,input.change))throw new AppError('This proposal makes no preference change.');
  const existing=db.prepare('SELECT id,input_json FROM preference_proposals WHERE submission_id=?').get(input.submissionId);
  if(existing){if(!isDeepStrictEqual(JSON.parse(String(existing.input_json)),input))throw new AppError('This proposal identifier already has different content. Use a new identifier.',409,'idempotency_conflict');return{proposal:this.getProposal(String(existing.id)),replayed:true};}
  const id=randomUUID();db.exec('BEGIN IMMEDIATE');
  try{db.prepare('INSERT INTO preference_proposals VALUES (?,?,?,?,?)').run(id,input.submissionId,input.baseProfileVersion,JSON.stringify(input),new Date().toISOString());for(const decisionId of input.feedbackIds)db.prepare('INSERT INTO preference_proposal_feedback VALUES (?,?)').run(id,decisionId);db.exec('COMMIT');}
  catch(error){db.exec('ROLLBACK');throw error;}
  return{proposal:this.getProposal(id),replayed:false};
 }
 accept(id:string,input:ProposalActionInput){return this.action(id,'accepted',input);}
 reject(id:string,input:ProposalActionInput){return this.action(id,'rejected',input);}
 reverse(id:string,input:ProposalActionInput){return this.action(id,'reversed',input);}
 private action(id:string,action:ProposalEvent['action'],input:ProposalActionInput):{proposal:PreferenceProposal;profile:Profile|null;replayed:boolean}{
  object(input,'Proposal action',['operationId','confirmed','confirmHardExclusion']);text(input.operationId,'operationId');
  if(input.confirmed!==true)throw new AppError('Explicitly confirm this proposal action after reviewing its change and supporting feedback.');
  if(input.confirmHardExclusion!==undefined&&typeof input.confirmHardExclusion!=='boolean')throw new AppError('confirmHardExclusion must be an explicit boolean.');
  const db=this.app.database,profiles=new ProfilesService(this.app),proposal=this.getProposal(id);
  const normalized={proposalId:id,action,operationId:input.operationId,confirmed:true,confirmHardExclusion:input.confirmHardExclusion??false};
  const existing=db.prepare('SELECT proposal_id,input_json,profile_version FROM preference_proposal_events WHERE operation_id=?').get(input.operationId);
  if(existing){if(!isDeepStrictEqual(JSON.parse(String(existing.input_json)),normalized))throw new AppError('This action identifier already has different content.',409,'idempotency_conflict');return{proposal,profile:existing.profile_version===null?null:profiles.getProfile(Number(existing.profile_version)),replayed:true};}
  if(action==='reversed'?proposal.status!=='accepted':proposal.status!=='pending')throw new AppError('This proposal is no longer in the state required for this action.',409,'proposal_state_conflict');
  let next:ProfileInput|undefined;
  if(action!=='rejected'){
   const active=profiles.getActiveProfile();if(!active)throw new AppError('Approve a preference profile before applying changes.',409,'profile_conflict');
   if(action==='accepted'&&active.version!==proposal.baseProfileVersion)throw new AppError('The active profile changed since this proposal. Review a new proposal against the current revision.',409,'profile_conflict');
   const base=profiles.getProfile(proposal.baseProfileVersion);
   const restore=this.scope(base,proposal.trackId).find(pref=>pref.key===proposal.change.key);
   if(action==='reversed'&&!isDeepStrictEqual(this.scope(active,proposal.trackId).find(pref=>pref.key===proposal.change.key),proposal.change))throw new AppError('This preference was changed after acceptance. Review an explicit new change rather than overwriting it.',409,'profile_conflict');
   const value=action==='accepted'?proposal.change:restore;
   const inherited=proposal.trackId&&value===undefined?active.preferences.find(pref=>pref.key===proposal.change.key):undefined;
   if((value?.kind==='hard'||inherited?.kind==='hard')&&input.confirmHardExclusion!==true)throw new AppError('Separately confirm this hard exclusion before applying it. No preference changed.');
   next=this.changed(active,proposal.trackId,proposal.change.key,value);
  }
  db.exec('BEGIN IMMEDIATE');
  try{
   const profile=next?profiles.approve(profiles.createDraft(next).version):null;
   db.prepare('INSERT INTO preference_proposal_events VALUES (?,?,?,?,?,?,?)').run(randomUUID(),id,input.operationId,action,profile?.version??null,JSON.stringify(normalized),new Date().toISOString());
   db.exec('COMMIT');return{proposal:this.getProposal(id),profile,replayed:false};
  }catch(error){db.exec('ROLLBACK');throw error;}
 }

}

export const feedbackRoutes:ApiRoute=async({app,request,url,json,send})=>{
 const service=new FeedbackService(app);const review=/^\/api\/v1\/jobs\/([^/]+)\/reviews$/.exec(url.pathname);
 if(review){const id=decodeURIComponent(review[1]!);if(request.method==='GET'){send(service.history(id));return true;}if(request.method==='POST'){const result=service.recordDecision(id,await json() as DecisionInput);send(result,result.replayed?200:201);return true;}}
 if(url.pathname==='/api/v1/preference-proposals'){
  if(request.method==='GET'){send(service.proposals(url.searchParams.get('status') as PreferenceProposal['status']??undefined));return true;}
  if(request.method==='POST'){const result=service.propose(await json() as PreferenceProposalInput);send(result,result.replayed?200:201);return true;}
 }
 const proposal=/^\/api\/v1\/preference-proposals\/([^/]+)(?:\/(accept|reject|reverse))?$/.exec(url.pathname);
 if(proposal){const id=decodeURIComponent(proposal[1]!);if(request.method==='GET'&&!proposal[2]){send(service.getProposal(id));return true;}if(request.method==='POST'&&proposal[2]){const input=await json() as ProposalActionInput;send(proposal[2]==='accept'?service.accept(id,input):proposal[2]==='reject'?service.reject(id,input):service.reverse(id,input));return true;}}
 return false;
};
