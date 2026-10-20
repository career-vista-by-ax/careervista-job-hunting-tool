import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerVistaApp } from '../src/app.ts';
import { ResetService, resetRoutes } from '../src/reset.ts';
import { Backups } from '../src/backup.ts';
import { ProfilesService } from '../src/profiles.ts';
import { ResumeService } from '../src/resume.ts';
import { ResumeVariants } from '../src/resume-variants.ts';
import { RunsService } from '../src/runs.ts';
import { Applications } from '../src/applications.ts';
import { WorkspaceService } from '../src/workspace.ts';
import { startServer } from '../src/server.ts';

function seed(app: CareerVistaApp) {
  const saved = app.saveObservation({ ingestionId: 'reset-job', source: 'manual', sourceUrl: 'https://example.com/teacher', capturedAt: '2026-10-20T00:00:00Z', text: 'Teach primary school students.', title: 'Teacher', company: 'School' });
  const profiles = new ProfilesService(app);
  const profile = profiles.createDraft({ name: 'Teaching', demonstratedExperience: ['Teaching'], aspirations: [], preferences: [], tracks: [{ id: 'teaching', name: 'Teaching', titles: ['Teacher'], keywords: [], preferences: [] }] });
  profiles.approve(profile.version);
  new Applications(app).record(saved.job.id, { operationId: 'applied', status: 'applied', occurredAt: '2026-10-20T01:00:00Z' });
  const resume = new ResumeService(app).importResume({ importId: 'cv', label: 'Base CV', format: 'txt', text: 'Teacher with classroom experience.' }).resume;
  const payload = new ResumeService(app).reviewPayload(resume.id, { operationId: 'review', text: resume.text, confirmed: true });
  const variants = new ResumeVariants(app);
  const draft = { operationId: 'draft', baseResumeId: resume.id, payloadId: payload.id, kind: 'resume' as const, label: 'Teaching CV', text: resume.text, changeSummary: 'Reviewed teaching experience.', metadata: { agent: 'test', analysisVersion: '1' } };
  const parent = variants.save(draft).variant;
  variants.save({ ...draft, operationId: 'child', parentVariantId: parent.id });
  new RunsService(app).create({ requestId: 'run', profileVersion: profile.version, trackIds: ['teaching'], sources: ['manual'], limit: 2, budget: { amount: 0, currency: 'AUD' } });
  new WorkspaceService(app).saveView('My view', {});
  new WorkspaceService(app).setCurrent({});
  for (const kind of ['credentials', 'sessions', 'cache', 'logs', 'temp'] as const) {
    mkdirSync(join(app.paths[kind], 'nested'));
    writeFileSync(join(app.paths[kind], 'nested', 'private.txt'), 'PRIVATE');
  }
  return saved;
}
function confirm(service: ResetService) { return service.confirm({ confirmation: 'RESET_ALL_DATA' }).token; }

test('full reset clears all domain tables and owned files, survives restart and leaves the app reusable', () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-reset-')); let app = new CareerVistaApp({ root });
  try {
    seed(app);
    const backup = new Backups(app).create();
    const original = join(root, 'original-cv.txt'); writeFileSync(original, 'ORIGINAL');
    const exported = join(root, 'export.json'); writeFileSync(exported, JSON.stringify(backup));
    const service = new ResetService(app); const before = service.preview();
    assert.ok(before.totalRecords > 10); assert.ok(before.records.resumes! > 0); assert.ok(before.records.research_runs! > 0);
    const result = service.reset({ token: confirm(service), confirmation: 'DELETE' });
    assert.equal(result.removedRecords, before.totalRecords); assert.deepEqual(result.unclearedFolders, []);
    assert.ok(Object.values(new Backups(app).create().tables).every(table => table.rows.length === 0));
    for (const kind of ['credentials', 'sessions', 'cache', 'logs', 'temp'] as const) assert.deepEqual(readdirSync(app.paths[kind]), []);
    assert.equal(readFileSync(original, 'utf8'), 'ORIGINAL'); assert.equal(readFileSync(exported, 'utf8'), JSON.stringify(backup));
    app.close(); app = new CareerVistaApp({ root });
    assert.equal(new ProfilesService(app).getActiveProfile(), null); assert.deepEqual(new ResumeService(app).listResumes(), []); assert.deepEqual(new RunsService(app).list(), []);
    assert.equal(new ResetService(app).preview().totalRecords, 0);
    new Backups(app).restore(backup); assert.equal(app.listJobs()[0]?.title, 'Teacher');
  } finally { app.close(); rmSync(root, { recursive: true, force: true }); }
});

