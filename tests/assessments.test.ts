import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerVistaApp } from '../src/app.ts';
import { ProfilesService } from '../src/profiles.ts';
import { Applications } from '../src/applications.ts';
import { AssessmentsService } from '../src/assessments.ts';
import type { AssessmentInput, Finding } from '../src/assessments.ts';

function profile(app: CareerVistaApp) {
  const profiles = new ProfilesService(app);
  const draft = profiles.createDraft({ name: 'Teaching search', demonstratedExperience: ['Five years teaching primary school'], aspirations: ['Own a curriculum programme'], preferences: [{ key: 'decisionAuthority', kind: 'hard', value: 'Choose teaching methods' }, { key: 'compensation', kind: 'undecided', value: null }], tracks: [{ id: 'teaching', name: 'Teaching', titles: ['Teacher'], keywords: ['education'], preferences: [] }] });
  return profiles.approve(draft.version);
}
function listing(app: CareerVistaApp, id: string, text: string) {
  return app.saveObservation({ ingestionId: id, source: 'employer', sourceUrl: `https://example.com/${id}`, capturedAt: '2026-10-18T00:00:00Z', title: 'Teacher', company: id, text: `${text} Five years teaching experience required. Melbourne school.` });
}
function input(jobId: string, observationId: string, version: number, quote: string): AssessmentInput {
  const supports: Finding = { dimension: 'decisionAuthority', status: 'supports', statement: 'The listing explicitly gives the teacher control over teaching methods.', attribution: 'employer_claim', evidence: [{ observationId, quote }] };
  const qualifications: Finding = { dimension: 'qualifications', status: 'supports', statement: 'The approved five years of teaching experience matches the stated requirement.', attribution: 'employer_claim', evidence: [{ observationId, quote: 'Five years teaching experience required.' }] };
  const location: Finding = { dimension: 'location', status: 'supports', statement: 'The school is in Melbourne, the chosen local area.', attribution: 'employer_claim', evidence: [{ observationId, quote: 'Melbourne school.' }] };
  return { submissionId: `${jobId}:assessment:1`, jobId, profileVersion: version, trackId: 'teaching', observationIds: [observationId], metadata: { agent: 'deterministic-test-fixture', analysisVersion: '1', config: { promptVersion: 'teaching-eval-1', temperature: 0 } }, axes: {
    qualifications: { status: 'match', explanation: 'The teaching requirement is aligned with the approved experience.', findings: [qualifications] },
    preferences: { status: 'match', explanation: 'The stated choice over methods supports decision authority.', findings: [supports] },
    practicalConstraints: { status: 'match', explanation: 'Confirmed local work matches the chosen teaching track.', findings: [location] },
  }, reasonsToPursue: [supports], concerns: [], questions: [], unknowns: [], hardConflicts: [], confidence: { level: 'medium', explanation: 'Employer claims have not been independently verified.' } };
}

test('an autonomous larger school assessment preserves profile/evidence context and application state after restart', () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-fit-')); let app = new CareerVistaApp({ root });
  try {
    const approved = profile(app);
    const saved = listing(app, 'large-school', 'A large school network. Teachers choose teaching methods and own classroom programmes.');
    const applications = new Applications(app);
    applications.record(saved.job.id, { operationId: 'teacher-applied', status: 'applied', occurredAt: '2026-10-18T01:00:00Z' });
    const assessment = new AssessmentsService(app).submitAssessment(input(saved.job.id, saved.observation.id, approved.version, 'Teachers choose teaching methods and own classroom programmes.')).assessment;
    assert.equal(assessment.label, 'strong');
    assert.equal(assessment.confidence.level, 'medium');
    assert.equal(assessment.profileVersion, approved.version);
    app.close(); app = new CareerVistaApp({ root });
    const historical = new AssessmentsService(app).history(saved.job.id)[0]!;
    assert.equal(historical.id, assessment.id);
    assert.equal(historical.metadata.config?.promptVersion, 'teaching-eval-1');
    assert.equal(historical.reasonsToPursue[0]?.evidence[0]?.quote, 'Teachers choose teaching methods and own classroom programmes.');
    assert.equal(new Applications(app).timeline(saved.job.id).status, 'applied');
    assert.equal(app.getJob(saved.job.id).observations[0]?.text, saved.observation.text);
  } finally { app.close(); rmSync(root, { recursive: true, force: true }); }
});

