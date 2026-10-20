import { sourceKey } from './job-storage-state.ts';
import { vacancyIdentity } from './reconciliation-state.ts';
import { isDeepStrictEqual } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export class AppError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = 'invalid_input') {
    super(message); this.status = status; this.code = code;
  }
}
export interface ObservationInput {
  ingestionId: string; source: string; sourceUrl: string; capturedAt: string;
  text: string; title: string; company: string; location?: string;
  context?: Record<string, unknown>;
}
export interface Job {
  id: string; title: string; company: string; location: string | null; createdAt: string; sources?: string[];
}
export interface Observation {
  id: string; jobId: string; ingestionId: string; source: string; sourceUrl: string;
  capturedAt: string; text: string; context: Record<string, unknown>; createdAt: string;
}
export interface JobDetail extends Job { observations: Observation[]; memberJobIds?: string[] }

/** Application-owned directories. cache/temp/logs are disposable; all other paths persist. */
export function appPaths(root: string) {
  return Object.fromEntries(['app', 'data', 'cache', 'temp', 'logs', 'sessions', 'credentials'].map(name => [name, join(root, name)])) as Record<'app' | 'data' | 'cache' | 'temp' | 'logs' | 'sessions' | 'credentials', string>;
}
export class CareerVistaApp {
  readonly root: string;
  readonly paths: ReturnType<typeof appPaths>;
  /** Internal module persistence seam; external agents must use the versioned API. */
  readonly database: DatabaseSync;
  constructor(options: { root: string }) {
    this.root = options.root;
    this.paths = appPaths(options.root);
    for (const path of Object.values(this.paths)) mkdirSync(path, { recursive: true, mode: 0o700 });
    this.database = new DatabaseSync(join(this.paths.data, 'careervista.sqlite'));
    this.database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    this.database.exec('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
    const directory = fileURLToPath(new URL('./migrations/', import.meta.url));
    for (const name of readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) {
      if (this.database.prepare('SELECT name FROM migrations WHERE name = ?').get(name)) continue;
      this.database.exec('BEGIN IMMEDIATE');
      try {
        this.database.exec(readFileSync(join(directory, name), 'utf8'));
        this.database.prepare('INSERT INTO migrations VALUES (?, ?)').run(name, new Date().toISOString());
        this.database.exec('COMMIT');
      } catch (error) { this.database.exec('ROLLBACK'); this.database.close(); throw error; }
    }
  }
  saveObservation(input: ObservationInput): { job: JobDetail; observation: Observation; replayed: boolean } {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError('A listing object is required.');
    for (const key of ['ingestionId', 'source', 'sourceUrl', 'capturedAt', 'text', 'title', 'company'] as const) {
      if (typeof input[key] !== 'string' || !input[key].trim()) throw new AppError(`${key} is required and must be non-empty text.`);
      const max = key === 'text' ? 1_000_000 : 8_000;
      if (input[key].length > max) throw new AppError(`${key} exceeds ${max} characters.`);
    }
    if (input.location !== undefined && (typeof input.location !== 'string' || input.location.length > 8_000)) throw new AppError('location must be text of at most 8000 characters.');
    if (input.context !== undefined && (!input.context || typeof input.context !== 'object' || Array.isArray(input.context))) throw new AppError('context must be an object.');
    let url: URL;
    try { url = new URL(input.sourceUrl); } catch { throw new AppError('sourceUrl must be a complete http or https URL.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new AppError('sourceUrl must be an http or https URL without credentials.');
    if (!/^\d{4}-\d{2}-\d{2}T/.test(input.capturedAt) || !Number.isFinite(Date.parse(input.capturedAt))) throw new AppError('capturedAt must be an ISO 8601 capture timestamp.');
    const normalized = { ingestionId: input.ingestionId, source: input.source, sourceUrl: input.sourceUrl,
      capturedAt: input.capturedAt, text: input.text, title: input.title, company: input.company,
      location: input.location ?? null, context: input.context ?? {} };
    let inputJson: string;
    try { inputJson = JSON.stringify(normalized); } catch { throw new AppError('context must contain JSON-serializable values.'); }
    const existing = this.database.prepare('SELECT job_id, id, input_json FROM observations WHERE ingestion_id = ?').get(input.ingestionId);
    if (existing) {
      if (!isDeepStrictEqual(JSON.parse(String(existing.input_json)), JSON.parse(inputJson))) throw new AppError('This ingestion identifier already has different content. Use a new identifier for a revision.', 409, 'idempotency_conflict');
      const job = this.getJob(String(existing.job_id));
      return { job, observation: job.observations.find(item => item.id === existing.id)!, replayed: true };
    }
    const suppressed = this.database.prepare('SELECT job_id FROM deleted_job_sources WHERE source_key=?').get(sourceKey(input.sourceUrl));
    if (suppressed) throw new AppError('This listing is in Recently deleted. Restore it there before capturing it again.', 409, 'job_in_trash');
    const now = new Date().toISOString();
    const jobId = randomUUID(), observationId = randomUUID();
    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.database.prepare('INSERT INTO jobs VALUES (?, ?, ?, ?, ?)').run(jobId, input.title, input.company, input.location ?? null, now);
      this.database.prepare('INSERT INTO observations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(observationId, jobId, input.ingestionId, input.source, input.sourceUrl, input.capturedAt, input.text, JSON.stringify(input.context ?? {}), inputJson, now);
      this.database.exec('COMMIT');
    } catch (error) { this.database.exec('ROLLBACK'); throw error; }
    const job = this.getJob(jobId);
    return { job, observation: job.observations[0]!, replayed: false };
  }
  listJobs(): Job[] {
    const rows = this.database.prepare('SELECT id, title, company, location, created_at AS createdAt, (SELECT json_group_array(DISTINCT source) FROM observations WHERE job_id = jobs.id OR job_id IN (SELECT job_id FROM vacancy_members WHERE canonical_job_id=jobs.id)) AS sources FROM jobs WHERE NOT EXISTS (SELECT 1 FROM vacancy_members WHERE job_id=jobs.id AND canonical_job_id<>jobs.id) ORDER BY created_at DESC, id').all();
    return rows.map(row => ({ ...row, sources: JSON.parse(String(row.sources)) })) as unknown as Job[];
  }
  getJob(id: string): JobDetail {
    const identity = vacancyIdentity(this.database, id);
    id = identity.canonicalId;
    const job = this.database.prepare('SELECT id, title, company, location, created_at AS createdAt FROM jobs WHERE id = ?').get(id) as unknown as Job | undefined;
    if (!job) throw new AppError('Job not found.', 404, 'not_found');
    const rows = this.database.prepare(`SELECT id, job_id AS jobId, ingestion_id AS ingestionId, source, source_url AS sourceUrl, captured_at AS capturedAt, text, context_json AS contextJson, created_at AS createdAt FROM observations WHERE job_id IN (${identity.memberJobIds.map(() => '?').join(',')}) ORDER BY created_at, id`).all(...identity.memberJobIds);
    return { ...job, memberJobIds: identity.memberJobIds, observations: rows.map(row => {
      const { contextJson, ...rest } = row;
      return { ...rest, context: JSON.parse(String(contextJson)) } as unknown as Observation;
    }) };
  }
  close() { this.database.close(); }
}
