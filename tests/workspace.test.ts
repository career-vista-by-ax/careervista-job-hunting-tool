import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerVistaApp } from '../src/app.ts';
import { ExtractionService, detailFields } from '../src/extraction.ts';
import { Compensation } from '../src/compensation.ts';
import { Applications } from '../src/applications.ts';
import { Availability } from '../src/availability.ts';
import { WorkspaceService } from '../src/workspace.ts';

test('the daily comparison combines saved facts while keeping unknowns and independent statuses visible', () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-workspace-')); const app = new CareerVistaApp({ root });
  try {
    const saved = app.saveObservation({ ingestionId: 'nurse', title: 'Nurse', company: 'Local clinic', source: 'employer', sourceUrl: 'https://example.com/nurse', capturedAt: '2026-10-18T01:00:00Z', text: 'Part time. Hybrid. AUD 50 per hour, plus super.' });
    const unknown = app.saveObservation({ ingestionId: 'chef', title: 'Chef', company: 'Cafe', source: 'manual', sourceUrl: 'https://example.com/chef', capturedAt: '2026-10-18T02:00:00Z', text: 'Chef wanted.' });
    const details = Object.fromEntries(detailFields.map(key => [key, { status: 'unknown', value: null, evidence: [] }]));
    details.employment = { status: 'known', value: 'Part time', evidence: [{ observationId: saved.observation.id, quote: 'Part time.' }] };
    details.workArrangement = { status: 'known', value: 'Hybrid', evidence: [{ observationId: saved.observation.id, quote: 'Hybrid.' }] };
    new ExtractionService(app).submitAnalysis({ submissionId: 'extract-nurse', jobId: saved.job.id, observationIds: [saved.observation.id], metadata: { agent: 'fixture', analysisVersion: '1' }, details });
    new Compensation(app).record(saved.job.id, { operationId: 'pay', kind: 'advertised', attribution: 'Employer', amount: { min: 50, max: 50, currency: 'AUD', period: 'hour', basis: 'base', superannuation: 'excluded', contractUnit: null }, evidence: [{ observationId: saved.observation.id, quote: 'AUD 50 per hour, plus super.' }] });
    new Applications(app).record(saved.job.id, { operationId: 'applied', status: 'applied', occurredAt: '2026-10-18T03:00:00Z', followUpOn: '2026-10-20' });
    const summary = new WorkspaceService(app).query(); const row = summary.rows.find(row => row.id === saved.job.id)!;
    assert.deepEqual(row.sourceLabels,['Employer']); assert.equal(row.employment, 'Part time'); assert.equal(row.workArrangement, 'Hybrid');
    assert.equal(row.compensation.provenance, 'advertised'); assert.match(row.compensation.label, /50 AUD \/ hour/);
    assert.equal(row.review, 'unreviewed'); assert.equal(row.fit, null); assert.equal(row.application.status, 'applied');
    assert.equal(row.application.appliedAt, '2026-10-18T03:00:00Z'); assert.equal(row.application.followUpOn, '2026-10-20');
    const missing = summary.rows.find(row => row.id === unknown.job.id)!;
    assert.equal(missing.workArrangement, null); assert.equal(missing.compensation.label, 'Unknown'); assert.equal(missing.confidence, null);
    assert.equal(missing.availability.status, 'unknown');
    assert.deepEqual(missing.unknowns, []);
    const dense = new WorkspaceService(app).setCurrent({ density:'compact', columns:['role','confidence','workArrangement','employment','concerns','unknowns','createdAt','followUp'] });
    assert.equal(dense.density,'compact');
    assert.equal(new WorkspaceService(app).query({sort:'employment',direction:'asc'}).rows[0]!.id,saved.job.id);
    assert.equal(new WorkspaceService(app).query({fit:'shortlist'}).rows.length,0);
    assert.throws(()=>new WorkspaceService(app).validate({density:'tiny'} as never),/density/);
    new Availability(app).record(saved.job.id, { operationId: 'close', sourceUrl: saved.observation.sourceUrl, checkedAt: '2026-10-19T00:00:00Z', result: 'confirmed_closed', text: 'No longer accepting applications.', quote: 'No longer accepting applications.' });
    assert.deepEqual(new WorkspaceService(app).query().rows.map(row => row.id), [unknown.job.id]);
    const closed = new WorkspaceService(app).query({ availability: 'closed' }).rows[0]!;
    assert.equal(closed.id, saved.job.id); assert.equal(closed.application.status, 'applied'); assert.equal(closed.review, 'unreviewed');
  } finally { app.close(); rmSync(root, { recursive: true, force: true }); }
});

