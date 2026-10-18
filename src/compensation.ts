import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { AppError, CareerVistaApp } from './app.ts';
import type { ApiRoute } from './server.ts';
export interface CompensationAmount {
  min: number | null; max: number | null; currency: string | null;
  period: 'year' | 'month' | 'week' | 'day' | 'hour' | 'contract' | 'unknown';
  basis: 'base' | 'total_package' | 'unknown';
  superannuation: 'included' | 'excluded' | 'not_applicable' | 'unknown';
  contractUnit: string | null;
}
export interface CompensationInput {
  operationId: string; kind: 'advertised' | 'external_report' | 'model_estimate' | 'user_adjustment';
  attribution: string; amount: CompensationAmount;
  evidence: { observationId: string; quote: string }[];
  uncertainty?: string; rationale?: string; referenceId?: string | null;
}
export interface CompensationRecord extends CompensationInput { id: string; jobId: string; createdAt: string; displayLabel: string }
function text(value: unknown, field: string, optional = false): asserts value is string {
  if (optional && value === undefined) return;
  if (typeof value !== 'string' || !value.trim() || value.length > 8000) throw new AppError(`${field} must be non-empty text of at most 8000 characters.`);
}
function display(amount: CompensationAmount) {
  const figures = amount.min === null && amount.max === null ? 'Unknown amount' : amount.min === amount.max ? String(amount.min) : amount.min === null ? `up to ${amount.max}` : amount.max === null ? `from ${amount.min}` : `${amount.min}–${amount.max}`;
  return `${figures} ${amount.currency ?? '(currency unknown)'} / ${amount.period}${amount.contractUnit ? ` (${amount.contractUnit})` : ''} · ${amount.basis.replaceAll('_', ' ')} · super ${amount.superannuation.replaceAll('_', ' ')}`;
}
/** Immutable, attributed figures; deliberately performs no conversion or annualisation. */
export class Compensation {
  private app: CareerVistaApp;
  constructor(app: CareerVistaApp) { this.app = app; }
  history(jobId: string) {
    const job = this.app.getJob(jobId);
    const records = this.app.database.prepare('SELECT id, job_id AS jobId, input_json AS inputJson, created_at AS createdAt FROM compensation_records WHERE job_id = ? ORDER BY sequence').all(jobId).map(row => {
      const input = JSON.parse(String(row.inputJson)) as CompensationInput;
      return { ...input, id: String(row.id), jobId, createdAt: String(row.createdAt), displayLabel: display(input.amount) } as CompensationRecord;
    });
    return { jobId, records, sources: job.observations.map(observation => ({ observationId: observation.id, source: observation.source, sourceUrl: observation.sourceUrl, capturedAt: observation.capturedAt })) };
  }
  record(jobId: string, input: CompensationInput) {
    const job = this.app.getJob(jobId);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError('An attributed compensation record is required.');
    text(input.operationId, 'operationId'); text(input.attribution, 'attribution');
    if (!['advertised', 'external_report', 'model_estimate', 'user_adjustment'].includes(input.kind)) throw new AppError('kind must identify advertised, external_report, model_estimate or user_adjustment.');
    const amount = input.amount;
    if (!amount || typeof amount !== 'object' || Array.isArray(amount)) throw new AppError('amount must preserve figures, currency, period, basis, superannuation and contractUnit.');
    for (const bound of ['min', 'max'] as const) if (amount[bound] !== null && (typeof amount[bound] !== 'number' || !Number.isFinite(amount[bound]) || amount[bound] < 0)) throw new AppError(`${bound} must be a nonnegative number or null for unknown.`);
    if (amount.min !== null && amount.max !== null && amount.min > amount.max) throw new AppError('min cannot exceed max.');
    if (amount.currency !== null && (typeof amount.currency !== 'string' || !/^[A-Z]{3}$/.test(amount.currency))) throw new AppError('currency must be a three-letter uppercase code or null for unknown.');
    if (!['year', 'month', 'week', 'day', 'hour', 'contract', 'unknown'].includes(amount.period)) throw new AppError('period must be year, month, week, day, hour, contract or unknown.');
    if (!['base', 'total_package', 'unknown'].includes(amount.basis)) throw new AppError('basis must be base, total_package or unknown.');
    if (!['included', 'excluded', 'not_applicable', 'unknown'].includes(amount.superannuation)) throw new AppError('superannuation must be included, excluded, not_applicable or unknown.');
    if (amount.contractUnit !== null) text(amount.contractUnit, 'contractUnit');
    if (!Array.isArray(input.evidence) || input.evidence.length > 30) throw new AppError('evidence must be an array of at most 30 saved observation quotes.');
    const evidence = input.evidence.map(reference => {
      if (!reference || typeof reference !== 'object') throw new AppError('Each evidence reference needs observationId and quote.');
      text(reference.observationId, 'observationId'); text(reference.quote, 'quote');
      const observation = job.observations.find(item => item.id === reference.observationId);
      if (!observation || !observation.text.includes(reference.quote)) throw new AppError('Compensation evidence must quote saved evidence from this job verbatim.');
      return { observationId: reference.observationId, quote: reference.quote };
    });
    if (['advertised', 'external_report'].includes(input.kind) && !evidence.length) throw new AppError('Advertised figures and external reports require saved observation evidence.');
    text(input.uncertainty, 'uncertainty', true); text(input.rationale, 'rationale', true);
    if (input.kind === 'model_estimate') { text(input.uncertainty, 'uncertainty for a model estimate'); text(input.rationale, 'rationale for a model estimate'); }
    if (input.kind === 'user_adjustment') {
      text(input.referenceId, 'referenceId for the original figure'); text(input.rationale, 'rationale for a user adjustment');
      const original = this.history(jobId).records.find(item => item.id === input.referenceId);
      if (!original || original.kind === 'user_adjustment') throw new AppError('An adjustment must reference an immutable original advertised figure, report or estimate from this job.');
    } else if (input.referenceId !== undefined && input.referenceId !== null) throw new AppError('referenceId is only supported for user adjustments.');
    const normalized = { operationId: input.operationId, kind: input.kind, attribution: input.attribution, amount: { min: amount.min, max: amount.max, currency: amount.currency, period: amount.period, basis: amount.basis, superannuation: amount.superannuation, contractUnit: amount.contractUnit }, evidence, uncertainty: input.uncertainty ?? '', rationale: input.rationale ?? '', referenceId: input.referenceId ?? null };
    const existing = this.app.database.prepare('SELECT id, job_id, input_json FROM compensation_records WHERE operation_id = ?').get(input.operationId);
    if (existing) {
      if (existing.job_id !== jobId || !isDeepStrictEqual(JSON.parse(String(existing.input_json)), normalized)) throw new AppError('This operationId already has different compensation content. Use a new identifier for a new record.', 409, 'idempotency_conflict');
      return { record: this.history(jobId).records.find(record => record.id === existing.id)!, replayed: true };
    }
    const id = randomUUID();
    this.app.database.prepare('INSERT INTO compensation_records (id, job_id, operation_id, input_json, created_at) VALUES (?, ?, ?, ?, ?)').run(id, jobId, input.operationId, JSON.stringify(normalized), new Date().toISOString());
    return { record: this.history(jobId).records.at(-1)!, replayed: false };
  }
  summary(jobId: string) {
    const records = this.history(jobId).records;
    const original = records.findLast(record => record.kind === 'advertised') ?? records.findLast(record => record.kind === 'external_report') ?? records.findLast(record => record.kind === 'model_estimate');
    const adjustment = records.findLast(record => record.kind === 'user_adjustment');
    return { jobId, label: original?.displayLabel ?? 'Unknown', provenance: original?.kind ?? null, uncertainty: original?.uncertainty ?? null, adjustment: adjustment ? { label: adjustment.displayLabel, referenceId: adjustment.referenceId } : null, recordsCount: records.length };
  }
  summaries() { return this.app.listJobs().map(job => this.summary(job.id)); }
}
export const compensationRoutes: ApiRoute = async ({ app, request, url, json, send }) => {
  const service = new Compensation(app);
  if (url.pathname === '/api/v1/compensation/summaries' && request.method === 'GET') { send(service.summaries()); return true; }
  const match = /^\/api\/v1\/jobs\/([^/]+)\/compensation(?:\/(summary))?$/.exec(url.pathname);
  if (!match) return false;
  const jobId = decodeURIComponent(match[1]!);
  if (request.method === 'GET') { send(match[2] ? service.summary(jobId) : service.history(jobId)); return true; }
  if (request.method === 'POST' && !match[2]) { const result = service.record(jobId, await json() as CompensationInput); send(result, result.replayed ? 200 : 201); return true; }
  return false;
};
