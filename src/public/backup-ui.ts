function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '') { const item = document.createElement(tag); item.textContent = text; return item; }
export function mountBackupTools(target?: HTMLElement) {
  const host = target ?? document.querySelector('main'); if (!host) return;
  const tools = element('details'); tools.id = 'backup-tools';
  tools.append(element('summary', 'Backup and restore'));
  tools.append(element('p', 'Keep a private recovery copy of saved jobs, evidence, profiles, assessments and application history. Backups contain personal data. Store them somewhere you trust.'));
  tools.append(element('p', 'Credentials, browser sessions and disposable files are excluded. After restoring, configure model providers and sign in to source websites again. Document references are retained; copy external document files separately.'));
  const message = element('p'); message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite');
  const download = element('button', 'Download private backup'); download.type = 'button';
  download.addEventListener('click', async () => {
    download.disabled = true; message.textContent = 'Preparing backup…';
    try {
      const response = await fetch('/api/v1/backup');
      if (!response.ok) { const error = await response.json(); throw new Error(error.error?.message ?? 'Backup failed.'); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob);
      try { const link = element('a'); link.href = url; link.download = `careervista-backup-${new Date().toISOString().slice(0, 10)}.json`; host.append(link); link.click(); link.remove(); }
      finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
      message.textContent = 'Backup downloaded. It excludes credentials and browser sessions.';
    } catch (error) { message.textContent = error instanceof Error ? error.message : 'Could not create backup.'; }
    finally { download.disabled = false; }
  });
  const form = element('form'); form.append(element('h3', 'Restore into this empty installation'));
  form.append(element('p', 'Restore never overwrites an installation containing saved data. To keep existing work, launch a separate empty installation first. Supported backup size: up to 128 MiB.'));
  const fileLabel = element('label', 'Choose backup JSON file'); const file = element('input'); file.type = 'file'; file.accept = '.json,application/json'; fileLabel.append(file);
  const textLabel = element('label', 'Or paste backup JSON'); const text = element('textarea'); text.rows = 5; text.spellcheck = false; textLabel.append(text);
  const restore = element('button', 'Restore backup'); restore.type = 'submit'; form.append(fileLabel, textLabel, restore);
  form.addEventListener('submit', async event => {
    event.preventDefault(); restore.disabled = true; message.textContent = 'Checking backup…';
    try {
      const selected = file.files?.[0];
      if (selected && text.value.trim()) throw new Error('Choose either a file or pasted JSON. Clear one before restoring.');
      if (selected && selected.size > 128 * 1024 * 1024) throw new Error('Backup exceeds the supported 128 MiB limit.');
      const content = selected ? await selected.text() : text.value;
      if (!content.trim()) throw new Error('Choose a backup file or paste its JSON.');
      JSON.parse(content);
      const response = await fetch('/api/v1/backup/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: content });
      const result = await response.json(); if (!response.ok) throw new Error(result.error?.message ?? 'Restore failed.');
      message.textContent = `Restored ${result.records} records. Reload to review them. Configure providers and source website sign-ins again if needed.`;
      const reload = element('button', 'Reload saved workspace'); reload.type = 'button'; reload.addEventListener('click', () => location.reload()); message.append(' ', reload); text.value = ''; file.value = '';
    } catch (error) { message.textContent = error instanceof SyntaxError ? 'The selected content is not valid JSON.' : error instanceof Error ? error.message : 'Could not restore backup.'; }
    finally { restore.disabled = false; }
  });
  tools.append(download, form, message); host.append(tools);
}
