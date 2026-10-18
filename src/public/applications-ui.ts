import type { ApplicationEvent, ApplicationStatus } from '../applications.ts';
function node<K extends keyof HTMLElementTagNameMap>(tag: K, value = '') { const element = document.createElement(tag); element.textContent = value; return element; }
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/v1${path}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const data = await response.json(); if (!response.ok) throw new Error(data.error?.message ?? 'Application update failed.'); return data as T;
}
export async function showApplications(jobId: string, detail: HTMLElement) {
  const section = node('section'); section.setAttribute('aria-label', 'Application history');
  detail.append(section);
  const error = node('p'); error.setAttribute('role', 'status');
  try {
    const history = await request<{ status: string | null; followUpOn: string | null; events: ApplicationEvent[] }>(`/jobs/${encodeURIComponent(jobId)}/applications`);
    section.append(node('h3', 'Application history'), node('p', `Current status: ${history.status ?? 'No application recorded'}`));
    section.append(node('p', 'Opening a listing or application page does not record an application. Record progress explicitly after taking action yourself.'));
    if (history.followUpOn) section.append(node('p', `Follow-up date: ${history.followUpOn}`));
    const timeline = node('ol');
    for (const event of history.events) {
      const item = node('li', `${event.status.replaceAll('_', ' ')} · ${new Date(event.occurredAt).toLocaleString()}${event.note ? ` · ${event.note}` : ''}`);
      for (const document of event.documents) item.append(node('p', `${document.kind}: ${document.label} — ${document.reference}`));
      if (event.followUpOn) item.append(node('p', `Follow up: ${event.followUpOn}`));
      timeline.append(item);
    }
    section.append(timeline);
    const form = node('form');
    function field(labelText: string, input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) { const label = node('label', labelText); label.append(input); form.append(label); return input; }
    const status = node('select');
    for (const value of ['applied', 'interview', 'offer', 'accepted', 'rejected', 'withdrawn', 'follow_up']) { const option = node('option', value.replaceAll('_', ' ')); option.value = value; status.append(option); }
    field('Progress to record', status);
    const occurred = node('input'); occurred.type = 'datetime-local'; occurred.required = true;
    const now = new Date(); occurred.value = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16); field('When it happened', occurred);
    const note = field('Notes (optional)', node('textarea'));
    const followUp = node('input'); followUp.type = 'date'; followUp.value = history.followUpOn ?? ''; field('Follow-up date (blank clears reminder)', followUp);
    const documentKind = node('select'); for (const kind of ['resume', 'letter', 'other']) { const option = node('option', kind); option.value = kind; documentKind.append(option); } field('Existing document type', documentKind);
    const documentLabel = field('Document version label (optional)', node('input'));
    const reference = field('Existing document path, URL or stable reference (optional)', node('input'));
    const submit = node('button', 'Record application progress'); submit.type = 'submit'; form.append(submit, error);
    let operationId = crypto.randomUUID(); let timestamp: string | undefined;
    form.addEventListener('input', () => { operationId = crypto.randomUUID(); timestamp = undefined; });
    form.addEventListener('submit', async event => {
      event.preventDefault(); submit.disabled = true;
      try {
        if (Boolean(reference.value.trim()) !== Boolean(documentLabel.value.trim())) throw new Error('Provide both the document reference and version label.');
        timestamp ??= new Date(occurred.value).toISOString();
        await request(`/jobs/${encodeURIComponent(jobId)}/applications`, { operationId, status: status.value as ApplicationStatus, occurredAt: timestamp, note: note.value, followUpOn: followUp.value || null, documents: reference.value.trim() ? [{ kind: documentKind.value, reference: reference.value, label: documentLabel.value }] : [] });
        section.remove(); await showApplications(jobId, detail); await showApplicationAttention();
      } catch (problem) { error.textContent = problem instanceof Error ? problem.message : 'Could not save application history.'; }
      finally { submit.disabled = false; }
    });
    section.append(form);
  } catch (problem) { error.textContent = problem instanceof Error ? problem.message : 'Application history unavailable.'; section.append(error); }
}
export async function showApplicationAttention() {
  let summary = document.getElementById('application-attention');
  if (!summary) { summary = node('section'); summary.id = 'application-attention'; summary.setAttribute('aria-label', 'Applications requiring attention'); document.querySelector('main')?.prepend(summary); }
  try {
    const today = new Date(); const date = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const attention = await request<{ job: { id: string; title: string; company: string }; followUpOn: string }[]>(`/applications/attention?on=${date}`);
    summary.replaceChildren(node('h2', 'Applications requiring attention'));
    if (!attention.length) summary.append(node('p', 'No application follow-ups due.'));
    for (const item of attention) {
      const button = node('button', `${item.job.title} · ${item.job.company} · Follow up ${item.followUpOn}`); button.type = 'button';
      button.addEventListener('click', () => { document.querySelector<HTMLButtonElement>(`[data-job-id="${CSS.escape(item.job.id)}"]`)?.click(); }); summary.append(button);
    }
  } catch (error) { summary.textContent = error instanceof Error ? error.message : 'Follow-up summary unavailable.'; }
}
