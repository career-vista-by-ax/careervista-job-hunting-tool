import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerVistaApp } from '../src/app.ts';
import { ProfilesService } from '../src/profiles.ts';
import { RunsService } from '../src/runs.ts';
const profileInput = { name: 'Teaching and nursing', demonstratedExperience: [], aspirations: [], preferences: [], tracks: [{ id: 'nurse', name: 'Nursing', titles: ['Registered nurse'], keywords: [], preferences: [] }, { id: 'teacher', name: 'Teaching', titles: ['Teacher'], keywords: [], preferences: [] }] };
const capture = (app: CareerVistaApp, id: string) => app.saveObservation({ ingestionId: id, source: 'employer', sourceUrl: 'https://example.com/jobs/' + id, capturedAt: '2026-10-18T00:00:00Z', text: 'Registered nurse. Full time.', title: 'Registered nurse', company: 'Clinic' });
function setup(app: CareerVistaApp) { const profiles = new ProfilesService(app); const profile = profiles.createDraft(profileInput); profiles.approve(profile.version); return profile; }

test('a bounded run preserves completed capture checkpoints across restart without counting duplicates twice', () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-runs-')); let app = new CareerVistaApp({ root });
  try {
    const profile = setup(app); const runs = new RunsService(app);
    const input = { requestId: 'run-1', profileVersion: profile.version, trackIds: ['nurse'], sources: ['custom-employer'], limit: 1, budget: { amount: 2, currency: 'AUD' } };
    const run = runs.create(input); assert.equal(runs.create(input).id, run.id);
    runs.enqueue(run.id, { operationId: 'queue-1', workKey: 'listing-1', trackId: 'nurse', source: 'custom-employer', url: 'https://example.com/jobs/1' });
    runs.authorize(run.id, { operationId: 'authorize-1', workKey: 'listing-1', modelWork: false });
    const job = capture(app, 'nurse-1').job;
    const checkpoint = { operationId: 'checkpoint-1', workKey: 'listing-1', status: 'collected', jobId: job.id };
    runs.checkpoint(run.id, checkpoint); runs.checkpoint(run.id, checkpoint);
    app.close(); app = new CareerVistaApp({ root });
    const resumed = new RunsService(app).get(run.id);
    assert.equal(resumed.counters.newJobs, 1); assert.equal(resumed.counters.collected, 1);
    assert.equal(resumed.work[0]?.jobId, job.id);
    assert.equal(app.getJob(job.id).observations[0]?.text, 'Registered nurse. Full time.');
    assert.throws(() => new RunsService(app).enqueue(run.id, { operationId: 'bad-track', workKey: 'other', trackId: 'teacher', source: 'custom-employer', url: 'https://example.com/2' }), /selected track/);
  } finally { app.close(); rmSync(root, { recursive: true, force: true }); }
});

test('model work needs a reservation first, budget rejection persists, and unavailable actual cost keeps its estimate', () => {
 const root = mkdtempSync(join(tmpdir(), 'cv-runs-')); const app = new CareerVistaApp({ root });
 try {
  const profile = setup(app), service = new RunsService(app);
  const run = service.create({ requestId: 'budget-run', profileVersion: profile.version, trackIds: ['teacher'], sources: ['seek'], budget: { amount: 0.3, currency: 'AUD' } });
  service.enqueue(run.id, { operationId: 'q', workKey: 'job', trackId: 'teacher', source: 'seek', url: 'https://example.com/teacher' });
  assert.throws(() => service.authorize(run.id, { operationId: 'a-missing', workKey: 'job', modelWork: true }), /Reserve/);
  assert.throws(() => service.reserve(run.id, { operationId: 'unknown', workKey: 'job', estimate: null, currency: 'AUD' }), /Costs/);
  const reserved = service.reserve(run.id, { operationId: 'r1', workKey: 'job', estimate: 0.1, currency: 'AUD' });
  const reservation = reserved.reservations[0]!;
  service.authorize(run.id, { operationId: 'a1', workKey: 'job', modelWork: true, reservationId: reservation.id });
  service.settle(run.id, { operationId: 'c1', reservationId: reservation.id, actual: null });
  const after = service.reserve(run.id, { operationId: 'r2', workKey: 'job', estimate: 0.2, currency: 'AUD' });
  assert.equal(after.costs.committed, 0.3); assert.equal(after.costs.estimatedUnavailable, 0.1); assert.equal(after.costs.known, 0);
  assert.throws(() => service.reserve(run.id, { operationId: 'over', workKey: 'job', estimate: 0.000001, currency: 'AUD' }), /budget/i);
  assert.equal(service.get(run.id).status, 'budget-exhausted');
  assert.equal(service.get(run.id).errors.at(-1)?.code, 'budget_exhausted');
  assert.throws(() => service.authorize(run.id, { operationId: 'blocked', workKey: 'job', modelWork: false }), /Resume/);
  assert.throws(() => service.reserve(run.id, { operationId: 'wrong-currency', workKey: 'job', estimate: 0, currency: 'USD' }), /currency|Resume/);
 } finally { app.close(); rmSync(root, { recursive: true, force: true }); }
});

