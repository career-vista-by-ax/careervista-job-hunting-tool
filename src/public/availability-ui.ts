import type { AvailabilityCheck, AvailabilityInput } from '../availability.ts';
import type { Observation } from '../app.ts';
function node<K extends keyof HTMLElementTagNameMap>(tag: K, content = '') { const el = document.createElement(tag); el.textContent = content; return el; }
export async function showAvailability(container: HTMLElement, jobId: string, observations: Observation[], changed: () => Promise<void>) {
  const section = node('section'); section.setAttribute('aria-label', 'Listing availability'); container.append(section);
  section.append(node('h3', 'Listing availability'));
  const message = node('p'); message.setAttribute('role', 'status'); section.append(message);
  try {
    const endpoint = `/api/v1/jobs/${encodeURIComponent(jobId)}/availability`;
    const response = await fetch(endpoint); if (!response.ok) throw new Error('Could not load availability. Reopen the job to retry.');
    const history = await response.json() as { status: string; latest: AvailabilityCheck | null; lastSuccessful: AvailabilityCheck | null; checks: AvailabilityCheck[] };
    message.textContent = `Last confirmed: ${history.status.replaceAll('_', ' ')}${history.lastSuccessful ? ` · ${new Date(history.lastSuccessful.checkedAt).toLocaleString()}` : ''}. Latest check: ${history.latest?.result.replaceAll('_', ' ') ?? 'Not checked'}${history.latest?.failureReason ? ` (${history.latest.failureReason})` : ''}.`;
    section.append(node('p', 'Open the original page or ask your browser agent to check it. Authentication, blocking and network failures cannot confirm closure. Opening the page does not record a check or application.'));
    const form = node('form');
    function field(labelText: string, el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) { const label = node('label', labelText); label.append(el); form.append(label); return el; }
    const source = node('select'); for (const url of new Set(observations.map(item => item.sourceUrl))) { const option = node('option', url); option.value = url; source.append(option); } field('Listing source to check', source);
    const open = node('a', 'Open source to verify'); open.target = '_blank'; open.rel = 'noopener noreferrer'; open.href = source.value; source.addEventListener('change', () => { open.href = source.value; }); form.append(open);
    const result = node('select'); for (const value of ['could_not_verify', 'active', 'confirmed_closed']) { const option = node('option', value.replaceAll('_', ' ')); option.value = value; result.append(option); } field('Observed availability result', result);
    const reason = node('select'); for (const value of ['network', 'authentication', 'verification', 'blocked', 'timeout', 'parsing']) { const option = node('option', value); option.value = value; reason.append(option); } field('Failed-check reason', reason);
    const capture = node('textarea'); capture.rows = 3; capture.maxLength = 1_000_000; field('Readable source text (successful checks only)', capture);
    const quote = node('textarea'); quote.maxLength = 8000; quote.rows = 2; field('Exact quote establishing active status or closure', quote);
    const update = () => { const failed = result.value === 'could_not_verify'; reason.disabled = !failed; capture.disabled = failed; quote.disabled = failed; capture.required = !failed; quote.required = !failed; }; result.addEventListener('change', update); update();
    const submit = node('button', 'Record availability check'); submit.type = 'submit'; form.append(submit); section.append(form);
    let operationId = crypto.randomUUID(); let checkedAt: string | undefined;
    form.addEventListener('input', () => { operationId = crypto.randomUUID(); checkedAt = undefined; });
    form.addEventListener('submit', async event => {
      event.preventDefault(); submit.disabled = true;
      try {
        checkedAt ??= new Date().toISOString();
        const input: AvailabilityInput = { operationId, sourceUrl: source.value, checkedAt, result: result.value as AvailabilityInput['result'], ...(result.value === 'could_not_verify' ? { failureReason: reason.value as AvailabilityInput['failureReason'] } : { text: capture.value, quote: quote.value }) };
        const saved = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }); const data = await saved.json();
        if (!saved.ok) throw new Error(data.error?.message ?? 'Could not save check. Retry.');
        await changed(); const marker = document.createComment('availability'); section.replaceWith(marker); const holder = node('div'); await showAvailability(holder, jobId, observations, changed); marker.replaceWith(...holder.childNodes);
      } catch (error) { message.textContent = error instanceof Error ? error.message : 'Could not save check. Retry.'; }
      finally { submit.disabled = false; }
    });
    if (history.checks.length) {
      const earlier = node('details'); earlier.append(node('summary', `${history.checks.length} source checks`));
      for (const check of history.checks) {
        earlier.append(node('p', `${new Date(check.checkedAt).toLocaleString()} · ${check.result.replaceAll('_', ' ')}${check.failureReason ? ` · ${check.failureReason}` : ''}`));
        if (check.quote) earlier.append(node('blockquote', check.quote));
      }
      section.append(earlier);
    }
  } catch (error) { message.textContent = error instanceof Error ? error.message : 'Availability unavailable. Reopen to retry.'; }
}
