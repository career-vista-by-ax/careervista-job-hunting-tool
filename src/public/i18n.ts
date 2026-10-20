import { messages } from './messages.ts';
export type Language = 'en' | 'zh-CN' | 'zh-Hant';
let language: Language = 'en';
export function currentLanguage() { return language; }
export function t(text: string): string {
  if (language === 'en') return text;
  const pair = messages[text]; if (pair) return pair[language === 'zh-CN' ? 0 : 1];
  const saved = /^(\d+) saved$/.exec(text); if (saved) return `${saved[1]} ${language === 'zh-CN' ? '个已保存' : '個已儲存'}`;
  const count=/^(\d+) of (\d+) jobs · Select a role for details$/.exec(text);if(count)return language==='zh-CN'?`${count[1]} / ${count[2]} 个职位 · 点击查看详情`:`${count[1]} / ${count[2]} 個職位 · 點擊查看詳情`;
  const summary=/^(\d+) strong \/ promising · (\d+) low fit · (\d+) saved in the last 7 days · (\d+) applications need follow-up · (\d+) agent-excluded · (\d+) confirmed closed$/.exec(text);if(summary)return language==='zh-CN'?`${summary[1]} 个匹配／值得考虑 · ${summary[2]} 个低匹配 · 近7天保存 ${summary[3]} 个 · ${summary[4]} 个申请待跟进 · ${summary[5]} 个硬性不符 · ${summary[6]} 个已关闭`:`${summary[1]} 個符合／值得考慮 · ${summary[2]} 個低符合 · 近7天儲存 ${summary[3]} 個 · ${summary[4]} 個申請待追蹤 · ${summary[5]} 個硬性不符 · ${summary[6]} 個已關閉`;
  const evidence=/^Original saved evidence \((\d+)\)$/.exec(text);if(evidence)return language==='zh-CN'?`保存的英文原始证据（${evidence[1]}）`:`儲存的英文原始證據（${evidence[1]}）`;
  return text;
}
export async function initializeLanguage() {
  const response = await fetch('/api/v1/settings/language');
  if (!response.ok) throw new Error('Could not load language preference. Reload to retry.');
  const settings = await response.json() as {language:Language|null};
  language = settings.language ?? 'en'; document.documentElement.lang=language;
  const trigger=document.createElement('button');trigger.type='button';trigger.className='quiet';trigger.textContent=language==='en'?'Language':language==='zh-CN'?'语言':'語言';trigger.id='language-help';document.querySelector('header')!.append(trigger);
  const dialog=document.createElement('dialog');dialog.id='language-dialog';dialog.setAttribute('aria-labelledby','language-title');
  const form=document.createElement('form');form.className='language-content';
  const heading=document.createElement('h2');heading.id='language-title';heading.textContent='Language · 语言 · 語言';
  const text=document.createElement('p');text.textContent=t('Choose your preferred language. Original job listings and evidence stay in English.');
  const label=document.createElement('label');label.textContent='English / 简体中文 / 繁体中文';
  const select=document.createElement('select');
  for(const [value,name] of [['en','English'],['zh-CN','简体中文'],['zh-Hant','繁体中文']]){const option=document.createElement('option');option.value=value!;option.textContent=name!;select.append(option);}select.value=language;label.append(select);
  const save=document.createElement('button');save.type='submit';save.textContent='Save · 保存 · 儲存';
  const note=document.createElement('p');note.textContent=t('Changing language reloads the page. Save any edits first.');
  const error=document.createElement('p');error.setAttribute('role','status');
  form.append(heading,text,label,note,save,error);dialog.append(form);document.body.append(dialog);
  if(settings.language){const cancel=document.createElement('button');cancel.type='button';cancel.className='quiet';cancel.textContent=t('Cancel');cancel.addEventListener('click',()=>dialog.close());form.append(cancel);}
  else dialog.addEventListener('cancel',event=>event.preventDefault());
  trigger.addEventListener('click',()=>dialog.showModal());
  form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;try{const response=await fetch('/api/v1/settings/language',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language:select.value})});if(!response.ok)throw new Error(t('Could not save. Please try again.'));location.reload();}catch(problem){error.textContent=problem instanceof Error?problem.message:t('Could not save. Please try again.');save.disabled=false;}});
  if(!settings.language)dialog.showModal();
  // Translate only known interface copy, never source evidence or user entries.
  const excluded='pre,blockquote,textarea,input,[data-original],.evidence,.user-content,.job-title';
  const translate = (root: Node) => {
    if(root instanceof Element && root.closest(excluded))return;
    if(root.nodeType===Node.TEXT_NODE){const parent=root.parentElement;if(parent?.closest(excluded))return;const value=root.textContent??'';const translated=t(value.trim());if(translated!==value.trim())root.textContent=value.replace(value.trim(),translated);return;}
    for(const child of [...root.childNodes])translate(child);
    if(root instanceof Element)for(const attr of ['aria-label','placeholder','title']){const value=root.getAttribute(attr);if(value){const translated=t(value);if(value!==translated)root.setAttribute(attr,translated);}}
  };
  translate(document.body);
  const observer=new MutationObserver(records=>{for(const record of records){if(record.type==='childList'){for(const node of record.addedNodes)translate(node);}else if(record.type==='characterData')translate(record.target);}});
  observer.observe(document.body,{childList:true,subtree:true,characterData:true});
}
