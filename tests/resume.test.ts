import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerVistaApp } from '../src/app.ts';
import { ProfilesService } from '../src/profiles.ts';
import { ResumeService } from '../src/resume.ts';

const resumeText = `Jordan Example
Email: jordan@example.test
Phone: +61 400 123 456
Address: 12 Sample Street, Melbourne VIC 3000
https://www.linkedin.com/in/jordan-example
Professional Summary
Registered nurse with five years of ward experience.
Experience
2019 - 2023: Supported patient handovers and supervised nursing students.
Skills
Patient education and care planning.`;
const resumeInput = { importId: 'nurse-resume-1', label: 'Nursing resume', format: 'txt', text: resumeText };

test('resume text is retained locally while a reviewable default-redacted payload removes contact details', () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-resume-')); let app = new CareerVistaApp({ root });
  try {
    let resumes = new ResumeService(app);
    const imported = resumes.importResume(resumeInput).resume;
    const preview = resumes.payloadPreview(imported.id);
    assert.doesNotMatch(preview.text, /Jordan Example|jordan@example\.test|400 123|12 Sample Street|linkedin\.com/);
    assert.match(preview.text, /Registered nurse with five years/); assert.match(preview.text, /2019 - 2023/);
    assert.equal(preview.reviewed, false);
    assert.throws(() => resumes.reviewPayload(imported.id, { operationId: 'review-1', text: preview.text, confirmed: false }), /review.*confirm/i);
    const payload = resumes.reviewPayload(imported.id, { operationId: 'review-1', text: preview.text, confirmed: true });
    assert.equal(resumes.agentPayload(payload.id).text, preview.text);
    assert.equal(resumes.importResume(resumeInput).replayed, true);
    assert.throws(() => resumes.importResume({ ...resumeInput, importId: 'pdf-1', format: 'pdf' }), /plain text.*paste/i);
    app.close(); app = new CareerVistaApp({ root }); resumes = new ResumeService(app);
    assert.equal(resumes.getResume(imported.id).text, resumeText);
    assert.equal(resumes.agentPayload(payload.id).text, preview.text);
    assert.equal(new ProfilesService(app).getActiveProfile(), null);
  } finally { app.close(); rmSync(root, { recursive: true, force: true }); }
});

test('agent failure recovery keeps the source and only grounded suggestions become explicitly reviewed profile drafts', () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-resume-')); const app = new CareerVistaApp({ root });
  try {
    const resumes = new ResumeService(app); const imported = resumes.importResume(resumeInput).resume;
    const payload = resumes.reviewPayload(imported.id, { operationId: 'review-1', text: resumes.payloadPreview(imported.id).text, confirmed: true });
    resumes.recordFailure({ resumeId: imported.id, operationId: 'provider-1', code: 'provider_failure' });
    const proposal = { submissionId: 'nurse-proposal-1', resumeId: imported.id, payloadId: payload.id, metadata: { agent: 'compatible-host', analysisVersion: '1' }, experiences: [{ text: 'Registered nurse with five years of ward experience.', quote: 'Registered nurse with five years of ward experience.' }], tracks: [{ id: 'nursing', name: 'Ward nursing', titles: ['Registered nurse'], keywords: ['patient education', 'care planning'], rationale: 'Possible direction based on demonstrated nursing work; confirm interest.', evidence: ['Patient education and care planning.'] }] };
    assert.throws(() => resumes.submitProposal({ ...proposal, experiences: [{ text: 'Managed a hospital of 500 staff', quote: 'Patient education and care planning.' }] }), /extractive|exact quote/i);
    assert.equal(resumes.getResume(imported.id).text, resumeText);
    const suggested = resumes.submitProposal(proposal).proposal;
    assert.equal(resumes.submitProposal(proposal).replayed, true);
    assert.equal(new ProfilesService(app).listProfiles().length, 0);
    const profile = { name: 'My nursing search', demonstratedExperience: suggested.experiences.map(item => item.text), aspirations: ['Explore community nursing rather than ward management'], preferences: [{ key: 'workArrangement', kind: 'undecided' as const, value: null }], tracks: [{ id: 'community', name: 'Community nursing', titles: ['Community nurse'], keywords: ['patient education'], preferences: [] }] };
    const review = { operationId: 'profile-from-resume', proposalId: suggested.id, profile, confirmedReview: true };
    assert.throws(() => resumes.createProfileDraft({ ...review, confirmedReview: false }), /explicitly review/i);
    const draft = resumes.createProfileDraft(review);
    assert.equal(draft.status, 'draft'); assert.equal(new ProfilesService(app).getActiveProfile(), null);
    assert.equal(resumes.createProfileDraft(review).version, draft.version);
    assert.equal(resumes.history(imported.id).profiles[0]?.profileVersion, draft.version);
    assert.equal(resumes.history(imported.id).proposals[0]?.payloadId, payload.id);
    assert.equal(resumes.history(imported.id).failures[0]?.code, 'provider_failure');
    const edited = new ProfilesService(app).createDraft({ ...profile, basedOnVersion: draft.version, aspirations: ['Explore community health education'] });
    assert.ok(resumes.history(imported.id).profiles.some(link => link.profileVersion === edited.version));
    assert.equal(new ProfilesService(app).getActiveProfile(), null);
    new ProfilesService(app).approve(edited.version);
    assert.deepEqual(new ProfilesService(app).getActiveProfile()?.aspirations, ['Explore community health education']);
  } finally { app.close(); rmSync(root, { recursive: true, force: true }); }
});

