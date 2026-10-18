import { lstatSync, readdirSync, unlinkSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { AppError, CareerVistaApp } from './app.ts';
import { ProfilesService } from './profiles.ts';
import type { ApiRoute } from './server.ts';
export type RunStatus = 'running' | 'paused' | 'stopped' | 'cancelled' | 'completed' | 'budget-exhausted' | 'waiting-user-signin' | 'waiting-user-verification' | 'session-expired';
export type WorkStatus = 'pending' | 'working' | 'collected' | 'assessed' | 'excluded' | 'duplicate' | 'failed';
export interface RunInput { requestId: string; profileVersion: number; trackIds: string[]; sources: string[]; limit?: number; budget: { amount: number; currency: string } }
export interface RunWork { workKey: string; trackId: string; source: string; url: string; ingestionId: string; status: WorkStatus; jobId?: string; captured: boolean; assessed: boolean; attempts: number; errorCode?: string; modelReservationId?: string; deleted?: boolean }
export interface Reservation { id: string; operationId: string; workKey: string; estimate: number; currency: string; status: 'reserved' | 'settled'; actual: number | null; used: boolean }
export interface ResearchRun extends RunInput {
 id: string; limit: number; status: RunStatus; createdAt: string; updatedAt: string;
 work: RunWork[]; reservations: Reservation[]; newJobIds: string[]; removedNewJobs?: number;
 waiting?: { workKey: string; sessionRef: string; pageUrl: string };
 errors: { code: string; message: string; workKey?: string; createdAt: string }[];
 counters: { pending: number; working: number; collected: number; assessed: number; excluded: number; duplicate: number; failed: number; newJobs: number };
 costs: { known: number; estimatedUnavailable: number; reserved: number; committed: number; remaining: number; currency: string; actualUnavailable: boolean };
}
type StoredRun = Omit<ResearchRun, 'counters' | 'costs'> & { baselineJobIds: string[] };
const errorMessages: Record<string,string> = { collection_failed: 'Collection failed. Open the source or retry this checkpoint.', malformed_output: 'Malformed agent output. Correct the structured response and retry.', provider_failure: 'Provider failed. Check your agent host settings and retry.', session_expired: 'Browser session expired. Open a new browser session, sign in directly and resume the saved work.', unavailable: 'Source unavailable. Retry later or use manual capture.', budget_exhausted: 'Requested model-work estimate exceeds the remaining budget. Choose a smaller estimate or explicitly increase the budget.', other: 'Work could not finish. Review saved evidence and retry the checkpoint.' };
function object(value: unknown): asserts value is Record<string, any> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError('Supply a JSON object.'); }
function text(value: unknown, field: string, max = 128): asserts value is string { if (typeof value !== 'string' || !value.trim() || value.length > max) throw new AppError(`${field} must be non-empty text up to ${max} characters.`); }
function money(value: unknown): asserts value is number { if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000 || Math.abs(value * 1e6 - Math.round(value * 1e6)) > 0.0001) throw new AppError('Costs must be finite non-negative amounts, at most one million, with up to six decimal places.'); }
const units = (value: number) => Math.round(value * 1e6);
function webUrl(value: unknown): string { text(value, 'url', 8000); let url: URL; try { url = new URL(value); } catch { throw new AppError('Use a complete HTTP(S) source URL.'); } if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new AppError('Use an HTTP(S) source URL without credentials.'); return value; }
function totals(run: StoredRun): ResearchRun['costs'] {
 let known = 0, estimated = 0, reserved = 0;
 for (const cost of run.reservations) { if (cost.status === 'reserved') reserved += units(cost.estimate); else if (cost.actual === null) estimated += units(cost.estimate); else known += units(cost.actual); }
 return { known: known / 1e6, estimatedUnavailable: estimated / 1e6, reserved: reserved / 1e6, committed: (known + estimated + reserved) / 1e6, remaining: Math.max(0, units(run.budget.amount) - known - estimated - reserved) / 1e6, currency: run.budget.currency, actualUnavailable: run.reservations.some(r => r.status === 'settled' && r.actual === null) };
}
export class RunsService {
 readonly app: CareerVistaApp;
 constructor(app: CareerVistaApp) { this.app = app; }
 private stored(id: string): StoredRun { const row = this.app.database.prepare('SELECT state_json FROM research_runs WHERE id=?').get(id); if (!row) throw new AppError('Research run not found.', 404, 'not_found'); return JSON.parse(String(row.state_json)); }
 get(id: string): ResearchRun {
  const stored = this.stored(id), { baselineJobIds, ...run } = stored;
  const count = (status: WorkStatus) => run.work.filter(w => w.status === status).length;
  return { ...run, counters: { pending: count('pending'), working: count('working'), collected: run.work.filter(w => w.captured).length, assessed: run.work.filter(w => w.assessed).length, excluded: count('excluded'), duplicate: count('duplicate'), failed: count('failed'), newJobs: run.newJobIds.length + (run.removedNewJobs ?? 0) }, costs: totals(stored) };
 }
 list(): ResearchRun[] { return this.app.database.prepare('SELECT id FROM research_runs ORDER BY rowid DESC').all().map(row => this.get(String(row.id))); }
 create(input: RunInput): ResearchRun {
  object(input);
  if (Object.keys(input).some(key => !['requestId','profileVersion','trackIds','sources','limit','budget'].includes(key))) throw new AppError('Unsupported run settings.');
  text(input.requestId, 'requestId'); object(input.budget);
  if (Object.keys(input.budget).some(key => !['amount','currency'].includes(key))) throw new AppError('Budget accepts amount and currency only.');
  money(input.budget.amount);
  if (!/^[A-Z]{3}$/.test(input.budget.currency)) throw new AppError('Budget currency must be an explicit three-letter uppercase code.');
  if (!Number.isInteger(input.profileVersion) || input.profileVersion < 1) throw new AppError('Choose a valid approved profile version.');
  const profile = new ProfilesService(this.app).getProfile(input.profileVersion);
  if (profile.status !== 'approved') throw new AppError('Approve a profile revision and its tracks before starting research.');
  for (const key of ['trackIds','sources'] as const) { if (!Array.isArray(input[key]) || !input[key].length || input[key].length > 50 || new Set(input[key]).size !== input[key].length) throw new AppError(`${key} must contain between one and 50 distinct selected entries.`); for (const value of input[key]) text(value, key); }
  if (input.trackIds.some(id => !profile.tracks.some(t => t.id === id))) throw new AppError('Choose tracks from the approved profile revision.');
  const limit = input.limit ?? 25; if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new AppError('Listing limit must be an integer between 1 and 500; 25 is suggested.');
  const existing = this.app.database.prepare('SELECT id,input_json FROM research_runs WHERE request_id=?').get(input.requestId);
  if (existing) { if (!isDeepStrictEqual(JSON.parse(String(existing.input_json)), input)) throw new AppError('Run request identifier already has different settings.', 409, 'idempotency_conflict'); return this.get(String(existing.id)); }
  const now = new Date().toISOString();
  const state: StoredRun = { ...structuredClone(input), limit, id: randomUUID(), createdAt: now, updatedAt: now, status: 'running', work: [], reservations: [], newJobIds: [], errors: [], baselineJobIds: this.app.listJobs().map(job => job.id) };
  this.app.database.prepare('INSERT INTO research_runs VALUES (?,?,?,?,?)').run(state.id, input.requestId, JSON.stringify(input), JSON.stringify(state), profile.version);
  return this.get(state.id);
 }
 private change(id: string, operation: unknown, kind: string, update: (run: StoredRun, input: Record<string,any>) => void): ResearchRun {
  object(operation); text(operation.operationId, 'operationId'); const input: Record<string,any> = { ...operation, kind };
  if (kind === 'control' && operation.pageUrl !== undefined) { const page = new URL(webUrl(operation.pageUrl)); input.pageUrl = page.origin + page.pathname; }
  const allowed: Record<string,string[]> = {queue:['operationId','workKey','trackId','source','url'],authorize:['operationId','workKey','modelWork','reservationId'],checkpoint:['operationId','workKey','status','jobId','errorCode'],reservation:['operationId','workKey','estimate','currency'],cost:['operationId','reservationId','actual'],control:['operationId','action','workKey','sessionRef','pageUrl','userConfirmed','amount','currency']};
  if (Object.keys(operation).some(key => !allowed[kind]?.includes(key))) throw new AppError('Unsupported run operation fields. Send no raw provider output, passwords or session secrets.');
  const db = this.app.database; db.exec('BEGIN IMMEDIATE');
  try {
   const run = this.stored(id), receipt = db.prepare('SELECT input_json FROM run_operations WHERE run_id=? AND operation_id=?').get(id, operation.operationId);
   if (receipt) { if (!isDeepStrictEqual(JSON.parse(String(receipt.input_json)), input)) throw new AppError('Run operation identifier already has different content.', 409, 'idempotency_conflict'); }
   else {
    update(run, operation); run.updatedAt = new Date().toISOString();
    db.prepare('UPDATE research_runs SET state_json=? WHERE id=?').run(JSON.stringify(run), id);
    db.prepare('INSERT INTO run_operations VALUES (?,?,?)').run(id, operation.operationId, JSON.stringify(input));
   }
   db.exec('COMMIT'); return this.get(id);
  } catch (error) { db.exec('ROLLBACK'); throw error; }
 }
 private active(run: StoredRun) { if (run.status !== 'running') throw new AppError(`Run is ${run.status}. Resume it explicitly before authorizing more work.`, 409, 'run_not_running'); }
 private work(run: StoredRun, key: unknown): RunWork { text(key, 'workKey'); const work = run.work.find(w => w.workKey === key); if (!work) throw new AppError('Queue this work item before changing its checkpoint.'); return work; }
 enqueue(id: string, input: unknown): ResearchRun { return this.change(id, input, 'queue', (run, value) => {
  this.active(run); text(value.workKey, 'workKey'); text(value.trackId,'trackId'); text(value.source,'source'); webUrl(value.url);
  if (!run.trackIds.includes(value.trackId)) throw new AppError('Use a selected track from this run.');
  if (!run.sources.includes(value.source)) throw new AppError('Use a selected source from this run.');
  const prior = run.work.find(w => w.workKey === value.workKey);
  if (prior) { if (prior.url !== value.url || prior.source !== value.source || prior.trackId !== value.trackId) throw new AppError('Work key already identifies different queued work.', 409, 'idempotency_conflict'); return; }
  if (run.work.length >= Math.min(5000, run.limit * 20)) throw new AppError('Run queue cap reached. Review partial results before starting another run.');
  run.work.push({ workKey: value.workKey, trackId: value.trackId, source: value.source, url: value.url, ingestionId: `run:${run.id}:${randomUUID()}`, status: 'pending', captured: false, assessed: false, attempts: 0 });
 }); }
 authorize(id: string, input: unknown): ResearchRun { return this.change(id, input, 'authorize', (run, value) => {
  this.active(run); const work = this.work(run,value.workKey);
  if (work.deleted) throw new AppError('This saved job was permanently deleted. Its work cannot be replayed.');
  if (typeof value.modelWork !== 'boolean') throw new AppError('Declare modelWork true or false before work begins.');
  if (['assessed','excluded','duplicate'].includes(work.status)) throw new AppError('This work is complete. Preserve its checkpoint.');
  if (!work.captured && work.status !== 'working' && run.newJobIds.length + (run.removedNewJobs ?? 0) + run.work.filter(w => w.status === 'working' && !w.captured).length >= run.limit) throw new AppError('New-listing limit reached. Review collected work; duplicates and failed uncaptured work release their slots.', 409, 'listing_limit');
  if (run.work.reduce((sum,w) => sum + w.attempts,0) >= Math.max(100,run.limit * 10)) throw new AppError('Attempt limit reached. Review failed work before creating another run.');
  if (value.modelWork) { const reservation = run.reservations.find(r => r.id === value.reservationId && r.workKey === work.workKey && r.status === 'reserved' && !r.used); if (!reservation) throw new AppError('Reserve an estimate for this model work before starting. Use one fresh reservation per model operation.'); reservation.used = true; work.modelReservationId = reservation.id; }
  work.status = 'working'; work.attempts++; delete work.errorCode;
 }); }
 checkpoint(id: string, input: unknown): ResearchRun { return this.change(id, input, 'checkpoint', (run, value) => {
  if (['cancelled','completed'].includes(run.status)) throw new AppError('This run is terminal. Saved checkpoints remain available.');
  const work = this.work(run,value.workKey);
  if (work.deleted) throw new AppError('This saved job was permanently deleted. Its work cannot be replayed.');
  if (!['collected','assessed','excluded','duplicate','failed'].includes(value.status)) throw new AppError('Checkpoint status must be collected, assessed, excluded, duplicate or failed.');
  if (work.status !== 'working') throw new AppError('Authorize the work before submitting its next checkpoint.');
  if (value.jobId !== undefined) { text(value.jobId,'jobId'); this.app.getJob(value.jobId); if (work.jobId && work.jobId !== value.jobId) throw new AppError('A work item cannot replace its linked saved job.'); }
  const jobId = value.jobId ?? work.jobId;
  if (['collected','assessed','excluded','duplicate'].includes(value.status) && !jobId) throw new AppError('Save evidence first and supply its jobId for this checkpoint.');
  if (value.errorCode !== undefined && !Object.hasOwn(errorMessages,value.errorCode)) throw new AppError('Use a supported safe errorCode, without raw provider output or credentials.');
  let status: WorkStatus = value.status;
  if (jobId) {
   const duplicate = run.baselineJobIds.includes(jobId) || (run.newJobIds.includes(jobId) && work.jobId !== jobId);
   if (!duplicate && !run.newJobIds.includes(jobId)) { if (run.newJobIds.length + (run.removedNewJobs ?? 0) >= run.limit) throw new AppError('Listing limit reached. Evidence stays saved independently of the run. Link it in a later run.', 409, 'listing_limit'); run.newJobIds.push(jobId); }
   if (duplicate && value.status === 'collected') status = 'duplicate';
   work.jobId = jobId; work.captured = true;
  }
  work.status = status; if (['assessed','excluded'].includes(status)) work.assessed = true;
  if (status === 'failed') { work.errorCode = value.errorCode ?? 'other'; run.errors.push({ code: work.errorCode!, message: errorMessages[work.errorCode!]!, workKey: work.workKey, createdAt: new Date().toISOString() }); run.errors = run.errors.slice(-500); }
 }); }
 reserve(id: string, input: unknown): ResearchRun {
  const result = this.change(id,input,'reservation',(run,value) => {
   this.active(run); if (this.work(run,value.workKey).deleted) throw new AppError('This job was deleted; its work cannot be reserved again.'); money(value.estimate);
   if (value.currency !== run.budget.currency) throw new AppError('Reservation currency must match the run budget currency.');
   if (units(value.estimate) > units(totals(run).remaining)) {
    run.status = 'budget-exhausted'; run.errors.push({code:'budget_exhausted',message:errorMessages.budget_exhausted!,workKey:value.workKey,createdAt:new Date().toISOString()}); run.errors = run.errors.slice(-500); return;
   }
   run.reservations.push({id:randomUUID(),operationId:value.operationId,workKey:value.workKey,estimate:value.estimate,currency:value.currency,status:'reserved',actual:null,used:false});
  });
  object(input);
  if (!result.reservations.some(reservation => reservation.operationId === input.operationId)) throw new AppError(errorMessages.budget_exhausted!,409,'budget_exhausted');
  return result;
 }
 settle(id: string, input: unknown): ResearchRun { return this.change(id,input,'cost',(run,value) => {
  text(value.reservationId,'reservationId'); if (value.actual !== null) money(value.actual);
  const reservation = run.reservations.find(item => item.id === value.reservationId);
  if (!reservation) throw new AppError('Reservation not found in this run.');
  if (reservation.status === 'settled') throw new AppError('Cost is already settled. Retry the original cost operation identifier.',409,'idempotency_conflict');
  reservation.status = 'settled'; reservation.actual = value.actual;
  if (units(totals(run).committed) > units(run.budget.amount) && !['cancelled','completed'].includes(run.status)) {
   run.status = 'budget-exhausted'; run.errors.push({code:'budget_exhausted',message:'Known provider cost exceeded its reservation. No further work is authorized until the budget is reviewed.',createdAt:new Date().toISOString()}); run.errors = run.errors.slice(-500);
  }
 }); }

