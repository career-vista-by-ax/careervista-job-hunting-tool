import type { Decision, PreferenceProposal, ReviewDecision } from '../feedback.ts';
import type { Profile, Preference, PreferenceKind } from '../profiles.ts';
function node<K extends keyof HTMLElementTagNameMap>(tag:K,content=''){const item=document.createElement(tag);item.textContent=content;return item;}
async function api<T>(path:string,body?:unknown):Promise<T>{const response=await fetch(`/api/v1${path}`,body===undefined?undefined:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw new Error(result.error?.message??'Feedback operation failed.');return result as T;}
function field(parent:HTMLElement,title:string,value='',multiline=false){const label=node('label',title);const input=multiline?node('textarea'):node('input');input.value=value;input.maxLength=8000;if(input instanceof HTMLTextAreaElement)input.rows=3;label.append(input);parent.append(label);return input;}
function checkbox(parent:HTMLElement,title:string){const label=node('label');label.className='feedback-check';const input=node('input');input.type='checkbox';label.append(input,document.createTextNode(title));parent.append(label);return input;}
const value=(pref:Preference|undefined)=>pref?`${pref.kind}: ${typeof pref.value==='string'?pref.value:JSON.stringify(pref.value)}`:'Not set (track inherits shared setting)';

export async function showFeedback(parent:HTMLElement,jobId:string,onChanged:()=>Promise<void>=async()=>{}){
 const section=node('section');section.className='feedback-section';section.append(node('h3','Your decision'));parent.append(section);
 const status=node('p');status.setAttribute('role','status');section.append(status);
 function report(error:unknown){status.textContent=error instanceof Error?error.message:'Could not record feedback.';status.className='error';}
 async function render(){
  const history=await api<{decision:ReviewDecision;events:Decision[]}>(`/jobs/${encodeURIComponent(jobId)}/reviews`);if(!section.isConnected)return;
  section.replaceChildren(node('h3','Your decision'),status,node('p',`Current review: ${history.decision}. Your choice can differ from the agent's recommendation.`));
  const form=node('form'),select=node('select');for(const [key,label]of [['saved','Save / pursue'],['dismissed','Dismiss'],['unreviewed','Mark unreviewed']]){const option=node('option',label);option.value=key!;select.append(option);}select.value=history.decision;const choice=node('label','Review decision');choice.append(select);form.append(choice);
  const reason=field(form,'Reason (optional; applies to this decision only)','',true);const submit=node('button','Record my decision');submit.type='submit';form.append(submit);section.append(form);let operationId=crypto.randomUUID();
  form.addEventListener('input',()=>{operationId=crypto.randomUUID();});
  form.addEventListener('submit',event=>{event.preventDefault();submit.disabled=true;void api(`/jobs/${encodeURIComponent(jobId)}/reviews`,{operationId,decision:select.value,reason:reason.value}).then(async()=>{status.textContent='Review recorded. Preferences and application status were not changed.';status.className='';await render();await onChanged();}).catch(report).finally(()=>{submit.disabled=false;});});
  const latest=history.events.at(-1);
  if(latest?.reason.trim()){
   const suggest=node('button','Propose a general preference from this feedback');suggest.type='button';suggest.className='quiet';suggest.addEventListener('click',()=>void proposalForm(latest).catch(report));section.append(suggest);
  }
  if(history.events.length){const details=node('details');details.append(node('summary','Your review history'));for(const event of history.events)details.append(node('p',`${event.decision} · ${new Date(event.createdAt).toLocaleString()}${event.reason?` · ${event.reason}`:''}`));section.append(details);}
 }
 async function proposalForm(decision:Decision){
  const profile=await api<Profile|null>('/profiles/active');if(!profile){report(new Error('Approve a profile before proposing a general preference.'));return;}
  const wrapper=node('div');wrapper.append(node('h4','Propose a general change'),node('p',`Supporting feedback: ${decision.reason}. This creates a pending proposal; it does not change your search.`));
  const form=node('form');const key=field(form,'Preference key (for example workArrangement or location)');key.required=true;
  const scope=node('select');const shared=node('option','Shared preferences');shared.value='';scope.append(shared);for(const track of profile.tracks){const option=node('option',track.name);option.value=track.id;scope.append(option);}const scopeLabel=node('label','Scope');scopeLabel.append(scope);form.append(scopeLabel);
  const kind=node('select');for(const [key,label]of [['soft','Soft preference'],['undecided','Undecided'],['hard','Hard exclusion — needs separate confirmation when applied']]){const option=node('option',label);option.value=key!;kind.append(option);}const strength=node('label','Proposed strength');strength.append(kind);form.append(strength);
  const preferenceValue=field(form,'Proposed value');preferenceValue.required=true;kind.addEventListener('change',()=>{preferenceValue.disabled=kind.value==='undecided';preferenceValue.required=!preferenceValue.disabled;});
  const explanation=field(form,'Why might this feedback generalise?',decision.reason,true);explanation.required=true;const submit=node('button','Save pending proposal');submit.type='submit';form.append(submit);wrapper.append(form);section.append(wrapper);let submissionId=crypto.randomUUID();form.addEventListener('input',()=>{submissionId=crypto.randomUUID();});
  form.addEventListener('submit',event=>{event.preventDefault();submit.disabled=true;void api('/preference-proposals',{submissionId,baseProfileVersion:profile.version,feedbackIds:[decision.id],...(scope.value?{trackId:scope.value}:{}),change:{key:key.value.trim(),kind:kind.value as PreferenceKind,value:kind.value==='undecided'?null:preferenceValue.value.trim()},explanation:explanation.value}).then(()=>{wrapper.remove();status.textContent='Pending proposal saved. Review supporting feedback before applying it.';status.className='';window.dispatchEvent(new CustomEvent('careervista:feedback-proposals'));}).catch(report).finally(()=>{submit.disabled=false;});});
 }
 try{await render();}catch(error){report(error);}
}

export function installFeedbackUI(onChanged:()=>Promise<void>=async()=>{}){
 const panel=node('section');panel.className='feedback-panel';panel.hidden=true;panel.setAttribute('aria-label','Preference proposals');const status=node('p');status.setAttribute('role','status');panel.append(status);const content=node('div');panel.append(content);
 const toggle=node('button','Preference proposals');toggle.type='button';toggle.className='quiet';toggle.setAttribute('aria-expanded','false');document.querySelector('.toolbar-actions')!.append(toggle);document.querySelector('.toolbar')!.after(panel);
 const report=(error:unknown)=>{status.textContent=error instanceof Error?error.message:'Could not update this proposal.';status.className='error';};
 const open=()=>{panel.hidden=false;toggle.setAttribute('aria-expanded','true');void render().catch(report);};toggle.addEventListener('click',()=>{if(panel.hidden)open();else{panel.hidden=true;toggle.setAttribute('aria-expanded','false');}});window.addEventListener('careervista:feedback-proposals',open);
 async function render(){
  const [proposals,jobs]=await Promise.all([api<PreferenceProposal[]>('/preference-proposals'),api<{id:string;title:string;company:string}[]>('/jobs')]);content.replaceChildren(node('h2','Review proposed preference changes'),node('p','Each proposal is a suggestion. Applying or reversing it creates a new approved profile revision; individual save/dismiss decisions never do this automatically.'));
  if(!proposals.length)content.append(node('p','No preference proposals. Optional review reasons can support a proposal after you decide they should generalise.'));
  for(const proposal of proposals){
   const profile=await api<Profile>(`/profiles/${proposal.baseProfileVersion}`);const previous=(proposal.trackId?profile.tracks.find(track=>track.id===proposal.trackId)?.preferences:profile.preferences)?.find(pref=>pref.key===proposal.change.key);
   const section=node('section');section.append(node('h3',`${proposal.change.key} · ${proposal.status}`),node('p',`${proposal.trackId?`Track ${proposal.trackId}`:'Shared preferences'} · based on profile v${proposal.baseProfileVersion}`),node('p',`Before: ${value(previous)}`),node('p',`Proposed: ${value(proposal.change)}`),node('p',proposal.explanation));
   const support=node('ul');for(const feedback of proposal.feedback){const job=jobs.find(job=>job.id===feedback.jobId);support.append(node('li',`${job?`${job.title} at ${job.company}`:'Saved job'} · ${feedback.decision} · ${feedback.reason||'No explanation'}`));}section.append(node('h4','Supporting feedback'),support);
   for(const event of proposal.events)section.append(node('p',`${event.action} · ${new Date(event.createdAt).toLocaleString()}${event.profileVersion?` · profile v${event.profileVersion}`:''}`));
   if(['pending','accepted'].includes(proposal.status)){
    const confirmed=checkbox(section,'I reviewed this change and its supporting feedback.');const hard=proposal.status==='accepted'||proposal.change.kind==='hard';const hardConfirmed=hard?checkbox(section,proposal.status==='accepted'?'I explicitly confirm any hard exclusion restored by this reversal.':'I explicitly confirm adding this hard exclusion to future searches.'):null;
    const actions=node('div');actions.className='profile-actions';section.append(actions);
    const act=(action:string)=>{status.textContent='';void api<{profile:Profile|null}>(`/preference-proposals/${proposal.id}/${action}`,{operationId:crypto.randomUUID(),confirmed:confirmed.checked,confirmHardExclusion:action==='reject'?false:hardConfirmed?.checked??false}).then(async result=>{status.textContent=action==='reject'?'Proposal rejected. Preferences were not changed.':'Profile revision saved. Historical assessments retain their original profile versions.';status.className='';await render();await onChanged();if(result.profile)window.dispatchEvent(new CustomEvent('careervista:profile-draft',{detail:result.profile.version}));}).catch(report);};
    if(proposal.status==='pending'){const accept=node('button','Apply change');accept.type='button';accept.addEventListener('click',()=>act('accept'));const reject=node('button','Reject proposal');reject.type='button';reject.className='quiet';reject.addEventListener('click',()=>act('reject'));actions.append(accept,reject);}else{const reverse=node('button','Reverse this change');reverse.type='button';reverse.className='quiet';reverse.addEventListener('click',()=>act('reverse'));actions.append(reverse);}
   }
   content.append(section);
  }
 }
}
