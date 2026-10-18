import { request } from 'node:http';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerVistaApp } from '../src/app.ts';
import { startServer } from '../src/server.ts';

test('localhost UI and versioned API save evidence and reject cross-origin or rebound requests', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-http-'));
  const app = new CareerVistaApp({ root });
  const server = await startServer(app, { port: 0 });
  try {
    const page = await fetch(server.url);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /CareerVista/);
    const body = JSON.stringify({ ingestionId: 'api-1', source: 'manual', sourceUrl: 'https://example.com/1', capturedAt: '2026-10-18T01:00:00Z', text: 'Teach primary school students.', title: 'Primary School Teacher', company: 'Example' });
    const saved = await fetch(`${server.url}/api/v1/observations`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: server.url }, body });
    assert.equal(saved.status, 201);
    const result = await saved.json() as { job: { id: string } };
    const detail = await fetch(`${server.url}/api/v1/jobs/${result.job.id}`);
    assert.equal((await detail.json() as { observations: { text: string }[] }).observations[0]?.text, 'Teach primary school students.');
    const hostile = await fetch(`${server.url}/api/v1/observations`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body });
    assert.equal(hostile.status, 403);
    const reboundStatus = await new Promise<number | undefined>((resolve, reject) => {
      const req = request(`${server.url}/api/v1/jobs`, { headers: { Host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject); req.end();
    });
    assert.equal(reboundStatus, 403);
    const malformed = await fetch(`${server.url}/api/v1/observations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(malformed.status, 400);
    assert.match((await malformed.json() as { error: { message: string } }).error.message, /JSON/);
  } finally { await server.close(); app.close(); rmSync(root, { recursive: true, force: true }); }
});

test('opening the app from another page allows only document navigation, not cross-site data access', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-navigation-'));
  const app = new CareerVistaApp({ root });
  const server = await startServer(app, { port: 0 });
  const status = (path: string, headers: Record<string, string>) => new Promise<number | undefined>((resolve, reject) => {
    const req = request(`${server.url}${path}`, { headers }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end();
  });
  try {
    const navigation = { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document' };
    assert.equal(await status('/', navigation), 200);
    assert.equal(await status('/api/v1/jobs', navigation), 403);
    assert.equal(await status('/', { 'Sec-Fetch-Site': 'cross-site' }), 403);
  } finally { await server.close(); app.close(); rmSync(root, { recursive: true, force: true }); }
});
