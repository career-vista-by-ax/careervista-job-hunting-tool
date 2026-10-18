import type { ResearchRun } from '../runs.ts';
import type { Profile } from '../profiles.ts';
function node<K extends keyof HTMLElementTagNameMap>(tag: K, value = '') { const item = document.createElement(tag); item.textContent = value; return item; }
async function api<T>(path: string, input?: unknown): Promise<T> {
 const response = await fetch(`/api/v1${path}`,input === undefined ? undefined : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
 const result = await response.json(); if (!response.ok) throw new Error(result.error?.message ?? 'Run operation failed. Refresh and retry.'); return result as T;
}
const readable = (value: string) => value.replaceAll('-',' ');
export function installRunsUI() {
 const panel = node('section'); panel.id = 'runs-panel'; panel.hidden = true; panel.setAttribute('aria-label','Research runs');
 const toggle = node('button','Research runs'); toggle.type = 'button'; toggle.className = 'quiet'; toggle.setAttribute('aria-expanded','false');
 (document.querySelector('.toolbar-actions') ?? document.querySelector('.toolbar'))!.append(toggle);
 document.querySelector('.toolbar')!.after(panel);
 const status = node('p'); status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
 const content = node('div'); panel.append(status,content);
 let selected: string | null = null;
 const report = (error: unknown) => { status.textContent = error instanceof Error ? error.message : 'Could not load research runs.'; status.className = 'error'; };
 async function load() {
  status.textContent = 'Loading runs…'; status.className = '';
  const [runs,profile] = await Promise.all([api<ResearchRun[]>('/runs'),api<Profile | null>('/profiles/active')]);
  content.replaceChildren(); content.append(node('h2','Research runs'));
  content.append(node('p','Choose approved tracks, sources and limits, then give your agent the saved run. Refresh to see its latest checkpoints.'));
  const refresh = node('button','Refresh runs'); refresh.type = 'button'; refresh.className = 'quiet'; refresh.addEventListener('click',() => void load().catch(report)); content.append(refresh);
  if (!profile) content.append(node('p','Approve a profile and search tracks before starting a run. Open Profile & search tracks to get started.'));
  else renderCreate(profile);
  if (!runs.length) content.append(node('p','No research runs yet. Saved listings remain available in your jobs table.'));
  for (const run of runs) {
   const details = node('details'); details.open = selected === run.id;
   const summary = node('summary',`${new Date(run.createdAt).toLocaleString()} · ${readable(run.status)} · ${run.counters.newJobs}/${run.limit} new jobs`); details.append(summary);
   details.addEventListener('toggle',() => { if (details.open) selected = run.id; });
   details.append(node('p',`Profile revision ${run.profileVersion} · Tracks: ${run.trackIds.join(', ')} · Sources: ${run.sources.join(', ')}`));
   const counts = run.counters;
   details.append(node('p',`${counts.pending} pending · ${counts.working} working · ${counts.collected} captured · ${counts.assessed} assessed · ${counts.excluded} excluded · ${counts.duplicate} duplicate · ${counts.failed} failed`));
   details.append(node('p','Stage counts overlap: assessed jobs remain captured. Duplicate and failed uncaptured work release collection slots. Partial saved jobs count toward the new-job limit.'));
   const cost = run.costs;
   details.append(node('p',`${cost.currency} ${cost.known.toFixed(6)} known cost · ${cost.estimatedUnavailable.toFixed(6)} estimated (actual unavailable) · ${cost.reserved.toFixed(6)} reserved · ${cost.remaining.toFixed(6)} remaining of ${run.budget.amount}`));
   details.append(node('p','CareerVista authorizes bounded work using reserved estimates. Your agent host owns provider billing and may incur other costs outside this run.'));
   if (run.waiting) {
    details.append(node('p',`Waiting on ${run.waiting.workKey}. Complete ${run.status === 'waiting-user-verification' ? 'verification' : 'sign-in'} directly in your agent’s existing browser session, then resume. Never enter website passwords here.`));
    details.append(node('p',`Waiting page: ${run.waiting.pageUrl}. Continue in the browser session already opened by your agent.`));
    if (run.status === 'session-expired') details.append(node('p','The agent must open a new browser session and record a sign-in checkpoint before this run can resume.'));
   }
   for (const error of run.errors.slice(-5)) details.append(node('p',`${error.workKey ? `${error.workKey}: ` : ''}${error.message}`));
   const actions = node('div'); actions.className = 'run-actions'; details.append(actions);
   async function control(action: string, extra: object = {}) {
    await api(`/runs/${encodeURIComponent(run.id)}/control`,{operationId:crypto.randomUUID(),action,...extra}); selected = run.id; await load();
   }
   if (!['cancelled','completed'].includes(run.status)) {
    for (const [action,label] of [['pause','Pause'],['stop','Stop'],['cancel','Cancel run'],['complete','Finish run']]) {
     const button = node('button',label); button.type = 'button'; button.className = 'quiet'; button.disabled = action === 'complete' && (counts.pending > 0 || counts.working > 0);
     button.addEventListener('click',async () => { button.disabled = true; try { await control(action!); } catch (error) { report(error); button.disabled = false; } }); actions.append(button);
    }
    if (run.status !== 'running' && run.status !== 'session-expired') {
     const button = node('button',run.waiting ? 'I completed sign-in / verification — resume' : 'Resume'); button.type = 'button';
     button.addEventListener('click',async () => { button.disabled = true; try { await control('resume',run.waiting ? {sessionRef:run.waiting.sessionRef,userConfirmed:true} : {}); } catch (error) { report(error); button.disabled = false; } }); actions.append(button);
    }
    const budgetForm = node('form'); budgetForm.className = 'run-budget'; const label = node('label',`Update ${run.budget.currency} budget`), amount = node('input'); amount.type = 'number'; amount.min = '0'; amount.max = '1000000'; amount.step = '0.000001'; amount.required = true; amount.value = String(run.budget.amount); label.append(amount); budgetForm.append(label);
    const save = node('button','Set budget & pause'); save.type = 'submit'; save.className = 'quiet'; budgetForm.append(save); details.append(budgetForm);
    budgetForm.addEventListener('submit',async event => { event.preventDefault(); save.disabled = true; try { await control('set-budget',{amount:Number(amount.value),currency:run.budget.currency}); } catch (error) { report(error); save.disabled = false; } });
   }
   details.append(node('p',`Run reference: ${run.id}. Use the version 1 run interface in your configured agent.`));
   if (run.work.length) {
    const wrap = node('div'); wrap.className = 'table-wrap'; const table = node('table'), head = node('thead'), row = node('tr');
    for (const name of ['Work','Track / source','Checkpoint','Saved job']) { const th = node('th',name); th.scope = 'col'; row.append(th); } head.append(row); table.append(head);
    const body = node('tbody');
    for (const work of run.work) {
     const row = node('tr'); row.append(node('td',work.deleted ? 'Deleted job' : work.workKey),node('td',`${work.trackId} / ${work.source}`),node('td',`${readable(work.status)}${work.errorCode ? ` · ${readable(work.errorCode)}` : ''}`));
     const saved = node('td',work.deleted ? 'Permanently deleted' : work.jobId ? 'Evidence saved' : 'Not captured');
     if (work.jobId) { const button = node('button','Open job'); button.type = 'button'; button.className = 'quiet'; button.addEventListener('click',() => window.dispatchEvent(new CustomEvent('careervista:open-job',{detail:work.jobId}))); saved.replaceChildren(button); }
     row.append(saved); body.append(row);
    }
    table.append(body); wrap.append(table); details.append(wrap);
   }
   content.append(details);
  }
  const storage = await api<{totalBytes:number}>('/runs/storage'); const storageBox = node('div'); storageBox.className = 'run-storage';
  storageBox.append(node('p',`Disposable run storage: ${(storage.totalBytes / 1048576).toFixed(2)} MiB. Only run cache, temporary files and logs are cleaned. Evidence, profiles and browser sessions are retained.`));
  const clean = node('button','Clean stale run files'); clean.type = 'button'; clean.className = 'quiet'; clean.addEventListener('click',async () => { clean.disabled = true; try { const result = await api<{removedBytes:number}>('/runs/storage/cleanup',{}); await load(); status.textContent = `Removed ${(result.removedBytes / 1048576).toFixed(2)} MiB of disposable run files.`; } catch (error) { report(error); clean.disabled = false; } }); storageBox.append(clean); content.append(storageBox);
  status.textContent = '';
 }
 function renderCreate(profile: Profile) {
  const details = node('details'); details.append(node('summary','Start a research run'));
  const form = node('form'); const tracks = node('fieldset'); tracks.append(node('legend',`Approved tracks · ${profile.name}`));
  for (const track of profile.tracks) { const label = node('label'), input = node('input'); input.type = 'checkbox'; input.name = 'track'; input.value = track.id; input.checked = true; label.append(input,document.createTextNode(track.name)); tracks.append(label); } form.append(tracks);
  const field = (name: string, value: string, multiline = false) => { const label = node('label',name), input = multiline ? node('textarea') : node('input'); input.value = value; input.required = true; label.append(input); form.append(label); return input; };
  const sources = field('Selected source identifiers (one per line)','seek\nlinkedin\nemployer',true);
  const limit = field('Maximum new jobs (suggested: 25)','25') as HTMLInputElement; limit.type = 'number'; limit.min = '1'; limit.max = '500';
  const amount = field('AI spending cap (conservative estimates required)','') as HTMLInputElement; amount.type = 'number'; amount.min = '0'; amount.max = '1000000'; amount.step = '0.000001';
  const currency = field('Budget currency','AUD') as HTMLInputElement; currency.pattern = '[A-Z]{3}'; currency.maxLength = 3;
  form.append(node('p','Creating a run saves its boundaries and queue. Your configured browser-capable agent performs collection; no agent or model is launched automatically.'));
  const submit = node('button','Create run'); submit.type = 'submit'; form.append(submit); let requestId = crypto.randomUUID();
  form.addEventListener('input',() => { requestId = crypto.randomUUID(); });
  form.addEventListener('submit',async event => {
   event.preventDefault(); submit.disabled = true;
   try { const run = await api<ResearchRun>('/runs',{requestId,profileVersion:profile.version,trackIds:Array.from(form.querySelectorAll<HTMLInputElement>('input[name=track]:checked')).map(input => input.value),sources:sources.value.split('\n').map(value => value.trim()).filter(Boolean),limit:Number(limit.value),budget:{amount:Number(amount.value),currency:currency.value}}); selected = run.id; await load(); status.textContent = 'Run created. Give its reference and the run interface to your agent.'; }
   catch (error) { report(error); submit.disabled = false; }
  }); details.append(form); content.append(details);
 }
 toggle.addEventListener('click',() => { panel.hidden = !panel.hidden; toggle.setAttribute('aria-expanded',String(!panel.hidden)); if (!panel.hidden) void load().catch(report); });
}
