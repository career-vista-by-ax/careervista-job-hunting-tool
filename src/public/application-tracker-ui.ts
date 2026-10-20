import type { ApplicationEvent, ApplicationStatus } from '../applications.ts';
import type { ApplicationDetails } from '../application-details.ts';
import { t } from './i18n.ts';
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '') => { const node = document.createElement(tag); node.textContent = t(text); return node; };
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/v1${path}`, body === undefined ? {} : { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  const value = await response.json(); if (!response.ok) throw new Error(value.error?.message ?? t('Could not save. Please try again.')); return value as T;
}
export async function mountApplicationTracker(host: HTMLElement, jobId: string) {
  const history = await api<{events: ApplicationEvent[]}>(`/jobs/${jobId}/applications`);
  const latest = history.events.at(-1), details = latest?.details ?? {};
  const form = el('form'); form.className = 'application-tracker';
  form.append(el('h3','Update application progress'), el('p','Keep your own records here. Saving does not submit an application or contact anyone.'));
  function field(label: string, value = '', type = 'text', target: HTMLElement = form) {
    const input = el('input'); input.type = type; input.value = value; const wrap = el('label',label); wrap.append(input); target.append(wrap); return input;
  }
  function select(label: string, values: [string,string][], value: string, target: HTMLElement = form) {
    const input = el('select'); for (const [key,text] of values) { const option = el('option',text); option.value = key; input.append(option); } input.value = value;
    const wrap = el('label',label); wrap.append(input); target.append(wrap); return input;
  }
  const statusChoices: [string,string][] = [['','Choose a stage'],['preparing','Preparing'],['applied','Applied'],['screening','Screening'],['assessment','Assessment / task'],['interview','Interview'],['offer','Offer'],['accepted','Accepted'],['rejected','Rejected'],['withdrawn','Withdrawn'],['follow_up','Follow-up']];
  const status = select('Application stage',statusChoices,latest?.status ?? ''); status.required = true;
  const date = field('Update date',localDate(),'date'); date.required = true;
  const stage = field('Interview / process detail',details.stage ?? ''); stage.placeholder = t('For example: technical interview, round 2');
  const nextDate = field('Follow-up date',latest?.followUpOn ?? '','date');
  const presets = el('div'); presets.className = 'reminder-presets'; presets.setAttribute('aria-label',t('Follow-up shortcuts'));
  for (const days of [2,5,7,14]) {
    const button = el('button',`${days} ${t('days')}`); button.type = 'button'; button.className = 'quiet';
    button.addEventListener('click',() => { const base = new Date(`${date.value || localDate()}T12:00:00`); base.setDate(base.getDate()+days); nextDate.value = localDate(base); }); presets.append(button);
  }
  const clearDate = el('button','Clear reminder'); clearDate.type = 'button'; clearDate.className = 'quiet'; clearDate.addEventListener('click',()=> {nextDate.value='';}); presets.append(clearDate); form.append(presets);
  form.append(el('p','Reminders appear in CareerVista when due, including archived applications. They do not send emails or system notifications.'));
  const answers = el('details'); answers.open = false; answers.append(el('summary','Application answers'));
  const fields = el('div'); fields.className = 'application-fields'; answers.append(fields); form.append(answers);
  const amount = field('Salary expectation as stated',details.salaryAmount ?? '','text',fields);
  const currency = field('Currency',details.salaryCurrency ?? 'AUD','text',fields); currency.maxLength = 3;
  const basis = select('Base / super basis',[['','Not specified'],['base_excluding_super','Base excluding super'],['package_including_super','Package including super'],['other','Other — describe in notes']],details.salaryBasis ?? '',fields);
  const period = select('Pay period',[['','Not specified'],['annual','Annual'],['daily','Daily'],['hourly','Hourly'],['other','Other — describe in notes']],details.salaryPeriod ?? '',fields);
  const notice = field('Notice period',details.noticePeriod ?? '','text',fields);
  const available = field('Available from',details.availableFrom ?? '','date',fields);
  const rights = field('Work rights / sponsorship answer',details.workRights ?? '','text',fields);
  const contactsSection = el('details'); contactsSection.open = false; contactsSection.append(el('summary','Contact people'));
  const contacts = el('div'); contactsSection.append(contacts); form.append(contactsSection);
  const contactRows: {node: HTMLElement; inputs: HTMLInputElement[]}[] = [];
  function addContact(value = {name:'',role:'',email:'',phone:'',notes:''}) {
    const row = el('fieldset'); row.append(el('legend','Contact')); row.className = 'application-fields';
    const inputs = [field('Name',value.name,'text',row),field('Role / relationship',value.role,'text',row),field('Email',value.email,'email',row),field('Phone',value.phone,'tel',row),field('Contact notes',value.notes,'text',row)];
    const remove = el('button','Remove contact'); remove.type='button'; remove.className='quiet'; const entry={node:row,inputs}; contactRows.push(entry); remove.addEventListener('click',()=>{contactRows.splice(contactRows.indexOf(entry),1);row.remove();}); row.append(remove); contacts.append(row);
  }
  for (const contact of details.contacts ?? []) addContact(contact);
  const addPerson = el('button','Add contact'); addPerson.type='button'; addPerson.className='quiet'; addPerson.addEventListener('click',()=>addContact()); contactsSection.append(addPerson);
  const questionsSection = el('details'); questionsSection.open = false; questionsSection.append(el('summary','Other application questions and answers'));
  const questions = el('div'); questionsSection.append(questions); form.append(questionsSection);
  const questionRows: {node: HTMLElement; question: HTMLInputElement; answer: HTMLTextAreaElement}[] = [];
  function addQuestion(value = {question:'',answer:''}) {
    const row = el('fieldset'); const question = field('Question',value.question,'text',row);
    const label = el('label','Your answer'); const answer = el('textarea'); answer.rows = 3; answer.value = value.answer; label.append(answer); row.append(label);
    const remove=el('button','Remove question'); remove.type='button'; remove.className='quiet'; const entry={node:row,question,answer}; questionRows.push(entry); remove.addEventListener('click',()=>{questionRows.splice(questionRows.indexOf(entry),1);row.remove();}); row.append(remove); questions.append(row);
  }
  for (const question of details.questions ?? []) addQuestion(question);
  const addQ = el('button','Add question and answer'); addQ.type='button'; addQ.className='quiet'; addQ.addEventListener('click',()=>addQuestion()); questionsSection.append(addQ);
  const filesSection = el('details'); filesSection.open = false; filesSection.append(el('summary','CV, cover letter and other copies'));
  filesSection.append(el('p','Store the exact version used for this application. PDF, DOC, DOCX, TXT or RTF; up to 5 MiB each and 50 MiB in total. Copies stay local and are included in private backups.'));
  const files = await api<{id:string;name:string;kind:'resume'|'letter'|'other'}[]>(`/jobs/${jobId}/application-files`);
  const selected = new Set((latest?.documents ?? []).map(doc=>doc.reference));
  const fileList = el('div'); const fileInputs = new Map<string,HTMLInputElement>();
  function showFile(file: typeof files[number]) {
    const row = el('div'); row.className='application-file'; const label=el('label'); const check=el('input'); check.type='checkbox';check.checked=selected.has(`application-file:${file.id}`); fileInputs.set(file.id,check);label.append(check,document.createTextNode(`${t('Used for this update')}: ${file.name}`));
    const link=el('a','Download copy'); link.href=`/api/v1/application-files/${file.id}`;row.append(label,link);fileList.append(row);
  }
  files.forEach(showFile);
  const kind = select('Copy type',[['resume','CV / resume'],['letter','Cover letter'],['other','Other document']],'resume',filesSection);
  const upload = field('Choose a copy','','file',filesSection); upload.accept='.pdf,.doc,.docx,.txt,.rtf';
  const uploadButton=el('button','Save local copy'); uploadButton.type='button';uploadButton.className='quiet';
  const fileStatus=el('p');fileStatus.setAttribute('role','status');
  uploadButton.addEventListener('click',async()=>{
    const file=upload.files?.[0]; if(!file){fileStatus.textContent=t('Choose a file first.');return;} if(file.size>5*1024*1024){fileStatus.textContent=t('The file exceeds 5 MiB.');return;}
    uploadButton.disabled=true;
    try {
      const contentBase64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]!);reader.onerror=()=>reject(new Error(t('Could not read the file.')));reader.readAsDataURL(file);});
      const result=await api<{file:typeof files[number]}>(`/jobs/${jobId}/application-files`,{operationId:crypto.randomUUID(),name:file.name,kind:kind.value,contentBase64});files.push(result.file);selected.add(`application-file:${result.file.id}`);showFile(result.file);upload.value='';fileStatus.textContent=t('Copy saved. Record the update to link it to this stage.');
    } catch(error){fileStatus.textContent=error instanceof Error?error.message:t('Could not save. Please try again.');}finally{uploadButton.disabled=false;}
  });
  filesSection.append(fileList,uploadButton,fileStatus); form.append(filesSection);
  const noteLabel=el('label','Notes / next steps');const note=el('textarea');note.rows=3;noteLabel.append(note);form.append(noteLabel);
  const save=el('button','Record update');save.type='submit';const message=el('p');message.setAttribute('role','status');form.append(save,message);host.append(form);
  let operationId=crypto.randomUUID();let savedBody='';
  form.addEventListener('submit',async event=>{
    event.preventDefault();save.disabled=true;
    const applicationDetails:ApplicationDetails={stage:stage.value,salaryAmount:amount.value,salaryCurrency:currency.value,salaryBasis:basis.value,salaryPeriod:period.value,noticePeriod:notice.value,availableFrom:available.value,workRights:rights.value,
      contacts:contactRows.map(({inputs})=>({name:inputs[0]!.value,role:inputs[1]!.value,email:inputs[2]!.value,phone:inputs[3]!.value,notes:inputs[4]!.value})),questions:questionRows.map(row=>({question:row.question.value,answer:row.answer.value}))};
    const body={status:status.value as ApplicationStatus,occurredAt:new Date(`${date.value}T12:00:00`).toISOString(),followUpOn:nextDate.value||null,note:note.value,details:applicationDetails,documents:files.filter(file=>fileInputs.get(file.id)?.checked).map(file=>({kind:file.kind,label:file.name,reference:`application-file:${file.id}`}))};
    const encoded=JSON.stringify(body);if(savedBody&&savedBody!==encoded)operationId=crypto.randomUUID();savedBody=encoded;
    try{await api(`/jobs/${jobId}/applications`,{...body,operationId});for(const child of [...host.children])if(child.tagName!=='SUMMARY')child.remove();await mountApplicationTracker(host,jobId);window.dispatchEvent(new Event('careervista:application-updated'));}catch(error){message.textContent=error instanceof Error?error.message:t('Could not save. Please try again.');save.disabled=false;}
  });
  const timeline=el('details');timeline.open=true;timeline.append(el('summary','Progress history'));
  if(!history.events.length)timeline.append(el('p','No application updates recorded.'));
  for(const event of [...history.events].reverse()){
    const entry=el('article');entry.className='application-event';entry.append(el('h4',`${t(statusChoices.find(([key])=>key===event.status)?.[1]??event.status)} · ${new Date(event.occurredAt).toLocaleDateString()}`));
    if(event.note){const text=el('p');text.className='user-content';text.textContent=event.note;entry.append(text);}
    if(event.followUpOn)entry.append(el('p',`${t('Follow-up date')}: ${event.followUpOn}`));
    for(const doc of event.documents){const p=el('p');p.textContent=doc.label;if(doc.reference.startsWith('application-file:')){const link=el('a','Download copy');link.href=`/api/v1/application-files/${encodeURIComponent(doc.reference.slice(17))}`;p.append(' · ',link);}entry.append(p);}
    const snapshot=el('details');snapshot.append(el('summary','Answers and contacts at this stage'));
    const labels:Record<string,string>={stage:'Interview / process detail',salaryAmount:'Salary expectation as stated',salaryCurrency:'Currency',salaryBasis:'Base / super basis',salaryPeriod:'Pay period',noticePeriod:'Notice period',availableFrom:'Available from',workRights:'Work rights / sponsorship answer'};
    for(const [key,label] of Object.entries(labels)){const value=event.details?.[key as keyof ApplicationDetails];if(typeof value==='string'&&value){const p=el('p');p.className='user-content';p.textContent=`${t(label)}: ${value}`;snapshot.append(p);}}
    for(const contact of event.details?.contacts??[]){const p=el('p');p.className='user-content';p.textContent=[contact.name,contact.role,contact.email,contact.phone,contact.notes].filter(Boolean).join(' · ');snapshot.append(p);}
    for(const question of event.details?.questions??[]){const p=el('p');p.className='user-content';p.textContent=`${question.question}\n${question.answer}`;snapshot.append(p);}
    entry.append(snapshot);timeline.append(entry);
  }
  host.append(timeline);
}
