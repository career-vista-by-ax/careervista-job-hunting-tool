import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerVistaApp } from '../src/app.ts';
import { Compensation } from '../src/compensation.ts';
import { Backups } from '../src/backup.ts';

test('mixed compensation units and explicit adjustments retain original figures, evidence and unknowns after backup restore', () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-pay-')); const source = new CareerVistaApp({ root: join(root, 'source') }); const restored = new CareerVistaApp({ root: join(root, 'restored') });
  try {
    const saved = source.saveObservation({ ingestionId: 'carpenter', source: 'employer', sourceUrl: 'https://example.com/trade', capturedAt: '2026-10-18T01:00:00Z', text: 'Carpenter. AUD 55–65 per hour. Employee reports USD 100000 base per year.', title: 'Carpenter', company: 'Builder' });
    const service = new Compensation(source);
    assert.equal(service.summary(saved.job.id).label, 'Unknown');
    const advertised = service.record(saved.job.id, { operationId: 'ad', kind: 'advertised', attribution: 'Employer listing', amount: { min: 55, max: 65, currency: 'AUD', period: 'hour', basis: 'unknown', superannuation: 'unknown', contractUnit: 'hourly contract' }, evidence: [{ observationId: saved.observation.id, quote: 'AUD 55–65 per hour.' }] }).record;
    service.record(saved.job.id, { operationId: 'report', kind: 'external_report', attribution: 'Employee report in saved evidence', amount: { min: 100000, max: 100000, currency: 'USD', period: 'year', basis: 'base', superannuation: 'not_applicable', contractUnit: null }, evidence: [{ observationId: saved.observation.id, quote: 'Employee reports USD 100000 base per year.' }], uncertainty: 'Self-reported, may describe another role.' });
    service.record(saved.job.id, { operationId: 'adjust', kind: 'user_adjustment', attribution: 'My judgement', referenceId: advertised.id, rationale: 'Use the lower bound for planning; no annual conversion.', amount: { ...advertised.amount, max: 55 }, evidence: [] });
    const history = service.history(saved.job.id);
    assert.equal(history.records[0]?.amount.max, 65);
    assert.equal(history.records[0]?.amount.superannuation, 'unknown');
    assert.equal(history.records[1]?.amount.currency, 'USD');
    assert.equal(history.records[2]?.referenceId, advertised.id);
    assert.match(service.summary(saved.job.id).label, /55–65 AUD \/ hour/);
    new Backups(restored).restore(new Backups(source).create());
    assert.deepEqual(new Compensation(restored).history(saved.job.id), history);
  } finally { source.close(); restored.close(); rmSync(root, { recursive: true, force: true }); }
});

test('estimates stay attributed, invalid evidence and cross-job adjustments are rejected, and retries do not multiply figures', () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-pay-validation-')); const app = new CareerVistaApp({ root });
  try {
    const saved = app.saveObservation({ ingestionId: 'nurse', source: 'employer', sourceUrl: 'https://example.com/nurse', capturedAt: '2026-10-18T01:00:00Z', text: 'Registered nurse. Pay to be discussed.', title: 'Nurse', company: 'Clinic' });
    const other = app.saveObservation({ ingestionId: 'teacher', source: 'employer', sourceUrl: 'https://example.com/teacher', capturedAt: '2026-10-18T01:00:00Z', text: 'Teacher.', title: 'Teacher', company: 'School' });
    const service = new Compensation(app);
    const amount = { min: 90000, max: 110000, currency: 'AUD', period: 'year' as const, basis: 'total_package' as const, superannuation: 'included' as const, contractUnit: null };
    const input = { operationId: 'estimate', kind: 'model_estimate' as const, attribution: 'Any agent using a configured model', amount, evidence: [], uncertainty: 'Estimated range, not advertised pay.', rationale: 'Planning estimate requiring employer confirmation.' };
    const estimate = service.record(saved.job.id, input).record;
    assert.equal(service.record(saved.job.id, input).replayed, true);
    assert.equal(service.summary(saved.job.id).provenance, 'model_estimate');
    assert.equal(service.history(saved.job.id).records.length, 1);
    assert.throws(() => service.record(saved.job.id, { ...input, amount: { ...amount, min: 95000 } }), /identifier|operationId/);
    assert.throws(() => service.record(saved.job.id, { ...input, operationId: 'no-uncertainty', uncertainty: undefined }), /uncertainty/);
    assert.throws(() => service.record(saved.job.id, { ...input, kind: 'advertised', operationId: 'ungrounded', evidence: [{ observationId: saved.observation.id, quote: 'AUD 90000' }] }), /verbatim/);
    assert.throws(() => service.record(other.job.id, { ...input, kind: 'user_adjustment', operationId: 'wrong-job', referenceId: estimate.id }), /original/);
    assert.equal(service.summary(other.job.id).label, 'Unknown');
    assert.equal(app.getJob(saved.job.id).observations[0]?.text, 'Registered nurse. Pay to be discussed.');
  } finally { app.close(); rmSync(root, { recursive: true, force: true }); }
});

test('compensation HTTP history exposes all provenance and comparison summaries through the versioned interface', async () => {
  const { startServer } = await import('../src/server.ts'); const { compensationRoutes } = await import('../src/compensation.ts');
  const root = mkdtempSync(join(tmpdir(), 'cv-pay-http-')); const app = new CareerVistaApp({ root }); const server = await startServer(app, { port: 0, routes: [compensationRoutes] });
  try {
    const saved = app.saveObservation({ ingestionId: 'retail', source: 'employer', sourceUrl: 'https://example.com/retail', capturedAt: '2026-10-18T01:00:00Z', text: 'Store manager GBP 3000 per month total package.', title: 'Store manager', company: 'Shop' });
    const payload = { operationId: 'retail-ad', kind: 'advertised', attribution: 'Employer', amount: { min: 3000, max: 3000, currency: 'GBP', period: 'month', basis: 'total_package', superannuation: 'unknown', contractUnit: null }, evidence: [{ observationId: saved.observation.id, quote: 'GBP 3000 per month total package.' }] };
    const endpoint = `${server.url}/api/v1/jobs/${saved.job.id}/compensation`;
    const result = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); assert.equal(result.status, 201);
    const history = await (await fetch(endpoint)).json() as { records: { displayLabel: string }[] };
    assert.equal(history.records[0]?.displayLabel, '3000 GBP / month · total package · super unknown');
    const summaries = await (await fetch(`${server.url}/api/v1/compensation/summaries`)).json() as { jobId: string; provenance: string }[];
    assert.deepEqual(summaries.map(item => [item.jobId, item.provenance]), [[saved.job.id, 'advertised']]);
  } finally { await server.close(); app.close(); rmSync(root, { recursive: true, force: true }); }
});
