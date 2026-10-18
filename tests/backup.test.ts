import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerVistaApp } from '../src/app.ts';
import { Applications } from '../src/applications.ts';
import { Backups } from '../src/backup.ts';
import { ProfilesService } from '../src/profiles.ts';
import { ExtractionService } from '../src/extraction.ts';

test('private backups restore evidence and application history into an independent empty installation across restart', () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-backup-')); const restoredRoot = mkdtempSync(join(tmpdir(), 'cv-restore-'));
  const source = new CareerVistaApp({ root }); let destination = new CareerVistaApp({ root: restoredRoot });
  try {
    const { job, observation } = source.saveObservation({ ingestionId: 'bakery', source: 'employer', sourceUrl: 'https://example.com/baker', capturedAt: '2026-10-18T01:00:00Z', text: 'Prepare bread and pastries.', title: 'Baker', company: 'Bakery' });
    new Applications(source).record(job.id, { operationId: 'applied', status: 'applied', occurredAt: '2026-10-18T02:00:00Z', documents: [{ kind: 'resume', label: 'Baker resume v2', reference: 'document:resume-v2' }], followUpOn: '2026-10-25' });
    const profiles = new ProfilesService(source);
    const profile = profiles.createDraft({ name: 'Baking career', demonstratedExperience: ['Bread preparation'], aspirations: ['Become head baker'], preferences: [], tracks: [{ id: 'baking', name: 'Baking', titles: ['Baker'], keywords: ['bread'], preferences: [] }] });
    profiles.approve(profile.version);
    const unknown = { status: 'unknown', value: null, evidence: [] };
    new ExtractionService(source).submitAnalysis({ submissionId: 'baker-analysis', jobId: job.id, observationIds: [observation.id], metadata: { agent: 'Codex', analysisVersion: '1' }, details: { title: unknown, company: unknown, requirements: { status: 'known', value: 'Bread and pastries', evidence: [{ observationId: observation.id, quote: 'Prepare bread and pastries.' }] }, benefits: unknown, location: unknown, workArrangement: unknown, employment: unknown } });
    writeFileSync(join(source.paths.credentials, 'provider.key'), 'PRIVATE_KEY_NEVER_COPY');
    writeFileSync(join(source.paths.sessions, 'browser.json'), 'PRIVATE_SESSION_NEVER_COPY');
    const backup = new Backups(source).create();
    assert.doesNotMatch(JSON.stringify(backup), /PRIVATE_KEY_NEVER_COPY|PRIVATE_SESSION_NEVER_COPY/);
    new Backups(destination).restore(JSON.parse(JSON.stringify(backup)));
    destination.close(); destination = new CareerVistaApp({ root: restoredRoot });
    assert.deepEqual(destination.getJob(job.id), source.getJob(job.id));
    assert.deepEqual(new ProfilesService(destination).getActiveProfile(), profiles.getActiveProfile());
    assert.deepEqual(new ExtractionService(destination).history(job.id), new ExtractionService(source).history(job.id));
    assert.deepEqual(new Applications(destination).timeline(job.id), new Applications(source).timeline(job.id));
    new Applications(destination).record(job.id, { operationId: 'interview', status: 'interview', occurredAt: '2026-10-19T02:00:00Z' });
    assert.equal(new Applications(source).timeline(job.id).events.length, 1);
    assert.throws(() => new Backups(destination).restore(backup), /empty installation/i);
  } finally { source.close(); destination.close(); rmSync(root, { recursive: true, force: true }); rmSync(restoredRoot, { recursive: true, force: true }); }
});

test('damaged, unsupported and relationally invalid backups fail before an empty destination is changed', async () => {
  const { createHash } = await import('node:crypto');
  const root = mkdtempSync(join(tmpdir(), 'cv-bad-backup-'));
  const source = new CareerVistaApp({ root: join(root, 'source') }); const destination = new CareerVistaApp({ root: join(root, 'destination') });
  const resign = (backup: Record<string, unknown>) => {
    const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}` : JSON.stringify(value);
    const { checksum: ignored, ...payload } = backup; return { ...payload, checksum: createHash('sha256').update(canonical(payload)).digest('hex') };
  };
  try {
    source.saveObservation({ ingestionId: 'chef', source: 'manual', sourceUrl: 'https://example.com/chef', capturedAt: '2026-10-18T01:00:00Z', text: 'Cook food', title: 'Chef', company: 'Restaurant' });
    const good = new Backups(source).create();
    assert.throws(() => new Backups(destination).restore({ ...good, version: 99 }), /unsupported/i);
    const damaged = structuredClone(good); damaged.tables.jobs!.rows[0]![1] = 'Changed';
    assert.throws(() => new Backups(destination).restore(damaged), /checksum/i);
    const dangling = structuredClone(good); dangling.tables.jobs!.rows = [];
    assert.throws(() => new Backups(destination).restore(resign(dangling)), /relationship/i);
    const malformed = structuredClone(good); malformed.tables.observations!.rows[0]![7] = '{';
    assert.throws(() => new Backups(destination).restore(resign(malformed)), /JSON/i);
    const unknown = structuredClone(good); unknown.migrations.push('999-untrusted.sql');
    assert.throws(() => new Backups(destination).restore(resign(unknown)), /schema/i);
    assert.deepEqual(destination.listJobs(), []);
    const older = structuredClone(good);
    older.migrations = older.migrations.filter(name => name.startsWith('001-') || name.startsWith('017-'));
    for (const name of ['analyses', 'analysis_failures', 'profile_revisions', 'search_tracks', 'profile_preferences', 'active_profile']) delete older.tables[name];
    new Backups(destination).restore(resign(older));
    assert.equal(destination.listJobs()[0]?.title, 'Chef');
    assert.equal(new ProfilesService(destination).getActiveProfile(), null);
  } finally { source.close(); destination.close(); rmSync(root, { recursive: true, force: true }); }
});

test('HTTP backup download and restore accept a complete snapshot larger than ordinary API requests', async () => {
  const { startServer } = await import('../src/server.ts'); const { backupRoutes } = await import('../src/backup.ts');
  const root = mkdtempSync(join(tmpdir(), 'cv-backup-http-'));
  const source = new CareerVistaApp({ root: join(root, 'source') }); const destination = new CareerVistaApp({ root: join(root, 'destination') });
  const sourceServer = await startServer(source, { port: 0, routes: [backupRoutes] }); const destinationServer = await startServer(destination, { port: 0, routes: [backupRoutes] });
  try {
    for (let index = 0; index < 2; index++) source.saveObservation({ ingestionId: `listing-${index}`, source: 'manual', sourceUrl: `https://example.com/${index}`, capturedAt: '2026-10-18T01:00:00Z', text: 'Evidence '.repeat(70000), title: `Job ${index}`, company: 'Employer' });
    const response = await fetch(`${sourceServer.url}/api/v1/backup`); assert.equal(response.status, 200);
    const content = await response.text(); assert.ok(content.length > 2_000_000);
    const restored = await fetch(`${destinationServer.url}/api/v1/backup/restore`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: content });
    assert.equal(restored.status, 200);
    assert.equal(destination.listJobs().length, 2);
    const repeated = await fetch(`${destinationServer.url}/api/v1/backup/restore`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: content });
    assert.equal(repeated.status, 409); assert.equal(destination.listJobs().length, 2);
  } finally { await sourceServer.close(); await destinationServer.close(); source.close(); destination.close(); rmSync(root, { recursive: true, force: true }); }
});
