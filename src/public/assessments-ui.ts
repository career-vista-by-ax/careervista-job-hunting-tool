import { currentLanguage, t } from './i18n.ts';
import type { Assessment, Finding, FitAxis } from '../assessments.ts';
import type { EvidenceReference } from '../extraction.ts';
import type { Observation } from '../app.ts';

const labelNames = { strong: 'Strong fit', promising: 'Promising', investigate: 'Investigate', low_fit: 'Low fit', excluded: 'Excluded by a hard requirement' };
const attributionNames = { employer_claim: 'Employer claim', external_report: 'External report · context only', model_inference: 'Model inference · investigate', user_confirmed: 'User-confirmed fact' };
const dimensionLabel = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').replace(/^./,letter => letter.toUpperCase());
const axisNames = { qualifications: 'Qualifications', preferences: 'Working preferences', practicalConstraints: 'Practical constraints' };
function node<K extends keyof HTMLElementTagNameMap>(tag: K, value = '') { const element = document.createElement(tag); element.textContent = value; return element; }

export async function showAssessments(parent: HTMLElement, jobId: string, observations: Observation[]) {
  const section = node('section'); section.className = 'assessments'; section.setAttribute('aria-label', 'Evidence-based fit assessments');
  section.append(node('h3', 'Agent recommendation')); parent.append(section);
  try {
    const response = await fetch(`/api/v1/jobs/${encodeURIComponent(jobId)}/assessments`);
    if (!response.ok) throw new Error('Could not load fit history. Close this job and try again.');
    const history = await response.json() as Assessment[];
    const translationsResponse=await fetch(`/api/v1/jobs/${encodeURIComponent(jobId)}/translations`);
    const translations=translationsResponse.ok?await translationsResponse.json() as {assessmentId:string;language:string;entries:{english:string;translated:string}[]}[]:[];
    let assessmentId='';
    function bilingual(parent:HTMLElement,english:string){
      if(currentLanguage()==='en'){const text=node('p',english);text.dataset.original='';parent.append(text);return;}
      const translated=translations.filter(item=>item.assessmentId===assessmentId&&item.language===currentLanguage()).flatMap(item=>item.entries).findLast(entry=>entry.english===english)?.translated;
      if(translated){const text=node('p',translated);text.className='bilingual-translation';text.dataset.original='';parent.append(text);}
      else parent.append(node('p','Translation not saved; showing English.'));
      const original=node('details');original.open=!translated;original.append(node('summary','English original'));const text=node('p',english);text.className='bilingual-english';text.dataset.original='';original.append(text);parent.append(original);
    }
    if (!section.isConnected) return;
    if (!history.length) { section.append(node('p', 'Not assessed. Ask your agent to assess the saved evidence against an approved profile.')); return; }
    section.append(node('p', 'Agent judgement for your review. Fit, evidence confidence and your own decision are separate.'));
    function evidence(parent: HTMLElement, refs: EvidenceReference[]) {
      for (const ref of refs) {
        const source = observations.find(item => item.id === ref.observationId);
        const quote = node('blockquote', ref.quote); parent.append(quote);
        if (source) {
          const link = node('a', `${source.source} · captured ${new Date(source.capturedAt).toLocaleDateString()} ↗`);
          link.href = source.sourceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; parent.append(link);
        }
      }
    }
    function findings(parent: HTMLElement, title: string, values: Finding[]) {
      if (!values.length) return;
      parent.append(node('h4', title));
      const list = node('ul');
      for (const finding of values) {
        const item = node('li'); bilingual(item,finding.statement);
        const attribution = node('span', `${attributionNames[finding.attribution]} · ${finding.status === 'unknown' ? 'Unknown' : finding.status === 'concern' ? 'Concern' : 'Supporting evidence'}`); attribution.className = 'assessment-attribution'; item.append(attribution);
        evidence(item, finding.evidence); list.append(item);
      }
      parent.append(list);
    }
    function axis(parent: HTMLElement, name: string, value: FitAxis) {
      const article = node('div'); article.className = 'assessment-axis';
      article.append(node('h4', `${t(name)} · ${t(value.status === 'match' ? 'Matches stated criteria' : value.status === 'concern' ? 'Concerns' : 'Unknown')}`)); bilingual(article,value.explanation);
      findings(article, 'Evidence & reasoning', value.findings); parent.append(article);
    }
    for (const [index, assessment] of [...history].reverse().entries()) {
      assessmentId=assessment.id;
      const details = node('details'); details.open = index === 0;
      const summary = node('summary', `${index === 0 ? 'Latest' : 'Historical'}: ${labelNames[assessment.label]} · ${new Date(assessment.createdAt).toLocaleString()}`);
      details.append(summary);
      findings(details, 'Why it may be worth pursuing', assessment.reasonsToPursue); findings(details, 'Concerns', assessment.concerns);
      const confidence = node('div'); confidence.className = 'assessment-confidence'; confidence.append(node('h4', `${t('Evidence confidence')}: ${t(assessment.confidence.level)}`)); bilingual(confidence,assessment.confidence.explanation); details.append(confidence);
      const criteria = node('details'); criteria.append(node('summary','How this matches your criteria'));
      for (const name of ['qualifications','preferences','practicalConstraints'] as const) axis(criteria, axisNames[name], assessment.axes[name]);
      details.append(criteria);
      if (assessment.hardConflicts.length) {
        details.append(node('h4', 'Confirmed hard conflicts · candidate retained'));
        for (const conflict of assessment.hardConflicts) {
          const item = node('div'); bilingual(item,conflict.explanation); item.append(node('p', `Observed: ${conflict.observedValue} · ${attributionNames[conflict.attribution]}`)); evidence(item, conflict.evidence); details.append(item);
        }
      }
      if (assessment.unknowns.length) { details.append(node('h4', 'Unknowns to investigate')); const list = node('ul'); for (const unknown of assessment.unknowns) {const item=node('li');bilingual(item,unknown.explanation);list.append(item);} details.append(list); }
      if (assessment.questions.length) {
        details.append(node('h4', 'Questions for follow-up')); const list = node('ul');
        for (const question of assessment.questions) { const item = node('li'); bilingual(item,question.question); evidence(item, question.evidence); list.append(item); } details.append(list);
      }
      const provenance = assessment.metadata;
      const context = node('details'); context.append(node('summary','Source and analysis context'),node('p',`Profile revision ${assessment.profileVersion} · search track ${assessment.trackId} · rules ${assessment.rulesVersion}`));
      context.append(node('p', `Analysis provenance: ${provenance.agent} · version ${provenance.analysisVersion}${provenance.provider ? ` · provider ${provenance.provider}` : ''}${provenance.model ? ` · model ${provenance.model}` : ' · model identity unavailable'}${provenance.config ? ` · config ${JSON.stringify(provenance.config)}` : ''}`));
      details.append(context); section.append(details);
    }
  } catch (error) { if (section.isConnected) { const message = node('p', error instanceof Error ? error.message : 'Assessment history is unavailable.'); message.className = 'error'; section.append(message); } }
}
