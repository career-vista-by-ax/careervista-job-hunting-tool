import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Profile } from '../profiles.ts';
import type { RunInput, ResearchRun } from '../runs.ts';
import type { SourcePlan, SourceCollection } from '../collection.ts';
import type { Assessment, AssessmentInput } from '../assessments.ts';
import type { JobDetail, Observation } from '../app.ts';

type Candidate = ReturnType<SourceCollection['candidates']>[number];
interface PlanInput { source: string; config: { location?: string; origin?: string } }
interface Preview { url: string; title?: string; company?: string; location?: string; snippet?: string }
interface CaptureInput {
  operationId: string; workKey: string; capturedAt: string; title: string; company: string; location?: string;
  text: string; links?: { kind: 'employer'|'application'; url: string; label: string }[]; partial?: boolean;
  captureMethod?: 'headless-http'|'headless-browser'|'supervised-browser';
  apiContext?: { method: 'public-api'; provider: 'greenhouse'|'lever'; endpoint: string };
}
export interface AgentTaskInputs {
  'search-context': { runId?: string; offset?: number; limit?: number };
  'plan-search': { run: RunInput; plans: PlanInput[] };
  'prepare-work': { runId: string; operationId: string; workKey: string; modelWork: boolean; estimate?: number; currency?: string };
  'save-previews': { runId: string; operationId: string; searchKey: string; outcome: 'results'|'zero-results'|'access-failure'|'unsupported-content'; listings?: Preview[] };
  'screen-candidates': { runId: string; operationId: string; decisions: { workKey: string; disposition: 'selected'|'skipped'; reason: string }[] };
  'capture-evidence': { runId: string; capture: CaptureInput };
  'save-assessment': { assessment: AssessmentInput };
}
export class AgentTaskError extends Error {
  readonly status: number; readonly code: string;
  constructor(message: string, status = 0, code = 'client_error') { super(message); this.status = status; this.code = code; }
}
const operation = (kind: string, ...keys: string[]) => `task-${kind}-${createHash('sha256').update(JSON.stringify(keys)).digest('hex').slice(0,40)}`;
const part = (value: string) => encodeURIComponent(value);
const summary = (run: ResearchRun) => ({ id: run.id, status: run.status, profileVersion: run.profileVersion, trackIds: run.trackIds, sources: run.sources, budget: run.budget, limit: run.limit, discoveryLimit: run.discoveryLimit, counters: run.counters, costs: run.costs, waiting: run.waiting });

