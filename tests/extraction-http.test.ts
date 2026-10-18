import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerVistaApp } from '../src/app.ts';
import { extractionRoute } from '../src/extraction.ts';
import { startServer } from '../src/server.ts';

test('an agent receives actionable extraction errors beside retained teacher evidence over HTTP', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-agent-http-'));
  const app = new CareerVistaApp({ root });
  const server = await startServer(app, { port: 0, routes: [extractionRoute] });
  const post = (path: string, input: unknown) => fetch(server.url + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  try {
    const response = await post('/api/v1/observations', { ingestionId: 'teacher-1', source: 'employer', sourceUrl: 'https://example.com/teacher', capturedAt: '2026-10-18T00:00:00Z', title: 'Teacher', company: 'School', text: 'Teacher required. Flexible timetable.' });
    const saved = await response.json() as { job: { id: string }; observation: { id: string } };
    const invalid = await post('/api/v1/analyses', { submissionId: 'teacher-bad', jobId: saved.job.id, observationIds: [saved.observation.id], metadata: { agent: 'test-host', analysisVersion: '1' }, details: {} });
    assert.equal(invalid.status, 400);
    assert.match((await invalid.json() as { error: { message: string } }).error.message, /every version 1 field/);
    const failure = { submissionId: 'teacher-provider', jobId: saved.job.id, code: 'provider_failure', raw: 'sensitive-provider-response' };
    assert.equal((await post('/api/v1/analysis-failures', failure)).status, 201);
    await post('/api/v1/analysis-failures', failure);
    const history = await (await fetch(`${server.url}/api/v1/jobs/${saved.job.id}/analyses`)).json() as { analyses: unknown[]; failures: { message: string }[] };
    assert.equal(history.analyses.length, 0); assert.equal(history.failures.length, 2);
    assert.ok(!JSON.stringify(history).includes('sensitive-provider-response'));
    const details = Object.fromEntries(['title', 'company', 'requirements', 'benefits', 'location', 'workArrangement', 'employment'].map(field => [field, { status: 'unknown', value: null, evidence: [] }]));
    details.title = { status: 'known', value: 'Teacher', evidence: [{ observationId: saved.observation.id, quote: 'Teacher' }] };
    const analysisInput = { submissionId: 'teacher-analysis', jobId: saved.job.id, observationIds: [saved.observation.id], metadata: { agent: 'generic-agent', analysisVersion: '1', provider: 'host-selected' }, details };
    const accepted = await post('/api/v1/analyses', analysisInput);
    assert.equal(accepted.status, 201);
    const first = await accepted.json() as { analysis: { id: string } };
    const replay = await post('/api/v1/analyses', analysisInput);
    assert.equal(replay.status, 200);
    assert.equal((await replay.json() as { analysis: { id: string }; replayed: boolean }).analysis.id, first.analysis.id);
    const persisted = await (await fetch(`${server.url}/api/v1/jobs/${saved.job.id}/analyses`)).json() as { analyses: { details: { title: { value: string } } }[] };
    assert.equal(persisted.analyses[0]?.details.title.value, 'Teacher');
    const detail = await (await fetch(`${server.url}/api/v1/jobs/${saved.job.id}`)).json() as { observations: { text: string }[] };
    assert.equal(detail.observations[0]?.text, 'Teacher required. Flexible timetable.');
  } finally { await server.close(); app.close(); rmSync(root, { recursive: true, force: true }); }
});
