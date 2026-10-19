import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { CareerVistaApp, AppError } from './app.ts';
import { ResumeService } from './resume.ts';
import type { ApiRoute } from './server.ts';

export interface ResumeVariantInput {
  operationId: string; baseResumeId: string; payloadId: string; parentVariantId?: string; jobId?: string;
  kind: 'resume' | 'cover_letter' | 'recommendations'; label: string; text: string; changeSummary: string;
  metadata: { agent: string; analysisVersion: string; provider?: string; model?: string };
}
export interface ResumeVariant extends Omit<ResumeVariantInput, 'jobId'> {
  id: string; jobId: string | null; targetJob: { id: string; title: string; company: string } | null;
  status: 'draft'; createdAt: string;
}
function object(value: unknown, fields: string[], label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key))) throw new AppError(`${label} must contain only documented fields.`);
}
function text(value: unknown, name: string, max = 8000): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || value.includes('\0')) throw new AppError(`${name} must be readable non-empty text up to ${max} characters.`);
}
/** Immutable reusable drafts, with a reviewed base and optional per-job/parent lineage. */
export class ResumeVariants {
  readonly app: CareerVistaApp;
  constructor(app: CareerVistaApp) { this.app = app; }
  get(id: string): ResumeVariant {
    const row = this.app.database.prepare('SELECT * FROM resume_variants WHERE id=?').get(id);
    if (!row) throw new AppError('Resume/letter variant not found.', 404, 'not_found');
    const input = JSON.parse(String(row.input_json)) as ResumeVariantInput;
    return { ...input, id: String(row.id), jobId: row.job_id === null ? null : String(row.job_id), targetJob: JSON.parse(String(row.target_json)), status: 'draft', createdAt: String(row.created_at) };
  }
  list(baseResumeId?: string) {
    if (baseResumeId) new ResumeService(this.app).getResume(baseResumeId);
    const rows = this.app.database.prepare(`SELECT id FROM resume_variants${baseResumeId ? ' WHERE base_resume_id=?' : ''} ORDER BY sequence DESC`).all(...(baseResumeId ? [baseResumeId] : []));
    return rows.map(row => { const {text: content, ...metadata} = this.get(String(row.id)); return metadata; });
  }
  save(input: ResumeVariantInput) {
    object(input, ['operationId','baseResumeId','payloadId','parentVariantId','jobId','kind','label','text','changeSummary','metadata'], 'Resume variant');
    for (const key of ['operationId','baseResumeId','payloadId','label','changeSummary'] as const) text(input[key], key);
    text(input.text, 'Variant text', 1_000_000);
    if (!['resume','cover_letter','recommendations'].includes(input.kind)) throw new AppError('kind must be resume, cover_letter or recommendations.');
    object(input.metadata, ['agent','analysisVersion','provider','model'], 'Variant metadata');
    text(input.metadata.agent, 'metadata.agent'); text(input.metadata.analysisVersion, 'metadata.analysisVersion');
    for (const key of ['provider','model'] as const) if (input.metadata[key] !== undefined) text(input.metadata[key], `metadata.${key}`);
    if (input.parentVariantId !== undefined) text(input.parentVariantId, 'parentVariantId');
    if (input.jobId !== undefined) text(input.jobId, 'jobId');
    const existing = this.app.database.prepare('SELECT id,input_json FROM resume_variants WHERE operation_id=?').get(input.operationId);
    if (existing) {
      if (!isDeepStrictEqual(JSON.parse(String(existing.input_json)), input)) throw new AppError('This variant operation already has different content. Use a new operationId and parentVariantId to save a revision.', 409, 'idempotency_conflict');
      return {variant: this.get(String(existing.id)), replayed: true};
    }
    const resume = new ResumeService(this.app); resume.getResume(input.baseResumeId);
    if (resume.agentPayload(input.payloadId).resumeId !== input.baseResumeId) throw new AppError('The reviewed payload must belong to the base CV.');
    if (input.parentVariantId && this.get(input.parentVariantId).baseResumeId !== input.baseResumeId) throw new AppError('The parent variant must use the same base CV.');
    const job = input.jobId ? this.app.getJob(input.jobId) : null;
    const target = job ? { id: job.id, title: job.title, company: job.company } : null;
    const id = randomUUID();
    this.app.database.prepare('INSERT INTO resume_variants (id,operation_id,base_resume_id,payload_id,parent_variant_id,job_id,kind,label,text,change_summary,metadata_json,target_json,input_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,input.operationId,input.baseResumeId,input.payloadId,input.parentVariantId??null,input.jobId??null,input.kind,input.label,input.text,input.changeSummary,JSON.stringify(input.metadata),JSON.stringify(target),JSON.stringify(input),new Date().toISOString());
    return {variant: this.get(id), replayed: false};
  }
}
export const resumeVariantRoutes: ApiRoute = async ({app,request,url,json,send}) => {
  const service = new ResumeVariants(app);
  if (url.pathname === '/api/v1/resume-variants') {
    if (request.method === 'GET') { send(service.list(url.searchParams.get('baseResumeId')??undefined)); return true; }
    if (request.method === 'POST') { const result=service.save(await json(4_100_000) as ResumeVariantInput); send(result,result.replayed?200:201); return true; }
  }
  const match=/^\/api\/v1\/resume-variants\/([^/]+)$/.exec(url.pathname);
  if (match && request.method === 'GET') { send(service.get(decodeURIComponent(match[1]!))); return true; }
  return false;
};