test('reset requires both confirmations, exact DELETE, a live token and no intervening writes', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-20T01:00:00Z') });
  const root = mkdtempSync(join(tmpdir(), 'cv-reset-confirm-')); const app = new CareerVistaApp({ root });
  try {
    seed(app); const service = new ResetService(app);
    assert.throws(() => service.reset({ confirmation: 'DELETE' }), /confirmation/i);
    assert.throws(() => service.confirm({ confirmation: 'yes' }), /Confirm/);
    let token = confirm(service);
    for (const value of ['delete', ' DELETE', 'DELETE ', '', true]) assert.throws(() => service.reset({ token, confirmation: value }), /Type DELETE/);
    assert.throws(() => service.reset({ token: 'forged', confirmation: 'DELETE' }), /confirmation/i);
    service.cancel(token); assert.throws(() => service.reset({ token, confirmation: 'DELETE' }), /confirmation/i);
    token = confirm(service); t.mock.timers.tick(5 * 60_000); assert.throws(() => service.reset({ token, confirmation: 'DELETE' }), /expired/i);
    token = confirm(service); new WorkspaceService(app).saveView('Changed while confirming', {});
    assert.throws(() => service.reset({ token, confirmation: 'DELETE' }), /data changed/i);
    assert.equal(app.listJobs().length, 1);
    token = confirm(service); service.reset({ token, confirmation: 'DELETE' });
    assert.throws(() => service.reset({ token, confirmation: 'DELETE' }), /confirmation/i);
  } finally { app.close(); rmSync(root, { recursive: true, force: true }); }
});

test('a database failure rolls back every deletion and leaves files intact', () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-reset-rollback-')); const app = new CareerVistaApp({ root });
  try {
    seed(app); const service = new ResetService(app); const before = new Backups(app).create().tables;
    app.database.exec("CREATE TRIGGER prevent_reset BEFORE DELETE ON workspace_views BEGIN SELECT RAISE(ABORT, 'controlled failure'); END");
    assert.throws(() => service.reset({ token: confirm(service), confirmation: 'DELETE' }), /controlled failure/);
    assert.deepEqual(new Backups(app).create().tables, before);
    assert.equal(readFileSync(join(app.paths.credentials, 'nested/private.txt'), 'utf8'), 'PRIVATE');
  } finally { app.close(); rmSync(root, { recursive: true, force: true }); }
});

test('reset never follows symlinks outside its owned namespaces', { skip: process.platform === 'win32' }, () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-reset-links-')); const app = new CareerVistaApp({ root: join(root, 'app') });
  try {
    seed(app); const external = join(root, 'external'); mkdirSync(external); writeFileSync(join(external, 'keep'), 'KEEP');
    symlinkSync(external, join(app.paths.cache, 'external'));
    const service = new ResetService(app); service.reset({ token: confirm(service), confirmation: 'DELETE' });
    assert.equal(readFileSync(join(external, 'keep'), 'utf8'), 'KEEP');
    rmSync(app.paths.sessions, { recursive: true }); symlinkSync(external, app.paths.sessions);
    assert.throws(() => service.confirm({ confirmation: 'RESET_ALL_DATA' }), /linked or invalid sessions/);
  } finally { app.close(); rmSync(root, { recursive: true, force: true }); }
});

test('HTTP reset enforces origin checks, two steps, cancellation and continued service', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-reset-http-')); const app = new CareerVistaApp({ root });
  const server = await startServer(app, { port: 0, routes: [resetRoutes] });
  const post = (path: string, body: unknown, origin = server.url, method = 'POST') => fetch(`${server.url}/api/v1/reset${path}`, { method, headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) });
  try {
    seed(app);
    assert.equal((await post('', { confirmation: 'DELETE' })).status, 409);
    assert.equal((await post('/confirmation', { confirmation: 'RESET_ALL_DATA' }, 'https://evil.example')).status, 403);
    const first = await post('/confirmation', { confirmation: 'RESET_ALL_DATA' }); const scope = await first.json() as { token: string };
    assert.equal(first.status, 200); assert.equal(app.listJobs().length, 1);
    assert.equal((await post('', { token: scope.token, confirmation: 'delete' })).status, 400);
    assert.equal((await post('/confirmation', { token: scope.token }, server.url, 'DELETE')).status, 200);
    assert.equal((await post('', { token: scope.token, confirmation: 'DELETE' })).status, 409);
    const final = await (await post('/confirmation', { confirmation: 'RESET_ALL_DATA' })).json() as { token: string };
    const reset = await post('', { token: final.token, confirmation: 'DELETE' }); assert.equal(reset.status, 200);
    assert.deepEqual(await (await fetch(`${server.url}/api/v1/jobs`)).json(), []);
    assert.equal((await fetch(server.url)).status, 200);
  } finally { await server.close(); app.close(); rmSync(root, { recursive: true, force: true }); }
});
