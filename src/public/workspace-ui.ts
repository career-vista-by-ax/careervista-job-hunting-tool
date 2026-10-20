import { t } from './i18n.ts';
import { defaultWorkspaceView, comparisonColumns, workspaceColumns, workspaceSorts } from './workspace-contract.ts';
import type { WorkspaceView } from './workspace-contract.ts';
import type { WorkspaceRow, WorkspaceResult } from '../workspace.ts';
const columnLabels = { role: 'Role', fit: 'Fit', company: 'Company', location: 'Location', compensation: 'Pay', workArrangement: 'Workplace', employment: 'Employment', confidence: 'Confidence', concerns: 'Concerns', unknowns: 'Unknowns', reasons: 'Why this role', review: 'Your review', application: 'Application', followUp: 'Follow-up', freshness: 'Availability', createdAt: 'Saved', source: 'Sources' };
const fitLabels = { strong: 'Strong fit', promising: 'Promising', investigate: 'Investigate', low_fit: 'Low fit', excluded: 'Excluded · hard conflict' };
const kindLabels = { advertised: 'Advertised', external_report: 'External report', model_estimate: 'Model estimate' };
const sortLabels: Record<WorkspaceView['sort'],string> = { title: 'Role', company: 'Company', location: 'Location', workArrangement: 'Work arrangement', employment: 'Employment', concerns: 'Concern count', unknowns: 'Unknown count', followUp: 'Next follow-up', compensation: 'Compensation provenance / units', fit: 'Fit', confidence: 'Evidence confidence', review: 'Your review', application: 'Application stage', freshness: 'Evidence freshness', createdAt: 'Date saved', source: 'Source' };
const columnSorts: Record<typeof workspaceColumns[number],WorkspaceView['sort']> = { role: 'title', workArrangement: 'workArrangement', employment: 'employment', confidence: 'confidence', concerns: 'concerns', unknowns: 'unknowns', reasons: 'fit', followUp: 'followUp', createdAt: 'createdAt', company: 'company', location: 'location', compensation: 'compensation', fit: 'fit', review: 'review', application: 'application', freshness: 'freshness', source: 'source' };
function node<K extends keyof HTMLElementTagNameMap>(tag: K, value = '', className?: string) { const el = document.createElement(tag); el.textContent = value; if (className) el.className = className; return el; }
function controlLabel(title: string, input: HTMLElement) { const label = node('label',title); label.append(input); return label; }
function date(value: string | null) { return value ? new Date(value).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}) : 'Not recorded'; }
function human(value: string) { return value.replaceAll('_',' ').replace(/^./,letter => letter.toUpperCase()); }
export function installWorkspaceUI(openJob: (id: string) => Promise<void>) {
  const controls = document.getElementById('workspace-controls')!, table = document.getElementById('jobs-table')!, rows = document.getElementById('job-rows')!, head = table.querySelector('thead tr')!;
  let view = structuredClone(defaultWorkspaceView), saved: {id:string;name:string;view:WorkspaceView}[] = [], requestId = 0, saveQueue = Promise.resolve();
  const search = document.getElementById('job-search') as HTMLInputElement;
  controls.inert=true; search.disabled=true;
  const status = document.getElementById('workspace-status')!, summary = document.getElementById('workspace-summary')!;
  const savedSelect = node('select'); savedSelect.setAttribute('aria-label','Saved view');
  const name = node('input'); name.maxLength = 100; name.placeholder = 'Name this view'; name.setAttribute('aria-label','New saved view name');
  const save = node('button','Save view'); save.type = 'button'; save.className = 'quiet';
  const remove = node('button','Delete view'); remove.type = 'button'; remove.className = 'quiet'; remove.disabled = true;
  const savedControls = node('div','','saved-view-controls'); savedControls.append(controlLabel('Saved view',savedSelect),name,save,remove);
  const filters = node('details','','workspace-filters'); filters.append(node('summary','Filters & columns'));
  const fields = node('div','','filter-grid'); filters.append(fields);
  const inputs: Partial<Record<keyof WorkspaceView, HTMLSelectElement>> = {};
  const select = (key: keyof WorkspaceView, label: string, choices: [string,string][]) => {
    const input = node('select'); inputs[key] = input;
    for (const [value,label] of choices) { const option = node('option',label); option.value = value; input.append(option); }
    input.addEventListener('change', () => { Object.assign(view,{[key]:input.value}); changed(); }); fields.append(controlLabel(label,input)); return input;
  };
  select('availability','Listing availability',[['active','Active / unknown'],['all','All, including closed'],['closed','Confirmed closed only']]);
  select('fit','Agent fit',[['all','All, including excluded'],['shortlist','Strong / promising'],['unassessed','Not assessed'],...Object.entries(fitLabels)]);
  select('provenance','Compensation source',[['all','All sources'],['unknown','Unknown'],...Object.entries(kindLabels)]);
  select('review','Your decision',[['all','All decisions'],['unreviewed','Unreviewed'],['saved','Saved'],['dismissed','Dismissed']]);
  select('application','Application stage',[['all','All stages'],['none','No event recorded'],...['preparing','screening','assessment','applied','interview','offer','accepted','rejected','withdrawn','follow_up'].map(value => [value,human(value)] as [string,string])]);
  select('sort','Sort by',workspaceSorts.map(value => [value,sortLabels[value]]));
  select('direction','Sort direction',[['asc','Ascending'],['desc','Descending']]);
  select('density','Row density',[['compact','Compact'],['comfortable','Comfortable']]);
  const columns = node('fieldset','','column-controls'); columns.append(node('legend','Visible columns'));
  const columnInputs = new Map<string,HTMLInputElement>();
  for (const key of workspaceColumns) {
    const checkbox = node('input'); checkbox.type = 'checkbox'; checkbox.checked = true; checkbox.disabled = key === 'role'; columnInputs.set(key,checkbox);
    checkbox.addEventListener('change', () => { view.columns = workspaceColumns.filter(column => columnInputs.get(column)!.checked); changed(); });
    const label = node('label'); label.append(checkbox,document.createTextNode(columnLabels[key])); columns.append(label);
  }
  filters.append(columns,node('p','Compensation sorts by source and original units; currencies and contract rates are never silently converted.','muted'));
  const collection=node('select');collection.setAttribute('aria-label',t('Search history'));
  async function loadArchives(){const response=await fetch('/api/v1/archives');if(!response.ok)throw new Error('Could not load search history.');const archives=await response.json() as {id:string;name:string;jobCount:number}[];collection.replaceChildren();for(const [value,label] of [['current','Current search'],['all','All saved searches'],['trash','Recently deleted'],...archives.map(item=>[item.id,`${item.name} (${item.jobCount})`])]){const option=node('option',label!);option.value=value!;collection.append(option);}collection.value=view.collection;}
  collection.addEventListener('change',()=>{view.collection=collection.value;if(view.collection!=='current')view.availability='all';changed();});
  const archive=node('button','Archive this search','quiet');archive.type='button';
  const archiveDialog=node('dialog');archiveDialog.className='archive-dialog';archiveDialog.setAttribute('aria-labelledby','archive-title');
  const archiveForm=node('form');const archiveTitle=node('h2','Archive this search');archiveTitle.id='archive-title';const archiveName=node('input');archiveName.required=true;archiveName.maxLength=100;archiveName.value=new Date().toLocaleDateString();
  const archiveCancel=node('button','Cancel','quiet');archiveCancel.type='button';archiveCancel.addEventListener('click',()=>archiveDialog.close());const archiveSave=node('button','Archive and start fresh');archiveSave.type='submit';const archiveMessage=node('p');archiveMessage.setAttribute('role','status');
  archiveForm.append(archiveTitle,node('p','Keep the current jobs and their application history in a named archive. Start an empty current search with new preferences. Recently deleted jobs stay separate.'),controlLabel('Archive name',archiveName),archiveCancel,archiveSave,archiveMessage);archiveDialog.append(archiveForm);document.body.append(archiveDialog);archive.addEventListener('click',()=>archiveDialog.showModal());
  const archiveOperation=crypto.randomUUID();archiveForm.addEventListener('submit',async event=>{event.preventDefault();archiveSave.disabled=true;try{const response=await fetch('/api/v1/archives',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operationId:archiveOperation,name:archiveName.value})});const result=await response.json();if(!response.ok)throw new Error(result.error?.message??'Could not archive the search.');location.reload();}catch(error){archiveMessage.textContent=error instanceof Error?error.message:'Could not archive the search.';archiveSave.disabled=false;}});
  const searchHistory=node('div','','search-history-controls');searchHistory.append(controlLabel('Search history',collection),archive);controls.append(searchHistory);
  const quickViews = node('div','','quick-views'); quickViews.setAttribute('role','group'); quickViews.setAttribute('aria-label','Quick views');
  const quickButtons = new Map<string,HTMLButtonElement>();
  for (const [key,label] of [['all','All jobs'],['shortlist','Shortlist'],['saved','Saved by you']] as const) {
    const button=node('button',label,'quiet'); button.type='button'; quickButtons.set(key,button);
    button.addEventListener('click',()=>{view.fit=key==='shortlist'?'shortlist':'all';view.review=key==='saved'?'saved':'all';syncControls();changed();}); quickViews.append(button);
  }
  const comparison=node('button','Comparison columns','quiet'); comparison.type='button'; comparison.title='Show fit, pay, workplace, confidence and concerns in compact rows';
  comparison.addEventListener('click',()=>{view.columns=[...comparisonColumns];view.density='compact';view.sort='fit';view.direction='asc';syncControls();changed();});quickViews.append(comparison);
  const legend=node('span','','fit-legend');legend.setAttribute('role','group');legend.setAttribute('aria-label',t('Fit colour legend'));
  for(const [fit,label] of [['strong','Green: strong'],['promising','Teal: promising'],['investigate','Amber: investigate'],['low_fit','Red: low fit / excluded']])legend.append(node('span',label,`status-badge fit-${fit}`));
  quickViews.append(legend);
  filters.append(savedControls); controls.append(quickViews,filters);
  async function api<T>(path: string, options?: RequestInit): Promise<T> { const response = await fetch(`/api/v1/workspace${path}`,options); const result = await response.json(); if (!response.ok) throw new Error(result.error?.message ?? 'Workspace unavailable. Retry.'); return result as T; }
  function report(error: unknown) { status.textContent = error instanceof Error ? error.message : 'Could not load the workspace. Retry.'; status.className = 'error'; }
  function syncControls() {
    search.value = view.query; collection.value=view.collection;
    table.dataset.density=view.density;
    for(const [key,button] of quickButtons) button.setAttribute('aria-pressed',String(key==='saved'?view.review==='saved':view.review==='all'&&view.fit===key));
    for (const [key,input] of Object.entries(inputs)) input.value = String(view[key as keyof WorkspaceView]);
    for (const [key,input] of columnInputs) input.checked = view.columns.includes(key as typeof workspaceColumns[number]);
  }
  function listSaved() { const selected = savedSelect.value; savedSelect.replaceChildren(); const blank = node('option','Current filters'); blank.value = ''; savedSelect.append(blank); for (const item of saved) { const option = node('option',item.name); option.value = item.id; savedSelect.append(option); } savedSelect.value = selected; remove.disabled = !savedSelect.value; }
  function changed() {
    syncControls(); savedSelect.value = ''; remove.disabled = true; const snapshot = structuredClone(view);
    saveQueue = saveQueue.catch(() => {}).then(async () => { await api('/views/current',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot)}); });
    void saveQueue.catch(report); void loadRows().catch(report);
  }
  function cell(primary: string, secondary?: string | null) { const td = node('td'); td.append(node('span',primary,'cell-primary')); if (secondary) td.append(node('span',secondary,'cell-secondary')); td.title=[primary,secondary].filter(Boolean).join('\n'); return td; }
  function rowCell(row: WorkspaceRow, key: typeof workspaceColumns[number]) {
    if (key === 'role') {
      const td = node('td','','identity-cell'); const button = node('button',row.title,'job-title'); button.type='button'; button.dataset.jobId=row.id; button.title=row.title; button.setAttribute('aria-haspopup','dialog'); button.setAttribute('aria-label',`View ${row.title} at ${row.company}`); button.addEventListener('click',()=>void openJob(row.id));
      td.append(button); return td;
    }
    if (key === 'company') {const td=cell(row.company);td.dataset.original='';return td;}
    if (key === 'location') {const td=cell(row.location ?? 'Unknown');if(row.location)td.dataset.original='';return td;}
    if (key === 'workArrangement') {const td=cell(row.workArrangement ?? 'Unknown');if(row.workArrangement)td.dataset.original='';return td;}
    if (key === 'employment') {const td=cell(row.employment ?? 'Unknown');if(row.employment)td.dataset.original='';return td;}
    if (key === 'confidence') { const td=cell(row.confidence ? human(row.confidence) : 'Unassessed'); td.querySelector('span')!.className=`status-badge confidence-${row.confidence ?? 'unknown'}`; td.title=`Evidence confidence: ${row.confidence ?? 'not assessed'}`; return td; }
    if (key === 'createdAt') return cell(date(row.createdAt));
    if (key === 'followUp') return cell(row.application.followUpOn ?? 'None scheduled');
    if (key === 'compensation') { const td = cell(row.compensation.label,row.compensation.provenance ? kindLabels[row.compensation.provenance as keyof typeof kindLabels] : 'Undisclosed'); if(row.compensation.provenance==='model_estimate')td.classList.add('estimated-pay'); if (row.compensation.adjustment) td.append(node('span','Personal adjustment','cell-secondary')); return td; }
    if (key === 'fit') {
      const td = cell(row.fit === 'excluded' ? 'Excluded' : row.fit ? fitLabels[row.fit] : 'Unassessed'); td.querySelector('span')!.className=`status-badge fit-${row.fit ?? 'unknown'}`;
      td.title=[row.fit ? fitLabels[row.fit] : 'Unassessed',...row.reasons].join('\n'); return td;
    }
    if (key === 'reasons' || key === 'concerns' || key === 'unknowns') {
      const items=row[key]; const td=cell(items.length ? items[0]! : key==='reasons'?'Not assessed':row.fit?'None recorded':'Not assessed',items.length>1?`+${items.length-1} more`:null);
      td.title=items.join('\n') || td.title;
      if(key==='concerns'&&items.length)td.classList.add('has-concerns');
      return td;
    }
    if (key === 'review') return cell(human(row.review));
    if (key === 'application') { const td = cell(row.application.status ? human(row.application.status) : 'Not applied',row.application.appliedAt ? `${t('Applied')} ${date(row.application.appliedAt)}` : null); if (row.application.followUpOn) td.append(node('span',`${t('Follow-up date')} ${row.application.followUpOn}`,'cell-secondary')); return td; }
    if (key === 'freshness') return cell(row.availability.status==='confirmed_closed'?'Closed':row.availability.status==='active'?'Verified active':'Unverified',`${row.availability.checkedAt ? 'Checked' : 'Captured'} ${date(row.availability.checkedAt ?? row.capturedAt)}${row.availability.lastAttempt==='could_not_verify'?' · latest check failed':''}`);
    return cell(row.sourceLabels.join(', ') || 'Unknown source');
  }
  function render(result: WorkspaceResult) {
    const focusedColumn = document.activeElement?.closest('th')?.dataset.column;
    document.getElementById('count')!.textContent = `${result.counts.total} saved`;
    summary.textContent = `${result.counts.shortlisted} strong / promising · ${result.counts.lowFit} low fit · ${result.counts.newLastSevenDays} saved in the last 7 days · ${result.counts.attention} applications need follow-up · ${result.counts.excluded} agent-excluded · ${result.counts.closed} confirmed closed`;
    document.getElementById('results-summary')!.textContent=`${result.counts.visible} of ${result.counts.total} jobs · Select a role for details`;
    archive.disabled=view.collection!=='current'||result.counts.total===0;
    head.replaceChildren();
    for (const key of view.columns) { const th=node('th'); th.scope='col'; th.dataset.column=key; th.setAttribute('aria-sort',view.sort===columnSorts[key]?(view.direction==='asc'?'ascending':'descending'):'none'); const button=node('button',columnLabels[key]); button.type='button'; button.addEventListener('click',()=>{view.direction=view.sort===columnSorts[key]&&view.direction==='asc'?'desc':'asc';view.sort=columnSorts[key];syncControls();changed();}); th.append(button); head.append(th); }
    const actionHead=node('th','Listing'); actionHead.scope='col'; head.append(actionHead);
    rows.replaceChildren();
    for (const row of result.rows) { const tr=node('tr'); tr.dataset.fit=row.fit ?? 'unknown'; for (const key of view.columns) { const td=rowCell(row,key); td.dataset.column=key; tr.append(td); } const actions=node('td','','row-actions'); const link=node('a','Original'); link.href=row.sourceUrl; link.target='_blank'; link.rel='noopener noreferrer'; link.setAttribute('aria-label',`Open original listing for ${row.title}`); actions.append(link); tr.append(actions); tr.addEventListener('click',event=>{if(event.target instanceof Element&&!event.target.closest('button,a')) void openJob(row.id);}); rows.append(tr); }
    syncControls();
    if (focusedColumn) head.querySelector<HTMLButtonElement>(`[data-column="${CSS.escape(focusedColumn)}"] button`)?.focus();
    const empty=document.getElementById('empty')!; empty.hidden=result.rows.length>0; empty.querySelector('h2')!.textContent=result.counts.total?'No jobs match these filters':view.collection==='trash'?'No recently deleted jobs':view.collection==='current'?'Your next search starts with your agent':'No jobs in this search'; empty.querySelectorAll('p')[1]!.hidden=result.counts.total>0||view.collection!=='current'; empty.querySelector('p')!.textContent=result.counts.total?'Change your filters or choose All availability to review closed listings. Agent exclusion, your decision and application outcomes stay separate.':view.collection==='trash'?'Jobs moved here remain recoverable until permanently deleted.':view.collection!=='current'?'Choose another search from Search history.':'Describe the role you want. Your agent explores related titles, researches jobs and saves its reasons here.';
  }
  async function loadRows() { const request=++requestId; table.setAttribute('aria-busy','true'); status.textContent='Loading comparisons…'; status.className='muted'; const params=new URLSearchParams(Object.entries(view).filter(([key])=>key!=='columns').map(([key,value])=>[key,String(value)]));
    try { const result=await api<WorkspaceResult>(`?${params}`); if(request!==requestId)return; render(result); status.textContent=''; }
    finally { if(request===requestId)table.setAttribute('aria-busy','false'); }
  }
  let searchTimer: ReturnType<typeof setTimeout>; search.addEventListener('input',()=>{view.query=search.value; clearTimeout(searchTimer); searchTimer=setTimeout(changed,180);});
  savedSelect.addEventListener('change',()=>{const item=saved.find(item=>item.id===savedSelect.value);remove.disabled=!item;if(item){view=structuredClone(item.view);syncControls(); const selected=item.id;changed();savedSelect.value=selected;remove.disabled=false;}});
  save.addEventListener('click',()=>{if(!name.value.trim()){name.focus();status.textContent='Name this view before saving.';return;} save.disabled=true;void api<{id:string;name:string;view:WorkspaceView}>('/views',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.value,view})}).then(item=>{saved.push(item);listSaved();savedSelect.value=item.id;remove.disabled=false;name.value='';status.textContent='View saved on this computer.';}).catch(report).finally(()=>{save.disabled=false;});});
  remove.addEventListener('click',()=>{const id=savedSelect.value;if(!id)return;remove.disabled=true;void api(`/views/${encodeURIComponent(id)}`,{method:'DELETE'}).then(()=>{saved=saved.filter(item=>item.id!==id);listSaved();status.textContent='Saved view deleted. Current filters remain.';}).catch(report).finally(()=>{remove.disabled=!savedSelect.value;});});
  let initialized = false;
  async function initialize() { if (initialized) return; const state = await api<{current:WorkspaceView;saved:typeof saved}>('/views'); view=state.current;saved=state.saved;syncControls();listSaved();initialized=true;controls.inert=false;search.disabled=false; }
  const retry=document.getElementById('refresh-jobs')!; retry.addEventListener('click',()=>void refresh().catch(report));
  async function refresh(){await initialize();await loadArchives();await loadRows();}
  return {refresh};
}
