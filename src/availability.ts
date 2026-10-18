import { vacancyIdentity } from './reconciliation-state.ts';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { AppError, CareerVistaApp } from './app.ts';
import type { ApiRoute } from './server.ts';
export const checkResults = ['active', 'confirmed_closed', 'could_not_verify'] as const;
export const checkFailures = ['authentication', 'verification', 'blocked', 'timeout', 'network', 'parsing'] as const;
export interface AvailabilityInput {
  operationId: string; sourceUrl: string; checkedAt: string;
  result: typeof checkResults[number]; failureReason?: typeof checkFailures[number]; text?: string; quote?: string;
}
export interface AvailabilityCheck extends AvailabilityInput { id: string; jobId: string; createdAt: string }
function required(value: unknown, key: string, max = 8000): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new AppError(`${key} must be non-empty text of at most ${max} characters.`);
}
/** Source availability and application progress deliberately have separate histories. */
export class Availability {
  private app: CareerVistaApp;
  constructor(app: CareerVistaApp) { this.app = app; }
  history(jobId: string, sourceOnly = false) {
    const memberIds = sourceOnly ? [jobId] : vacancyIdentity(this.app.database, jobId).memberJobIds;
    this.app.getJob(jobId);
    const checks = this.app.database.prepare(`SELECT id,input_json,created_at FROM availability_checks WHERE job_id IN (${memberIds.map(() => '?').join(',')}) ORDER BY sequence`).all(...memberIds).map(row => ({ ...JSON.parse(String(row.input_json)), id: String(row.id), createdAt: String(row.created_at) })) as AvailabilityCheck[];
    const chronological = [...checks].sort((a, b) => Date.parse(a.checkedAt) - Date.parse(b.checkedAt));
    const latest = chronological.at(-1) ?? null;
    const lastSuccessful = chronological.filter(check => check.result !== 'could_not_verify').at(-1) ?? null;
    return { jobId, status: lastSuccessful?.result ?? 'unknown', latest, lastSuccessful, checks };
  }
  record(jobId: string, input: AvailabilityInput) {
    const job = this.app.getJob(jobId);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError('Provide a source-check object.');
    if (Object.keys(input).some(key => !['operationId', 'sourceUrl', 'checkedAt', 'result', 'failureReason', 'text', 'quote'].includes(key))) throw new AppError('Unsupported source-check field. Do not submit browser credentials or raw failure pages.');
    required(input.operationId, 'operationId'); required(input.sourceUrl, 'sourceUrl'); required(input.checkedAt, 'checkedAt');
    let url: URL;
    try { url = new URL(input.sourceUrl); } catch { throw new AppError('sourceUrl must identify a saved listing URL.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !job.observations.some(item => new URL(item.sourceUrl).href === url.href)) throw new AppError('sourceUrl must match this job’s saved source, without embedded credentials.');
    if (!/^\d{4}-\d\d-\d\dT/.test(input.checkedAt) || !Number.isFinite(Date.parse(input.checkedAt))) throw new AppError('checkedAt must be an ISO8601 timestamp.');
    if (!checkResults.includes(input.result)) throw new AppError('result must be active, confirmed_closed or could_not_verify.');
    if (input.result === 'could_not_verify') {
      if (!input.failureReason || !checkFailures.includes(input.failureReason) || input.text !== undefined || input.quote !== undefined) throw new AppError('Failed checks need a supported failureReason only; no raw failure page or credentials.');
    } else {
      if (input.failureReason !== undefined) throw new AppError('A failed access check cannot confirm an active or closed listing. Use could_not_verify.');
      required(input.text, 'Captured check text', 1_000_000); required(input.quote, 'Supporting quote');
      if (!input.text.includes(input.quote)) throw new AppError('Supporting quote must appear verbatim in captured check text.');
    }
    const payload = { ...input, jobId };
    const existing = this.app.database.prepare('SELECT input_json FROM availability_checks WHERE operation_id=?').get(input.operationId);
    if (existing) {
      if (!isDeepStrictEqual(JSON.parse(String(existing.input_json)), payload)) throw new AppError('This check identifier already has different content. Use a new identifier.', 409, 'idempotency_conflict');
      return { check: this.history(jobId).checks.find(item => item.operationId === input.operationId)!, replayed: true };
    }
    const id = randomUUID(), createdAt = new Date().toISOString();
    this.app.database.prepare('INSERT INTO availability_checks(id,job_id,operation_id,input_json,created_at) VALUES (?,?,?,?,?)').run(id, jobId, input.operationId, JSON.stringify(payload), createdAt);
    return { check: { ...payload, id, createdAt }, replayed: false };
  }
  summaries() { return this.app.listJobs().map(job => { const { checks, ...summary } = this.history(job.id); return summary; }); }
  activeJobs() { const closed = new Set(this.summaries().filter(item => item.status === 'confirmed_closed').map(item => item.jobId)); return this.app.listJobs().filter(job => !closed.has(job.id)); }
}
export const availabilityRoutes: ApiRoute = async ({ app, request, url, json, send }) => {
  const service = new Availability(app);
  if (request.method === 'GET' && url.pathname === '/api/v1/jobs' && url.searchParams.get('availability') === 'active') { send(service.activeJobs()); return true; }
  if (request.method === 'GET' && url.pathname === '/api/v1/availability') { send(service.summaries()); return true; }
  const match = /^\/api\/v1\/jobs\/([^/]+)\/availability$/.exec(url.pathname);
  if (!match) return false;
  const id = decodeURIComponent(match[1]!);
  if (request.method === 'GET') { send(service.history(id)); return true; }
  if (request.method === 'POST') { const result = service.record(id, await json() as AvailabilityInput); send(result, result.replayed ? 200 : 201); return true; }
  return false;
};
