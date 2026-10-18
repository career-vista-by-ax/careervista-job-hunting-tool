import type { ResumeProposal, ReviewedPayload } from '../resume.ts';
import type { Profile, ProfileInput, Preference, PreferenceKind, SearchTrack } from '../profiles.ts';

function node<K extends keyof HTMLElementTagNameMap>(tag: K, content = '') { const element = document.createElement(tag); element.textContent = content; return element; }
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/v1${path}`, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error?.message ?? 'Resume operation failed.'); return result as T;
}
const lines = (value: string) => value.split('\n').map(item => item.trim()).filter(Boolean);
const dimensions: Record<string,string> = { location:'Location',workArrangement:'Work arrangement',compensation:'Compensation (include currency and units)',benefits:'Benefits',employment:'Employment needs',decisionAuthority:'Decision authority',endToEndOwnership:'End-to-end ownership',impact:'Visible impact',approvalLayers:'Approval layers' };

export function installResumeUI() {
  const panel = node('section'); panel.id = 'resume-panel'; panel.hidden = true; panel.setAttribute('aria-label', 'Resume import and onboarding');
  const status = node('p'); status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
  const content = node('div'); panel.append(status,content);
  const toggle = node('button','Import resume'); toggle.type = 'button'; toggle.className = 'quiet'; toggle.setAttribute('aria-expanded','false');
  document.querySelector('.toolbar-actions')!.prepend(toggle); document.querySelector('.toolbar')!.after(panel);
  function report(error: unknown) { status.textContent = error instanceof Error ? error.message : 'Could not complete this step. Your saved resume is retained.'; status.className = 'error'; }
  function message(value: string) { status.textContent = value; status.className = ''; }
  function field(parent: HTMLElement, labelText: string, value = '', multiline = false) {
    const label = node('label',labelText); const input = multiline ? node('textarea') : node('input'); input.value = value; input.maxLength = multiline ? 1_000_000 : 8_000; if (input instanceof HTMLTextAreaElement) input.rows = 5; label.append(input); parent.append(label); return input;
  }
  function check(parent: HTMLElement, labelText: string) { const label = node('label'); label.className = 'resume-check'; const input = node('input'); input.type = 'checkbox'; label.append(input, document.createTextNode(labelText)); parent.append(label); return input; }
  toggle.addEventListener('click', () => { panel.hidden = !panel.hidden; toggle.setAttribute('aria-expanded',String(!panel.hidden)); if (!panel.hidden) void overview().catch(report); });
  async function overview() {
    content.replaceChildren(); content.append(node('h2','Start with your resume'),node('p','Import plain text, review the redacted analysis payload, then ask your agent for grounded suggestions. You choose your future direction and approve the final profile.'));
    const form = node('form'); const label = field(form,'Resume label','My resume'); label.required = true;
    const fileLabel = node('label','Choose a UTF-8 .txt file (optional)'); const file = node('input'); file.type = 'file'; file.accept = '.txt,text/plain'; fileLabel.append(file); form.append(fileLabel);
    const source = field(form,'Or paste readable resume text','',true); source.required = true;
    file.addEventListener('change', () => {
      const selected = file.files?.[0]; if (!selected) return;
      if (!/\.txt$/i.test(selected.name)) { file.value = ''; report(new Error('This format is unsupported. Export to UTF-8 .txt or paste its readable text. Nothing has been imported.')); return; }
      void selected.arrayBuffer().then(buffer => { try { source.value = new TextDecoder('utf-8',{fatal:true}).decode(buffer); label.value = selected.name; message('Text loaded locally. Choose Import text to save and preview the redaction.'); } catch { report(new Error('The file is not valid UTF-8 text. Export a UTF-8 .txt file or paste readable content.')); } }).catch(report);
    });
    form.append(node('p','Original text stays in your private local database and private backups. The app never sends it to a model automatically. PDF, DOCX and images require a plain-text export or paste.'));
    const submit = node('button','Import text & preview redaction'); submit.type = 'submit'; form.append(submit); content.append(form);
    const importId = crypto.randomUUID();
    form.addEventListener('submit', event => { event.preventDefault(); submit.disabled = true; void api<{resume:{id:string}}>('/resumes',{importId,label:label.value,format:file.files?.length ? 'txt' : 'paste',text:source.value}).then(result => { message('Resume saved locally. Inspect and edit the exact payload before any agent analysis.'); return preview(result.resume.id); }).catch(report).finally(() => { submit.disabled = false; }); });
    const saved = await api<{id:string;version:number;label:string}[]>('/resumes');
    if (saved.length) content.append(node('h3','Saved resume versions'));
    for (const resume of saved) { const row = node('p'); const button = node('button',`${resume.label} · source v${resume.version}`); button.type = 'button'; button.className = 'quiet'; button.addEventListener('click',() => { void history(resume.id).catch(report); }); row.append(button); content.append(row); }
  }
  async function preview(id: string) {
    const preview = await api<{text:string;notice:string;sourceVersion:number}>(`/resumes/${encodeURIComponent(id)}/preview`);
    content.replaceChildren(); content.append(node('h2',`Review analysis payload · source v${preview.sourceVersion}`),node('p',preview.notice));
    const form = node('form'); const payload = field(form,'Exact text your agent may analyse',preview.text,true); payload.required = true;
    const confirmed = check(form,'I reviewed this exact text and want it available for agent analysis.'); confirmed.required = true;
    const submit = node('button','Confirm reviewed payload'); submit.type = 'submit'; form.append(submit); content.append(form);
    const operationId = crypto.randomUUID();
    form.addEventListener('submit',event => { event.preventDefault(); submit.disabled = true; void api<ReviewedPayload>(`/resumes/${encodeURIComponent(id)}/payloads`,{operationId,text:payload.value,confirmed:confirmed.checked}).then(reviewed => { message('Reviewed payload saved. Your agent can now analyse this version; no provider is called by the app.'); renderPayload(reviewed); }).catch(report).finally(() => { submit.disabled = false; }); });
  }
  function renderPayload(payload: ReviewedPayload) {
    content.replaceChildren(); content.append(node('h2','Ask your agent for suggestions'),node('p','Use any compatible agent/model. Ask it to read only this reviewed payload endpoint, then submit extractive experience and possible tracks using the resume proposal API. No credentials are required by CareerVista.'));
    content.append(node('p',`Reviewed payload: ${payload.id}`),node('code',`${location.origin}/api/v1/resume-payloads/${payload.id}`));
    const text = field(content,'Reviewed analysis text',payload.text,true); text.readOnly = true;
    const copy = node('button','Copy payload for my agent'); copy.type = 'button'; copy.className = 'quiet'; copy.addEventListener('click',() => void navigator.clipboard.writeText(JSON.stringify(payload)).then(() => message('Reviewed payload copied.')).catch(report));
    const refresh = node('button','Refresh suggestions'); refresh.type = 'button'; refresh.addEventListener('click',() => void history(payload.resumeId).catch(report)); content.append(copy,refresh);
  }
  async function history(id: string) {
    const result = await api<{proposals:ResumeProposal[];failures:{message:string}[];profiles:{profileVersion:number}[];payloads:ReviewedPayload[]}>(`/resumes/${encodeURIComponent(id)}/history`);
    content.replaceChildren(); content.append(node('h2','Resume suggestions & review'));
    for (const failure of result.failures) content.append(node('p',failure.message));
    const revise = node('button','Review a new redacted payload'); revise.type = 'button'; revise.className = 'quiet'; revise.addEventListener('click',() => void preview(id).catch(report)); content.append(revise);
    const refresh = node('button','Refresh suggestions'); refresh.type = 'button'; refresh.className = 'quiet'; refresh.addEventListener('click',() => void history(id).catch(report)); content.append(refresh);
    if (!result.proposals.length) {
      content.append(node('p','No agent proposal yet. Your source remains saved; provider failures do not remove it.'));
      const latest = result.payloads.at(-1); if (latest) { const open = node('button','Show reviewed payload for agent'); open.type = 'button'; open.addEventListener('click',() => renderPayload(latest)); content.append(open); }
    }
    for (const proposal of [...result.proposals].reverse()) {
      const section = node('section'); section.append(node('h3',`Suggested directions · ${new Date(proposal.createdAt).toLocaleString()}`),node('p',`Source: ${proposal.resumeId} · payload ${proposal.payloadId} · host ${proposal.metadata.agent}${proposal.metadata.model ? ` · model ${proposal.metadata.model}` : ''}`));
      const list = node('ul'); for (const experience of proposal.experiences) list.append(node('li',experience.text)); section.append(list);
      for (const track of proposal.tracks) { section.append(node('h4',track.name),node('p',track.rationale)); for (const quote of track.evidence) section.append(node('blockquote',quote)); }
      const review = node('button','Choose directions & answer onboarding'); review.type = 'button'; review.addEventListener('click',() => onboarding(proposal)); section.append(review); content.append(section);
    }
    for (const link of result.profiles) { const open = node('button',`Review linked profile draft v${link.profileVersion}`); open.type = 'button'; open.className = 'quiet'; open.addEventListener('click',() => window.dispatchEvent(new CustomEvent('careervista:profile-draft',{detail:link.profileVersion}))); content.append(open); }
  }
  function onboarding(proposal: ResumeProposal) {
    content.replaceChildren(); content.append(node('h2','What do you want next?'),node('p','Past work is evidence, not a commitment. Choose only directions you want to explore; edit factual experience and supply aspirations in your own words. Saving creates a draft for separate approval.'));
    const form = node('form'); const name = field(form,'Profile name','My job search'); name.required = true;
    const experience = field(form,'Demonstrated experience · correct facts only, one per line',proposal.experiences.map(item => item.text).join('\n'),true);
    const aspirations = field(form,'What would you like next? (one goal per line; blank means undecided)','',true);
    const prefs = node('details'); prefs.append(node('summary','Optional working preferences · unknown by default')); form.append(prefs); const prefGetters:(() => Preference)[]=[];
    for (const [key,title] of Object.entries(dimensions)) {
      const row = node('div'); row.className = 'preference-row'; const label = node('label',title); const kind = node('select');
      for (const [value,text] of [['undecided','Undecided'],['soft','Soft preference'],['hard','Hard requirement']]) { const option = node('option',text); option.value=value!; kind.append(option); } label.append(kind); row.append(label);
      const value = field(row,`${title} value`); value.disabled=true;
      kind.addEventListener('change',() => { value.disabled=kind.value==='undecided'; value.required=!value.disabled; }); prefs.append(row);
      prefGetters.push(() => ({key,kind:kind.value as PreferenceKind,value:kind.value==='undecided' ? null : value.value.trim()}));
    }
    const trackGetters:(() => SearchTrack | null)[]=[];
    for (const suggestion of proposal.tracks) {
      const section=node('fieldset'); section.append(node('legend',suggestion.name)); const selected=check(section,'Explore this direction (explicit choice)');
      section.append(node('p',suggestion.rationale)); const trackName=field(section,'Track name',suggestion.name); const titles=field(section,'Title variants · one per line',suggestion.titles.join('\n'),true); const keywords=field(section,'Keyword variants · one per line',suggestion.keywords.join('\n'),true); form.append(section);
      trackGetters.push(() => selected.checked ? {id:suggestion.id,name:trackName.value,titles:lines(titles.value),keywords:lines(keywords.value),preferences:[]} : null);
    }
    const confirmed=check(form,'I reviewed these facts, selected directions, and supplied my aspirations and preferences.'); confirmed.required=true;
    const submit=node('button','Create linked profile draft'); submit.type='submit'; form.append(submit); content.append(form); const operationId=crypto.randomUUID();
    form.addEventListener('submit',event => { event.preventDefault(); submit.disabled=true; const profile:ProfileInput={name:name.value,demonstratedExperience:lines(experience.value),aspirations:lines(aspirations.value),preferences:prefGetters.map(get => get()),tracks:trackGetters.map(get => get()).filter((item): item is SearchTrack => item!==null)};
      void api<Profile>('/resume-profile-drafts',{operationId,proposalId:proposal.id,profile,confirmedReview:confirmed.checked}).then(draft => { message(`Linked draft v${draft.version} saved. Review effective preferences and explicitly approve in Profile & search tracks.`); window.dispatchEvent(new CustomEvent('careervista:profile-draft',{detail:draft.version})); }).catch(report).finally(() => {submit.disabled=false;});
    });
  }
}
