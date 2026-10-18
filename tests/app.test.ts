import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerVistaApp } from '../src/app.ts';

const listing = {
  ingestionId: 'manual-1', source: 'manual', sourceUrl: 'https://example.com/jobs/42',
  capturedAt: '2026-10-18T01:00:00.000Z', text: 'Own our data platform. Salary disclosed at interview.',
  title: 'Principal Data Engineer', company: 'Example', location: 'Melbourne',
};

test('a pasted listing and its original evidence remain readable after restart', () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-test-'));
  try {
    let app = new CareerVistaApp({ root });
    const saved = app.saveObservation(listing);
    app.close();
    app = new CareerVistaApp({ root });
    try {
      assert.equal(app.listJobs().length, 1);
      const detail = app.getJob(saved.job.id);
      assert.equal(detail.title, 'Principal Data Engineer');
      assert.equal(detail.observations[0]?.text, 'Own our data platform. Salary disclosed at interview.');
      assert.equal(detail.observations[0]?.sourceUrl, 'https://example.com/jobs/42');
      assert.equal(detail.observations[0]?.capturedAt, '2026-10-18T01:00:00.000Z');
    } finally { app.close(); }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('invalid listing input gives an actionable error without saving a job', () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-test-'));
  const app = new CareerVistaApp({ root });
  try {
    for (const invalid of [{ ...listing, text: '' }, { ...listing, sourceUrl: 'javascript:alert(1)' }, { ...listing, capturedAt: 'yesterday' }, null]) {
      assert.throws(() => app.saveObservation(invalid as never), /required|http|capture|object/i);
      assert.equal(app.listJobs().length, 0);
    }
  } finally { app.close(); rmSync(root, { recursive: true, force: true }); }
});

test('retrying an ingestion identifier returns the existing evidence and rejects changed content', () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-test-'));
  const app = new CareerVistaApp({ root });
  try {
    const first = app.saveObservation(listing);
    const retry = app.saveObservation({ ...listing });
    assert.equal(retry.job.id, first.job.id);
    assert.equal(retry.observation.id, first.observation.id);
    assert.equal(retry.replayed, true);
    assert.throws(() => app.saveObservation({ ...listing, text: 'Changed requirements' }), /identifier.*different/i);
    assert.equal(app.listJobs().length, 1);
    assert.equal(app.getJob(first.job.id).observations.length, 1);
  } finally { app.close(); rmSync(root, { recursive: true, force: true }); }
});