test('sign-in and verification waits resume only the same host session; expiration, stopping and cancellation retain partial work', () => {
 const root = mkdtempSync(join(tmpdir(), 'cv-runs-')); let app = new CareerVistaApp({ root });
 try {
  const profile = setup(app), service = new RunsService(app);
  const run = service.create({ requestId: 'session-run', profileVersion: profile.version, trackIds: ['teacher'], sources: ['linkedin'], budget: { amount: 1, currency: 'AUD' } });
  service.enqueue(run.id, { operationId: 'q', workKey: 'job', trackId: 'teacher', source: 'linkedin', url: 'https://example.com/job' });
  const before = service.authorize(run.id, { operationId: 'a', workKey: 'job', modelWork: false });
  const waiting = service.control(run.id, { operationId: 'wait', action: 'wait-signin', workKey: 'job', sessionRef: 'chrome-tab-123', pageUrl: 'https://example.com/login?token=sensitive#state' });
  assert.equal(waiting.status, 'waiting-user-signin'); assert.equal(waiting.waiting?.pageUrl, 'https://example.com/login');
  assert.throws(() => service.control(run.id, { operationId: 'wrong', action: 'resume', sessionRef: 'different', userConfirmed: true }), /same browser session/);
  app.close(); app = new CareerVistaApp({ root }); const resumed = new RunsService(app);
  resumed.control(run.id, { operationId: 'resume', action: 'resume', sessionRef: 'chrome-tab-123', userConfirmed: true });
  assert.equal(resumed.get(run.id).work[0]?.ingestionId, before.work[0]?.ingestionId);
  resumed.control(run.id, { operationId: 'verify', action: 'wait-verification', workKey: 'job', sessionRef: 'chrome-tab-123', pageUrl: 'https://example.com/verify' });
  assert.equal(resumed.get(run.id).status, 'waiting-user-verification');
  resumed.control(run.id, { operationId: 'expired', action: 'session-expired', workKey: 'job', sessionRef: 'chrome-tab-123', pageUrl: 'https://example.com/login' });
  assert.throws(() => resumed.control(run.id, { operationId: 'expired-resume', action: 'resume', sessionRef: 'chrome-tab-123', userConfirmed: true }), /new browser session/);
  resumed.control(run.id, { operationId: 'new-session', action: 'wait-signin', workKey: 'job', sessionRef: 'chrome-tab-456', pageUrl: 'https://example.com/login' });
  resumed.control(run.id, { operationId: 'resume-new', action: 'resume', sessionRef: 'chrome-tab-456', userConfirmed: true });
  resumed.control(run.id, { operationId: 'stop', action: 'stop' });
  const job = capture(app,'partial').job;
  resumed.checkpoint(run.id, { operationId: 'partial', workKey: 'job', status: 'failed', jobId: job.id, errorCode: 'malformed_output' });
  assert.equal(resumed.get(run.id).counters.newJobs, 1); assert.equal(resumed.get(run.id).counters.failed, 1);
  resumed.control(run.id, { operationId: 'cancel', action: 'cancel' });
  assert.throws(() => resumed.control(run.id, { operationId: 'cancel-resume', action: 'resume' }), /terminal/);
  assert.equal(app.getJob(job.id).title, 'Registered nurse');
 } finally { app.close(); rmSync(root,{recursive:true,force:true}); }
});

