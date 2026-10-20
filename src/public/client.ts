import { initializeLanguage, currentLanguage, t } from './i18n.ts';
import { mountApplicationTracker } from './application-tracker-ui.ts';
import { installWorkspaceUI } from './workspace-ui.ts';
import { showAssessments } from './assessments-ui.ts';
import { showCompensation } from './compensation-ui.ts';
import { showExtraction } from './extraction-ui.ts';
import { showCompany } from './company-ui.ts';
import { mountBackupTools } from './backup-ui.ts';
import { mountDataTools } from './datalifecycle-ui.ts';
import { mountResetTools } from './reset-ui.ts';
import type { JobDetail } from '../app.ts';
await initializeLanguage();
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
    const heading = text('h2', job.title); heading.id = 'detail-title'; heading.dataset.original=''; detail.append(heading);
    const company=text('p', `${job.company}${job.location ? ` · ${job.location}` : ''}`, 'muted');company.dataset.original='';detail.append(company);
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
    const storage = await api<{archiveId:string|null;deletedAt:string|null}>(`/jobs/${encodeURIComponent(id)}/storage`);
    const storageActions = document.createElement('div'); storageActions.className='job-storage-actions';
    const move = text('button',t(storage.deletedAt ? 'Restore job' : 'Move to Recently deleted')); move.type='button'; move.className='quiet';
    storageActions.append(move);
    if(!storage.deletedAt)storageActions.append(text('p',t('This hides the job and prevents the same source listing from returning in later searches. You can restore it from Recently deleted.')));
    const originalAd=job.observations.find(observation=>/^(?:www\.)?(?:seek\.com\.au|(?:[a-z]+\.)?linkedin\.com|glassdoor\.com(?:\.au)?|(?:[a-z]+\.)?indeed\.com)$/.test(new URL(observation.sourceUrl).hostname))??job.observations[0]!;
    const applyLink=text('a',t('Apply via original advert'));applyLink.href=originalAd.sourceUrl;applyLink.target='_blank';applyLink.rel='noopener noreferrer';
    const prepare=text('button',t('Prepare my CV / cover letter'));prepare.type='button';prepare.className='quiet';const prepareStatus=text('p','');prepareStatus.setAttribute('role','status');
    prepare.addEventListener('click',()=>{const language=currentLanguage()==='en'?'English':currentLanguage()==='zh-CN'?'简体中文':'繁体中文';const request=`Use the careervista-job-search skill with CareerVista at ${location.origin}. Help me prepare for ${job.title} at ${job.company} (saved job ${job.id}). Use the ax-cv and ax-30-secs guides to tailor my CV/cover letter and review what stands out in a simulated 30-second skim. Explain in ${language}, keeping practical English wording. Ask whether I prefer manual edits, a separate agent-created draft or authorised editor control. Preserve originals and save separate variants. Original advert: ${originalAd.sourceUrl}. Guide me to that advert and its own Apply button when ready. Do not bypass the advert with a direct link-out destination, submit an application, send messages or mark it applied.`;void navigator.clipboard.writeText(request).then(()=>{prepareStatus.textContent=t('Preparation prompt copied. Paste it into your agent.');}).catch(()=>{prepareStatus.textContent=request;});});
    storageActions.prepend(applyLink,prepare,prepareStatus);
    overview.after(storageActions);
    move.addEventListener('click',async()=>{move.disabled=true;try{await api(`/jobs/${encodeURIComponent(id)}/storage/${storage.deletedAt?'restore':'trash'}`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});dialog.close();}catch(error){move.disabled=false;showError(error);}});
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
async function refresh() { await workspace.refresh(); message.textContent = ''; const due=await api<{job:{id:string;title:string;company:string};followUpOn:string}[]>(`/applications/attention?on=${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`); const host=element('follow-up-attention');host.replaceChildren();host.hidden=!due.length;if(due.length){host.append(text('h2',t('Follow-ups due')));for(const item of due){const button=text('button',`${item.job.title} · ${item.job.company} · ${item.followUpOn}`);button.type='button';button.className='quiet';button.addEventListener('click',()=>void showDetail(item.job.id));host.append(button);}} }
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
  const [checks, review] = await Promise.all([
    api<{ status: string; checks: { result: string; checkedAt: string; quote?: string }[] }>(`/jobs/${encodeURIComponent(id)}/availability`),
    api<{ decision: string }>(`/jobs/${encodeURIComponent(id)}/reviews`),
  ]);
  await mountApplicationTracker(applications, id);
  availability.append(text('p', checks.status.replaceAll('_', ' ')));
  for (const check of checks.checks) availability.append(text('p', `${check.result.replaceAll('_', ' ')} · ${new Date(check.checkedAt).toLocaleDateString()}${check.quote ? ` · ${check.quote}` : ''}`));
}