 control(id: string, input: unknown): ResearchRun { return this.change(id,input,'control',(run,value) => {
  if (['cancelled','completed'].includes(run.status)) throw new AppError('This run is terminal. Create a new run to start new work.');
  if (['pause','stop','cancel'].includes(value.action)) { run.status = value.action === 'pause' ? 'paused' : value.action === 'stop' ? 'stopped' : 'cancelled'; return; }
  if (value.action === 'complete') { if (run.work.some(work => ['pending','working'].includes(work.status))) throw new AppError('Pending or working items remain. Checkpoint or cancel them before completing the run.'); run.status = 'completed'; return; }
  if (value.action === 'set-budget') {
   money(value.amount); if (value.currency !== run.budget.currency) throw new AppError('Budget currency cannot change within a run.');
   if (units(value.amount) < units(totals(run).committed)) throw new AppError('Budget cannot be lower than committed costs.');
   run.budget.amount = value.amount; run.status = 'paused'; return;
  }
  if (['wait-signin','wait-verification','session-expired'].includes(value.action)) {
   this.work(run,value.workKey); text(value.sessionRef,'sessionRef');
   if (run.status === 'session-expired' && value.action === 'wait-signin' && value.sessionRef === run.waiting?.sessionRef) throw new AppError('Use a new browser session reference after expiration.');
   if (!/^[A-Za-z0-9_-]{1,128}$/.test(value.sessionRef)) throw new AppError('Use an opaque nonsecret browser session reference, never cookies, tokens or passwords.');
   const page = new URL(webUrl(value.pageUrl));
   run.waiting = {workKey:value.workKey,sessionRef:value.sessionRef,pageUrl:page.origin + page.pathname};
   run.status = value.action === 'wait-signin' ? 'waiting-user-signin' : value.action === 'wait-verification' ? 'waiting-user-verification' : 'session-expired';
   if (value.action === 'session-expired') { run.errors.push({code:'session_expired',message:errorMessages.session_expired!,workKey:value.workKey,createdAt:new Date().toISOString()}); run.errors = run.errors.slice(-500); }
   return;
  }
  if (value.action === 'resume') {
   if (run.status === 'session-expired') throw new AppError('Open a new browser session and record wait-signin before resuming.');
   if (run.waiting && (value.sessionRef !== run.waiting.sessionRef || value.userConfirmed !== true)) throw new AppError('Confirm user completion in the same browser session and supply its matching sessionRef.');
   if (units(totals(run).committed) > units(run.budget.amount)) throw new AppError('Review and increase the budget before resuming.');
   run.status = 'running'; delete run.waiting; return;
  }
  throw new AppError('Choose pause, stop, resume, cancel, complete, wait-signin, wait-verification, session-expired or set-budget.');
 }); }

