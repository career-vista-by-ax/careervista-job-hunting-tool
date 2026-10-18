import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerVistaApp } from '../src/app.ts';
import { ProfilesService } from '../src/profiles.ts';
import type { ProfileInput } from '../src/profiles.ts';

const input: ProfileInput = {
  name: 'My next teaching role', demonstratedExperience: ['Five years teaching primary school'],
  aspirations: ['Lead a year-level team'],
  preferences: [{ key: 'location', kind: 'hard', value: 'Melbourne' }, { key: 'compensation', kind: 'undecided', value: null }, { key: 'decisionAuthority', kind: 'soft', value: 'Choose teaching methods' }],
  tracks: [{ id: 'teacher', name: 'Classroom teaching', titles: ['Primary teacher', 'Classroom teacher'], keywords: ['primary education'], preferences: [] }],
};

test('only an explicitly approved profile becomes active and original versions survive restart', () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-profile-'));
  let app = new CareerVistaApp({ root });
  try {
    let profiles = new ProfilesService(app);
    const first = profiles.createDraft(input);
    assert.equal(profiles.getActiveProfile(), null);
    assert.equal(first.status, 'draft');
    profiles.approve(first.version);
    const next = profiles.createDraft({ ...input, aspirations: ['Become a school principal'] });
    assert.equal(profiles.getActiveProfile()?.version, first.version);
    assert.equal(next.status, 'draft');
    app.close(); app = new CareerVistaApp({ root }); profiles = new ProfilesService(app);
    assert.deepEqual(profiles.getProfile(first.version).aspirations, ['Lead a year-level team']);
    assert.deepEqual(profiles.getProfile(next.version).aspirations, ['Become a school principal']);
    profiles.approve(next.version);
    assert.equal(profiles.getActiveProfile()?.version, next.version);
    assert.equal(profiles.listProfiles().length, 2);
    assert.deepEqual(profiles.getActiveProfile()?.demonstratedExperience, ['Five years teaching primary school']);
  } finally { app.close(); rmSync(root, { recursive: true, force: true }); }
});

test('explicit track overrides win, including undecided, without rewriting shared preferences', () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-profile-')); const app = new CareerVistaApp({ root });
  try {
    const profiles = new ProfilesService(app);
    const draft = profiles.createDraft({ ...input, tracks: [...input.tracks, {
      id: 'lead', name: 'Teaching leadership', titles: ['Year-level coordinator'], keywords: ['school leadership'],
      preferences: [{ key: 'location', kind: 'soft', value: 'Victoria' }, { key: 'decisionAuthority', kind: 'undecided', value: null }, { key: 'approvalLayers', kind: 'hard', value: 'One decision-maker' }],
    }] });
    const effective = profiles.effectivePreferences(draft.version, 'lead');
    assert.deepEqual(effective.find(item => item.key === 'location'), { key: 'location', kind: 'soft', value: 'Victoria', origin: 'track' });
    assert.deepEqual(effective.find(item => item.key === 'decisionAuthority'), { key: 'decisionAuthority', kind: 'undecided', value: null, origin: 'track' });
    assert.deepEqual(effective.find(item => item.key === 'compensation'), { key: 'compensation', kind: 'undecided', value: null, origin: 'shared' });
    assert.equal(profiles.effectivePreferences(draft.version, 'teacher').find(item => item.key === 'location')?.value, 'Melbourne');
    assert.throws(() => profiles.effectivePreferences(draft.version, 'missing'), /track.*not found/i);
    assert.equal(profiles.getActiveProfile(), null);
  } finally { app.close(); rmSync(root, { recursive: true, force: true }); }
});

test('invalid or ambiguous profile preferences fail with guidance and leave version history untouched', () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-profile-')); const app = new CareerVistaApp({ root });
  try {
    const profiles = new ProfilesService(app);
    assert.throws(() => profiles.createDraft({ ...input, name: '' }), /name.*required/i);
    assert.throws(() => profiles.createDraft({ ...input, tracks: [] }), /track/i);
    assert.throws(() => profiles.createDraft({ ...input, tracks: [input.tracks[0]!, input.tracks[0]!] }), /duplicate.*track/i);
    assert.throws(() => profiles.createDraft({ ...input, preferences: [{ key: 'location', kind: 'undecided', value: 'Melbourne' }] }), /undecided.*null/i);
    assert.throws(() => profiles.createDraft({ ...input, preferences: [{ key: 'location', kind: 'hard', value: null }] }), /hard.*value/i);
    assert.throws(() => profiles.createDraft({ ...input, preferences: [{ key: 'location', kind: 'soft', value: 'Melbourne' }, { key: 'location', kind: 'hard', value: 'Sydney' }] }), /duplicate.*preference/i);
    assert.equal(profiles.listProfiles().length, 0);
  } finally { app.close(); rmSync(root, { recursive: true, force: true }); }
});
