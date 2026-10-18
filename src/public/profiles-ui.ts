import type { Profile, ProfileInput, Preference, PreferenceKind, SearchTrack, JsonValue, EffectivePreference } from '../profiles.ts';

const labels: Record<string, string> = { location: 'Location', workArrangement: 'Work arrangement', compensation: 'Compensation (include currency, period and base/package)', benefits: 'Benefits', employment: 'Employment needs', decisionAuthority: 'Decision authority', endToEndOwnership: 'End-to-end ownership', impact: 'Visible impact', approvalLayers: 'Approval layers' };
function node<K extends keyof HTMLElementTagNameMap>(tag: K, content = '') { const item = document.createElement(tag); item.textContent = content; return item; }
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/v1/profiles${path}`, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error?.message ?? 'Profile operation failed.'); return result as T;
}
const displayValue = (value: JsonValue) => typeof value === 'string' ? value : JSON.stringify(value);
const lines = (value: string) => value.split('\n').map(item => item.trim()).filter(Boolean);

export function installProfilesUI() {
  const main = document.querySelector('main')!;
  const panel = node('section'); panel.id = 'profiles-panel'; panel.hidden = true; panel.setAttribute('aria-label', 'Search profile and preferences');
  const status = node('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const toggle = node('button', 'Profile & search tracks'); toggle.type = 'button'; toggle.className = 'quiet'; toggle.setAttribute('aria-expanded', 'false');
  document.querySelector('.intro')?.after(toggle, panel);
  panel.append(status);
  let profiles: Profile[] = []; let active: Profile | null = null; let draft: Profile | null = null;
  const content = node('div'); panel.append(content);
  function report(error: unknown) { status.textContent = error instanceof Error ? error.message : 'Could not save your profile.'; status.className = 'error'; }
  async function load() {
    [profiles, active] = await Promise.all([api<Profile[]>(''), api<Profile | null>('/active')]);
    renderOverview();
  }
  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden; toggle.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) void load().catch(report);
  });
  function renderOverview() {
    content.replaceChildren();
    content.append(node('h2', 'Your profile & search tracks'), node('p', active ? `Active: ${active.name} · revision ${active.version}. Only this approved revision guides searches.` : 'No approved profile yet. Create a draft, review each track, then approve it.'));
    const create = node('button', active ? 'Edit active profile as a new draft' : 'Create profile'); create.type = 'button';
    create.addEventListener('click', () => renderEditor(active)); content.append(create);
    if (profiles.length) content.append(node('h3', 'Revision history'));
    for (const profile of profiles) {
      const row = node('p'); const edit = node('button', `${profile.name} · v${profile.version} · ${profile.status}${profile.version === active?.version ? ' · active' : ''}`); edit.className = 'quiet'; edit.type = 'button';
      edit.addEventListener('click', () => { draft = profile; renderReview(profile); }); row.append(edit); content.append(row);
    }
  }
  function field(parent: HTMLElement, title: string, value: string, multiline = false): HTMLInputElement | HTMLTextAreaElement {
    const label = node('label', title); const input = multiline ? node('textarea') : node('input');
    input.value = value; input.maxLength = multiline ? 100_000 : 8_000; if (input instanceof HTMLTextAreaElement) input.rows = 3;
    label.append(input); parent.append(label); return input;
  }
  function preferenceEditor(parent: HTMLElement, title: string, existing: Preference[], overrides: boolean, shared: Preference[] = []) {
    const details = node('details'); details.open = !overrides; details.append(node('summary', title)); parent.append(details);
    const keys = [...new Set([...Object.keys(labels), ...existing.map(item => item.key), ...shared.map(item => item.key)])];
    const getters: (() => Preference | null)[] = [];
    for (const key of keys) {
      const current = existing.find(item => item.key === key); const group = node('div'); group.className = 'preference-row';
      const label = node('label', labels[key] ?? key); const kind = node('select'); kind.setAttribute('aria-label', `${title}: ${labels[key] ?? key} strength`);
      for (const value of [...(overrides ? ['inherit'] : []), 'undecided', 'soft', 'hard']) { const option = node('option', ({ inherit: 'Use shared preference', undecided: 'Undecided', soft: 'Soft preference', hard: 'Hard requirement' } as Record<string, string>)[value]); option.value = value; kind.append(option); }
      kind.value = current?.kind ?? (overrides ? 'inherit' : 'undecided'); label.append(kind); group.append(label);
      const value = field(group, `${labels[key] ?? key} value`, current && current.kind !== 'undecided' ? displayValue(current.value) : '');
      const update = () => { value.disabled = ['inherit', 'undecided'].includes(kind.value); value.required = !value.disabled; };
      kind.addEventListener('change', update); update(); details.append(group);
      getters.push(() => {
        if (kind.value === 'inherit') return null;
        const unchanged = current && value.value === displayValue(current.value);
        return { key, kind: kind.value as PreferenceKind, value: kind.value === 'undecided' ? null : unchanged ? current.value : value.value.trim() };
      });
    }
    return () => getters.map(get => get()).filter((item): item is Preference => item !== null);
  }
  function renderEditor(source: Profile | null) {
    content.replaceChildren(); content.append(node('h2', source ? `Edit revision ${source.version} as a new draft` : 'Create your profile'), node('p', 'Experience describes what you have done. Aspirations describe what you want next. Saving a draft never changes your active search.'));
    const form = node('form'); content.append(form);
    const name = field(form, 'Profile name', source?.name ?? 'My job search'); name.required = true;
    const experience = field(form, 'Demonstrated experience (one item per line)', source?.demonstratedExperience.join('\n') ?? '', true);
    const aspirations = field(form, 'Aspirations (one item per line)', source?.aspirations.join('\n') ?? '', true);
    const shared = preferenceEditor(form, 'Shared preferences', source?.preferences ?? [], false);
    form.append(node('p', 'Keep compensation units explicit, for example AUD 100,000 base/year plus super. Unknown needs can remain undecided. Company size does not establish autonomy.'));
    const tracks = node('div'); form.append(tracks); const trackGetters: (() => SearchTrack | null)[] = [];
    function addTrack(track?: SearchTrack) {
      const wrapper = node('fieldset'); wrapper.append(node('legend', 'Search track')); tracks.append(wrapper);
      const id = track?.id ?? crypto.randomUUID(); const name = field(wrapper, 'Track name', track?.name ?? ''); name.required = true;
      const titles = field(wrapper, 'Title variants (one per line)', track?.titles.join('\n') ?? '', true);
      const keywords = field(wrapper, 'Keyword variants (one per line)', track?.keywords.join('\n') ?? '', true);
      const preferences = preferenceEditor(wrapper, 'Track-specific overrides', track?.preferences ?? [], true, source?.preferences);
      const remove = node('button', 'Remove track'); remove.type = 'button'; remove.className = 'quiet'; remove.addEventListener('click', () => wrapper.remove()); wrapper.append(remove);
      trackGetters.push(() => wrapper.isConnected ? { id, name: name.value.trim(), titles: lines(titles.value), keywords: lines(keywords.value), preferences: preferences() } : null);
    }
    if (source) source.tracks.forEach(addTrack); else addTrack();
    const add = node('button', '+ Add another track'); add.type = 'button'; add.className = 'quiet'; add.addEventListener('click', () => addTrack());
    const save = node('button', 'Save draft & review'); save.type = 'submit'; const cancel = node('button', 'Cancel'); cancel.type = 'button'; cancel.className = 'quiet'; cancel.addEventListener('click', renderOverview);
    const actions = node('div'); actions.className = 'profile-actions'; actions.append(add, cancel, save); form.append(actions);
    form.addEventListener('submit', event => {
      event.preventDefault(); save.disabled = true;
      const input: ProfileInput = { name: name.value.trim(), demonstratedExperience: lines(experience.value), aspirations: lines(aspirations.value), preferences: shared(), tracks: trackGetters.map(get => get()).filter((item): item is SearchTrack => item !== null) };
      void api<Profile>('', input).then(profile => { draft = profile; status.textContent = 'Draft saved. Review effective preferences before approval.'; status.className = ''; renderReview(profile); }).catch(report).finally(() => { save.disabled = false; });
    });
  }
  function renderReview(profile: Profile) {
    content.replaceChildren(); content.append(node('h2', `${profile.name} · revision ${profile.version} · ${profile.status}`));
    content.append(node('h3', 'Demonstrated experience'), node('p', profile.demonstratedExperience.join(' · ') || 'None recorded'), node('h3', 'Aspirations'), node('p', profile.aspirations.join(' · ') || 'None recorded'));
    for (const track of profile.tracks) {
      const section = node('section'); section.className = 'track-review'; section.append(node('h3', track.name), node('p', `Titles: ${track.titles.join(', ') || 'None'} · Keywords: ${track.keywords.join(', ') || 'None'}`));
      const effective = new Map<string, EffectivePreference>(); for (const pref of profile.preferences) effective.set(pref.key, { ...pref, origin: 'shared' }); for (const pref of track.preferences) effective.set(pref.key, { ...pref, origin: 'track' });
      const list = node('ul'); for (const pref of effective.values()) list.append(node('li', `${labels[pref.key] ?? pref.key}: ${pref.kind === 'undecided' ? 'Undecided' : `${pref.kind === 'hard' ? 'Hard requirement' : 'Soft preference'} — ${displayValue(pref.value)}`} (${pref.origin === 'track' ? 'track override' : 'shared'})`));
      section.append(list); content.append(section);
    }
    const edit = node('button', 'Edit as a new draft'); edit.type = 'button'; edit.className = 'quiet'; edit.addEventListener('click', () => renderEditor(profile));
    const approve = node('button', profile.version === active?.version ? 'Currently active' : profile.status === 'approved' ? 'Use this approved revision again' : 'Approve profile, tracks & variants'); approve.type = 'button'; approve.disabled = profile.version === active?.version;
    approve.addEventListener('click', () => { approve.disabled = true; void api<Profile>(`/${profile.version}/approve`, {}).then(() => { status.textContent = `Revision ${profile.version} approved. Its preferences, tracks and variants now guide searches.`; status.className = ''; return load(); }).catch(report).finally(() => { approve.disabled = false; }); });
    const back = node('button', 'Back to history'); back.type = 'button'; back.className = 'quiet'; back.addEventListener('click', () => void load().catch(report));
    const actions = node('div'); actions.className = 'profile-actions'; actions.append(back, edit, approve); content.append(actions);
  }
}
