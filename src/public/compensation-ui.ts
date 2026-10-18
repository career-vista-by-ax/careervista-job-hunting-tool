import type { CompensationAmount, CompensationRecord } from '../compensation.ts';
const kinds = { advertised: 'Advertised', external_report: 'External report', model_estimate: 'Model estimate (not an employer commitment)', user_adjustment: 'User adjustment (not a source fact)' };
function node<K extends keyof HTMLElementTagNameMap>(tag: K, value = '') { const element = document.createElement(tag); element.textContent = value; return element; }
export async function showCompensation(jobId: string, container: HTMLElement, previous?: HTMLElement) {
  const section = node('section'); section.setAttribute('aria-label', 'Compensation'); if (previous) previous.replaceWith(section); else container.append(section);
  const message = node('p'); message.setAttribute('role', 'status');
  try {
    const response = await fetch(`/api/v1/jobs/${encodeURIComponent(jobId)}/compensation`);
    if (!response.ok) throw new Error('Could not load compensation. Reopen this job to retry.');
    const { records, sources } = await response.json() as { records: CompensationRecord[]; sources: { observationId: string; source: string; sourceUrl: string; capturedAt: string }[] };
    section.append(node('h3', 'Compensation'));
    if (!records.length) { section.append(node('p', 'Unknown — no compensation figures have been recorded. Missing pay is not a confirmed mismatch.')); return; }
    section.append(node('p', 'Figures retain their original units. No currency, package or annual conversion is applied.'));
    for (const record of records) {
      const item = node('article'); item.append(node('h4', kinds[record.kind]), node('p', record.displayLabel), node('p', `${record.attribution} · Recorded ${new Date(record.createdAt).toLocaleString()}`));
      if (record.uncertainty) item.append(node('p', `Uncertainty: ${record.uncertainty}`));
      if (record.rationale) item.append(node('p', `Reason: ${record.rationale}`));
      if (record.referenceId) { const original = records.find(entry => entry.id === record.referenceId); item.append(node('p', `Original retained: ${original?.displayLabel ?? record.referenceId}`)); }
      for (const evidence of record.evidence) {
        item.append(node('blockquote', evidence.quote)); const source = sources.find(entry => entry.observationId === evidence.observationId);
        if (source) { const link = node('a', `${source.source} · Captured ${new Date(source.capturedAt).toLocaleString()}`); link.href = source.sourceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; item.append(link); }
      }
      section.append(item);
    }
    const details = node('details'); details.append(node('summary', 'Record a personal compensation adjustment'));
    const form = node('form'); const fields = node('div'); fields.className = 'fields'; form.append(fields);
    const label = (title: string, field: HTMLElement) => { const wrapper = node('label', title); wrapper.append(field); fields.append(wrapper); return field; };
    const original = node('select');
    for (const record of records.filter(entry => entry.kind !== 'user_adjustment')) { const option = node('option', `${kinds[record.kind]}: ${record.displayLabel}`); option.value = record.id; original.append(option); } label('Original figure to adjust', original);
    const min = node('input'), max = node('input'), currency = node('input');
    for (const input of [min, max]) { input.type = 'number'; input.min = '0'; input.step = 'any'; }
    label('Minimum amount (blank is unknown)', min); label('Maximum amount (blank is unknown)', max); currency.maxLength = 3; label('Currency code (blank is unknown)', currency);
    const select = (title: string, options: string[]) => { const element = node('select'); for (const value of options) { const option = node('option', value.replaceAll('_', ' ')); option.value = value; element.append(option); } label(title, element); return element; };
    const period = select('Period', ['year', 'month', 'week', 'day', 'hour', 'contract', 'unknown']);
    const basis = select('Pay basis', ['base', 'total_package', 'unknown']);
    const superannuation = select('Superannuation', ['included', 'excluded', 'not_applicable', 'unknown']);
    const unit = node('input'); label('Contract unit (blank is unknown)', unit);
    const rationale = node('textarea'); rationale.required = true; rationale.maxLength = 8000; label('Reason and explicit assumptions for this adjustment', rationale);
    const fill = () => { const record = records.find(entry => entry.id === original.value)!; min.value = record.amount.min === null ? '' : String(record.amount.min); max.value = record.amount.max === null ? '' : String(record.amount.max); currency.value = record.amount.currency ?? ''; period.value = record.amount.period; basis.value = record.amount.basis; superannuation.value = record.amount.superannuation; unit.value = record.amount.contractUnit ?? ''; };
    original.addEventListener('change', fill); fill();
    const submit = node('button', 'Save adjustment and retain original'); submit.type = 'submit'; form.append(submit, message); details.append(form); section.append(details);
    let operationId = crypto.randomUUID(); form.addEventListener('input', () => { operationId = crypto.randomUUID(); });
    form.addEventListener('submit', async event => {
      event.preventDefault(); submit.disabled = true;
      try {
        const amount: CompensationAmount = { min: min.value === '' ? null : Number(min.value), max: max.value === '' ? null : Number(max.value), currency: currency.value.trim() ? currency.value.trim().toUpperCase() : null, period: period.value as CompensationAmount['period'], basis: basis.value as CompensationAmount['basis'], superannuation: superannuation.value as CompensationAmount['superannuation'], contractUnit: unit.value.trim() || null };
        const result = await fetch(`/api/v1/jobs/${encodeURIComponent(jobId)}/compensation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operationId, kind: 'user_adjustment', attribution: 'User judgement', referenceId: original.value, rationale: rationale.value, amount, evidence: [] }) });
        const data = await result.json(); if (!result.ok) throw new Error(data.error?.message ?? 'Could not save adjustment.');
        await showCompensation(jobId, container, section);
      } catch (error) { message.textContent = error instanceof Error ? error.message : 'Could not save adjustment.'; }
      finally { submit.disabled = false; }
    });
  } catch (error) { message.textContent = error instanceof Error ? error.message : 'Compensation unavailable.'; section.append(message); }
}