/** Small local HTTP client; domain rules and operation receipts remain in the existing API. */
export class LocalAgentTasks {
  readonly origin: string;
  private readonly fetcher: typeof fetch;
  constructor(origin: string, fetcher: typeof fetch = fetch) {
    this.fetcher = fetcher;
    const url = new URL(origin);
    if (url.protocol !== 'http:' || !['127.0.0.1','localhost','[::1]'].includes(url.hostname) || url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new AgentTaskError('Use the exact loopback HTTP origin returned by CareerVista.');
    this.origin = url.origin;
  }
  private async request<T>(path: string, body?: unknown): Promise<T> {
    const encoded = body === undefined ? undefined : JSON.stringify(body);
    if (encoded && Buffer.byteLength(encoded) > 2_000_000) throw new AgentTaskError('Task request exceeds the API body limit.');
    let response: Response;
    try { response = await this.fetcher(`${this.origin}/api/v1${path}`, { method: body === undefined ? 'GET' : 'POST', headers: encoded ? { 'Content-Type': 'application/json' } : {}, body: encoded, redirect: 'error', signal: AbortSignal.timeout(15000) }); }
    catch { throw new AgentTaskError('Local API request failed; inspect saved state before retrying with the same identifiers.'); }
    const reader = response.body?.getReader();
    if (!reader) throw new AgentTaskError('Local API returned no JSON.', response.status);
    const chunks: Uint8Array[] = []; let bytes = 0;
    try { while (true) { const item = await reader.read(); if (item.done) break; bytes += item.value.length; if (bytes > 16_000_000) throw new AgentTaskError('Local API response exceeds the client limit.', response.status); chunks.push(item.value); } }
    finally { await reader.cancel(); }
    let data: any;
    try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AgentTaskError('Local API returned invalid JSON.', response.status); }
    if (!response.ok) throw new AgentTaskError(typeof data.error?.message === 'string' ? data.error.message.slice(0,1000) : 'Local API rejected the task.', response.status, typeof data.error?.code === 'string' ? data.error.code : 'api_error');
    return data as T;
  }
  async execute<K extends keyof AgentTaskInputs>(task: K, input: AgentTaskInputs[K]): Promise<unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AgentTaskError('Supply a JSON task object.');
    switch (task) {
      case 'search-context': {
        const { runId, offset = 0, limit = 25 } = input as AgentTaskInputs['search-context'];
        if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new AgentTaskError('Use offset >= 0 and limit 1–100.');
        if (!runId) return { profile: await this.request<Profile|null>('/profiles/active') };
        const run = await this.request<ResearchRun>(`/runs/${part(runId)}`);
        const [profile, candidates] = await Promise.all([this.request<Profile>(`/profiles/${run.profileVersion}`), this.request<Candidate[]>(`/runs/${part(runId)}/collection/candidates`)]);
        const unfinished = run.work.filter(work => work.status === 'pending' || work.status === 'working' || work.status === 'failed');
        return { profile, run: summary(run), unfinishedWork: unfinished.slice(0,25), unfinishedWorkTotal: unfinished.length,
          candidates: candidates.slice(offset,offset+limit).map(item => ({ ...item, preview: { ...item.preview, ...(item.preview.snippet ? { snippet: item.preview.snippet.slice(0,500) } : {}) } })),
          totalCandidates: candidates.length, nextOffset: offset+limit < candidates.length ? offset+limit : null };
      }
      case 'plan-search': {
        const { run: settings, plans } = input as AgentTaskInputs['plan-search'];
        if (!settings || !Array.isArray(settings.sources) || !Array.isArray(plans) || plans.length !== settings.sources.length || new Set(plans.map(plan => plan.source)).size !== plans.length || plans.some(plan => !settings.sources.includes(plan.source))) throw new AgentTaskError('Provide one source plan for each source in the approved run.');
        const run = await this.request<ResearchRun>('/runs', settings);
        const saved: SourcePlan[] = [], failures: { source: string; message: string; code: string }[] = [];
        for (const plan of plans) {
          try { saved.push(await this.request<SourcePlan>(`/runs/${part(run.id)}/collection/plans`, { ...plan, operationId: operation('plan',settings.requestId,plan.source) })); }
          catch (error) { if (!(error instanceof AgentTaskError)) throw error; failures.push({ source: plan.source, message: error.message, code: error.code }); }
        }
        return { run: summary(await this.request<ResearchRun>(`/runs/${part(run.id)}`)), plans: saved, failures, partial: failures.length > 0 };
      }
      case 'prepare-work': {
        const { runId, operationId, workKey, modelWork, estimate, currency } = input as AgentTaskInputs['prepare-work'];
        if (typeof modelWork !== 'boolean' || typeof operationId !== 'string' || !operationId.trim() || operationId.length > 128 || typeof workKey !== 'string' || !workKey.trim() || workKey.length > 128) throw new AgentTaskError('Supply operationId, workKey and an explicit modelWork boolean.');
        let reservation: { id: string }|undefined;
        if (modelWork) {
          const reservationOperation = operation('reserve',operationId);
          const reserved = await this.request<ResearchRun>(`/runs/${part(runId)}/reservations`, { operationId: reservationOperation, workKey, estimate, currency });
          reservation = reserved.reservations.find(item => item.operationId === reservationOperation);
          if (!reservation) throw new AgentTaskError('Reservation was not returned; inspect the run before continuing.');
        }
        const run = await this.request<ResearchRun>(`/runs/${part(runId)}/collection/prepare`, { operationId, workKey, modelWork, ...(reservation ? { reservationId: reservation.id } : {}) });
        return { run: summary(run), work: run.work.find(work => work.workKey === workKey), reservationId: reservation?.id };
      }
      case 'save-previews': {
        const { runId, ...payload } = input as AgentTaskInputs['save-previews'];
        await this.request(`/runs/${part(runId)}/collection/discover`, { ...payload, deferCapture: true });
        return { run: summary(await this.request<ResearchRun>(`/runs/${part(runId)}`)), searchKey: payload.searchKey, outcome: payload.outcome };
      }
      case 'screen-candidates': {
        const { runId, ...payload } = input as AgentTaskInputs['screen-candidates'];
        const candidates = await this.request<Candidate[]>(`/runs/${part(runId)}/collection/select`,payload);
        return { total: candidates.length, selected: candidates.filter(item => item.disposition === 'selected').length, skipped: candidates.filter(item => item.disposition === 'skipped').length, pending: candidates.filter(item => item.disposition === 'pending').length };
      }
      case 'capture-evidence': {
        const { runId, capture } = input as AgentTaskInputs['capture-evidence'];
        const saved = await this.request<{ job: JobDetail; observation: Observation; completion: string }>(`/runs/${part(runId)}/collection/capture`,capture);
        return { jobId: saved.job.id, observationId: saved.observation.id, completion: saved.completion, method: saved.observation.context.method };
      }
      case 'save-assessment': {
        const saved = await this.request<{ assessment: Assessment; replayed: boolean }>('/assessments',(input as AgentTaskInputs['save-assessment']).assessment);
        return { assessmentId: saved.assessment.id, jobId: saved.assessment.jobId, label: saved.assessment.label, profileVersion: saved.assessment.profileVersion, replayed: saved.replayed };
      }
      default: throw new AgentTaskError('Unknown task; use --help.');
    }
  }
}