 /** Lifecycle hook: safe inside an enclosing deletion or preview transaction. */
 forgetJob(jobId: string): void {
  text(jobId,'jobId'); const db = this.app.database;
  db.exec('SAVEPOINT runs_forget_job');
  try {
   for (const row of db.prepare('SELECT id FROM research_runs').all()) {
    const run = this.stored(String(row.id));
    const keys = new Map<string,string>();
    for (const work of run.work.filter(item => item.jobId === jobId)) {
     const old = work.workKey, redacted = `deleted-${randomUUID()}`; keys.set(old,redacted);
     work.workKey = redacted; work.ingestionId = `deleted-${randomUUID()}`; work.url = ''; delete work.jobId; delete work.modelReservationId; delete work.errorCode; work.deleted = true;
     if (work.status === 'working' || work.status === 'pending') work.status = 'failed';
    }
    if (run.newJobIds.includes(jobId)) { run.newJobIds = run.newJobIds.filter(id => id !== jobId); run.removedNewJobs = (run.removedNewJobs ?? 0) + 1; }
    run.baselineJobIds = run.baselineJobIds.filter(id => id !== jobId);
    if (keys.size) {
     for (const cost of run.reservations) if (keys.has(cost.workKey)) cost.workKey = keys.get(cost.workKey)!;
     for (const error of run.errors) if (error.workKey && keys.has(error.workKey)) error.workKey = keys.get(error.workKey)!;
     if (run.waiting && keys.has(run.waiting.workKey)) delete run.waiting;
     if (!['cancelled','completed','stopped'].includes(run.status)) run.status = 'paused';
     for (const operation of db.prepare('SELECT operation_id,input_json FROM run_operations WHERE run_id=?').all(run.id)) {
      const input = JSON.parse(String(operation.input_json));
      if (input.jobId === jobId || keys.has(input.workKey)) db.prepare('DELETE FROM run_operations WHERE run_id=? AND operation_id=?').run(run.id,String(operation.operation_id));
     }
    }
    db.prepare('UPDATE research_runs SET state_json=? WHERE id=?').run(JSON.stringify(run),run.id);
   }
   db.exec('RELEASE runs_forget_job');
  } catch (error) { db.exec('ROLLBACK TO runs_forget_job'); db.exec('RELEASE runs_forget_job'); throw error; }
 }
 private disposable(clean: boolean) {
  let removedBytes = 0, totalBytes = 0, skippedSymlinks = 0;
  const directories: {kind:string;bytes:number;capBytes:number;maxAgeHours:number}[] = [];
  for (const kind of ['cache','temp','logs'] as const) {
   const root = join(this.app.paths[kind],'runs'), capBytes = 16 * 1024 * 1024, age = kind === 'temp' ? 24 : 168;
   const files: {path:string;size:number;mtime:number}[] = [];
   const folders: string[] = [];
   const visit = (directory: string) => {
    let info; try { info = lstatSync(directory); } catch { return; }
    if (info.isSymbolicLink()) { skippedSymlinks++; return; }
    if (!info.isDirectory()) return;
    folders.push(directory);
    for (const entry of readdirSync(directory)) {
     const path = join(directory,entry); const stat = lstatSync(path);
     if (stat.isSymbolicLink()) { skippedSymlinks++; continue; }
     if (stat.isDirectory()) visit(path); else if (stat.isFile()) files.push({path,size:stat.size,mtime:stat.mtimeMs});
    }
   };
   visit(root); files.sort((a,b) => a.mtime - b.mtime);
   let bytes = files.reduce((sum,file) => sum + file.size,0);
   if (clean) for (const file of files) if (Date.now() - file.mtime > age * 3600000 || bytes > capBytes) { unlinkSync(file.path); removedBytes += file.size; bytes -= file.size; }
   if (clean) for (const directory of folders.reverse()) try { rmdirSync(directory); } catch {}
   totalBytes += bytes; directories.push({kind,bytes,capBytes,maxAgeHours:age});
  }
  return {directories,totalBytes,removedBytes,skippedSymlinks};
 }
 storage() { return this.disposable(false); }
 cleanupStorage() { return this.disposable(true); }

}

export const runsRoute: ApiRoute = async ({app,request,url,json,send}) => {
 const service = new RunsService(app);
 if (request.method === 'GET' && url.pathname === '/api/v1/runs/storage') { send(service.storage()); return true; }
 if (request.method === 'POST' && url.pathname === '/api/v1/runs/storage/cleanup') { await json(); send(service.cleanupStorage()); return true; }
 if (url.pathname === '/api/v1/runs') {
  if (request.method === 'GET') { send(service.list()); return true; }
  if (request.method === 'POST') { send(service.create(await json() as RunInput),201); return true; }
 }
 const match = /^\/api\/v1\/runs\/([^/]+)(?:\/(queue|authorize|checkpoints|reservations|costs|control))?$/.exec(url.pathname);
 if (!match) return false; const id = decodeURIComponent(match[1]!);
 if (request.method === 'GET' && !match[2]) { send(service.get(id)); return true; }
 if (request.method === 'POST' && match[2]) {
  const input = await json();
  const methods = {queue:'enqueue',authorize:'authorize',checkpoints:'checkpoint',reservations:'reserve',costs:'settle',control:'control'} as const;
  send(service[methods[match[2] as keyof typeof methods]](id,input)); return true;
 }
 return false;
};
