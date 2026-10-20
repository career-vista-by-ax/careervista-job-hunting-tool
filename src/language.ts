import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { AppError, CareerVistaApp } from './app.ts';
import { AssessmentsService } from './assessments.ts';
import type { ApiRoute } from './server.ts';
export const languages = ['en','zh-CN','zh-Hant'] as const;
export class LanguageService {
  private app: CareerVistaApp;
  constructor(app: CareerVistaApp) { this.app = app; }
  get() { const row = this.app.database.prepare("SELECT value FROM user_settings WHERE key='language'").get(); return { language: row ? String(row.value) : null }; }
  set(input: { language?: unknown } | null) {
    if (!(languages as readonly unknown[]).includes(input?.language)) throw new AppError('Choose English, 简体中文 or 繁体中文.');
    this.app.database.prepare("INSERT INTO user_settings VALUES ('language',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(input!.language)); return this.get();
  }
  translations(jobId: string) {
    const history = new AssessmentsService(this.app).history(jobId);
    return history.flatMap(item => this.app.database.prepare('SELECT id,assessment_id AS assessmentId,language,entries_json AS entriesJson FROM assessment_translations WHERE assessment_id=? ORDER BY rowid').all(item.id).map(({entriesJson,...row}) => ({...row,entries:JSON.parse(String(entriesJson)) as {english:string;translated:string}[]})));
  }
  save(jobId: string, input: { operationId?: unknown; assessmentId?: unknown; language?: unknown; entries?: unknown } | null) {
    const assessment = new AssessmentsService(this.app).history(jobId).find(item => item.id === input?.assessmentId);
    if (!assessment || typeof input?.operationId !== 'string' || !input.operationId || input.operationId.length > 200 || !['zh-CN','zh-Hant'].includes(String(input.language)) || !Array.isArray(input.entries) || !input.entries.length || input.entries.length > 200) throw new AppError('Provide a saved assessment, language, operationId and English/translated entries.');
    const allowed = new Set<string>([...assessment.reasonsToPursue.map(item=>item.statement),...assessment.concerns.map(item=>item.statement),...assessment.questions.map(item=>item.question),...assessment.unknowns.map(item=>item.explanation),...assessment.hardConflicts.map(item=>item.explanation),assessment.confidence.explanation,...Object.values(assessment.axes).flatMap(axis=>[axis.explanation,...axis.findings.map(item=>item.statement)])]);
    const seen = new Set<string>();
    const entries = input.entries.map(entry=>{
      if (!entry || typeof entry !== 'object' || Object.keys(entry).sort().join(',') !== 'english,translated' || typeof entry.english !== 'string' || !allowed.has(entry.english) || seen.has(entry.english) || typeof entry.translated !== 'string' || !entry.translated.trim() || entry.translated.length > 8000) throw new AppError('Each translation needs a unique exact English assessment statement and readable translated text. Original evidence is never replaced.');
      seen.add(entry.english); return {english:entry.english,translated:entry.translated};
    });
    const existing = this.app.database.prepare('SELECT * FROM assessment_translations WHERE operation_id=?').get(input.operationId);
    if (existing) { if (existing.assessment_id !== assessment.id || existing.language !== input.language || !isDeepStrictEqual(JSON.parse(String(existing.entries_json)),entries)) throw new AppError('operationId already refers to different translations.',409,'idempotency_conflict'); return {id:String(existing.id),replayed:true}; }
    const id = randomUUID(); this.app.database.prepare('INSERT INTO assessment_translations VALUES (?,?,?,?,?,?)').run(id,assessment.id,input.operationId,String(input.language),JSON.stringify(entries),new Date().toISOString()); return {id,replayed:false};
  }
}
export const languageRoutes: ApiRoute = async ({app,request,url,json,send}) => {
  const service = new LanguageService(app);
  if (url.pathname === '/api/v1/settings/language' && request.method === 'GET') {send(service.get());return true;}
  if (url.pathname === '/api/v1/settings/language' && request.method === 'POST') {send(service.set(await json() as {language?:unknown}));return true;}
  const match = /^\/api\/v1\/jobs\/([^/]+)\/translations$/.exec(url.pathname);
  if (match && request.method === 'GET') {send(service.translations(decodeURIComponent(match[1]!)));return true;}
  if (match && request.method === 'POST') {const result=service.save(decodeURIComponent(match[1]!),await json() as Parameters<LanguageService['save']>[1]);send(result,result.replayed?200:201);return true;}
  return false;
};
