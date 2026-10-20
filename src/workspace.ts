import { JobStorage } from './job-storage.ts';
import { FeedbackService } from './feedback.ts';
import { Reconciliation } from './reconciliation.ts';
import { randomUUID } from 'node:crypto';
import { AppError, CareerVistaApp } from './app.ts';
import type { ApiRoute } from './server.ts';
import { ExtractionService } from './extraction.ts';
import { AssessmentsService, fitLabels } from './assessments.ts';
import { Compensation } from './compensation.ts';
import { Applications } from './applications.ts';
import { Availability } from './availability.ts';

import { workspaceColumns, workspaceSorts, defaultWorkspaceView } from './public/workspace-contract.ts';
import type { WorkspaceView } from './public/workspace-contract.ts';
export type { WorkspaceView } from './public/workspace-contract.ts';
/** A compact projection of saved records. Evidence is available separately in the modal. */
export class WorkspaceService {
  readonly app: CareerVistaApp;
  constructor(app: CareerVistaApp) { this.app = app; }
  summaries() {
    const extraction = new ExtractionService(this.app), assessments = new AssessmentsService(this.app), compensation = new Compensation(this.app), applications = new Applications(this.app), availability = new Availability(this.app);
    return this.app.listJobs().map(job => {
      const detail = this.app.getJob(job.id), analysis = extraction.history(job.id).analyses.at(-1), assessment = assessments.history(job.id).at(-1), application = applications.timeline(job.id), checks = availability.history(job.id);
      const reconciliation = new Reconciliation(this.app).detail(job.id);
      const capturedAt = detail.observations.map(item => item.capturedAt).sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1)!;
      const sourceNames: Record<string,string> = {seek:'SEEK',linkedin:'LinkedIn',glassdoor:'Glassdoor',employer:'Employer',manual:'Manual'};
      const sourceLabels=(job.sources??[]).map(source=>sourceNames[source]??new URL(detail.observations.find(item=>item.source===source)!.sourceUrl).hostname.replace(/^www\./,''));
      return { ...job, storage: new JobStorage(this.app).state(job.id), sourceLabels, memberJobIds: reconciliation.memberJobIds, aliases: reconciliation.sourceJobs, differences: reconciliation.differences, location: analysis?.details.location.value ?? job.location, employment: analysis?.details.employment.value ?? null, workArrangement: analysis?.details.workArrangement.value ?? null,
        compensation: compensation.summary(job.id), fit: assessment?.label ?? null, confidence: assessment?.confidence.level ?? null,
        reasons: assessment?.reasonsToPursue.map(item => item.statement) ?? [],
        unknowns: assessment?.unknowns.map(item => item.explanation) ?? [],
        concerns: [...new Set([...reconciliation.differences,...(assessment?.concerns.map(item => item.statement) ?? []), ...Object.values(assessment?.axes ?? {}).flatMap(axis => axis.findings.filter(item => item.status === 'concern').map(item => item.statement))])],
        profileVersion: assessment?.profileVersion ?? null, review: new FeedbackService(this.app).history(job.id).decision,
        application: { status: application.status, appliedAt: application.events.findLast(item => item.status === 'applied')?.occurredAt ?? null, followUpOn: application.followUpOn },
        availability: { status: checks.status, checkedAt: checks.lastSuccessful?.checkedAt ?? null, lastAttempt: checks.latest?.result ?? null },
        capturedAt, sourceUrl: detail.observations[0]!.sourceUrl };
    });
  }
  validate(input: Partial<WorkspaceView> = {}): WorkspaceView {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !Object.hasOwn(defaultWorkspaceView, key))) throw new AppError('Use only documented workspace filters, sort and columns.');
    const view = { ...defaultWorkspaceView, ...input };
    if (typeof view.query !== 'string' || view.query.length > 8000) throw new AppError('Search must be text up to 8000 characters.');
    if (typeof view.collection !== 'string' || (view.collection !== 'current' && view.collection !== 'all' && view.collection !== 'trash' && !new JobStorage(this.app).list().some(archive => archive.id === view.collection))) throw new AppError('Choose a current, archived or recently deleted search.');
    const options = { availability: ['active','all','closed'], fit: ['all','shortlist','unassessed',...fitLabels], provenance: ['all','unknown','advertised','external_report','model_estimate'], review: ['all','unreviewed','saved','dismissed'], application: ['all','none','preparing','screening','assessment','applied','interview','offer','accepted','rejected','withdrawn','follow_up'], sort: workspaceSorts, direction: ['asc','desc'], density: ['compact','comfortable'] };
    for (const [key, values] of Object.entries(options)) if (!(values as readonly unknown[]).includes(view[key as keyof WorkspaceView])) throw new AppError(`Unsupported ${key} filter. Select a documented option.`);
    if (!Array.isArray(view.columns) || !view.columns.includes('role') || new Set(view.columns).size !== view.columns.length || view.columns.some(column => !workspaceColumns.includes(column))) throw new AppError('Visible columns must be unique supported columns and include role.');
    return view;
  }
  query(input: Partial<WorkspaceView> = {}) {
    const view = this.validate(input), all = this.summaries().filter(row => view.collection === 'trash' ? !!row.storage.deletedAt : !row.storage.deletedAt && (view.collection === 'all' || (view.collection === 'current' ? !row.storage.archiveId : row.storage.archiveId === view.collection))), query = view.query.toLocaleLowerCase().trim();
    const rows = all.filter(row => (!query || [row.title,row.company,row.location ?? '',row.workArrangement ?? '',row.employment ?? '',...(row.sources ?? []),...row.sourceLabels].some(value => value.toLocaleLowerCase().includes(query)))
      && (view.availability === 'all' || (row.availability.status === 'confirmed_closed') === (view.availability === 'closed'))
      && (view.fit === 'all' || (view.fit === 'shortlist' ? row.fit === 'strong' || row.fit === 'promising' : view.fit === 'unassessed' ? row.fit === null : row.fit === view.fit))
      && (view.provenance === 'all' || (row.compensation.provenance ?? 'unknown') === view.provenance)
      && (view.review === 'all' || row.review === view.review)
      && (view.application === 'all' || (row.application.status ?? 'none') === view.application));
    const value = (row: typeof rows[number]) => {
      switch (view.sort) {
        case 'compensation': return row.compensation.provenance === null ? null : `${row.compensation.provenance} ${row.compensation.label}`;
        case 'fit': return row.fit === null ? null : String(fitLabels.indexOf(row.fit));
        case 'confidence': return row.confidence === null ? null : String(['high','medium','low'].indexOf(row.confidence));
        case 'concerns': return row.concerns.length;
        case 'unknowns': return row.unknowns.length;
        case 'followUp': return row.application.followUpOn;
        case 'application': return row.application.status;
        case 'freshness': return row.availability.checkedAt ?? row.capturedAt;
        case 'source': return row.sources?.join(', ') ?? null;
        default: return row[view.sort];
      }
    };
    rows.sort((a,b) => { const av = value(a), bv = value(b); if (av === null) return bv === null ? a.id.localeCompare(b.id) : 1; if (bv === null) return -1;
      return (view.direction === 'asc' ? 1 : -1) * String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) || a.id.localeCompare(b.id); });
    const today = new Date().toISOString().slice(0,10);
    return { rows, view, counts: { total: all.length, visible: rows.length, newLastSevenDays: all.filter(row => Date.now() - Date.parse(row.createdAt) <= 7*86400000).length,
      shortlisted: all.filter(row => row.fit === 'strong' || row.fit === 'promising').length,
      lowFit: all.filter(row => row.fit === 'low_fit').length,
      excluded: all.filter(row => row.fit === 'excluded').length, closed: all.filter(row => row.availability.status === 'confirmed_closed').length,
      attention: all.filter(row => row.application.followUpOn && row.application.followUpOn <= today && !['accepted','rejected','withdrawn'].includes(row.application.status ?? '')).length } };
  }
  state() {
    const current = this.app.database.prepare('SELECT view_json FROM workspace_current WHERE id=1').get();
    const saved = this.app.database.prepare('SELECT id,name,view_json FROM workspace_views ORDER BY name,id').all().map(row => ({ id: String(row.id), name: String(row.name), view: this.validate(JSON.parse(String(row.view_json))) }));
    return { current: current ? this.validate(JSON.parse(String(current.view_json))) : this.validate(), saved };
  }
  setCurrent(input: Partial<WorkspaceView>) { const view = this.validate(input); this.app.database.prepare('INSERT INTO workspace_current VALUES (1,?) ON CONFLICT(id) DO UPDATE SET view_json=excluded.view_json').run(JSON.stringify(view)); return view; }
  saveView(name: string, input: Partial<WorkspaceView>) {
    if (typeof name !== 'string' || !name.trim() || name.length > 100) throw new AppError('Name the saved view using 1–100 characters.');
    const view = this.validate(input), id = randomUUID(); this.app.database.prepare('INSERT INTO workspace_views VALUES (?,?,?)').run(id,name.trim(),JSON.stringify(view)); return { id, name: name.trim(), view };
  }
  deleteView(id: string) { const result = this.app.database.prepare('DELETE FROM workspace_views WHERE id=?').run(id); if (!result.changes) throw new AppError('Saved view not found.',404,'not_found'); return { deleted: true }; }
}
export const workspaceRoutes: ApiRoute = async ({ app, request, url, json, send }) => {
  const service = new WorkspaceService(app);
  if (request.method === 'GET' && url.pathname === '/api/v1/workspace') { const input = Object.fromEntries(url.searchParams); send(service.query(input as Partial<WorkspaceView>)); return true; }
  if (request.method === 'GET' && url.pathname === '/api/v1/workspace/views') { send(service.state()); return true; }
  if (request.method === 'PUT' && url.pathname === '/api/v1/workspace/views/current') { send(service.setCurrent(await json() as WorkspaceView)); return true; }
  if (request.method === 'POST' && url.pathname === '/api/v1/workspace/views') { const input = await json() as { name: string; view: WorkspaceView }; if (!input || typeof input !== 'object') throw new AppError('Supply name and view.'); send(service.saveView(input.name,input.view),201); return true; }
  const match = /^\/api\/v1\/workspace\/views\/([^/]+)$/.exec(url.pathname);
  if (request.method === 'DELETE' && match) { send(service.deleteView(decodeURIComponent(match[1]!))); return true; }
  return false;
};
export type WorkspaceRow = ReturnType<WorkspaceService['summaries']>[number];
export type WorkspaceResult = ReturnType<WorkspaceService['query']>;
