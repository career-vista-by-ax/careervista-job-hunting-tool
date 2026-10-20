import { randomUUID } from 'node:crypto';
import { AppError, CareerVistaApp } from './app.ts';
import { sourceKey } from './job-storage-state.ts';
import { RunsService } from './runs.ts';
import type { ApiRoute } from './server.ts';
export class JobStorage {
  private app: CareerVistaApp;
  constructor(app: CareerVistaApp) { this.app = app; }
  state(jobId: string) {
    const job = this.app.getJob(jobId);
    const row = this.app.database.prepare('SELECT archive_id,deleted_at FROM job_storage WHERE job_id=?').get(job.id);
    return { archiveId: row?.archive_id ? String(row.archive_id) : null, deletedAt: row?.deleted_at ? String(row.deleted_at) : null };
  }
  list() {
    return this.app.database.prepare('SELECT id,name,created_at AS createdAt FROM search_archives ORDER BY created_at DESC,id').all().map(row => ({ id: String(row.id), name: String(row.name), createdAt: String(row.createdAt), jobCount: Number(this.app.database.prepare('SELECT count(*) AS count FROM job_storage WHERE archive_id=? AND deleted_at IS NULL').get(String(row.id))?.count) }));
  }
  archive(input: { operationId?: unknown; name?: unknown } | null) {
    if (typeof input?.operationId !== 'string' || !input.operationId || input.operationId.length > 200 || typeof input.name !== 'string' || !input.name.trim() || input.name.length > 100) throw new AppError('Provide an operationId and an archive name of 1–100 characters.');
    const existing = this.app.database.prepare('SELECT id,name FROM search_archives WHERE operation_id=?').get(input.operationId);
    if (existing) { if (existing.name !== input.name.trim()) throw new AppError('operationId already names a different archive.', 409, 'idempotency_conflict'); return { id: String(existing.id), replayed: true }; }
    const jobs = this.app.listJobs().filter(job => { const state = this.state(job.id); return !state.archiveId && !state.deletedAt; });
    if (!jobs.length) throw new AppError('There are no current jobs to archive.');
    const db = this.app.database, id = randomUUID(); db.exec('SAVEPOINT archive_search');
    try {
      db.prepare('INSERT INTO search_archives VALUES (?,?,?,?)').run(id, input.operationId, input.name.trim(), new Date().toISOString());
      for (const job of jobs) for (const member of this.app.getJob(job.id).memberJobIds ?? [job.id]) db.prepare('INSERT INTO job_storage VALUES (?,?,NULL) ON CONFLICT(job_id) DO UPDATE SET archive_id=excluded.archive_id').run(member, id);
      // A new search must approve its own preferences. Historic revisions remain.
      db.exec('DELETE FROM active_profile; DELETE FROM workspace_current');
      const runs = new RunsService(this.app);
      for (const run of runs.list()) if (!['completed','cancelled'].includes(run.status)) runs.control(run.id, { operationId: `archive:${id}`, action: 'cancel' });
      db.exec('RELEASE archive_search'); return { id, jobCount: jobs.length, replayed: false };
    } catch (error) { db.exec('ROLLBACK TO archive_search; RELEASE archive_search'); throw error; }
  }
  trash(jobId: string) {
    const job = this.app.getJob(jobId), db = this.app.database; db.exec('SAVEPOINT trash_job');
    try {
      for (const id of job.memberJobIds ?? [job.id]) db.prepare('INSERT INTO job_storage(job_id,deleted_at) VALUES (?,?) ON CONFLICT(job_id) DO UPDATE SET deleted_at=excluded.deleted_at').run(id, new Date().toISOString());
      for (const observation of job.observations) db.prepare('INSERT INTO deleted_job_sources VALUES (?,?) ON CONFLICT(source_key) DO UPDATE SET job_id=excluded.job_id').run(sourceKey(observation.sourceUrl), job.id);
      db.exec('RELEASE trash_job'); return { jobId: job.id, ...this.state(job.id) };
    } catch (error) { db.exec('ROLLBACK TO trash_job; RELEASE trash_job'); throw error; }
  }
  restore(jobId: string) {
    const job = this.app.getJob(jobId), db = this.app.database; db.exec('SAVEPOINT restore_job');
    try {
      for (const id of job.memberJobIds ?? [job.id]) {
        db.prepare('UPDATE job_storage SET deleted_at=NULL WHERE job_id=?').run(id);
        db.prepare('DELETE FROM deleted_job_sources WHERE job_id=?').run(id);
      }
      db.exec('RELEASE restore_job'); return { jobId: job.id, ...this.state(job.id) };
    } catch (error) { db.exec('ROLLBACK TO restore_job; RELEASE restore_job'); throw error; }
  }
}
export const jobStorageRoutes: ApiRoute = async ({app, request, url, json, send}) => {
  const service = new JobStorage(app);
  if (url.pathname === '/api/v1/archives' && request.method === 'GET') { send(service.list()); return true; }
  if (url.pathname === '/api/v1/archives' && request.method === 'POST') { send(service.archive(await json() as { operationId?: unknown; name?: unknown }), 201); return true; }
  const match = /^\/api\/v1\/jobs\/([^/]+)\/storage(?:\/(trash|restore))?$/.exec(url.pathname);
  if (!match) return false;
  const id = decodeURIComponent(match[1]!);
  if (request.method === 'GET' && !match[2]) { send(service.state(id)); return true; }
  if (request.method === 'POST' && match[2]) { await json(); send(match[2] === 'trash' ? service.trash(id) : service.restore(id)); return true; }
  return false;
};
