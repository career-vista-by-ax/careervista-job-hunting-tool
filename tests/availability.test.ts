import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerVistaApp } from '../src/app.ts';
import { Applications } from '../src/applications.ts';
import { Availability } from '../src/availability.ts';
import { Backups } from '../src/backup.ts';

test('blocked checks do not close active vacancies and confirmed closure preserves application history across recovery', () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-availability-'));
  const restoredRoot = mkdtempSync(join(tmpdir(), 'cv-availability-restored-'));
  let app = new CareerVistaApp({ root });
  const restored = new CareerVistaApp({ root: restoredRoot });
  try {
    const { job } = app.saveObservation({ ingestionId: 'electrician', source: 'employer', sourceUrl: 'https://example.test/electrician', capturedAt: '2026-10-18T01:00:00Z', text: 'Electrician wanted.', title: 'Electrician', company: 'Workshop' });
    const applications = new Applications(app);
    applications.record(job.id, { operationId: 'applied', status: 'applied', occurredAt: '2026-10-18T01:30:00Z' });
    let service = new Availability(app);
    const active = { operationId: 'check-active', sourceUrl: 'https://example.test/electrician', checkedAt: '2026-10-18T02:00:00Z', result: 'active' as const, text: 'Applications are open.', quote: 'Applications are open.' };
    service.record(job.id, active);
    for (const reason of ['authentication', 'verification', 'blocked', 'timeout', 'network', 'parsing'] as const) service.record(job.id, { operationId: `failed-${reason}`, sourceUrl: active.sourceUrl, checkedAt: '2026-10-18T03:00:00Z', result: 'could_not_verify', failureReason: reason });
    assert.equal(service.history(job.id).status, 'active');
    assert.equal(service.history(job.id).latest?.result, 'could_not_verify');
    assert.equal(service.history(job.id).lastSuccessful?.checkedAt, active.checkedAt);
    assert.equal(service.activeJobs().length, 1);
    service.record(job.id, { ...active, operationId: 'check-closed', checkedAt: '2026-10-18T04:00:00Z', result: 'confirmed_closed', text: 'This vacancy is closed.', quote: 'This vacancy is closed.' });
    assert.equal(service.activeJobs().length, 0);
    assert.equal(app.listJobs().length, 1);
    assert.equal(new Applications(app).timeline(job.id).status, 'applied');
    const snapshot = new Backups(app).create();
    new Backups(restored).restore(snapshot);
    assert.deepEqual(new Availability(restored).history(job.id), service.history(job.id));
    app.close(); app = new CareerVistaApp({ root }); service = new Availability(app);
    assert.equal(service.history(job.id).status, 'confirmed_closed');
    assert.equal(app.getJob(job.id).observations[0]?.text, 'Electrician wanted.');
    assert.equal(new Applications(app).timeline(job.id).status, 'applied');
  } finally { app.close(); restored.close(); rmSync(root, { recursive: true, force: true }); rmSync(restoredRoot, { recursive: true, force: true }); }
});
