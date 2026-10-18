import type { Analysis, AnalysisFailure, ExtractedField, ListingDetails } from '../extraction.ts';
const names: Record<keyof ListingDetails, string> = { title: 'Title', company: 'Company', requirements: 'Requirements', benefits: 'Benefits', location: 'Location', workArrangement: 'Work arrangement', employment: 'Employment details' };
function node<K extends keyof HTMLElementTagNameMap>(tag: K, value: string) { const el = document.createElement(tag); el.textContent = value; return el; }
export async function showExtraction(container: HTMLElement, jobId: string) {
  const section = document.createElement('section'); container.append(section);
  section.append(node('h3', 'Structured listing details'));
  const status = node('p', 'Loading analysis…'); status.setAttribute('role', 'status'); section.append(status);
  try {
    const response = await fetch(`/api/v1/jobs/${encodeURIComponent(jobId)}/analyses`);
    if (!response.ok) throw new Error('Could not load structured details. Retry by reopening this job.');
    const history = await response.json() as { analyses: Analysis[]; failures: AnalysisFailure[] };
    const latest = history.analyses.at(-1);
    status.textContent = latest ? `Analysis by ${latest.metadata.agent}${latest.metadata.model ? ` · ${latest.metadata.model}` : ''} · version ${latest.metadata.analysisVersion}` : 'No analysis yet. Save evidence, then ask your configured agent to use the CareerVista capture skill. No model key is needed in this app.';
    for (const failure of history.failures) section.append(node('p', failure.message));
    if (!latest) return;
    const list = document.createElement('dl'); section.append(list);
    for (const [key, label] of Object.entries(names)) {
      const field = latest.details[key as keyof ListingDetails]; list.append(node('dt', label), node('dd', field.status === 'unknown' ? 'Unknown — not stated in saved evidence' : field.value!));
      for (const ref of field.evidence) list.append(node('dd', `Evidence ${ref.observationId}: “${ref.quote}”`));
    }
    const older = document.createElement('details'); older.append(node('summary', `${history.analyses.length} analysis versions`));
    for (const analysis of history.analyses) {
      const version = document.createElement('details');
      version.append(node('summary', `${new Date(analysis.createdAt).toLocaleString()} · ${analysis.metadata.agent}${analysis.reason ? ` · ${analysis.reason}` : ''}`));
      const fields = document.createElement('dl');
      for (const [key, label] of Object.entries(names)) {
        const field = analysis.details[key as keyof ListingDetails];
        fields.append(node('dt', label), node('dd', field.value ?? 'Unknown'));
        for (const ref of field.evidence) fields.append(node('dd', `“${ref.quote}”`));
      }
      version.append(fields); older.append(version);
    }
    section.append(older);
    const form = document.createElement('form'); form.append(node('h4', 'Correct structured details'));
    form.append(node('p', 'Choose a field, enter a value and a verbatim supporting quote from saved evidence. Leave value and quote empty to mark it unknown. Corrections keep all previous versions.'));
    const select = document.createElement('select'); const label = node('label', 'Field '); label.append(select); form.append(label);
    for (const [key, name] of Object.entries(names)) { const option = node('option', name); option.value = key; select.append(option); }
    const value = document.createElement('textarea'); const valueLabel = node('label', 'Corrected value '); valueLabel.append(value); form.append(valueLabel);
    const observation = document.createElement('select'); const observationLabel = node('label', 'Evidence observation '); observationLabel.append(observation); form.append(observationLabel);
    for (const id of latest.observationIds) { const option = node('option', id); option.value = id; observation.append(option); }
    const quote = document.createElement('textarea'); const quoteLabel = node('label', 'Exact evidence quote '); quoteLabel.append(quote); form.append(quoteLabel);
    const reason = document.createElement('input'); reason.required = true; const reasonLabel = node('label', 'Reason for correction '); reasonLabel.append(reason); form.append(reasonLabel);
    const submit = node('button', 'Save correction'); submit.type = 'submit'; form.append(submit);
    const outcome = node('p', ''); outcome.setAttribute('role', 'status'); form.append(outcome); section.append(form);
    let submissionId = crypto.randomUUID();
    form.addEventListener('input', () => { submissionId = crypto.randomUUID(); });
    form.addEventListener('submit', async event => {
      event.preventDefault(); submit.disabled = true;
      const field: ExtractedField = value.value.trim() ? { status: 'known', value: value.value, evidence: [{ observationId: observation.value, quote: quote.value }] } : { status: 'unknown', value: null, evidence: [] };
      try {
        const response = await fetch('/api/v1/analyses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submissionId, jobId, observationIds: latest.observationIds, metadata: { agent: 'user-correction', analysisVersion: '1' }, details: { ...latest.details, [select.value]: field }, supersedesId: latest.id, reason: reason.value }) });
        const result = await response.json(); if (!response.ok) throw new Error(result.error?.message ?? 'Correction failed. Retry.');
        section.remove(); await showExtraction(container, jobId);
      } catch (error) { outcome.textContent = error instanceof Error ? error.message : 'Correction failed. Retry.'; }
      finally { submit.disabled = false; }
    });
  } catch (error) { status.textContent = error instanceof Error ? error.message : 'Could not load structured details.'; }
}
