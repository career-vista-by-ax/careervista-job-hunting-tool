import { installWorkspaceUI } from './workspace-ui.ts';
import { showAssessments } from './assessments-ui.ts';
import { showCompensation } from './compensation-ui.ts';
import { showExtraction } from './extraction-ui.ts';
import { showCompany } from './company-ui.ts';
import { mountBackupTools } from './backup-ui.ts';
import { mountDataTools } from './datalifecycle-ui.ts';
import type { ApplicationEvent } from '../applications.ts';
import type { JobDetail } from '../app.ts';
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const message = element('message');
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
    const fitSection = document.createElement('details'); fitSection.open = true; fitSection.append(text('summary', 'Why this job is here')); detail.append(fitSection);
    const applicationSection = document.createElement('details'); applicationSection.append(text('summary', 'Application history')); detail.append(applicationSection);
    const listingSection = document.createElement('details'); listingSection.append(text('summary', 'Structured listing & compensation')); detail.append(listingSection);
    const availabilitySection = document.createElement('details'); availabilitySection.append(text('summary', 'Availability & check history')); detail.append(availabilitySection);
    const companySection = document.createElement('details'); companySection.append(text('summary', 'Company research & source reports')); detail.append(companySection);
    const evidenceSection = document.createElement('details'); evidenceSection.append(text('summary', `Original saved evidence (${job.observations.length})`)); detail.append(evidenceSection);
    const linkedSources = new Set<string>();
    for (const observation of job.observations) {
      const meta = text('p', `${observation.source} · Captured ${new Date(observation.capturedAt).toLocaleString()}`, 'evidence-meta');
      const link = text('a', 'Open original listing'); link.href = observation.sourceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
      if (!linkedSources.has(observation.sourceUrl)) { overview.append(link.cloneNode(true)); linkedSources.add(observation.sourceUrl); }
      evidenceSection.append(meta, link, text('pre', observation.text, 'evidence'));
    }
    await Promise.all([
      showCompany(companySection, id, true),
      showAssessments(fitSection, id, job.observations),
      showHistory(applicationSection, availabilitySection, id),
      showCompensation(id, listingSection, undefined, true),
      showExtraction(listingSection, id, true),
    ]);
  } catch (error) {
    if (selectedId === id) { const heading = text('h2', 'Job unavailable'); heading.id = 'detail-title'; detail.replaceChildren(heading, text('p', error instanceof Error ? error.message : 'Close and try again.', 'error')); }
  }
}
const workspace = installWorkspaceUI(showDetail);
async function refresh() { await workspace.refresh(); message.textContent = ''; }
element('close-detail').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  const closedId = selectedId; selectedId = undefined;
  void refresh().then(() => {
    const button = document.querySelector<HTMLButtonElement>(`[data-job-id="${CSS.escape(closedId ?? '')}"]`);
    (button ?? element('job-search')).focus();
  }).catch(showError);
});
void refresh().catch(showError);

async function showHistory(applications: HTMLElement, availability: HTMLElement, id: string) {
  const [events, checks, review] = await Promise.all([
    api<{events: ApplicationEvent[]}>(`/jobs/${encodeURIComponent(id)}/applications`),
    api<{ status: string; checks: { result: string; checkedAt: string; quote?: string }[] }>(`/jobs/${encodeURIComponent(id)}/availability`),
    api<{ decision: string }>(`/jobs/${encodeURIComponent(id)}/reviews`),
  ]);
  applications.append(text('p', `Your decision: ${review.decision}. Tell your agent when you want to save, dismiss or record application progress.`));
  if (!events.events.length) applications.append(text('p', 'No application recorded.'));
  for (const event of events.events) applications.append(text('p', `${event.status.replaceAll('_', ' ')} · ${new Date(event.occurredAt).toLocaleDateString()}${event.note ? ` · ${event.note}` : ''}`));
  availability.append(text('p', checks.status.replaceAll('_', ' ')));
  for (const check of checks.checks) availability.append(text('p', `${check.result.replaceAll('_', ' ')} · ${new Date(check.checkedAt).toLocaleDateString()}${check.quote ? ` · ${check.quote}` : ''}`));
}

const setup = element<HTMLDialogElement>('agent-dialog');
element('agent-help').addEventListener('click', () => setup.showModal());
element('close-agent').addEventListener('click', () => setup.close());
const prompt = `Use CareerVista at ${location.origin} and the careervista-capture skill. Help me find my next role in Australia. Clarify my goals and expand related titles and search terms. If I share a resume, read it with your document tools and confirm my competitive strengths. Ask one question at a time with recommendations, suggested choices and custom input. Clarify Australian location, work arrangement, AUD base/super, equity, leave, benefits and review priorities, then ask which sites to search. Agree the search scope and budget with me, then search, analyse and save evidence-backed results and shortlist reasons. Ask useful follow-up questions here. When the batch is ready, send me to the jobs table to browse. Do not submit applications or send messages.`;
element('agent-prompt').textContent = prompt;
element('copy-agent-prompt').addEventListener('click', () => {
  void navigator.clipboard.writeText(prompt).then(() => { element('agent-copy-status').textContent = 'Copied. Paste it into your agent conversation.'; }).catch(() => { element('agent-copy-status').textContent = 'Copy is unavailable. Select the prompt above and copy it manually.'; });
});
mountBackupTools(element('local-data'));
mountDataTools(element('local-data'));
// Keep the presentation current while the external agent saves its work.
setInterval(() => { if (!document.hidden && !dialog.open && !document.activeElement?.closest('#jobs-table')) void refresh().catch(showError); }, 15_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && !dialog.open) void refresh().catch(showError); });
window.addEventListener('careervista:open-job', event => { void showDetail((event as CustomEvent<string>).detail); });
