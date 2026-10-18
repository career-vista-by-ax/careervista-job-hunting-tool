import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { AppError, CareerVistaApp } from './app.ts';
import { ProfilesService } from './profiles.ts';
import type { EvidenceReference } from './extraction.ts';
import type { ApiRoute } from './server.ts';

export type Attribution = 'employer_claim' | 'external_report' | 'model_inference' | 'user_confirmed';
export interface Finding { dimension: string; status: 'supports' | 'concern' | 'unknown'; statement: string; attribution: Attribution; evidence: EvidenceReference[] }
export interface FitAxis { status: 'match' | 'concern' | 'unknown'; explanation: string; findings: Finding[] }
export interface HardConflict { preferenceKey: string; observedValue: string; explanation: string; attribution: 'employer_claim' | 'user_confirmed'; evidence: EvidenceReference[] }
export interface AssessmentInput {
  submissionId: string; jobId: string; profileVersion: number; trackId: string; observationIds: string[];
  metadata: { agent: string; analysisVersion: string; provider?: string; model?: string; config?: { promptVersion?: string; temperature?: number; seed?: number } };
  axes: { qualifications: FitAxis; preferences: FitAxis; practicalConstraints: FitAxis };
  reasonsToPursue: Finding[]; concerns: Finding[];
  questions: { dimension: string; question: string; evidence: EvidenceReference[] }[];
  unknowns: { dimension: string; explanation: string }[];
  hardConflicts: HardConflict[];
  confidence: { level: 'high' | 'medium' | 'low'; explanation: string };
}
export const fitLabels = ['strong', 'promising', 'investigate', 'low_fit', 'excluded'] as const;
export type FitLabel = typeof fitLabels[number];
export interface Assessment extends AssessmentInput { id: string; createdAt: string; label: FitLabel; rulesVersion: string }
const rulesVersion = 'fit-v1';

function object(value: unknown, name: string, keys: readonly string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new AppError(`${name} must be an object containing only documented fields.`);
}
function text(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 8000) throw new AppError(`${name} must be non-empty text up to 8000 characters.`);
}
function list(value: unknown, name: string): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length > 100) throw new AppError(`${name} must be an array of at most 100 entries.`);
}
function fitLabel(input: AssessmentInput): FitLabel {
  if (input.hardConflicts.length) return 'excluded';
  const axes = Object.values(input.axes);
  const concerns = axes.filter(axis => axis.status === 'concern').length;
  if (concerns >= 2) return 'low_fit';
  const directlySupported = axes.every(axis => axis.findings.some(finding => finding.status === 'supports' && ['employer_claim','user_confirmed'].includes(finding.attribution)));
  const openFindings = axes.some(axis => axis.findings.some(finding => finding.status !== 'supports'));
  if (axes.every(axis => axis.status === 'match') && directlySupported && !openFindings && !input.unknowns.length && !input.concerns.length) return 'strong';
  return axes.some(axis => axis.status === 'match') ? 'promising' : 'investigate';
}

