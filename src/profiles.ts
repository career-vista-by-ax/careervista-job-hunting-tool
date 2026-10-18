import { readFileSync } from 'node:fs';
import { AppError, CareerVistaApp } from './app.ts';
import type { ApiRoute } from './server.ts';

export type PreferenceKind = 'hard' | 'soft' | 'undecided';
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export interface Preference { key: string; kind: PreferenceKind; value: JsonValue }
export interface SearchTrack { id: string; name: string; titles: string[]; keywords: string[]; preferences: Preference[] }
export interface ProfileInput {
  name: string; demonstratedExperience: string[]; aspirations: string[];
  preferences: Preference[]; tracks: SearchTrack[];
}
export interface Profile extends ProfileInput { version: number; status: 'draft' | 'approved'; createdAt: string; approvedAt: string | null }
export interface EffectivePreference extends Preference { origin: 'shared' | 'track' }
/** Standard editable dimensions; custom keys are also supported without industry assumptions. */
export const preferenceDimensions = ['location', 'workArrangement', 'compensation', 'benefits', 'employment', 'decisionAuthority', 'endToEndOwnership', 'impact', 'approvalLayers'] as const;

function requiredText(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 8_000) throw new AppError(`${label} is required and must be text of at most 8000 characters.`);
}
function textList(value: unknown, label: string): asserts value is string[] {
  if (!Array.isArray(value) || value.length > 1000) throw new AppError(`${label} must be a list of at most 1000 text entries.`);
  for (const entry of value) requiredText(entry, label);
}
function isJson(value: unknown, depth = 0): boolean {
  if (depth > 20) return false;
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(item => isJson(item, depth + 1));
  return typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype && Object.values(value).every(item => isJson(item, depth + 1));
}
function validatePreferences(value: unknown, label: string): asserts value is Preference[] {
  if (!Array.isArray(value) || value.length > 100) throw new AppError(`${label} must be a list of at most 100 preferences.`);
  const keys = new Set<string>();
  for (const pref of value) {
    if (!pref || typeof pref !== 'object') throw new AppError(`${label} entries must be preference objects.`);
    requiredText(pref.key, 'Preference key');
    if (keys.has(pref.key)) throw new AppError(`Duplicate preference key: ${pref.key}. Choose a single value per scope.`);
    keys.add(pref.key);
    if (!['hard', 'soft', 'undecided'].includes(pref.kind)) throw new AppError('Preference kind must be hard, soft or undecided.');
    if (pref.kind === 'undecided' && pref.value !== null) throw new AppError('Undecided preferences must have a null value.');
    if (pref.kind !== 'undecided' && (pref.value === null || pref.value === '' || (Array.isArray(pref.value) && pref.value.length === 0))) throw new AppError('A hard or soft preference needs an explicit value; choose undecided for unknown needs.');
    if (!isJson(pref.value) || JSON.stringify(pref.value).length > 64_000) throw new AppError('Preference value must be finite JSON, at most 64000 characters and 20 levels deep.');
  }
}
function validateProfile(input: ProfileInput) {
  if (!input || typeof input !== 'object') throw new AppError('A profile object is required.');
  requiredText(input.name, 'Profile name');
  textList(input.demonstratedExperience, 'Demonstrated experience'); textList(input.aspirations, 'Aspirations');
  validatePreferences(input.preferences, 'Shared preferences');
  if (!Array.isArray(input.tracks) || input.tracks.length < 1 || input.tracks.length > 50) throw new AppError('Add between one and 50 search tracks before saving a profile.');
  const ids = new Set<string>();
  for (const track of input.tracks) {
    if (!track || typeof track !== 'object') throw new AppError('Each search track must be an object.');
    requiredText(track.id, 'Search track identifier'); requiredText(track.name, 'Search track name');
    if (!/^[a-zA-Z0-9_-]+$/.test(track.id)) throw new AppError('Search track identifiers may contain letters, numbers, underscores and hyphens.');
    if (ids.has(track.id)) throw new AppError(`Duplicate search track identifier: ${track.id}.`);
    ids.add(track.id);
    textList(track.titles, 'Title variants'); textList(track.keywords, 'Keyword variants');
    if (!track.titles.length && !track.keywords.length) throw new AppError('Each search track needs at least one title or keyword variant.');
    validatePreferences(track.preferences, `Preferences for ${track.name}`);
  }
}

