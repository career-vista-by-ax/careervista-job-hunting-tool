import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerVistaApp } from '../src/app.ts';
import { Applications } from '../src/applications.ts';

test('explicit application history and submitted document references survive restart independently of opening links', () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-applications-'));
  let app = new CareerVistaApp({ root });
  try {
    const { job } = app.saveObservation({ ingestionId: 'teacher', source: 'employer', sourceUrl: 'https://example.com/apply', capturedAt: '2026-10-18T01:00:00Z', text: 'Teach children', title: 'Teacher', company: 'School' });
    let applications = new Applications(app);
    assert.equal(applications.links(job.id)[0]?.url, 'https://example.com/apply');
    assert.deepEqual(applications.timeline(job.id).events, []);
    applications.record(job.id, { operationId: 'submitted-1', status: 'applied', occurredAt: '2026-10-18T02:00:00Z', documents: [{ kind: 'resume', reference: 'file:///documents/teacher-resume-v3.pdf', label: 'Resume v3' }], followUpOn: '2026-10-20' });
    app.close(); app = new CareerVistaApp({ root }); applications = new Applications(app);
    const history = applications.timeline(job.id);
    assert.equal(history.status, 'applied');
    assert.equal(history.events[0]?.documents[0]?.label, 'Resume v3');
    assert.equal(applications.attention('2026-10-20')[0]?.job.id, job.id);
    assert.equal(applications.attention('2026-10-19').length, 0);
    applications.record(job.id, { operationId: 'interview-1', status: 'interview', occurredAt: '2026-10-21T00:00:00Z' });
    assert.deepEqual(applications.timeline(job.id).events.map(event => event.status), ['applied', 'interview']);
  } finally { app.close(); rmSync(root, { recursive: true, force: true }); }
});

test('HTTP application submissions are idempotent and conflicting retries preserve history', async () => {
  const { startServer } = await import('../src/server.ts');
  const { applicationRoutes } = await import('../src/applications.ts');
  const root = mkdtempSync(join(tmpdir(), 'cv-app-http-'));
  const app = new CareerVistaApp({ root });
  const server = await startServer(app, { port: 0, routes: [applicationRoutes] });
  try {
    const { job } = app.saveObservation({ ingestionId: 'nurse', source: 'employer', sourceUrl: 'https://example.com/nurse', capturedAt: '2026-10-18T01:00:00Z', text: 'Care for patients', title: 'Nurse', company: 'Hospital' });
    const endpoint = `${server.url}/api/v1/jobs/${job.id}/applications`;
    const event = { operationId: 'operation-1', status: 'applied', occurredAt: '2026-10-18T02:00:00Z' };
    const post = (value: unknown) => fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
    assert.equal((await post(event)).status, 201);
    assert.equal((await post(event)).status, 200);
    assert.equal((await post({ ...event, status: 'rejected' })).status, 409);
    assert.equal((await post({ ...event, operationId: 'bad-date', followUpOn: '2026-02-30' })).status, 400);
    const history = await (await fetch(endpoint)).json() as { events: { status: string }[] };
    assert.deepEqual(history.events.map(item => item.status), ['applied']);
    const opened = await fetch(`${endpoint}/links`);
    assert.equal(opened.status, 200);
    assert.equal((await (await fetch(endpoint)).json() as { events: unknown[] }).events.length, 1);
    assert.equal((await fetch(`${server.url}/app.js`)).status, 404);
    assert.equal((await fetch(`${server.url}/%2e%2e%2fapp.js`)).status, 404);
  } finally { await server.close(); app.close(); rmSync(root, { recursive: true, force: true }); }
});