test('a restrictive startup is excluded only for evidenced effective hard conflicts; missing salary and remote remain unknown', () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-fit-')); const app = new CareerVistaApp({ root });
  try {
    const approved = profile(app);
    const saved = listing(app, 'startup-school', 'A small startup school. Every teaching-method change requires approval from three directors. Salary and work arrangement are not specified.');
    const service = new AssessmentsService(app);
    const base = input(saved.job.id, saved.observation.id, approved.version, 'Every teaching-method change requires approval from three directors.');
    const concern: Finding = { dimension: 'decisionAuthority', status: 'concern', statement: 'Teaching method choices need three approvals, conflicting with the required authority.', attribution: 'employer_claim', evidence: [{ observationId: saved.observation.id, quote: 'Every teaching-method change requires approval from three directors.' }] };
    const restricted: AssessmentInput = { ...base, axes: { ...base.axes, preferences: { status: 'concern', explanation: 'Decision authority conflicts with the hard preference.', findings: [concern] } }, reasonsToPursue: [], concerns: [concern], hardConflicts: [{ preferenceKey: 'decisionAuthority', observedValue: 'Three directors must approve teaching changes', explanation: concern.statement, attribution: 'employer_claim', evidence: concern.evidence }], unknowns: [{ dimension: 'compensation', explanation: 'No salary is advertised.' }, { dimension: 'workArrangement', explanation: 'Remote or on-site expectations have not been confirmed.' }], questions: [{ dimension: 'decisionAuthority', question: 'Which decisions could the teacher make without director approval?', evidence: concern.evidence }] };
    const assessment = service.submitAssessment(restricted).assessment;
    assert.equal(assessment.label, 'excluded');
    assert.equal(service.list({ excluded: true })[0]?.job.id, saved.job.id);
    assert.equal(assessment.unknowns.find(item => item.dimension === 'compensation')?.explanation, 'No salary is advertised.');
    assert.deepEqual(assessment.hardConflicts.map(item => item.preferenceKey), ['decisionAuthority']);
    assert.throws(() => service.submitAssessment({ ...restricted, submissionId: 'soft-conflict', hardConflicts: [{ ...restricted.hardConflicts[0]!, preferenceKey: 'compensation' }] }), /effective hard preference/i);
    assert.throws(() => service.submitAssessment({ ...restricted, submissionId: 'missing-track', trackId: 'missing' }), /track.*not found/i);
    assert.throws(() => service.submitAssessment({ ...restricted, submissionId: 'invented-evidence', hardConflicts: [{ ...restricted.hardConflicts[0]!, evidence: [{ observationId: saved.observation.id, quote: 'We reject all independent decisions.' }] }] }), /verbatim/i);
    const investigate = service.submitAssessment({ ...base, submissionId: 'unknown-practical', unknowns: restricted.unknowns, axes: { ...base.axes, practicalConstraints: { status: 'unknown', explanation: 'Salary and work arrangement need investigation.', findings: [{ dimension: 'compensation', status: 'unknown', statement: 'Not advertised', attribution: 'model_inference', evidence: [] }] } } }).assessment;
    assert.equal(investigate.label, 'promising');
    assert.equal(service.history(saved.job.id).length, 2);
    assert.equal(service.history(saved.job.id)[0]?.label, 'excluded');
    assert.equal(app.listJobs().length, 1);
  } finally { app.close(); rmSync(root, { recursive: true, force: true }); }
});