export class ProfilesService {
  readonly app: CareerVistaApp;
  constructor(app: CareerVistaApp) { this.app = app; }
  createDraft(input: ProfileInput): Profile {
    validateProfile(input);
    const db = this.app.database;
    db.exec('BEGIN IMMEDIATE');
    let version: number;
    try {
      const result = db.prepare('INSERT INTO profile_revisions (name,experience_json,aspirations_json,created_at) VALUES (?,?,?,?)').run(input.name, JSON.stringify(input.demonstratedExperience), JSON.stringify(input.aspirations), new Date().toISOString());
      version = Number(result.lastInsertRowid);
      for (const track of input.tracks) db.prepare('INSERT INTO search_tracks VALUES (?,?,?,?,?)').run(version, track.id, track.name, JSON.stringify(track.titles), JSON.stringify(track.keywords));
      const insert = db.prepare('INSERT INTO profile_preferences VALUES (?,?,?,?,?)');
      for (const pref of input.preferences) insert.run(version, '', pref.key, pref.kind, JSON.stringify(pref.value));
      for (const track of input.tracks) for (const pref of track.preferences) insert.run(version, track.id, pref.key, pref.kind, JSON.stringify(pref.value));
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return this.getProfile(version!);
  }
  getProfile(version: number): Profile {
    const db = this.app.database;
    const row = db.prepare('SELECT * FROM profile_revisions WHERE version=?').get(version);
    if (!row) throw new AppError('Profile revision not found.', 404, 'not_found');
    const preferences = (trackId: string): Preference[] => db.prepare('SELECT key,kind,value_json FROM profile_preferences WHERE profile_version=? AND track_id=? ORDER BY key').all(version, trackId).map(item => ({ key: String(item.key), kind: item.kind as PreferenceKind, value: JSON.parse(String(item.value_json)) as JsonValue }));
    const tracks = db.prepare('SELECT * FROM search_tracks WHERE profile_version=? ORDER BY id').all(version).map(track => ({ id: String(track.id), name: String(track.name), titles: JSON.parse(String(track.titles_json)) as string[], keywords: JSON.parse(String(track.keywords_json)) as string[], preferences: preferences(String(track.id)) }));
    return { version, name: String(row.name), demonstratedExperience: JSON.parse(String(row.experience_json)) as string[], aspirations: JSON.parse(String(row.aspirations_json)) as string[], createdAt: String(row.created_at), approvedAt: row.approved_at === null ? null : String(row.approved_at), status: row.approved_at === null ? 'draft' : 'approved', preferences: preferences(''), tracks };
  }
  listProfiles(): Profile[] {
    return this.app.database.prepare('SELECT version FROM profile_revisions ORDER BY version DESC').all().map(row => this.getProfile(Number(row.version)));
  }
  getActiveProfile(): Profile | null {
    const row = this.app.database.prepare('SELECT profile_version FROM active_profile WHERE singleton=1').get();
    return row ? this.getProfile(Number(row.profile_version)) : null;
  }
  effectivePreferences(version: number, trackId: string): EffectivePreference[] {
    const profile = this.getProfile(version);
    const track = profile.tracks.find(track => track.id === trackId);
    if (!track) throw new AppError('Search track not found in this profile revision.', 404, 'not_found');
    const effective = new Map<string, EffectivePreference>();
    for (const pref of profile.preferences) effective.set(pref.key, { ...pref, origin: 'shared' });
    for (const pref of track.preferences) effective.set(pref.key, { ...pref, origin: 'track' });
    return [...effective.values()].sort((a, b) => a.key.localeCompare(b.key));
  }
  approve(version: number): Profile {
    this.getProfile(version);
    const db = this.app.database;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE profile_revisions SET approved_at=COALESCE(approved_at,?) WHERE version=?').run(new Date().toISOString(), version);
      db.prepare('INSERT INTO active_profile VALUES (1,?) ON CONFLICT(singleton) DO UPDATE SET profile_version=excluded.profile_version').run(version);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return this.getProfile(version);
  }
}

export function profileRoutes(profiles: ProfilesService): ApiRoute {
  return async context => {
    const path = context.url.pathname;
    if (path === '/profiles-ui.js' && context.request.method === 'GET') {
      context.response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
      context.response.end(readFileSync(new URL('./public/profiles-ui.js', import.meta.url))); return true;
    }
    if (path === '/api/v1/profiles' && context.request.method === 'GET') { context.send(profiles.listProfiles()); return true; }
    if (path === '/api/v1/profiles/active' && context.request.method === 'GET') { context.send(profiles.getActiveProfile()); return true; }
    if (path === '/api/v1/profiles' && context.request.method === 'POST') { context.send(profiles.createDraft(await context.json() as ProfileInput), 201); return true; }
    const effective = /^\/api\/v1\/profiles\/(\d+)\/tracks\/([^/]+)\/effective$/.exec(path);
    if (effective && context.request.method === 'GET') { context.send(profiles.effectivePreferences(Number(effective[1]), decodeURIComponent(effective[2]!))); return true; }
    const match = /^\/api\/v1\/profiles\/(\d+)(\/approve)?$/.exec(path);
    if (match && context.request.method === (match[2] ? 'POST' : 'GET')) {
      context.send(match[2] ? profiles.approve(Number(match[1])) : profiles.getProfile(Number(match[1]))); return true;
    }
    return false;
  };
}
