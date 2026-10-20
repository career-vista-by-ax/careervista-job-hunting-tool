import { validateDetails } from './application-details.ts';
import type { ApplicationDetails } from './application-details.ts';
import { vacancyIdentity } from './reconciliation-state.ts';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { AppError, CareerVistaApp } from './app.ts';
import type { ApiRoute } from './server.ts';

export const applicationStatuses = ['preparing', 'screening', 'assessment', 'applied', 'interview', 'offer', 'accepted', 'rejected', 'withdrawn', 'follow_up'] as const;
export type ApplicationStatus = typeof applicationStatuses[number];
export interface ApplicationDocument { kind: 'resume' | 'letter' | 'other'; reference: string; label: string }
export interface ApplicationEventInput {
  operationId: string; status: ApplicationStatus; occurredAt: string; note?: string;
  documents?: ApplicationDocument[]; followUpOn?: string | null; details?: ApplicationDetails;
}
export interface ApplicationEvent {
  id: string; jobId: string; operationId: string; status: ApplicationStatus; occurredAt: string;
  note: string; details: ApplicationDetails; documents: ApplicationDocument[]; followUpOn: string | null; createdAt: string;
}
const dateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
function required(value: unknown, label: string, limit = 8000): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) throw new AppError(`${label} must be non-empty text of at most ${limit} characters.`);
}
/** Explicit user application history, independent of review or analysis state. */
export class Applications {
  private app: CareerVistaApp;
  constructor(app: CareerVistaApp) { this.app = app; }
  timeline(jobId: string, sourceOnly = false) {
    const memberIds = sourceOnly ? [jobId] : vacancyIdentity(this.app.database, jobId).memberJobIds;
    this.app.getJob(jobId);
    const rows = this.app.database.prepare(`SELECT id, job_id AS jobId, operation_id AS operationId, status, occurred_at AS occurredAt, note, details_json AS detailsJson, documents_json AS documentsJson, follow_up_on AS followUpOn, created_at AS createdAt FROM application_events WHERE job_id IN (${memberIds.map(() => '?').join(',')}) ORDER BY sequence`).all(...memberIds);
    const events = rows.map(({ documentsJson, detailsJson, ...row }) => ({ ...row, details: JSON.parse(String(detailsJson)), documents: JSON.parse(String(documentsJson)) }) as unknown as ApplicationEvent);
    const latest = events.at(-1);
    return { jobId, status: latest?.status ?? null, followUpOn: latest?.followUpOn ?? null, events };
  }
  links(jobId: string) {
    return this.app.getJob(jobId).observations.map(observation => ({ source: observation.source, url: observation.sourceUrl }));
  }
  record(jobId: string, input: ApplicationEventInput) {
    this.app.getJob(jobId);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError('An explicit application event is required.');
    required(input.operationId, 'operationId');
    if (!applicationStatuses.includes(input.status)) throw new AppError(`status must be one of: ${applicationStatuses.join(', ')}.`);
    if (typeof input.occurredAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(input.occurredAt) || !Number.isFinite(Date.parse(input.occurredAt))) throw new AppError('occurredAt must be an ISO 8601 timestamp.');
    if (input.note !== undefined && (typeof input.note !== 'string' || input.note.length > 8000)) throw new AppError('note must be text of at most 8000 characters.');
    if (input.followUpOn !== undefined && input.followUpOn !== null && (typeof input.followUpOn !== 'string' || !dateOnly(input.followUpOn))) throw new AppError('followUpOn must be a valid YYYY-MM-DD date or null.');
    if (input.documents !== undefined && (!Array.isArray(input.documents) || input.documents.length > 30)) throw new AppError('documents must be an array of at most 30 stable document references.');
    const documents = (input.documents ?? []).map(document => {
      if (!document || !['resume', 'letter', 'other'].includes(document.kind)) throw new AppError('Each document needs kind resume, letter or other.');
      required(document.reference, 'document reference'); required(document.label, 'document label');
      if (document.reference.startsWith('application-file:')) { const file=this.app.database.prepare('SELECT job_id FROM application_files WHERE id=?').get(document.reference.slice(17)); if (!file || !(this.app.getJob(jobId).memberJobIds??[this.app.getJob(jobId).id]).includes(String(file.job_id))) throw new AppError('The application copy must belong to this job.'); }
      return { kind: document.kind, reference: document.reference, label: document.label };
    });
    const details = input.details === undefined ? {} : validateDetails(input.details);
    const normalized = { jobId, operationId: input.operationId, status: input.status, occurredAt: input.occurredAt, note: input.note ?? '', documents, followUpOn: input.followUpOn ?? null, ...(input.details === undefined ? {} : { details }) };
    const existing = this.app.database.prepare('SELECT input_json, job_id, id FROM application_events WHERE operation_id = ?').get(input.operationId);
    if (existing) {
      if (!isDeepStrictEqual(JSON.parse(String(existing.input_json)), normalized)) throw new AppError('This operationId already records different application details. Use a new operationId for a new event.', 409, 'idempotency_conflict');
      return { event: this.timeline(jobId).events.find(event => event.id === existing.id)!, replayed: true };
    }
    const id = randomUUID(), createdAt = new Date().toISOString();
    this.app.database.prepare('INSERT INTO application_events (id, job_id, operation_id, status, occurred_at, note, documents_json, follow_up_on, input_json, created_at, details_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, jobId, input.operationId, input.status, input.occurredAt, normalized.note, JSON.stringify(documents), normalized.followUpOn, JSON.stringify(normalized), createdAt, JSON.stringify(details));
    return { event: this.timeline(jobId).events.at(-1)!, replayed: false };
  }
  attention(on: string = new Date().toISOString().slice(0, 10)) {
    if (!dateOnly(on)) throw new AppError('on must be a valid YYYY-MM-DD date.');
    return this.app.listJobs().map(job => ({ job, ...this.timeline(job.id) })).filter(item => !this.app.database.prepare('SELECT deleted_at FROM job_storage WHERE job_id=?').get(item.job.id)?.deleted_at && item.followUpOn && item.followUpOn <= on && !['accepted', 'rejected', 'withdrawn'].includes(item.status ?? ''));
  }
}
export const applicationRoutes: ApiRoute = async ({ app, request, url, json, send }) => {
  const applications = new Applications(app);
  if (request.method === 'GET' && url.pathname === '/api/v1/applications/attention') { send(applications.attention(url.searchParams.get('on') ?? undefined)); return true; }
  const match = /^\/api\/v1\/jobs\/([^/]+)\/applications(?:\/(links))?$/.exec(url.pathname);
  if (!match) return false;
  const id = decodeURIComponent(match[1]!);
  if (request.method === 'GET') { send(match[2] ? applications.links(id) : applications.timeline(id)); return true; }
  if (request.method === 'POST' && !match[2]) { const result = applications.record(id, await json() as ApplicationEventInput); send(result, result.replayed ? 200 : 201); return true; }
  return false;
};