test('disposable run storage is capped and stale crash artifacts are removed while saved evidence remains readable', async () => {
 const { mkdirSync, writeFileSync, utimesSync, symlinkSync, readFileSync } = await import('node:fs');
 const root = mkdtempSync(join(tmpdir(), 'cv-runs-')); const app = new CareerVistaApp({ root });
 try {
  const saved = capture(app,'retained'); const service = new RunsService(app);
  const directory = join(app.paths.temp,'runs'); mkdirSync(directory,{recursive:true});
  writeFileSync(join(app.paths.sessions,'session.txt'),'retained session');
  symlinkSync(app.paths.sessions,join(directory,'session-link'));
  writeFileSync(join(directory,'crashed-run.txt'),'stale'); utimesSync(join(directory,'crashed-run.txt'),new Date(0),new Date(0));
  writeFileSync(join(directory,'older.bin'),Buffer.alloc(9 * 1024 * 1024));
  writeFileSync(join(directory,'newer.bin'),Buffer.alloc(9 * 1024 * 1024));
  assert.ok(service.storage().totalBytes > 16 * 1024 * 1024);
  const swept = service.cleanupStorage();
  assert.ok(swept.removedBytes >= 9 * 1024 * 1024 + 5);
  assert.ok(service.storage().totalBytes <= 16 * 1024 * 1024);
  assert.equal(service.cleanupStorage().removedBytes,0);
  assert.ok(swept.skippedSymlinks >= 1);
  assert.equal(readFileSync(join(app.paths.sessions,'session.txt'),'utf8'),'retained session');
  assert.equal(app.getJob(saved.job.id).observations[0]?.text,'Registered nurse. Full time.');
 } finally { app.close(); rmSync(root,{recursive:true,force:true}); }
});

test('duplicates release their collection slot and concurrent new captures cannot exceed the approved limit', () => {
 const root = mkdtempSync(join(tmpdir(),'cv-runs-')); const app = new CareerVistaApp({root});
 try {
  const profile = setup(app), existing = capture(app,'old-job').job, service = new RunsService(app);
  const run = service.create({requestId:'bounded',profileVersion:profile.version,trackIds:['nurse'],sources:['employer'],limit:1,budget:{amount:0,currency:'AUD'}});
  for (const key of ['duplicate','fresh','too-many']) service.enqueue(run.id,{operationId:`queue-${key}`,workKey:key,trackId:'nurse',source:'employer',url:`https://example.com/${key}`});
  service.authorize(run.id,{operationId:'a1',workKey:'duplicate',modelWork:false});
  assert.throws(() => service.authorize(run.id,{operationId:'parallel',workKey:'fresh',modelWork:false}),/limit/);
  service.checkpoint(run.id,{operationId:'d',workKey:'duplicate',status:'collected',jobId:existing.id});
  assert.equal(service.get(run.id).counters.duplicate,1); assert.equal(service.get(run.id).counters.newJobs,0);
  service.authorize(run.id,{operationId:'a2',workKey:'fresh',modelWork:false});
  const fresh = capture(app,'new-job').job;
  service.checkpoint(run.id,{operationId:'c',workKey:'fresh',status:'collected',jobId:fresh.id});
  assert.throws(() => service.authorize(run.id,{operationId:'a3',workKey:'too-many',modelWork:false}),/limit/);
  service.authorize(run.id,{operationId:'a4',workKey:'fresh',modelWork:false});
  service.checkpoint(run.id,{operationId:'assessed',workKey:'fresh',status:'excluded'});
  assert.equal(service.get(run.id).counters.assessed,1); assert.equal(service.get(run.id).counters.excluded,1);
  assert.equal(service.get(run.id).counters.newJobs,1);
  assert.throws(() => service.enqueue(run.id,{operationId:'queue-fresh',workKey:'fresh',trackId:'nurse',source:'employer',url:'https://example.com/changed'}),/identifier/);
 } finally {app.close();rmSync(root,{recursive:true,force:true});}
});