test('retries preserve immutable attributed assessment history and latest-label filters retain excluded jobs', () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-fit-')); const app = new CareerVistaApp({ root });
  try {
    const approved = profile(app); const saved = listing(app, 'school', 'Teachers choose teaching methods. A former employee reports frequent approvals.');
    const service = new AssessmentsService(app);
    const base = input(saved.job.id, saved.observation.id, approved.version, 'Teachers choose teaching methods.');
    const first = service.submitAssessment(base);
    const retry = service.submitAssessment({ ...base });
    assert.equal(retry.replayed, true); assert.equal(retry.assessment.id, first.assessment.id);
    assert.throws(() => service.submitAssessment({ ...base, confidence: { level: 'low', explanation: 'Different review' } }), /identifier.*different/i);
    const report: Finding = { dimension: 'approvalLayers', status: 'concern', statement: 'An external report suggests approval delays; relevance to this team is unverified.', attribution: 'external_report', evidence: [{ observationId: saved.observation.id, quote: 'A former employee reports frequent approvals.' }] };
    const hypothesis: Finding = { dimension: 'approvalLayers', status: 'concern', statement: 'The report may indicate delays; ask the hiring manager.', attribution: 'model_inference', evidence: report.evidence };
    const later = service.submitAssessment({ ...base, submissionId: 'school-reviewed', concerns: [report, hypothesis], axes: { ...base.axes, preferences: { status: 'concern', explanation: 'Unverified approval concerns need investigation.', findings: [report] } }, questions: [{ dimension: 'approvalLayers', question: 'How many approvals apply in this team?', evidence: report.evidence }] }).assessment;
    assert.equal(later.label, 'promising');
    assert.equal(later.concerns[0]?.attribution, 'external_report'); assert.equal(later.concerns[1]?.attribution, 'model_inference');
    assert.equal(service.history(saved.job.id)[0]?.label, 'strong');
    assert.equal(service.list({ label: 'strong' }).length, 0);
    assert.equal(service.list({ label: 'promising', profileVersion: approved.version })[0]?.job.id, saved.job.id);
    assert.throws(() => service.submitAssessment({ ...base, submissionId: 'unknown-is-negative', concerns: [{ dimension: 'compensation', status: 'concern', statement: 'Missing pay fails the target.', attribution: 'model_inference', evidence: [] }] }), /unknown information.*not a mismatch/i);
    assert.throws(() => service.submitAssessment({ ...base, submissionId: 'bad-config', metadata: { ...base.metadata, config: { apiKey: 'secret' } } } as never), /documented fields/i);
    assert.equal(service.history(saved.job.id).length, 2);
  } finally { app.close(); rmSync(root, { recursive: true, force: true }); }
});

test('public HTTP submissions expose explained history and excluded filters without accepting a caller fit label', async () => {
  const { startServer } = await import('../src/server.ts');
  const { assessmentRoutes } = await import('../src/assessments.ts');
  const root = mkdtempSync(join(tmpdir(), 'cv-fit-http-')); const app = new CareerVistaApp({ root });
  const server = await startServer(app, { port: 0, routes: [assessmentRoutes] });
  try {
    const approved = profile(app); const saved = listing(app, 'http-school', 'Teachers choose teaching methods.');
    const body = input(saved.job.id, saved.observation.id, approved.version, 'Teachers choose teaching methods.');
    const post = (value: unknown) => fetch(`${server.url}/api/v1/assessments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
    assert.equal((await post(body)).status, 201);
    assert.equal((await post(body)).status, 200);
    assert.equal((await post({ ...body, submissionId: 'caller-label', label: 'strong' })).status, 400);
    const history = await (await fetch(`${server.url}/api/v1/jobs/${saved.job.id}/assessments`)).json() as { label: string; axes: { preferences: { explanation: string } } }[];
    assert.equal(history[0]?.label, 'strong'); assert.match(history[0]!.axes.preferences.explanation, /decision authority/);
    assert.deepEqual(await (await fetch(`${server.url}/api/v1/assessments?excluded=true`)).json(), []);
    assert.equal((await fetch(`${server.url}/api/v1/assessments?excluded=maybe`)).status, 400);
  } finally { await server.close(); app.close(); rmSync(root, { recursive: true, force: true }); }
});

test('open unknown findings and inference-only matches cannot receive a strong label', () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-fit-')); const app = new CareerVistaApp({ root });
  try {
    const approved = profile(app); const saved = listing(app, 'uncertain-school', 'Teachers choose teaching methods.'); const service = new AssessmentsService(app);
    const base = input(saved.job.id, saved.observation.id, approved.version, 'Teachers choose teaching methods.');
    const withUnknown = service.submitAssessment({ ...base, axes: { ...base.axes, practicalConstraints: { ...base.axes.practicalConstraints, findings: [...base.axes.practicalConstraints.findings, { dimension: 'workArrangement', status: 'unknown', statement: 'Remote work is not stated.', attribution: 'model_inference', evidence: [] }] } } }).assessment;
    assert.equal(withUnknown.label, 'promising');
    const inferred: AssessmentInput = { ...base, submissionId: 'inferred-culture', axes: Object.fromEntries(Object.entries(base.axes).map(([key, axis]) => [key, { ...axis, findings: axis.findings.map(finding => ({ ...finding, attribution: 'model_inference' })) }])) as AssessmentInput['axes'] };
    assert.equal(service.submitAssessment(inferred).assessment.label, 'promising');
  } finally { app.close(); rmSync(root, { recursive: true, force: true }); }
});
