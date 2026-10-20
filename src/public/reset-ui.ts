function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '') {
  const node = document.createElement(tag); node.textContent = text; return node;
}
interface Scope { totalRecords: number; warning: string; token?: string }
async function api<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  const response = await fetch(`/api/v1/reset${path}`, {
    method, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? 'Reset failed. Start again to retry.');
  return result as T;
}
export function mountResetTools(host: HTMLElement) {
  const section = el('section'); section.className = 'reset-tools'; section.setAttribute('aria-labelledby', 'reset-heading');
  const heading = el('h3', 'Reset all data'); heading.id = 'reset-heading';
  const description = el('p', 'Start over without reinstalling CareerVista. Permanently erase all saved career data and app-owned credentials, sessions and temporary files.');
  const start = el('button', 'Reset all data'); start.type = 'button'; start.className = 'danger-outline';
  const flow = el('div'); flow.className = 'reset-flow'; flow.hidden = true;
  const status = el('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  section.append(heading, description, start, flow, status); host.append(section);
  let token: string | undefined;
  let busy = false;
  let generation = 0;
  const cancel = () => {
    generation++;
    if (token) void api('/confirmation', { token }, 'DELETE').catch(() => {});
    token = undefined; description.hidden = false; flow.replaceChildren(); flow.hidden = true; start.hidden = false; start.disabled = false; status.textContent = ''; start.focus();
  };
  const cancelButton = () => {
    const button = el('button', 'Cancel'); button.type = 'button'; button.className = 'quiet'; button.addEventListener('click', cancel); return button;
  };
  // Escape/Close must discard typed confirmation and invalidate pending tokens.
  const dialog = host.closest('dialog');
  dialog?.addEventListener('close', () => { if (!busy) cancel(); });
  dialog?.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  const close = dialog?.querySelector<HTMLButtonElement>('[data-close-data]');
  start.addEventListener('click', async () => {
    const request = ++generation;
    start.disabled = true; status.textContent = 'Checking reset scope…';
    try {
      const scope = await api<Scope>('/preview', undefined, 'GET');
      if (request !== generation) return;
      status.textContent = ''; start.hidden = true; description.hidden = true; flow.hidden = false;
      const title = el('h4', 'First confirmation: erase all CareerVista data?');
      const counts = el('p', `${scope.totalRecords} saved records will be removed, along with app-owned credentials, sessions and temporary files.`);
      const warning = el('p', scope.warning);
      const keep = cancelButton();
      const next = el('button', 'Confirm scope and continue'); next.type = 'button'; next.className = 'danger-outline';
      const actions = el('div'); actions.className = 'reset-actions'; actions.append(keep, next);
      flow.replaceChildren(title, counts, warning, actions); keep.focus();
      next.addEventListener('click', async () => {
        next.disabled = true; keep.disabled = true; busy = true; if (close) close.disabled = true;
        try {
          const approved = await api<Scope>('/confirmation', { confirmation: 'RESET_ALL_DATA' });
          token = approved.token;
          const form = el('form');
          const finalTitle = el('h4', 'Final confirmation: this cannot be undone');
          const label = el('label', 'Type DELETE to permanently erase all data');
          const input = el('input'); input.type = 'text'; input.autocomplete = 'off'; input.spellcheck = false; input.autocapitalize = 'off'; input.required = true; input.pattern = 'DELETE';
          input.setAttribute('aria-describedby', 'reset-final-help'); label.append(input);
          const help = el('p', 'Enter DELETE exactly, in capital letters. Nothing is erased until you press Erase all data.'); help.id = 'reset-final-help';
          const back = cancelButton();
          const erase = el('button', 'Erase all data'); erase.type = 'submit'; erase.className = 'danger'; erase.disabled = true;
          input.addEventListener('input', () => { erase.disabled = input.value !== 'DELETE'; });
          const finalActions = el('div'); finalActions.className = 'reset-actions'; finalActions.append(back, erase);
          form.append(finalTitle, el('p', 'Erase all saved career data, profiles, resumes and drafts, research, views and app-owned credentials, sessions and temporary files. External backups, exports, original documents and normal browser profiles remain. CareerVista stays installed.'), label, help, finalActions); flow.replaceChildren(form); input.focus();
          form.addEventListener('submit', async event => {
            event.preventDefault();
            if (busy || input.value !== 'DELETE' || !token) return;
            busy = true; erase.disabled = true; back.disabled = true; input.disabled = true; if (close) close.disabled = true;
            status.textContent = 'Erasing saved data… Keep this window open.';
            try {
              const result = await api<{ unclearedFolders: string[] }>('', { token, confirmation: input.value });
              token = undefined; flow.replaceChildren();
              status.textContent = result.unclearedFolders.length
                ? `Saved career data was erased, but these app folders could not be cleared: ${result.unclearedFolders.join(', ')}. Start another reset to retry their cleanup.`
                : 'Reset complete. All saved career data and app-owned credentials, sessions and temporary files were erased. CareerVista is ready for a fresh start. External backups and exports remain.';
              const reload = el('button', 'Return to fresh workspace'); reload.type = 'button'; reload.addEventListener('click', () => location.reload()); flow.append(reload);
              if (result.unclearedFolders.length) { start.hidden = false; start.disabled = false; }
              reload.focus();
            } catch (error) {
              status.textContent = error instanceof Error ? error.message : 'Reset failed. Start again to retry.';
              description.hidden = false; flow.replaceChildren(); flow.hidden = true; start.hidden = false; start.disabled = false; start.focus();
            } finally { busy = false; if (close) close.disabled = false; }
          });
        } catch (error) {
          status.textContent = error instanceof Error ? error.message : 'Could not confirm reset. Try again.'; next.disabled = false; keep.disabled = false;
        } finally { busy = false; if (close) close.disabled = false; }
      });
    } catch (error) { if (request === generation) { status.textContent = error instanceof Error ? error.message : 'Could not review reset. Try again.'; start.disabled = false; } }
  });
}
