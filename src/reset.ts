import { randomUUID } from 'node:crypto';
import { lstatSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { AppError, CareerVistaApp } from './app.ts';
import type { ApiRoute } from './server.ts';

const warning = 'Permanently removes all saved jobs, evidence, analyses, profiles, preferences, resumes and drafts, company research, application history, research runs and saved views. Also clears CareerVista-owned credentials, sessions, caches, logs and temporary files. The app stays installed and running. External backups, exports, original documents and normal browser profiles are not erased. Pause any agent research before resetting.';
const fileKinds = ['credentials', 'sessions', 'cache', 'logs', 'temp'] as const;
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
interface Confirmation { token: string; expiresAt: number; changes: number }
// A confirmation belongs to this running app, never to a persisted backup.
const confirmations = new WeakMap<CareerVistaApp, Confirmation>();

export class ResetService {
  private app: CareerVistaApp;
  constructor(app: CareerVistaApp) { this.app = app; }
  private tables() {
    return this.app.database.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'migrations' ORDER BY name").all().map(row => String(row.name));
  }
  private changes() { return Number(this.app.database.prepare('SELECT total_changes() AS count').get()?.count); }
  private checkDirectories() {
    // Never traverse a redirected namespace. rm unlinks child symlinks instead
    // of following them, preserving original documents and host browser profiles.
    if (lstatSync(this.app.root).isSymbolicLink()) throw new AppError('Reset cannot use a linked installation folder.', 409, 'unsafe_reset_path');
    for (const kind of fileKinds) {
      const stat = lstatSync(this.app.paths[kind]);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new AppError(`Reset cannot clear the linked or invalid ${kind} folder. No data was removed.`, 409, 'unsafe_reset_path');
    }
  }
  preview() {
    this.checkDirectories();
    const records = Object.fromEntries(this.tables().map(name => [name, Number(this.app.database.prepare(`SELECT count(*) AS count FROM ${quote(name)}`).get()?.count)]));
    return { records, totalRecords: Object.values(records).reduce((sum, count) => sum + count, 0), warning };
  }
  confirm(input: { confirmation?: unknown } | null) {
    if (input?.confirmation !== 'RESET_ALL_DATA') throw new AppError('Confirm the reset scope before continuing.', 400, 'reset_confirmation_required');
    const preview = this.preview();
    const confirmation = { token: randomUUID(), expiresAt: Date.now() + 5 * 60_000, changes: this.changes() };
    confirmations.set(this.app, confirmation);
    return { ...preview, token: confirmation.token, expiresAt: new Date(confirmation.expiresAt).toISOString() };
  }
  cancel(token: unknown) {
    if (confirmations.get(this.app)?.token === token) confirmations.delete(this.app);
    return { cancelled: true };
  }
  reset(input: { token?: unknown; confirmation?: unknown } | null) {
    const pending = confirmations.get(this.app);
    if (!pending || input?.token !== pending.token || Date.now() >= pending.expiresAt) throw new AppError('Reset confirmation is missing or expired. Start again from Reset all data.', 409, 'reset_confirmation_required');
    if (input?.confirmation !== 'DELETE') throw new AppError('Type DELETE exactly to confirm the full reset.', 400, 'reset_confirmation_required');
    if (pending.changes !== this.changes()) {
      confirmations.delete(this.app);
      throw new AppError('Saved data changed during confirmation. Pause your agent and review the reset again.', 409, 'reset_data_changed');
    }
    const preview = this.preview();
    const db = this.app.database;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec('PRAGMA defer_foreign_keys = ON');
      for (const name of this.tables()) db.exec(`DELETE FROM ${quote(name)}`);
      if (db.prepare('PRAGMA foreign_key_check').all().length) throw new AppError('Reset could not preserve database integrity. No records were removed.', 409, 'reset_failed');
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    confirmations.delete(this.app);
    // Filesystem deletion cannot share SQLite's transaction. Report partial
    // cleanup honestly; another confirmed reset can finish the remaining files.
    const unclearedFolders: string[] = [];
    for (const kind of fileKinds) {
      try {
        for (const name of readdirSync(this.app.paths[kind])) rmSync(join(this.app.paths[kind], name), { recursive: true, force: true });
      } catch { unclearedFolders.push(kind); }
    }
    return { reset: true, removedRecords: preview.totalRecords, unclearedFolders, warning };
  }
}

export const resetRoutes: ApiRoute = async ({ app, request, url, json, send }) => {
  const service = new ResetService(app);
  if (request.method === 'GET' && url.pathname === '/api/v1/reset/preview') { send(service.preview()); return true; }
  if (request.method === 'POST' && url.pathname === '/api/v1/reset/confirmation') { send(service.confirm(await json() as { confirmation?: unknown })); return true; }
  if (request.method === 'DELETE' && url.pathname === '/api/v1/reset/confirmation') { const input = await json() as { token?: unknown } | null; send(service.cancel(input?.token)); return true; }
  if (request.method === 'POST' && url.pathname === '/api/v1/reset') { send(service.reset(await json() as { token?: unknown; confirmation?: unknown })); return true; }
  return false;
};
