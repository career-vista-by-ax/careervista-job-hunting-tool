import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerVistaApp } from '../src/app.ts';
import { ExtractionService } from '../src/extraction.ts';

test('any agent can submit grounded nursing details after evidence is saved and read them after restart', () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-extract-'));
  let app = new CareerVistaApp({ root });
  try {
    const saved = app.saveObservation({ ingestionId: 'nurse-1', source: 'employer', sourceUrl: 'https://example.com/nurse', capturedAt: '2026-10-18T00:00:00Z', title: 'Registered nurse', company: 'Clinic', text: 'Registered nurse at Clinic. Full time. AHPRA registration required.' });
    const service = new ExtractionService(app);
    const known = (value: string, quote: string) => ({ status: 'known', value, evidence: [{ observationId: saved.observation.id, quote }] });
    const unknown = { status: 'unknown', value: null, evidence: [] };
    const input = { submissionId: 'agent-1', jobId: saved.job.id, observationIds: [saved.observation.id], metadata: { agent: 'any-compatible-agent', analysisVersion: '1' }, details: { title: known('Registered nurse', 'Registered nurse'), company: known('Clinic', 'Clinic'), requirements: known('AHPRA registration', 'AHPRA registration required.'), benefits: unknown, location: unknown, workArrangement: unknown, employment: known('Full time', 'Full time.') } };
    const first = service.submitAnalysis(input);
    assert.equal(service.submitAnalysis(input).replayed, true);
    assert.equal(first.analysis.details.benefits.status, 'unknown');
    app.close(); app = new CareerVistaApp({ root });
    assert.equal(new ExtractionService(app).history(saved.job.id).analyses[0]?.metadata.agent, 'any-compatible-agent');
    assert.equal(app.getJob(saved.job.id).observations[0]?.text, saved.observation.text);
  } finally { app.close(); rmSync(root, { recursive: true, force: true }); }
});

test('rejected electrician analysis retains evidence, exposes safe failures and corrections retain their history', () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-extract-'));
  const app = new CareerVistaApp({ root });
  try {
    const saved = app.saveObservation({ ingestionId: 'trade-1', source: 'employer', sourceUrl: 'https://example.com/trade', capturedAt: '2026-10-18T00:00:00Z', title: 'Electrician', company: 'Workshop', text: 'Electrician. Permanent position. Four-day week available.' });
    const service = new ExtractionService(app);
    const unknown = { status: 'unknown', value: null, evidence: [] };
    const details = Object.fromEntries(['title', 'company', 'requirements', 'benefits', 'location', 'workArrangement', 'employment'].map(field => [field, unknown]));
    const input = { submissionId: 'bad-1', jobId: saved.job.id, observationIds: [saved.observation.id], metadata: { agent: 'Codex', analysisVersion: '1' }, details: { ...details, benefits: { status: 'known', value: 'Free lunch', evidence: [{ observationId: saved.observation.id, quote: 'Free lunch' }] } } };
    assert.throws(() => service.submitAnalysis(input), /verbatim/);
    assert.equal(service.history(saved.job.id).failures[0]?.code, 'invalid_analysis');
    service.recordFailure({ jobId: saved.job.id, submissionId: 'provider-1', code: 'provider_failure', raw: 'secret-key' });
    assert.ok(!JSON.stringify(service.history(saved.job.id)).includes('secret-key'));
    const first = service.submitAnalysis({ ...input, submissionId: 'good-1', details }).analysis;
    const correction = service.submitAnalysis({ ...input, submissionId: 'correct-1', supersedesId: first.id, reason: 'Reviewed working week', details: { ...details, benefits: { status: 'known', value: 'Four-day week available', evidence: [{ observationId: saved.observation.id, quote: 'Four-day week available.' }] } } }).analysis;
    assert.equal(correction.supersedesId, first.id);
    assert.equal(service.history(saved.job.id).analyses[0]?.details.benefits.status, 'unknown');
    assert.equal(service.history(saved.job.id).analyses.length, 2);
    assert.equal(app.getJob(saved.job.id).observations[0]?.text, saved.observation.text);
    assert.throws(() => service.submitAnalysis({ ...input, submissionId: 'good-1' }), /identifier/);
    assert.throws(() => service.submitAnalysis({ ...input, submissionId: 'cross-job', observationIds: ['missing'] }), /saved evidence/);
  } finally { app.close(); rmSync(root, { recursive: true, force: true }); }
});