test('unapproved tracks cannot start a run and an actual provider overrun blocks further authorization until explicit budget review', () => {
 const root = mkdtempSync(join(tmpdir(),'cv-runs-')); const app = new CareerVistaApp({root});
 try {
  const profiles = new ProfilesService(app), draft = profiles.createDraft(profileInput), runs = new RunsService(app);
  const input = {requestId:'actual-cost',profileVersion:draft.version,trackIds:['nurse'],sources:['employer'],budget:{amount:0.2,currency:'AUD'}};
  assert.throws(() => runs.create(input),/Approve/); profiles.approve(draft.version);
  const run = runs.create(input);
  runs.enqueue(run.id,{operationId:'q',workKey:'nurse',trackId:'nurse',source:'employer',url:'https://example.com/nurse'});
  const reservation = runs.reserve(run.id,{operationId:'r',workKey:'nurse',estimate:0.1,currency:'AUD'}).reservations[0]!;
  runs.authorize(run.id,{operationId:'a',workKey:'nurse',modelWork:true,reservationId:reservation.id});
  runs.settle(run.id,{operationId:'cost',reservationId:reservation.id,actual:0.3});
  assert.equal(runs.get(run.id).costs.known,0.3); assert.equal(runs.get(run.id).status,'budget-exhausted');
  assert.throws(() => runs.control(run.id,{operationId:'resume-too-early',action:'resume'}),/budget/);
  runs.control(run.id,{operationId:'cap',action:'set-budget',amount:0.5,currency:'AUD'});
  const resumed = runs.control(run.id,{operationId:'resume',action:'resume'});
  assert.equal(resumed.status,'running'); assert.equal(resumed.costs.remaining,0.2);
 } finally {app.close();rmSync(root,{recursive:true,force:true});}
});

test('job deletion cleanup removes listing pointers while retaining historical run counts and spending', () => {
 const root = mkdtempSync(join(tmpdir(),'cv-runs-')); const app = new CareerVistaApp({root});
 try {
  const profile = setup(app), runs = new RunsService(app);
  const run = runs.create({requestId:'redact',profileVersion:profile.version,trackIds:['nurse'],sources:['employer'],budget:{amount:1,currency:'AUD'}});
  runs.enqueue(run.id,{operationId:'q',workKey:'sensitive-listing-key',trackId:'nurse',source:'employer',url:'https://example.com/unique-private-listing'});
  const reservation = runs.reserve(run.id,{operationId:'r',workKey:'sensitive-listing-key',estimate:0.2,currency:'AUD'}).reservations[0]!;
  runs.authorize(run.id,{operationId:'a',workKey:'sensitive-listing-key',modelWork:true,reservationId:reservation.id});
  const job = capture(app,'redacted-job').job;
  runs.checkpoint(run.id,{operationId:'c',workKey:'sensitive-listing-key',status:'collected',jobId:job.id});
  runs.settle(run.id,{operationId:'cost',reservationId:reservation.id,actual:0.1});
  runs.forgetJob(job.id);
  const redacted = runs.get(run.id);
  assert.equal(redacted.counters.newJobs,1); assert.equal(redacted.counters.collected,1); assert.equal(redacted.costs.known,0.1);
  assert.ok(!JSON.stringify(redacted).includes(job.id)); assert.ok(!JSON.stringify(redacted).includes('unique-private-listing')); assert.ok(!JSON.stringify(redacted).includes('sensitive-listing-key'));
  assert.equal(redacted.status,'paused');
  runs.control(run.id,{operationId:'resume',action:'resume'});
  assert.throws(() => runs.authorize(run.id,{operationId:'a-new',workKey:redacted.work[0]!.workKey,modelWork:false}),/deleted/);
 } finally {app.close();rmSync(root,{recursive:true,force:true});}
});

test('portable backup restores run queue, reservations and operation retries into an empty installation', async () => {
 const {Backups} = await import('../src/backup.ts');
 const root = mkdtempSync(join(tmpdir(),'cv-runs-')), restoredRoot = mkdtempSync(join(tmpdir(),'cv-runs-restored-'));
 const app = new CareerVistaApp({root}), restored = new CareerVistaApp({root:restoredRoot});
 try {
  const profile = setup(app), service = new RunsService(app);
  const run = service.create({requestId:'backup-run',profileVersion:profile.version,trackIds:['teacher'],sources:['custom'],budget:{amount:1,currency:'USD'}});
  const queued = {operationId:'q',workKey:'teacher',trackId:'teacher',source:'custom',url:'https://example.com/teacher'};
  service.enqueue(run.id,queued);
  service.reserve(run.id,{operationId:'r',workKey:'teacher',estimate:0.2,currency:'USD'});
  new Backups(restored).restore(new Backups(app).create());
  const other = new RunsService(restored);
  assert.deepEqual(other.get(run.id),service.get(run.id));
  assert.equal(other.enqueue(run.id,queued).work.length,1);
  assert.equal(other.get(run.id).costs.reserved,0.2);
 } finally {app.close();restored.close();rmSync(root,{recursive:true,force:true});rmSync(restoredRoot,{recursive:true,force:true});}
});