const setup = element<HTMLDialogElement>('agent-dialog');
element('agent-help').addEventListener('click', () => setup.showModal());
element('close-agent').addEventListener('click', () => setup.close());
const englishPrompt = `Use CareerVista at ${location.origin} and the careervista-capture skill. Help me find my next role in Australia. Clarify my goals and expand related titles and search terms. If I share a resume, read it with your document tools and confirm my competitive strengths. Ask one question at a time using your native question tool for clickable choices, with a recommendation, custom input and an undecided option. Use plain-text choices only if that tool is unavailable. Clarify Australian location, work arrangement, AUD base/super, equity, leave, benefits and review priorities, then ask which sites to search. Agree the search scope and budget with me, then search, analyse and save evidence-backed results and shortlist reasons. Ask useful follow-up questions here. When the batch is ready, send me to the jobs table to browse. Do not submit applications or send messages.`;
const chinesePrompt = `使用 CareerVista（${location.origin}）和 careervista-capture 技能，帮助我寻找澳大利亚的下一份工作。请优先调用当前智能体的原生提问工具，一次只问一个问题，提供可点击的推荐选项、自定义输入和暂不确定的选项；仅在工具不可用时使用文字选项。先逐个澄清目标、相关职位名称、地点、工作方式、AUD 基本薪资与 super、股权、假期、福利及评价重点。如我提供简历，请读取并确认有证据支持的优势。然后与我确定网站、搜索范围、数量和预算，再搜索、分析并保存原始证据、推荐理由、顾虑和待确认问题。请根据我的语言偏好解释推荐，同时保留英文原文和可用于与招聘方交流的英文问题。完成后引导我到职位表格浏览。不要提交申请或发送消息。`;
const traditionalPrompt = `使用 CareerVista（${location.origin}）和 careervista-capture 技能，協助我尋找澳大利亞的下一份工作。請優先呼叫目前代理的原生提問工具，一次只問一個問題，提供可點選的建議選項、自訂輸入及暫不確定的選項；僅在工具不可用時使用文字選項。先逐個釐清目標、相關職位名稱、地點、工作方式、AUD 基本薪資與 super、股權、假期、福利及評價重點。如我提供履歷，請讀取並確認有證據支持的優勢。然後與我確定網站、搜尋範圍、數量和預算，再搜尋、分析並儲存原始證據、推薦理由、顧慮和待確認問題。請根據我的語言偏好解釋推薦，同時保留英文原文和可用於與招募方交流的英文問題。完成後引導我到職位表格瀏覽。不要提交申請或傳送訊息。`;
const prompt = `${currentLanguage()==='en'?englishPrompt:currentLanguage()==='zh-CN'?chinesePrompt:traditionalPrompt}\nPreferred language: ${currentLanguage()==='en'?'English':currentLanguage()==='zh-CN'?'简体中文':'繁体中文'}. Read /api/v1/settings/language and /api/v1/agent-guide/language. Preserve English listing evidence; save bilingual recommendation explanations.`;
element('agent-prompt').textContent = prompt;
element('copy-skill-shortcut').addEventListener('click',()=>{void navigator.clipboard.writeText(currentLanguage()==='en'?'Use the careervista-job-search skill to help me find my next role in Australia.':currentLanguage()==='zh-CN'?'使用 careervista-job-search 技能，帮助我寻找澳大利亚的下一份工作。':'使用 careervista-job-search 技能，協助我尋找澳大利亞的下一份工作。').then(()=>{element('agent-copy-status').textContent=t('Copied. Paste it into your agent conversation.');}).catch(()=>{element('agent-copy-status').textContent=t('Select the shortcut above and copy it manually.');});});
element('copy-agent-prompt').addEventListener('click', () => {
  void navigator.clipboard.writeText(prompt).then(() => { element('agent-copy-status').textContent = 'Copied. Paste it into your agent conversation.'; }).catch(() => { element('agent-copy-status').textContent = 'Copy is unavailable. Select the prompt above and copy it manually.'; });
});
const dataDialog = element<HTMLDialogElement>('data-dialog');
element('data-help').addEventListener('click', () => dataDialog.showModal());
element('close-data').addEventListener('click', () => dataDialog.close());
mountBackupTools(element('local-data'));
mountDataTools(element('local-data'));
mountResetTools(element('local-data'));
// Keep the presentation current while the external agent saves its work.
setInterval(() => { if (!document.hidden && !dialog.open && !document.activeElement?.closest('#jobs-table')) void refresh().catch(showError); }, 15_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && !dialog.open) void refresh().catch(showError); });
window.addEventListener('careervista:open-job', event => { void showDetail((event as CustomEvent<string>).detail); });

window.addEventListener('careervista:application-updated',()=>void refresh().catch(showError));