test('saved comparison filters, sorting and column choices survive restart and private recovery', async () => {
  const { Backups } = await import('../src/backup.ts');
  const root = mkdtempSync(join(tmpdir(), 'cv-workspace-')); let app = new CareerVistaApp({ root: join(root,'source') }); const target = new CareerVistaApp({ root: join(root,'target') });
  try {
    const workspace = new WorkspaceService(app);
    const view = workspace.setCurrent({ query: 'nurse', availability: 'all', fit: 'unassessed', sort: 'company', direction: 'asc', columns: ['role','company','fit'] });
    const saved = workspace.saveView('Nursing shortlist', view);
    assert.throws(() => workspace.setCurrent({ sort: 'percentage' } as never), /sort/);
    assert.throws(() => workspace.setCurrent({ columns: ['company'] }), /role/);
    app.close(); app = new CareerVistaApp({ root: join(root,'source') });
    assert.deepEqual(new WorkspaceService(app).state().current, view);
    new Backups(target).restore(new Backups(app).create());
    assert.deepEqual(new WorkspaceService(target).state().saved, [saved]);
    new WorkspaceService(target).deleteView(saved.id);
    assert.equal(new WorkspaceService(target).state().saved.length, 0);
    assert.equal(new WorkspaceService(app).state().saved.length, 1);
  } finally { app.close(); target.close(); rmSync(root, { recursive: true, force: true }); }
});

test('explicit excluded and closed views keep agent judgement separate from user and application outcomes', async () => {
  const { ProfilesService } = await import('../src/profiles.ts'); const { AssessmentsService } = await import('../src/assessments.ts');
  const root = mkdtempSync(join(tmpdir(), 'cv-workspace-')); const app = new CareerVistaApp({ root });
  try {
    const saved = app.saveObservation({ ingestionId: 'warehouse', title: 'Warehouse supervisor', company: 'Depot', source: 'employer', sourceUrl: 'https://example.com/depot', capturedAt: '2026-10-18T01:00:00Z', text: 'All rostering changes require director approval.' });
    const profiles = new ProfilesService(app); const draft = profiles.createDraft({name:'Operations',demonstratedExperience:[],aspirations:[],preferences:[{key:'decisionAuthority',kind:'hard',value:'Own rostering'}],tracks:[{id:'operations',name:'Operations',titles:['Supervisor'],keywords:['warehouse'],preferences:[]}]}); profiles.approve(draft.version);
    const evidence=[{observationId:saved.observation.id,quote:'All rostering changes require director approval.'}];
    const concern={dimension:'decisionAuthority',status:'concern' as const,statement:'Director approval conflicts with ownership.',attribution:'employer_claim' as const,evidence};
    const unknown={status:'unknown' as const,explanation:'Not enough evidence.',findings:[]};
    new AssessmentsService(app).submitAssessment({submissionId:'fit',jobId:saved.job.id,profileVersion:draft.version,trackId:'operations',observationIds:[saved.observation.id],metadata:{agent:'fixture',analysisVersion:'1'},axes:{qualifications:unknown,preferences:{status:'concern',explanation:concern.statement,findings:[concern]},practicalConstraints:unknown},reasonsToPursue:[],concerns:[concern],questions:[],unknowns:[],hardConflicts:[{preferenceKey:'decisionAuthority',observedValue:'Director approval',explanation:concern.statement,attribution:'employer_claim',evidence}],confidence:{level:'low',explanation:'Only an employer claim.'}});
    new Applications(app).record(saved.job.id,{operationId:'interview',status:'interview',occurredAt:'2026-10-18T03:00:00Z'});
    const row=new WorkspaceService(app).query({fit:'excluded'}).rows[0]!;
    assert.equal(row.review,'unreviewed');assert.equal(row.application.status,'interview');assert.equal(row.fit,'excluded');assert.equal(row.confidence,'low');assert.equal(row.concerns[0],concern.statement);
    assert.equal(new WorkspaceService(app).query({review:'dismissed'}).rows.length,0);
    assert.equal(new WorkspaceService(app).query({application:'rejected'}).rows.length,0);
  } finally { app.close(); rmSync(root,{recursive:true,force:true}); }
});

test('the public workspace interface validates filters and persists view choices without an agent', async () => {
  const { startServer } = await import('../src/server.ts'); const { workspaceRoutes } = await import('../src/workspace.ts');
  const root=mkdtempSync(join(tmpdir(),'cv-workspace-'));const app=new CareerVistaApp({root});const server=await startServer(app,{port:0,routes:[workspaceRoutes]});
  try {
    const put=await fetch(`${server.url}/api/v1/workspace/views/current`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({availability:'closed',sort:'freshness',columns:['role','fit']})});assert.equal(put.status,200);
    const state=await (await fetch(`${server.url}/api/v1/workspace/views`)).json();assert.equal(state.current.availability,'closed');assert.deepEqual(state.current.columns,['role','fit']);
    const invalid=await fetch(`${server.url}/api/v1/workspace?fit=made-up`);assert.equal(invalid.status,400);assert.match((await invalid.json()).error.message,/fit/);
    const empty=await (await fetch(`${server.url}/api/v1/workspace?availability=closed`)).json();assert.equal(empty.rows.length,0);assert.equal(empty.counts.total,0);
  } finally {await server.close();app.close();rmSync(root,{recursive:true,force:true});}
});
