import { vacancyIdentity } from './reconciliation-state.ts';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { AppError, CareerVistaApp } from './app.ts';
import type { ApiRoute } from './server.ts';

export const detailFields = ['title', 'company', 'requirements', 'benefits', 'location', 'workArrangement', 'employment'] as const;
export interface EvidenceReference { observationId: string; quote: string }
export interface ExtractedField { status: 'known' | 'unknown'; value: string | null; evidence: EvidenceReference[] }
export type ListingDetails = Record<typeof detailFields[number], ExtractedField>;
export interface AnalysisInput {
  submissionId: string; jobId: string; observationIds: string[];
  metadata: { agent: string; provider?: string; model?: string; analysisVersion: string };
  details: ListingDetails; supersedesId?: string; reason?: string;
}
export interface Analysis extends AnalysisInput { id: string; createdAt: string }
export interface AnalysisFailure { id: string; jobId: string; submissionId: string; code: string; message: string; createdAt: string }
const failureMessages: Record<string, string> = {
  invalid_analysis: 'Analysis was rejected. Check the version 1 schema and supply verbatim evidence for every known field, then retry with a new submission identifier.',
  provider_failure: 'The agent provider failed. Saved evidence is intact. Check provider settings in your agent host and retry.',
  malformed_output: 'The agent returned malformed output. Saved evidence is intact. Ask the agent to resubmit version 1 structured JSON.',
};
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function string(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 8000) throw new AppError(`${name} must be non-empty text up to 8000 characters.`);
}
export class ExtractionService {
  readonly app: CareerVistaApp;
  constructor(app: CareerVistaApp) { this.app = app; }
  history(jobId: string, sourceOnly = false): { analyses: Analysis[]; failures: AnalysisFailure[] } {
    const memberIds = sourceOnly ? [jobId] : vacancyIdentity(this.app.database, jobId).memberJobIds;
    this.app.getJob(jobId);
    const analyses = this.app.database.prepare(`SELECT id, input_json, created_at FROM analyses WHERE job_id IN (${memberIds.map(() => '?').join(',')}) ORDER BY rowid`).all(...memberIds).map(row => ({ ...JSON.parse(String(row.input_json)), id: String(row.id), createdAt: String(row.created_at) }));
    const failures = this.app.database.prepare(`SELECT id, job_id AS jobId, submission_id AS submissionId, code, created_at AS createdAt FROM analysis_failures WHERE job_id IN (${memberIds.map(() => '?').join(',')}) ORDER BY rowid`).all(...memberIds).map(row => ({ ...row, message: failureMessages[String(row.code)]! })) as unknown as AnalysisFailure[];
    return { analyses, failures };
  }
  submitAnalysis(input: unknown): { analysis: Analysis; replayed: boolean } {
    if (!record(input)) throw new AppError('Submit a version 1 analysis object.');
    string(input.jobId, 'jobId'); string(input.submissionId, 'submissionId');
    const job = this.app.getJob(input.jobId);
    const existing = this.app.database.prepare('SELECT id, input_json, created_at FROM analyses WHERE submission_id = ?').get(input.submissionId);
    if (existing) {
      if (!isDeepStrictEqual(JSON.parse(String(existing.input_json)), input)) throw new AppError('This analysis identifier already has different content. Use a new identifier.', 409, 'idempotency_conflict');
      return { analysis: { ...input, id: String(existing.id), createdAt: String(existing.created_at) } as unknown as Analysis, replayed: true };
    }
    try {
      const allowed = ['submissionId', 'jobId', 'observationIds', 'metadata', 'details', 'supersedesId', 'reason'];
      if (Object.keys(input).some(key => !allowed.includes(key))) throw new AppError('Analysis contains unsupported fields.');
      if (!Array.isArray(input.observationIds) || !input.observationIds.length || input.observationIds.some(id => typeof id !== 'string' || !job.observations.some(o => o.id === id))) throw new AppError('observationIds must identify saved evidence belonging to this job. Save evidence first.');
      if (!record(input.metadata) || Object.keys(input.metadata).some(key => !['agent', 'provider', 'model', 'analysisVersion'].includes(key))) throw new AppError('metadata must contain agent and analysisVersion, with optional provider and model names.');
      string(input.metadata.agent, 'metadata.agent'); string(input.metadata.analysisVersion, 'metadata.analysisVersion');
      for (const key of ['provider', 'model']) if (input.metadata[key] !== undefined) string(input.metadata[key], `metadata.${key}`);
      if (!record(input.details) || Object.keys(input.details).length !== detailFields.length) throw new AppError('details must contain every version 1 field, using unknown for missing information.');
      for (const name of detailFields) {
        const field = input.details[name];
        if (!record(field) || Object.keys(field).some(key => !['status', 'value', 'evidence'].includes(key)) || !Array.isArray(field.evidence)) throw new AppError(`${name} requires status, value and evidence.`);
        if (field.status === 'unknown') {
          if (field.value !== null || field.evidence.length) throw new AppError(`Unknown ${name} must have null value and empty evidence.`);
        } else if (field.status === 'known') {
          string(field.value, name);
          if (!field.evidence.length) throw new AppError(`Known ${name} needs supporting evidence.`);
          for (const ref of field.evidence) {
            if (!record(ref) || Object.keys(ref).some(key => !['observationId', 'quote'].includes(key))) throw new AppError('Evidence references require observationId and quote.');
            string(ref.observationId, 'observationId'); string(ref.quote, 'quote');
            if (!input.observationIds.includes(ref.observationId) || !job.observations.find(o => o.id === ref.observationId)?.text.includes(ref.quote)) throw new AppError(`${name} quote must appear verbatim in its linked saved observation.`);
          }
        } else throw new AppError(`${name} status must be known or unknown.`);
      }
      if (input.supersedesId !== undefined) {
        string(input.supersedesId, 'supersedesId'); string(input.reason, 'correction reason');
        if (!this.history(job.id).analyses.some(a => a.id === input.supersedesId)) throw new AppError('Correction must reference an analysis of this job.');
      } else if (input.reason !== undefined) throw new AppError('A correction reason requires supersedesId.');
      const createdAt = new Date().toISOString(), id = randomUUID();
      this.app.database.prepare('INSERT INTO analyses VALUES (?, ?, ?, ?, ?)').run(id, job.id, input.submissionId, JSON.stringify(input), createdAt);
      return { analysis: { ...input, id, createdAt } as unknown as Analysis, replayed: false };
    } catch (error) {
      this.recordFailure({ jobId: input.jobId, submissionId: input.submissionId, code: 'invalid_analysis' });
      throw error;
    }
  }
  recordFailure(input: unknown): AnalysisFailure {
    if (!record(input)) throw new AppError('Supply jobId, submissionId and a supported failure code.');
    string(input.jobId, 'jobId'); string(input.submissionId, 'submissionId');
    this.app.getJob(input.jobId);
    if (typeof input.code !== 'string' || !Object.hasOwn(failureMessages, input.code)) throw new AppError('code must be provider_failure, malformed_output or invalid_analysis. Send no provider response or credentials.');
    const existing = this.app.database.prepare('SELECT job_id, code FROM analysis_failures WHERE submission_id = ?').get(input.submissionId);
    if (existing && (existing.job_id !== input.jobId || existing.code !== input.code)) throw new AppError('Failure identifier already has different content.', 409, 'idempotency_conflict');
    if (!existing) this.app.database.prepare('INSERT INTO analysis_failures VALUES (?, ?, ?, ?, ?)').run(randomUUID(), input.jobId, input.submissionId, input.code, new Date().toISOString());
    return this.history(input.jobId).failures.find(f => f.submissionId === input.submissionId)!;
  }
}
export const extractionRoute: ApiRoute = async ({ app, request, url, json, send }) => {
  const service = new ExtractionService(app);
  const match = /^\/api\/v1\/jobs\/([^/]+)\/analyses$/.exec(url.pathname);
  if (request.method === 'GET' && match) { send(service.history(decodeURIComponent(match[1]!))); return true; }
  if (request.method === 'POST' && url.pathname === '/api/v1/analyses') { const result = service.submitAnalysis(await json()); send(result, result.replayed ? 200 : 201); return true; }
  if (request.method === 'POST' && url.pathname === '/api/v1/analysis-failures') { send(service.recordFailure(await json()), 201); return true; }
  return false;
};