test('mixed contact headers and inline contact details are redacted without erasing dated experience', () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-resume-')); const app = new CareerVistaApp({ root });
  try {
    const resumes = new ResumeService(app);
    const imported = resumes.importResume({ importId: 'mixed', label: 'Resume', format: 'paste', text: 'Alex Sample | Registered Nurse\nalex.sample@example.com · 0400 123 456 · www.example.com/profile\nUnit 4/20 Test Road, Melbourne VIC 3000\nExperience\n2018 - 2024: Registered nurse. Led patient handovers.\n2025-01-01: Completed clinical training.' }).resume;
    const preview = resumes.payloadPreview(imported.id);
    assert.doesNotMatch(preview.text, /Alex Sample|alex\.sample|0400|20 Test Road|www\.example/);
    assert.match(preview.text, /Registered Nurse/); assert.match(preview.text, /2018 - 2024/); assert.match(preview.text, /2025-01-01/);
    assert.throws(() => resumes.agentPayload(imported.id), /reviewed payload/i);
  } finally { app.close(); rmSync(root, { recursive: true, force: true }); }
});

test('HTTP resume import exposes a redacted preview and only explicitly reviewed payloads for agent analysis', async () => {
  const { startServer } = await import('../src/server.ts'); const { resumeRoutes } = await import('../src/resume.ts');
  const root = mkdtempSync(join(tmpdir(), 'cv-resume-http-')); const app = new CareerVistaApp({ root });
  const server = await startServer(app, { port: 0, routes: [resumeRoutes] });
  try {
    const post = (path: string, value: unknown) => fetch(`${server.url}/api/v1${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
    const importedResponse = await post('/resumes', resumeInput); assert.equal(importedResponse.status, 201);
    const imported = await importedResponse.json() as { resume: { id: string; text?: string } }; assert.equal(imported.resume.text, undefined);
    const preview = await (await fetch(`${server.url}/api/v1/resumes/${imported.resume.id}/preview`)).json() as { text: string };
    assert.doesNotMatch(preview.text, /jordan@example/);
    assert.equal((await post(`/resumes/${imported.resume.id}/payloads`, { operationId: 'unsafe', text: preview.text, confirmed: false })).status, 400);
    const confirmed = await post(`/resumes/${imported.resume.id}/payloads`, { operationId: 'reviewed', text: preview.text, confirmed: true }); assert.equal(confirmed.status, 201);
    const payload = await confirmed.json() as { id: string };
    const agent = await (await fetch(`${server.url}/api/v1/resume-payloads/${payload.id}`)).json();
    assert.doesNotMatch(JSON.stringify(agent), /jordan@example|Jordan Example|Sample Street/);
    assert.equal((await post('/resumes', { ...resumeInput, importId: 'docx', format: 'docx' })).status, 400);
  } finally { await server.close(); app.close(); rmSync(root, { recursive: true, force: true }); }
});

test('private backup recovery preserves original resume, reviewed payload, failure history and linked unapproved drafts', async () => {
  const { Backups } = await import('../src/backup.ts');
  const root = mkdtempSync(join(tmpdir(), 'cv-resume-backup-'));
  const source = new CareerVistaApp({ root: join(root, 'source') }); const destination = new CareerVistaApp({ root: join(root, 'destination') });
  try {
    const resumes = new ResumeService(source); const imported = resumes.importResume(resumeInput).resume;
    const payload = resumes.reviewPayload(imported.id, { operationId: 'review', text: resumes.payloadPreview(imported.id).text, confirmed: true });
    resumes.recordFailure({ resumeId: imported.id, operationId: 'failed-agent', code: 'malformed_output' });
    const proposal = resumes.submitProposal({ submissionId: 'recovered-proposal', resumeId: imported.id, payloadId: payload.id, metadata: { agent: 'test-host', analysisVersion: '1' }, experiences: [{ text: 'Patient education and care planning.', quote: 'Patient education and care planning.' }], tracks: [{ id: 'nursing', name: 'Nursing', titles: ['Registered nurse'], keywords: ['patient care'], rationale: 'Possible direction; user must choose.', evidence: ['Patient education and care planning.'] }] }).proposal;
    const draft = resumes.createProfileDraft({ operationId: 'review-profile', proposalId: proposal.id, confirmedReview: true, profile: { name: 'Nursing', demonstratedExperience: ['Patient education and care planning.'], aspirations: [], preferences: [], tracks: [{ id: 'nursing', name: 'Nursing', titles: ['Registered nurse'], keywords: ['patient care'], preferences: [] }] } });
    new Backups(destination).restore(new Backups(source).create());
    assert.deepEqual(new ResumeService(destination).getResume(imported.id), imported);
    assert.deepEqual(new ResumeService(destination).history(imported.id), resumes.history(imported.id));
    assert.deepEqual(new ProfilesService(destination).getProfile(draft.version), draft);
    assert.equal(new ProfilesService(destination).getActiveProfile(), null);
  } finally { source.close(); destination.close(); rmSync(root, { recursive: true, force: true }); }
});
