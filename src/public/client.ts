import { mountDataTools } from './datalifecycle-ui.ts';
import { installRunsUI } from './runs-ui.ts';
import { showAssessments } from './assessments-ui.ts';
import { showCompensation } from './compensation-ui.ts';
import { mountBackupTools } from './backup-ui.ts';

import { installProfilesUI } from './profiles-ui.ts';
import { showExtraction } from './extraction-ui.ts';
import { showApplications, showApplicationAttention } from './applications-ui.ts';
import type { Job, JobDetail } from '../app.ts';
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const message = element('message');
const form = element<HTMLFormElement>('listing-form');
const entry = element('entry');
let ingestionId = crypto.randomUUID();
let selectedId: string | undefined;
let jobs: Job[] = [];
let sortKey: 'title' | 'company' | 'location' | 'createdAt' = 'createdAt';
let sortDirection = -1;
const dialog = element<HTMLDialogElement>('job-dialog');
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? 'The operation failed. Try again.');
  return result as T;
}
function text<K extends keyof HTMLElementTagNameMap>(tag: K, content: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.textContent = content;
  if (className) node.className = className;
  return node;
}
function showError(error: unknown) { message.textContent = error instanceof Error ? error.message : 'Could not complete this operation. Try again.'; message.className = 'error'; }
async function showDetail(id: string) {
  selectedId = id;
  const detail = element('detail');
  const loading = text('h2', 'Loading job…'); loading.id = 'detail-title'; detail.replaceChildren(loading);
  if (!dialog.open) dialog.showModal();
  try {
    const job = await api<JobDetail>(`/jobs/${encodeURIComponent(id)}`);
    if (selectedId !== id || !dialog.open) return;
    detail.replaceChildren();
    const heading = text('h2', job.title); heading.id = 'detail-title'; detail.append(heading);
    detail.append(text('p', `${job.company}${job.location ? ` · ${job.location}` : ''}`, 'muted'));
    await showCompensation(id, detail);
    await showExtraction(detail, id);
    await showAssessments(detail, id, job.observations);
    for (const observation of job.observations) {
      const meta = text('p', `${observation.source} · Captured ${new Date(observation.capturedAt).toLocaleString()}`, 'evidence-meta');
      const link = text('a', 'Open original listing ↗'); link.href = observation.sourceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
      detail.append(meta, link, text('pre', observation.text, 'evidence'));
    }
    await showApplications(id, detail);
  } catch (error) {
    if (selectedId === id) { const heading = text('h2', 'Job unavailable'); heading.id = 'detail-title'; detail.replaceChildren(heading, text('p', error instanceof Error ? error.message : 'Close and try again.', 'error')); }
  }
}
function renderRows() {
  const query = element<HTMLInputElement>('job-search').value.toLocaleLowerCase().trim();
  const visible = jobs.filter(job => [job.title, job.company, job.location ?? ''].some(value => value.toLocaleLowerCase().includes(query)));
  visible.sort((a, b) => sortDirection * (a[sortKey] ?? '').localeCompare(b[sortKey] ?? '', undefined, { numeric: true, sensitivity: 'base' }));
  element('count').textContent = `${jobs.length} saved`;
  element('empty').hidden = visible.length > 0;
  element('empty').querySelector('h2')!.textContent = jobs.length ? 'No matching jobs' : 'No saved jobs yet';
  element('empty').querySelector('p')!.textContent = jobs.length ? 'Try a different title, company or location.' : 'Save a listing, or ask your agent to collect a batch.';
  element('results-summary').textContent = `${visible.length} of ${jobs.length} jobs · Select a row for details`;
  const rows = element('job-rows'); rows.replaceChildren();
  for (const job of visible) {
    const row = document.createElement('tr'); const title = document.createElement('td');
    const button = text('button', job.title, 'job-title'); button.type = 'button'; button.dataset.jobId = job.id;
    button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-label', `View ${job.title} at ${job.company}`);
    button.addEventListener('click', () => void showDetail(job.id)); title.append(button);
    row.addEventListener('click', event => { if (!(event.target instanceof Element) || !event.target.closest('button, a')) button.click(); });
    row.append(title, text('td', job.company), text('td', job.location ?? 'Unknown'), text('td', (job.sources ?? []).join(', ')), text('td', new Date(job.createdAt).toLocaleDateString())); rows.append(row);
  }
}
async function refresh() {
  jobs = await api<Job[]>('/jobs');
  renderRows();
}
element('close-detail').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  const button = document.querySelector<HTMLButtonElement>(`[data-job-id="${CSS.escape(selectedId ?? '')}"]`);
  selectedId = undefined; button?.focus();
});
element('job-search').addEventListener('input', renderRows);
document.querySelectorAll<HTMLButtonElement>('[data-sort]').forEach(button => button.addEventListener('click', () => {
  const key = button.dataset.sort as typeof sortKey;
  sortDirection = sortKey === key ? -sortDirection : 1; sortKey = key;
  document.querySelectorAll('th[aria-sort]').forEach(heading => heading.setAttribute('aria-sort', 'none'));
  button.closest('th')?.setAttribute('aria-sort', sortDirection === 1 ? 'ascending' : 'descending'); renderRows();
}));
element('show-form').addEventListener('click', () => { entry.hidden = false; form.querySelector('input')?.focus(); });
element('hide-form').addEventListener('click', () => { entry.hidden = true; element('show-form').focus(); });
form.addEventListener('submit', async event => {
  event.preventDefault(); const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  submit.disabled = true; submit.textContent = 'Saving…';
  const fields = Object.fromEntries(new FormData(form));
  const capturedAt = form.dataset.capturedAt ?? new Date().toISOString(); form.dataset.capturedAt = capturedAt;
  try {
    const result = await api<{ job: Job }>('/observations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fields, capturedAt, ingestionId, context: { method: 'manual-paste' } }) });
    ingestionId = crypto.randomUUID(); delete form.dataset.capturedAt;
    form.reset(); entry.hidden = true;
    await refresh(); await showDetail(result.job.id);
    message.className = ''; message.textContent = 'Listing saved. Its original evidence is available offline.';
    element('close-detail').focus();
  } catch (error) { showError(error); }
  finally { submit.disabled = false; submit.textContent = 'Save evidence'; }
});
// Editing after a failed attempt creates a new operation; unchanged retries retain their identifier.
form.addEventListener('input', () => { ingestionId = crypto.randomUUID(); delete form.dataset.capturedAt; });
void refresh().catch(showError);

installProfilesUI();
installRunsUI();
window.addEventListener('careervista:open-job', event => { void showDetail((event as CustomEvent<string>).detail); });
void showApplicationAttention();

mountBackupTools();

mountDataTools();
