import { installProfilesUI } from './profiles-ui.ts';
import type { Job, JobDetail } from '../app.ts';
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const message = element('message');
const form = element<HTMLFormElement>('listing-form');
const entry = element('entry');
let ingestionId = crypto.randomUUID();
let selectedId: string | undefined;
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
  try {
    const job = await api<JobDetail>(`/jobs/${encodeURIComponent(id)}`);
    selectedId = id;
    document.querySelectorAll<HTMLButtonElement>('[data-job-id]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.jobId === id)));
    const detail = element('detail'); detail.replaceChildren();
    detail.append(text('p', 'ORIGINAL EVIDENCE', 'eyebrow'));
    const heading = text('h2', job.title); heading.id = 'detail-title'; detail.append(heading);
    detail.append(text('p', `${job.company}${job.location ? ` · ${job.location}` : ''}`, 'muted'));
    for (const observation of job.observations) {
      const meta = text('p', `${observation.source} · Captured ${new Date(observation.capturedAt).toLocaleString()}`, 'evidence-meta');
      const link = text('a', 'Open original listing ↗'); link.href = observation.sourceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
      detail.append(meta, link, text('pre', observation.text, 'evidence'));
    }
  } catch (error) { showError(error); }
}
async function refresh() {
  const jobs = await api<Job[]>('/jobs');
  element('count').textContent = `${jobs.length} saved`;
  element('empty').hidden = jobs.length > 0;
  element('jobs-table').hidden = jobs.length === 0;
  const rows = element('job-rows'); rows.replaceChildren();
  for (const job of jobs) {
    const row = document.createElement('tr'); const title = document.createElement('td');
    const button = text('button', job.title, 'job-title'); button.type = 'button'; button.dataset.jobId = job.id;
    button.setAttribute('aria-pressed', String(selectedId === job.id));
    button.addEventListener('click', () => void showDetail(job.id)); title.append(button);
    row.append(title, text('td', job.company), text('td', job.location ?? 'Unknown'), text('td', new Date(job.createdAt).toLocaleDateString())); rows.append(row);
  }
}
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
    element('show-form').focus();
  } catch (error) { showError(error); }
  finally { submit.disabled = false; submit.textContent = 'Save evidence'; }
});
// Editing after a failed attempt creates a new operation; unchanged retries retain their identifier.
form.addEventListener('input', () => { ingestionId = crypto.randomUUID(); delete form.dataset.capturedAt; });
void refresh().catch(showError);

installProfilesUI();
