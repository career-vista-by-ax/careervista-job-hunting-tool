import { showReconciliation } from './reconciliation-ui.ts';
import {installCustomSourcesUI} from './custom-sources-ui.ts';
import {showCompany} from './company-ui.ts';
import { installWorkspaceUI } from './workspace-ui.ts';
import { showDestinations } from './collection-ui.ts';
import { installResumeUI } from './resume-ui.ts';
import { showAvailability } from './availability-ui.ts';
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
    const overview = document.createElement('div'); overview.className = 'detail-overview'; detail.append(overview);
    const fitSection = document.createElement('details'); fitSection.open = true; fitSection.append(text('summary', 'Fit, concerns & follow-up questions')); detail.append(fitSection);
    const applicationSection = document.createElement('details'); applicationSection.append(text('summary', 'Application history & actions')); detail.append(applicationSection);
    const listingSection = document.createElement('details'); listingSection.append(text('summary', 'Structured listing & compensation')); detail.append(listingSection);
    const availabilitySection = document.createElement('details'); availabilitySection.append(text('summary', 'Availability & check history')); detail.append(availabilitySection);
    const companySection = document.createElement('details'); companySection.append(text('summary', 'Company research & source reports')); detail.append(companySection);
    const reconciliationSection = document.createElement('details'); reconciliationSection.append(text('summary', 'Duplicate review, revisions & source conflicts')); detail.append(reconciliationSection);
    const evidenceSection = document.createElement('details'); evidenceSection.append(text('summary', `Original saved evidence (${job.observations.length})`)); detail.append(evidenceSection);
    for (const observation of job.observations) {
      const meta = text('p', `${observation.source} · Captured ${new Date(observation.capturedAt).toLocaleString()}`, 'evidence-meta');
      const link = text('a', 'Open original listing'); link.href = observation.sourceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
      overview.append(link.cloneNode(true));
      evidenceSection.append(meta, link, text('pre', observation.text, 'evidence'));
    }
    await Promise.all([
      showReconciliation(reconciliationSection, id, () => { void refresh(); void showDetail(id); }),
      showCompany(companySection, id),
      showDestinations(applicationSection, id),
      showAssessments(fitSection, id, job.observations),
      showApplications(id, applicationSection),
      showCompensation(id, listingSection),
      showExtraction(listingSection, id),
      showAvailability(availabilitySection, id, job.observations, refresh),
    ]);
  } catch (error) {
    if (selectedId === id) { const heading = text('h2', 'Job unavailable'); heading.id = 'detail-title'; detail.replaceChildren(heading, text('p', error instanceof Error ? error.message : 'Close and try again.', 'error')); }
  }
}
const workspace = installWorkspaceUI(showDetail);
async function refresh() { await workspace.refresh(); }
element('close-detail').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  const closedId = selectedId; selectedId = undefined;
  void refresh().then(() => {
    const button = document.querySelector<HTMLButtonElement>(`[data-job-id="${CSS.escape(closedId ?? '')}"]`);
    (button ?? element('job-search')).focus();
  }).catch(showError);
});
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
installResumeUI();
installRunsUI();
window.addEventListener('careervista:open-job', event => { void showDetail((event as CustomEvent<string>).detail); });
void showApplicationAttention();

mountBackupTools();

mountDataTools();

installCustomSourcesUI();
