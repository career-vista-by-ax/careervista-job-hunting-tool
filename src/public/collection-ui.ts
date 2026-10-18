import type { Destination } from '../collection.ts';
export async function showDestinations(container: HTMLElement, jobId: string) {
  const response = await fetch(`/api/v1/jobs/${encodeURIComponent(jobId)}/destinations`);
  if (!response.ok) throw new Error('Could not load captured destinations. Reopen this job to retry.');
  const destinations = await response.json() as Destination[];
  if (!destinations.length) return;
  const section = document.createElement('section'); const heading = document.createElement('h3'); heading.textContent = 'Employer and application pages'; section.append(heading);
  const list = document.createElement('ul');
  for (const destination of destinations) { const item = document.createElement('li'); const link = document.createElement('a'); link.href = destination.url; link.textContent = `${destination.kind === 'application' ? 'Application' : 'Employer'}: ${destination.label}`; link.target = '_blank'; link.rel = 'noopener noreferrer'; item.append(link); list.append(item); }
  const note = document.createElement('p'); note.textContent = 'Opening a destination does not record an application.'; section.append(list, note); container.append(section);
}
