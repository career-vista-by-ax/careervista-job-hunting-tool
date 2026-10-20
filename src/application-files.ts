import { createHash, randomUUID } from 'node:crypto';
import { AppError, CareerVistaApp } from './app.ts';
import type { ApiRoute } from './server.ts';
export class ApplicationFiles {
  private app: CareerVistaApp;
  constructor(app: CareerVistaApp) { this.app = app; }
  list(jobId: string) {
    const job = this.app.getJob(jobId), ids = job.memberJobIds ?? [job.id];
    return this.app.database.prepare(`SELECT id,job_id AS jobId,name,kind,size,sha256,created_at AS createdAt FROM application_files WHERE job_id IN (${ids.map(() => '?').join(',')}) ORDER BY created_at,id`).all(...ids);
  }
  save(jobId: string, input: { operationId?: unknown; name?: unknown; kind?: unknown; contentBase64?: unknown } | null) {
    const job = this.app.getJob(jobId);
    if (typeof input?.operationId !== 'string' || !input.operationId || input.operationId.length > 200 || typeof input.name !== 'string' || input.name.length > 200 || !/^[^/\\\x00-\x1f]+\.(pdf|docx?|txt|rtf)$/i.test(input.name) || !['resume','letter','other'].includes(String(input.kind))) throw new AppError('Choose a PDF, DOC, DOCX, TXT or RTF copy with a name, kind and operationId.');
    if (typeof input.contentBase64 !== 'string' || !input.contentBase64 || input.contentBase64.length > 7_000_000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.contentBase64)) throw new AppError('Provide a valid file copy up to 5 MiB.');
    const bytes = Buffer.from(input.contentBase64, 'base64');
    if (bytes.toString('base64') !== input.contentBase64 || !bytes.length || bytes.length > 5 * 1024 * 1024) throw new AppError('File copies must contain 1 byte to 5 MiB.');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const existing = this.app.database.prepare('SELECT id,job_id,name,kind,sha256 FROM application_files WHERE operation_id=?').get(input.operationId);
    if (existing) {
      if (existing.job_id !== job.id || existing.name !== input.name || existing.kind !== input.kind || existing.sha256 !== sha256) throw new AppError('operationId already refers to a different file copy.', 409, 'idempotency_conflict');
      return { file: this.list(job.id).find(file => file.id === existing.id)!, replayed: true };
    }
    if (Number(this.app.database.prepare('SELECT coalesce(sum(size),0) AS size FROM application_files').get()?.size) + bytes.length > 50 * 1024 * 1024) throw new AppError('Saved application copies have reached the 50 MiB local limit. Export a backup before permanently removing old records.', 409, 'file_storage_limit');
    const id = randomUUID();
    this.app.database.prepare('INSERT INTO application_files VALUES (?,?,?,?,?,?,?,?,?)').run(id, job.id, input.operationId, input.name, String(input.kind), input.contentBase64, sha256, bytes.length, new Date().toISOString());
    return { file: this.list(job.id).find(file => file.id === id)!, replayed: false };
  }
  get(id: string) {
    const file = this.app.database.prepare('SELECT name,content_base64 FROM application_files WHERE id=?').get(id);
    if (!file) throw new AppError('Application copy not found.', 404, 'not_found');
    return { name: String(file.name), bytes: Buffer.from(String(file.content_base64), 'base64') };
  }
}
export const applicationFileRoutes: ApiRoute = async ({app, request, url, json, send, response}) => {
  const service = new ApplicationFiles(app);
  const list = /^\/api\/v1\/jobs\/([^/]+)\/application-files$/.exec(url.pathname);
  if (list && request.method === 'GET') { send(service.list(decodeURIComponent(list[1]!))); return true; }
  if (list && request.method === 'POST') { const result = service.save(decodeURIComponent(list[1]!), await json(8 * 1024 * 1024) as Parameters<ApplicationFiles['save']>[1]); send(result, result.replayed ? 200 : 201); return true; }
  const download = /^\/api\/v1\/application-files\/([^/]+)$/.exec(url.pathname);
  if (download && request.method === 'GET') {
    const file = service.get(decodeURIComponent(download[1]!));
    response.writeHead(200, { 'Content-Type':'application/octet-stream', 'Content-Length': file.bytes.length, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name).replace(/'/g,'%27')}` }); response.end(file.bytes); return true;
  }
  return false;
};
