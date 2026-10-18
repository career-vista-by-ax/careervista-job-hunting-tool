import { RunsService } from './runs.ts';
import { AppError, CareerVistaApp } from './app.ts';
import { Backups } from './backup.ts';
import { Applications } from './applications.ts';
import type { ApiRoute } from './server.ts';
const warning = 'Permanent deletion removes selected jobs and their associated live evidence, analyses, assessments and application history. Existing backup and export files are separate copies and are not erased. Unrelated jobs and history remain.';
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
function cell(value: unknown) { let text = String(value ?? ''); if (/^\s*[=+@-]|^[\t\r\n]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; }
export class DataLifecycle {
 private app: CareerVistaApp;
 constructor(app: CareerVistaApp) { this.app=app; }
 exportJson() { return { ...new Backups(this.app).create(), exportScope:'Complete relational domain data. Credentials, browser sessions and external document files are excluded.' }; }
 exportCsv() {
  const rows: unknown[][]=[['job_id','title','company','location','saved_at','source_urls','captured_at','observation_count','application_status']];
  for(const job of this.app.listJobs()) { const detail=this.app.getJob(job.id); rows.push([job.id,job.title,job.company,job.location,job.createdAt,detail.observations.map(item=>item.sourceUrl).join(' | '),detail.observations.map(item=>item.capturedAt).join(' | '),detail.observations.length,new Applications(this.app).timeline(job.id).status]); }
  return rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
 }
 private selected(input: unknown) {
  if(!Array.isArray(input)||!input.length||input.length>500||input.some(id=>typeof id!=='string'||!id)||new Set(input).size!==input.length) throw new AppError('jobIds must contain 1–500 distinct saved job IDs.');
  const ids=[...new Set(input.flatMap(id=>this.app.getJob(id).memberJobIds??[id]))];
  return ids.map(id=>this.app.database.prepare('SELECT id,title,company FROM jobs WHERE id=?').get(id) as unknown as {id:string;title:string;company:string});
 }
 private counts() {
  return Object.fromEntries(this.app.database.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'migrations'").all().map(row=>[String(row.name),Number(this.app.database.prepare(`SELECT count(*) AS count FROM ${quote(String(row.name))}`).get()?.count)]));
 }
 previewDeletion(jobIds: unknown) {
  const jobs=this.selected(jobIds); const before=this.counts(); const db=this.app.database;
  db.exec('SAVEPOINT deletion_preview');
  try { const remove=db.prepare('DELETE FROM jobs WHERE id = ?'); for(const job of jobs) { new RunsService(this.app).forgetJob(job.id); remove.run(job.id); } const after=this.counts(); return {jobs:jobs.map(({id,title,company})=>({id,title,company})),associatedRecords:Object.fromEntries(Object.entries(before).map(([table,count])=>[table,count-(after[table]??0)]).filter(([,count])=>Number(count)>0)),warning,confirmation:'DELETE_SELECTED_JOBS'}; }
  finally { db.exec('ROLLBACK TO deletion_preview; RELEASE deletion_preview'); }
 }
 deleteJobs(input:{jobIds:unknown;confirmation:unknown}) {
  if(!input||input.confirmation!=='DELETE_SELECTED_JOBS') throw new AppError(`Confirm the destructive scope with confirmation DELETE_SELECTED_JOBS. ${warning}`);
  const jobs=this.selected(input.jobIds); const db=this.app.database; db.exec('BEGIN IMMEDIATE');
  try { const statement=db.prepare('DELETE FROM jobs WHERE id = ?'); for(const job of jobs) { new RunsService(this.app).forgetJob(job.id); statement.run(job.id); } if(db.prepare('PRAGMA foreign_key_check').all().length)throw new AppError('Deletion would leave broken relationships. No records were removed.',409,'deletion_conflict'); db.exec('COMMIT'); return {deletedJobIds:jobs.map(job=>job.id),warning}; }
  catch(error){db.exec('ROLLBACK');throw error;}
 }
}
export const dataLifecycleRoutes: ApiRoute=async({app,request,url,json,send,response})=>{
 const service=new DataLifecycle(app);
 if(request.method==='GET'&&url.pathname==='/api/v1/export.json'){send(service.exportJson());return true;}
 if(request.method==='GET'&&url.pathname==='/api/v1/export.csv'){response.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="careervista-jobs.csv"'});response.end(service.exportCsv());return true;}
 if(request.method==='POST'&&url.pathname==='/api/v1/deletion/preview'){const input=await json() as {jobIds:unknown};send(service.previewDeletion(input?.jobIds));return true;}
 if(request.method==='POST'&&url.pathname==='/api/v1/deletion/jobs'){send(service.deleteJobs(await json() as {jobIds:unknown;confirmation:unknown}));return true;}
 return false;
};
