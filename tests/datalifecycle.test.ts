import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerVistaApp } from '../src/app.ts';
import { Applications } from '../src/applications.ts';
import { DataLifecycle } from '../src/datalifecycle.ts';
import { Backups } from '../src/backup.ts';

test('exports retain evidence and provenance, neutralize CSV formulas and permanently delete only explicitly selected jobs', () => {
 const root=mkdtempSync(join(tmpdir(),'cv-data-')); const app=new CareerVistaApp({root});
 try {
  const one=app.saveObservation({ingestionId:'one',source:'employer',sourceUrl:'https://example.com/one',capturedAt:'2026-10-18T00:00:00Z',text:'Original evidence',title:'=HYPERLINK("evil")',company:'Company'});
  const two=app.saveObservation({ingestionId:'two',source:'manual',sourceUrl:'https://example.com/two',capturedAt:'2026-10-18T00:00:00Z',text:'Retained evidence',title:'Teacher',company:'School'});
  new Applications(app).record(one.job.id,{operationId:'apply',status:'applied',occurredAt:'2026-10-18T01:00:00Z'});
  writeFileSync(join(app.paths.credentials,'key'),'SECRET_CREDENTIAL'); writeFileSync(join(app.paths.sessions,'cookie'),'SECRET_COOKIE');
  const service=new DataLifecycle(app); const exported=service.exportJson();
  assert.match(JSON.stringify(exported),/Original evidence/); assert.doesNotMatch(JSON.stringify(exported),/SECRET_CREDENTIAL|SECRET_COOKIE/);
  assert.match(service.exportCsv(),/"'=HYPERLINK/);
  const preview=service.previewDeletion([one.job.id]); assert.match(preview.warning,/backup.*export.*separate/i); assert.equal(preview.jobs[0]?.id,one.job.id);
  assert.throws(()=>service.deleteJobs({jobIds:[one.job.id],confirmation:'yes'}),/DELETE_SELECTED_JOBS/);
  assert.equal(app.listJobs().length,2);
  service.deleteJobs({jobIds:[one.job.id],confirmation:'DELETE_SELECTED_JOBS'});
  assert.throws(()=>app.getJob(one.job.id),/not found/i); assert.equal(app.getJob(two.job.id).title,'Teacher');
  const backup=new Backups(app).create(); assert.doesNotMatch(JSON.stringify(backup),/Original evidence|"apply"/);
  assert.match(JSON.stringify(exported),/Original evidence/);
 } finally {app.close();rmSync(root,{recursive:true,force:true});}
});