export class AssessmentsService {
  readonly app: CareerVistaApp;
  constructor(app: CareerVistaApp) { this.app = app; }
  history(jobId: string): Assessment[] {
    this.app.getJob(jobId);
    return this.app.database.prepare('SELECT * FROM assessments WHERE job_id=? ORDER BY rowid').all(jobId).map(row => ({ ...JSON.parse(String(row.input_json)), id: String(row.id), createdAt: String(row.created_at), label: row.label as FitLabel, rulesVersion: String(row.rules_version) }));
  }
  list(filters: { label?: FitLabel; excluded?: boolean; profileVersion?: number } = {}) {
    if (filters.label !== undefined && !fitLabels.includes(filters.label)) throw new AppError('label must be strong, promising, investigate, low_fit or excluded.');
    if (filters.excluded !== undefined && typeof filters.excluded !== 'boolean') throw new AppError('excluded must be true or false.');
    if (filters.profileVersion !== undefined && (!Number.isSafeInteger(filters.profileVersion) || filters.profileVersion < 1)) throw new AppError('profileVersion must be a positive integer.');
    return this.app.listJobs().flatMap(job => {
      const assessment = this.history(job.id).at(-1);
      if (!assessment || (filters.label !== undefined && assessment.label !== filters.label) || (filters.excluded !== undefined && (assessment.label === 'excluded') !== filters.excluded) || (filters.profileVersion !== undefined && assessment.profileVersion !== filters.profileVersion)) return [];
      return [{ job, assessment }];
    });
  }
  private validate(input: AssessmentInput) {
    object(input, 'Assessment', ['submissionId','jobId','profileVersion','trackId','observationIds','metadata','axes','reasonsToPursue','concerns','questions','unknowns','hardConflicts','confidence']);
    text(input.submissionId, 'submissionId'); text(input.jobId, 'jobId'); text(input.trackId, 'trackId');
    const job = this.app.getJob(input.jobId);
    if (!Number.isSafeInteger(input.profileVersion) || input.profileVersion < 1) throw new AppError('profileVersion must identify an approved saved profile revision.');
    const profiles = new ProfilesService(this.app);
    const profile = profiles.getProfile(input.profileVersion);
    if (profile.status !== 'approved') throw new AppError('Approve the profile revision before assessing a job.');
    const effective = profiles.effectivePreferences(input.profileVersion, input.trackId);
    list(input.observationIds, 'observationIds');
    if (!input.observationIds.length || new Set(input.observationIds).size !== input.observationIds.length || input.observationIds.some(id => typeof id !== 'string' || !job.observations.some(observation => observation.id === id))) throw new AppError('observationIds must identify distinct saved observations belonging to this job.');
    const evidence = (refs: EvidenceReference[], required: boolean) => {
      list(refs, 'Evidence');
      if (required && !refs.length) throw new AppError('Known findings and conflicts require verbatim saved evidence; unknown information is not a mismatch.');
      for (const ref of refs) {
        object(ref, 'Evidence reference', ['observationId','quote']); text(ref.observationId, 'observationId'); text(ref.quote, 'quote');
        if (!input.observationIds.includes(ref.observationId) || !job.observations.find(item => item.id === ref.observationId)?.text.includes(ref.quote)) throw new AppError('Evidence quotes must appear verbatim in a linked observation of this job.');
      }
    };
    const finding = (item: Finding) => {
      object(item, 'Finding', ['dimension','status','statement','attribution','evidence']); text(item.dimension, 'Finding dimension'); text(item.statement, 'Finding statement');
      if (!['supports','concern','unknown'].includes(item.status)) throw new AppError('Finding status must be supports, concern or unknown.');
      if (!['employer_claim','external_report','model_inference','user_confirmed'].includes(item.attribution)) throw new AppError('Finding attribution must distinguish employer_claim, external_report, model_inference and user_confirmed.');
      evidence(item.evidence, item.status !== 'unknown');
      if (item.status === 'unknown' && item.evidence.length) throw new AppError('Unknown findings have no factual evidence; use an investigation question to retain contextual evidence.');
    };
    object(input.metadata, 'metadata', ['agent','analysisVersion','provider','model','config']); text(input.metadata.agent, 'metadata.agent'); text(input.metadata.analysisVersion, 'metadata.analysisVersion');
    if (input.metadata.provider !== undefined) text(input.metadata.provider, 'metadata.provider');
    if (input.metadata.model !== undefined) text(input.metadata.model, 'metadata.model');
    if (input.metadata.config !== undefined) {
      object(input.metadata.config, 'metadata.config', ['promptVersion','temperature','seed']);
      if (input.metadata.config.promptVersion !== undefined) text(input.metadata.config.promptVersion, 'promptVersion');
      if (input.metadata.config.temperature !== undefined && (typeof input.metadata.config.temperature !== 'number' || !Number.isFinite(input.metadata.config.temperature))) throw new AppError('temperature must be a finite number.');
      if (input.metadata.config.seed !== undefined && !Number.isSafeInteger(input.metadata.config.seed)) throw new AppError('seed must be an integer.');
    }
    object(input.axes, 'axes', ['qualifications','preferences','practicalConstraints']);
    for (const key of ['qualifications','preferences','practicalConstraints'] as const) {
      const axis = input.axes[key]; object(axis, `axes.${key}`, ['status','explanation','findings']); text(axis.explanation, 'Axis explanation'); list(axis.findings, 'Axis findings');
      if (!['match','concern','unknown'].includes(axis.status)) throw new AppError('Axis status must be match, concern or unknown.');
      for (const item of axis.findings) finding(item);
      if (axis.status === 'match' && !axis.findings.some(item => item.status === 'supports')) throw new AppError('A matching axis requires evidence-backed support.');
      if (axis.status === 'concern' && !axis.findings.some(item => item.status === 'concern')) throw new AppError('A concern axis requires an evidenced concern; missing facts remain unknown.');
      if (axis.status === 'unknown' && axis.findings.some(item => item.status !== 'unknown')) throw new AppError('An unknown axis must contain only unknown findings.');
    }
    list(input.reasonsToPursue, 'reasonsToPursue'); for (const item of input.reasonsToPursue) { finding(item); if (item.status !== 'supports') throw new AppError('Reasons to pursue must be supporting findings.'); }
    list(input.concerns, 'concerns'); for (const item of input.concerns) { finding(item); if (item.status !== 'concern') throw new AppError('Concerns must be evidenced concern findings. Keep missing information in unknowns.'); }
    list(input.questions, 'questions');
    for (const question of input.questions) { object(question, 'Question', ['dimension','question','evidence']); text(question.dimension, 'Question dimension'); text(question.question, 'Question'); evidence(question.evidence, false); }
    list(input.unknowns, 'unknowns'); for (const unknown of input.unknowns) { object(unknown, 'Unknown', ['dimension','explanation']); text(unknown.dimension, 'Unknown dimension'); text(unknown.explanation, 'Unknown explanation'); }
    list(input.hardConflicts, 'hardConflicts');
    for (const conflict of input.hardConflicts) {
      object(conflict, 'Hard conflict', ['preferenceKey','observedValue','explanation','attribution','evidence']); text(conflict.preferenceKey, 'Hard conflict preferenceKey'); text(conflict.observedValue, 'Hard conflict observedValue'); text(conflict.explanation, 'Hard conflict explanation');
      if (!effective.some(pref => pref.key === conflict.preferenceKey && pref.kind === 'hard')) throw new AppError('A hard conflict must reference an effective hard preference for this track and profile revision.');
      if (!['employer_claim','user_confirmed'].includes(conflict.attribution)) throw new AppError('A confirmed hard conflict needs an employer claim or user-confirmed fact, not an external report or model inference.');
      evidence(conflict.evidence, true);
      if (!input.concerns.some(item => item.dimension === conflict.preferenceKey)) throw new AppError('Each hard conflict must also appear as an explained concern for its preference dimension.');
    }
    object(input.confidence, 'confidence', ['level','explanation']);
    if (!['high','medium','low'].includes(input.confidence.level)) throw new AppError('confidence.level must be high, medium or low.'); text(input.confidence.explanation, 'Confidence explanation');
  }
  submitAssessment(input: AssessmentInput): { assessment: Assessment; replayed: boolean } {
    this.validate(input);
    const existing = this.app.database.prepare('SELECT id,input_json FROM assessments WHERE submission_id=?').get(input.submissionId);
    if (existing) {
      if (!isDeepStrictEqual(JSON.parse(String(existing.input_json)), input)) throw new AppError('This assessment identifier already has different content. Use a new identifier for reassessment.', 409, 'idempotency_conflict');
      return { assessment: this.history(input.jobId).find(item => item.id === existing.id)!, replayed: true };
    }
    const id = randomUUID(), createdAt = new Date().toISOString();
    const label = fitLabel(input);
    const db = this.app.database;
    db.exec('SAVEPOINT assessment_submit');
    try {
      db.prepare('INSERT INTO assessments VALUES (?,?,?,?,?,?,?,?,?)').run(id, input.jobId, input.submissionId, input.profileVersion, input.trackId, label, rulesVersion, JSON.stringify(input), createdAt);
      for (const observationId of input.observationIds) db.prepare('INSERT INTO assessment_evidence VALUES (?,?)').run(id, observationId);
      db.exec('RELEASE assessment_submit');
    } catch (error) { db.exec('ROLLBACK TO assessment_submit; RELEASE assessment_submit'); throw error; }
    return { assessment: this.history(input.jobId).find(item => item.id === id)!, replayed: false };
  }
}

export const assessmentRoutes: ApiRoute = async ({ app, request, url, json, send }) => {
  const service = new AssessmentsService(app);
  const history = /^\/api\/v1\/jobs\/([^/]+)\/assessments$/.exec(url.pathname);
  if (request.method === 'GET' && history) { send(service.history(decodeURIComponent(history[1]!))); return true; }
  if (url.pathname !== '/api/v1/assessments') return false;
  if (request.method === 'POST') { const result = service.submitAssessment(await json() as AssessmentInput); send(result, result.replayed ? 200 : 201); return true; }
  if (request.method === 'GET') {
    const excluded = url.searchParams.get('excluded');
    if (excluded !== null && !['true','false'].includes(excluded)) throw new AppError('excluded must be true or false.');
    send(service.list({ label: url.searchParams.get('label') as FitLabel ?? undefined, excluded: excluded === null ? undefined : excluded === 'true', profileVersion: url.searchParams.has('profileVersion') ? Number(url.searchParams.get('profileVersion')) : undefined })); return true;
  }
  return false;
};
