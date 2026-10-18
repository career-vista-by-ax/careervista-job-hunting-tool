import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { AppError, CareerVistaApp } from './app.ts';
import { ProfilesService } from './profiles.ts';
import type { ProfileInput } from './profiles.ts';
import type { ApiRoute } from './server.ts';

export interface ResumeInput { importId: string; label: string; format: 'txt' | 'paste'; text: string }
export interface Resume extends ResumeInput { id: string; version: number; createdAt: string; redactionVersion: string }
export interface ReviewedPayload { id: string; resumeId: string; sourceVersion: number; text: string; reviewedAt: string; redactionVersion: string }
export interface ResumeProposalInput {
  submissionId: string; resumeId: string; payloadId: string;
  metadata: { agent: string; analysisVersion: string; provider?: string; model?: string };
  experiences: { text: string; quote: string }[];
  tracks: { id: string; name: string; titles: string[]; keywords: string[]; rationale: string; evidence: string[] }[];
}
export interface ResumeProposal extends ResumeProposalInput { id: string; createdAt: string }
export type ResumeFailureCode = 'provider_failure' | 'malformed_output' | 'invalid_proposal';
const failureMessages: Record<ResumeFailureCode, string> = {
  provider_failure: 'The agent provider failed. Your resume and reviewed payload are intact. Check the host settings and retry.',
  malformed_output: 'The agent returned malformed output. Ask it to use the documented resume proposal schema; your source is retained.',
  invalid_proposal: 'The proposal was rejected. Use exact experience quotes from the reviewed payload and keep suggested directions separate from aspirations.',
};
const redactionVersion = 'contacts-v1';
function object(value: unknown, name: string, keys: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new AppError(`${name} must contain only its documented fields.`);
}
function text(value: unknown, label: string, limit = 8000): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) throw new AppError(`${label} must be non-empty text up to ${limit} characters.`);
}
function redact(source: string): string {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const first = lines.findIndex(line => line.trim());
  if (first >= 0) {
    const header = lines[first]!;
    const name = header.split(/[|•·]/)[0]!.trim();
    if (/^(?:name|full name)\s*:/i.test(name) || (/^[\p{L}.'’-]+(?:\s+[\p{L}.'’-]+){1,4}$/u.test(name) && !/^(?:professional summary|work experience|curriculum vitae|career profile|personal profile|resume summary)$/i.test(name))) lines[first] = header.replace(name, '[name removed — review header]');
  }
  return lines.map(line => {
    if (/^\s*(?:name|full name|email|e-mail|phone|mobile|telephone|tel|address|date of birth|dob|contact details|linkedin|website|portfolio)\s*:/i.test(line)) return '[contact line removed]';
    return line
      .replace(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email removed]')
      .replace(/(?:https?:\/\/|www\.)[^\s<>]+|\b(?:linkedin\.com|github\.com)\/[^\s<>]+/gi, '[contact URL removed]')
      .replace(/\b(?:\d+\/)?\d{1,6}\s+(?:[\p{L}\d.'’-]+\s+){0,7}(?:street|st|road|rd|avenue|ave|drive|dr|lane|ln|court|ct|crescent|cres|place|pl|terrace|tce|way)\b[^\n]*/giu, '[street address removed]')
      .replace(/(?:\+?\d[\d ().-]{6,}\d)/g, value => {
        const digits = value.replace(/\D/g, '');
        if (/^\d{4}\s*-\s*\d{4}$/.test(value.trim()) || /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value;
        return digits.length >= 8 && digits.length <= 15 ? '[phone removed]' : value;
      });
  }).join('\n');
}
export class ResumeService {
  readonly app: CareerVistaApp;
  constructor(app: CareerVistaApp) { this.app = app; }
  listResumes() { return this.app.database.prepare('SELECT id,version,label,format,created_at AS createdAt FROM resumes ORDER BY version DESC').all(); }
  getResume(id: string): Resume {
    const row = this.app.database.prepare('SELECT * FROM resumes WHERE id=?').get(id);
    if (!row) throw new AppError('Resume not found. Import plain text first.', 404, 'not_found');
    return { id: String(row.id), version: Number(row.version), importId: String(row.import_id), label: String(row.label), format: row.format as ResumeInput['format'], text: String(row.text), redactionVersion: String(row.redaction_version), createdAt: String(row.created_at) };
  }
  importResume(input: ResumeInput) {
    object(input, 'Resume import', ['importId','label','format','text']); text(input.importId, 'importId'); text(input.label, 'Resume label');
    if (!['txt','paste'].includes(input.format)) throw new AppError('Only UTF-8 plain text (.txt) and pasted text are supported. Export your PDF/DOCX to plain text or paste its readable content. Nothing was imported.');
    text(input.text, 'Resume text', 1_000_000);
    if (input.text.includes('\0') || input.text.startsWith('%PDF-') || input.text.startsWith('PK\u0003\u0004') || input.text.includes('\uFFFD')) throw new AppError('This does not look like supported UTF-8 plain text. Export to .txt or paste readable content. Nothing was imported.');
    const existing = this.app.database.prepare('SELECT id FROM resumes WHERE import_id=?').get(input.importId);
    if (existing) {
      const resume = this.getResume(String(existing.id));
      if (!isDeepStrictEqual({ importId: resume.importId, label: resume.label, format: resume.format, text: resume.text }, input)) throw new AppError('This import identifier already has different content. Use a new import identifier for a new resume version.', 409, 'idempotency_conflict');
      return { resume, replayed: true };
    }
    const id = randomUUID();
    this.app.database.prepare('INSERT INTO resumes (id,import_id,label,format,text,redacted_text,redaction_version,created_at) VALUES (?,?,?,?,?,?,?,?)').run(id, input.importId, input.label, input.format, input.text, redact(input.text), redactionVersion, new Date().toISOString());
    return { resume: this.getResume(id), replayed: false };
  }
  payloadPreview(id: string) {
    const source = this.getResume(id);
    const row = this.app.database.prepare('SELECT redacted_text FROM resumes WHERE id=?').get(id)!;
    return { resumeId: id, sourceVersion: source.version, redactionVersion: source.redactionVersion, text: String(row.redacted_text), reviewed: false, notice: 'Review every line before sharing. Automatic redaction may miss unusual contact details or remove useful headers. Edit the payload as needed; the original stays local.' };
  }
  reviewPayload(resumeId: string, input: { operationId: string; text: string; confirmed: boolean }): ReviewedPayload {
    this.getResume(resumeId); object(input, 'Payload review', ['operationId','text','confirmed']); text(input.operationId, 'operationId'); text(input.text, 'Reviewed text', 1_000_000);
    if (input.confirmed !== true) throw new AppError('Review the exact payload and confirm it before an agent can analyse it.');
    const existing = this.app.database.prepare('SELECT * FROM resume_payloads WHERE operation_id=?').get(input.operationId);
    if (existing) {
      if (existing.resume_id !== resumeId || existing.text !== input.text) throw new AppError('This review identifier already has different content. Use a new identifier for a new reviewed payload.', 409, 'idempotency_conflict');
      return this.agentPayload(String(existing.id));
    }
    const id = randomUUID(); this.app.database.prepare('INSERT INTO resume_payloads VALUES (?,?,?,?,?)').run(id, resumeId, input.operationId, input.text, new Date().toISOString());
    return this.agentPayload(id);
  }
  history(resumeId: string) {
    this.getResume(resumeId);
    const db = this.app.database;
    const proposals = db.prepare('SELECT id,input_json,created_at FROM resume_proposals WHERE resume_id=? ORDER BY rowid').all(resumeId).map(row => ({ ...JSON.parse(String(row.input_json)), id: String(row.id), createdAt: String(row.created_at) } as ResumeProposal));
    const failures = db.prepare('SELECT id,operation_id AS operationId,code,created_at AS createdAt FROM resume_failures WHERE resume_id=? ORDER BY rowid').all(resumeId).map(row => ({ id: String(row.id), operationId: String(row.operationId), code: row.code as ResumeFailureCode, createdAt: String(row.createdAt), message: failureMessages[row.code as ResumeFailureCode] }));
    const profiles = db.prepare('WITH RECURSIVE linked(profile_version,proposal_id) AS (SELECT l.profile_version,l.proposal_id FROM resume_profile_links l JOIN resume_proposals p ON p.id=l.proposal_id WHERE p.resume_id=? UNION SELECT a.profile_version,l.proposal_id FROM profile_ancestry a JOIN linked l ON a.parent_version=l.profile_version) SELECT profile_version AS profileVersion,proposal_id AS proposalId FROM linked ORDER BY profile_version').all(resumeId).map(row => ({ profileVersion: Number(row.profileVersion), proposalId: String(row.proposalId) }));
    const payloads = db.prepare('SELECT id FROM resume_payloads WHERE resume_id=? ORDER BY rowid').all(resumeId).map(row => this.agentPayload(String(row.id)));
    return { proposals, failures, profiles, payloads };
  }
  recordFailure(input: { resumeId: string; operationId: string; code: ResumeFailureCode }) {
    object(input, 'Resume failure', ['resumeId','operationId','code']); text(input.resumeId, 'resumeId'); text(input.operationId, 'operationId'); this.getResume(input.resumeId);
    if (!Object.hasOwn(failureMessages, input.code)) throw new AppError('code must be provider_failure, malformed_output or invalid_proposal. Never send raw provider output or credentials.');
    const db = this.app.database; const existing = db.prepare('SELECT resume_id,code FROM resume_failures WHERE operation_id=?').get(input.operationId);
    if (existing && (existing.resume_id !== input.resumeId || existing.code !== input.code)) throw new AppError('This failure identifier already records a different failure.', 409, 'idempotency_conflict');
    if (!existing) db.prepare('INSERT INTO resume_failures VALUES (?,?,?,?,?)').run(randomUUID(), input.resumeId, input.operationId, input.code, new Date().toISOString());
    return this.history(input.resumeId).failures.find(item => item.operationId === input.operationId)!;
  }
  getProposal(id: string): ResumeProposal {
    const row = this.app.database.prepare('SELECT * FROM resume_proposals WHERE id=?').get(id);
    if (!row) throw new AppError('Resume proposal not found. Ask the agent to submit grounded suggestions for a reviewed payload first.', 404, 'not_found');
    return { ...JSON.parse(String(row.input_json)), id: String(row.id), createdAt: String(row.created_at) } as ResumeProposal;
  }
  submitProposal(input: ResumeProposalInput): { proposal: ResumeProposal; replayed: boolean } {
    object(input, 'Resume proposal', ['submissionId','resumeId','payloadId','metadata','experiences','tracks']);
    text(input.submissionId, 'submissionId'); text(input.resumeId, 'resumeId'); this.getResume(input.resumeId);
    try {
      text(input.payloadId, 'payloadId'); const payload = this.agentPayload(input.payloadId);
      if (payload.resumeId !== input.resumeId) throw new AppError('The reviewed payload must belong to this resume.');
      const existing = this.app.database.prepare('SELECT id,input_json FROM resume_proposals WHERE submission_id=?').get(input.submissionId);
      if (existing) {
        if (!isDeepStrictEqual(JSON.parse(String(existing.input_json)), input)) throw new AppError('This proposal identifier already has different content. Use a new identifier for a revised proposal.', 409, 'idempotency_conflict');
        return { proposal: this.getProposal(String(existing.id)), replayed: true };
      }
      object(input.metadata, 'Proposal metadata', ['agent','analysisVersion','provider','model']); text(input.metadata.agent, 'metadata.agent'); text(input.metadata.analysisVersion, 'metadata.analysisVersion');
      if (input.metadata.provider !== undefined) text(input.metadata.provider, 'metadata.provider'); if (input.metadata.model !== undefined) text(input.metadata.model, 'metadata.model');
      if (!Array.isArray(input.experiences) || input.experiences.length > 100) throw new AppError('experiences must contain at most 100 extractive experience quotes.');
      for (const experience of input.experiences) {
        object(experience, 'Experience', ['text','quote']); text(experience.text, 'Experience text'); text(experience.quote, 'Experience quote');
        if (experience.text !== experience.quote || !payload.text.includes(experience.quote)) throw new AppError('Demonstrated experience must be extractive: its text must equal an exact quote in the reviewed payload. Do not invent achievements.');
      }
      if (!Array.isArray(input.tracks) || !input.tracks.length || input.tracks.length > 50) throw new AppError('Suggest between one and 50 possible tracks for user review, not assumed aspirations.');
      const ids = new Set<string>();
      for (const track of input.tracks) {
        object(track, 'Suggested track', ['id','name','titles','keywords','rationale','evidence']); text(track.id, 'Track id'); text(track.name, 'Track name'); text(track.rationale, 'Track rationale');
        if (!/^[a-zA-Z0-9_-]+$/.test(track.id) || ids.has(track.id)) throw new AppError('Suggested track IDs must be unique letters/numbers/hyphens/underscores.'); ids.add(track.id);
        for (const key of ['titles','keywords','evidence'] as const) { if (!Array.isArray(track[key]) || track[key].length > 100) throw new AppError(`${key} must be a list of at most 100 text entries.`); for (const item of track[key]) text(item, key); }
        if (!track.titles.length && !track.keywords.length) throw new AppError('Each suggested track needs a title or keyword variant.');
        if (!track.evidence.length || track.evidence.some(quote => !payload.text.includes(quote))) throw new AppError('Track suggestions must cite exact quotes in the reviewed payload; they remain possible directions, not desired goals or proof of qualifications.');
      }
      const id = randomUUID(); this.app.database.prepare('INSERT INTO resume_proposals VALUES (?,?,?,?,?,?)').run(id, input.resumeId, input.payloadId, input.submissionId, JSON.stringify(input), new Date().toISOString());
      return { proposal: this.getProposal(id), replayed: false };
    } catch (error) {
      if (error instanceof AppError && error.status !== 409) this.recordFailure({ resumeId: input.resumeId, operationId: `proposal:${input.submissionId}`, code: 'invalid_proposal' });
      throw error;
    }
  }
  createProfileDraft(input: { operationId: string; proposalId: string; profile: ProfileInput; confirmedReview: boolean }) {
    object(input, 'Reviewed profile draft', ['operationId','proposalId','profile','confirmedReview']); text(input.operationId, 'operationId'); text(input.proposalId, 'proposalId');
    if (input.confirmedReview !== true) throw new AppError('Explicitly review the suggested experience, choose your own aspirations/preferences and confirm before creating a profile draft.');
    this.getProposal(input.proposalId);
    object(input.profile, 'Reviewed profile', ['basedOnVersion','name','demonstratedExperience','aspirations','preferences','tracks']);
    if (Array.isArray(input.profile.preferences)) for (const pref of input.profile.preferences) object(pref, 'Reviewed preference', ['key','kind','value']);
    if (Array.isArray(input.profile.tracks)) for (const track of input.profile.tracks) { object(track, 'Reviewed track', ['id','name','titles','keywords','preferences']); if (Array.isArray(track.preferences)) for (const pref of track.preferences) object(pref, 'Reviewed track preference', ['key','kind','value']); }
    const db = this.app.database;
    const existing = db.prepare('SELECT profile_version,input_json FROM resume_profile_links WHERE operation_id=?').get(input.operationId);
    if (existing) {
      if (!isDeepStrictEqual(JSON.parse(String(existing.input_json)), input)) throw new AppError('This review identifier already records a different profile draft. Use a new identifier.', 409, 'idempotency_conflict');
      return new ProfilesService(this.app).getProfile(Number(existing.profile_version));
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      const profile = new ProfilesService(this.app).createDraft(input.profile);
      db.prepare('INSERT INTO resume_profile_links VALUES (?,?,?,?,?)').run(profile.version, input.proposalId, input.operationId, JSON.stringify(input), new Date().toISOString());
      db.exec('COMMIT'); return profile;
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  agentPayload(id: string): ReviewedPayload {
    const row = this.app.database.prepare('SELECT * FROM resume_payloads WHERE id=?').get(id);
    if (!row) throw new AppError('Reviewed payload not found. Preview the default redaction and explicitly confirm the payload first.', 404, 'not_found');
    const source = this.getResume(String(row.resume_id));
    return { id, resumeId: source.id, sourceVersion: source.version, text: String(row.text), reviewedAt: String(row.reviewed_at), redactionVersion: source.redactionVersion };
  }
}

export const resumeRoutes: ApiRoute = async ({ app, request, url, json, send }) => {
  const service = new ResumeService(app);
  if (url.pathname === '/api/v1/resumes') {
    if (request.method === 'GET') { send(service.listResumes()); return true; }
    if (request.method === 'POST') { const result = service.importResume(await json() as ResumeInput); const { text: original, importId, ...resume } = result.resume; send({ resume, replayed: result.replayed }, result.replayed ? 200 : 201); return true; }
  }
  const resume = /^\/api\/v1\/resumes\/([^/]+)\/(preview|history|payloads)$/.exec(url.pathname);
  if (resume) {
    const id = decodeURIComponent(resume[1]!);
    if (request.method === 'GET' && resume[2] === 'preview') { send(service.payloadPreview(id)); return true; }
    if (request.method === 'GET' && resume[2] === 'history') { send(service.history(id)); return true; }
    if (request.method === 'POST' && resume[2] === 'payloads') { send(service.reviewPayload(id, await json() as Parameters<ResumeService['reviewPayload']>[1]), 201); return true; }
  }
  const payload = /^\/api\/v1\/resume-payloads\/([^/]+)$/.exec(url.pathname);
  if (payload && request.method === 'GET') { send(service.agentPayload(decodeURIComponent(payload[1]!))); return true; }
  const proposal = /^\/api\/v1\/resume-proposals\/([^/]+)$/.exec(url.pathname);
  if (proposal && request.method === 'GET') { send(service.getProposal(decodeURIComponent(proposal[1]!))); return true; }
  if (request.method === 'POST') {
    if (url.pathname === '/api/v1/resume-proposals') { const result = service.submitProposal(await json() as ResumeProposalInput); send(result, result.replayed ? 200 : 201); return true; }
    if (url.pathname === '/api/v1/resume-failures') { send(service.recordFailure(await json() as Parameters<ResumeService['recordFailure']>[0]), 201); return true; }
    if (url.pathname === '/api/v1/resume-profile-drafts') { send(service.createProfileDraft(await json() as Parameters<ResumeService['createProfileDraft']>[0]), 201); return true; }
  }
  return false;
};