export const taskHelp = {
  'search-context': '{runId?,offset?:0,limit?:25}: active/pinned profile, run summary, paged previews; no resume or full listing text',
  'plan-search': '{run:{requestId,profileVersion,trackIds,sources,limit,discoveryLimit,budget},plans:[{source,config}]}: save approved run and source plans; partial failures are explicit',
  'prepare-work': '{runId,operationId,workKey,modelWork,estimate?,currency?}: reserve model cost when needed, then authorize planned work',
  'save-previews': '{runId,operationId,searchKey,outcome,listings?:[{url,title?,company?,location?,snippet?}]}: deferred discovery for prepared search',
  'screen-candidates': '{runId,operationId,decisions:[{workKey,disposition:selected|skipped,reason}]}: queue selected candidates within run bounds',
  'capture-evidence': '{runId,capture:{operationId,workKey,capturedAt,title,company,text,...}}: save verified evidence for prepared listing; return IDs only',
  'save-assessment': '{assessment:<documented AssessmentInput>}: save evidence-linked agent reasoning; return IDs/label only',
};
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--help') console.log(JSON.stringify({ usage: 'node dist/tools/agent-tasks.js --origin <exact localhost origin> --task <name> < input.json', tasks: taskHelp }));
    else {
      if (args.length !== 4 || args[0] !== '--origin' || args[2] !== '--task' || !Object.hasOwn(taskHelp,args[3]!)) throw new AgentTaskError('Use --origin <origin> --task <name> with JSON on stdin; --help lists tasks.');
      const raw = readFileSync(0,'utf8');
      if (Buffer.byteLength(raw) > 2_000_000) throw new AgentTaskError('Task input exceeds the API limit.');
      const result = await new LocalAgentTasks(args[1]!).execute(args[3] as keyof AgentTaskInputs,JSON.parse(raw));
      console.log(JSON.stringify(result));
      if ((result as {partial?:boolean}).partial) process.exitCode = 1;
    }
  } catch (error) {
    console.error(JSON.stringify(error instanceof AgentTaskError ? {error:{code:error.code,message:error.message,status:error.status}} : {error:{code:'invalid_task',message:'Task failed; inspect saved state before retrying. Use --help for input shapes.'}}));
    process.exitCode = 1;
  }
}
